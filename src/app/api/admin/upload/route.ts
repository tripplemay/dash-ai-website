import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getDb, getResourceByFileKey } from "@/lib/db";
import { RESOURCE_CATEGORY_EN, RESOURCE_CATS_STORE, resolveResourceCategory } from "@/lib/data";
import { getStorage, StorageError } from "@/lib/storage";
import type { StoredObject } from "@/lib/storage";

export const runtime = "nodejs";

function boundedPositiveEnv(name: string, fallback: number, maximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, Math.floor(parsed)) : fallback;
}

const MAX_UPLOAD_BYTES = boundedPositiveEnv("DASH_UPLOAD_MAX_BYTES", 64 * 1024 * 1024, 64 * 1024 * 1024);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MIME_BY_EXT: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  pdf: ["application/pdf"],
  ppt: ["application/vnd.ms-powerpoint", "application/octet-stream"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
  doc: ["application/msword", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
  zip: ["application/zip", "application/x-zip-compressed"],
  mp3: ["audio/mpeg", "audio/mp3", "application/octet-stream"],
  mp4: ["video/mp4", "application/mp4"],
  webm: ["video/webm"],
};

function responseForStorageError(error: unknown) {
  if (!(error instanceof StorageError)) return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  const status =
    error.code === "CONFLICT" ? 409 : error.code === "TOO_LARGE" ? 413 : error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "INVALID_KEY" ? 400 : 500;
  return NextResponse.json({ error: error.code }, { status });
}

class UploadParseError extends Error {
  constructor(public readonly code: "INVALID_MULTIPART" | "TOO_LARGE") {
    super(code);
  }
}

interface ParsedUpload {
  fields: Record<string, string>;
  filename: string;
  mimeType: string;
  tempDir: string;
  tempPath: string;
  size: number;
}

/** Parse multipart incrementally; req.formData() would buffer the whole file. */
async function parseMultipart(req: NextRequest): Promise<ParsedUpload> {
  const contentType = req.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    throw new UploadParseError("INVALID_MULTIPART");
  }
  if (!req.body) throw new UploadParseError("INVALID_MULTIPART");

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "dash-upload-"));
  const tempPath = path.join(tempDir, "payload");
  const fields: Record<string, string> = {};
  let filename = "";
  let mimeType = "";
  let size = 0;
  let fileSeen = false;
  let fileTruncated = false;
  let fileDone: Promise<void> = Promise.resolve();

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanupAndReject = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const parser = Busboy({
        headers: { "content-type": contentType },
        defParamCharset: "utf8",
        limits: {
          fileSize: MAX_UPLOAD_BYTES,
          files: 1,
          fields: 8,
          fieldSize: 4096,
          parts: 12,
        },
      });
      parser.on("field", (name, value) => {
        fields[name] = value;
      });
      parser.on("file", (name, stream, info) => {
        if (name !== "file" || fileSeen) {
          stream.resume();
          cleanupAndReject(new UploadParseError("INVALID_MULTIPART"));
          return;
        }
        fileSeen = true;
        filename = info.filename;
        mimeType = info.mimeType;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
        });
        stream.on("limit", () => {
          fileTruncated = true;
        });
        fileDone = pipeline(stream, fs.createWriteStream(/*turbopackIgnore: true*/ tempPath, { flags: "wx", mode: 0o600 }));
        fileDone.catch((error) => cleanupAndReject(error instanceof Error ? error : new Error("upload stream failed")));
      });
      parser.on("filesLimit", () => cleanupAndReject(new UploadParseError("INVALID_MULTIPART")));
      parser.on("fieldsLimit", () => cleanupAndReject(new UploadParseError("INVALID_MULTIPART")));
      parser.on("partsLimit", () => cleanupAndReject(new UploadParseError("INVALID_MULTIPART")));
      parser.on("error", (error) => cleanupAndReject(error instanceof Error ? error : new Error("multipart parser failed")));
      parser.on("close", () => {
        fileDone
          .then(() => {
            if (settled) return;
            if (!fileSeen) return cleanupAndReject(new UploadParseError("INVALID_MULTIPART"));
            if (fileTruncated || size > MAX_UPLOAD_BYTES) return cleanupAndReject(new UploadParseError("TOO_LARGE"));
            settled = true;
            resolve();
          })
          .catch((error) => cleanupAndReject(error instanceof Error ? error : new Error("upload stream failed")));
      });
      const source = Readable.fromWeb(req.body as import("node:stream/web").ReadableStream);
      source.on("error", (error) => cleanupAndReject(error instanceof Error ? error : new Error("request stream failed")));
      source.pipe(parser);
    });
    return { fields, filename, mimeType, tempDir, tempPath, size };
  } catch (error) {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof UploadParseError) throw error;
    throw new UploadParseError("INVALID_MULTIPART");
  }
}

