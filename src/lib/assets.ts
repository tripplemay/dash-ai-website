import { CORECOORD_ASSET_ROOT, CORECOORD_LOGO } from "@/lib/brand";

/**
 * Encode public asset URLs before rendering them in HTML.
 *
 * Some maintained asset filenames contain CJK characters. React's
 * server renderer may promote early images into the HTTP Link preload header,
 * which only accepts ASCII header values. URI-encoding the path keeps the
 * public filename unchanged while making both HTML and preload headers valid.
 */
export function assetUrl(path: string): string {
  return encodeURI(path);
}

/**
 * Validate a database-backed object key before it is rendered as a direct
 * public URL. API/storage paths perform the same validation independently;
 * this pure helper keeps client components free of Node filesystem code.
 */
export function isSafeObjectKey(value: string): boolean {
  const raw = value.trim().replace(/^\/+|\/+$/g, "");
  if (!raw || raw.length > 1024 || raw.includes("\\") || /[\0\r\n]/.test(raw)) return false;
  const segments = raw.split("/");
  return (
    segments.length >= 2 &&
    segments[0] === "files" &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !/[\0\r\n%?#]/.test(segment) &&
        !/%2f|%5c|%2e/i.test(segment)
    )
  );
}

/** Only allow the current same-origin CORECOORD preview root. */
export function resourcePreviewUrl(
  preview: string | null | undefined,
  fallback = "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-presentation-cover-16x9.png"
) {
  const candidate = preview?.trim();
  if (candidate?.startsWith(`${CORECOORD_ASSET_ROOT}/`)) {
    if (candidate === `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-logo-horizontal-color.svg`) {
      return assetUrl(CORECOORD_LOGO.horizontal);
    }
    const segments = candidate.slice(1).split("/");
    if (
      segments.length >= 2 &&
      segments.every(
        (segment) =>
          segment.length > 0 &&
          segment !== "." &&
          segment !== ".." &&
          !/[\0\r\n%?#]/.test(segment) &&
          !/%2e|%2f|%5c/i.test(segment)
      )
    ) {
      return assetUrl(candidate);
    }
  }
  if (candidate?.startsWith("/files/") && isSafeObjectKey(candidate.slice(1))) return resourceFileUrl(candidate.slice(1)) || assetUrl(fallback);
  return assetUrl(fallback);
}

export function resourceFileUrl(fileKey: string): string | null {
  if (!isSafeObjectKey(fileKey)) return null;
  const key = fileKey.replace(/^\/+/, "");
  return `/api/file/${key.split("/").map(encodeURIComponent).join("/")}`;
}
