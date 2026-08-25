import { PassThrough, Readable } from "node:stream";
import fsp from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { ResourceRow } from "@/lib/db";
import { RESOURCE_ZIP_LIMIT } from "@/lib/db";
import { getStorage, StorageError } from "@/lib/storage";

function boundedPositiveEnv(name: string, fallback: number, maximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, Math.floor(parsed)) : fallback;
}

const MAX_ZIP_BYTES = boundedPositiveEnv("DASH_ZIP_MAX_BYTES", 512 * 1024 * 1024, 512 * 1024 * 1024);
const MAX_ZIP_FILES = boundedPositiveEnv("DASH_ZIP_MAX_FILES", RESOURCE_ZIP_LIMIT, 5000);
const MAX_ZIP_DIRECTORIES = boundedPositiveEnv("DASH_ZIP_MAX_DIRECTORIES", RESOURCE_ZIP_LIMIT, 5000);
const MAX_ZIP_DEPTH = boundedPositiveEnv("DASH_ZIP_MAX_DEPTH", 12, 32);
const MAX_ZIP_SCANNED_ENTRIES = boundedPositiveEnv("DASH_ZIP_MAX_SCANNED_ENTRIES", 10000, 20000);
const MAX_ZIP_CONCURRENT = boundedPositiveEnv("DASH_ZIP_MAX_CONCURRENT", 2, 8);

let activeZipJobs = 0;

function acquireZipSlot() {
  if (activeZipJobs >= MAX_ZIP_CONCURRENT) return null;
  activeZipJobs += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeZipJobs = Math.max(0, activeZipJobs - 1);
  };
}

type ZipEntry = { absolute: string; name: string; bytes: number };

async function collectDirectory(
  absolute: string,
  archiveName: string,
  entries: ZipEntry[],
  state: { bytes: number; directories: number; scanned: number },
  depth = 0
) {
  if (depth > MAX_ZIP_DEPTH || state.directories >= MAX_ZIP_DIRECTORIES) {
    throw new StorageError("archive directory limit exceeded", "TOO_LARGE");
  }
  state.directories += 1;
  const directory = await fsp.opendir(absolute);
  const dirents = [] as Array<import("node:fs").Dirent>;
  for await (const entry of directory) {
    state.scanned += 1;
    if (state.scanned > MAX_ZIP_SCANNED_ENTRIES) {
      throw new StorageError("archive directory entry limit exceeded", "TOO_LARGE");
    }
    dirents.push(entry);
  }
  for (const entry of dirents.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
    if (entry.name.startsWith(".")) continue;
    const child = path.join(absolute, entry.name);
    const stat = await fsp.lstat(child);
    if (stat.isSymbolicLink()) throw new StorageError("symbolic links are not allowed", "FORBIDDEN");
    if (stat.isDirectory()) {
      await collectDirectory(child, `${archiveName}/${entry.name}`, entries, state, depth + 1);
      continue;
    }
    if (!stat.isFile()) continue;
    if (entries.length >= MAX_ZIP_FILES || state.bytes + stat.size > MAX_ZIP_BYTES) {
      throw new StorageError("archive exceeds limit", "TOO_LARGE");
    }
    state.bytes += stat.size;
    entries.push({ absolute: child, name: `${archiveName}/${entry.name}`, bytes: stat.size });
  }
}

function uniqueName(name: string, id: number, used: Set<string>) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const ext = path.extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  let candidate = `${stem}-${id}${ext}`;
  let index = 2;
  while (used.has(candidate)) candidate = `${stem}-${id}-${index++}${ext}`;
  used.add(candidate);
  return candidate;
}

export interface ResourceArchiveOptions {
  rows: ResourceRow[];
  filename: string;
  signal?: AbortSignal;
}

/** Stream a bounded archive for one or more enabled resource rows. */
export async function createResourceArchiveResponse({ rows, filename, signal }: ResourceArchiveOptions): Promise<Response> {
  const storage = getStorage();
  if (!storage.getLocalPath) throw new StorageError("archive unsupported", "FORBIDDEN");
  const releaseSlot = acquireZipSlot();
  if (!releaseSlot) throw new StorageError("archive busy", "CONFLICT");

  let handedOff = false;
  try {
    const entries: ZipEntry[] = [];
    const used = new Set<string>();
    const state = { bytes: 0, directories: 0, scanned: 0 };
    for (const row of rows) {
      try {
        if (row.kind === "folder") {
          const absolute = await storage.getLocalPath(row.file_key, { mustExist: true, directory: true });
          await collectDirectory(absolute, uniqueName(path.basename(absolute), row.id, used), entries, state);
        } else {
          const absolute = await storage.getLocalPath(row.file_key, { mustExist: true, directory: false });
          const stat = await fsp.stat(absolute);
          if (entries.length >= MAX_ZIP_FILES || state.bytes + stat.size > MAX_ZIP_BYTES) {
            throw new StorageError("archive exceeds limit", "TOO_LARGE");
          }
          state.bytes += stat.size;
          state.scanned += 1;
          if (state.scanned > MAX_ZIP_SCANNED_ENTRIES) {
            throw new StorageError("archive directory entry limit exceeded", "TOO_LARGE");
          }
          entries.push({ absolute, name: uniqueName(path.basename(absolute), row.id, used), bytes: stat.size });
        }
      } catch (error) {
        if (error instanceof StorageError && error.code === "NOT_FOUND") continue;
        throw error instanceof StorageError ? error : new StorageError("storage unavailable", "IO_ERROR");
      }
    }
    if (entries.length === 0) throw new StorageError("no files", "NOT_FOUND");

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const pass = new PassThrough();
    const releaseStream = () => releaseSlot();
    archive.on("error", () => {
      releaseStream();
      pass.destroy();
    });
    pass.once("close", releaseStream);
    pass.once("end", releaseStream);
    archive.pipe(pass);
    signal?.addEventListener("abort", () => {
      releaseStream();
      archive.abort();
    }, { once: true });
    for (const entry of entries) archive.file(entry.absolute, { name: entry.name });
    archive.finalize().catch(() => pass.destroy());

    handedOff = true;
    return new Response(Readable.toWeb(pass) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } finally {
    if (!handedOff) releaseSlot();
  }
}
