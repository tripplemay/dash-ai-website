import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, MonitorPlay, Presentation } from "lucide-react";
import { getPageMetadata } from "@/lib/page-metadata";

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
      accent: "#5E9BFF",
    },
    {
      href: "/presentations/course",
      icon: Presentation,
      title: t("courseTitle"),
      description: t("courseDesc"),
      accent: "#FF7A45",
    },
  ];

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 sm:px-7 lg:py-12">
      <div className="max-w-[680px]">
        <div className="text-[11px] font-extrabold tracking-[3px] text-cyan-print">DASH AI</div>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px] text-navy">{t("title")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-subtext">{t("sub")}</p>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {modes.map(({ href, icon: Icon, title, description, accent }) => (
          <Link
            key={href}
            href={href}
            className="group relative overflow-hidden rounded-[14px] border border-[#E4EAF7] bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
            <Icon className="size-8" style={{ color: accent }} aria-hidden="true" />
            <h2 className="mt-5 text-[20px] font-extrabold text-navy">{title}</h2>
            <p className="mt-2 min-h-12 text-[13px] leading-relaxed text-subtext">{description}</p>
            <span className="mt-6 inline-flex items-center gap-1 text-[13px] font-extrabold text-cyan-print">
              {t("open")}
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
