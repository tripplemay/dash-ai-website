"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  deriveCompetitionStatus,
  registrationCountdown,
  type ScheduleStage,
} from "@/lib/competition-domain";
import {
  formatCompetitionDate,
  STATUS_BADGE_DARK,
  STATUS_LABEL_KEYS,
} from "@/components/competition-meta";
import { useCompetitionToday } from "@/components/use-competition-today";
import { cn } from "@/lib/utils";

export function CompetitionStatusBadge({ schedule, initialToday }: { schedule: ScheduleStage[]; initialToday: string }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const now = useCompetitionToday(initialToday);
  const competition = { schedule };
  const status = deriveCompetitionStatus(competition, now);
  const countdown = registrationCountdown(competition, now);

  return (
    <>
      <Badge variant="secondary" className={cn("rounded-md border text-[12px] font-bold", STATUS_BADGE_DARK[status])}>
        {t(STATUS_LABEL_KEYS[status])}
      </Badge>
      {countdown && (
        <span className="rounded-md bg-white/10 px-3 py-1 text-[12.5px] font-extrabold text-coral-300">
          {t("registrationDeadline")}
          {" · "}
          {formatCompetitionDate(countdown.deadline, locale)}
          {" · "}
          {countdown.daysLeft === 0 ? t("deadlineToday") : t("daysLeft", { count: countdown.daysLeft })}
        </span>
      )}
    </>
  );
}
