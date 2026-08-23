import Database from "better-sqlite3";
import path from "node:path";
import { resolveResourceCategory } from "./data";

/**
 * 应用数据库（与 Better Auth 共用文件）。数据库结构由 scripts/migrate.mjs
 * 版本化管理；请求路径只打开连接和读写，不执行 CREATE/ALTER TABLE。
 */
export const DB_PATH = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");
export const RESOURCE_PAGE_LIMIT = 48;
export const RESOURCE_ADMIN_LIMIT = 200;
export const RESOURCE_ZIP_LIMIT = 2000;

export interface ResourceRow {
  id: number;
  title: string;
  category: string;
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
  category: string;
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
  id, title, category, category_key, kind, format, size, dimensions,
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
  if (!columns.some((column) => column.name === "category_key")) {
    throw new Error("resources table is missing category_key; run scripts/migrate.mjs");
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

function clampLimit(value: number | undefined, fallback: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value as number)));
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
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
    where.push(
      "(title LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR dimensions LIKE ? ESCAPE '\\' OR print_advice LIKE ? ESCAPE '\\')"
    );
    args.push(pattern, pattern, pattern, pattern);
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

export function toResourceDTO(row: ResourceRow): ResourceDTO {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
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
