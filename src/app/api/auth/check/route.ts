import { auth } from "@/lib/auth";
import { getResourceByFileKey, listEnabledFolderResources, RESOURCE_ZIP_LIMIT } from "@/lib/db";

export const runtime = "nodejs";

const CORECOORD_STATIC_ROOT = "/assets/brand/corecoord/2026.1";
const PROTECTED_STATIC_PREFIXES = [
  {
    prefix: `${CORECOORD_STATIC_ROOT}/vi-system-2026/manual/output/pdf/`,
    resourceRoot: "files/corecoord/guides",
  },
  {
    prefix: `${CORECOORD_STATIC_ROOT}/vi-system-2026/deliverables/templates/`,
    resourceRoot: "files/corecoord/course-templates",
  },
] as const;

// 供 nginx auth_request 使用的轻量会话校验：
// 已登录且资源仍登记/上架 -> 200；未登录 -> 401；下架或未知文件 -> 403。
// X-Original-URI 由 nginx auth_request 子请求转发，用于防止旧的直出
// /files 或受保护的 CORECOORD 静态副本 URL 绕过 resources.enabled 校验。
function decodeResourceKey(pathname: string, prefix: string, resourceRoot: string) {
  const raw = pathname.slice(prefix.length);
  if (!raw) return null;
  const decoded = raw.split("/").map((segment) => {
    try {
      const value = decodeURIComponent(segment);
      if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || /[%?#\0\r\n]/.test(value)) return null;
      return value;
    } catch {
      return null;
    }
  });
  if (decoded.some((segment) => segment === null)) return null;
  return `${resourceRoot}/${(decoded as string[]).join("/")}`;
}

function protectedResourceKey(pathname: string) {
  if (pathname.startsWith("/files/")) {
    return decodeResourceKey(pathname, "/files/", "files");
  }
  const staticPrefix = PROTECTED_STATIC_PREFIXES.find(({ prefix }) => pathname.startsWith(prefix));
  return staticPrefix ? decodeResourceKey(pathname, staticPrefix.prefix, staticPrefix.resourceRoot) : undefined;
}

function protectedFileIsAllowed(req: Request) {
  const original = req.headers.get("x-original-uri");
  if (!original) return true;
  const pathname = original.split("?", 1)[0];
  const key = protectedResourceKey(pathname);
  if (key === undefined) return true;
  if (!key) return false;
  const direct = getResourceByFileKey(key);
  if (direct?.enabled && (direct.kind === "file" || direct.kind === "folder")) return true;
  return listEnabledFolderResources(RESOURCE_ZIP_LIMIT)
    .map((row) => row.file_key.replace(/^\/+|\/+$/g, ""))
    .some((root) => key.startsWith(`${root}/`));
}

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response(null, {
        status: 401,
        headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
      });
    }
    if (!protectedFileIsAllowed(req)) {
      return new Response(null, {
        status: 403,
        headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
      });
    }
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
    });
  }
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
