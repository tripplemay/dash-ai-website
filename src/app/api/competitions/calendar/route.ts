import { NextRequest, NextResponse } from "next/server";
import { COMPETITIONS, competitionDateKey, getCompetition } from "@/lib/competitions";
import { buildCompetitionIcs } from "@/lib/competition-ics";
import { competitionApiSession, competitionTrackingStore, trackingJson, TRACKING_HEADERS } from "@/lib/competition-tracking-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await competitionApiSession(request);
  if (session instanceof NextResponse) return session;
  const params = request.nextUrl.searchParams;
  const scope = params.get("scope") ?? "followed";
  const slug = params.get("slug");
  const locale = params.get("locale") ?? "zh";
  if (!["all", "followed"].includes(scope) || !["zh", "en"].includes(locale) || (slug && scope !== "all")) return trackingJson({ error: "INVALID_QUERY" }, 400);
  if (slug && !getCompetition(slug)) return trackingJson({ error: "UNKNOWN_COMPETITION" }, 404);
  try {
    let items = slug ? [getCompetition(slug)!] : COMPETITIONS;
    if (scope === "followed") {
      const followed = new Set(competitionTrackingStore().snapshot(session.userId, competitionDateKey()).follows.map((item) => item.slug));
      items = items.filter((item) => followed.has(item.slug));
    }
    if (!items.some((item) => item.schedule.some((stage) => stage.start || stage.end))) return trackingJson({ error: "NO_DATED_EVENTS" }, 409);
    const origin = process.env.DASH_PUBLIC_ORIGIN?.trim() || request.nextUrl.origin;
    return new Response(buildCompetitionIcs(items, { locale, origin }), { headers: {
      ...TRACKING_HEADERS, "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="corecoord-competitions.ics"',
    } });
  } catch { return trackingJson({ error: "CALENDAR_UNAVAILABLE" }, 503); }
}
