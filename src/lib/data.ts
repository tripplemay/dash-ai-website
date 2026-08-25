// 芯坐标 CORECOORD · 内容数据

import type { CourseSlug } from "./lessons";
import { assetUrl } from "./assets";
import type { CourseStageId } from "./brand";

export interface LabCourse {
  slug: CourseSlug; // 详情页路由 /course/[slug]，对应 lessons-seed.json 键
  stageId: CourseStageId;
  color: string;
  name: string;
  age: string;
  count: string;
  intro: string;
  modules: string[];
  outputs: string[];
  outcome: string;
  reality: string; // 现实锚点（教育版语汇）：对应真实技术、能力与产出，取自世界观 v3 第二章
}

export interface Lab {
  name: string;
  en: string;
  color: string;
  hours: string;
  desc: string;
  courses: LabCourse[];
}

export const LABS: Lab[] = [
  {
    name: "创作方向", en: "CREATIVE DIRECTION", color: "#C93F78", hours: "28 课次",
    desc: "创意表达：图像 · 声音 · 影像",
    courses: [
      { slug: "drawing", stageId: "01", color: "#C93F78", name: "AI 绘图", age: "按能力进阶", count: "8 课次", intro: "八次课走完一条完整创作线：从卡通自画像、水彩花园梦到城堡与未来交通工具，学习提示词表达、风格探索与版本迭代，最终把作品集结出版为原创绘本。", modules: ["自我表达", "场景创作", "主题设计", "绘本出版"], outputs: ["迭代系列画作", "原创迷你绘本", "提示词与版本记录"], outcome: "迭代系列画作 · 原创迷你绘本 · 提示词与版本记录", reality: "对应真实的文生图提示词工程、风格控制、图像编辑与绘本出版流程，锻炼视觉表达、迭代和版本管理能力。" },
      { slug: "voice", stageId: "02", color: "#7257D9", name: "AI 配音", age: "按能力进阶", count: "8 课次", intro: "从工具入门到情感表达：调节参数、塑造角色、掌握 SSML 高级控制，了解声音克隆的合规使用，最终完成多场景声音作品并建立个人音频素材库。", modules: ["工具入门", "情感表达", "个性定制", "综合应用"], outputs: ["完整配音作品", "授权声音模型", "整理音频素材库"], outcome: "完整配音作品 · 授权声音模型 · 整理音频素材库", reality: "对应 TTS 语音合成、情感参数调节、SSML 标记语言、声纹克隆原理与伦理、音频后期等真实技术，覆盖声音表达与合规使用意识。" },
      { slug: "video", stageId: "03", color: "#1B78C5", name: "AI 视频", age: "按能力进阶", count: "12 课次", intro: "十二次课从单镜头走到完整短片：提示词进阶、画面一致性控制、多镜头叙事与视听合成，再到封面标题、品牌打造与电商实战，全程贯穿版权与合规意识。", modules: ["入门进阶", "叙事控制", "合成打造", "实战合规"], outputs: ["分镜表", "多镜头短片", "素材版权记录"], outcome: "分镜表 · 多镜头短片 · 素材版权记录", reality: "对应文生视频提示词、镜头一致性控制、多镜头叙事、视听合成、封面标题设计与版权合规，覆盖短视频全流程创作。" },
    ],
  },
  {
    name: "工程方向", en: "ENGINEERING DIRECTION", color: "#40549C", hours: "91 课次",
    desc: "计算构建：代码 · 应用 · 硬件 · 数据",
    courses: [
      { slug: "app", stageId: "04", color: "#40549C", name: "AI App 开发", age: "按能力进阶", count: "20 课次", intro: "二十次课完整走完一个 App 的诞生：界面组件、样式布局、数据渲染、JS 逻辑、云端数据库、组件封装，直到 UI 精修、电商实操与综合演练，最终发布并公开演示。", modules: ["界面基础", "数据逻辑", "云端进阶", "封装发布"], outputs: ["版本化应用", "源代码", "测试用例", "发布演示"], outcome: "版本化应用 · 源代码 · 测试用例 · 发布演示", reality: "对应 App 全流程开发——组件、布局、数据渲染、云端数据库、网络请求、组件封装与 UI 设计，训练完整的软件工程思维与项目交付能力。" },
      { slug: "drone", stageId: "05", color: "#1E9A91", name: "AI 无人机创客", age: "按能力进阶", count: "40 课次", intro: "四十次课横跨六大模块：行业认知与安全规范、空气动力学与仿真训练、ESP32 底层编程、传感器与数据调试、机械组装与出厂检测，最终真机飞行并通过两阶段综合考核。", modules: ["认知仿真", "底层编程", "传感调试", "组装考核"], outputs: ["组装完成的设备", "故障排查记录", "飞行评估证据"], outcome: "组装完成的设备 · 故障排查记录 · 飞行评估证据", reality: "对应无人机行业认知、ESP32 嵌入式编程、陀螺仪/气压计/磁力计等传感器原理、整机组装与真机试飞考核，训练真实工程全流程与安全规范意识。" },
      { slug: "python", stageId: "06", color: "#2B9A62", name: "Python 基础", age: "按能力进阶", count: "11 课次", intro: "十一次课建立编程语言基本功：从输入输出、变量与数据类型，到条件分支、循环控制与核心数据结构，每课都有能当场运行的小练习，为 App 开发与数据分析打底。", modules: ["语法起步", "流程控制", "数据结构", "综合练习"], outputs: ["可运行代码", "系列练习成果", "解题过程记录"], outcome: "可运行代码 · 系列练习成果 · 解题过程记录", reality: "对应 Python 语法体系（变量、数据类型、分支、循环、数据结构），训练编程基本功与逻辑拆解能力，为 App 开发与数据分析打底。" },
      { slug: "data", stageId: "07", color: "#E7A21B", name: "AI 数据分析", age: "按能力进阶", count: "20 课次", intro: "二十次课走完数据分析师的完整路径：数据思维、Python 工具链、获取与清洗、统计指标、可视化与交互仪表盘，最后在真实销售数据实战中完成一份决策报告。", modules: ["数据思维", "工具筑基", "清洗统计", "可视实战"], outputs: ["分析笔记", "可视化图表", "数据看板", "决策报告"], outcome: "分析笔记 · 可视化图表 · 数据看板 · 决策报告", reality: "对应 Jupyter/NumPy/Pandas 技术栈、数据获取与清洗、统计分析与可视化，训练证据推理、数据表达与决策报告撰写能力。" },
    ],
  },
  {
    name: "素养方向", en: "LITERACY DIRECTION", color: "#F16C3E", hours: "13 课次",
    desc: "理解与负责：智能原理 · 伦理判断",
    courses: [
      { slug: "theory", stageId: "08", color: "#F16C3E", name: "AI 素养与智能原理", age: "按能力进阶", count: "13 课次", intro: "十三次课用游戏化实验理解 AI 的核心原理：从图灵测试、机器学习分类到神经网络与强化学习，再到推荐系统与群体智能，并始终讨论准确率陷阱、伦理与风险判断。", modules: ["原理启蒙", "核心算法", "进阶探索", "系统应用"], outputs: ["模型实验", "指标对比", "风险判断", "学习反思"], outcome: "模型实验 · 指标对比 · 风险判断 · 学习反思", reality: "以游戏化实验讲解图灵测试、机器学习分类、神经网络、强化学习、模型评估、推荐系统与群体智能，让孩子理解 AI 的原理、边界与责任。" },
    ],
  },
];

