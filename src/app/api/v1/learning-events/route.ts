import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import {
  getCourseProgress,
  isValidLearningEventType,
  LearningError,
  listLearningEvents,
  validateLearningEventInput,
  writeLearningEvent,
  type LearningEventInput,
} from "@/lib/learning";
import { getSessionFromHeaders } from "@/lib/request-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 1000;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function json(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

function passesSameOrigin(request: NextRequest) {
  if (AUTH_DISABLED) return true;
  const expected = process.env.DASH_PUBLIC_ORIGIN?.trim() || request.nextUrl.origin;
  const supplied = request.headers.get("origin") || request.headers.get("referer");
  if (!expected || !supplied) return false;
  try {
    return new URL(supplied).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

function statusFor(code: LearningError["code"]) {
  switch (code) {
    case "IDEMPOTENCY_CONFLICT":
    case "EVENT_ID_CONFLICT":
      return 409;
    case "SCHEMA_UNAVAILABLE":
    case "SESSION_UNAVAILABLE":
    case "DATABASE_UNAVAILABLE":
      return 503;
    case "INVALID_USER":
    case "USER_MISMATCH":
    case "INVALID_EVENT_ID":
    case "INVALID_COURSE":
    case "INVALID_LESSON":
    case "INVALID_EVENT_TYPE":
    case "INVALID_IDEMPOTENCY_KEY":
    case "INVALID_PAYLOAD":
    case "INVALID_TIMESTAMP":
    case "INVALID_LIMIT":
    case "INVALID_BODY":
    default:
      return 400;
  }
}

function responseForError(error: unknown) {
  if (error instanceof LearningError) {
    return json({ error: error.code }, statusFor(error.code));
  }
  return json({ error: "DATABASE_UNAVAILABLE" }, 503);
}

async function readSession(request: NextRequest) {
  try {
    return await getSessionFromHeaders(request.headers);
  } catch {
    throw new LearningError("SESSION_UNAVAILABLE", "session unavailable");
  }
}

function parseLimit(value: string | null) {
  if (value === null || value === "") return undefined;
  if (!/^\d+$/.test(value)) throw new LearningError("INVALID_LIMIT", "limit must be a positive integer");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new LearningError("INVALID_LIMIT", `limit must be between 1 and ${MAX_LIMIT}`);
  }
  return parsed;
}

function normalizeBefore(value: string | null) {
  if (value === null || value === "") return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new LearningError("INVALID_TIMESTAMP", "invalid before timestamp");
  return date.toISOString();
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null || value === "") return fallback;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  throw new LearningError("INVALID_BODY", "includeProgress must be boolean");
}

/** Read the authenticated user's event stream, optionally narrowed to a course. */
export async function GET(request: NextRequest) {
  if (AUTH_DISABLED) return json({ data: [], events: [], items: [], progress: null, disabled: true });

  let session;
  try {
    session = await readSession(request);
  } catch (error) {
    return responseForError(error);
  }
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);

  try {
    const params = request.nextUrl.searchParams;
    const courseSlug = params.get("courseSlug") || params.get("course_slug") || undefined;
    const limit = parseLimit(params.get("limit"));
    const before = normalizeBefore(params.get("before"));
    const includeProgress = parseBoolean(params.get("includeProgress"), Boolean(courseSlug));
    const responseLimit = limit ?? 50;
    const events = listLearningEvents(session.user.id, { courseSlug, limit: responseLimit, before });
    // Progress is derived from compact database aggregates, so the response
    // history can stay bounded without dropping older completion facts.
    const progress = includeProgress && courseSlug ? getCourseProgress(session.user.id, courseSlug) : null;
    return json({ data: events, events, items: events, progress });
  } catch (error) {
    return responseForError(error);
  }
}

function normalizeBody(body: Record<string, unknown>, headerIdempotencyKey: string | null): LearningEventInput {
  const bodyIdempotencyKey = body.idempotencyKey ?? body.idempotency_key;
  if (headerIdempotencyKey && bodyIdempotencyKey !== undefined && bodyIdempotencyKey !== headerIdempotencyKey) {
    throw new LearningError("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key header does not match the request body");
  }
  return {
    eventId: body.eventId ?? body.event_id,
    userId: body.userId ?? body.user_id,
    courseSlug: body.courseSlug ?? body.course_slug,
    lessonNumber: body.lessonNumber ?? body.lesson_number ?? body.lesson,
    eventType: body.eventType ?? body.event_type,
    idempotencyKey: headerIdempotencyKey || bodyIdempotencyKey,
    payload: body.payload ?? body.payload_json,
    occurredAt: body.occurredAt ?? body.occurred_at,
  };
}

/** Append an authenticated event with same-origin CSRF and idempotency checks. */
export async function POST(request: NextRequest) {
  // Match the existing workspace activity endpoint: auth-disabled local
  // previews have no user identity and intentionally perform no write.
  if (AUTH_DISABLED) return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  if (!passesSameOrigin(request)) return json({ error: "CSRF" }, 403);

  let session;
  try {
    session = await readSession(request);
  } catch (error) {
    return responseForError(error);
  }
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return json({ error: "INVALID_BODY" }, 400);
  }

  try {
    const body = normalizeBody(rawBody as Record<string, unknown>, request.headers.get("idempotency-key"));
    // Validate once at the boundary so malformed payloads get a precise 400;
    // writeLearningEvent repeats the check before touching the database.
    validateLearningEventInput(body, session.user.id);
    if (!isValidLearningEventType(body.eventType)) {
      return json({ error: "INVALID_EVENT_TYPE" }, 400);
    }
    const result = writeLearningEvent(session.user.id, body);
    return json(
      { data: result.event, event: result.event, replayed: result.replayed },
      result.replayed ? 200 : 201,
      { "Idempotency-Key": result.event.idempotencyKey }
    );
  } catch (error) {
    return responseForError(error);
  }
}
