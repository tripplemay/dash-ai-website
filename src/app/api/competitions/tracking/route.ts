import { NextRequest, NextResponse } from "next/server";
import { competitionDateKey, getCompetition } from "@/lib/competitions";
import { competitionApiSession, competitionJsonBody, competitionTrackingStore, trackingJson } from "@/lib/competition-tracking-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await competitionApiSession(request);
  if (session instanceof NextResponse) return session;
  try { return trackingJson(competitionTrackingStore().snapshot(session.userId, competitionDateKey())); }
  catch { return trackingJson({ error: "TRACKING_UNAVAILABLE" }, 503); }
}

export async function PUT(request: NextRequest) {
  const session = await competitionApiSession(request, true);
  if (session instanceof NextResponse) return session;
  const body = await competitionJsonBody(request);
  if (!body || Object.keys(body).some((key) => !["slug", "following", "deadlineReminders", "updateReminders"].includes(key)) ||
    typeof body.slug !== "string" || typeof body.following !== "boolean" ||
    (body.deadlineReminders !== undefined && typeof body.deadlineReminders !== "boolean") ||
    (body.updateReminders !== undefined && typeof body.updateReminders !== "boolean")) return trackingJson({ error: "INVALID_BODY" }, 400);
  if (!getCompetition(body.slug)) return trackingJson({ error: "UNKNOWN_COMPETITION" }, 404);
  try {
    const store = competitionTrackingStore();
    store.update(session.userId, body.slug, { following: body.following, deadlineReminders: body.deadlineReminders as boolean | undefined, updateReminders: body.updateReminders as boolean | undefined });
    return trackingJson(store.snapshot(session.userId, competitionDateKey()));
  } catch { return trackingJson({ error: "TRACKING_UNAVAILABLE" }, 503); }
}

export async function POST(request: NextRequest) {
  const session = await competitionApiSession(request, true);
  if (session instanceof NextResponse) return session;
  const body = await competitionJsonBody(request);
  if (!body || Object.keys(body).some((key) => key !== "keys") || !Array.isArray(body.keys) || body.keys.length > 100 ||
    !body.keys.every((key) => typeof key === "string" && /^[a-f0-9]{64}$/.test(key))) return trackingJson({ error: "INVALID_BODY" }, 400);
  try {
    const store = competitionTrackingStore();
    const today = competitionDateKey();
    if (!store.markRead(session.userId, body.keys, today)) return trackingJson({ error: "REMINDER_CHANGED" }, 409);
    return trackingJson(store.snapshot(session.userId, today));
  } catch { return trackingJson({ error: "TRACKING_UNAVAILABLE" }, 503); }
}
