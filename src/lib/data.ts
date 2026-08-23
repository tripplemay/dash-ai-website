// 芯坐标 CORECOORD · 内容数据

import type { CourseSlug } from "./lessons";
import { assetUrl } from "./assets";
import type { CourseStageId } from "./brand";

export interface LabCourse {
  slug: CourseSlug; // 详情页路由 /course/[slug]，对应 lessons-seed.json 键
  stageId: CourseStageId;
  name: string;
  age: string;
  count: string;
  intro: string;
  modules: string[];
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
    name: "创想实验室", en: "CREATE LAB", color: "#C93F78", hours: "28 课时",
    desc: "AI 创作力：图像 · 声音 · 影像",
    courses: [
      { slug: "drawing", stageId: "01", name: "AI 绘图", age: "5–8 岁", count: "8 课", intro: "用 AI 画笔释放想象力：从卡通自画像到完整绘本。", modules: ["卡通自画像", "水彩花园", "动物朋友", "拼贴画", "梦幻城堡", "情绪小怪兽", "未来交通", "绘本出版"], outcome: "一本出版级的个人绘本", reality: "对应真实的文生图提示词工程、风格控制、图像编辑与绘本出版流程，锻炼 AIGC 工具运用与视觉表达能力。结课产出为实体出版绘本《我的实验室日记》。" },
      { slug: "voice", stageId: "02", name: "AI 配音", age: "8–12 岁", count: "8 课", intro: "从声音工具到声音表演，含声音克隆与后期处理。", modules: ["工具入门", "参数调节", "情感表达", "SSML 标签", "声音克隆", "后期处理", "商业变现", "前沿技术"], outcome: "一部自己声演的有声绘本", reality: "对应 TTS 语音合成、情感参数调节、SSML 标记语言、声纹克隆原理与伦理、音频后期等真实技术，覆盖语音技术运用与有声内容制作，并初步认识商业变现场景。结课产出为一部完整的有声绘本/广播剧作品。" },
      { slug: "video", stageId: "03", name: "AI 视频", age: "10–14 岁", count: "12 课", intro: "从单镜头到多镜头叙事的完整影像创作流程。", modules: ["零基础入门", "提示词进阶", "一致性控制", "多镜头叙事", "视听合成", "封面标题", "品牌打造", "影视动画", "电商实战", "版权合规"], outcome: "一组个人创意短片集", reality: "对应文生视频提示词、镜头一致性控制、多镜头叙事、视听合成、封面标题设计与版权合规，覆盖短视频全流程创作与内容品牌意识。结课产出为个人短片集（含一条商业级实战作品）。" },
    ],
  },
  {
    name: "工程实验室", en: "BUILD LAB", color: "#40549C", hours: "51 课时",
    desc: "编程工程力：代码 · 应用 · 数据",
    courses: [
      { slug: "python", stageId: "06", name: "Python 基础", age: "10+ 岁", count: "11 课", intro: "计算思维入门：从变量到数据结构。", modules: ["初识", "输入输出", "变量", "数据类型", "运算符", "条件分支", "循环", "列表元组", "集合字典"], outcome: "五个独立编写的 Python 程序", reality: "对应 Python 语法体系（变量、数据类型、分支、循环、数据结构），训练编程基础与计算思维，衔接后续全部工程课程与信息学竞赛路径。结课产出为 5 个独立编写的 Python 程序。" },
      { slug: "app", stageId: "04", name: "APP 开发", age: "12+ 岁", count: "20 课", intro: "完整的软件工程体验，最终上线真实小程序。", modules: ["环境搭建", "组件", "样式布局", "导航", "数据渲染", "动画", "JS 逻辑", "缓存", "云数据库", "网络请求", "组件封装", "授权", "购物车", "UI 设计", "综合实操"], outcome: "一款上线运行的真实小程序", reality: "对应小程序全流程开发——组件、布局、数据渲染、云数据库、网络请求、组件封装与 UI 设计，训练软件工程思维与完整项目交付能力。结课产出为一款真实上线、可供他人使用的小程序。" },
      { slug: "data", stageId: "07", name: "AI 数据分析", age: "12+ 岁", count: "20 课", intro: "数据科学全流程：获取、清洗、分析、可视化。", modules: ["Jupyter", "Python 语法", "NumPy", "Pandas", "数据获取", "数据清洗", "预处理", "统计分析", "Matplotlib", "Seaborn", "Plotly-Dash", "自动化办公", "综合实战"], outcome: "一份真实数据研究报告", reality: "对应 Jupyter/NumPy/Pandas 技术栈、数据获取与清洗、统计学基础与 Matplotlib/Seaborn/Plotly 可视化，训练数据素养与研究报告撰写能力，技能栈可直接复用于学术与竞赛场景。结课产出为一份基于真实数据集的研究报告。" },
    ],
  },
  {
    name: "远征实验室", en: "EXPLORE LAB", color: "#1E9A91", hours: "53 课时",
    desc: "硬件与 AI 思维：造出飞行器 · 读懂 AI",
    courses: [
      { slug: "drone", stageId: "05", name: "无人机创客", age: "10–16 岁", count: "40 课 · 4 单元", intro: "从行业科普到真机试飞的完整硬件工程训练。", modules: ["行业科普+仿真飞行（1–10）", "ESP32 硬件编程（11–20）", "传感器原理（21–30）", "组装+真机试飞考核（31–40）"], outcome: "一架亲手组装的无人机与试飞执照", reality: "对应无人机行业认知、ESP32 嵌入式编程、陀螺仪/气压计/磁力计等传感器原理、整机组装与真机试飞考核，训练硬件工程能力与安全规范意识；40 课的完整训练量在同类课程中罕见。结课产出为亲手组装的无人机与试飞考核「苍穹执照」。" },
      { slug: "theory", stageId: "08", name: "趣味益智 · AI 原理", age: "8–12 岁", count: "13 课", intro: "以游戏化实验揭开 AI 的运作原理。", modules: ["图灵测试", "机器学习分类", "神经网络", "强化学习", "人脸识别", "贝叶斯过滤", "推荐系统", "语音合成", "数字人", "群体智能", "智慧交通"], outcome: "一张「图灵挑战」认证证书", reality: "以游戏化实验讲解 AI 核心原理——图灵测试、机器学习分类、神经网络、强化学习、贝叶斯过滤、推荐系统、群体智能，让孩子从「使用 AI」升级为「理解 AI」。结课产出为「图灵挑战」AI 原理认证。" },
    ],
  },
];

