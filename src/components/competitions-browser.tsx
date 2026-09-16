"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  COMPETITION_CATEGORIES,
  COMPETITION_GRADES,
  COMPETITION_STATUSES,
  currentScheduleStage,
  deriveCompetitionStatus,
  registrationCountdown,
  type Competition,
  type CompetitionCategory,
  type CompetitionGrade,
  type CompetitionStatus,
  type CompetitionUpdate,
} from "@/lib/competitions";
import {
  asCompetition,
  CATEGORY_BADGE_LIGHT,
  CATEGORY_LABEL_KEYS,
  formatCompetitionDate,
  STATUS_BADGE_LIGHT,
  STATUS_LABEL_KEYS,
} from "@/components/competition-meta";
import { cn } from "@/lib/utils";

export type CompetitionListItem = Pick<
  Competition,
  "slug" | "nameZh" | "category" | "organizer" | "grades" | "summary" | "tags" | "schedule"
> & {
  latest: CompetitionUpdate | null;
};

type FilterValue = string | null;

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}) {
  const t = useTranslations("competitions");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 shrink-0 text-[12px] font-extrabold text-neutral-400">{label}</span>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "rounded-md border border-neutral-200 bg-card px-3.5 py-1.5 text-[12px] font-bold text-muted-foreground transition-colors",
          value === null && "border-indigo-700 bg-indigo-700 text-white"
        )}
      >
        {t("filterAll")}
      </button>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md border border-neutral-200 bg-card px-3.5 py-1.5 text-[12px] font-bold text-muted-foreground transition-colors",
            value === option.value && "border-indigo-700 bg-indigo-700 text-white"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CompetitionCard({ item, now }: { item: CompetitionListItem; now: Date }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const competition = asCompetition(item);
  const status = deriveCompetitionStatus(competition, now);
  const stage = currentScheduleStage(competition, now);
  const countdown = registrationCountdown(competition, now);

  return (
    <Link
      href={`/competitions/${item.slug}`}
      className="block rounded-lg border border-neutral-200 bg-card p-[16px_18px] transition-shadow hover:border-indigo-300 hover:shadow-card"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant="secondary" className={cn("border text-[11px] font-bold", CATEGORY_BADGE_LIGHT[item.category])}>
          {t(CATEGORY_LABEL_KEYS[item.category])}
        </Badge>
        <span className="text-[16px] font-extrabold text-indigo-900">{item.nameZh}</span>
        <Badge variant="secondary" className={cn("ml-auto border text-[11px] font-bold", STATUS_BADGE_LIGHT[status])}>
          {t(STATUS_LABEL_KEYS[status])}
        </Badge>
      </div>
      <div className="mt-2 text-[12.5px] leading-[1.8] text-neutral-600">{item.summary}</div>

      <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 font-bold text-neutral-400">{t("organizer")}</dt>
          <dd className="text-neutral-700">{item.organizer}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-bold text-neutral-400">{t("gradesLabel")}</dt>
          <dd className="text-neutral-700">{item.grades.join(" · ")}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-bold text-neutral-400">{t("currentStage")}</dt>
          <dd className="text-neutral-700">{stage ? stage.stage : status === "finished" ? t("statusFinished") : t("scheduleEmpty")}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-bold text-neutral-400">{t("registrationDeadline")}</dt>
          <dd>
            {countdown ? (
              <span className="font-extrabold text-coral-700">
                {formatCompetitionDate(countdown.stage.end as string, locale)}
                {" · "}
                {countdown.daysLeft === 0 ? t("deadlineToday") : t("daysLeft", { count: countdown.daysLeft })}
              </span>
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </dd>
        </div>
      </dl>

      {item.latest && (
        <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-2.5 text-[12px] text-neutral-500">
          <Megaphone aria-hidden="true" className="size-3.5 shrink-0 text-coral-700" />
          <span className="shrink-0 font-bold text-neutral-400">{t("latestUpdate")}</span>
          <span className="shrink-0 font-mono text-[11px] text-neutral-400">{item.latest.date}</span>
          <span className="truncate">{item.latest.title}</span>
        </div>
      )}
      {item.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-sm border border-indigo-100 bg-indigo-50 px-2.5 py-[3px] text-[11px] text-indigo-800">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export function CompetitionsBrowser({ items }: { items: CompetitionListItem[] }) {
  const t = useTranslations("competitions");
  const [category, setCategory] = useState<FilterValue>(null);
  const [grade, setGrade] = useState<FilterValue>(null);
  const [status, setStatus] = useState<FilterValue>(null);
  const now = useMemo(() => new Date(), []);

  const filtered = items.filter((item) => {
    if (category && item.category !== category) return false;
    if (grade && !item.grades.includes(grade as CompetitionGrade)) return false;
    if (status && deriveCompetitionStatus(asCompetition(item), now) !== status) return false;
    return true;
  });

  return (
    <section className="w-full px-5 py-8.5 sm:px-7">
      <div className="flex flex-col gap-2.5 rounded-lg border border-neutral-200 bg-card p-3.5">
        <FilterRow
          label={t("filterCategory")}
          value={category}
          onChange={setCategory}
          options={COMPETITION_CATEGORIES.map((value: CompetitionCategory) => ({
            value,
            label: t(CATEGORY_LABEL_KEYS[value]),
          }))}
        />
        <FilterRow
          label={t("filterGrade")}
          value={grade}
          onChange={setGrade}
          options={COMPETITION_GRADES.map((value) => ({ value, label: value }))}
        />
        <FilterRow
          label={t("filterStatus")}
          value={status}
          onChange={setStatus}
          options={COMPETITION_STATUSES.map((value: CompetitionStatus) => ({
            value,
            label: t(STATUS_LABEL_KEYS[value]),
          }))}
        />
      </div>

      <div className="mt-4 text-[12px] font-bold text-neutral-400">{t("countLabel", { count: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-neutral-200 bg-card p-10 text-center text-[13px] text-neutral-500">
          {t("emptyResult")}
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {filtered.map((item) => (
            <CompetitionCard key={item.slug} item={item} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}
