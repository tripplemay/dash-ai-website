import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { RESOURCE_CATS_STORE } from "@/lib/data";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

/**
 * 资源上传：POST multipart/form-data { file, title, category, print_advice?, overwrite? }
 * 文件写入 public/files/<category>/<文件名>（中文名原样保留），并插入 resources 记录。
 * 同名文件存在且未确认覆盖时返回 409。
 */
export async function POST(req: NextRequest) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin")
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const category = String(form.get("category") || "").trim();
  const printAdvice = String(form.get("print_advice") || "").trim();
  const overwrite = form.get("overwrite") === "1";

  if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "缺少标题" }, { status: 400 });
  if (!RESOURCE_CATS_STORE.includes(category))
    return NextResponse.json({ error: "非法分类" }, { status: 400 });

  // 防目录穿越：只取文件名部分，去掉路径与控制字符
  const filename = path.basename(file.name).replace(/[\\/:*?"<>|\x00-\x1f]/g, "");
  if (!filename) return NextResponse.json({ error: "文件名非法" }, { status: 400 });

  const dir = path.join(process.cwd(), "public", "files", category);
  const dest = path.join(dir, filename);
  if (!dest.startsWith(path.join(process.cwd(), "public", "files")))
    return NextResponse.json({ error: "路径非法" }, { status: 400 });

  if (fs.existsSync(dest) && !overwrite) {
    return NextResponse.json({ error: "EXISTS", message: "同名文件已存在" }, { status: 409 });
  }

  fs.mkdirSync(dir, { recursive: true });
  // 流式写盘
  const nodeStream = Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream);
  await pipeline(nodeStream, fs.createWriteStream(dest));

  const size = fs.statSync(dest).size;
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : null;
  const fileKey = `files/${category}/${filename}`;
  const preview = ext && IMAGE_EXTS.has(ext.toLowerCase()) ? `/${fileKey}` : null;

  const db = getDb();
  const maxSort = (db.prepare("SELECT MAX(sort) AS m FROM resources").get() as { m: number | null }).m ?? 0;
  const info = db
    .prepare(
      `INSERT INTO resources (title, category, kind, format, size, dimensions, print_advice, file_key, preview, sort)
       VALUES (?, ?, 'file', ?, ?, NULL, ?, ?, ?, ?)`
    )
    .run(title, category, ext, size, printAdvice || null, fileKey, preview, maxSort + 10);

  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
