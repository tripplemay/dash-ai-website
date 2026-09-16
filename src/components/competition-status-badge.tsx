"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  deriveCompetitionStatus,
  registrationCountdown,
  type ScheduleStage,
} from "@/lib/competitions";
import {
  asCompetition,
  formatCompetitionDate,
  STATUS_BADGE_DARK,
  STATUS_LABEL_KEYS,
} from "@/components/competition-meta";
import { cn } from "@/lib/utils";

export function CompetitionStatusBadge({ schedule }: { schedule: ScheduleStage[] }) {
  const t = useTranslations("competitions");
  const locale = useLocale();
  const now = useMemo(() => new Date(), []);
  const competition = asCompetition({ schedule });
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
          {formatCompetitionDate(countdown.stage.end as string, locale)}
          {" · "}
          {countdown.daysLeft === 0 ? t("deadlineToday") : t("daysLeft", { count: countdown.daysLeft })}
        </span>
      )}
    </>
  );
}
