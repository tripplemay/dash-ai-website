// DASH AI 营销资源站 · 内容数据（平移自 website/*.html 内联 JS）

export interface LabCourse {
  name: string;
  age: string;
  count: string;
  intro: string;
  modules: string[];
  outcome: string;
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
    name: "创想实验室", en: "CREATE LAB", color: "#FF7A45", hours: "28 课时",
    desc: "AI 创作力：图像 · 声音 · 影像",
    courses: [
      { name: "AI 绘图", age: "5–8 岁", count: "8 课", intro: "用 AI 画笔释放想象力：从卡通自画像到完整绘本。", modules: ["卡通自画像", "水彩花园", "动物朋友", "拼贴画", "梦幻城堡", "情绪小怪兽", "未来交通", "绘本出版"], outcome: "一本出版级的个人绘本" },
      { name: "AI 配音", age: "8–12 岁", count: "8 课", intro: "从声音工具到声音表演，含声音克隆与后期处理。", modules: ["工具入门", "参数调节", "情感表达", "SSML 标签", "声音克隆", "后期处理", "商业变现", "前沿技术"], outcome: "一部自己声演的有声绘本" },
      { name: "AI 视频", age: "10–14 岁", count: "12 课", intro: "从单镜头到多镜头叙事的完整影像创作流程。", modules: ["零基础入门", "提示词进阶", "一致性控制", "多镜头叙事", "视听合成", "封面标题", "品牌打造", "影视动画", "电商实战", "版权合规"], outcome: "一组个人创意短片集" },
    ],
  },
  {
    name: "工程实验室", en: "BUILD LAB", color: "#A79BFF", hours: "51 课时",
    desc: "编程工程力：代码 · 应用 · 数据",
    courses: [
      { name: "Python 基础", age: "10+ 岁", count: "11 课", intro: "计算思维入门：从变量到数据结构。", modules: ["初识", "输入输出", "变量", "数据类型", "运算符", "条件分支", "循环", "列表元组", "集合字典"], outcome: "五个独立编写的 Python 程序" },
      { name: "APP 开发", age: "12+ 岁", count: "20 课", intro: "完整的软件工程体验，最终上线真实小程序。", modules: ["环境搭建", "组件", "样式布局", "导航", "数据渲染", "动画", "JS 逻辑", "缓存", "云数据库", "网络请求", "组件封装", "授权", "购物车", "UI 设计", "综合实操"], outcome: "一款上线运行的真实小程序" },
      { name: "AI 数据分析", age: "12+ 岁", count: "20 课", intro: "数据科学全流程：获取、清洗、分析、可视化。", modules: ["Jupyter", "Python 语法", "NumPy", "Pandas", "数据获取", "数据清洗", "预处理", "统计分析", "Matplotlib", "Seaborn", "Plotly-Dash", "自动化办公", "综合实战"], outcome: "一份真实数据研究报告" },
    ],
  },
  {
    name: "远征实验室", en: "EXPLORE LAB", color: "#5E9BFF", hours: "53 课时",
    desc: "硬件与 AI 思维：造出飞行器 · 读懂 AI",
    courses: [
      { name: "无人机创客", age: "10–16 岁", count: "40 课 · 4 单元", intro: "从行业科普到真机试飞的完整硬件工程训练。", modules: ["行业科普+仿真飞行（1–10）", "ESP32 硬件编程（11–20）", "传感器原理（21–30）", "组装+真机试飞考核（31–40）"], outcome: "一架亲手组装的无人机与试飞执照" },
      { name: "趣味益智 · AI 原理", age: "8–12 岁", count: "13 课", intro: "以游戏化实验揭开 AI 的运作原理。", modules: ["图灵测试", "机器学习分类", "神经网络", "强化学习", "人脸识别", "贝叶斯过滤", "推荐系统", "语音合成", "数字人", "群体智能", "智慧交通"], outcome: "一张「图灵挑战」认证证书" },
    ],
  },
];

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

