import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function assetVolumeIsReady() {
  const publicRoot = path.resolve(process.cwd(), "public");
  for (const directory of ["assets", "files"]) {
    const target = path.join(publicRoot, directory);
    try {
      const stat = fs.statSync(target);
      fs.accessSync(target, fs.constants.R_OK | fs.constants.X_OK);
      if (!stat.isDirectory()) return false;
    } catch {
      return false;
    }
  }
  const probe = path.join(publicRoot, "files", `.dash-ready-${process.pid}-${randomUUID()}`);
  let handle: number | undefined;
  try {
    handle = fs.openSync(probe, "wx", 0o600);
    fs.writeSync(handle, "ready\n");
    fs.closeSync(handle);
    handle = undefined;
    fs.unlinkSync(probe);
  } catch {
    if (handle !== undefined) fs.closeSync(handle);
    try {
      fs.unlinkSync(probe);
    } catch {
      // The probe is best-effort cleanup; readiness remains failed.
    }
    return false;
  }
  return true;
}

/**
 * Readiness probe. Keep the response intentionally generic: database errors
 * are useful to logs, but must not disclose paths or schema details publicly.
 */
export async function GET() {
  try {
    // Import inside the guarded block so missing production auth settings turn
    // into a generic readiness failure instead of an uncaught route exception.
    const { auth } = await import("@/lib/auth");
    await auth.api.getSession({ headers: new Headers() });
    const db = getDb();
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('resources', 'user', 'session', 'account', 'verification')`
      )
      .all() as Array<{ name: string }>;

    if (tables.length < 5) {
      throw new Error("required database tables are unavailable");
    }
    if (!assetVolumeIsReady()) {
      throw new Error("required asset volume is unavailable");
    }

    return NextResponse.json(
      { status: "ok", release: process.env.DASH_RELEASE_ID || "unknown" },
      { headers: HEALTH_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: HEALTH_HEADERS }
    );
  }
}
