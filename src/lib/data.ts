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

export interface Resource {
  cat: string;
  name: string;
  file: string;
  thumb: string;
  spec: string;
  usage: string;
  dir?: boolean;
}

export const RESOURCE_CATS = ["全部", "课程海报", "招募物料", "证书手册", "社媒", "品牌资产", "吉祥物", "课件模板"];

export const RESOURCES: Resource[] = [
  { cat: "课程海报", name: "创想实验室海报", file: "/files/海报/实验室海报-1.png", thumb: "/assets/ext/实验室海报-1.png", spec: "4032×1920 · 横版", usage: "横幅/电视屏/宣传栏" },
  { cat: "课程海报", name: "工程实验室海报", file: "/files/海报/实验室海报-2.png", thumb: "/assets/ext/实验室海报-2.png", spec: "4032×1920 · 横版", usage: "横幅/电视屏/宣传栏" },
  { cat: "课程海报", name: "远征实验室海报", file: "/files/海报/实验室海报-3.png", thumb: "/assets/ext/实验室海报-3.png", spec: "4032×1920 · 横版", usage: "横幅/电视屏/宣传栏" },
  { cat: "课程海报", name: "课程体系全景图（竖版长图）", file: "/files/海报/课程体系全景宣传图-v2.png", thumb: "/assets/ext/课程体系全景宣传图-v2.png", spec: "2880×4480 · 竖版", usage: "朋友圈长图/展架" },
  { cat: "课程海报", name: "课程体系全景图（横版）", file: "/files/海报/课程体系全景宣传图-v3.png", thumb: "/assets/ext/课程体系全景宣传图-v3.png", spec: "4032×1920 · 横版", usage: "官网首屏/横屏展示" },
  { cat: "课程海报", name: "课程体系总览（九宫格版）", file: "/files/海报/课程体系全景宣传图.png", thumb: "/assets/ext/课程体系全景宣传图.png", spec: "2880×3240", usage: "宣传册内页/公众号" },
  { cat: "招募物料", name: "体验课招募海报", file: "/files/招募物料/01-体验课招募海报-3x4.png", thumb: "/files/招募物料/01-体验课招募海报-3x4.png", spec: "2160×2880 · 3:4", usage: "小红书/朋友圈/A3 打印" },
  { cat: "招募物料", name: "招生长图", file: "/files/招募物料/02-招生长图-9x16.png", thumb: "/files/招募物料/02-招生长图-9x16.png", spec: "1800×3200 · 9:16", usage: "朋友圈长图/咨询转发" },
  { cat: "招募物料", name: "易拉宝", file: "/files/招募物料/04-易拉宝-800x2000.png", thumb: "/files/招募物料/04-易拉宝-800x2000.png", spec: "1600×4000 · 800×2000mm 等比", usage: "易拉宝印刷（200DPI）" },
  { cat: "招募物料", name: "试听卡邀请函", file: "/files/招募物料/05-试听卡邀请函-1000x630.png", thumb: "/files/招募物料/05-试听卡邀请函-1000x630.png", spec: "2000×1260", usage: "体验课邀约卡（双面彩印）" },
  { cat: "证书手册", name: "结课证书", file: "/files/证书手册/06-结课证书-1120x790.png", thumb: "/files/证书手册/06-结课证书-1120x790.png", spec: "2240×1580 · A4 横版", usage: "A4 横版铜版纸" },
  { cat: "证书手册", name: "家长手册（12 页套图）", file: "/files/证书手册/家长手册/", thumb: "/files/证书手册/家长手册/P0.png", spec: "1588×2246 × 12 页", usage: "A4 骑马钉/咨询台", dir: true },
  { cat: "社媒", name: "公众号头图", file: "/files/招募物料/03-公众号头图-900x383.png", thumb: "/files/招募物料/03-公众号头图-900x383.png", spec: "1800×766 · 900×383 标准", usage: "公众号封面" },
  { cat: "品牌资产", name: "logo 套件（横版/堆叠/单色）", file: "/files/品牌资产/", thumb: "/assets/img/logo/DASH-mark_1024.png", spec: "透明底 PNG · 多尺寸", usage: "招牌/印刷/视频角标", dir: true },
  { cat: "品牌资产", name: "图标集（32 枚）", file: "/files/品牌资产/icons/", thumb: "/assets/icons/rocket.png", spec: "透明底 PNG × 32", usage: "课件/海报点缀", dir: true },
  { cat: "吉祥物", name: "小D 与点点 · 透明底素材包", file: "/files/吉祥物/透明底/", thumb: "/assets/img/mascot/cube-pair-standard.png", spec: "7 个变体 · 透明底 PNG", usage: "贴纸/人偶/课件插图", dir: true },
  { cat: "课件模板", name: "8 套课程 PPT 模板", file: "/files/课件模板/", thumb: "/assets/ext/t-lab-s1.png", spec: "PPTX × 8 · 各 24 页版式", usage: "教师制作课件", dir: true },
];

export interface Slide { img: string; cap: string }

export const SLIDES: Slide[] = [
  { img: "/assets/ext/mkt-hero-poster.png", cap: "品牌主视觉 · 小D 与点点的实验室之旅" },
  { img: "/assets/ext/实验室海报-1.png", cap: "创想实验室 · AI 绘图 / 配音 / 视频" },
  { img: "/assets/ext/实验室海报-2.png", cap: "工程实验室 · Python / APP / 数据分析" },
  { img: "/assets/ext/实验室海报-3.png", cap: "远征实验室 · 无人机 / AI 原理" },
  { img: "/assets/ext/01-体验课招募海报-3x4.png", cap: "体验课招募中 · 0 元预约" },
  { img: "/assets/ext/mkt-rollup-main.png", cap: "三大实验室 · 全息展台" },
  { img: "/assets/ext/课程体系全景宣传图-v3.png", cap: "课程体系全景 · 9 大能力实验室" },
  { img: "/assets/ext/06-结课证书-1120x790.png", cap: "每座实验室 · 都有认证徽章" },
];
