import { NextRequest, NextResponse } from "next/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { listEnabledResourcesForCategory, RESOURCE_ZIP_LIMIT, type ResourceRow } from "@/lib/db";
import { resolveResourceCategory } from "@/lib/data";
import { createResourceArchiveResponse } from "@/lib/resource-archive";
import { StorageError } from "@/lib/storage";

export const runtime = "nodejs";

function decodeParam(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("\0") || decoded.includes("/") || decoded.includes("\\")) return null;
    return decoded;
  } catch {
    return null;
  }
}
/** 分类打包下载：仅打包资源表中已上架且在 storage root 内的文件。 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rawKey = (await params).key;
  const categoryInput = decodeParam(rawKey);
  const category = categoryInput ? resolveResourceCategory(categoryInput) : undefined;
  if (!category) return NextResponse.json({ error: "UNKNOWN_CATEGORY" }, { status: 404 });

  let rows: ResourceRow[];
  try {
    rows = listEnabledResourcesForCategory(category.key, RESOURCE_ZIP_LIMIT);
  } catch {
    return NextResponse.json({ error: "DATABASE_UNAVAILABLE" }, { status: 503 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "EMPTY_CATEGORY" }, { status: 404 });

  try {
    return await createResourceArchiveResponse({ rows, filename: `${category.label}.zip`, signal: req.signal });
  } catch (error) {
    if (error instanceof StorageError) {
      const status = error.message === "archive busy" ? 429 : error.message === "archive unsupported" ? 501 : error.code === "NOT_FOUND" ? 404 : error.code === "TOO_LARGE" ? 413 : error.code === "FORBIDDEN" ? 403 : 503;
      const busy = error.message === "archive busy";
      return NextResponse.json(busy ? { error: "ARCHIVE_BUSY" } : { error: error.code }, {
        status,
        ...(busy ? { headers: { "Retry-After": "5" } } : {}),
      });
    }
    return NextResponse.json({ error: "STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}
