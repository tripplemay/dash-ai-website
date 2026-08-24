// 应用数据库迁移（Better Auth 的迁移由 seed/部署脚本单独负责）。
// 运行：DASH_AUTH_DB=/path/to/dash-auth.db node scripts/migrate.mjs
// 该脚本是唯一负责创建/修改应用数据表结构的入口；请求处理不会执行 DDL。
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
          title_en     TEXT,
          category     TEXT NOT NULL CHECK(length(trim(category)) > 0),
          category_en  TEXT,
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
      // Databases created before the bilingual catalogue fields reach this
      // migration before 008; add the nullable columns here so the release
      // seed can be applied in one pass on both old and fresh databases.
      const columns = new Set(db.prepare("PRAGMA table_info(resources)").all().map((row) => row.name));
      if (!columns.has("title_en")) db.exec("ALTER TABLE resources ADD COLUMN title_en TEXT");
      if (!columns.has("category_en")) db.exec("ALTER TABLE resources ADD COLUMN category_en TEXT");

      // Keep the historical rows for audit/rollback, but remove them from the
      // public catalogue before publishing the versioned CORECOORD package.
      db.prepare("UPDATE resources SET enabled = 0 WHERE file_key NOT LIKE 'files/corecoord/%'").run();

      const { items, currentKeys } = readCorecoordSeed();
      const insert = db.prepare(`
        INSERT INTO resources (
          title, title_en, category, category_en, category_key, kind, format, size, dimensions,
          print_advice, file_key, preview, sort, enabled
        )
        SELECT @title, @title_en, @category, @category_en, @category_key, @kind, @format, @size, @dimensions,
          @print_advice, @file_key, @preview, @sort, 1
        WHERE NOT EXISTS (SELECT 1 FROM resources WHERE file_key = @file_key)
      `);
      const update = db.prepare(`
        UPDATE resources SET
          title = @title,
          title_en = @title_en,
          category = @category,
          category_en = @category_en,
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
          update.run(item);
          insert.run(item);
        }
      });
      tx(items.map((item) => ({
        ...item,
        title_en: item.title_en || item.title,
        category_en: item.category_en || item.category,
        category_key: item.category_key || CATEGORY_KEYS[item.category] || "unknown",
      })));
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
  {
    id: "008_resources_bilingual_fields",
    up(db) {
      const columns = new Set(db.prepare("PRAGMA table_info(resources)").all().map((row) => row.name));
      if (!columns.has("title_en")) db.exec("ALTER TABLE resources ADD COLUMN title_en TEXT");
      if (!columns.has("category_en")) db.exec("ALTER TABLE resources ADD COLUMN category_en TEXT");

      // Existing catalogue rows predate bilingual metadata. Keep the current
      // label as a deterministic fallback until an English translation is
      // supplied by the catalogue owner.
      db.prepare("UPDATE resources SET title_en = title WHERE title_en IS NULL OR trim(title_en) = ''").run();
      db.prepare("UPDATE resources SET category_en = category WHERE category_en IS NULL OR trim(category_en) = ''").run();
    },
  },
  {
    id: "009_workspace_course_activity",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspace_course_activity (
          user_id        TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
          course_slug    TEXT NOT NULL CHECK(length(trim(course_slug)) BETWEEN 1 AND 64),
          last_lesson    INTEGER NOT NULL DEFAULT 0 CHECK(last_lesson >= 0),
          last_viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, course_slug)
        );

        CREATE INDEX IF NOT EXISTS workspace_course_activity_user_viewed_idx
          ON workspace_course_activity (user_id, last_viewed_at DESC, course_slug ASC);
      `);
    },
  },
  {
    id: "010_content_governance",
    up(db) {
      try {
        const jsonProbe = db.prepare("SELECT json_valid('{}') AS ok").get();
        if (jsonProbe?.ok !== 1) throw new Error("JSON1 extension returned an invalid result");
      } catch (error) {
        throw new Error(`content governance requires SQLite JSON1 support: ${error.message}`);
      }

      const contentTableNames = ["content_entries", "content_revisions", "content_references", "audit_events"];
      const existingContentTables = new Set(
        db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${contentTableNames
              .map(() => "?")
              .join(",")})`
          )
          .all(...contentTableNames)
          .map((row) => row.name)
      );
      for (const table of existingContentTables) {
        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
        const idColumn = tableInfo.find((row) => row.name === "id");
        const primaryKeyColumns = tableInfo.filter((row) => row.pk > 0);
        if (
          !idColumn ||
          idColumn.pk !== 1 ||
          primaryKeyColumns.length !== 1 ||
          String(idColumn.type || "").toUpperCase() !== "TEXT"
        ) {
          throw new Error(
            `content governance cannot upgrade ${table}: required TEXT id PRIMARY KEY is missing; ` +
            `export the table, rename it, then rerun scripts/migrate.mjs`
          );
        }
      }

      // Content tables are intentionally generic: courses, lessons, FAQs and
      // future editorial objects share the same revision/status workflow.
      // TEXT ids keep imports deterministic and avoid coupling the content
      // layer to an ORM-generated integer sequence.
      db.exec(`
        CREATE TABLE IF NOT EXISTS content_entries (
          id             TEXT PRIMARY KEY NOT NULL,
          content_type   TEXT NOT NULL CHECK(length(trim(content_type)) BETWEEN 1 AND 64),
          slug           TEXT NOT NULL CHECK(length(trim(slug)) BETWEEN 1 AND 160),
          locale         TEXT NOT NULL CHECK(length(trim(locale)) BETWEEN 2 AND 16),
          status         TEXT NOT NULL DEFAULT 'draft'
                         CHECK(status IN ('draft', 'review', 'published', 'archived')),
          revision       INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
          owner_id       TEXT REFERENCES user(id) ON DELETE SET NULL,
          reviewer_id    TEXT REFERENCES user(id) ON DELETE SET NULL,
          published_at   TEXT,
          expires_at     TEXT,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(content_type, slug, locale),
          CHECK(expires_at IS NULL OR published_at IS NULL OR expires_at >= published_at)
        );

        CREATE TABLE IF NOT EXISTS content_revisions (
          id             TEXT PRIMARY KEY NOT NULL,
          entry_id       TEXT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
          revision       INTEGER NOT NULL CHECK(revision > 0),
          locale         TEXT NOT NULL CHECK(length(trim(locale)) BETWEEN 2 AND 16),
          payload        TEXT NOT NULL CHECK(json_valid(payload)),
          status         TEXT NOT NULL DEFAULT 'draft'
                         CHECK(status IN ('draft', 'review', 'published', 'archived')),
          owner_id       TEXT REFERENCES user(id) ON DELETE SET NULL,
          reviewer_id    TEXT REFERENCES user(id) ON DELETE SET NULL,
          published_at   TEXT,
          expires_at     TEXT,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(entry_id, revision),
          CHECK(expires_at IS NULL OR published_at IS NULL OR expires_at >= published_at)
        );

        CREATE TABLE IF NOT EXISTS content_references (
          id             TEXT PRIMARY KEY NOT NULL,
          from_entry_id  TEXT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
          to_entry_id    TEXT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
          reference_type TEXT NOT NULL DEFAULT 'related'
                         CHECK(length(trim(reference_type)) BETWEEN 1 AND 64),
          metadata       TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
          created_by     TEXT REFERENCES user(id) ON DELETE SET NULL,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(from_entry_id, to_entry_id, reference_type),
          CHECK(from_entry_id <> to_entry_id)
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id             TEXT PRIMARY KEY NOT NULL,
          entity_type    TEXT NOT NULL CHECK(length(trim(entity_type)) BETWEEN 1 AND 64),
          entity_id      TEXT NOT NULL CHECK(length(trim(entity_id)) BETWEEN 1 AND 200),
          action         TEXT NOT NULL CHECK(length(trim(action)) BETWEEN 1 AND 80),
          actor_id       TEXT REFERENCES user(id) ON DELETE SET NULL,
          from_status    TEXT CHECK(from_status IS NULL OR from_status IN ('draft', 'review', 'published', 'archived')),
          to_status      TEXT CHECK(to_status IS NULL OR to_status IN ('draft', 'review', 'published', 'archived')),
          revision       INTEGER CHECK(revision IS NULL OR revision >= 0),
          metadata       TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
          created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );

      `);

      // Older experimental databases may already contain one of these tables
      // with only a subset of columns. Add nullable/defaulted columns before
      // creating the indexes so the migration remains forward compatible.
      const ensureColumn = (table, name, definition) => {
        const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
        if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      };
      const columnPlans = {
        content_entries: [
          ["content_type", "TEXT NOT NULL DEFAULT 'generic'"],
          ["slug", "TEXT NOT NULL DEFAULT 'legacy'"],
          ["locale", "TEXT NOT NULL DEFAULT 'zh'"],
          ["status", "TEXT NOT NULL DEFAULT 'draft'"],
          ["revision", "INTEGER NOT NULL DEFAULT 0"],
          ["owner_id", "TEXT"],
          ["reviewer_id", "TEXT"],
          ["published_at", "TEXT"],
          ["expires_at", "TEXT"],
          ["created_at", "TEXT NOT NULL DEFAULT ''"],
          ["updated_at", "TEXT NOT NULL DEFAULT ''"],
        ],
        content_revisions: [
          ["entry_id", "TEXT"],
          ["revision", "INTEGER NOT NULL DEFAULT 1"],
          ["locale", "TEXT NOT NULL DEFAULT 'zh'"],
          ["payload", "TEXT NOT NULL DEFAULT '{}'"],
          ["status", "TEXT NOT NULL DEFAULT 'draft'"],
          ["owner_id", "TEXT"],
          ["reviewer_id", "TEXT"],
          ["published_at", "TEXT"],
          ["expires_at", "TEXT"],
          ["created_at", "TEXT NOT NULL DEFAULT ''"],
        ],
        content_references: [
          ["from_entry_id", "TEXT"],
          ["to_entry_id", "TEXT"],
          ["reference_type", "TEXT NOT NULL DEFAULT 'related'"],
          ["metadata", "TEXT NOT NULL DEFAULT '{}'"],
          ["created_by", "TEXT"],
          ["created_at", "TEXT NOT NULL DEFAULT ''"],
        ],
        audit_events: [
          ["entity_type", "TEXT NOT NULL DEFAULT 'content'"],
          ["entity_id", "TEXT NOT NULL DEFAULT 'unknown'"],
          ["action", "TEXT NOT NULL DEFAULT 'legacy'"],
          ["actor_id", "TEXT"],
          ["from_status", "TEXT"],
          ["to_status", "TEXT"],
          ["revision", "INTEGER"],
          ["metadata", "TEXT NOT NULL DEFAULT '{}'"],
          ["created_at", "TEXT NOT NULL DEFAULT ''"],
        ],
      };
      for (const [table, columns] of Object.entries(columnPlans)) {
        for (const [name, definition] of columns) ensureColumn(table, name, definition);
      }

      const invalidRows = [
        db
          .prepare(
            "SELECT id FROM content_entries WHERE id IS NULL OR trim(id) = '' OR content_type IS NULL OR length(trim(content_type)) NOT BETWEEN 1 AND 64 OR slug IS NULL OR length(trim(slug)) NOT BETWEEN 1 AND 160 OR locale IS NULL OR length(trim(locale)) NOT BETWEEN 2 AND 16 OR status IS NULL OR status NOT IN ('draft', 'review', 'published', 'archived') OR revision IS NULL OR revision < 0 OR (expires_at IS NOT NULL AND published_at IS NOT NULL AND expires_at < published_at) LIMIT 1"
          )
          .get(),
        db
          .prepare(
            "SELECT id FROM content_revisions WHERE id IS NULL OR trim(id) = '' OR entry_id IS NULL OR trim(entry_id) = '' OR revision IS NULL OR revision < 1 OR locale IS NULL OR length(trim(locale)) NOT BETWEEN 2 AND 16 OR json_valid(payload) IS NOT 1 OR status IS NULL OR status NOT IN ('draft', 'review', 'published', 'archived') OR (expires_at IS NOT NULL AND published_at IS NOT NULL AND expires_at < published_at) LIMIT 1"
          )
          .get(),
        db
          .prepare(
            "SELECT id FROM content_references WHERE id IS NULL OR trim(id) = '' OR from_entry_id IS NULL OR to_entry_id IS NULL OR trim(from_entry_id) = '' OR trim(to_entry_id) = '' OR from_entry_id = to_entry_id OR reference_type IS NULL OR length(trim(reference_type)) NOT BETWEEN 1 AND 64 OR json_valid(metadata) IS NOT 1 LIMIT 1"
          )
          .get(),
        db
          .prepare(
            "SELECT r.id FROM content_revisions r WHERE NOT EXISTS (SELECT 1 FROM content_entries e WHERE e.id = r.entry_id) LIMIT 1"
          )
          .get(),
        db
          .prepare(
            "SELECT r.id FROM content_references r WHERE NOT EXISTS (SELECT 1 FROM content_entries e WHERE e.id = r.from_entry_id) OR NOT EXISTS (SELECT 1 FROM content_entries e WHERE e.id = r.to_entry_id) LIMIT 1"
          )
          .get(),
        db
          .prepare(
            "SELECT id FROM audit_events WHERE id IS NULL OR trim(id) = '' OR entity_type IS NULL OR length(trim(entity_type)) NOT BETWEEN 1 AND 64 OR entity_id IS NULL OR length(trim(entity_id)) NOT BETWEEN 1 AND 200 OR action IS NULL OR length(trim(action)) NOT BETWEEN 1 AND 80 OR (from_status IS NOT NULL AND from_status NOT IN ('draft', 'review', 'published', 'archived')) OR (to_status IS NOT NULL AND to_status NOT IN ('draft', 'review', 'published', 'archived')) OR (revision IS NOT NULL AND revision < 0) OR json_valid(metadata) IS NOT 1 LIMIT 1"
          )
          .get(),
      ];
      if (invalidRows.some(Boolean)) {
        throw new Error(
          "content governance found invalid legacy rows; repair or export the affected content_* / audit_events table before rerunning migration"
        );
      }
      const duplicateEntry = db
        .prepare("SELECT content_type, slug, locale FROM content_entries GROUP BY content_type, slug, locale HAVING COUNT(*) > 1 LIMIT 1")
        .get();
      const duplicateRevision = db
        .prepare("SELECT entry_id, revision FROM content_revisions GROUP BY entry_id, revision HAVING COUNT(*) > 1 LIMIT 1")
        .get();
      const duplicateReference = db
        .prepare("SELECT from_entry_id, to_entry_id, reference_type FROM content_references GROUP BY from_entry_id, to_entry_id, reference_type HAVING COUNT(*) > 1 LIMIT 1")
        .get();
      if (duplicateEntry || duplicateRevision || duplicateReference) {
        throw new Error(
          "content governance found duplicate legacy keys; deduplicate content_entries/content_revisions/content_references before rerunning migration"
        );
      }
      const orphanRevision = db
        .prepare(
          "SELECT r.id FROM content_revisions r LEFT JOIN content_entries e ON e.id = r.entry_id WHERE e.id IS NULL LIMIT 1"
        )
        .get();
      const orphanReference = db
        .prepare(
          "SELECT r.id FROM content_references r LEFT JOIN content_entries f ON f.id = r.from_entry_id LEFT JOIN content_entries t ON t.id = r.to_entry_id WHERE f.id IS NULL OR t.id IS NULL LIMIT 1"
        )
        .get();
      if (orphanRevision || orphanReference) {
        throw new Error(
          "content governance found orphaned revision/reference rows; restore their content_entries parents before rerunning migration"
        );
      }
      db.exec(`
        UPDATE content_entries SET created_at = datetime('now') WHERE created_at IS NULL OR trim(created_at) = '';
        UPDATE content_entries SET updated_at = datetime('now') WHERE updated_at IS NULL OR trim(updated_at) = '';
        UPDATE content_revisions SET created_at = datetime('now') WHERE created_at IS NULL OR trim(created_at) = '';
        UPDATE content_references SET created_at = datetime('now') WHERE created_at IS NULL OR trim(created_at) = '';
        UPDATE audit_events SET created_at = datetime('now') WHERE created_at IS NULL OR trim(created_at) = '';
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS content_entries_status_updated_idx
          ON content_entries (status, updated_at DESC, id ASC);
        CREATE INDEX IF NOT EXISTS content_entries_type_locale_updated_idx
          ON content_entries (content_type, locale, updated_at DESC, id ASC);
        CREATE INDEX IF NOT EXISTS content_entries_owner_status_idx
          ON content_entries (owner_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS content_revisions_entry_revision_idx
          ON content_revisions (entry_id, revision DESC);
        CREATE INDEX IF NOT EXISTS content_revisions_status_created_idx
          ON content_revisions (status, created_at DESC);
        CREATE INDEX IF NOT EXISTS content_references_from_idx
          ON content_references (from_entry_id, reference_type, to_entry_id);
        CREATE INDEX IF NOT EXISTS content_references_to_idx
          ON content_references (to_entry_id, reference_type, from_entry_id);
        CREATE INDEX IF NOT EXISTS audit_events_entity_created_idx
          ON audit_events (entity_type, entity_id, created_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS audit_events_actor_created_idx
          ON audit_events (actor_id, created_at DESC, id DESC);
        DROP INDEX IF EXISTS content_entries_type_slug_locale_unique;
        DROP INDEX IF EXISTS content_revisions_entry_revision_unique;
        DROP INDEX IF EXISTS content_references_from_to_type_unique;
        CREATE UNIQUE INDEX content_entries_type_slug_locale_unique
          ON content_entries (content_type, slug, locale);
        CREATE UNIQUE INDEX content_revisions_entry_revision_unique
          ON content_revisions (entry_id, revision);
        CREATE UNIQUE INDEX content_references_from_to_type_unique
          ON content_references (from_entry_id, to_entry_id, reference_type);
      `);

      // Tables created by a pre-release build may not have CHECK constraints;
      // triggers preserve the state-machine invariant for those rows too.
      db.exec(`
        DROP TRIGGER IF EXISTS content_entries_validate_status_insert;
        DROP TRIGGER IF EXISTS content_entries_validate_status_update;
        DROP TRIGGER IF EXISTS content_revisions_validate_status_insert;
        DROP TRIGGER IF EXISTS content_revisions_validate_status_update;
        DROP TRIGGER IF EXISTS audit_events_validate_status_insert;
        DROP TRIGGER IF EXISTS audit_events_validate_status_update;
        DROP TRIGGER IF EXISTS content_entries_validate_id_insert;
        DROP TRIGGER IF EXISTS content_entries_validate_id_update;
        DROP TRIGGER IF EXISTS content_revisions_validate_id_insert;
        DROP TRIGGER IF EXISTS content_revisions_validate_id_update;
        DROP TRIGGER IF EXISTS content_references_validate_id_insert;
        DROP TRIGGER IF EXISTS content_references_validate_id_update;
        DROP TRIGGER IF EXISTS audit_events_validate_id_insert;
        DROP TRIGGER IF EXISTS audit_events_validate_id_update;

        CREATE TRIGGER content_entries_validate_id_insert
        BEFORE INSERT ON content_entries WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid content id'); END;
        CREATE TRIGGER content_entries_validate_id_update
        BEFORE UPDATE OF id ON content_entries WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid content id'); END;

        CREATE TRIGGER content_revisions_validate_id_insert
        BEFORE INSERT ON content_revisions WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid revision id'); END;
        CREATE TRIGGER content_revisions_validate_id_update
        BEFORE UPDATE OF id ON content_revisions WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid revision id'); END;

        CREATE TRIGGER content_references_validate_id_insert
        BEFORE INSERT ON content_references WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid reference id'); END;
        CREATE TRIGGER content_references_validate_id_update
        BEFORE UPDATE OF id ON content_references WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid reference id'); END;

        CREATE TRIGGER audit_events_validate_id_insert
        BEFORE INSERT ON audit_events WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid audit id'); END;
        CREATE TRIGGER audit_events_validate_id_update
        BEFORE UPDATE OF id ON audit_events WHEN NEW.id IS NULL OR trim(NEW.id) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid audit id'); END;

        CREATE TRIGGER content_entries_validate_status_insert
        BEFORE INSERT ON content_entries
        WHEN NEW.status IS NULL OR NEW.status NOT IN ('draft', 'review', 'published', 'archived')
        BEGIN SELECT RAISE(ABORT, 'invalid content status'); END;

        CREATE TRIGGER content_entries_validate_status_update
        BEFORE UPDATE OF status ON content_entries
        WHEN NEW.status IS NULL OR NEW.status NOT IN ('draft', 'review', 'published', 'archived')
        BEGIN SELECT RAISE(ABORT, 'invalid content status'); END;

        CREATE TRIGGER content_revisions_validate_status_insert
        BEFORE INSERT ON content_revisions
        WHEN NEW.status IS NULL OR NEW.status NOT IN ('draft', 'review', 'published', 'archived')
        BEGIN SELECT RAISE(ABORT, 'invalid revision status'); END;

        CREATE TRIGGER content_revisions_validate_status_update
        BEFORE UPDATE OF status ON content_revisions
        WHEN NEW.status IS NULL OR NEW.status NOT IN ('draft', 'review', 'published', 'archived')
        BEGIN SELECT RAISE(ABORT, 'invalid revision status'); END;

        CREATE TRIGGER audit_events_validate_status_insert
        BEFORE INSERT ON audit_events
        WHEN (NEW.from_status IS NOT NULL AND NEW.from_status NOT IN ('draft', 'review', 'published', 'archived'))
          OR (NEW.to_status IS NOT NULL AND NEW.to_status NOT IN ('draft', 'review', 'published', 'archived'))
        BEGIN SELECT RAISE(ABORT, 'invalid audit status'); END;

        CREATE TRIGGER audit_events_validate_status_update
        BEFORE UPDATE OF from_status, to_status ON audit_events
        WHEN (NEW.from_status IS NOT NULL AND NEW.from_status NOT IN ('draft', 'review', 'published', 'archived'))
          OR (NEW.to_status IS NOT NULL AND NEW.to_status NOT IN ('draft', 'review', 'published', 'archived'))
        BEGIN SELECT RAISE(ABORT, 'invalid audit status'); END;
      `);
    },
  },
  {
    id: "011_resources_search",
    up(db) {
      // Probe the extension separately so malformed schema/trigger errors are
      // not mistaken for a missing FTS5 module and silently downgraded.
      let fts5Available = true;
      try {
        db.exec(`CREATE VIRTUAL TABLE resources_fts_capability_probe USING fts5(value); DROP TABLE resources_fts_capability_probe;`);
      } catch (error) {
        if (/no such module:\s*fts5|unknown module:\s*fts5|unable to use function fts5/i.test(String(error?.message || error))) {
          fts5Available = false;
        } else {
          throw new Error(`resources FTS5 capability probe failed: ${error.message}`);
        }
      }

      if (fts5Available) {
        try {
          db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts USING fts5(
            title, title_en, category, category_en, dimensions, print_advice,
            content='resources', content_rowid='id', tokenize='unicode61'
          );
          INSERT INTO resources_fts(resources_fts) VALUES ('rebuild');

          DROP TRIGGER IF EXISTS resources_fts_ai;
          DROP TRIGGER IF EXISTS resources_fts_ad;
          DROP TRIGGER IF EXISTS resources_fts_au;
          DROP TRIGGER IF EXISTS resources_search_fallback_ai;
          DROP TRIGGER IF EXISTS resources_search_fallback_au;

          CREATE TRIGGER resources_fts_ai
          AFTER INSERT ON resources BEGIN
            INSERT INTO resources_fts(rowid, title, title_en, category, category_en, dimensions, print_advice)
            VALUES (new.id, new.title, new.title_en, new.category, new.category_en, new.dimensions, new.print_advice);
          END;

          CREATE TRIGGER resources_fts_ad
          AFTER DELETE ON resources BEGIN
            INSERT INTO resources_fts(resources_fts, rowid, title, title_en, category, category_en, dimensions, print_advice)
            VALUES ('delete', old.id, old.title, old.title_en, old.category, old.category_en, old.dimensions, old.print_advice);
          END;

          CREATE TRIGGER resources_fts_au
          AFTER UPDATE OF title, title_en, category, category_en, dimensions, print_advice ON resources BEGIN
            INSERT INTO resources_fts(resources_fts, rowid, title, title_en, category, category_en, dimensions, print_advice)
            VALUES ('delete', old.id, old.title, old.title_en, old.category, old.category_en, old.dimensions, old.print_advice);
            INSERT INTO resources_fts(rowid, title, title_en, category, category_en, dimensions, print_advice)
            VALUES (new.id, new.title, new.title_en, new.category, new.category_en, new.dimensions, new.print_advice);
          END;
          `);
        } catch (error) {
          throw new Error(`resources FTS5 setup failed after capability probe: ${error.message}`);
        }
        return;
      }

      {
        // FTS5 is optional in distro SQLite. The fallback remains searchable
        // with LIKE and keeps writes/indexing functional everywhere.
        const columns = new Set(db.prepare("PRAGMA table_info(resources)").all().map((row) => row.name));
        if (!columns.has("normalized_search")) db.exec("ALTER TABLE resources ADD COLUMN normalized_search TEXT");
        db.exec(`
          DROP TRIGGER IF EXISTS resources_fts_ai;
          DROP TRIGGER IF EXISTS resources_fts_ad;
          DROP TRIGGER IF EXISTS resources_fts_au;
          DROP TRIGGER IF EXISTS resources_search_fallback_ai;
          DROP TRIGGER IF EXISTS resources_search_fallback_au;
          UPDATE resources
          SET normalized_search = lower(trim(
            coalesce(title, '') || ' ' || coalesce(title_en, '') || ' ' ||
            coalesce(category, '') || ' ' || coalesce(category_en, '') || ' ' ||
            coalesce(dimensions, '') || ' ' || coalesce(print_advice, '')
          ));
          CREATE INDEX IF NOT EXISTS resources_normalized_search_idx
            ON resources (normalized_search);
          CREATE TRIGGER resources_search_fallback_ai
          AFTER INSERT ON resources BEGIN
            UPDATE resources SET normalized_search = lower(trim(
              coalesce(new.title, '') || ' ' || coalesce(new.title_en, '') || ' ' ||
              coalesce(new.category, '') || ' ' || coalesce(new.category_en, '') || ' ' ||
              coalesce(new.dimensions, '') || ' ' || coalesce(new.print_advice, '')
            )) WHERE id = new.id;
          END;
          CREATE TRIGGER resources_search_fallback_au
          AFTER UPDATE OF title, title_en, category, category_en, dimensions, print_advice ON resources BEGIN
            UPDATE resources SET normalized_search = lower(trim(
              coalesce(new.title, '') || ' ' || coalesce(new.title_en, '') || ' ' ||
              coalesce(new.category, '') || ' ' || coalesce(new.category_en, '') || ' ' ||
              coalesce(new.dimensions, '') || ' ' || coalesce(new.print_advice, '')
            )) WHERE id = new.id;
          END;
        `);
        console.warn("resources: FTS5 unavailable; using normalized_search fallback");
      }
    },
  },
  {
    id: "012_learning_events",
    up(db) {
      const learningEventsObject = db
        .prepare("SELECT type FROM sqlite_master WHERE name = ? LIMIT 1")
        .get("learning_events");
      if (learningEventsObject && learningEventsObject.type !== "table") {
        throw new Error("learning events cannot upgrade learning_events: an object with that name already exists");
      }
      if (learningEventsObject) {
        const columns = db.prepare("PRAGMA table_info(learning_events)").all();
        const columnNames = new Set(columns.map((column) => column.name));
        const requiredColumns = [
          "event_id",
          "user_id",
          "course_slug",
          "lesson_number",
          "event_type",
          "idempotency_key",
          "payload_json",
          "occurred_at",
          "created_at",
        ];
        const missingColumns = requiredColumns.filter((name) => !columnNames.has(name));
        if (missingColumns.length) {
          throw new Error(
            `learning events cannot upgrade existing learning_events: missing columns ${missingColumns.join(", ")}; ` +
              "export the table, rename it, then rerun scripts/migrate.mjs"
          );
        }
        const eventIdColumn = columns.find((column) => column.name === "event_id");
        if (String(eventIdColumn?.type || "").toUpperCase() !== "TEXT") {
          throw new Error(
            "learning events cannot upgrade existing learning_events: event_id must use TEXT affinity; " +
              "export the table, rename it, then rerun scripts/migrate.mjs"
          );
        }
        const invalidRow = db
          .prepare(
            `SELECT event_id
             FROM learning_events
             WHERE event_id IS NULL OR trim(event_id) = ''
               OR user_id IS NULL OR trim(user_id) = ''
               OR course_slug IS NULL OR trim(course_slug) = ''
               OR lesson_number IS NULL OR lesson_number < 0
               OR event_type IS NULL OR trim(event_type) = ''
               OR idempotency_key IS NULL OR trim(idempotency_key) = ''
               OR json_valid(payload_json) IS NOT 1
               OR occurred_at IS NULL OR trim(occurred_at) = ''
               OR created_at IS NULL OR trim(created_at) = ''
             LIMIT 1`
          )
          .get();
        const duplicateEventId = db
          .prepare("SELECT event_id FROM learning_events GROUP BY event_id HAVING COUNT(*) > 1 LIMIT 1")
          .get();
        const duplicateIdempotencyKey = db
          .prepare("SELECT idempotency_key FROM learning_events GROUP BY idempotency_key HAVING COUNT(*) > 1 LIMIT 1")
          .get();
        if (invalidRow || duplicateEventId || duplicateIdempotencyKey) {
          throw new Error(
            "learning events found invalid legacy rows or duplicate keys; repair or export learning_events before rerunning migration"
          );
        }
        // A pre-release table may have the right columns without the final
        // uniqueness constraints. Rebuild only migration-owned index names.
        db.exec(`
          DROP INDEX IF EXISTS learning_events_event_id_unique;
          DROP INDEX IF EXISTS learning_events_idempotency_key_unique;
          CREATE UNIQUE INDEX learning_events_event_id_unique ON learning_events (event_id);
          CREATE UNIQUE INDEX learning_events_idempotency_key_unique ON learning_events (idempotency_key);
        `);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS learning_events (
          event_id        TEXT PRIMARY KEY NOT NULL,
          user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
          course_slug     TEXT NOT NULL CHECK(length(trim(course_slug)) BETWEEN 1 AND 64),
          lesson_number   INTEGER NOT NULL CHECK(lesson_number >= 0),
          event_type      TEXT NOT NULL CHECK(length(trim(event_type)) BETWEEN 1 AND 64),
          idempotency_key TEXT NOT NULL UNIQUE CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 200),
          payload_json    TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload_json)),
          occurred_at     TEXT NOT NULL DEFAULT (datetime('now')),
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        DROP TRIGGER IF EXISTS learning_events_validate_insert;
        DROP TRIGGER IF EXISTS learning_events_validate_update;
        CREATE TRIGGER learning_events_validate_insert
        BEFORE INSERT ON learning_events
        WHEN NEW.event_id IS NULL OR trim(NEW.event_id) = ''
          OR NEW.user_id IS NULL OR trim(NEW.user_id) = ''
          OR NEW.course_slug IS NULL OR length(trim(NEW.course_slug)) NOT BETWEEN 1 AND 64
          OR NEW.lesson_number IS NULL OR NEW.lesson_number < 0
          OR NEW.event_type IS NULL OR length(trim(NEW.event_type)) NOT BETWEEN 1 AND 64
          OR NEW.idempotency_key IS NULL OR length(trim(NEW.idempotency_key)) NOT BETWEEN 1 AND 200
          OR json_valid(NEW.payload_json) IS NOT 1
          OR NEW.occurred_at IS NULL OR trim(NEW.occurred_at) = ''
          OR NEW.created_at IS NULL OR trim(NEW.created_at) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid learning event'); END;

        CREATE TRIGGER learning_events_validate_update
        BEFORE UPDATE ON learning_events
        WHEN NEW.event_id IS NULL OR trim(NEW.event_id) = ''
          OR NEW.user_id IS NULL OR trim(NEW.user_id) = ''
          OR NEW.course_slug IS NULL OR length(trim(NEW.course_slug)) NOT BETWEEN 1 AND 64
          OR NEW.lesson_number IS NULL OR NEW.lesson_number < 0
          OR NEW.event_type IS NULL OR length(trim(NEW.event_type)) NOT BETWEEN 1 AND 64
          OR NEW.idempotency_key IS NULL OR length(trim(NEW.idempotency_key)) NOT BETWEEN 1 AND 200
          OR json_valid(NEW.payload_json) IS NOT 1
          OR NEW.occurred_at IS NULL OR trim(NEW.occurred_at) = ''
          OR NEW.created_at IS NULL OR trim(NEW.created_at) = ''
        BEGIN SELECT RAISE(ABORT, 'invalid learning event'); END;

        CREATE INDEX IF NOT EXISTS learning_events_user_course_occurred_idx
          ON learning_events (user_id, course_slug, occurred_at DESC, event_id DESC);
        CREATE INDEX IF NOT EXISTS learning_events_user_occurred_idx
          ON learning_events (user_id, occurred_at DESC, event_id DESC);
        CREATE INDEX IF NOT EXISTS learning_events_type_occurred_idx
          ON learning_events (event_type, occurred_at DESC, event_id DESC);
      `);
    },
  },
  {
    id: "013_learning_progress_indexes",
    up(db) {
      // Progress reads filter by user/course/event type and then de-duplicate
      // completed lessons. Keep that path covered as the event stream grows.
      db.exec(`
        CREATE INDEX IF NOT EXISTS learning_events_user_course_type_lesson_idx
          ON learning_events (user_id, course_slug, event_type, lesson_number);
      `);
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
