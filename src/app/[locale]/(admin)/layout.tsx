import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "管理后台" };
import { getTranslations } from "next-intl/server";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";
import { Link } from "@/i18n/navigation";

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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect(`/${locale}/login`);
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
                href="/"
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
