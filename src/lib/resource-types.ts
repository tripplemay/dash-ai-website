export type ResourcePreviewKind = "image" | "svg" | "pdf" | "audio" | "video" | "text" | "download";

export const MIME_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  gif: "image/gif",
  ico: "image/x-icon",
  html: "text/html; charset=utf-8",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  webm: "video/webm",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml; charset=utf-8",
  zip: "application/zip",
};

const PREVIEW_KINDS: Record<string, ResourcePreviewKind> = {
  css: "text",
  csv: "text",
  gif: "image",
  ico: "image",
  jpeg: "image",
  jpg: "image",
  js: "text",
  json: "text",
  md: "text",
  mp3: "audio",
  mp4: "video",
  pdf: "pdf",
  png: "image",
  svg: "svg",
  txt: "text",
  webm: "video",
  webp: "image",
  xml: "text",
};

export function extensionFor(fileKey: string) {
  const name = fileKey.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function mimeTypeForResource(fileKey: string) {
  return MIME_TYPES[extensionFor(fileKey)] || "application/octet-stream";
}

export function previewKindForResource(fileKey: string): ResourcePreviewKind {
  return PREVIEW_KINDS[extensionFor(fileKey)] || "download";
}

export function formatResourceBytes(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
