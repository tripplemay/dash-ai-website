import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Link } from "@/i18n/navigation";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Users, FolderDown, Eye, EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  const db = getDb();
  const resTotal = (db.prepare("SELECT COUNT(*) AS c FROM resources").get() as { c: number }).c;
  const resEnabled = (db.prepare("SELECT COUNT(*) AS c FROM resources WHERE enabled = 1").get() as { c: number }).c;

  let userTotal = 0;
  try {
    if (AUTH_DISABLED) {
      userTotal = (db.prepare("SELECT COUNT(*) AS c FROM user").get() as { c: number }).c;
    } else {
      const res = await auth.api.listUsers({
        query: { limit: "1" },
        headers: await headers(),
      });
      userTotal = res.total;
    }
  } catch {
    userTotal = 0;
  }

  const cards = [
    { icon: Users, label: t("dash.users"), value: userTotal, href: "/admin/accounts" },
    { icon: FolderDown, label: t("dash.resources"), value: resTotal, href: "/admin/resources" },
    { icon: Eye, label: t("dash.enabled"), value: resEnabled, href: "/admin/resources" },
    { icon: EyeOff, label: t("dash.disabled"), value: resTotal - resEnabled, href: "/admin/resources" },
  ];

  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[2px]">{t("dash.title")}</h1>
      <div className="mt-1.5 text-[13.5px] text-subtext">{t("dash.sub")}</div>
      <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
          >
            <c.icon className="size-6 text-cyan-print" />
            <div className="mt-3 text-[32px] font-extrabold text-navy">{c.value}</div>
            <div className="mt-1 text-[13px] font-bold text-subtext">{c.label}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
