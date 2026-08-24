// 课件向导推荐规则（确定性）：学习状态 × 兴趣方向 × 基础 → 入门课程推荐。
// 课程手册不绑定固定年龄；这里使用学习状态作为适配建议的输入。

import { COURSE_ENTRIES, CourseEntry, LABS } from "./data";
import type { CourseSlug } from "./lessons";

export type WizardAge = "a1" | "a2" | "a3" | "a4"; // 新接触 / 创作经验 / 编程基础 / 项目经验
export type WizardInterest = "create" | "code" | "hardware" | "unsure";
export type WizardLevel = "none" | "some" | "pro"; // 零基础 / 学过一点 / 有项目经验

export interface WizardResult {
  /** 主推荐（含所属方向） */
  primary: CourseEntry;
  /** 一句话推荐理由（引用学习状态与兴趣，各组合单独撰写） */
  reason: string;
  /** 建议路径：起点 → 进阶 → 目标认证 */
  path: [string, string, string];
  /** 备选/并列推荐（跳级、过渡或双方向） */
  secondary?: CourseEntry;
  /** 备选引导语，如「过渡建议」「也可以考虑」 */
  secondaryLabel?: string;
  /** 兴趣=还不确定：展示三大方向一句话简介 */
  showLabs: boolean;
  /** 课件模板资源匹配关键词（标题/路径包含匹配） */
  tplKey: string;
}

const bySlug = (slug: CourseSlug): CourseEntry => {
  const e = COURSE_ENTRIES.find((x) => x.course.slug === slug);
  if (!e) throw new Error(`unknown course slug: ${slug}`);
  return e;
};

/** 各课程的课件模板匹配关键词 */
const TPL_KEY: Record<CourseSlug, string> = {
  s0: "体验",
  drawing: "绘图",
  voice: "配音",
  video: "视频",
  python: "Python",
  app: "APP",
  data: "数据分析",
  drone: "无人机",
  theory: "益智",
};

function base(slug: CourseSlug, reason: string, path: [string, string, string]): WizardResult {
  return { primary: bySlug(slug), reason, path, showLabs: false, tplKey: TPL_KEY[slug] };
}

/** 兴趣=编程与逻辑 或 硬件与动手 时才有第 3 问 */
export function needsLevel(interest: WizardInterest): boolean {
  return interest === "code" || interest === "hardware";
}

export function recommend(
  age: WizardAge,
  interest: WizardInterest,
  level?: WizardLevel
): WizardResult {
  // 创作表达 → 创作方向
  if (interest === "create") {
    if (age === "a1")
      return base("drawing", "首次接触 AI + 喜欢画画：从 AI 绘图开始，8 次课完成原创迷你绘本，建立视觉表达与版本迭代习惯。", ["AI 体验", "AI 绘图", "创意表达"]);
    if (age === "a2")
      return base("voice", "有创作表达经验 + 喜欢声音：从 AI 配音开始，8 次课完成完整配音作品，学习角色塑造与合规使用。", ["AI 体验", "AI 配音", "创意表达"]);
    if (age === "a3")
      return base("video", "有编程基础 + 喜欢影像：从 AI 视频开始，12 次课完成多镜头短片，练习叙事控制与版权记录。", ["AI 体验", "AI 视频", "创意表达"]);
    return base("video", "有项目经验 + 喜欢创作：从 AI 视频开始，12 次课走完短片创作与实战合规路径。", ["AI 体验", "AI 视频", "创意表达"]);
  }

  // 编程与逻辑 → 工程方向（新接触时先体验）
  if (interest === "code") {
    if (age === "a1") {
      const r = base("s0", "首次接触 AI 不建议直接进入复杂工程：先完成 3 次 AI 体验，再根据现场兴趣选择课程域。", ["AI 体验", "Python 基础", "计算构建"]);
      r.secondary = bySlug("drawing");
      r.secondaryLabel = "过渡建议";
      return r;
    }
    if (level === "pro") {
      const r = base("app", "有项目经验 + 喜欢编程：直接从 AI App 开发开始，20 次课完成版本化应用并公开演示。", ["AI App 开发", "AI 数据分析", "计算构建"]);
      r.secondary = bySlug("data");
      r.secondaryLabel = "也可以考虑";
      return r;
    }
    if (level === "some") {
      const r = base("python", "有编程基础 + 喜欢逻辑：从 Python 基础巩固语法与数据结构，再进入 AI App 开发。", ["Python 基础", "AI App 开发", "计算构建"]);
      r.secondary = bySlug("app");
      r.secondaryLabel = "也可以考虑";
      return r;
    }
    return base("python", "喜欢逻辑：从 Python 基础开始，11 次课建立语法、流程控制与数据结构基本功。", ["Python 基础", "AI App 开发", "计算构建"]);
  }

  // 硬件与动手 → 工程方向
  if (interest === "hardware") {
    if (age === "a1" || age === "a2") {
      const r = base("theory", "首次接触或已有创作经验 + 喜欢动手：从 AI 素养与智能原理开始，13 次游戏化实验先理解 AI。", ["AI 素养与智能原理", "AI 无人机创客", "责任判断"]);
      r.secondary = bySlug("drone");
      r.secondaryLabel = "也可以考虑";
      return r;
    }
    return base("drone", "有编程基础或项目经验 + 喜欢动手：进入 AI 无人机创客，40 次课从仿真、底层编程做到真机组装与飞行评估。", ["AI 无人机创客", "AI 数据分析", "计算构建"]);
  }

  // 还不确定 → AI 体验兜底 + 三大方向速览
  const r = base("s0", "还没方向：先完成 3 节 AI 体验，绘本、数字人与人脸识别各体验一次，再按现场兴趣选择课程域。", ["AI 体验", "三大方向", "九大课程域"]);
  r.showLabs = true;
  return r;
}

/** 三大方向一句话简介（兴趣=还不确定 时展示） */
export const LAB_SUMMARIES = LABS.map((l) => ({
  name: l.name,
  en: l.en,
  color: l.color,
  desc: l.desc,
}));

/** 课件模板资源匹配：命中 file 类型资源返回下载地址，否则返回 null（回退资源中心分类） */
export interface WizardTemplate {
  id: number;
  title: string;
  kind: string;
  file_key: string;
}

/** 资源中心「课件模板」分类（与 RESOURCE_CATS 一致） */
export const TEMPLATE_CATEGORY = "课件模板";
export const TEMPLATE_FALLBACK = `/resources?cat=${encodeURIComponent(TEMPLATE_CATEGORY)}`;
export function matchTemplate(templates: WizardTemplate[], key: string): string | null {
  const hit = templates.find(
    (r) => r.kind === "file" && (r.title.includes(key) || r.file_key.includes(key))
  );
  return hit ? `/api/download/${hit.id}` : null;
}
