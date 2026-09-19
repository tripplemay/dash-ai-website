import {
  REGISTRATION_STAGE_RE,
  type CompetitionCategory,
  type CompetitionStatus,
  type ScheduleStage,
} from "@/lib/competition-domain";

export const CATEGORY_LABEL_KEYS: Record<CompetitionCategory, string> = {
  "natural-science": "categoryNaturalScience",
  humanities: "categoryHumanities",
  "art-sports": "categoryArtSports",
};

export const STATUS_LABEL_KEYS: Record<CompetitionStatus, string> = {
  registration: "statusRegistration",
  ongoing: "statusOngoing",
  upcoming: "statusUpcoming",
  finished: "statusFinished",
  tbd: "statusTbd",
  pending: "statusPending",
};

/** 浅色背景（卡片）上的类别徽标配色 */
export const CATEGORY_BADGE_LIGHT: Record<CompetitionCategory, string> = {
  "natural-science": "border-indigo-100 bg-indigo-50 text-indigo-800",
  humanities: "border-coral-100 bg-coral-50 text-coral-700",
  "art-sports": "border-emerald-100 bg-emerald-50 text-emerald-700",
};

/** 深色背景（页头）上的类别徽标配色 */
export const CATEGORY_BADGE_DARK: Record<CompetitionCategory, string> = {
  "natural-science": "border-indigo-300/50 bg-indigo-500/20 text-indigo-200",
  humanities: "border-coral-300/60 bg-coral-500/15 text-coral-300",
  "art-sports": "border-emerald-300/50 bg-emerald-500/15 text-emerald-200",
};

export const STATUS_BADGE_LIGHT: Record<CompetitionStatus, string> = {
  registration: "border-coral-100 bg-coral-50 text-coral-700",
  ongoing: "border-indigo-100 bg-indigo-50 text-indigo-800",
  upcoming: "border-emerald-100 bg-emerald-50 text-emerald-700",
  finished: "border-neutral-200 bg-neutral-50 text-neutral-500",
  tbd: "border-neutral-200 bg-card text-neutral-400",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
};

export const STATUS_BADGE_DARK: Record<CompetitionStatus, string> = {
  registration: "border-coral-300/60 bg-coral-500/15 text-coral-300",
  ongoing: "border-white/20 bg-white/10 text-white",
  upcoming: "border-indigo-300/50 bg-indigo-500/20 text-indigo-200",
  finished: "border-white/15 bg-white/5 text-neutral-400",
  tbd: "border-white/15 bg-white/5 text-neutral-300",
  pending: "border-amber-300/50 bg-amber-500/15 text-amber-200",
};

export function isRegistrationStage(stage: ScheduleStage): boolean {
  return REGISTRATION_STAGE_RE.test(stage.stage);
}

export function formatCompetitionDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatStageRange(stage: ScheduleStage, locale: string): string | null {
  if (stage.start && !stage.end) return `${locale === "en" ? "From " : "开始于 "}${formatCompetitionDate(stage.start, locale)}${locale === "en" ? " (end TBD)" : "（结束时间待公布）"}`;
  if (stage.end && !stage.start) return `${locale === "en" ? "Until " : "截止至 "}${formatCompetitionDate(stage.end, locale)}${locale === "en" ? " (start TBD)" : "（开始时间待公布）"}`;
  const start = stage.start ?? stage.end;
  const end = stage.end ?? stage.start;
  if (!start || !end) return null;
  if (start === end) return formatCompetitionDate(start, locale);
  return `${formatCompetitionDate(start, locale)} – ${formatCompetitionDate(end, locale)}`;
}

export const GRADE_LABEL_KEYS = { 小学: "gradePrimary", 初中: "gradeMiddle", 高中: "gradeHigh", 中专: "gradeTechnical", 职高: "gradeVocational" } as const;
