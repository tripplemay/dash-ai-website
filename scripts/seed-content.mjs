// 将当前静态课程内容导入内容治理表。
// 用法：DASH_AUTH_DB=/path/to/dash-auth.db node scripts/seed-content.mjs [--faq-only] [--publish-release]
// 默认导入 zh；可通过 CONTENT_LOCALE=en 等覆盖 locale（翻译内容应在后续编辑流程中补齐）。
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrate.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const dbPath = process.env.DASH_AUTH_DB || path.join(ROOT, "dash-auth.db");
const locale = (process.env.CONTENT_LOCALE || "zh").trim();
if (!/^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?$/.test(locale)) {
  throw new Error("CONTENT_LOCALE must be a BCP-47-like locale (for example zh or en-US)");
}

function usage() {
  return "Usage: node scripts/seed-content.mjs [--faq-only] [--publish-release]";
}

function parseArgs(argv) {
  let faqOnly = false;
  let publishRelease = false;
  for (const arg of argv) {
    if (arg === "--faq-only") faqOnly = true;
    else if (arg === "--publish-release") publishRelease = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }
  if (publishRelease && !faqOnly) {
    throw new Error(`--publish-release requires --faq-only\n${usage()}`);
  }
  return { faqOnly, publishRelease };
}

const options = parseArgs(process.argv.slice(2));

