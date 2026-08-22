import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getSafeReturnTo, RETURN_TO_HEADER } from "@/lib/return-to";
import { AdminNav } from "@/components/admin-nav";
import { Link } from "@/i18n/navigation";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "admin");
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  if (!AUTH_DISABLED) {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) {
      const returnTo = getSafeReturnTo(requestHeaders.get(RETURN_TO_HEADER), locale) ?? `/${locale}/admin`;
      redirect(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    if ((session.user as { role?: string }).role !== "admin") {
      // 已登录但非管理员：403 提示页
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <AdminNav />
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="w-full max-w-[420px] rounded-2xl bg-card p-10 text-center shadow-card">
              <div className="text-[40px] font-extrabold text-navy">403</div>
              <div className="mt-2 text-[17px] font-extrabold">{t("forbiddenTitle")}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-subtext">{t("forbiddenDesc")}</p>
              <Link
                href="/workspace"
                className="mt-5 inline-block rounded-[10px] bg-navy px-6 py-2.5 text-[13px] font-extrabold tracking-wider text-white"
              >
                {t("backToSite")}
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-[1200px] px-7 py-8">{children}</main>
    </div>
  );
}
