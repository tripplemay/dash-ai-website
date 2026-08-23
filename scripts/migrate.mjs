// 应用数据库迁移（Better Auth 的迁移由 seed/部署脚本单独负责）。
// 运行：DASH_AUTH_DB=/path/to/dash-auth.db node scripts/migrate.mjs
// 该脚本是唯一负责创建/修改 resources 表结构的入口；请求处理不会执行 DDL。
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB = path.join(ROOT, "..", "dash-auth.db");

function restrictDatabaseFiles(dbPath) {
  if (dbPath === ":memory:") return;
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      fs.chmodSync(`${dbPath}${suffix}`, 0o600);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

const CATEGORY_KEYS = {
  "品牌系统": "brand-system",
  "使用指南": "guides",
  "视觉预览": "visual-previews",
  "课件模板": "course-templates",
  "课程海报": "course-posters",
  "招募物料": "recruitment",
  "证书手册": "certificates",
  社媒: "social-media",
  "品牌资产": "brand-assets",
  吉祥物: "mascots",
};

function readCorecoordSeed() {
  const seedPath = path.join(ROOT, "resources-seed.json");
  let items;
  try {
    items = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  } catch (error) {
    throw new Error(`CORECOORD resource seed is invalid: ${error.message}`);
  }
  if (!Array.isArray(items) || items.length === 0) throw new Error("CORECOORD resource seed is empty");
  const currentKeys = items.map((item) => item.file_key);
  if (currentKeys.some((key) => typeof key !== "string" || !key.startsWith("files/corecoord/"))) {
    throw new Error("CORECOORD resource seed contains an invalid file_key");
  }
  if (new Set(currentKeys).size !== currentKeys.length) {
    throw new Error("CORECOORD resource seed contains duplicate file_key values");
  }
  return { items, currentKeys };
}

/** Keep the release-owned catalogue in sync without deleting historical rows. */
function disableStaleCorecoordResources(db, currentKeys) {
  db
    .prepare(
      `UPDATE resources
       SET enabled = 0, updated_at = datetime('now')
       WHERE enabled <> 0
         AND file_key LIKE 'files/corecoord/%'
         AND file_key NOT IN (${currentKeys.map(() => "?").join(",")})`
    )
    .run(...currentKeys);
}

const MIGRATIONS = [
  {
    id: "001_resources",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS resources (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          title        TEXT NOT NULL CHECK(length(trim(title)) > 0),
          category     TEXT NOT NULL CHECK(length(trim(category)) > 0),
          category_key TEXT NOT NULL DEFAULT 'unknown',
          kind         TEXT NOT NULL DEFAULT 'file' CHECK(kind IN ('file', 'folder')),
          format       TEXT,
          size         INTEGER CHECK(size IS NULL OR size >= 0),
          dimensions   TEXT,
          print_advice TEXT,
          file_key     TEXT NOT NULL CHECK(length(trim(file_key)) > 0 AND ltrim(file_key, '/') LIKE 'files/_%'),
          preview      TEXT,
          sort         INTEGER NOT NULL DEFAULT 0 CHECK(sort >= 0),
          enabled      INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
  },
  {
    id: "002_resources_compatibility",
    up(db) {
      const columns = new Set(db.prepare("PRAGMA table_info(resources)").all().map((row) => row.name));
      if (!columns.has("category_key")) {
        db.exec("ALTER TABLE resources ADD COLUMN category_key TEXT NOT NULL DEFAULT 'unknown'");
      }

      const update = db.prepare("UPDATE resources SET category_key = ? WHERE category = ?");
      const tx = db.transaction(() => {
        for (const [label, key] of Object.entries(CATEGORY_KEYS)) update.run(key, label);
        db.prepare("UPDATE resources SET file_key = ltrim(file_key, '/') WHERE file_key LIKE '/files/%'").run();
        // 不认识的历史分类保留数据但落到显式 unknown，避免被第一条映射误归类。
        db
          .prepare(
            "UPDATE resources SET category_key = 'unknown' WHERE category_key IN ('', 'unknown') AND category NOT IN (" +
              Object.keys(CATEGORY_KEYS).map(() => "?").join(",") +
              ")"
          )
          .run(...Object.keys(CATEGORY_KEYS));
      });
      tx();

      // 旧表无法通过 ALTER TABLE 补 CHECK 约束，用触发器覆盖写入路径。
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS resources_validate_insert
        BEFORE INSERT ON resources
        WHEN trim(NEW.title) = '' OR trim(NEW.category) = ''
          OR trim(NEW.category_key) = ''
          OR NEW.kind NOT IN ('file', 'folder')
          OR NEW.enabled NOT IN (0, 1)
          OR NEW.sort < 0
          OR (NEW.size IS NOT NULL AND NEW.size < 0)
          OR trim(NEW.file_key) = '' OR ltrim(NEW.file_key, '/') NOT LIKE 'files/_%'
        BEGIN SELECT RAISE(ABORT, 'invalid resource row'); END;

        CREATE TRIGGER IF NOT EXISTS resources_validate_update
        BEFORE UPDATE OF title, category, category_key, kind, size, file_key, sort, enabled ON resources
        WHEN trim(NEW.title) = '' OR trim(NEW.category) = ''
          OR trim(NEW.category_key) = ''
          OR NEW.kind NOT IN ('file', 'folder')
          OR NEW.enabled NOT IN (0, 1)
          OR NEW.sort < 0
          OR (NEW.size IS NOT NULL AND NEW.size < 0)
          OR trim(NEW.file_key) = '' OR ltrim(NEW.file_key, '/') NOT LIKE 'files/_%'
        BEGIN SELECT RAISE(ABORT, 'invalid resource row'); END;
      `);
    },
  },
  {
    id: "003_resources_indexes",
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS resources_enabled_sort_idx
          ON resources (enabled, sort, id);
        CREATE INDEX IF NOT EXISTS resources_enabled_category_sort_idx
          ON resources (enabled, category_key, sort, id);
        CREATE INDEX IF NOT EXISTS resources_enabled_updated_idx
          ON resources (enabled, updated_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS resources_category_key_idx
          ON resources (category_key);
      `);
      // 旧库可能已经存在重复 file_key（早期 overwrite 行为会产生重复记录）。
      // 先保留可用的普通索引，避免迁移阻断服务；新库和清理重复后的库再启用唯一约束。
      const duplicate = db
        .prepare("SELECT 1 FROM resources GROUP BY file_key HAVING COUNT(*) > 1 LIMIT 1")
        .get();
      if (!duplicate) {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS resources_file_key_unique ON resources (file_key)");
      } else {
        db.exec("CREATE INDEX IF NOT EXISTS resources_file_key_idx ON resources (file_key)");
        console.warn("resources: duplicate file_key detected; unique index deferred until cleanup");
      }
    },
  },
  {
    id: "004_resources_category_repair",
    up(db) {
      // Repair databases that applied an early compatibility migration which
      // treated every unknown key as the first category.
      const update = db.prepare("UPDATE resources SET category_key = ? WHERE category = ?");
      for (const [label, key] of Object.entries(CATEGORY_KEYS)) update.run(key, label);
      db
        .prepare(
          "UPDATE resources SET category_key = 'unknown' WHERE category_key IN ('', 'unknown') AND category NOT IN (" +
            Object.keys(CATEGORY_KEYS).map(() => "?").join(",") +
            ")"
        )
        .run(...Object.keys(CATEGORY_KEYS));
      db.prepare("UPDATE resources SET file_key = ltrim(file_key, '/') WHERE file_key LIKE '/files/%'").run();
    },
  },
  {
    id: "005_resources_unique_file_key",
    up(db) {
      const duplicate = db
        .prepare(
          `SELECT file_key, GROUP_CONCAT(id) AS ids
           FROM resources
           GROUP BY file_key
           HAVING COUNT(*) > 1
           LIMIT 1`
        )
        .get();
      if (duplicate) {
        throw new Error(
          `duplicate resources.file_key detected (${duplicate.file_key}; ids=${duplicate.ids}); ` +
            "run scripts/dedupe-resources.mjs after a verified backup before deploying"
        );
      }
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS resources_file_key_unique ON resources (file_key)");
    },
  },
  {
    id: "006_corecoord_brand_release",
    up(db) {
      // Keep the historical rows for audit/rollback, but remove them from the
      // public catalogue before publishing the versioned CORECOORD package.
      db.prepare("UPDATE resources SET enabled = 0 WHERE file_key NOT LIKE 'files/corecoord/%'").run();

      const { items, currentKeys } = readCorecoordSeed();
      const insert = db.prepare(`
        INSERT INTO resources (
          title, category, category_key, kind, format, size, dimensions,
          print_advice, file_key, preview, sort, enabled
        )
        SELECT @title, @category, @category_key, @kind, @format, @size, @dimensions,
          @print_advice, @file_key, @preview, @sort, 1
        WHERE NOT EXISTS (SELECT 1 FROM resources WHERE file_key = @file_key)
      `);
      const update = db.prepare(`
        UPDATE resources SET
          title = @title,
          category = @category,
          category_key = @category_key,
          kind = @kind,
          format = @format,
          size = @size,
          dimensions = @dimensions,
          print_advice = @print_advice,
          preview = @preview,
          sort = @sort,
          enabled = 1,
          updated_at = datetime('now')
        WHERE file_key = @file_key
      `);
      const tx = db.transaction((rows) => {
        // The seed is authoritative for the release-owned namespace. Rows
        // removed from a future package stay in the database for audit, but
        // must not remain downloadable or visible in the catalogue.
        disableStaleCorecoordResources(db, currentKeys);
        for (const item of rows) {
          const row = { ...item, category_key: item.category_key || CATEGORY_KEYS[item.category] || "unknown" };
          update.run(row);
          insert.run(row);
        }
      });
      tx(items);
    },
  },
  {
    id: "007_corecoord_resource_prune",
    up(db) {
      // Keep the release-owned namespace authoritative for databases that
      // already applied migration 006 before a later package revision removed
      // one of its resource rows. Historical rows remain available for audit.
      const { currentKeys } = readCorecoordSeed();
      disableStaleCorecoordResources(db, currentKeys);
    },
  },
];

/** 在一个 SQLite 连接上执行所有未应用的应用迁移。 */
export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const has = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
  const mark = db.prepare("INSERT INTO schema_migrations (id) VALUES (?)");
  for (const migration of MIGRATIONS) {
    if (has.get(migration.id)) continue;
    db.transaction(() => {
      migration.up(db);
      mark.run(migration.id);
    })();
  }
  // Migration IDs are immutable, but the release seed can change when a
  // corrected brand package is deployed. Reconcile on every maintenance run
  // so removed release-owned rows cannot remain publicly enabled forever.
  const { currentKeys } = readCorecoordSeed();
  db.transaction(() => disableStaleCorecoordResources(db, currentKeys))();
}

export function openDatabase(dbPath = process.env.DASH_AUTH_DB || DEFAULT_DB) {
  const db = new Database(dbPath, { timeout: 30000 });
  restrictDatabaseFiles(dbPath);
  db.pragma("busy_timeout = 30000");
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  restrictDatabaseFiles(dbPath);
  const integrity = db.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    db.close();
    throw new Error(`SQLite integrity_check failed: ${integrity}`);
  }
  return db;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const dbPath = process.env.DASH_AUTH_DB || DEFAULT_DB;
  const db = openDatabase(dbPath);
  console.log(`migrations applied -> ${dbPath}`);
  db.close();
}
