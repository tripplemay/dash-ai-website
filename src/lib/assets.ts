/**
 * Encode public asset URLs before rendering them in HTML.
 *
 * Some of the maintained marketing filenames contain CJK characters. React's
 * server renderer may promote early images into the HTTP Link preload header,
 * which only accepts ASCII header values. URI-encoding the path keeps the
 * public filename unchanged while making both HTML and preload headers valid.
 */
export function assetUrl(path: string): string {
  return encodeURI(path);
}
