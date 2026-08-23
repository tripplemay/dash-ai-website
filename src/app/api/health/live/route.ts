import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/** Process liveness probe. It deliberately avoids touching the database. */
export function GET() {
  return NextResponse.json(
    { status: "ok", release: process.env.DASH_RELEASE_ID || "unknown" },
    { headers: HEALTH_HEADERS }
  );
}
