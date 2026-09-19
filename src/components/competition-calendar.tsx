"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buildCompetitionCalendar, type Competition } from "@/lib/competition-domain";
import { formatCompetitionDate, formatStageRange, isRegistrationStage } from "@/components/competition-meta";
import { useCompetitionToday } from "@/components/use-competition-today";
import { useCompetitionTracking } from "@/components/competition-tracking-provider";
import { CompetitionCalendarExport, CompetitionRemindersLink } from "@/components/competition-follow-controls";

export type CalendarCompetition = Pick<Competition, "slug" | "nameZh" | "nameEn" | "schedule">;

export function CompetitionCalendar({ items, initialToday }: { items: CalendarCompetition[]; initialToday: string }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const today = useCompetitionToday(initialToday);
  const params = useSearchParams();
  const tracking = useCompetitionTracking();
  const onlyFollowing = params.get("following") === "1";
  const followed = new Set(tracking.follows.map((item) => item.slug));
  const requested = params.get("month") ?? "";
  const month = /^(20\d{2})-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const calendar = buildCompetitionCalendar(onlyFollowing ? items.filter((item) => followed.has(item.slug)) : items);
  const entries = calendar.find(([key]) => key === month)?.[1] ?? [];
  const months = [...new Set([month, today.slice(0, 7), ...calendar.map(([key]) => key)])].sort();
  const monthLabel = (key: string) => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(key + "-01T00:00:00Z"));
  const buttonClass = "min-h-11 rounded-md border border-neutral-200 bg-card px-3 text-sm font-bold text-indigo-800 hover:border-indigo-400";

  function selectMonth(value: string) {
    const query = new URLSearchParams();
    if (onlyFollowing) query.set("following", "1");
    if (value !== today.slice(0, 7)) query.set("month", value);
    window.history.pushState(null, "", window.location.pathname + (query.size ? "?" + query : ""));
  }
  function shiftMonth(delta: number) {
    const date = new Date(month + "-01T00:00:00Z");
    date.setUTCMonth(date.getUTCMonth() + delta);
    selectMonth(date.toISOString().slice(0, 7));
  }

  return (
    <section className="min-w-0 px-5 py-6 sm:px-7">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-indigo-800">
          <input type="checkbox" checked={onlyFollowing} disabled={!tracking.available} className="size-4 accent-indigo-700" onChange={(event) => {
            const query = new URLSearchParams();
            if (month !== today.slice(0, 7)) query.set("month", month);
            if (event.target.checked) query.set("following", "1");
            window.history.pushState(null, "", window.location.pathname + (query.size ? "?" + query : ""));
          }} />{t("onlyFollowing", { count: tracking.follows.length })}
        </label>
        <CompetitionRemindersLink />
        <CompetitionCalendarExport key={onlyFollowing ? "followed" : "all"} scope={onlyFollowing ? "followed" : "all"} />
      </div>
      <p className="mb-4 text-xs leading-6 text-neutral-600">{t(onlyFollowing ? "exportScopeFollowing" : "exportScopeAll")} {t("exportNote")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shiftMonth(-1)} className={buttonClass}>{t("previousMonth")}</button>
        <label htmlFor="calendar-month" className="sr-only">{t("selectMonth")}</label>
        <select id="calendar-month" value={month} onChange={(event) => selectMonth(event.target.value)} className={buttonClass}>
          {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
        </select>
        <button type="button" onClick={() => shiftMonth(1)} className={buttonClass}>{t("nextMonth")}</button>
        <button type="button" onClick={() => selectMonth(today.slice(0, 7))} className={buttonClass}>{t("thisMonth")}</button>
      </div>
      <h2 className="mt-6 text-xl font-extrabold text-indigo-900">{monthLabel(month)}</h2>
      <p role="status" className="mt-2 text-sm text-neutral-600">{t("calendarCount", { count: entries.length })} · {t("timeZoneNote")}</p>
      {!entries.length ? <p className="mt-5 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-600">{t("calendarEmpty")}</p> : (
        <ol className="mt-4 grid min-w-0 grid-cols-1 gap-3">
          {entries.map(({ competition, stage, kind, sortDate, id }) => (
            <li key={id} className="min-w-0 rounded-xl border border-neutral-200 bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className={isRegistrationStage(stage) ? "font-bold text-coral-700" : "font-bold text-indigo-700"}>
                  {t(kind === "end" ? "calendarEnd" : kind === "start" ? "calendarStart" : kind === "continues" ? "calendarContinues" : "calendarEvent")}
                </span>
                {kind !== "continues" && <time dateTime={sortDate} className="text-neutral-600">{formatCompetitionDate(sortDate, locale)}</time>}
              </div>
              <h3 className="mt-2 text-base leading-7 font-extrabold text-indigo-900">
                <Link href={`/competitions/${competition.slug}`} className="hover:text-coral-700">{locale === "en" && competition.nameEn ? competition.nameEn : competition.nameZh}</Link>
              </h3>
              <p className="mt-1 text-sm text-neutral-700">{stage.stage}</p>
              {kind === "continues" && <p className="mt-1 text-xs leading-6 text-neutral-600">{formatStageRange(stage, locale)}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
