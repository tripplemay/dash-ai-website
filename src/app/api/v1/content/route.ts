import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import {
  ContentConflictError,
  InvalidContentError,
  createContentDraft,
  listContentEntries,
  toPublicContentSummary,
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

function parseLimit(value: string | null) {
  if (value === null || value === "") return undefined;
  if (!/^\d+$/.test(value)) throw new InvalidContentError("INVALID_LIMIT");
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new InvalidContentError("INVALID_LIMIT");
  }
  return limit;
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
  if (error instanceof InvalidContentError) return json({ error: error.message }, 400);
  if (error instanceof ContentConflictError) return json({ error: error.message }, 409);
  return json({ error: "CONTENT_UNAVAILABLE" }, 503);
}

/** Versioned content catalogue. Non-admin callers only receive published entries. */
export async function GET(request: NextRequest) {
  let actor;
  try {
    actor = await requestActor(request);
  } catch {
    return json({ error: "SESSION_UNAVAILABLE" }, 503);
  }
  if (!actor) return json({ error: "UNAUTHORIZED" }, 401);

  const params = request.nextUrl.searchParams;
  let limit: number | undefined;
  try {
    limit = parseLimit(params.get("limit"));
  } catch (error) {
    return errorResponse(error);
  }
  const rawStatus = params.get("status");
  const status = actor.admin && rawStatus && rawStatus !== "all"
    ? (rawStatus as ContentStatus)
    : actor.admin
      ? undefined
      : "published";

  try {
    const page = listContentEntries({
      type: params.get("type") || undefined,
      contentType: params.get("contentType") || params.get("content_type") || undefined,
      locale: params.get("locale") || undefined,
      status,
      publicOnly: !actor.admin,
      query: params.get("query") || undefined,
      cursor: params.get("cursor") || undefined,
      limit,
    });
    return json({ data: actor.admin ? page.items : page.items.map(toPublicContentSummary), nextCursor: page.nextCursor });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Create a draft content entry. Publishing remains an explicit reviewed transition. */
export async function POST(request: NextRequest) {
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
    type?: string;
    contentType?: string;
    content_type?: string;
    slug?: string;
    locale?: string;
    payload?: unknown;
    expiresAt?: string | null;
    expires_at?: string | null;
  };
  try {
    const item = createContentDraft(
      {
        type: input.type ?? input.contentType ?? input.content_type,
        slug: input.slug || "",
        locale: input.locale,
        payload: input.payload as never,
        expiresAt: Object.prototype.hasOwnProperty.call(input, "expiresAt") ? input.expiresAt : input.expires_at,
      },
      actor.userId,
    );
    return json({ data: item }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
