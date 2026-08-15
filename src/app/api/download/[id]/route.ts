import { NextRequest, NextResponse } from "next/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getResource } from "@/lib/db";
import { getStorage } from "@/lib/storage";

/**
 * 资源下载/打开端点。
 * file 型：302 到 /<file_key>（生产由 nginx 直出，已配 auth_request）
 * folder 型：302 到 /api/browse/<file_key> 清单页
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const { id } = await params;
  const row = getResource(Number(id));
  if (!row || !row.enabled) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const storage = getStorage();
  const target =
    row.kind === "folder"
      ? storage.resolveFolderUrl(row.file_key)
      : storage.resolveFileUrl(row.file_key);
  return NextResponse.redirect(new URL(target, req.url), 302);
}
