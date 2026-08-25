import { NextRequest, NextResponse } from "next/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getResource } from "@/lib/db";
import { createResourceSelectionArchiveResponse } from "@/lib/resource-archive";
import { StorageError } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_SELECTED_FILES = 1000;

function errorResponse(error: unknown) {
  if (!(error instanceof StorageError)) return NextResponse.json({ error: "STORAGE_UNAVAILABLE" }, { status: 503 });
  const busy = error.message === "archive busy";
  const status = busy ? 429 : error.message === "archive unsupported" ? 501 : error.code === "INVALID_KEY" || error.code === "CONFLICT" ? 400 : error.code === "NOT_FOUND" ? 404 : error.code === "TOO_LARGE" ? 413 : error.code === "FORBIDDEN" ? 403 : 503;
  return NextResponse.json({ error: busy ? "ARCHIVE_BUSY" : error.code }, {
    status,
    ...(busy ? { headers: { "Retry-After": "5" } } : {}),
  });
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const id = (await params).id;
  if (!/^[1-9]\d{0,8}$/.test(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const row = getResource(Number(id));
  if (!row || !row.enabled || row.kind !== "folder") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const paths = body && typeof body === "object" && Array.isArray((body as { paths?: unknown }).paths)
    ? (body as { paths: unknown[] }).paths
    : null;
  if (!paths || paths.length === 0 || paths.length > MAX_SELECTED_FILES || paths.some((value) => typeof value !== "string" || value.length > 1024)) {
    return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
  }

  try {
    return await createResourceSelectionArchiveResponse({
      row,
      relativePaths: paths as string[],
      filename: `${row.title}-selected.zip`,
      signal: req.signal,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
