import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { getSafeReturnTo, RETURN_TO_HEADER } from "@/lib/return-to";
import { getRequestHeaders, getRequestSession } from "@/lib/request-session";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  let isAdmin = false;
  if (!AUTH_DISABLED) {
    const requestHeaders = await getRequestHeaders();
    const session = await getRequestSession();
    if (!session) {
      const loginUrl = new URL(`/${locale}/login`, "http://dash-ai.invalid");
      const returnTo = getSafeReturnTo(requestHeaders.get(RETURN_TO_HEADER), locale);
      if (returnTo) loginUrl.searchParams.set("returnTo", returnTo);
      redirect(`${loginUrl.pathname}${loginUrl.search}`);
    }
    isAdmin = (session.user as { role?: string }).role === "admin";
  }
  return (
    <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-[70] rounded-md bg-white px-4 py-2 text-sm font-bold text-indigo-800 shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-coral-500"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader isAdmin={isAdmin} />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none lg:pb-0">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
