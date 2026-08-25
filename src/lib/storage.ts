import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import fsp from "node:fs/promises";
import path from "node:path";
import { isSafeObjectKey } from "./assets";

/**
 * 存储抽象层。所有方法都是 async，应用层不依赖本地路径；当前只实现 local
 * 驱动，未来可将同一契约替换为 S3/OSS/COS。local 驱动额外提供 getLocalPath
 * 给 ZIP/资源目录浏览这类必须在应用进程读取目录的功能。
 */
export interface PutObjectInput {
  objectKey: string;
  body: AsyncIterable<Uint8Array> | NodeJS.ReadableStream;
  expectedBytes?: number;
  maxBytes?: number;
  overwrite?: boolean;
}

export interface StoredObject {
  objectKey: string;
  bytes: number;
  checksum: string;
  /** local 驱动用于失败回滚；外部驱动可以不提供。 */
  rollbackToken?: string;
  /** local 驱动持有到 DB commit/rollback 的进程内对象锁。 */
  releaseLock?: () => void;
}

export interface ReadObject {
  body: Readable;
  bytes: number;
}

export interface StorageDriver {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  commitObject?(stored: StoredObject): Promise<void>;
  rollbackObject?(stored: StoredObject): Promise<void>;
  getReadUrl(input: { objectKey: string }): Promise<string>;
  /** Stream a protected object; external drivers can implement this without exposing local paths. */
  getObject?(objectKey: string): Promise<ReadObject>;
  deleteObject(objectKey: string): Promise<void>;
  getDerivative(objectKey: string, preset: string): Promise<string | null>;
  /** 仅 local 驱动实现；调用方必须先确认驱动支持此能力。 */
  getLocalPath?(objectKey: string, options?: { mustExist?: boolean; directory?: boolean }): Promise<string>;
  // 旧调用名保留为兼容别名；新代码应使用 getReadUrl。
  resolveFileUrl(fileKey: string): Promise<string>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_KEY" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "TOO_LARGE" | "IO_ERROR"
  ) {
    super(message);
    this.name = "StorageError";
  }
}

const PUBLIC_ROOT = path.resolve(process.cwd(), "public");
const LOCAL_OBJECT_ROOT = path.resolve(PUBLIC_ROOT, "files");
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isWithin(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function cleanupParentArtifacts(parent: string) {
  const cutoff = Date.now() - ORPHAN_MAX_AGE_MS;
  const entries = await fsp.readdir(parent, { withFileTypes: true }).catch(() => [] as fs.Dirent[]);
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^\..+\.(?:backup|upload)-/.test(entry.name))
      .map(async (entry) => {
        const candidate = path.join(parent, entry.name);
        const stat = await fsp.stat(candidate).catch(() => undefined);
        if (stat && stat.mtimeMs < cutoff) await fsp.rm(candidate, { force: true }).catch(() => undefined);
      })
  );
}

/** 只接受 public/files 下的相对 object key，拒绝编码/平台路径绕过。 */
export function normalizeObjectKey(value: string) {
  const raw = value.trim().replace(/^\/+|\/+$/g, "");
  if (!raw || raw.length > 1024 || raw.includes("\\") || /[\0\r\n]/.test(raw)) {
    throw new StorageError("invalid object key", "INVALID_KEY");
  }
  const segments = raw.split("/");
  // Keep the error distinction for encoded separators before the shared
  // public-path predicate classifies the key as outside the storage root.
  if (segments.some((segment) => /[%?#]/.test(segment) || /%2f|%5c|%2e/i.test(segment))) {
    throw new StorageError("encoded path separator", "INVALID_KEY");
  }
  if (!isSafeObjectKey(raw)) {
    throw new StorageError("object key outside storage root", "FORBIDDEN");
  }
  return segments.join("/");
}

async function assertNoSymlink(root: string, relative: string, allowMissingFinal: boolean) {
  const segments = relative.split("/");
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    try {
      const stat = await fsp.lstat(current);
      if (stat.isSymbolicLink()) throw new StorageError("symbolic links are not allowed", "FORBIDDEN");
      if (index < segments.length - 1 && !stat.isDirectory()) {
        throw new StorageError("object parent is not a directory", "FORBIDDEN");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && allowMissingFinal && index === segments.length - 1) return;
      if (error instanceof StorageError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("object not found", "NOT_FOUND");
      throw new StorageError("storage lookup failed", "IO_ERROR");
    }
  }
}

/** 返回经过 lexical + realpath + symlink 检查的本地路径。 */
export async function resolveLocalObjectPath(objectKey: string, options: { mustExist?: boolean; directory?: boolean } = {}) {
  const key = normalizeObjectKey(objectKey);
  const root = await fsp.realpath(LOCAL_OBJECT_ROOT).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new StorageError("storage root not found", "NOT_FOUND");
    throw new StorageError("storage root unavailable", "IO_ERROR");
  });
  const absolute = path.resolve(root, key.slice("files/".length));
  if (!isWithin(root, absolute)) throw new StorageError("object outside storage root", "FORBIDDEN");
  await assertNoSymlink(root, key.slice("files/".length), !(options.mustExist ?? true));
  if (options.mustExist ?? true) {
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("object not found", "NOT_FOUND");
      throw new StorageError("storage lookup failed", "IO_ERROR");
    }
    if (options.directory !== undefined && stat.isDirectory() !== options.directory) {
      throw new StorageError("object type mismatch", "NOT_FOUND");
    }
    if (!stat.isFile() && !stat.isDirectory()) throw new StorageError("unsupported object type", "FORBIDDEN");
  }
  return absolute;
}