/** 先导中心 · 体验中心（阶段 0）：不进 LABS 主列表，供详情页与逐课大纲引用 */
export const EXPERIENCE: Lab = {
  name: "体验入口", en: "EXPERIENCE ENTRY", color: "#FC7358", hours: "3 课次",
  desc: "打开智能世界的第一课：绘本 · 数字人 · 人脸识别",
  courses: [
    { slug: "s0", stageId: "00", color: "#FC7358", name: "AI 体验", age: "按能力进阶", count: "3 课次", intro: "三次试听体验课，每课完成一件可以带走的 AI 作品：会识别人脸的程序、会开口说话的数字人、一本会动的绘本故事。在玩中建立对 AI 的第一直觉。", modules: ["AI 人脸识别", "AI 数字人制作", "AI 绘本故事"], outputs: ["动态绘本视频", "数字人视频", "人脸识别程序"], outcome: "动态绘本视频 · 数字人视频 · 人脸识别程序", reality: "三节体验课分别对应 AI 绘本生成、数字人技术与计算机视觉三类入门应用，让首次接触 AI 的孩子在体验中建立兴趣、直觉并自然衔接正式课程。" },
  ],
};

/** 课程详情页索引：体验入口 + 三大方向下的九大课程域 */
export interface CourseEntry {
  lab: Lab;
  course: LabCourse;
}
export const COURSE_ENTRIES: CourseEntry[] = [EXPERIENCE, ...LABS]
  .flatMap((lab) => lab.courses.map((course) => ({ lab, course })))
  .sort((a, b) => Number(a.course.stageId) - Number(b.course.stageId));