const COURSE_CATALOG = [
  {
    slug: "s0",
    lab: "EXPERIENCE ENTRY",
    name: "AI 体验",
    age: "按能力进阶",
    count: "3 课次",
    intro: "三次试听体验课，每课完成一件可以带走的 AI 作品：会识别人脸的程序、会开口说话的数字人、一本会动的绘本故事。在玩中建立对 AI 的第一直觉。",
    modules: ["AI 人脸识别", "AI 数字人制作", "AI 绘本故事"],
    outcome: "动态绘本视频 · 数字人视频 · 人脸识别程序",
    reality: "三节体验课分别对应 AI 绘本生成、数字人技术与计算机视觉三类入门应用，让首次接触 AI 的孩子在体验中建立兴趣、直觉并自然衔接正式课程。",
  },
  {
    slug: "drawing",
    lab: "CREATIVE DIRECTION",
    name: "AI 绘图",
    age: "按能力进阶",
    count: "8 课次",
    intro: "八次课走完一条完整创作线：从卡通自画像、水彩花园梦到城堡与未来交通工具，学习提示词表达、风格探索与版本迭代，最终把作品集结出版为原创绘本。",
    modules: ["自我表达", "场景创作", "主题设计", "绘本出版"],
    outcome: "迭代系列画作 · 原创迷你绘本 · 提示词与版本记录",
    reality: "对应真实的文生图提示词工程、风格控制、图像编辑与绘本出版流程，锻炼视觉表达、迭代和版本管理能力。",
  },
  {
    slug: "voice",
    lab: "CREATIVE DIRECTION",
    name: "AI 配音",
    age: "按能力进阶",
    count: "8 课次",
    intro: "从工具入门到情感表达：调节参数、塑造角色、掌握 SSML 高级控制，了解声音克隆的合规使用，最终完成多场景声音作品并建立个人音频素材库。",
    modules: ["工具入门", "情感表达", "个性定制", "综合应用"],
    outcome: "完整配音作品 · 授权声音模型 · 整理音频素材库",
    reality: "对应 TTS 语音合成、情感参数调节、SSML 标记语言、声纹克隆原理与伦理、音频后期等真实技术，覆盖声音表达与合规使用意识。",
  },
  {
    slug: "video",
    lab: "CREATIVE DIRECTION",
    name: "AI 视频",
    age: "按能力进阶",
    count: "12 课次",
    intro: "十二次课从单镜头走到完整短片：提示词进阶、画面一致性控制、多镜头叙事与视听合成，再到封面标题、品牌打造与电商实战，全程贯穿版权与合规意识。",
    modules: ["入门进阶", "叙事控制", "合成打造", "实战合规"],
    outcome: "分镜表 · 多镜头短片 · 素材版权记录",
    reality: "对应文生视频提示词、镜头一致性控制、多镜头叙事、视听合成、封面标题设计与版权合规，覆盖短视频全流程创作。",
  },
  {
    slug: "python",
    lab: "ENGINEERING DIRECTION",
    name: "Python 基础",
    age: "按能力进阶",
    count: "11 课次",
    intro: "十一次课建立编程语言基本功：从输入输出、变量与数据类型，到条件分支、循环控制与核心数据结构，每课都有能当场运行的小练习，为 App 开发与数据分析打底。",
    modules: ["语法起步", "流程控制", "数据结构", "综合练习"],
    outcome: "可运行代码 · 系列练习成果 · 解题过程记录",
    reality: "对应 Python 语法体系（变量、数据类型、分支、循环、数据结构），训练编程基本功与逻辑拆解能力，为 App 开发与数据分析打底。",
  },
  {
    slug: "app",
    lab: "ENGINEERING DIRECTION",
    name: "AI App 开发",
    age: "按能力进阶",
    count: "20 课次",
    intro: "二十次课完整走完一个 App 的诞生：界面组件、样式布局、数据渲染、JS 逻辑、云端数据库、组件封装，直到 UI 精修、电商实操与综合演练，最终发布并公开演示。",
    modules: ["界面基础", "数据逻辑", "云端进阶", "封装发布"],
    outcome: "版本化应用 · 源代码 · 测试用例 · 发布演示",
    reality: "对应 App 全流程开发——组件、布局、数据渲染、云端数据库、网络请求、组件封装与 UI 设计，训练完整的软件工程思维与项目交付能力。",
  },
  {
    slug: "data",
    lab: "ENGINEERING DIRECTION",
    name: "AI 数据分析",
    age: "按能力进阶",
    count: "20 课次",
    intro: "二十次课走完数据分析师的完整路径：数据思维、Python 工具链、获取与清洗、统计指标、可视化与交互仪表盘，最后在真实销售数据实战中完成一份决策报告。",
    modules: ["数据思维", "工具筑基", "清洗统计", "可视实战"],
    outcome: "分析笔记 · 可视化图表 · 数据看板 · 决策报告",
    reality: "对应 Jupyter/NumPy/Pandas 技术栈、数据获取与清洗、统计分析与可视化，训练证据推理、数据表达与决策报告撰写能力。",
  },
  {
    slug: "drone",
    lab: "ENGINEERING DIRECTION",
    name: "AI 无人机创客",
    age: "按能力进阶",
    count: "40 课次",
    intro: "四十次课横跨六大模块：行业认知与安全规范、空气动力学与仿真训练、ESP32 底层编程、传感器与数据调试、机械组装与出厂检测，最终真机飞行并通过两阶段综合考核。",
    modules: ["认知仿真", "底层编程", "传感调试", "组装考核"],
    outcome: "组装完成的设备 · 故障排查记录 · 飞行评估证据",
    reality: "对应无人机行业认知、ESP32 嵌入式编程、陀螺仪/气压计/磁力计等传感器原理、整机组装与真机试飞考核，训练真实工程全流程与安全规范意识。",
  },
  {
    slug: "theory",
    lab: "LITERACY DIRECTION",
    name: "AI 素养与智能原理",
    age: "按能力进阶",
    count: "13 课次",
    intro: "十三次课用游戏化实验理解 AI 的核心原理：从图灵测试、机器学习分类到神经网络与强化学习，再到推荐系统与群体智能，并始终讨论准确率陷阱、伦理与风险判断。",
    modules: ["原理启蒙", "核心算法", "进阶探索", "系统应用"],
    outcome: "模型实验 · 指标对比 · 风险判断 · 学习反思",
    reality: "以游戏化实验讲解图灵测试、机器学习分类、神经网络、强化学习、模型评估、推荐系统与群体智能，让孩子理解 AI 的原理、边界与责任。",
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const parentFaq = readJson("content/parent-faq.zh.json");
const FAQ_SOURCE_PATH = "content/parent-faq.zh.json";
const RELEASE_FAQ_SOURCES = new Set([FAQ_SOURCE_PATH, "src/lib/data.ts"]);

function stableJson(value) {
  return JSON.stringify(value);
}

function entryId(type, slug, entryLocale = locale) {
  return `${type}:${slug}:${entryLocale}`;
}

function upsertEntry(db, { type, slug, payload, entryLocale = locale }) {
  const id = entryId(type, slug, entryLocale);
  const current = db
    .prepare("SELECT id, status, revision FROM content_entries WHERE content_type = ? AND slug = ? AND locale = ?")
    .get(type, slug, entryLocale);
  if (!current) {
    db.prepare(
      `INSERT INTO content_entries (id, content_type, slug, locale, status, revision)
       VALUES (?, ?, ?, ?, 'draft', 1)`
    ).run(id, type, slug, entryLocale);
    db.prepare(
      `INSERT INTO content_revisions (id, entry_id, revision, locale, payload, status)
       VALUES (?, ?, 1, ?, ?, 'draft')`
    ).run(`${id}:r1`, id, entryLocale, stableJson(payload));
    db.prepare(
      `INSERT INTO audit_events (id, entity_type, entity_id, action, revision, to_status, metadata)
       VALUES (?, ?, ?, 'seed.imported', 1, 'draft', '{}')`
    ).run(`${id}:audit:r1`, type, id);
    return { id, changed: true, revision: 1 };
  }

  const latest = db
    .prepare("SELECT revision, payload FROM content_revisions WHERE entry_id = ? ORDER BY revision DESC LIMIT 1")
    .get(current.id);
  const serialized = stableJson(payload);
  if (latest?.payload === serialized) return { id: current.id, changed: false, revision: latest.revision };

  const revision = Math.max(Number(current.revision) || 0, Number(latest?.revision) || 0) + 1;
  db.prepare(
    `INSERT INTO content_revisions (id, entry_id, revision, locale, payload, status)
     VALUES (?, ?, ?, ?, ?, 'draft')`
  ).run(`${current.id}:r${revision}`, current.id, revision, entryLocale, serialized);
  db.prepare(
    `UPDATE content_entries
     SET status = 'draft', revision = ?, reviewer_id = NULL, published_at = NULL, updated_at = datetime('now')
     WHERE id = ?`
  ).run(revision, current.id);
  db.prepare(
    `INSERT OR IGNORE INTO audit_events (id, entity_type, entity_id, action, revision, from_status, to_status, metadata)
     VALUES (?, ?, ?, 'seed.updated', ?, ?, 'draft', '{}')`
  ).run(`${current.id}:audit:r${revision}`, type, current.id, revision, current.status);
  return { id: current.id, changed: true, revision };
}

function parsePayload(payload) {
  try {
    const value = JSON.parse(payload);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function isReleaseOwnedFaq(payload) {
  return typeof payload?.source === "string" && RELEASE_FAQ_SOURCES.has(payload.source);
}

function buildFaqRecords() {
  if (!parentFaq || typeof parentFaq !== "object" || !Array.isArray(parentFaq.groups)) {
    throw new Error(`${FAQ_SOURCE_PATH} must contain a groups array`);
  }
  if (typeof parentFaq.locale !== "string" || !parentFaq.locale.trim()) {
    throw new Error(`${FAQ_SOURCE_PATH} must define locale`);
  }

  let order = 0;
  return parentFaq.groups.flatMap((group) => {
    if (!group || typeof group !== "object" || !Array.isArray(group.items)) {
      throw new Error(`${FAQ_SOURCE_PATH} contains an invalid FAQ group`);
    }
    return group.items.map((item) => {
      order += 1;
      return {
        slug: item.slug,
        payload: {
          kind: "faq",
          slug: item.slug,
          group: group.id,
          groupTitle: group.title,
          order,
          question: item.question,
          lead: item.lead,
          paragraphs: item.paragraphs,
          parentTip: item.parentTip,
          source: FAQ_SOURCE_PATH,
          sourceDocument: parentFaq.source,
          sourceVersion: parentFaq.version,
        },
      };
    });
  });
}

const FAQ_RECORDS = buildFaqRecords();
const faqLocale = parentFaq.locale.trim();

function latestRevision(db, entryIdValue) {
  return db
    .prepare(
      `SELECT revision, payload, status
       FROM content_revisions
       WHERE entry_id = ?
       ORDER BY revision DESC
       LIMIT 1`
    )
    .get(entryIdValue);
}

function insertReleaseAudit(db, { entityId, action, revision, fromStatus, toStatus }) {
  db.prepare(
    `INSERT INTO audit_events
     (id, entity_type, entity_id, action, revision, from_status, to_status, metadata)
     VALUES (?, 'faq', ?, ?, ?, ?, ?, ?)`
  ).run(
    `audit:${randomUUID()}`,
    entityId,
    action,
    revision,
    fromStatus,
    toStatus,
    stableJson({ source: FAQ_SOURCE_PATH, sourceVersion: parentFaq.version })
  );
}

function assertFaqEntryIsReleaseOwned(db, entry) {
  if (!entry) return null;
  const latest = latestRevision(db, entry.id);
  if (!latest || !isReleaseOwnedFaq(parsePayload(latest.payload))) {
    throw new Error(`FAQ slug ${entry.slug} is already owned by manually managed content`);
  }
  return latest;
}

function upsertPublishedFaq(db, record) {
  const id = entryId("faq", record.slug, faqLocale);
  const current = db
    .prepare("SELECT id, slug, status, revision FROM content_entries WHERE content_type = 'faq' AND slug = ? AND locale = ?")
    .get(record.slug, faqLocale);
  const serialized = stableJson(record.payload);

  if (!current) {
    db.prepare(
      `INSERT INTO content_entries
       (id, content_type, slug, locale, status, revision, published_at)
       VALUES (?, 'faq', ?, ?, 'published', 1, datetime('now'))`
    ).run(id, record.slug, faqLocale);
    db.prepare(
      `INSERT INTO content_revisions
       (id, entry_id, revision, locale, payload, status, published_at)
       VALUES (?, ?, 1, ?, ?, 'published', datetime('now'))`
    ).run(`${id}:r1`, id, faqLocale, serialized);
    insertReleaseAudit(db, {
      entityId: id,
      action: "release.faq_imported",
      revision: 1,
      fromStatus: null,
      toStatus: "published",
    });
    return { id, changed: true, revision: 1, action: "imported" };
  }

  const latest = assertFaqEntryIsReleaseOwned(db, current);
  if (latest.payload !== serialized) {
    const revision = Math.max(Number(current.revision) || 0, Number(latest.revision) || 0) + 1;
    db.prepare(
      `INSERT INTO content_revisions
       (id, entry_id, revision, locale, payload, status, published_at)
       VALUES (?, ?, ?, ?, ?, 'published', datetime('now'))`
    ).run(`${current.id}:r${revision}`, current.id, revision, faqLocale, serialized);
    db.prepare(
      `UPDATE content_entries
       SET status = 'published', revision = ?, reviewer_id = NULL,
           published_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(revision, current.id);
    insertReleaseAudit(db, {
      entityId: current.id,
      action: "release.faq_updated",
      revision,
      fromStatus: current.status,
      toStatus: "published",
    });
    return { id: current.id, changed: true, revision, action: "updated" };
  }

  if (current.status === "published" && latest.status === "published" && Number(current.revision) === Number(latest.revision)) {
    return { id: current.id, changed: false, revision: latest.revision, action: "unchanged" };
  }

  db.prepare(
    `UPDATE content_entries
     SET status = 'published', revision = ?, reviewer_id = NULL,
         published_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(latest.revision, current.id);
  db.prepare(
    `UPDATE content_revisions
     SET status = 'published', reviewer_id = NULL, published_at = datetime('now')
     WHERE entry_id = ? AND revision = ?`
  ).run(current.id, latest.revision);
  insertReleaseAudit(db, {
    entityId: current.id,
    action: "release.faq_published",
    revision: latest.revision,
    fromStatus: current.status,
    toStatus: "published",
  });
  return { id: current.id, changed: true, revision: latest.revision, action: "published" };
}

function archiveStaleReleaseFaq(db, currentSlugs) {
  const rows = db
    .prepare(
      `SELECT e.id, e.slug, e.locale, e.status, r.revision AS latest_revision,
              r.payload, r.status AS revision_status
       FROM content_entries e
       LEFT JOIN content_revisions r
         ON r.entry_id = e.id
        AND r.revision = (
          SELECT MAX(latest.revision) FROM content_revisions latest WHERE latest.entry_id = e.id
        )
       WHERE e.content_type = 'faq'`
    )
    .all();
  let archived = 0;
  for (const row of rows) {
    const isCurrentFaq = row.locale === faqLocale && currentSlugs.has(row.slug);
    if (isCurrentFaq || !isReleaseOwnedFaq(parsePayload(row.payload))) continue;
    if (row.status === "archived" && row.revision_status === "archived") continue;

    db.prepare(
      `UPDATE content_entries
       SET status = 'archived', updated_at = datetime('now')
       WHERE id = ?`
    ).run(row.id);
    if (Number(row.latest_revision) > 0) {
      db.prepare(
        `UPDATE content_revisions
         SET status = 'archived'
         WHERE entry_id = ? AND revision = ?`
      ).run(row.id, row.latest_revision);
    }
    insertReleaseAudit(db, {
      entityId: row.id,
      action: "release.faq_archived",
      revision: row.latest_revision,
      fromStatus: row.status,
      toStatus: "archived",
    });
    archived += 1;
  }
  return archived;
}

function seedFaqDrafts(db) {
  const summary = { faq: 0, revisions: 0, archived: 0 };
  for (const record of FAQ_RECORDS) {
    const current = db
      .prepare("SELECT id, slug FROM content_entries WHERE content_type = 'faq' AND slug = ? AND locale = ?")
      .get(record.slug, faqLocale);
    assertFaqEntryIsReleaseOwned(db, current);
    const result = upsertEntry(db, {
      type: "faq",
      slug: record.slug,
      payload: record.payload,
      entryLocale: faqLocale,
    });
    summary.faq += 1;
    if (result.changed) summary.revisions += 1;
  }
  summary.archived = archiveStaleReleaseFaq(db, new Set(FAQ_RECORDS.map((record) => record.slug)));
  return summary;
}

function publishFaqRelease(db) {
  const summary = { faq: 0, revisions: 0, imported: 0, updated: 0, published: 0, archived: 0 };
  for (const record of FAQ_RECORDS) {
    const result = upsertPublishedFaq(db, record);
    summary.faq += 1;
    if (result.changed) summary.revisions += 1;
    if (result.action in summary) summary[result.action] += 1;
  }
  summary.archived = archiveStaleReleaseFaq(db, new Set(FAQ_RECORDS.map((record) => record.slug)));
  return summary;
}

function seedContent(db) {
  const summary = { course: 0, lesson: 0, faq: 0, revisions: 0, references: 0, archived: 0 };
  const courseIds = new Map();
  for (const course of COURSE_CATALOG) {
    const result = upsertEntry(db, {
      type: "course",
      slug: course.slug,
      payload: { kind: "course", ...course, source: "src/lib/data.ts" },
    });
    courseIds.set(course.slug, result.id);
    summary.course += 1;
    if (result.changed) summary.revisions += 1;
  }

  const lessons = readJson("scripts/lessons-content.json");
  for (const [courseSlug, courseLessons] of Object.entries(lessons)) {
    const courseId = courseIds.get(courseSlug) || entryId("course", courseSlug);
    for (const lesson of courseLessons) {
      const slug = `${courseSlug}-${lesson.n}`;
      const result = upsertEntry(db, {
        type: "lesson",
        slug,
        payload: { kind: "lesson", courseSlug, ...lesson, source: "scripts/lessons-content.json" },
      });
      summary.lesson += 1;
      if (result.changed) summary.revisions += 1;
      const referenceId = `ref:${courseId}:${result.id}:contains`;
      db.prepare(
        `INSERT OR IGNORE INTO content_references
         (id, from_entry_id, to_entry_id, reference_type, metadata)
         VALUES (?, ?, ?, 'contains', '{}')`
      ).run(referenceId, courseId, result.id);
      summary.references += 1;
    }
  }

  const faqSummary = seedFaqDrafts(db);
  summary.faq = faqSummary.faq;
  summary.revisions += faqSummary.revisions;
  summary.archived = faqSummary.archived;
  return summary;
}

const database = new Database(dbPath, { timeout: 30000 });
database.pragma("busy_timeout = 30000");
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
try {
  runMigrations(database);
  // Content seeding can run before Better Auth's first migration on a fresh
  // staging database. Foreign keys are still declared in the schema; defer
  // enforcement until the auth `user` table exists rather than blocking the
  // owner-null static import.
  const hasUserTable = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user'")
    .get();
  if (!hasUserTable) database.pragma("foreign_keys = OFF");
  const summary = database.transaction(() => {
    if (options.publishRelease) return publishFaqRelease(database);
    if (options.faqOnly) return seedFaqDrafts(database);
    return seedContent(database);
  })();
  console.log(JSON.stringify({ locale, faqLocale, mode: options.publishRelease ? "faq-release" : options.faqOnly ? "faq-draft" : "full", ...summary }, null, 2));
} finally {
  database.close();
}
