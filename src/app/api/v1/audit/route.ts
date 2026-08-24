import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { InvalidContentError, listAuditEvents } from "@/lib/content";
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

/** Read the editorial audit stream; writes are only emitted by domain services. */
export async function GET(request: NextRequest) {
  if (!AUTH_DISABLED) {
    let session;
    try {
      session = await getSessionFromHeaders(request.headers);
    } catch {
      return json({ error: "SESSION_UNAVAILABLE" }, 503);
    }
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
    if ((session.user as { role?: string }).role !== "admin") return json({ error: "FORBIDDEN" }, 403);
  }

  const params = request.nextUrl.searchParams;
  const rawLimit = params.get("limit");
  if (rawLimit !== null && !/^\d+$/.test(rawLimit)) return json({ error: "INVALID_LIMIT" }, 400);
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) {
    return json({ error: "INVALID_LIMIT" }, 400);
  }

  try {
    const page = listAuditEvents({
      entityType: params.get("entityType") || params.get("entity_type") || undefined,
      entityId: params.get("entityId") || params.get("entity_id") || undefined,
      actorId: params.get("actorId") || params.get("actor_id") || undefined,
      action: params.get("action") || undefined,
      cursor: params.get("cursor") || undefined,
      limit,
    });
    return json({ data: page.items, nextCursor: page.nextCursor, ...(AUTH_DISABLED ? { disabled: true } : {}) });
  } catch (error) {
    if (error instanceof InvalidContentError) return json({ error: error.message }, 400);
    return json({ error: "AUDIT_UNAVAILABLE" }, 503);
  }
}
