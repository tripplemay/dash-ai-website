// 将当前静态课程内容导入内容治理表。
// 用法：DASH_AUTH_DB=/path/to/dash-auth.db node scripts/seed-content.mjs
// 默认导入 zh；可通过 CONTENT_LOCALE=en 等覆盖 locale（翻译内容应在后续编辑流程中补齐）。
import Database from "better-sqlite3";
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

const FAQ = [
  ["孩子这么小，有必要学 AI 吗？", "AI 正在成为基础能力。我们不教背概念，而是让孩子**用 AI 做出真实作品**——绘本、短片、小程序。"],
  ["AI 课和编程课有什么区别？", "课程覆盖创作、工程与素养三大方向：既用 AI 做作品，也用代码和硬件构建作品，并理解 AI 的原理与边界。"],
  ["和传统机器人课比优势在哪？", "九大课程域从体验、创作、工程到智能原理逐步进阶，135 个课次贯穿同一套五步闭环，每课都留下真实作品与过程证据。"],
  ["九大课程域分别是什么？", "00 AI 体验、01 AI 绘图、02 AI 配音、03 AI 视频、04 AI App 开发、05 AI 无人机创客、06 Python 基础、07 AI 数据分析、08 AI 素养与智能原理。"],
  ["课程按年龄固定吗？", "不绑定固定年龄，课程按内容与能力进阶编排；具体适配建议由课程顾问根据孩子情况给出。"],
  ["需要编程或电脑基础吗？", "不需要。所有课程均从零基础设计，只需要好奇心。"],
  ["上课用什么工具？安全合规吗？", "主流且适合青少年的 AI 工具与编程环境，教研预先筛选并做内容过滤；无人机配安全规范。"],
  ["孩子学完能得到什么？", "带走原创绘本、配音作品、多镜头短片、可上线 App、组装无人机、可运行代码、数据看板与模型实验记录。"],
  ["课程如何培养通用能力？", "四项能力轴贯穿全部课程：创意表达、计算构建、证据推理、责任判断。"],
  ["如何知道孩子学得怎么样？", "每课记录做了什么、怎么想的、如何改进，形成作品、过程与证据三件套。"],
  ["长时间看屏幕伤眼睛吗？", "屏幕+动手交替设计，连续用眼不超过 20–25 分钟，大量实操环节。"],
  ["AI 生成的内容安全吗？", "工具启用青少年过滤，教师全程引导，课程专设版权与合规模块。"],
  ["孩子会沉迷吗？", "以创作任务驱动而非游戏化刺激，把屏幕时间从消费转为生产。"],
  ["老师是什么背景？", "计算机/设计背景教研 + 持证讲师，无人机课由硬件工程经验导师授课。"],
  ["缺课了怎么办？", "支持提前请假与补课（平行班插班或一对一），课件同步给家长。"],
  ["费用与退费政策？", "体验课免费；正式课按阶段报名，开课前全额退，开课后按剩余课时比例退。"],
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", file), "utf8"));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function entryId(type, slug) {
  return `${type}:${slug}:${locale}`;
}

function upsertEntry(db, { type, slug, payload }) {
  const id = entryId(type, slug);
  const current = db
    .prepare("SELECT id, status, revision FROM content_entries WHERE content_type = ? AND slug = ? AND locale = ?")
    .get(type, slug, locale);
  if (!current) {
    db.prepare(
      `INSERT INTO content_entries (id, content_type, slug, locale, status, revision)
       VALUES (?, ?, ?, ?, 'draft', 1)`
    ).run(id, type, slug, locale);
    db.prepare(
      `INSERT INTO content_revisions (id, entry_id, revision, locale, payload, status)
       VALUES (?, ?, 1, ?, ?, 'draft')`
    ).run(`${id}:r1`, id, locale, stableJson(payload));
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
  ).run(`${id}:r${revision}`, current.id, revision, locale, serialized);
  db.prepare(
    `UPDATE content_entries
     SET status = 'draft', revision = ?, reviewer_id = NULL, published_at = NULL, updated_at = datetime('now')
     WHERE id = ?`
  ).run(revision, current.id);
  db.prepare(
    `INSERT OR IGNORE INTO audit_events (id, entity_type, entity_id, action, revision, from_status, to_status, metadata)
     VALUES (?, ?, ?, 'seed.updated', ?, ?, 'draft', '{}')`
  ).run(`${id}:audit:r${revision}`, type, current.id, revision, current.status);
  return { id: current.id, changed: true, revision };
}

function seedContent(db) {
  const summary = { course: 0, lesson: 0, faq: 0, revisions: 0, references: 0 };
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

  const lessons = readJson("lessons-content.json");
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

  FAQ.forEach(([question, answer], index) => {
    const result = upsertEntry(db, {
      type: "faq",
      slug: `faq-${String(index + 1).padStart(2, "0")}`,
      payload: { kind: "faq", order: index + 1, question, answer, source: "src/lib/data.ts" },
    });
    summary.faq += 1;
    if (result.changed) summary.revisions += 1;
  });
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
  const summary = database.transaction(() => seedContent(database))();
  console.log(JSON.stringify({ locale, ...summary }, null, 2));
} finally {
  database.close();
}
