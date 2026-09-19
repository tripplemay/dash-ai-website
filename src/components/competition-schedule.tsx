"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { currentScheduleStage, nextScheduleStage, type ScheduleStage } from "@/lib/competition-domain";
import { formatStageRange } from "@/components/competition-meta";
import { useCompetitionToday } from "@/components/use-competition-today";
import { cn } from "@/lib/utils";

export function CompetitionSchedule({ schedule, initialToday }: { schedule: ScheduleStage[]; initialToday: string }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const now = useCompetitionToday(initialToday);
  const current = currentScheduleStage({ schedule }, now);
  const next = nextScheduleStage({ schedule }, now);

  return (
    <ol className="mt-6">
      {schedule.map((stage, index) => {
        const isCurrent = current === stage;
        const range = formatStageRange(stage, locale);
        return (
          <li key={`${stage.stage}-${index}`} className="relative flex gap-3.5 pb-6 last:pb-0">
            {index < schedule.length - 1 && (
              <span aria-hidden="true" className="absolute top-4 bottom-0 left-[6px] w-px bg-neutral-200" />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2",
                isCurrent ? "border-coral-500 bg-coral-500" : "border-indigo-200 bg-white"
              )}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-[14px] font-extrabold", isCurrent ? "text-coral-700" : "text-indigo-900")}>
                  {stage.stage}
                </span>
                {(isCurrent || (!current && next === stage)) && (
                  <Badge variant="secondary" className="border border-coral-100 bg-coral-50 text-[11px] font-bold text-coral-700">
                    {t(isCurrent ? "currentStage" : "nextStage")}
                  </Badge>
                )}
              </div>
              <div className="mt-1 text-[12.5px] text-neutral-600">{range ?? t("scheduleEmpty")}</div>
              {stage.note && <div className="mt-1 text-[13px] leading-6 text-neutral-600">{stage.note}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
