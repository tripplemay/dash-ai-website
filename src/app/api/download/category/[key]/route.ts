import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getDb, ResourceRow } from "@/lib/db";
import { RESOURCE_CATS_STORE } from "@/lib/data";

/**
 * 分类打包下载：GET /api/download/category/<分类名>
 * 该分类 enabled=1 的资源打成一个 zip：file 型加单文件，folder 型递归加目录。
 * 流式生成，不做缓存（单类体积几十 MB 内）。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const { key } = await params;
  const category = decodeURIComponent(key);
  if (!RESOURCE_CATS_STORE.includes(category)) {
    return NextResponse.json({ error: "UNKNOWN_CATEGORY" }, { status: 404 });
  }

  const rows = getDb()
    .prepare("SELECT * FROM resources WHERE category = ? AND enabled = 1 ORDER BY sort ASC, id ASC")
    .all(category) as ResourceRow[];
  if (rows.length === 0) {
    return NextResponse.json({ error: "EMPTY_CATEGORY" }, { status: 404 });
  }

  const pub = path.join(process.cwd(), "public");
  const archive = new ZipArchive();
  const pass = new PassThrough();
  archive.on("error", () => pass.destroy());
  archive.pipe(pass);

  for (const r of rows) {
    const rel = r.file_key.replace(/^\/+|\/+$/g, "");
    const abs = path.join(pub, rel);
    if (!abs.startsWith(pub) || !fs.existsSync(abs)) continue; // 防穿越 + 缺文件跳过
    if (r.kind === "folder") {
      archive.directory(abs, path.basename(abs));
    } else {
      archive.file(abs, { name: path.basename(abs) });
    }
  }
  const finalized = archive.finalize();
  finalized.catch(() => pass.destroy());

  const filename = encodeURIComponent(`${category}.zip`);
  const web = Readable.toWeb(pass) as ReadableStream;
  return new Response(web, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "no-store",
    },
  });
}
