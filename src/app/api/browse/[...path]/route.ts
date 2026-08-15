import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * 目录浏览：public 下的目录（如 files/证书手册/家长手册/）静态服务不支持列目录，
 * 这里渲染一个简单清单页，文件直接链接到 /files/... 静态地址。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segs } = await params;
  const rel = segs.map(decodeURIComponent).join("/");
  const abs = path.join(process.cwd(), "public", rel);

  // 防目录穿越
  if (!abs.startsWith(path.join(process.cwd(), "public"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const entries = fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const base = "/" + rel.replace(/\/$/, "");
  const rows = entries
    .map((e) => {
      const href = e.isDirectory() ? `/api/browse${base}/${encodeURIComponent(e.name)}` : `${base}/${encodeURIComponent(e.name)}`;
      const label = e.isDirectory() ? `${e.name}/` : e.name;
      return `<li><a href="${href}"${e.isDirectory() ? "" : ' target="_blank"'}>${label}</a></li>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${rel} · DASH AI</title>
<style>body{font-family:"PingFang SC",sans-serif;background:#F4F7FD;color:#1B2A6B;max-width:860px;margin:0 auto;padding:40px 24px}
h1{font-size:20px;letter-spacing:1px}ul{list-style:none;padding:0;margin-top:18px}
li{margin:6px 0}a{display:block;background:#fff;border-radius:10px;padding:12px 16px;color:#1B2A6B;
text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(27,42,107,.08)}a:hover{color:#00B8D9}</style>
</head><body><h1>${rel}</h1><ul>${rows}</ul></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
