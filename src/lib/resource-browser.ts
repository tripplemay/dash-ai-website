import fsp from "node:fs/promises";
import path from "node:path";
import { getResource } from "@/lib/db";
import { resourceFileUrl } from "@/lib/assets";
import { getStorage, StorageError } from "@/lib/storage";
import { mimeTypeForResource, previewKindForResource, type ResourcePreviewKind } from "@/lib/resource-types";

export type { ResourcePreviewKind } from "@/lib/resource-types";

export interface ResourceEntry {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  bytes: number | null;
  mimeType: string | null;
  previewKind: ResourcePreviewKind | null;
  previewUrl: string | null;
  downloadUrl: string | null;
}

export interface ResourceDirectoryListing {
  resourceId: number;
  path: string;
  parentPath: string | null;
  entries: ResourceEntry[];
}

export class ResourceBrowserError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_PATH" | "NOT_FOUND" | "UNAVAILABLE" | "TOO_LARGE"
  ) {
    super(message);
    this.name = "ResourceBrowserError";
  }
}

function boundedPositiveEnv(name: string, fallback: number, maximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, Math.floor(parsed)) : fallback;
}

export const RESOURCE_DIRECTORY_MAX_ENTRIES = boundedPositiveEnv("DASH_RESOURCE_MAX_ENTRIES", 1000, 5000);
export const RESOURCE_DIRECTORY_MAX_SCANNED_ENTRIES = boundedPositiveEnv("DASH_RESOURCE_MAX_SCANNED_ENTRIES", 10000, 20000);

function normalizeRelativePath(value: string | undefined) {
  const raw = (value || "").trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!raw) return "";
  const segments = raw.split("/");
  if (
    raw.length > 1024 ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || /[\0\r\n?#]/.test(segment))
  ) {
    throw new ResourceBrowserError("invalid resource directory path", "INVALID_PATH");
  }
  return segments.join("/");
}

function rootKeyForResource(fileKey: string) {
  return fileKey.replace(/^\/+|\/+$/g, "");
}

function keyForRelativePath(rootKey: string, relativePath: string) {
  return relativePath ? `${rootKey}/${relativePath}` : rootKey;
}

export { mimeTypeForResource, previewKindForResource } from "@/lib/resource-types";

export function describeResourceFile(fileKey: string, name = path.basename(fileKey)): ResourceEntry {
  const mimeType = mimeTypeForResource(fileKey);
  const previewKind = previewKindForResource(fileKey);
  return {
    name,
    relativePath: name,
    kind: "file",
    bytes: null,
    mimeType,
    previewKind,
    previewUrl: previewKind === "download" ? null : resourceFileUrl(fileKey, "preview"),
    downloadUrl: resourceFileUrl(fileKey, "download"),
  };
}

function entryForFile(rootKey: string, relativePath: string, bytes: number): ResourceEntry {
  const fileKey = keyForRelativePath(rootKey, relativePath);
  const descriptor = describeResourceFile(fileKey, path.basename(relativePath));
  return { ...descriptor, relativePath, bytes };
}

function entryForDirectory(relativePath: string): ResourceEntry {
  return {
    name: path.basename(relativePath),
    relativePath,
    kind: "directory",
    bytes: null,
    mimeType: null,
    previewKind: null,
    previewUrl: null,
    downloadUrl: null,
  };
}

export async function listResourceDirectory(
  resourceId: number,
  requestedPath = ""
): Promise<ResourceDirectoryListing> {
  const resource = getResource(resourceId);
  if (!resource || !resource.enabled || resource.kind !== "folder") {
    throw new ResourceBrowserError("resource folder not found", "NOT_FOUND");
  }

  const relativePath = normalizeRelativePath(requestedPath);
  const rootKey = rootKeyForResource(resource.file_key);
  const objectKey = keyForRelativePath(rootKey, relativePath);
  const storage = getStorage();
  if (!storage.getLocalPath) throw new ResourceBrowserError("directory listing is unavailable", "UNAVAILABLE");

  let absolute: string;
  try {
    absolute = await storage.getLocalPath(objectKey, { mustExist: true, directory: true });
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new ResourceBrowserError("resource folder is unavailable", "NOT_FOUND");
    }
    if (error instanceof StorageError && error.code === "FORBIDDEN") {
      throw new ResourceBrowserError("resource folder is unavailable", "UNAVAILABLE");
    }
    throw new ResourceBrowserError("resource folder is unavailable", "UNAVAILABLE");
  }

  const entries: ResourceEntry[] = [];
  let scannedEntries = 0;
  try {
    const directory = await fsp.opendir(absolute);
    for await (const entry of directory) {
      scannedEntries += 1;
      if (scannedEntries > RESOURCE_DIRECTORY_MAX_SCANNED_ENTRIES) {
        throw new ResourceBrowserError("resource directory exceeds scan limit", "TOO_LARGE");
      }
      if (entry.name.startsWith(".")) continue;
      if (entries.length >= RESOURCE_DIRECTORY_MAX_ENTRIES) {
        throw new ResourceBrowserError("resource directory exceeds entry limit", "TOO_LARGE");
      }
      if (Buffer.byteLength(entry.name, "utf8") > 512) continue;
      const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const child = path.join(absolute, entry.name);
      const stat = await fsp.lstat(child);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) entries.push(entryForDirectory(childRelativePath));
      else if (stat.isFile()) entries.push(entryForFile(rootKey, childRelativePath, stat.size));
    }
  } catch (error) {
    if (error instanceof ResourceBrowserError) throw error;
    throw new ResourceBrowserError("resource directory is unavailable", "UNAVAILABLE");
  }

  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  const parentPath = relativePath ? path.posix.dirname(relativePath).replace(/^\.$/, "") || null : null;
  return { resourceId, path: relativePath, parentPath, entries };
}
