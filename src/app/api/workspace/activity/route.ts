import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { isValidCourseSlug, isValidLessonNumber, upsertCourseActivity } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/request-session";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function passesSameOrigin(request: NextRequest) {
  if (AUTH_DISABLED) return true;
  // Prefer the configured public origin behind a reverse proxy; in local
  // authenticated development, compare against the request origin instead of
  // disabling the CSRF boundary altogether.
  const expected = process.env.DASH_PUBLIC_ORIGIN?.trim() || request.nextUrl.origin;
  const supplied = request.headers.get("origin") || request.headers.get("referer");
  if (!expected || !supplied) return false;
  try {
    return new URL(supplied).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

/** Persist the latest lesson viewed by the authenticated workspace user. */
export async function POST(request: NextRequest) {
  // Development auth bypass has no user identity to associate with a row.
  if (AUTH_DISABLED) return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  if (!passesSameOrigin(request)) return json({ error: "CSRF" }, 403);

  let session;
  try {
    session = await getSessionFromHeaders(request.headers);
  } catch {
    return json({ error: "SESSION_UNAVAILABLE" }, 503);
  }
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "INVALID_BODY" }, 400);
  }

  const input = body as { courseSlug?: unknown; lesson?: unknown };
  if (!isValidCourseSlug(input.courseSlug)) return json({ error: "INVALID_COURSE" }, 400);
  if (!isValidLessonNumber(input.lesson, input.courseSlug)) return json({ error: "INVALID_LESSON" }, 400);

  try {
    upsertCourseActivity(session.user.id, input.courseSlug, input.lesson);
    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: "INVALID_INPUT" }, 400);
    return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  }
}
