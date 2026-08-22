import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getSafeReturnTo, RETURN_TO_HEADER } from "@/lib/return-to";

const intlMiddleware = createMiddleware(routing);

const AUTH_DISABLED =
  process.env.DASH_AUTH_DISABLED === "1" && process.env.NODE_ENV === "development";

const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (AUTH_DISABLED) return intlMiddleware(req);

  const m = pathname.match(/^\/(zh|en)(\/.*)?$/);
  // 无 locale 前缀的路径交给 next-intl 重定向
  if (!m) return intlMiddleware(req);
  const locale = m[1];
  const rest = m[2] ?? "/";

  // Layouts cannot receive searchParams, so carry the verified request URL
  // through next-intl's request headers for the session check below.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(RETURN_TO_HEADER, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  const request = new NextRequest(req, { headers: requestHeaders });
  const res = intlMiddleware(request);

  // 登录页公开
  if (rest === "/login" || rest.startsWith("/login/")) return res;

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.hash = "";
    const returnTo = getSafeReturnTo(`${req.nextUrl.pathname}${req.nextUrl.search}`, locale);
    if (returnTo) url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // 跳过 api / next 内部资源 / 品牌手册静态页 / 带扩展名的静态文件（public 下资源）
  matcher: ["/((?!api|_next|_vercel|brand|.*\\..*).*)"],
};