/** 先导中心 · 体验中心（阶段 0）：不进 LABS 主列表，供详情页与逐课大纲引用 */
export const EXPERIENCE: Lab = {
  name: "体验中心", en: "PILOT CENTER", color: "#FC7358", hours: "3 课时",
  desc: "生成式 AI 第一课：绘本 · 数字人 · 计算机视觉",
  courses: [
    { slug: "s0", stageId: "00", name: "AI 体验课", age: "5–12 岁", count: "3 课", intro: "三次课建立对生成式 AI 的直观认知：AI 绘本生成、AI 数字人、AI 人脸识别。", modules: ["AI 人脸识别", "AI 数字人制作", "AI 绘本故事"], outcome: "见习研究员身份与个人实验地图（能力图谱）建档", reality: "三节体验课分别对应三大 AIGC 入门应用——AI 绘本生成（文生图）、数字人技术、计算机视觉（人脸识别）。让首次接触 AI 的孩子在 3 次课内完成从「好奇」到「上手」的跨越，并建立个人学习档案。" },
  ],
};

/** 课程详情页索引：体验中心 + 三大实验室全部课程的扁平列表 */
export interface CourseEntry {
  lab: Lab;
  course: LabCourse;
}
export const COURSE_ENTRIES: CourseEntry[] = [EXPERIENCE, ...LABS].flatMap((lab) =>
  lab.courses.map((course) => ({ lab, course }))
);

