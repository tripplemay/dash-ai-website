import Database from "better-sqlite3";
import path from "node:path";
import { COURSE_ENTRIES, LABS, resolveResourceCategory } from "./data";
import { LESSONS } from "./lessons";

/**
 * 应用数据库（与 Better Auth 共用文件）。数据库结构由 scripts/migrate.mjs
 * 版本化管理；请求路径只打开连接和读写，不执行 CREATE/ALTER TABLE。
 */
export const DB_PATH = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");
export const RESOURCE_PAGE_LIMIT = 48;
export const RESOURCE_ADMIN_LIMIT = 200;
export const RESOURCE_ZIP_LIMIT = 2000;
export const WORKSPACE_RECENT_RESOURCE_LIMIT = 6;
export const WORKSPACE_RECENT_COURSE_LIMIT = 4;
const CORECOORD_RELEASE = "2026.1";

export interface ResourceRow {
  id: number;
  title: string;
  title_en: string | null;
  category: string;
  category_en: string | null;
  category_key: string;
  kind: "file" | "folder";
  format: string | null;
  size: number | null;
  dimensions: string | null;
  print_advice: string | null;
  file_key: string;
  preview: string | null;
  sort: number;
  enabled: number;
  updated_at: string;
  created_at: string;
}

/** 对外 DTO 不暴露数据库时间字段命名和内部 category 存储细节。 */
export interface ResourceDTO {
  id: number;
  title: string;
  titleEn: string | null;
  category: string;
  categoryEn: string | null;
  categoryKey: string;
  kind: ResourceRow["kind"];
  format: string | null;
  size: number | null;
  dimensions: string | null;
  printAdvice: string | null;
  fileKey: string;
  preview: string | null;
  sort: number;
  enabled: boolean;
  updatedAt: string;
  createdAt: string;
}

const RESOURCE_COLUMNS = `
  id, title, title_en, category, category_en, category_key, kind, format, size, dimensions,
  print_advice, file_key, preview, sort, enabled, updated_at, created_at
`;

let _db: Database.Database | null = null;

function assertMigrated(db: Database.Database) {
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'resources'")
    .get() as { ok: number } | undefined;
  if (!table) {
    throw new Error(
      `resources table is not migrated. Run ` +
        `DASH_AUTH_DB=${DB_PATH} node scripts/migrate.mjs before serving requests.`
    );
  }
  const columns = db.prepare("PRAGMA table_info(resources)").all() as Array<{ name: string }>;
  const requiredColumns = ["category_key", "title_en", "category_en"];
  const missing = requiredColumns.filter((name) => !columns.some((column) => column.name === name));
  if (missing.length) {
    throw new Error(`resources table is missing ${missing.join(", ")}; run scripts/migrate.mjs`);
  }
}