function requestOrigin(req: NextRequest) {
  const configured = process.env.DASH_PUBLIC_ORIGIN?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  // In production the public origin must be explicit. Trusting forwarded host
  // headers without a controlled proxy configuration weakens the CSRF boundary.
  if (process.env.NODE_ENV !== "development") return null;
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || req.headers.get("host");
  if (!host) return null;
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const proto = forwardedProto || (req.nextUrl.protocol.replace(":", "") || "http");
  return `${proto}://${host}`;
}

/** multipart 也必须来自本站，避免 admin cookie 被跨站表单利用。 */
function passesCsrfCheck(req: NextRequest) {
  if (AUTH_DISABLED) return true;
  const expected = requestOrigin(req);
  if (!expected) return false;
  const supplied = req.headers.get("origin") || req.headers.get("referer");
  if (!supplied) return false;
  try {
    return new URL(supplied).origin === expected;
  } catch {
    return false;
  }
}

function hasMagic(ext: string, bytes: Uint8Array) {
  if (ext === "png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (ext === "jpg" || ext === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === "gif") {
    const signature = new TextDecoder().decode(bytes.slice(0, 6));
    return bytes.length >= 6 && (signature === "GIF89a" || signature === "GIF87a");
  }
  if (ext === "webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (ext === "pdf") return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (["zip", "pptx", "docx", "xlsx"].includes(ext)) return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (["ppt", "doc", "xls"].includes(ext)) return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1][index]);
  if (ext === "mp4") return bytes.length >= 8 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  if (ext === "webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (ext === "mp3") return bytes.length >= 3 && (new TextDecoder().decode(bytes.slice(0, 3)) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  return true;
}

async function validateUpload(input: { size: number; mimeType: string; tempPath: string }, filename: string, ext: string) {
  if (input.size <= 0) return "EMPTY_FILE";
  if (input.size > MAX_UPLOAD_BYTES) return "TOO_LARGE";
  if (!MIME_BY_EXT[ext]) return "UNSUPPORTED_TYPE";
  if (input.mimeType && !MIME_BY_EXT[ext].includes(input.mimeType.toLowerCase())) return "MIME_MISMATCH";
  const handle = await fsp.open(input.tempPath, "r");
  const bytes = Buffer.alloc(16);
  let bytesRead = 0;
  try {
    const read = await handle.read(bytes, 0, bytes.length, 0);
    bytesRead = read.bytesRead;
  } finally {
    await handle.close();
  }
  if (!hasMagic(ext, bytes.subarray(0, bytesRead))) return "MAGIC_MISMATCH";
  if (filename.length > 180) return "FILENAME_TOO_LONG";
  return null;
}

/**
 * 资源上传：POST multipart/form-data { file, title, title_en, category, print_advice?, overwrite? }。
 * 文件先写入同目录临时文件，再原子替换；数据库失败会回滚替换。
 */
export async function POST(req: NextRequest) {
  if (!passesCsrfCheck(req)) return NextResponse.json({ error: "CSRF" }, { status: 403 });
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length"));
  // multipart overhead 留出 1 MiB；没有 Content-Length 时由 busboy + storage stream 限制。
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
  }

  let upload: ParsedUpload;
  try {
    upload = await parseMultipart(req);
  } catch (error) {
    if (error instanceof UploadParseError && error.code === "TOO_LARGE") {
      return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    }
    return NextResponse.json({ error: "INVALID_MULTIPART" }, { status: 400 });
  }
  try {
    const title = String(upload.fields.title || "").trim();
    const titleEn = String(upload.fields.title_en || "").trim();
    const categoryInput = String(upload.fields.category || "").trim();
    const printAdvice = String(upload.fields.print_advice || "").trim();
    const overwrite = upload.fields.overwrite === "1";

    if (!title || title.length > 200) return NextResponse.json({ error: "INVALID_TITLE" }, { status: 400 });
    if (!titleEn || titleEn.length > 200) return NextResponse.json({ error: "INVALID_TITLE_EN" }, { status: 400 });
    if (printAdvice.length > 1000) return NextResponse.json({ error: "INVALID_ADVICE" }, { status: 400 });
    const category = resolveResourceCategory(categoryInput);
    if (!category || !RESOURCE_CATS_STORE.includes(category.label)) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
    const categoryEn = RESOURCE_CATEGORY_EN[category.label] || category.label;

    // basename 后再清理控制字符和危险符号；拒绝点文件和无扩展名上传。
    const original = path.basename(upload.filename.replaceAll("\\", "/")).normalize("NFC");
    const filename = original.replace(/[\/:*?"<>|#%\x00-\x1f]/g, "").trim();
    if (!filename || filename === "." || filename === "..") return NextResponse.json({ error: "INVALID_FILENAME" }, { status: 400 });
    const dot = filename.lastIndexOf(".");
    const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
    const validationError = await validateUpload({ size: upload.size, mimeType: upload.mimeType, tempPath: upload.tempPath }, filename, ext);
    if (validationError) return NextResponse.json({ error: validationError }, { status: validationError === "TOO_LARGE" ? 413 : 415 });

    const fileKey = `files/${category.label}/${filename}`;
    const db = getDb();
    const existing = getResourceByFileKey(fileKey);
    if (existing && !overwrite) return NextResponse.json({ error: "EXISTS" }, { status: 409 });

    const storage = getStorage();
    let stored: StoredObject;
    try {
      stored = await storage.putObject({
        objectKey: fileKey,
        body: fs.createReadStream(/*turbopackIgnore: true*/ upload.tempPath),
        expectedBytes: upload.size,
        maxBytes: MAX_UPLOAD_BYTES,
        overwrite,
      });
    } catch (error) {
      return responseForStorageError(error);
    }

    try {
      const extLabel = ext ? ext.toUpperCase() : null;
      const preview = IMAGE_EXTS.has(ext) ? `/${fileKey}` : null;
      const result = db.transaction(() => {
        if (existing) {
          db.prepare(
            `UPDATE resources
             SET title = ?, title_en = ?, category = ?, category_en = ?, category_key = ?, kind = 'file', format = ?, size = ?,
                 print_advice = ?, file_key = ?, preview = ?, enabled = 1, updated_at = datetime('now')
             WHERE id = ?`
          ).run(title, titleEn, category.label, categoryEn, category.key, extLabel, stored.bytes, printAdvice || null, fileKey, preview, existing.id);
          return existing.id;
        }
        const maxSort = (db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM resources").get() as { m: number }).m;
        const info = db
          .prepare(
            `INSERT INTO resources (title, title_en, category, category_en, category_key, kind, format, size, dimensions, print_advice, file_key, preview, sort)
             VALUES (?, ?, ?, ?, ?, 'file', ?, ?, NULL, ?, ?, ?, ?)`
          )
          .run(title, titleEn, category.label, categoryEn, category.key, extLabel, stored.bytes, printAdvice || null, fileKey, preview, maxSort + 10);
        return Number(info.lastInsertRowid);
      })();
      try {
        if (storage.commitObject) await storage.commitObject(stored);
      } catch (commitError) {
        const compensationErrors: unknown[] = [];
        try {
          await storage.rollbackObject?.(stored);
        } catch (rollbackError) {
          compensationErrors.push(rollbackError);
        }
        try {
          db.transaction(() => {
            if (existing) {
              db.prepare(
                `UPDATE resources
                 SET title = ?, title_en = ?, category = ?, category_en = ?, category_key = ?, kind = ?, format = ?, size = ?,
                     dimensions = ?, print_advice = ?, file_key = ?, preview = ?, sort = ?,
                     enabled = ?, updated_at = ?
                 WHERE id = ?`
              ).run(
                existing.title,
                existing.title_en,
                existing.category,
                existing.category_en,
                existing.category_key,
                existing.kind,
                existing.format,
                existing.size,
                existing.dimensions,
                existing.print_advice,
                existing.file_key,
                existing.preview,
                existing.sort,
                existing.enabled,
                existing.updated_at,
                existing.id
              );
            } else {
              db.prepare("DELETE FROM resources WHERE id = ?").run(result);
            }
          })();
        } catch (metadataError) {
          compensationErrors.push(metadataError);
        }
        console.error("storage commit failed; compensation attempted", {
          fileKey,
          error: commitError,
          compensationErrors,
        });
        return NextResponse.json({ error: "STORAGE_COMMIT_FAILED" }, { status: 503 });
      }
      return NextResponse.json({ ok: true, id: result });
    } catch {
      const rollback = storage.rollbackObject?.(stored);
      if (rollback) {
        await rollback.catch((rollbackError) => {
          console.error("storage rollback failed after database write error", { fileKey, error: rollbackError });
        });
      }
      return NextResponse.json({ error: "DB_WRITE_FAILED" }, { status: 500 });
    }
  } finally {
    await fsp.rm(upload.tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
