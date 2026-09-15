export const CAMPUS_SCREEN_VERSION = "20260915";
// Production images travel with the application release, not the shared public volume.
export const CAMPUS_SCREEN_ASSETS = `${process.env.NODE_ENV === "production" ? "/_next/static" : ""}/campus-screen/${CAMPUS_SCREEN_VERSION}`;

export type ScreenIcon = "spark" | "brush" | "voice" | "code" | "film" | "drone" | "app" | "data" | "target" | "prompt" | "iterate" | "show" | "teacher" | "shield" | "globe" | "award" | "book" | "message";
export type ScreenKind = "hero" | "domains" | "paths" | "school" | "works" | "process" | "growth" | "quality" | "opportunities" | "competitions" | "trial" | "contact";
export interface ScreenItem {
  title: string;
  description: string;
  icon: ScreenIcon;
  label?: string;
  certificationName?: string;
  image?: string;
  domainGroup?: "entry" | "creative" | "engineering" | "literacy";
  competitionGroup?: "domestic" | "international";
}
export interface CampusScreenSlide {
  id: string;
  kind: ScreenKind;
  section: string;
  english: string;
  title: string;
  subtitle: string;
  image: string;
  accent: string;
  duration: number;
  takeaway: string;
  items: readonly ScreenItem[];
}

// Empty fields are intentionally omitted from the public screen, never rendered as placeholders.
export const CAMPUS_SCREEN_CONTACT = {
  campusName: "",
  phone: "",
  qrCodeSrc: "",
};

const art = (name: string) => `${CAMPUS_SCREEN_ASSETS}/${name}.webp`;

