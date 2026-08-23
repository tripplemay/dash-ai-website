import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { listEnabledFolderResources, RESOURCE_ZIP_LIMIT } from "@/lib/db";
import { getStorage, StorageError } from "@/lib/storage";
import { getSafeReturnTo } from "@/lib/return-to";

export const runtime = "nodejs";

function boundedPositiveEnv(name: string, fallback: number, maximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, Math.floor(parsed)) : fallback;
}

const MAX_BROWSE_ENTRIES = boundedPositiveEnv("DASH_BROWSE_MAX_ENTRIES", 1000, 5000);
const MAX_BROWSE_SCANNED_ENTRIES = boundedPositiveEnv("DASH_BROWSE_MAX_SCANNED_ENTRIES", 10000, 20000);
const MAX_BROWSE_HTML_BYTES = boundedPositiveEnv("DASH_BROWSE_MAX_HTML_BYTES", 2 * 1024 * 1024, 8 * 1024 * 1024);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

function decodeSegment(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\") || /[\0\r\n]/.test(decoded)) return null;
    if (/%2f|%5c|%2e/i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isWithinResourceFolder(rel: string, roots: string[]) {
  return roots.some((root) => rel === root || rel.startsWith(`${root}/`));
}

/** 只允许浏览 resources 表中已上架 folder 的目录，禁止枚举 public 任意路径。 */
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

  const input = (await params).path;
  const segments = input.map(decodeSegment);
  if (segments.some((segment) => segment === null)) return new NextResponse("Bad Request", { status: 400 });
  const decoded = segments as string[];
  if (decoded[0] !== "files" || decoded.length < 2) return new NextResponse("Forbidden", { status: 403 });
  const rel = decoded.join("/");

  let roots: string[];
  try {
    roots = listEnabledFolderResources(RESOURCE_ZIP_LIMIT)
      .map((row) => row.file_key.replace(/^\/+|\/+$/g, ""))
      .filter((key) => key.startsWith("files/") && !key.includes(".."));
  } catch {
    return new NextResponse("Service Unavailable", { status: 503 });
  }
  if (!isWithinResourceFolder(rel, roots)) return new NextResponse("Forbidden", { status: 403 });

  const storage = getStorage();
  if (!storage.getLocalPath) return new NextResponse("Not Implemented", { status: 501 });
  let abs: string;
  try {
    abs = await storage.getLocalPath(rel, { mustExist: true, directory: true });
  } catch (error) {
    if (error instanceof StorageError) {
      return new NextResponse(error.code === "NOT_FOUND" ? "Not Found" : "Forbidden", { status: error.code === "NOT_FOUND" ? 404 : 403 });
    }
    return new NextResponse("Service Unavailable", { status: 503 });
  }

  const safeEntries = [] as Array<{ name: string; directory: boolean }>;
  let scannedEntries = 0;
  try {
    const directory = await fsp.opendir(abs);
    for await (const entry of directory) {
      scannedEntries += 1;
      if (scannedEntries > MAX_BROWSE_SCANNED_ENTRIES) {
        return new NextResponse("Directory listing exceeds scan limit", { status: 413 });
      }
      if (entry.name.startsWith(".")) continue;
      if (safeEntries.length >= MAX_BROWSE_ENTRIES) {
        return new NextResponse("Directory listing exceeds limit", { status: 413 });
      }
      if (Buffer.byteLength(entry.name, "utf8") > 512) continue;
      const child = path.join(abs, entry.name);
      const stat = await fsp.lstat(child);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) continue;
      safeEntries.push({ name: entry.name, directory: stat.isDirectory() });
    }
  } catch {
    return new NextResponse("Service Unavailable", { status: 503 });
  }
  safeEntries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const pathParts = rel.split("/");
  const base = "/" + pathParts.map(encodeURIComponent).join("/");
  const rows = safeEntries
    .map((entry) => {
      const encodedName = encodeURIComponent(entry.name);
      const href = entry.directory ? `/api/browse${base}/${encodedName}` : `/api/file${base}/${encodedName}`;
      const label = entry.directory ? `${entry.name}/` : entry.name;
      return `<li><a href="${escapeHtml(href)}"${entry.directory ? "" : ' target="_blank" rel="noreferrer"'}>${escapeHtml(label)}</a></li>`;
    })
    .join("");

  const locale = req.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "zh";
  const copy = locale === "en"
    ? { title: "Directory browser", back: "Back to resources", workspace: "Workspace", empty: "No files" }
    : { title: "目录浏览", back: "返回资源中心", workspace: "工作台", empty: "暂无文件" };
  const safeRel = escapeHtml(rel);
  const content = rows || `<li class="empty">${copy.empty}</li>`;
  const html = `<!DOCTYPE html><html lang="${locale === "en" ? "en" : "zh-CN"}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${safeRel} · DASH AI</title>
<style>body{font-family:"PingFang SC","Helvetica Neue",sans-serif;background:#F4F7FD;color:#1B2A6B;max-width:860px;margin:0 auto;padding:24px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:32px;flex-wrap:wrap}header a{background:transparent!important;box-shadow:none!important;padding:0!important;color:#00B8D9!important}
h1{font-size:20px;letter-spacing:1px;overflow-wrap:anywhere}ul{list-style:none;padding:0;margin-top:18px}
li{margin:6px 0}.empty{padding:28px 16px;background:#fff;border-radius:10px;color:#5A6B9C;text-align:center}li a{display:block;background:#fff;border-radius:10px;padding:12px 16px;color:#1B2A6B;
text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(27,42,107,.08)}li a:hover{color:#00B8D9}</style>
</head><body><header><a href="/${locale}/workspace">${copy.workspace}</a><a href="/${locale}/resources">${copy.back}</a></header><h1>${copy.title} · ${safeRel}</h1><ul>${content}</ul></body></html>`;

  if (Buffer.byteLength(html, "utf8") > MAX_BROWSE_HTML_BYTES) {
    return new NextResponse("Directory listing exceeds limit", { status: 413 });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
