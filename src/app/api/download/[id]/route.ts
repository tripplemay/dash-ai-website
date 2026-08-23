import { NextRequest, NextResponse } from "next/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getResource } from "@/lib/db";
import { getStorage, StorageError } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 资源下载/打开端点。
 * file 型：302 到受保护的 /api/file/<file_key> 流端点
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
  if (!/^[1-9]\d{0,8}$/.test(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const row = getResource(Number(id));
  if (!row || !row.enabled) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const storage = getStorage();
  let target: string;
  try {
    target = row.kind === "folder" ? await storage.getFolderUrl({ objectKey: row.file_key }) : await storage.getReadUrl({ objectKey: row.file_key });
  } catch (error) {
    if (error instanceof StorageError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: "STORAGE_UNAVAILABLE" }, { status: 503 });
  }
  // 相对 Location：由浏览器/客户端基于当前源解析，
  // 避免反代后 req.url 拿到内部地址（localhost:3517）拼出错误跳转
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
