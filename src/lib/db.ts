import Database from "better-sqlite3";
import path from "node:path";

/**
 * 应用数据库（与 better-auth 共用同一个 SQLite 文件，由 DASH_AUTH_DB 指定）。
 * 懒加载单例；resources 表 CREATE IF NOT EXISTS，幂等，无迁移框架。
 */

export const DB_PATH = process.env.DASH_AUTH_DB || path.join(process.cwd(), "dash-auth.db");

export const RESOURCES_DDL = `
CREATE TABLE IF NOT EXISTS resources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'file',      -- file | folder（folder 走 /api/browse 清单页）
  format       TEXT,
  size         INTEGER,                            -- 字节，未知为 NULL
  dimensions   TEXT,                               -- 展示用规格描述，如 "4032×1920 · 横版"
  print_advice TEXT,                               -- 印刷/使用建议
  file_key     TEXT NOT NULL,                      -- public 下的相对路径，如 files/海报/xxx.png
  preview      TEXT,                               -- 预览图路径（/assets/... 或 /files/...）
  sort         INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1,         -- 1 上架 / 0 下架
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export interface ResourceRow {
  id: number;
  title: string;
  category: string;
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

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(RESOURCES_DDL);
  }
  return _db;
}

/** 上架资源（资源下载页用），按 sort 升序 */
export function listEnabledResources(): ResourceRow[] {
  return getDb()
    .prepare("SELECT * FROM resources WHERE enabled = 1 ORDER BY sort ASC, id ASC")
    .all() as ResourceRow[];
}

/** 全部资源（管理后台用） */
export function listAllResources(): ResourceRow[] {
  return getDb()
    .prepare("SELECT * FROM resources ORDER BY sort ASC, id ASC")
    .all() as ResourceRow[];
}

export function getResource(id: number): ResourceRow | undefined {
  return getDb().prepare("SELECT * FROM resources WHERE id = ?").get(id) as ResourceRow | undefined;
}
