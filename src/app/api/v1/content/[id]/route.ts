import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import {
  ContentConflictError,
  ContentNotFoundError,
  InvalidContentError,
  getContentEntry,
  isContentPubliclyAvailable,
  toPublicContentEntry,
  transitionContent,
  updateContentDraft,
  type ContentStatus,
} from "@/lib/content";
import { getSessionFromHeaders } from "@/lib/request-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
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

async function requestActor(request: NextRequest) {
  if (AUTH_DISABLED) return { userId: null, admin: true };
  const session = await getSessionFromHeaders(request.headers);
  if (!session) return null;
  return {
    userId: session.user.id,
    admin: (session.user as { role?: string }).role === "admin",
  };
}

function errorResponse(error: unknown) {
  if (error instanceof ContentNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof InvalidContentError) return json({ error: error.message }, 400);
  if (error instanceof ContentConflictError) return json({ error: error.message }, 409);
  return json({ error: "CONTENT_UNAVAILABLE" }, 503);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requestActor(request);
  } catch {
    return json({ error: "SESSION_UNAVAILABLE" }, 503);
  }
  if (!actor) return json({ error: "UNAUTHORIZED" }, 401);

  try {
    const { id } = await params;
    const item = getContentEntry(id, request.nextUrl.searchParams.get("locale") || undefined);
    if (
      !item ||
      (!actor.admin &&
        (!isContentPubliclyAvailable(item) ||
          !item.latestRevision ||
          !isContentPubliclyAvailable(item.latestRevision)))
    ) {
      return json({ error: "CONTENT_NOT_FOUND" }, 404);
    }
    return json({ data: actor.admin ? item : toPublicContentEntry(item) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Add a revision or transition the editorial state; exactly one operation is accepted per request. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!passesSameOrigin(request)) return json({ error: "CSRF" }, 403);

  let actor;
  try {
    actor = await requestActor(request);
  } catch {
    return json({ error: "SESSION_UNAVAILABLE" }, 503);
  }
  if (!actor) return json({ error: "UNAUTHORIZED" }, 401);
  if (!actor.admin) return json({ error: "FORBIDDEN" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "INVALID_BODY" }, 400);
  }
  const input = body as {
    payload?: unknown;
    payload_json?: unknown;
    status?: ContentStatus | null;
    targetStatus?: ContentStatus;
    target_status?: ContentStatus;
    expectedRevision?: number;
    expected_revision?: number;
    expiresAt?: string | null;
    expires_at?: string | null;
  };
  const payload = Object.prototype.hasOwnProperty.call(input, "payload") ? input.payload : input.payload_json;
  const status = Object.prototype.hasOwnProperty.call(input, "status")
    ? input.status
    : input.targetStatus ?? input.target_status;
  if (status === null) return json({ error: "INVALID_STATUS" }, 400);
  if ((payload === undefined) === (status === undefined)) {
    return json({ error: "ONE_OPERATION_REQUIRED" }, 400);
  }

  try {
    const { id } = await params;
    const item = status !== undefined
      ? transitionContent(id, status, actor.userId)
      : updateContentDraft(
          id,
          {
            payload: payload as never,
            expectedRevision: input.expectedRevision ?? input.expected_revision,
            expiresAt: Object.prototype.hasOwnProperty.call(input, "expiresAt") ? input.expiresAt : input.expires_at,
          },
          actor.userId,
        );
    return json({ data: item });
  } catch (error) {
    return errorResponse(error);
  }
}
