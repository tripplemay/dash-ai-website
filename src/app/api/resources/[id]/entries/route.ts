import { NextRequest, NextResponse } from "next/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { listResourceDirectory, ResourceBrowserError } from "@/lib/resource-browser";

export const runtime = "nodejs";

function errorResponse(error: ResourceBrowserError) {
  const status = error.code === "INVALID_PATH" ? 400 : error.code === "TOO_LARGE" ? 413 : error.code === "UNAVAILABLE" ? 503 : 404;
  return NextResponse.json({ error: error.code }, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const id = (await params).id;
  if (!/^[1-9]\d{0,8}$/.test(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  try {
    const listing = await listResourceDirectory(Number(id), req.nextUrl.searchParams.get("path") || "");
    return NextResponse.json(listing, {
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof ResourceBrowserError) return errorResponse(error);
    return NextResponse.json({ error: "DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}