// 资源分类 key（筛选项 / 后台表单共用）。
// 资源条目本身已入库（resources 表），种子数据见 scripts/resources-seed.json。
export const RESOURCE_CATS = ["全部", "课程海报", "招募物料", "证书手册", "社媒", "品牌资产", "吉祥物", "课件模板"];

// 除「全部」外的可入库分类
export const RESOURCE_CATS_STORE = RESOURCE_CATS.slice(1);

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
  { type: "image", img: "/assets/ext/mkt-hero-poster.png", cap: "品牌主视觉 · 小D 与点点的实验室之旅" },
  { type: "content", content: "lab-0", cap: "创想实验室 · AI 创作力" },
  { type: "content", content: "lab-1", cap: "工程实验室 · 编程工程力" },
  { type: "content", content: "lab-2", cap: "远征实验室 · 硬件与 AI 思维" },
  { type: "image", img: "/assets/ext/课程体系全景宣传图-v3.png", cap: "课程体系全景 · 9 大能力实验室" },
  { type: "content", content: "growth", cap: "成长体系 · 能力认证阶梯" },
  { type: "content", content: "works", cap: "学员作品 · 每个阶段都有真实产出" },
  { type: "image", img: "/assets/ext/06-结课证书-1120x790.png", cap: "每座实验室 · 都有认证徽章" },
  { type: "image", img: "/assets/ext/mkt-rollup-main.png", cap: "三大实验室 · 全息展台" },
  { type: "content", content: "cta", cap: "体验课招募中 · 0 元预约" },
];

// ================= 成长体系（能力认证阶梯） =================
// 内容取自《DASH-AI世界观与成长体系-v3.md》第四章，教育版语汇（面向家长/合作方）

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
  { elem: "曙光", lab: "AI 体验课", color: "#00B8D9" },
  { elem: "色彩", lab: "AI 绘图", color: "#FF7A45" },
  { elem: "声音", lab: "AI 配音", color: "#FF7A45" },
  { elem: "光影", lab: "AI 视频", color: "#FF7A45" },
  { elem: "符码", lab: "Python 基础", color: "#A79BFF" },
  { elem: "造物", lab: "APP 开发", color: "#A79BFF" },
  { elem: "洞察", lab: "AI 数据分析", color: "#A79BFF" },
  { elem: "苍穹", lab: "无人机创客", color: "#5E9BFF" },
  { elem: "智慧", lab: "趣味益智 · AI 原理", color: "#5E9BFF" },
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
  { name: "AI 创作者", alias: "创想家", condition: "创想实验室 3 项认证", proof: "个人作品集（绘本 + 有声剧 + 短片），可直接用于特长展示", color: "#FF7A45" },
  { name: "AI 工程师", alias: "架构师", condition: "工程实验室 3 项认证", proof: "上线小程序 + 数据报告 + 程序集，对接科创类竞赛与活动", color: "#A79BFF" },
  { name: "AI 研究员", alias: "远征者", condition: "远征实验室 2 项认证", proof: "苍穹执照 + AI 原理认证，硬件与思维的双重证明", color: "#5E9BFF" },
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
    color: "#00B8D9",
  },
  {
    level: "02", title: "实验室认证徽章", tagline: "阶段能力认证 · 九枚徽章",
    points: ["通过实验室全部项目与评估即可获得", "9 枚徽章对应 9 项能力元素", "数字徽章 + 实体徽章 + 能力证书"],
    color: "#5E9BFF",
  },
  {
    level: "03", title: "三轨能力称号", tagline: "领域认证 · 创作 / 工程 / 研究",
    points: ["AI 创作者 · 创想 3 证", "AI 工程师 · 工程 3 证", "AI 研究员 · 远征 2 证"],
    color: "#A79BFF",
  },
  {
    level: "04", title: "九证集齐", tagline: "全阶段认证 · 少年全栈研究员",
    points: ["授予「少年全栈研究员」终级认证", "作品与姓名录入年度「荣誉殿堂」", "升学简历可直接引用的素材"],
    color: "#FF7A45",
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