export function getDb(): Database.Database {
  if (!_db) {
    let db: Database.Database;
    try {
      db = new Database(DB_PATH, { timeout: 30000 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Database not found at ${DB_PATH}; run scripts/seed.mjs or scripts/migrate.mjs first.`);
      }
      throw error;
    }
    try {
      db.pragma("busy_timeout = 30000");
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      assertMigrated(db);
      _db = db;
    } catch (error) {
      db.close();
      throw error;
    }
  }
  return _db;
}

/** 测试/优雅关闭时使用；正常请求不应调用。 */
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
  resourceFtsAvailable = null;
  resourceNormalizedSearchAvailable = null;
}

export interface ResourceListOptions {
  /** 旧版中文分类值或稳定 category key。 */
  category?: string;
  categoryKey?: string;
  query?: string;
  sort?: "default" | "recent" | "name";
  limit?: number;
  cursor?: string;
}

export interface ResourcePage {
  items: ResourceRow[];
  nextCursor: string | null;
}

export interface WorkspaceCatalogSnapshot {
  enabledResources: number;
  resourcesByCategory: Record<string, number>;
  labCount: number;
  coreCourseCount: number;
  totalCourseCount: number;
  coreLessonCount: number;
  totalLessonCount: number;
}

export interface WorkspaceCourseActivity {
  courseSlug: string;
  lastLesson: number;
  lastViewedAt: string;
}

export interface WorkspaceRelease {
  version: string;
  label: string;
}

export type WorkspaceResourceStatus = "ready" | "unavailable";

export interface WorkspaceSnapshot {
  catalog: WorkspaceCatalogSnapshot;
  recentResources: ResourceDTO[];
  recentCourses: WorkspaceCourseActivity[];
  release: WorkspaceRelease;
  resourceStatus: WorkspaceResourceStatus;
}

function clampLimit(value: number | undefined, fallback: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value as number)));
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

let resourceFtsAvailable: boolean | null = null;
let resourceNormalizedSearchAvailable: boolean | null = null;

function hasResourceFts(db: Database.Database) {
  if (resourceFtsAvailable !== null) return resourceFtsAvailable;
  resourceFtsAvailable = Boolean(
    (db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'resources_fts'")
      .get() as { ok?: number } | undefined)?.ok,
  );
  return resourceFtsAvailable;
}

function hasNormalizedResourceSearch(db: Database.Database) {
  if (resourceNormalizedSearchAvailable !== null) return resourceNormalizedSearchAvailable;
  resourceNormalizedSearchAvailable = (db.prepare("PRAGMA table_info(resources)").all() as Array<{ name: string }>).some(
    (column) => column.name === "normalized_search",
  );
  return resourceNormalizedSearchAvailable;
}

function toFtsQuery(value: string) {
  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.replaceAll('"', '""'))
    .filter(Boolean);
  return tokens.map((token) => `"${token}"*`).join(" AND ");
}

function encodeCursor(value: Record<string, string | number>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): Record<string, string | number> | undefined {
  if (!value || value.length > 512) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<
      string,
      string | number
    >;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function categoryFilterFor(options: ResourceListOptions) {
  const raw = options.categoryKey?.trim() || options.category?.trim();
  if (!raw || raw === "全部") return undefined;
  const resolved = resolveResourceCategory(raw);
  return resolved ? { column: "category_key", value: resolved.key } : { column: "category", value: raw };
}

/** 分页查询资源；查询和单页大小都受服务端上限约束。 */
function listEnabledResourcesPageInternal(options: ResourceListOptions = {}, maximum = RESOURCE_PAGE_LIMIT): ResourcePage {
  const limit = clampLimit(options.limit, Math.min(RESOURCE_PAGE_LIMIT, maximum), maximum);
  const where = ["enabled = 1"];
  const args: Array<string | number> = [];
  const categoryFilter = categoryFilterFor(options);
  const query = options.query?.trim().slice(0, 160);

  if (categoryFilter) {
    where.push(`${categoryFilter.column} = ?`);
    args.push(categoryFilter.value);
  }
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    const likeClause =
      "(title LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR category_en LIKE ? ESCAPE '\\' OR dimensions LIKE ? ESCAPE '\\' OR print_advice LIKE ? ESCAPE '\\')";
    const ftsQuery = toFtsQuery(query);
    if (ftsQuery && hasResourceFts(getDb())) {
      // Keep LIKE as a correctness fallback for CJK and punctuation, while
      // letting FTS5 satisfy ordinary Latin/number searches without scanning
      // every catalogue row.
      where.push(`(id IN (SELECT rowid FROM resources_fts WHERE resources_fts MATCH ?) OR ${likeClause})`);
      args.push(ftsQuery, pattern, pattern, pattern, pattern, pattern, pattern);
    } else if (hasNormalizedResourceSearch(getDb())) {
      const normalizedPattern = `%${escapeLike(query.toLowerCase())}%`;
      where.push(`(normalized_search LIKE ? ESCAPE '\\' OR ${likeClause})`);
      args.push(normalizedPattern, pattern, pattern, pattern, pattern, pattern, pattern);
    } else {
      where.push(likeClause);
      args.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }
  }

  const sort = options.sort || "default";
  const cursor = decodeCursor(options.cursor);
  if (sort === "recent") {
    if (cursor && typeof cursor.updatedAt === "string" && typeof cursor.id === "number") {
      where.push("(updated_at < ? OR (updated_at = ? AND id < ?))");
      args.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
  } else if (sort === "name") {
    if (cursor && typeof cursor.title === "string" && typeof cursor.id === "number") {
      where.push("(title COLLATE NOCASE > ? OR (title COLLATE NOCASE = ? AND id > ?))");
      args.push(cursor.title, cursor.title, cursor.id);
    }
  } else if (cursor && typeof cursor.sort === "number" && typeof cursor.id === "number") {
    where.push("(sort > ? OR (sort = ? AND id > ?))");
    args.push(cursor.sort, cursor.sort, cursor.id);
  }

  const order =
    sort === "recent"
      ? "updated_at DESC, id DESC"
      : sort === "name"
        ? "title COLLATE NOCASE ASC, id ASC"
        : "sort ASC, id ASC";
  const rows = getDb()
    .prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`)
    .all(...args, limit + 1) as ResourceRow[];
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  let nextCursor: string | null = null;
  if (rows.length > limit && last) {
    nextCursor =
      sort === "recent"
        ? encodeCursor({ updatedAt: last.updated_at, id: last.id })
        : sort === "name"
          ? encodeCursor({ title: last.title, id: last.id })
          : encodeCursor({ sort: last.sort, id: last.id });
  }
  return { items, nextCursor };
}

/** 上架资源（旧版 UI 兼容数组返回）；默认最多返回 48 条。 */
export function listEnabledResources(options: ResourceListOptions = {}): ResourceRow[] {
  return listEnabledResourcesPageInternal(options, RESOURCE_PAGE_LIMIT).items;
}

export function listEnabledResourcesPage(options: ResourceListOptions = {}): ResourcePage {
  return listEnabledResourcesPageInternal(options, RESOURCE_PAGE_LIMIT);
}

/** 管理端列表分页，避免误将全库加载到 RSC/浏览器。 */
export function listAllResourcesPage(
  options: Pick<ResourceListOptions, "limit" | "cursor" | "sort"> = {}
): ResourcePage {
  const limit = clampLimit(options.limit, RESOURCE_ADMIN_LIMIT, RESOURCE_ADMIN_LIMIT);
  const sort = options.sort === "recent" || options.sort === "name" ? options.sort : "default";
  const cursor = decodeCursor(options.cursor);
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (sort === "recent" && cursor && typeof cursor.updatedAt === "string" && typeof cursor.id === "number") {
    where.push("(updated_at < ? OR (updated_at = ? AND id < ?))");
    args.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
  } else if (sort === "name" && cursor && typeof cursor.title === "string" && typeof cursor.id === "number") {
    where.push("(title COLLATE NOCASE > ? OR (title COLLATE NOCASE = ? AND id > ?))");
    args.push(cursor.title, cursor.title, cursor.id);
  } else if (sort === "default" && cursor && typeof cursor.sort === "number" && typeof cursor.id === "number") {
    where.push("(sort > ? OR (sort = ? AND id > ?))");
    args.push(cursor.sort, cursor.sort, cursor.id);
  }
  const order = sort === "recent" ? "updated_at DESC, id DESC" : sort === "name" ? "title COLLATE NOCASE, id" : "sort, id";
  const rows = getDb()
    .prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ?`)
    .all(...args, limit + 1) as ResourceRow[];
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  let nextCursor: string | null = null;
  if (rows.length > limit && last) {
    nextCursor =
      sort === "recent"
        ? encodeCursor({ updatedAt: last.updated_at, id: last.id })
        : sort === "name"
          ? encodeCursor({ title: last.title, id: last.id })
          : encodeCursor({ sort: last.sort, id: last.id });
  }
  return { items, nextCursor };
}

/** 旧版调用兼容数组返回。 */
export function listAllResources(
  options: Pick<ResourceListOptions, "limit" | "cursor" | "sort"> = {}
): ResourceRow[] {
  return listAllResourcesPage(options).items;
}

/** 分类 ZIP 需要读取完整但有上限的资源集合，不走页面默认 48 条限制。 */
export function listEnabledResourcesForCategory(category: string, limit = RESOURCE_ZIP_LIMIT): ResourceRow[] {
  return listEnabledResourcesPageInternal(
    { category, limit: clampLimit(limit, RESOURCE_ZIP_LIMIT, RESOURCE_ZIP_LIMIT) },
    RESOURCE_ZIP_LIMIT
  ).items;
}

export function listEnabledFolderResources(limit = RESOURCE_ZIP_LIMIT): ResourceRow[] {
  const safeLimit = clampLimit(limit, RESOURCE_ZIP_LIMIT, RESOURCE_ZIP_LIMIT);
  return getDb()
    .prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources WHERE enabled = 1 AND kind = 'folder' ORDER BY sort ASC, id ASC LIMIT ?`)
    .all(safeLimit) as ResourceRow[];
}

export function getResource(id: number): ResourceRow | undefined {
  if (!Number.isSafeInteger(id) || id <= 0) return undefined;
  return getDb().prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources WHERE id = ?`).get(id) as ResourceRow | undefined;
}

export function getResourceByFileKey(fileKey: string): ResourceRow | undefined {
  return getDb().prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources WHERE file_key = ?`).get(fileKey) as ResourceRow | undefined;
}

/** 最近更新的上架资源（首页提示条用）。 */
export function listRecentResources(limit = 4): ResourceRow[] {
  const safeLimit = clampLimit(limit, 4, 12);
  return getDb()
    .prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources WHERE enabled = 1 ORDER BY updated_at DESC, id DESC LIMIT ?`)
    .all(safeLimit) as ResourceRow[];
}

const COURSE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const WORKSPACE_ACTIVITY_LIMIT = 12;
const VALID_COURSE_SLUGS = new Set(COURSE_ENTRIES.map(({ course }) => String(course.slug)));

function isValidActivityUserId(userId: string) {
  return typeof userId === "string" && userId.trim().length > 0 && userId.length <= 255;
}

export function isValidCourseSlug(value: unknown): value is string {
  return typeof value === "string" && COURSE_SLUG_PATTERN.test(value) && VALID_COURSE_SLUGS.has(value);
}

export function isValidLessonNumber(value: unknown, courseSlug?: string): value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return false;
  if (!courseSlug || !isValidCourseSlug(courseSlug)) return value <= 10000;
  return value <= (LESSONS[courseSlug as keyof typeof LESSONS]?.length ?? -1);
}

function mapCourseActivity(row: {
  course_slug: string;
  last_lesson: number;
  last_viewed_at: string;
}): WorkspaceCourseActivity {
  return {
    courseSlug: row.course_slug,
    lastLesson: row.last_lesson,
    lastViewedAt: row.last_viewed_at,
  };
}

/** Record the latest viewed lesson for one user/course pair. */
export function upsertCourseActivity(userId: string, courseSlug: string, lesson: number): WorkspaceCourseActivity {
  if (!isValidActivityUserId(userId)) throw new TypeError("invalid user id");
  if (!isValidCourseSlug(courseSlug)) throw new TypeError("invalid course slug");
  if (!isValidLessonNumber(lesson, courseSlug)) throw new TypeError("invalid lesson number");

  const db = getDb();
  db.prepare(
     `INSERT INTO workspace_course_activity (user_id, course_slug, last_lesson, last_viewed_at)
      VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, course_slug) DO UPDATE SET
       last_lesson = MAX(workspace_course_activity.last_lesson, excluded.last_lesson),
       last_viewed_at = excluded.last_viewed_at`
  ).run(userId, courseSlug, lesson);
  const row = db
    .prepare(
      `SELECT course_slug, last_lesson, last_viewed_at
       FROM workspace_course_activity
       WHERE user_id = ? AND course_slug = ?`
    )
    .get(userId, courseSlug) as { course_slug: string; last_lesson: number; last_viewed_at: string } | undefined;
  if (!row) throw new Error("course activity write could not be read back");
  return mapCourseActivity(row);
}

/** Return the most recently viewed courses for one authenticated user. */
export function listRecentCourseActivity(userId: string, limit = WORKSPACE_RECENT_COURSE_LIMIT): WorkspaceCourseActivity[] {
  if (!isValidActivityUserId(userId)) throw new TypeError("invalid user id");
  const safeLimit = clampLimit(limit, WORKSPACE_RECENT_COURSE_LIMIT, WORKSPACE_ACTIVITY_LIMIT);
  const rows = getDb()
    .prepare(
      `SELECT course_slug, last_lesson, last_viewed_at
       FROM workspace_course_activity
       WHERE user_id = ?
       ORDER BY last_viewed_at DESC, course_slug ASC
       LIMIT ?`
    )
    .all(userId, safeLimit) as Array<{ course_slug: string; last_lesson: number; last_viewed_at: string }>;
  return rows.map(mapCourseActivity);
}

/** Read one course's compatibility progress without the recent-list cap. */
export function getCourseActivity(userId: string, courseSlug: string): WorkspaceCourseActivity | undefined {
  if (!isValidActivityUserId(userId)) throw new TypeError("invalid user id");
  if (!isValidCourseSlug(courseSlug)) throw new TypeError("invalid course slug");
  const row = getDb()
    .prepare(
      `SELECT course_slug, last_lesson, last_viewed_at
       FROM workspace_course_activity
       WHERE user_id = ? AND course_slug = ?
       LIMIT 1`,
    )
    .get(userId, courseSlug) as { course_slug: string; last_lesson: number; last_viewed_at: string } | undefined;
  return row ? mapCourseActivity(row) : undefined;
}

// Keep the shorter name available for the workspace page contract.
export const listRecent = listRecentCourseActivity;

const CORE_COURSE_SLUGS = LABS.flatMap((lab) => lab.courses.map((course) => course.slug));
const ALL_COURSE_SLUGS = COURSE_ENTRIES.map(({ course }) => course.slug);

function lessonCount(slugs: readonly string[]) {
  return slugs.reduce((total, slug) => total + (LESSONS[slug as keyof typeof LESSONS]?.length ?? 0), 0);
}

const STATIC_WORKSPACE_CATALOG: Omit<WorkspaceCatalogSnapshot, "enabledResources" | "resourcesByCategory"> = {
  labCount: LABS.length,
  coreCourseCount: CORE_COURSE_SLUGS.length,
  totalCourseCount: COURSE_ENTRIES.length,
  coreLessonCount: lessonCount(CORE_COURSE_SLUGS),
  totalLessonCount: lessonCount(ALL_COURSE_SLUGS),
};

function emptyWorkspaceCatalog(): WorkspaceCatalogSnapshot {
  return {
    enabledResources: 0,
    resourcesByCategory: {},
    ...STATIC_WORKSPACE_CATALOG,
  };
}

const WORKSPACE_RELEASE: WorkspaceRelease = {
  version: CORECOORD_RELEASE,
  label: `CORECOORD ${CORECOORD_RELEASE}`,
};

/**
 * Read the data-backed workspace summary in one server-side call. Resource
 * metadata is allowed to fail independently from static course content so a
 * catalogue outage does not blank the entire workspace shell.
 */
export function getWorkspaceSnapshot(userId?: string | null): WorkspaceSnapshot {
  let recentCourses: WorkspaceCourseActivity[] = [];
  if (userId && isValidActivityUserId(userId)) {
    try {
      recentCourses = listRecentCourseActivity(userId);
    } catch {
      // The activity table is optional to the static catalogue fallback.
    }
  }

  try {
    const db = getDb();
    const enabled = db.prepare("SELECT COUNT(*) AS count FROM resources WHERE enabled = 1").get() as { count: number };
    const categoryRows = db
      .prepare(
        `SELECT category_key AS categoryKey, COUNT(*) AS count
         FROM resources
         WHERE enabled = 1
         GROUP BY category_key
         ORDER BY category_key ASC`
      )
      .all() as Array<{ categoryKey: string; count: number }>;
    const recentRows = db
      .prepare(`SELECT ${RESOURCE_COLUMNS} FROM resources WHERE enabled = 1 ORDER BY updated_at DESC, id DESC LIMIT ?`)
      .all(WORKSPACE_RECENT_RESOURCE_LIMIT) as ResourceRow[];

    const resourcesByCategory = Object.fromEntries(
      categoryRows.map((row) => [row.categoryKey, Number(row.count)])
    );
    return {
      catalog: {
        ...emptyWorkspaceCatalog(),
        enabledResources: Number(enabled.count),
        resourcesByCategory,
      },
      recentResources: recentRows.map(toResourceDTO),
      recentCourses,
      release: WORKSPACE_RELEASE,
      resourceStatus: "ready",
    };
  } catch {
    return {
      catalog: emptyWorkspaceCatalog(),
      recentResources: [],
      recentCourses,
      release: WORKSPACE_RELEASE,
      resourceStatus: "unavailable",
    };
  }
}

export function toResourceDTO(row: ResourceRow): ResourceDTO {
  return {
    id: row.id,
    title: row.title,
    titleEn: row.title_en,
    category: row.category,
    categoryEn: row.category_en,
    categoryKey: row.category_key,
    kind: row.kind,
    format: row.format,
    size: row.size,
    dimensions: row.dimensions,
    printAdvice: row.print_advice,
    fileKey: row.file_key,
    preview: row.preview,
    sort: row.sort,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}
