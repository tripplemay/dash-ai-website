// Pure domain logic: no content archive or server dependencies.
export type CompetitionCategory = "natural-science" | "humanities" | "art-sports";

export type CompetitionGrade = "小学" | "初中" | "高中" | "中专" | "职高";

export type CompetitionUpdateSource = "official" | "moe" | "media";

export interface ScheduleStage {
  stage: string;
  start: string | null;
  end: string | null;
  note?: string;
  completed?: boolean;
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


export const COMPETITION_CATEGORIES: CompetitionCategory[] = ["natural-science", "humanities", "art-sports"];
export const COMPETITION_GRADES: CompetitionGrade[] = ["小学", "初中", "高中", "中专", "职高"];
export type CompetitionStatus = "tbd" | "upcoming" | "registration" | "ongoing" | "pending" | "finished";
export const COMPETITION_STATUSES: CompetitionStatus[] = ["registration", "ongoing", "upcoming", "pending", "tbd", "finished"];
export const REGISTRATION_STAGE_RE = /报名|申报|注册|征稿|征集|提交/;
export const COMPETITION_TIME_ZONE = "Asia/Shanghai";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMPETITION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
export type CompetitionNow = Date | string;
type Scheduled = Pick<Competition, "schedule">;

export function competitionDateKey(now: CompetitionNow = new Date()): string {
  return typeof now === "string" ? now : dateFormatter.format(now);
}

export type StageState = "active" | "upcoming" | "finished" | "unknown";

export function scheduleStageState(stage: ScheduleStage, now: CompetitionNow): StageState {
  const today = competitionDateKey(now);
  if (stage.completed || (stage.end && stage.end < today)) return "finished";
  if (stage.start && stage.start > today) return "upcoming";
  if (stage.start && stage.end && stage.start <= today && today <= stage.end) return "active";
  // A single boundary does not prove that participation is currently open.
  return "unknown";
}

export function deriveCompetitionStatus(competition: Scheduled, now: CompetitionNow = new Date()): CompetitionStatus {
  const today = competitionDateKey(now);
  if (!competition.schedule.length) return "tbd";
  const active = competition.schedule.filter((stage) => scheduleStageState(stage, today) === "active");
  if (active.some((stage) => REGISTRATION_STAGE_RE.test(stage.stage))) return "registration";
  if (active.length) return "ongoing";
  if (competition.schedule.every((stage) => scheduleStageState(stage, today) === "finished")) return "finished";
  if (competition.schedule.some((stage) => scheduleStageState(stage, today) === "finished" || (stage.start && stage.start <= today))) return "pending";
  return competition.schedule.some((stage) => scheduleStageState(stage, today) === "upcoming") ? "upcoming" : "tbd";
}

export function currentScheduleStage(competition: Scheduled, now: CompetitionNow = new Date()): ScheduleStage | null {
  const active = competition.schedule.filter((stage) => scheduleStageState(stage, now) === "active");
  return active.find((stage) => REGISTRATION_STAGE_RE.test(stage.stage)) ?? active[0] ?? null;
}

export function nextScheduleStage(competition: Scheduled, now: CompetitionNow = new Date()): ScheduleStage | null {
  return competition.schedule.filter((stage) => scheduleStageState(stage, now) === "upcoming")
    .sort((a, b) => a.start!.localeCompare(b.start!))[0] ?? null;
}

export function registrationCountdown(
  competition: Scheduled, now: CompetitionNow = new Date()
): { stage: ScheduleStage; deadline: string; daysLeft: number } | null {
  const today = competitionDateKey(now);
  const stage = competition.schedule
    .filter((item) => !item.completed && REGISTRATION_STAGE_RE.test(item.stage) && item.end && item.end >= today)
    .sort((a, b) => a.end!.localeCompare(b.end!))[0];
  if (!stage?.end) return null;
  const daysLeft = Math.round((Date.parse(stage.end + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
  return { stage, deadline: stage.end, daysLeft };
}

export function latestUpdate(competition: Pick<Competition, "updates">): CompetitionUpdate | null {
  return [...competition.updates].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export interface CalendarEntry<T> {
  competition: T;
  stage: ScheduleStage;
  sortDate: string;
  kind: "start" | "end" | "continues" | "event";
  id: string;
}

export function buildCompetitionCalendar<T extends Scheduled & { slug: string }>(items: T[]): Array<[string, CalendarEntry<T>[]]> {
  const entries: CalendarEntry<T>[] = [];
  for (const competition of items) {
    for (const [index, stage] of competition.schedule.entries()) {
      const add = (sortDate: string, kind: CalendarEntry<T>["kind"]) =>
        entries.push({ competition, stage, sortDate, kind, id: [competition.slug, index, kind, sortDate].join("-") });
      if (stage.start === stage.end && stage.start) add(stage.start, "event");
      else {
        if (stage.start) add(stage.start, "start");
        if (stage.end) add(stage.end, "end");
        if (stage.start && stage.end) {
          const cursor = new Date(stage.start.slice(0, 7) + "-01T00:00:00Z");
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
          while (cursor.toISOString().slice(0, 10) < stage.end) {
            add(cursor.toISOString().slice(0, 10), "continues");
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
          }
        }
      }
    }
  }
  entries.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  const byMonth = new Map<string, CalendarEntry<T>[]>();
  for (const entry of entries) {
    const month = entry.sortDate.slice(0, 7);
    const bucket = byMonth.get(month) ?? [];
    bucket.push(entry);
    byMonth.set(month, bucket);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export type CompetitionListItem = Pick<Competition, "slug" | "nameZh" | "nameEn" | "category" | "organizer" | "grades" | "summary" | "tags" | "schedule" | "moeListIndex"> & { latest: CompetitionUpdate | null };
export const COMPETITION_SORTS = ["recommended", "deadline", "updated", "official"] as const;
export type CompetitionSort = typeof COMPETITION_SORTS[number];
export const COMPETITION_PAGE_SIZE = 12;

export function readCompetitionQuery(params: Pick<URLSearchParams, "get">) {
  const member = <T extends string>(key: string, values: readonly T[]): T | null => {
    const value = params.get(key);
    return values.find((item) => item === value) ?? null;
  };
  const limit = Number(params.get("limit"));
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    category: member("category", COMPETITION_CATEGORIES),
    grade: member("grade", COMPETITION_GRADES),
    status: member("status", COMPETITION_STATUSES),
    sort: member("sort", COMPETITION_SORTS) ?? "recommended",
    limit: Number.isInteger(limit) && limit >= COMPETITION_PAGE_SIZE && limit <= 120 ? limit : COMPETITION_PAGE_SIZE,
  };
}

export function competitionQueryString(params: Pick<URLSearchParams, "get">): string {
  const query = readCompetitionQuery(params);
  const result = new URLSearchParams();
  for (const key of ["q", "category", "grade", "status"] as const) if (query[key]) result.set(key, query[key]!);
  if (query.sort !== "recommended") result.set("sort", query.sort);
  if (query.limit !== COMPETITION_PAGE_SIZE) result.set("limit", String(query.limit));
  return result.toString();
}

export function selectCompetitions(items: CompetitionListItem[], query: ReturnType<typeof readCompetitionQuery>, today: string): CompetitionListItem[] {
  const words = query.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const statusOrder: Record<CompetitionStatus, number> = { registration: 0, upcoming: 1, ongoing: 2, pending: 3, tbd: 4, finished: 5 };
  const candidates = items.filter((item) => {
    if (query.category && item.category !== query.category) return false;
    if (query.grade && !item.grades.includes(query.grade)) return false;
    if (query.status && deriveCompetitionStatus(item, today) !== query.status) return false;
    const haystack = [item.slug, item.nameZh, item.nameEn, item.organizer, ...item.tags].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  return candidates.sort((a, b) => {
    const deadline = () => (registrationCountdown(a, today)?.deadline ?? "9999").localeCompare(registrationCountdown(b, today)?.deadline ?? "9999");
    let order = 0;
    if (query.sort === "recommended") order = statusOrder[deriveCompetitionStatus(a, today)] - statusOrder[deriveCompetitionStatus(b, today)] || deadline();
    if (query.sort === "deadline") order = deadline();
    if (query.sort === "updated") order = (b.latest?.date ?? "").localeCompare(a.latest?.date ?? "");
    return order || a.moeListIndex - b.moeListIndex;
  });
}