// [question, answer] —— answer 中 **加粗** 会在渲染时高亮
export const FAQ: [string, string][] = [
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

// 资源分类使用稳定 ASCII key 持久化；旧 DASH 分类仅在数据库迁移中保留兼容映射。
export const RESOURCE_CATEGORIES = [
  { key: "brand-system", label: "品牌系统" },
  { key: "guides", label: "使用指南" },
  { key: "visual-previews", label: "视觉预览" },
  { key: "course-templates", label: "课件模板" },
] as const;

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

// 叙事顺序：品牌主视觉 → 三大实验室 → 课程体系全景 → 成长体系 → 学员作品 → 证书/展台 → 招募收尾
export const SLIDES: Slide[] = [
  { type: "image", img: "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-presentation-cover-16x9.png", cap: "芯坐标 · 有方向的创造" },
  { type: "content", content: "lab-0", cap: "创想实验室 · AI 创作力" },
  { type: "content", content: "lab-1", cap: "工程实验室 · 编程工程力" },
  { type: "content", content: "lab-2", cap: "远征实验室 · 硬件与 AI 思维" },
  { type: "image", img: assetUrl("/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-stage-palette.png"), cap: "课程域 · 九个能力坐标" },
  { type: "content", content: "growth", cap: "成长体系 · 能力认证阶梯" },
  { type: "content", content: "works", cap: "学员作品 · 每个阶段都有真实产出" },
  { type: "image", img: assetUrl("/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-certificate-a4-landscape.png"), cap: "作品、过程与验证 · 可见的成长证据" },
  { type: "image", img: "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews/corecoord-coordinate-field-light.png", cap: "Living Coordinates · 开放路径" },
  { type: "content", content: "cta", cap: "从一个问题出发 · 查看课程项目" },
];

// ================= 成长体系（能力认证阶梯） =================
// 内容取自课程基线，使用芯坐标教育语汇（面向家长/合作方）

/** 第一层 · 研究积分 */
export const GROWTH_POINTS = {
  rules: [
    { label: "课堂互动", value: "+2" },
    { label: "作业提交", value: "+5" },
    { label: "优秀作品", value: "+10" },
    { label: "协作贡献", value: "+3" },
  ],
  principles: ["只加不扣，保护每一份参与热情", "周榜即时反馈 + 累计榜长期荣誉", "计入学习档案，参与度量化呈现给家长"],
};

/** 第二层 · 实验室认证徽章：9 枚徽章对应 9 项能力元素 */
export interface GrowthBadge {
  elem: string;   // 能力元素
  lab: string;    // 对应课程/阶段
  color: string;  // 沿用实验室主题色
}
export const GROWTH_BADGES: GrowthBadge[] = [
  { elem: "曙光", lab: "AI 体验课", color: "#FC7358" },
  { elem: "色彩", lab: "AI 绘图", color: "#C93F78" },
  { elem: "声音", lab: "AI 配音", color: "#7257D9" },
  { elem: "光影", lab: "AI 视频", color: "#1B78C5" },
  { elem: "符码", lab: "Python 基础", color: "#2B9A62" },
  { elem: "造物", lab: "APP 开发", color: "#40549C" },
  { elem: "洞察", lab: "AI 数据分析", color: "#E7A21B" },
  { elem: "苍穹", lab: "无人机创客", color: "#1E9A91" },
  { elem: "智慧", lab: "趣味益智 · AI 原理", color: "#F16C3E" },
];

/** 第三层 · 三轨能力称号 */
export interface GrowthTitle {
  name: string;
  alias: string;
  condition: string;
  proof: string;
  color: string;
}
export const GROWTH_TITLES: GrowthTitle[] = [
  { name: "AI 创作者", alias: "创想家", condition: "创想实验室 3 项认证", proof: "个人作品集（绘本 + 有声剧 + 短片），可用于过程展示", color: "#C93F78" },
  { name: "AI 工程师", alias: "架构师", condition: "工程实验室 3 项认证", proof: "小程序 + 数据报告 + 程序集，呈现完整项目交付", color: "#40549C" },
  { name: "AI 研究员", alias: "远征者", condition: "远征实验室 2 项认证", proof: "硬件原型与 AI 原理认证，呈现构建与验证过程", color: "#1E9A91" },
];

/** 四层阶梯概览（卡片与演示页共用） */
export interface GrowthLayer {
  level: string;
  title: string;
  tagline: string;
  points: string[];
  color: string;
}
export const GROWTH_LAYERS: GrowthLayer[] = [
  {
    level: "01", title: "研究积分", tagline: "学习行为积分 · 每节课都在积累",
    points: ["课堂互动 / 作业 / 作品 / 协作均可积分", "只加不扣", "周榜 + 累计榜双榜并行"],
    color: "#FC7358",
  },
  {
    level: "02", title: "实验室认证徽章", tagline: "阶段能力认证 · 九枚徽章",
    points: ["通过实验室全部项目与评估即可获得", "9 枚徽章对应 9 项能力元素", "数字徽章 + 实体徽章 + 能力证书"],
    color: "#1E9A91",
  },
  {
    level: "03", title: "三轨能力称号", tagline: "领域认证 · 创作 / 工程 / 研究",
    points: ["AI 创作者 · 创想 3 证", "AI 工程师 · 工程 3 证", "AI 研究员 · 远征 2 证"],
    color: "#40549C",
  },
  {
    level: "04", title: "九证集齐", tagline: "全阶段认证 · 少年全栈研究员",
    points: ["授予「少年全栈研究员」终级认证", "作品与姓名录入年度「荣誉殿堂」", "升学简历可直接引用的素材"],
    color: "#F16C3E",
  },
];

/** 成长档案（我的实验地图） */
export const GROWTH_PROFILE = {
  reportItems: ["各实验室同步率", "研究积分参与度", "五维能力雷达图", "作品索引"],
  physical: "实体版：A2 实验地图海报 + 每阶段一枚夜光贴纸，9 枚集齐呈现完整实验室全景",
  radarDims: ["想象力", "表达力", "逻辑力", "工程力", "洞察力"],
  radarSample: [86, 78, 84, 72, 90], // 示意数据（百分比）
};

/** 多入口说明 */
export const GROWTH_ENTRIES = [
  { key: "低龄入口（5–8 岁）", path: "体验中心 → 创想实验室启程", note: "激励以研究积分与贴纸为主" },
  { key: "高龄入口（10+ 岁）", path: "体验中心 → 工程实验室启程", note: "激励以徽章与称号为主" },
];
export const GROWTH_ENTRIES_NOTE = "全部路径汇聚于九证集齐，不同入口不影响认证的等效性";

/** 学员作品墙（占位，结课后替换为真实作品） */
export interface WorkSlot { icon: string; title: string; desc: string }
export const WORK_SLOTS: WorkSlot[] = [
  { icon: "brush", title: "学员绘本", desc: "创想实验室 · 出版级个人绘本" },
  { icon: "mic", title: "有声剧作品", desc: "创想实验室 · 声演有声绘本" },
  { icon: "app", title: "上线小程序", desc: "工程实验室 · 真实上线作品" },
  { icon: "drone", title: "无人机作品", desc: "远征实验室 · 组装与试飞记录" },
];
