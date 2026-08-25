import { NextRequest, NextResponse } from "next/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getResource } from "@/lib/db";
import { createResourceArchiveResponse } from "@/lib/resource-archive";
import { getStorage, StorageError } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 资源下载/打开端点。
 * file 型：302 到受保护的下载流端点
 * folder 型：直接流式返回有大小与数量上限的 ZIP
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

  if (row.kind === "folder") {
    try {
      return await createResourceArchiveResponse({ rows: [row], filename: `${row.title}.zip`, signal: req.signal });
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

  const storage = getStorage();
  let target: string;
  try {
    target = await storage.getReadUrl({ objectKey: row.file_key });
    target = `${target}${target.includes("?") ? "&" : "?"}mode=download`;
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
