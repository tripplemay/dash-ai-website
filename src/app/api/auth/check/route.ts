import { auth } from "@/lib/auth";

// 供 nginx auth_request 使用的轻量会话校验：
// 已登录 -> 200；未登录 -> 401（nginx 据此放行或重定向登录页）
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return new Response(null, { status: session ? 200 : 401 });
}
