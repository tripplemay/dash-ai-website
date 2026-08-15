import { headers } from "next/headers";
import { auth, AUTH_DISABLED } from "@/lib/auth";

/**
 * 管理端守卫：校验登录且 role === "admin"。
 * 供 server actions / route handlers 使用（这些端点不受页面布局守卫约束，必须各自校验）。
 * 非管理员抛异常；调用方按需捕获。
 */
export async function requireAdmin() {
  if (AUTH_DISABLED) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("UNAUTHORIZED");
  if ((session.user as { role?: string }).role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

export async function getAdminSession() {
  if (AUTH_DISABLED) return null;
  return auth.api.getSession({ headers: await headers() });
}
