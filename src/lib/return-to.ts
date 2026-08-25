const RETURN_TO_ORIGIN = "http://dash-ai.invalid";

/** Internal request header used to carry the original URL through layouts. */
export const RETURN_TO_HEADER = "x-dash-return-to";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Accept only a same-locale, path-relative destination. The returned value is
 * canonicalized by URL parsing and retains the query string and hash.
 */
export function getSafeReturnTo(
  value: string | null | undefined,
  locale: string
): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, RETURN_TO_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== RETURN_TO_ORIGIN) return null;

  // Reject encoded separators/dot segments that could be interpreted
  // differently by a downstream proxy or filesystem.
  if (/%(?:2e|2f|5c)/i.test(url.pathname)) return null;

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (
    /[\u0000-\u001f\u007f]/.test(decodedPathname) ||
    decodedPathname.includes("\\") ||
    decodedPathname.includes("//") ||
    decodedPathname.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  const localePrefix = new RegExp(`^/${escapeRegExp(locale)}(?:/|$)`);
  const isLocalizedPath = localePrefix.test(decodedPathname);
  if (!isLocalizedPath) return null;

  const loginPath = `/${locale}/login`;
  if (isLocalizedPath && (decodedPathname === loginPath || decodedPathname.startsWith(`${loginPath}/`))) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
