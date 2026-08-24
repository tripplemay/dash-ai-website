import { AUTH_DISABLED } from "@/lib/auth";
import { getRequestSession } from "@/lib/request-session";

/**
 * 管理端守卫：校验登录且 role === "admin"。
 * 供 server actions / route handlers 使用（这些端点不受页面布局守卫约束，必须各自校验）。
 * 非管理员抛异常；调用方按需捕获。
 */
export async function requireAdmin() {
  if (AUTH_DISABLED) return null;
  const session = await getRequestSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if ((session.user as { role?: string }).role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

export async function getAdminSession() {
  if (AUTH_DISABLED) return null;
  return getRequestSession();
}
