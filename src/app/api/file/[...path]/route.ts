import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { Readable } from "node:stream";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getResourceByFileKey, listEnabledFolderResources, RESOURCE_ZIP_LIMIT } from "@/lib/db";
import { getStorage, StorageError } from "@/lib/storage";
import type { ReadObject } from "@/lib/storage";
import { mimeTypeForResource, previewKindForResource } from "@/lib/resource-types";

export const runtime = "nodejs";

function decodeSegment(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) return null;
    if (/[%?#]/.test(decoded) || /%2f|%5c|%2e/i.test(decoded) || /[\0\r\n]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isAllowedResourceFile(key: string) {
  const direct = getResourceByFileKey(key);
  if (direct?.enabled && direct.kind === "file") return true;
  return listEnabledFolderResources(RESOURCE_ZIP_LIMIT)
    .map((row) => row.file_key.replace(/^\/+|\/+$/g, ""))
    .some((root) => key.startsWith(`${root}/`));
}

const TEXT_PREVIEW_MAX_BYTES = Number.isFinite(Number(process.env.DASH_TEXT_PREVIEW_MAX_BYTES))
  ? Math.min(Math.max(1, Number(process.env.DASH_TEXT_PREVIEW_MAX_BYTES)), 4 * 1024 * 1024)
  : 1024 * 1024;

function isInlineType(type: string) {
  return type.startsWith("image/") || type.startsWith("audio/") || type.startsWith("video/") || type === "application/pdf" || type.startsWith("text/") || type === "application/json" || type === "application/xml";
}

/**
 * Authenticated file stream. Public files are kept on the existing volume for
 * compatibility, but every application-generated file URL terminates here so
 * enabled state and the real Better Auth session are checked on each request.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = (await params).path;
  const decoded = raw.map(decodeSegment);
  if (decoded.some((segment) => segment === null)) return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
  const key = (decoded as string[]).join("/");
  if (!key.startsWith("files/") || key.length <= "files/".length) {
    return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
  }

  let allowed = false;
  try {
    allowed = isAllowedResourceFile(key);
  } catch {
    return NextResponse.json({ error: "DATABASE_UNAVAILABLE" }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const requestedMode = req.nextUrl.searchParams.get("mode");
  if (requestedMode && requestedMode !== "preview" && requestedMode !== "download") {
    return NextResponse.json({ error: "INVALID_MODE" }, { status: 400 });
  }
  const mode = requestedMode as "preview" | "download" | null;
  const previewKind = previewKindForResource(key);
  if (mode === "preview" && previewKind === "download") {
    return NextResponse.json({ error: "PREVIEW_UNSUPPORTED" }, { status: 415 });
  }

  const storage = getStorage();
  if (!storage.getObject) return NextResponse.json({ error: "FILE_STREAM_UNSUPPORTED" }, { status: 501 });
  let object: ReadObject;
  try {
    object = await storage.getObject(key);
  } catch (error) {
    if (error instanceof StorageError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: "STORAGE_UNAVAILABLE" }, { status: 503 });
  }

  if (mode === "preview" && previewKind === "text" && object.bytes > TEXT_PREVIEW_MAX_BYTES) {
    object.body.destroy();
    return NextResponse.json({ error: "PREVIEW_TOO_LARGE" }, { status: 413 });
  }

  const encodedName = encodeURIComponent(path.basename(key));
  const type = mimeTypeForResource(key);
  const disposition = mode === "download" ? "attachment" : mode === "preview" ? "inline" : isInlineType(type) ? "inline" : "attachment";
  const contentSecurityPolicy = previewKind === "svg" && mode === "preview"
    ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
    : "sandbox";
  const stream = object.body;
  req.signal.addEventListener("abort", () => stream.destroy(), { once: true });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(object.bytes),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": contentSecurityPolicy,
    },
  });
}
