import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "./auth";
import { getDb } from "./db";
import { COMPETITIONS, competitionDateKey } from "./competitions";
import { getRequestSession, getSessionFromHeaders } from "./request-session";
import { createCompetitionTrackingStore, type CompetitionTrackingSnapshot } from "./competition-tracking";

export const TRACKING_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
export const emptyCompetitionTracking: CompetitionTrackingSnapshot = { available: false, follows: [], reminders: [] };
export function trackingJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: TRACKING_HEADERS });
}
export function competitionTrackingStore() {
  return createCompetitionTrackingStore(getDb(), COMPETITIONS);
}
export async function initialCompetitionTracking() {
  try {
    const session = await getRequestSession();
    return session ? competitionTrackingStore().snapshot(session.user.id, competitionDateKey()) : emptyCompetitionTracking;
  } catch {
    return emptyCompetitionTracking;
  }
}
export async function competitionApiSession(request: NextRequest, mutation = false) {
  if (AUTH_DISABLED) return trackingJson({ error: "PREVIEW_UNAVAILABLE" }, 503);
  if (mutation) {
    try {
      const expected = new URL(process.env.DASH_PUBLIC_ORIGIN?.trim() || request.nextUrl.origin).origin;
      if (new URL(request.headers.get("origin") || "").origin !== expected) return trackingJson({ error: "CSRF" }, 403);
    } catch { return trackingJson({ error: "CSRF" }, 403); }
  }
  try {
    const session = await getSessionFromHeaders(request.headers);
    return session ? { userId: session.user.id } : trackingJson({ error: "UNAUTHORIZED" }, 401);
  } catch { return trackingJson({ error: "SESSION_UNAVAILABLE" }, 503); }
}

export async function competitionJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
