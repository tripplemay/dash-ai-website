import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getSafeReturnTo } from "@/lib/return-to";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

/**
 * 目录浏览：public 下的目录（如 files/证书手册/家长手册/）静态服务不支持列目录，
 * 这里渲染一个简单清单页，文件直接链接到 /files/... 静态地址。
 * 需要登录：未登录重定向到登录页。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      const locale = req.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "zh";
      const login = new URL(`/${locale}/login`, req.url);
      const returnTo = getSafeReturnTo(`${req.nextUrl.pathname}${req.nextUrl.search}`, locale, { allowBrowseApi: true });
      if (returnTo) login.searchParams.set("returnTo", returnTo);
      return NextResponse.redirect(login, 302);
    }
  }

  const { path: segs } = await params;
  const rel = segs.map(decodeURIComponent).join("/");
  const publicRoot = path.resolve(process.cwd(), "public");
  const abs = path.resolve(publicRoot, rel);

  // 防目录穿越
  const relative = path.relative(publicRoot, abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const entries = fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const pathParts = rel.replace(/\/$/, "").split("/").filter(Boolean);
  const base = "/" + pathParts.map(encodeURIComponent).join("/");
  const rows = entries
    .map((e) => {
      const href = e.isDirectory() ? `/api/browse${base}/${encodeURIComponent(e.name)}` : `${base}/${encodeURIComponent(e.name)}`;
      const label = e.isDirectory() ? `${e.name}/` : e.name;
      return `<li><a href="${escapeHtml(href)}"${e.isDirectory() ? "" : ' target="_blank" rel="noreferrer"'}>${escapeHtml(label)}</a></li>`;
    })
    .join("");

  const locale = req.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "zh";
  const copy = locale === "en"
    ? { title: "Directory browser", back: "Back to resources", workspace: "Workspace", empty: "No files" }
    : { title: "目录浏览", back: "返回资源中心", workspace: "工作台", empty: "暂无文件" };
  const safeRel = escapeHtml(rel);
  const content = rows || `<li class="empty">${copy.empty}</li>`;

  const html = `<!DOCTYPE html><html lang="${locale === "en" ? "en" : "zh-CN"}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeRel} · DASH AI</title>
<style>body{font-family:"PingFang SC","Helvetica Neue",sans-serif;background:#F4F7FD;color:#1B2A6B;max-width:860px;margin:0 auto;padding:24px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:32px}header a{background:transparent!important;box-shadow:none!important;padding:0!important;color:#00B8D9!important}
h1{font-size:20px;letter-spacing:1px;overflow-wrap:anywhere}ul{list-style:none;padding:0;margin-top:18px}
li{margin:6px 0}.empty{padding:28px 16px;background:#fff;border-radius:10px;color:#5A6B9C;text-align:center}li a{display:block;background:#fff;border-radius:10px;padding:12px 16px;color:#1B2A6B;
text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(27,42,107,.08)}li a:hover{color:#00B8D9}</style>
</head><body><header><a href="/${locale}/workspace">${copy.workspace}</a><a href="/${locale}/resources">${copy.back}</a></header><h1>${copy.title} · ${safeRel}</h1><ul>${content}</ul></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
