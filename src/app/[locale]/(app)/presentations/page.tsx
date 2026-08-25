import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, MonitorPlay, Presentation } from "lucide-react";
import { getPageMetadata } from "@/lib/page-metadata";
import { BrandLogo } from "@/components/brand-logo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "presentations");
}

export default async function PresentationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "presentations" });
  const modes = [
    {
      href: "/presentations/screen",
      icon: MonitorPlay,
      title: t("screenTitle"),
      description: t("screenDesc"),
      accent: "#1B78C5",
    },
    {
      href: "/presentations/course",
      icon: Presentation,
      title: t("courseTitle"),
      description: t("courseDesc"),
      accent: "#F16C3E",
    },
  ];

  return (
    <div className="w-full px-5 py-8 sm:px-7 lg:py-12">
      <div className="max-w-[680px]">
        <div className="flex items-center gap-2 text-coral-700">
          <BrandLogo variant="mark-color" alt={t("brandAlt")} width={28} height={28} className="size-7" priority />
          <span className="font-mono text-[11px] font-extrabold tracking-[3px]">{t("kicker")}</span>
        </div>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px] text-indigo-800">{t("title")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{t("sub")}</p>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {modes.map(({ href, icon: Icon, title, description, accent }) => (
          <Link
            key={href}
            href={href}
            className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
            <Icon className="size-8" style={{ color: accent }} aria-hidden="true" />
            <h2 className="mt-5 text-[20px] font-extrabold text-indigo-800">{title}</h2>
            <p className="mt-2 min-h-12 text-[13px] leading-relaxed text-neutral-600">{description}</p>
            <span className="mt-6 inline-flex items-center gap-1 text-[13px] font-extrabold text-coral-700">
              {t("open")}
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
