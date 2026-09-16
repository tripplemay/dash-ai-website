import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { Link } from "@/i18n/navigation";
import { buildCompetitionCalendar, type ScheduleStage } from "@/lib/competitions";
import { formatCompetitionDate, isRegistrationStage } from "@/components/competition-meta";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "competitions" });
  return { title: t("calendarTitle") };
}

function formatMonthTitle(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (locale === "en") {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date(year, month - 1, 1));
  }
  return `${year} 年 ${month} 月`;
}

function formatRange(stage: ScheduleStage, locale: string): string | null {
  const start = stage.start ?? stage.end;
  const end = stage.end ?? stage.start;
  if (!start || !end) return null;
  if (start === end) return formatCompetitionDate(start, locale);
  return `${formatCompetitionDate(start, locale)} – ${formatCompetitionDate(end, locale)}`;
}

export default async function CompetitionCalendarPage() {
  const t = await getTranslations("competitions");
  const locale = await getLocale();
  const calendar = buildCompetitionCalendar();

  return (
    <>
      <AppPageHero>
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-wider text-neutral-300 transition-colors hover:text-coral-300"
        >
          <ArrowLeft className="size-3.5" />
          {t("listEntry")}
        </Link>
        <div className="mt-4 font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("eyebrow")}</div>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px]">{t("calendarTitle")}</h1>
        <div className="mt-2 max-w-[720px] text-[13.5px] leading-6 tracking-wide text-neutral-300">{t("calendarSubtitle")}</div>
      </AppPageHero>

      <section className="w-full px-5 py-10 sm:px-7">
        {calendar.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-card p-10 text-center text-[13px] text-neutral-500">
            {t("calendarEmpty")}
          </div>
        ) : (
          calendar.map(([month, entries]) => (
            <section key={month} className="mt-9 first:mt-0">
              <h2 className="flex items-baseline gap-2.5 text-[20px] font-extrabold tracking-[1px] text-indigo-900">
                {formatMonthTitle(month, locale)}
                <span className="text-[12px] font-bold text-neutral-400">{entries.length}</span>
              </h2>
              <ol className="mt-3 space-y-2">
                {entries.map(({ competition, stage }) => (
                  <li
                    key={`${competition.slug}-${stage.stage}-${stage.start ?? stage.end ?? ""}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-card px-4 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        isRegistrationStage(stage) ? "bg-coral-500" : "bg-indigo-500"
                      )}
                    />
                    <span className="shrink-0 font-mono text-[12px] font-bold text-neutral-500">
                      {formatRange(stage, locale) ?? t("scheduleEmpty")}
                    </span>
                    <Link
                      href={`/competitions/${competition.slug}`}
                      className="text-[14px] font-extrabold text-indigo-800 transition-colors hover:text-coral-700"
                    >
                      {competition.nameZh}
                    </Link>
                    <span className="ml-auto text-[12px] font-bold text-neutral-500">{stage.stage}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
      </section>
    </>
  );
}
