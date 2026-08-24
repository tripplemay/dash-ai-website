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
    lab: "PILOT CENTER",
    name: "AI 体验课",
    age: "5–12 岁",
    count: "3 课",
    intro: "三次课建立对生成式 AI 的直观认知：AI 绘本生成、AI 数字人、AI 人脸识别。",
    modules: ["AI 人脸识别", "AI 数字人制作", "AI 绘本故事"],
    outcome: "见习研究员身份与个人实验地图（能力图谱）建档",
    reality: "三节体验课分别对应三大 AIGC 入门应用——AI 绘本生成（文生图）、数字人技术、计算机视觉（人脸识别）。",
  },
  {
    slug: "drawing",
    lab: "CREATE LAB",
    name: "AI 绘图",
    age: "5–8 岁",
    count: "8 课",
    intro: "用 AI 画笔释放想象力：从卡通自画像到完整绘本。",
    modules: ["卡通自画像", "水彩花园", "动物朋友", "拼贴画", "梦幻城堡", "情绪小怪兽", "未来交通", "绘本出版"],
    outcome: "一本出版级的个人绘本",
    reality: "对应真实的文生图提示词工程、风格控制、图像编辑与绘本出版流程。",
  },
  {
    slug: "voice",
    lab: "CREATE LAB",
    name: "AI 配音",
    age: "8–12 岁",
    count: "8 课",
    intro: "从声音工具到声音表演，含声音克隆与后期处理。",
    modules: ["工具入门", "参数调节", "情感表达", "SSML 标签", "声音克隆", "后期处理", "商业变现", "前沿技术"],
    outcome: "一部自己声演的有声绘本",
    reality: "对应 TTS 语音合成、情感参数调节、SSML 标记语言、声纹克隆原理与伦理。",
  },
  {
    slug: "video",
    lab: "CREATE LAB",
    name: "AI 视频",
    age: "10–14 岁",
    count: "12 课",
    intro: "从单镜头到多镜头叙事的完整影像创作流程。",
    modules: ["零基础入门", "提示词进阶", "一致性控制", "多镜头叙事", "视听合成", "封面标题", "品牌打造", "影视动画", "电商实战", "版权合规"],
    outcome: "一组个人创意短片集",
    reality: "对应文生视频提示词、镜头一致性控制、多镜头叙事、视听合成与版权合规。",
  },
  {
    slug: "python",
    lab: "BUILD LAB",
    name: "Python 基础",
    age: "10+ 岁",
    count: "11 课",
    intro: "计算思维入门：从变量到数据结构。",
    modules: ["初识", "输入输出", "变量", "数据类型", "运算符", "条件分支", "循环", "列表元组", "集合字典"],
    outcome: "五个独立编写的 Python 程序",
    reality: "对应 Python 语法体系，训练编程基础与计算思维，衔接后续工程课程。",
  },
  {
    slug: "app",
    lab: "BUILD LAB",
    name: "APP 开发",
    age: "12+ 岁",
    count: "20 课",
    intro: "完整的软件工程体验，最终上线真实小程序。",
    modules: ["环境搭建", "组件", "样式布局", "导航", "数据渲染", "动画", "JS 逻辑", "缓存", "云数据库", "网络请求", "组件封装", "授权", "购物车", "UI 设计", "综合实操"],
    outcome: "一款上线运行的真实小程序",
    reality: "对应小程序全流程开发，训练软件工程思维与完整项目交付能力。",
  },
  {
    slug: "data",
    lab: "BUILD LAB",
    name: "AI 数据分析",
    age: "12+ 岁",
    count: "20 课",
    intro: "数据科学全流程：获取、清洗、分析、可视化。",
    modules: ["Jupyter", "Python 语法", "NumPy", "Pandas", "数据获取", "数据清洗", "预处理", "统计分析", "Matplotlib", "Seaborn", "Plotly-Dash", "自动化办公", "综合实战"],
    outcome: "一份真实数据研究报告",
    reality: "对应 Jupyter/NumPy/Pandas 技术栈、数据获取与清洗、统计学基础与可视化。",
  },
  {
    slug: "drone",
    lab: "EXPLORE LAB",
    name: "无人机创客",
    age: "10–16 岁",
    count: "40 课 · 4 单元",
    intro: "从行业科普到真机试飞的完整硬件工程训练。",
    modules: ["行业科普+仿真飞行（1–10）", "ESP32 硬件编程（11–20）", "传感器原理（21–30）", "组装+真机试飞考核（31–40）"],
    outcome: "一架亲手组装的无人机与试飞执照",
    reality: "对应无人机行业认知、ESP32 嵌入式编程、传感器原理、整机组装与真机试飞考核。",
  },
  {
    slug: "theory",
    lab: "EXPLORE LAB",
    name: "趣味益智 · AI 原理",
    age: "8–12 岁",
    count: "13 课",
    intro: "以游戏化实验揭开 AI 的运作原理。",
    modules: ["图灵测试", "机器学习分类", "神经网络", "强化学习", "人脸识别", "贝叶斯过滤", "推荐系统", "语音合成", "数字人", "群体智能", "智慧交通"],
    outcome: "一张「图灵挑战」认证证书",
    reality: "以游戏化实验讲解图灵测试、机器学习分类、神经网络、强化学习、推荐系统与群体智能。",
  },
];

const FAQ = [
  ["孩子这么小，有必要学 AI 吗？", "AI 正在成为基础能力。我们不教背概念，而是让孩子**用 AI 做出真实作品**——绘本、短片、小程序。"],
  ["AI 课和编程课有什么区别？", "覆盖三个层次：用 AI 创作（创想）、用代码构建（工程）、理解 AI 原理与硬件（远征）——**会用、会造、会懂**。"],
  ["和传统机器人课比优势在哪？", "以 AI 为主线，学的是生成式 AI 工具链 + 编程 + 硬件 + 数据思维的组合，且每阶段都有可带回家的数字作品。"],
  ["三大实验室分别教什么？", "创想（28 课时：绘图/配音/视频）、工程（51 课时：Python/APP/数据分析）、远征（53 课时：无人机/AI 原理）。"],
  ["不同年龄怎么选入口？", "5–8 岁从创想绘图进入；9–12 岁可选配音/视频或益智；10+ 岁可直接从 Python 进入。"],
  ["需要编程或电脑基础吗？", "不需要。所有课程均从零基础设计，只需要好奇心。"],
  ["上课用什么工具？安全合规吗？", "主流且适合青少年的 AI 工具与编程环境，教研预先筛选并做内容过滤；无人机配安全规范。"],
  ["孩子学完能得到什么？", "真实作品（绘本/短片/小程序/研究报告/无人机）、实验室认证徽章与证书、成长档案。"],
  ["对升学或竞赛有帮助吗？", "不做升学承诺；作品与认证是科创特长的有力佐证，Python 与数据分析衔接信息学竞赛基础。"],
  ["如何知道孩子学得怎么样？", "每阶段提供学习报告（含五维能力雷达图）、参与度数据与作品原件。"],
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
