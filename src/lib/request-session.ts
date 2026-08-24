import { cache } from "react";
import { headers as nextHeaders } from "next/headers";
import { AUTH_DISABLED, auth } from "./auth";

/** The Better Auth session shape returned for the current request. */
export type RequestSession = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Request headers are memoized with the session so layouts and server
 * components share one request context instead of resolving headers again.
 */
export const getRequestHeaders = cache(async () => nextHeaders());

/** Memoized per RSC request; never use this cache for arbitrary user input. */
export const getRequestSession = cache(async (): Promise<RequestSession> => {
  if (AUTH_DISABLED) return null;
  return auth.api.getSession({ headers: await getRequestHeaders() });
});

/** Session lookup for route handlers, where the request supplies its headers. */
export async function getSessionFromHeaders(requestHeaders: Headers): Promise<RequestSession> {
  if (AUTH_DISABLED) return null;
  return auth.api.getSession({ headers: requestHeaders });
}