function localUrlForKey(objectKey: string) {
  const key = normalizeObjectKey(objectKey);
  return `/api/file/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function streamToTemp(input: PutObjectInput, tempPath: string) {
  const maxBytes = Math.min(
    Number.isFinite(input.maxBytes) && (input.maxBytes as number) > 0 ? (input.maxBytes as number) : DEFAULT_MAX_BYTES,
    DEFAULT_MAX_BYTES
  );
  const hash = createHash("sha256");
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        callback(new StorageError("upload exceeds size limit", "TOO_LARGE"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    const source = Symbol.asyncIterator in Object(input.body)
      ? Readable.from(input.body as AsyncIterable<Uint8Array>)
      : (input.body as NodeJS.ReadableStream);
    await pipeline(source, limiter, fs.createWriteStream(/*turbopackIgnore: true*/ tempPath, { flags: "wx", mode: 0o600 }));
    if (input.expectedBytes !== undefined && input.expectedBytes !== bytes) {
      throw new StorageError("uploaded size does not match declared size", "IO_ERROR");
    }
    return { bytes, checksum: hash.digest("hex") };
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    throw error instanceof StorageError ? error : new StorageError("upload write failed", "IO_ERROR");
  }
}

const objectLocks = new Map<string, Promise<void>>();

async function acquireObjectLock(key: string): Promise<() => void> {
  const previous = objectLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  objectLocks.set(key, current);
  await previous;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
    if (objectLocks.get(key) === current) objectLocks.delete(key);
  };
}

async function putLocalObject(input: PutObjectInput) {
    const key = normalizeObjectKey(input.objectKey);
    await fsp.mkdir(LOCAL_OBJECT_ROOT, { recursive: true });
    const root = await fsp.realpath(LOCAL_OBJECT_ROOT);
    const destination = path.resolve(root, key.slice("files/".length));
    if (!isWithin(root, destination)) throw new StorageError("object outside storage root", "FORBIDDEN");
    const parent = path.dirname(destination);
    await fsp.mkdir(parent, { recursive: true });
    // A process crash can leave a hidden backup/temp file. Clean stale files
    // in the touched category before allocating another replacement.
    await cleanupParentArtifacts(parent);
    // Re-check every parent after mkdir so a symlink inserted concurrently cannot escape.
    await assertNoSymlink(root, key.slice("files/".length), true);
    const existing = await fsp.lstat(destination).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw new StorageError("storage lookup failed", "IO_ERROR");
    });
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) {
      throw new StorageError("destination is not a regular file", "FORBIDDEN");
    }
    if (existing && !input.overwrite) throw new StorageError("object already exists", "CONFLICT");

    const token = path.join(parent, `.${path.basename(destination)}.backup-${process.pid}-${randomBytes(8).toString("hex")}`);
    const temp = path.join(parent, `.${path.basename(destination)}.upload-${process.pid}-${randomBytes(8).toString("hex")}`);
    const result = await streamToTemp(input, temp);
    let hasBackup = false;
    try {
      if (existing) {
        await fsp.rename(destination, token);
        hasBackup = true;
      }
      await fsp.rename(temp, destination);
      await fsp.chmod(destination, 0o644);
      return {
        objectKey: key,
        bytes: result.bytes,
        checksum: result.checksum,
        rollbackToken: hasBackup ? token : undefined,
      };
    } catch (error) {
      await fsp.rm(temp, { force: true }).catch(() => undefined);
      if (hasBackup) await fsp.rename(token, destination).catch(() => undefined);
      throw error instanceof StorageError ? error : new StorageError("atomic replace failed", "IO_ERROR");
    }
}

const localDriver: StorageDriver = {
  async putObject(input) {
    const key = normalizeObjectKey(input.objectKey);
    const releaseLock = await acquireObjectLock(key);
    try {
      const stored = await putLocalObject(input);
      return { ...stored, releaseLock };
    } catch (error) {
      releaseLock();
      throw error;
    }
  },

  async commitObject(stored) {
    if (stored.rollbackToken) await fsp.rm(stored.rollbackToken, { force: true });
    stored.releaseLock?.();
  },

  async rollbackObject(stored) {
    try {
      const destination = await resolveLocalObjectPath(stored.objectKey, { mustExist: false });
      await fsp.rm(destination, { force: true });
      if (stored.rollbackToken) await fsp.rename(stored.rollbackToken, destination).catch(() => undefined);
    } finally {
      stored.releaseLock?.();
    }
  },

  async getReadUrl({ objectKey }) {
    await resolveLocalObjectPath(objectKey, { mustExist: true, directory: false });
    return localUrlForKey(objectKey);
  },

  async getObject(objectKey) {
    const absolute = await resolveLocalObjectPath(objectKey, { mustExist: true, directory: false });
    const stat = await fsp.stat(absolute);
    return { body: fs.createReadStream(/*turbopackIgnore: true*/ absolute), bytes: stat.size };
  },

  async deleteObject(objectKey) {
    const absolute = await resolveLocalObjectPath(objectKey, { mustExist: true, directory: false });
    await fsp.unlink(absolute);
  },

  async getDerivative() {
    return null;
  },

  async getLocalPath(objectKey, options) {
    return resolveLocalObjectPath(objectKey, options);
  },

  async resolveFileUrl(fileKey) {
    return this.getReadUrl({ objectKey: fileKey });
  },

};

export function getStorage(): StorageDriver {
  return localDriver;
}

/** 旧的同步 URL helper；返回经过会话校验的应用文件端点。 */
export function resolvePublicUrl(fileKey: string): string {
  return localUrlForKey(fileKey);
}
