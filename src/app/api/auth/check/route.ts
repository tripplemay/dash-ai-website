import { auth } from "@/lib/auth";
import { getResourceByFileKey, listEnabledFolderResources, RESOURCE_ZIP_LIMIT } from "@/lib/db";

export const runtime = "nodejs";

// 供 nginx auth_request 使用的轻量会话校验：
// 已登录且资源仍登记/上架 -> 200；未登录 -> 401；下架或未知文件 -> 403。
// X-Original-URI 由 nginx auth_request 子请求转发，用于防止旧的直出
// /files URL 绕过 resources.enabled 校验。
function protectedFileIsAllowed(req: Request) {
  const original = req.headers.get("x-original-uri");
  if (!original || !original.startsWith("/files/")) return true;
  const pathname = original.split("?", 1)[0];
  const segments = pathname.slice(1).split("/");
  if (segments.at(-1) === "") segments.pop();
  const decoded = segments.map((segment) => {
    try {
      const value = decodeURIComponent(segment);
      if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || /[%?#\0\r\n]/.test(value)) return null;
      return value;
    } catch {
      return null;
    }
  });
  if (decoded.some((segment) => segment === null)) return false;
  const key = (decoded as string[]).join("/");
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