export const CAMPUS_SCREEN_SLIDES: readonly CampusScreenSlide[] = [
  {
    id: "vision", kind: "hero", section: "芯坐标青少年 AI 素养课程", english: "CREATE YOUR FUTURE",
    title: "让 AI 成为\n孩子的超能力", subtitle: "从兴趣出发，用 AI 创作、编程和解决问题。\n让孩子不仅会用工具，也能解释自己的想法。",
    image: art("hero"), accent: "#68CFFF", duration: 11000,
    takeaway: "从兴趣出发，用作品建立自己的能力坐标。", items: [],
  },
  {
    id: "course-domains", kind: "domains", section: "九大课程域", english: "A MAP OF POSSIBILITIES",
    title: "九大课程域，一张学习地图", subtitle: "从 AI 体验出发，按兴趣与基础，探索创作、工程与素养三个方向。",
    image: art("paths"), accent: "#68CFFF", duration: 18000,
    takeaway: "九个课程域按需组合，不是必须依次学完的九个阶段。",
    items: [
      { title: "AI 体验", description: "认识 AI，建立兴趣", icon: "spark", domainGroup: "entry" },
      { title: "AI 绘图", description: "图像与绘本", icon: "brush", domainGroup: "creative" },
      { title: "AI 配音", description: "声音与角色", icon: "voice", domainGroup: "creative" },
      { title: "AI 视频", description: "镜头与叙事", icon: "film", domainGroup: "creative" },
      { title: "Python 基础", description: "逻辑与程序", icon: "code", domainGroup: "engineering" },
      { title: "AI App 开发", description: "应用与云数据", icon: "app", domainGroup: "engineering" },
      { title: "AI 无人机创客", description: "硬件与飞行", icon: "drone", domainGroup: "engineering" },
      { title: "AI 数据分析", description: "数据与决策", icon: "data", domainGroup: "engineering" },
      { title: "AI 素养与智能原理", description: "理解智能原理，学会责任判断", icon: "shield", domainGroup: "literacy" },
    ],
  },
  {
    id: "starting-points", kind: "paths", section: "学习起点", english: "FIND YOUR START",
    title: "不同的孩子，有不同的起点", subtitle: "结合年龄、兴趣与已有基础，选择适合的学习方向。",
    image: art("paths"), accent: "#68CFFF", duration: 13000,
    takeaway: "可以跨方向探索，不要求每个孩子走同一条路线。",
    items: [
      { title: "体验与创作表达", description: "用图像、声音和故事建立兴趣。", label: "建议 5–9 岁入口", icon: "brush" },
      { title: "编程与工程探索", description: "结合基础，探索应用、硬件与数据项目。", label: "建议 10+ 岁入口", icon: "code" },
    ],
  },
  {
    id: "primary", kind: "school", section: "小学学习", english: "IMAGINE & CREATE",
    title: "把奇思妙想，变成自己的作品", subtitle: "从好奇出发，在创作和游戏实验中认识 AI。",
    image: art("creative"), accent: "#FFB48A", duration: 13000,
    takeaway: "敢于想象，学会表达，也学会负责任地使用 AI。",
    items: [
      { title: "AI 绘图", description: "设计角色与场景，创作自己的绘本。", icon: "brush", label: "图像表达" },
      { title: "AI 配音", description: "塑造声音与情绪，让故事开口说话。", icon: "voice", label: "声音创作" },
      { title: "AI 体验与原理", description: "动手尝试，认识 AI 的能力与边界。", icon: "spark", label: "认知启蒙" },
    ],
  },
  {
    id: "middle", kind: "school", section: "初中学习", english: "CODE & BUILD",
    title: "从会用工具，到做出真实项目", subtitle: "把代码、影像和硬件连接起来，让想法接受实践检验。",
    image: art("engineering"), accent: "#73E0DE", duration: 15000,
    takeaway: "不只问“能不能做出来”，也问“为什么这样设计”。",
    items: [
      { title: "Python 基础", description: "编写程序，训练逻辑与问题拆解。", icon: "code", label: "逻辑" },
      { title: "AI 视频", description: "组织镜头与声音，完成原创短片。", icon: "film", label: "叙事" },
      { title: "无人机创客", description: "从仿真、编程到组装与测试。", icon: "drone", label: "工程" },
      { title: "AI App 开发", description: "制作解决身边问题的交互应用原型。", icon: "app", label: "应用" },
    ],
  },
  {
    id: "high", kind: "school", section: "高中学习", english: "DESIGN & DISCOVER",
    title: "让应用落地，让数据支持判断", subtitle: "基于已有编程基础，完成更完整的应用与研究项目。",
    image: art("research"), accent: "#68CFFF", duration: 13000,
    takeaway: "交付成果 · 保留过程 · 解释判断",
    items: [
      { title: "高级 APP 开发", description: "从界面与逻辑，到云端数据与发布，\n完成可运行的应用作品。", icon: "app", label: "应用实现" },
      { title: "AI 数据分析", description: "从数据获取与清洗，到统计与可视化，\n形成有依据的研究报告。", icon: "data", label: "证据推理" },
    ],
  },
  {
    id: "portfolio", kind: "works", section: "作品成果", english: "IDEAS MADE VISIBLE",
    title: "学到的能力，体现在作品里", subtitle: "从一个想法出发，逐步完成可以展示、运行或讲述的成果。",
    image: art("research"), accent: "#68CFFF", duration: 13000,
    takeaway: "作品之外，更看孩子做了哪些选择、进行了哪些改进。",
    items: [
      { title: "原创绘本", description: "从角色设定到故事画面，\n让想象有自己的表达。", icon: "book", label: "角色 → 场景 → 故事", image: art("creative") },
      { title: "原创短片", description: "从脚本、分镜到视听合成，\n让故事完整呈现。", icon: "film", label: "脚本 → 分镜 → 视听", image: art("hero") },
      { title: "应用作品", description: "从发现问题到设计交互，\n让方案真正运行起来。", icon: "app", label: "需求 → 交互 → 运行", image: art("research") },
    ],
  },
  {
    id: "classroom-method", kind: "process", section: "课堂方法", english: "THINK. MAKE. REFINE.",
    title: "不是点一下生成，而是一步步完成项目", subtitle: "教师引导，孩子动手；AI 是协作工具，不替代思考。",
    image: art("classroom"), accent: "#73E0DE", duration: 15000,
    takeaway: "每节课都有明确任务，完整项目可以跨多节课持续完善。",
    items: [
      { title: "明确目标", description: "我要解决什么问题？", icon: "target", label: "任务与目标" },
      { title: "设计提示", description: "怎样把想法说清楚？", icon: "prompt", label: "提示与方案" },
      { title: "协作生成", description: "动手完成第一个版本。", icon: "spark", label: "作品初版" },
      { title: "评估迭代", description: "哪里可以更好，为什么？", icon: "iterate", label: "修改记录" },
      { title: "展示发布", description: "讲清成果、过程与选择。", icon: "show", label: "成果与表达" },
    ],
  },
  {
    id: "visible-growth", kind: "growth", section: "成长反馈", english: "PROGRESS YOU CAN SEE",
    title: "看见作品，也看见孩子的进步", subtitle: "不只看最后的成品，更看孩子如何尝试、修改和表达。",
    image: art("growth"), accent: "#68CFFF", duration: 13000,
    takeaway: "作品记录 + 修改过程 + 教师反馈，让家校沟通有具体依据。",
    items: [
      { title: "作品变化", description: "从初版到完善版，\n哪里变得更好了？", icon: "book", label: "看得见的变化" },
      { title: "思考过程", description: "为什么这样选择？\n遇到问题怎样调整？", icon: "iterate", label: "说得清的理由" },
      { title: "教师反馈", description: "已经掌握了什么？\n下一步可以挑战什么？", icon: "teacher", label: "有依据的下一步" },
    ],
  },
  {
    id: "teaching-quality", kind: "quality", section: "教学质量", english: "TEACH WITH PURPOSE",
    title: "课程和教学方法，获得众多国内外认证", subtitle: "关注教师的教学能力，也关注课程产品的学习体验。",
    image: art("quality"), accent: "#73E0DE", duration: 20000,
    takeaway: "教师掌控课堂节奏，AI 辅助学习与创作。",
    items: [
      { title: "CCF PTA", certificationName: "编程培训师资认证", description: "由中国计算机学会发起，面向编程教师，综合考核编程能力、教学专业知识与教学实践，关注“会编程，也会教”。", icon: "code", label: "编程教学能力" },
      { title: "ISTE+ASCD", certificationName: "Edtech Leader Certification", description: "面向教育者的教育科技能力认证，通过真实教学实践作品集评价技术融入教学的能力，关注以学生为中心的学习体验。", icon: "teacher", label: "数字教学能力" },
      { title: "ISTE Seal", certificationName: "教育科技产品质量认证", description: "面向课程等教育科技产品的专业评审，关注与 ISTE 标准的一致性、教学设计、可用性与包容性，让技术真正支持学习。", icon: "shield", label: "课程产品质量" },
    ],
  },
  {
    id: "opportunities", kind: "opportunities", section: "后续进阶", english: "EXPLORE WHAT IS NEXT",
    title: "让课堂作品，走向更广阔的舞台", subtitle: "结合兴趣、能力与项目准备，选择适合的进阶机会。",
    image: art("innovation"), accent: "#68CFFF", duration: 14000,
    takeaway: "赛事与认证按相应要求单独准备，不是每个孩子的必经路线。",
    items: [
      { title: "作品展示", description: "讲述创作过程，交流方案，\n回应真实反馈。", icon: "show", label: "表达与交流" },
      { title: "竞赛实践", description: "对接国内外 AI、编程与工程赛事，\n在真实任务中检验能力。", icon: "globe", label: "实践与挑战" },
      { title: "能力认证", description: "按 AICA 等项目要求整理作品、\n过程与表达材料，申请能力评价。", icon: "award", label: "项目能力评价" },
    ],
  },
  {
    id: "global-competitions", kind: "competitions", section: "国内外赛事", english: "FROM CLASSROOM TO WORLD",
    title: "国内外赛事，让作品走向更大舞台", subtitle: "精选 8 项课程可衔接的赛事，覆盖创意表达、编程应用、工程实践与数据研究。",
    image: art("innovation"), accent: "#68CFFF", duration: 24000,
    takeaway: "从课程项目出发，结合年龄、基础与当季规则，选择适合的赛道。",
    items: [
      { title: "全国青少年人工智能辅助生成数字艺术创作者大赛", description: "原创数字艺术与主题表达", icon: "brush", label: "AI 绘图 / 配音 / 视频", competitionGroup: "domestic" },
      { title: "全国青少年人工智能创新挑战赛", description: "智能体与场景方案设计", icon: "app", label: "AI App / Python", competitionGroup: "domestic" },
      { title: "全国青少年无人机大赛", description: "编程控制与飞行任务挑战", icon: "drone", label: "AI 无人机创客", competitionGroup: "domestic" },
      { title: "全国青少年科学探究建模能力大赛", description: "科学问题、建模与验证", icon: "data", label: "AI 数据分析 / Python", competitionGroup: "domestic" },
      { title: "WAICY · 世界青少年人工智能竞赛", description: "用 AI 项目表达创意、解决问题", icon: "spark", label: "AI 创意 / 视频 / 应用", competitionGroup: "international" },
      { title: "Technovation Challenge", description: "用技术方案回应社区需求", icon: "app", label: "AI App / 数据", competitionGroup: "international" },
      { title: "Codeavour · AI 编程与创新创业", description: "以 PictoBlox 开发创新项目", icon: "code", label: "AI 编程 / 平台专项", competitionGroup: "international" },
      { title: "ACSL · 美国计算机科学联赛", description: "计算机基础与编程解题", icon: "target", label: "Python / 算法专项", competitionGroup: "international" },
    ],
  },
  {
    id: "first-experience", kind: "trial", section: "体验课程", english: "MAKE YOUR FIRST MOVE",
    title: "第一次接触 AI，从动手体验开始", subtitle: "结合年龄、基础与兴趣，了解适合的体验主题。",
    image: art("paths"), accent: "#FFB48A", duration: 14000,
    takeaway: "咨询本校课程顾问，了解当前可预约的体验项目。",
    items: [
      { title: "我的卡通自画像", description: "描述自己的想法，\n尝试生成与调整卡通形象。", icon: "brush", label: "创作体验", image: art("trial-elementary") },
      { title: "Python 人脸识别", description: "认识图像识别，\n观察程序如何工作。", icon: "code", label: "编程体验", image: art("trial-middle") },
      { title: "App 界面设计", description: "从一个小需求出发，\n尝试设计应用界面。", icon: "app", label: "应用体验", image: art("trial-high") },
    ],
  },
  {
    id: "visit-us", kind: "contact", section: "咨询与预约", english: "YOUR NEXT CHAPTER",
    title: "找到适合孩子的\nAI 学习起点", subtitle: "告诉我们孩子的年龄、兴趣与学习基础，\n让课程选择更有方向。",
    image: art("paths"), accent: "#68CFFF", duration: 14000,
    takeaway: "芯坐标 CORECOORD · 让 AI 成为孩子的超能力",
    items: [
      { title: "了解适合的课程", description: "从年龄、兴趣与基础出发", icon: "message" },
      { title: "查看作品与教学示例", description: "了解孩子怎样学习与成长", icon: "book" },
      { title: "咨询本校体验安排", description: "选择适合的动手体验项目", icon: "spark" },
    ],
  },
];

export function screenIndexFromSearch(search: string, count = CAMPUS_SCREEN_SLIDES.length) {
  const value = Number(new URLSearchParams(search).get("slide"));
  return Number.isFinite(value) && value >= 1 ? Math.min(Math.floor(value), count) - 1 : 0;
}