export const COURSE_CAPABILITIES = [
  { name: "创意表达", detail: "把想法变成图像、声音与影像", color: "#C93F78" },
  { name: "计算构建", detail: "用代码与硬件把想法做成作品", color: "#40549C" },
  { name: "证据推理", detail: "用数据与事实说话", color: "#E7A21B" },
  { name: "责任判断", detail: "安全、合规、负责任地用 AI", color: "#F16C3E" },
] as const;

export const LEARNING_LOOP = ["明确目标", "设计提示", "协作生成", "评估迭代", "展示发布"] as const;

// 资源分类使用稳定 ASCII key 持久化；旧 DASH 分类仅在数据库迁移中保留兼容映射。
export const RESOURCE_CATEGORIES = [
  { key: "brand-system", label: "品牌系统" },
  { key: "guides", label: "使用指南" },
  { key: "visual-previews", label: "视觉预览" },
  { key: "course-templates", label: "课件模板" },
  { key: "marketing-awareness", label: "营销认知" },
  { key: "marketing-conversion", label: "营销转化" },
  { key: "trial-materials", label: "体验课物料" },
] as const;

/** Stable English labels for resource metadata; the key remains the persisted contract. */
export const RESOURCE_CATEGORY_EN: Record<string, string> = {
  "品牌系统": "Brand system",
  "使用指南": "Guides",
  "视觉预览": "Visual previews",
  "课件模板": "Course templates",
  营销认知: "Marketing awareness",
  营销转化: "Marketing conversion",
  "体验课物料": "Trial course materials",
  "课程海报": "Course posters",
  "招募物料": "Recruitment",
  "证书手册": "Certificates",
  社媒: "Social media",
  "品牌资产": "Brand assets",
  吉祥物: "Mascots",
};

export type ResourceCategoryKey = (typeof RESOURCE_CATEGORIES)[number]["key"];

// Export as string arrays because values arrive from URL/form input and must be
// validated at runtime rather than forcing every consumer to cast user input.
export const RESOURCE_CATS: string[] = ["全部", ...RESOURCE_CATEGORIES.map(({ label }) => label)];
export const RESOURCE_CATS_STORE: string[] = RESOURCE_CATEGORIES.map(({ label }) => label);
export const RESOURCE_CATEGORY_KEYS: string[] = RESOURCE_CATEGORIES.map(({ key }) => key);

/** 同时接受稳定 key 与旧版中文 label，供 URL、后台表单和旧数据库平滑过渡。 */
export function resolveResourceCategory(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return RESOURCE_CATEGORIES.find(
    (category) => category.key === normalized || category.label === normalized
  );
}

/**
 * 大屏轮播 slide：判别联合。
 * - image：全屏图片
 * - content：结构化内容页（渲染时引用 LABS / GROWTH / WORK_SLOTS，不硬编码文案）
 */
export type SlideContentKey = "lab-0" | "lab-1" | "lab-2" | "growth" | "works" | "cta";
export type Slide =
  | { type: "image"; img: string; cap: string }
  | { type: "content"; content: SlideContentKey; cap: string };

