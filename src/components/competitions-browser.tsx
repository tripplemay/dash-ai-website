"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  COMPETITION_CATEGORIES, COMPETITION_GRADES, COMPETITION_STATUSES, COMPETITION_PAGE_SIZE,
  competitionQueryString, currentScheduleStage, nextScheduleStage, deriveCompetitionStatus,
  registrationCountdown, readCompetitionQuery, selectCompetitions, type CompetitionListItem,
} from "@/lib/competition-domain";
import {
  CATEGORY_BADGE_LIGHT, CATEGORY_LABEL_KEYS, GRADE_LABEL_KEYS, formatCompetitionDate,
  STATUS_BADGE_LIGHT, STATUS_LABEL_KEYS,
} from "@/components/competition-meta";
import { useCompetitionToday } from "@/components/use-competition-today";
import { cn } from "@/lib/utils";

const controlClass = "min-h-11 rounded-md border border-neutral-200 bg-card px-3 py-2 text-[13px] font-bold text-neutral-700 transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

function FilterRow({ label, options, value, onChange }: {
  label: string; options: Array<{ value: string; label: string }>;
  value: string | null; onChange: (value: string | null) => void;
}) {
  const t = useTranslations("competitions");
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="w-full text-[13px] font-bold text-neutral-600 sm:w-12 sm:shrink-0">{label}</span>
        {[{ value: null, label: t("filterAll") }, ...options].map((option) => (
          <button key={option.value ?? "all"} type="button" aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(controlClass, value === option.value && "border-indigo-700 bg-indigo-700 text-white hover:border-indigo-700")}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CompetitionCard({ item, today, from }: { item: CompetitionListItem; today: string; from: string }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const status = deriveCompetitionStatus(item, today);
  const current = currentScheduleStage(item, today);
  const stage = current ?? nextScheduleStage(item, today);
  const countdown = registrationCountdown(item, today);
  const name = locale === "en" && item.nameEn ? item.nameEn : item.nameZh;
  const href = `/competitions/${item.slug}?${new URLSearchParams({ from })}`;

  return (
    <article id={`competition-${item.slug}`} className="min-w-0 scroll-mt-24 rounded-xl border border-neutral-200 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={cn("border text-xs", CATEGORY_BADGE_LIGHT[item.category])}>{t(CATEGORY_LABEL_KEYS[item.category])}</Badge>
        <Badge variant="secondary" className={cn("ml-auto border text-xs", STATUS_BADGE_LIGHT[status])}>{t(STATUS_LABEL_KEYS[status])}</Badge>
      </div>
      <h2 className="mt-3 text-base leading-7 font-extrabold text-indigo-900 sm:text-lg">
        <Link href={href} className="rounded-sm hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-indigo-600">{name}</Link>
      </h2>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-neutral-600">{item.summary}</p>
      <dl className="mt-3 grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
        <div className="flex min-w-0 gap-2">
          <dt className="shrink-0 font-bold text-neutral-600">{t("gradesLabel")}</dt>
          <dd>{item.grades.map((grade) => t(GRADE_LABEL_KEYS[grade])).join(" · ")}</dd>
        </div>
        <div className="flex min-w-0 gap-2">
          <dt className="shrink-0 font-bold text-neutral-600">{t(current ? "currentStage" : "nextStage")}</dt>
          <dd>{stage?.stage ?? (status === "finished" ? t("statusFinished") : t("scheduleUnconfirmed"))}</dd>
        </div>
        {countdown && (
          <div className="flex min-w-0 flex-wrap gap-x-2 sm:col-span-2">
            <dt className="font-bold text-neutral-600">{t("registrationDeadline")}</dt>
            <dd className="font-bold text-coral-700">
              {formatCompetitionDate(countdown.deadline, locale)} · {countdown.daysLeft === 0 ? t("deadlineToday") : t("daysLeft", { count: countdown.daysLeft })}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
        {item.tags.map((tag) => <span key={tag} className="rounded bg-indigo-50 px-2 py-1 text-indigo-800">{tag}</span>)}
        {item.latest && <span className="min-w-0 flex-1 truncate text-right" title={item.latest.title}>{t("latestUpdate")} {item.latest.date}</span>}
      </div>
    </article>
  );
}

export function CompetitionsBrowser({ items, initialToday }: { items: CompetitionListItem[]; initialToday: string }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const params = useSearchParams();
  const query = readCompetitionQuery(params);
  const from = competitionQueryString(params);
  const today = useCompetitionToday(initialToday);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = selectCompetitions(items, query, today);
  const hasFilters = Boolean(query.q || query.category || query.grade || query.status);
  const chips = [
    query.category && { key: "category", label: t(CATEGORY_LABEL_KEYS[query.category]) },
    query.grade && { key: "grade", label: t(GRADE_LABEL_KEYS[query.grade]) },
    query.status && { key: "status", label: t(STATUS_LABEL_KEYS[query.status]) },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  function update(key: string, value: string | null, replace = false) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "limit") next.delete("limit");
    const search = competitionQueryString(next);
    window.history[replace ? "replaceState" : "pushState"](null, "", window.location.pathname + (search ? "?" + search : ""));
  }

  function clearFilters() {
    window.history.pushState(null, "", window.location.pathname);
  }

  return (
    <section className="w-full min-w-0 px-5 py-5 sm:px-7 sm:py-7">
      <div className="rounded-xl border border-neutral-200 bg-card p-3.5 sm:p-5">
        <div className="flex min-w-0 flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <label htmlFor="competition-search" className="sr-only">{t("searchLabel")}</label>
            <Search aria-hidden="true" className="absolute top-3.5 left-3 size-4 text-neutral-500" />
            <input id="competition-search" type="search" value={query.q} maxLength={100}
              onChange={(event) => update("q", event.target.value, true)} placeholder={t("searchPlaceholder")}
              className={cn(controlClass, "w-full pr-3 pl-9 font-normal")} />
          </div>
          <button type="button" aria-expanded={filtersOpen} aria-controls="competition-filters"
            onClick={() => setFiltersOpen(!filtersOpen)} className={cn(controlClass, "inline-flex items-center gap-2 sm:hidden")}>
            <SlidersHorizontal aria-hidden="true" className="size-4" />{t("filters")}
          </button>
          <Link href="/competitions/calendar" className={cn(controlClass, "inline-flex items-center gap-2 text-indigo-800")}>
            <CalendarDays aria-hidden="true" className="size-4" />{t("calendarEntry")}
          </Link>
        </div>
        <div id="competition-filters" className={cn("mt-4 gap-4 border-t border-neutral-100 pt-4 sm:grid", filtersOpen ? "grid" : "hidden")}>
          <FilterRow label={t("filterCategory")} value={query.category} onChange={(value) => update("category", value)}
            options={COMPETITION_CATEGORIES.map((value) => ({ value, label: t(CATEGORY_LABEL_KEYS[value]) }))} />
          <FilterRow label={t("filterGrade")} value={query.grade} onChange={(value) => update("grade", value)}
            options={COMPETITION_GRADES.map((value) => ({ value, label: t(GRADE_LABEL_KEYS[value]) }))} />
          <FilterRow label={t("filterStatus")} value={query.status} onChange={(value) => update("status", value)}
            options={COMPETITION_STATUSES.map((value) => ({ value, label: t(STATUS_LABEL_KEYS[value]) }))} />
        </div>
        {(chips.length > 0 || hasFilters) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {chips.map((chip) => <button key={chip.key} type="button" onClick={() => update(chip.key, null)}
              aria-label={t("removeFilter", { label: chip.label })} className={cn(controlClass, "border-indigo-200 bg-indigo-50 text-indigo-800")}>{chip.label} ×</button>)}
            <button type="button" onClick={clearFilters} className="min-h-11 px-2 text-[13px] font-bold text-indigo-700 underline underline-offset-4">{t("clearFilters")}</button>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-[13px] font-bold text-neutral-600">{t("countLabel", { count: filtered.length })}</p>
        <div className="flex items-center gap-2">
          <label htmlFor="competition-sort" className="text-[13px] text-neutral-600">{t("sortLabel")}</label>
          <select id="competition-sort" value={query.sort} onChange={(event) => update("sort", event.target.value)} className={cn(controlClass, "max-w-48")}>
            <option value="recommended">{t("sortRecommended")}</option>
            <option value="deadline">{t("sortDeadline")}</option>
            <option value="updated">{t("sortUpdated")}</option>
            <option value="official">{t("sortOfficial")}</option>
          </select>
        </div>
      </div>
      {locale === "en" && <p className="mt-3 text-xs text-neutral-600">{t("originalLanguageNote")}</p>}
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-card p-8 text-center">
          <p className="text-sm text-neutral-600">{t("emptyResult")}</p>
          <button type="button" onClick={clearFilters} className={cn(controlClass, "mt-4 text-indigo-800")}>{t("clearFilters")}</button>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3">
          {filtered.slice(0, query.limit).map((item) => <CompetitionCard key={item.slug} item={item} today={today} from={from} />)}
        </div>
      )}
      {filtered.length > query.limit && (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => update("limit", String(query.limit + COMPETITION_PAGE_SIZE))}
            className={cn(controlClass, "px-8 text-indigo-800")}>{t("loadMore", { shown: query.limit, total: filtered.length })}</button>
        </div>
      )}
    </section>
  );
}
