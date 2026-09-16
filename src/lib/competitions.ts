// 赛事频道数据源：scripts/competitions-content.json（由 competition-merge.mjs 合并生成，
// 唯一上游是 scripts/competitions/registry.json + scripts/competitions/content/*.json）。
// 此处做带类型的 re-export 与状态推导，供赛事频道页面引用。

import raw from "../../scripts/competitions-content.json";

export type CompetitionCategory = "natural-science" | "humanities" | "art-sports";

export type CompetitionGrade = "小学" | "初中" | "高中" | "中专" | "职高";

export type CompetitionUpdateSource = "official" | "moe" | "media";

export interface ScheduleStage {
  stage: string;
  start: string | null;
  end: string | null;
  note?: string;
}

export interface CompetitionUpdate {
  date: string;
  title: string;
  url?: string | null;
  summary?: string;
  source: CompetitionUpdateSource;
}

export interface CompetitionLink {
  label: string;
  url: string;
}

export interface Competition {
  slug: string;
  nameZh: string;
  nameEn?: string;
  category: CompetitionCategory;
  organizer: string;
  grades: CompetitionGrade[];
  officialSite: string | null;
  newsPages?: string[];
  moeListIndex: number;
  summary: string;
  description: string;
  schedule: ScheduleStage[];
  updates: CompetitionUpdate[];
  links: CompetitionLink[];
  tags: string[];
  relatedCourses: string[];
  sourceCheckedAt: string;
}

export interface MoeListMeta {
  name: string;
  announcementUrl: string;
  publishedAt: string;
  totalCount: number;
}

interface CompetitionsContent {
  generatedAt: string;
  moeList: MoeListMeta;
  competitions: Competition[];
}

const content = raw as CompetitionsContent;

export const MOE_LIST: MoeListMeta = content.moeList;
export const COMPETITIONS: Competition[] = content.competitions;
export const COMPETITIONS_GENERATED_AT = content.generatedAt;

const COMPETITION_MAP = new Map(COMPETITIONS.map((item) => [item.slug, item]));

export function getCompetition(slug: string): Competition | undefined {
  return COMPETITION_MAP.get(slug);
}

export const COMPETITION_CATEGORIES: CompetitionCategory[] = ["natural-science", "humanities", "art-sports"];

export const COMPETITION_GRADES: CompetitionGrade[] = ["小学", "初中", "高中", "中专", "职高"];

/** 赛事进行状态：tbd=待公布 upcoming=未开始 registration=报名中 ongoing=比赛进行中 finished=已结束 */
export type CompetitionStatus = "tbd" | "upcoming" | "registration" | "ongoing" | "finished";

export const COMPETITION_STATUSES: CompetitionStatus[] = ["registration", "ongoing", "upcoming", "finished", "tbd"];

/** 报名/征稿/答题等"当前可参与"阶段名匹配 */
export const REGISTRATION_STAGE_RE = /报名|申报|注册|征稿|征集|答题|提交/;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stageStart(stage: ScheduleStage): string | null {
  return stage.start ?? stage.end;
}

function stageEnd(stage: ScheduleStage): string | null {
  return stage.end ?? stage.start;
}

function isActiveStage(stage: ScheduleStage, today: string): boolean {
  const start = stageStart(stage);
  const end = stageEnd(stage);
  if (!start || !end) return false;
  return start <= today && today <= end;
}

/** 按当天日期推导赛事状态；页面渲染时调用，保证不随构建产物过期 */
export function deriveCompetitionStatus(competition: Competition, now: Date = new Date()): CompetitionStatus {
  const today = toDateKey(now);
  const dated = competition.schedule.filter((stage) => stageStart(stage) && stageEnd(stage));
  if (dated.length === 0) return "tbd";

  const active = dated.filter((stage) => isActiveStage(stage, today));
  if (active.some((stage) => REGISTRATION_STAGE_RE.test(stage.stage))) return "registration";
  if (active.length > 0) return "ongoing";

  const allPast = dated.every((stage) => (stageEnd(stage) as string) < today);
  return allPast ? "finished" : "upcoming";
}

/** 当前正处于的阶段；若不在任何阶段窗口内，返回下一个即将开始的阶段 */
export function currentScheduleStage(competition: Competition, now: Date = new Date()): ScheduleStage | null {
  const today = toDateKey(now);
  const dated = competition.schedule
    .filter((stage) => stageStart(stage) && stageEnd(stage))
    .sort((a, b) => (stageStart(a) as string).localeCompare(stageStart(b) as string));
  if (dated.length === 0) return null;

  const active = dated.find((stage) => isActiveStage(stage, today));
  if (active) return active;
  return dated.find((stage) => (stageEnd(stage) as string) >= today) ?? null;
}

/** 报名截止倒计时：当前或未来的报名类阶段中最近一个的剩余天数 */
export function registrationCountdown(
  competition: Competition,
  now: Date = new Date()
): { stage: ScheduleStage; daysLeft: number } | null {
  const today = toDateKey(now);
  const registrationStages = competition.schedule
    .filter((stage) => REGISTRATION_STAGE_RE.test(stage.stage) && stageEnd(stage) && (stageEnd(stage) as string) >= today)
    .sort((a, b) => (stageEnd(a) as string).localeCompare(stageEnd(b) as string));
  const nearest = registrationStages[0];
  if (!nearest) return null;

  const end = new Date(`${stageEnd(nearest) as string}T00:00:00`);
  const todayStart = new Date(`${today}T00:00:00`);
  const daysLeft = Math.round((end.getTime() - todayStart.getTime()) / 86_400_000);
  return { stage: nearest, daysLeft };
}

/** 最近一条动态（按日期倒序的第一条） */
export function latestUpdate(competition: Competition): CompetitionUpdate | null {
  if (competition.updates.length === 0) return null;
  return [...competition.updates].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export interface CompetitionFilter {
  category?: CompetitionCategory;
  grade?: CompetitionGrade;
  status?: CompetitionStatus;
  now?: Date;
}

export function filterCompetitions(filter: CompetitionFilter): Competition[] {
  const now = filter.now ?? new Date();
  return COMPETITIONS.filter((competition) => {
    if (filter.category && competition.category !== filter.category) return false;
    if (filter.grade && !competition.grades.includes(filter.grade)) return false;
    if (filter.status && deriveCompetitionStatus(competition, now) !== filter.status) return false;
    return true;
  });
}

export interface CalendarEntry {
  competition: Competition;
  stage: ScheduleStage;
  /** 排序用日期：阶段开始日（无开始日则用截止日） */
  sortDate: string;
}

/** 日历视图：全部赛事的赛程节点按月分组（键为 YYYY-MM），月份按时间升序 */
export function buildCompetitionCalendar(now: Date = new Date()): Array<[string, CalendarEntry[]]> {
  const today = toDateKey(now);
  const entries: CalendarEntry[] = [];
  for (const competition of COMPETITIONS) {
    for (const stage of competition.schedule) {
      const sortDate = stageStart(stage);
      if (!sortDate) continue;
      entries.push({ competition, stage, sortDate });
    }
  }
  entries.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const byMonth = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const month = entry.sortDate.slice(0, 7);
    const bucket = byMonth.get(month) ?? [];
    bucket.push(entry);
    byMonth.set(month, bucket);
  }
  // 未来月份按时间升序排在前面，历史月份按时间倒序排在后面
  const currentMonth = today.slice(0, 7);
  return [...byMonth.entries()].sort(([a], [b]) => {
    const aPast = a < currentMonth;
    const bPast = b < currentMonth;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? b.localeCompare(a) : a.localeCompare(b);
  });
}