// 叙事顺序：品牌主视觉 → 三大方向 → 课程体系全景 → 能力框架 → 学员作品 → 证书/展台 → 招募收尾
export const SLIDES: Slide[] = [
  { type: "image", img: "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-presentation-cover-16x9.png", cap: "芯坐标 · 让 AI 成为孩子的超能力" },
  { type: "content", content: "lab-0", cap: "创作方向 · 创意表达" },
  { type: "content", content: "lab-1", cap: "工程方向 · 计算构建" },
  { type: "content", content: "lab-2", cap: "素养方向 · 理解与负责" },
  { type: "image", img: assetUrl("/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-stage-palette.png"), cap: "课程域 · 九个能力坐标" },
  { type: "content", content: "growth", cap: "课程框架 · 四项能力轴" },
  { type: "content", content: "works", cap: "学员作品 · 每个阶段都有真实产出" },
  { type: "image", img: assetUrl("/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-certificate-a4-landscape.png"), cap: "作品、过程与验证 · 可见的成长证据" },
  { type: "image", img: "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-coordinate-field-light.png", cap: "Living Coordinates · 开放路径" },
  { type: "content", content: "cta", cap: "从一个问题出发 · 查看课程项目" },
];

// ================= 课程框架（能力轴与学习闭环） =================

/** 四项能力轴概览（卡片与演示页共用） */
export interface GrowthLayer {
  level: string;
  title: string;
  tagline: string;
  points: string[];
  color: string;
}
export const GROWTH_LAYERS: GrowthLayer[] = [
  {
    level: "01", title: "创意表达", tagline: "把想法变成图像、声音与影像",
    points: ["AI 绘图 · AI 配音 · AI 视频", "从灵感到真实作品", "记录提示与版本迭代"],
    color: "#C93F78",
  },
  {
    level: "02", title: "计算构建", tagline: "用代码与硬件把想法做成作品",
    points: ["Python · App · 无人机", "从界面、代码到真机", "留下可运行的工程成果"],
    color: "#40549C",
  },
  {
    level: "03", title: "证据推理", tagline: "用数据与事实说话",
    points: ["数据获取、清洗与统计", "可视化图表与数据看板", "写出有依据的决策报告"],
    color: "#E7A21B",
  },
  {
    level: "04", title: "责任判断", tagline: "安全、合规、负责任地用 AI",
    points: ["理解 AI 的原理与边界", "识别准确率、版权与隐私风险", "用证据评估并持续改进"],
    color: "#F16C3E",
  },
];

/** 多入口说明 */
export const GROWTH_ENTRIES = [
  { key: "体验入口", path: "AI 体验 → 按内容与能力选择课程域", note: "三次体验课建立对 AI 的第一直觉" },
  { key: "正式课程", path: "创作 / 工程 / 素养三大方向进阶", note: "不绑定固定年龄，由课程顾问给出适配建议" },
];
export const GROWTH_ENTRIES_NOTE = "课程阶段按内容与能力进阶编排，所有课程贯穿同一套五步闭环";

/** 学员作品墙（占位，结课后替换为真实作品） */
export interface WorkSlot { icon: string; title: string; desc: string }
export const WORK_SLOTS: WorkSlot[] = [
  { icon: "brush", title: "原创迷你绘本", desc: "AI 绘图 · 迭代系列画作与版本记录" },
  { icon: "mic", title: "完整配音作品", desc: "AI 配音 · 授权声音模型与音频素材库" },
  { icon: "video", title: "多镜头短片", desc: "AI 视频 · 分镜表与素材版权记录" },
  { icon: "app", title: "版本化 App", desc: "AI App 开发 · 源代码、测试用例与发布演示" },
  { icon: "drone", title: "组装完成的设备", desc: "AI 无人机创客 · 故障排查记录与飞行评估证据" },
  { icon: "code", title: "可运行代码", desc: "Python 基础 · 系列练习成果与解题过程记录" },
  { icon: "chart", title: "数据看板", desc: "AI 数据分析 · 分析笔记、图表与决策报告" },
  { icon: "shield", title: "模型实验记录", desc: "AI 素养与智能原理 · 指标对比、风险判断与学习反思" },
];
