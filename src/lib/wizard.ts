// 课件向导推荐规则（确定性）：年龄段 × 兴趣方向 × 基础 → 入门课程推荐。
// 依据世界观 v3 多入口原则：低龄创想、高龄工程、兴趣优先、体验课兜底。

import { COURSE_ENTRIES, CourseEntry, LABS } from "./data";
import type { CourseSlug } from "./lessons";

export type WizardAge = "a1" | "a2" | "a3" | "a4"; // 5–8 / 9–10 / 11–13 / 14–16
export type WizardInterest = "create" | "code" | "hardware" | "unsure";
export type WizardLevel = "none" | "some" | "pro"; // 零基础 / 学过一点 / 有项目经验

export interface WizardResult {
  /** 主推荐（含所属实验室） */
  primary: CourseEntry;
  /** 一句话推荐理由（引用年龄段与兴趣，各组合单独撰写） */
  reason: string;
  /** 建议路径：起点 → 进阶 → 目标认证 */
  path: [string, string, string];
  /** 备选/并列推荐（跳级、过渡或双方向） */
  secondary?: CourseEntry;
  /** 备选引导语，如「过渡建议」「也可以考虑」 */
  secondaryLabel?: string;
  /** 兴趣=还不确定：展示三大实验室一句话简介 */
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
  // 创作表达 → 创想实验室
  if (interest === "create") {
    if (age === "a1")
      return base("drawing", "5–8 岁 + 喜欢画画：从 AI 绘图开始，8 次课完成一本出版级个人绘本，成就感来得最快。", ["体验中心", "AI 绘图", "AI 创作者"]);
    if (age === "a2")
      return base("voice", "9–10 岁 + 喜欢表达：从 AI 配音开始，8 次课完成一部自己声演的有声绘本。", ["体验中心", "AI 配音", "AI 创作者"]);
    if (age === "a3")
      return base("video", "11–13 岁 + 喜欢影像：从 AI 视频开始，12 次课完成一组个人创意短片集。", ["体验中心", "AI 视频", "AI 创作者"]);
    return base("video", "14–16 岁 + 喜欢创作：从 AI 视频开始，12 次课走完短视频全流程，含商业级实战与版权合规。", ["体验中心", "AI 视频", "AI 创作者"]);
  }

  // 编程与逻辑 → 工程实验室（低龄先体验课兜底）
  if (interest === "code") {
    if (age === "a1") {
      const r = base("s0", "5–8 岁不建议直接敲代码：先入体验中心，3 次课建立对 AI 的直观认知，再平滑过渡到编程。", ["体验中心", "AI 绘图", "AI 创作者"]);
      r.secondary = bySlug("drawing");
      r.secondaryLabel = "过渡建议";
      return r;
    }
    if (level === "pro") {
      const r = base("app", "有项目经验 + 喜欢编程：直接从 APP 开发开始，20 次课完成一款真实上线的小程序。", ["APP 开发", "AI 数据分析", "AI 工程师"]);
      r.secondary = bySlug("data");
      r.secondaryLabel = "也可以考虑";
      return r;
    }
    if (level === "some") {
      const r = base("python", "学过一点 + 喜欢逻辑：可从 Python 基础后半程跳级切入，也可直接挑战 APP 开发。", ["Python 基础", "APP 开发", "AI 工程师"]);
      r.secondary = bySlug("app");
      r.secondaryLabel = "也可以考虑";
      return r;
    }
    return base("python", "零基础 + 喜欢逻辑：从 Python 基础开始，11 次课从变量写到数据结构，独立写出 5 个程序。", ["Python 基础", "APP 开发", "AI 工程师"]);
  }

  // 硬件与动手 → 远征实验室
  if (interest === "hardware") {
    if (age === "a1" || age === "a2") {
      const r = base("theory", "10 岁以下 + 喜欢动手：从趣味益智 · AI 原理开始，13 次游戏化实验先读懂 AI，满 10 岁再衔接无人机。", ["趣味益智 · AI 原理", "无人机创客", "AI 研究员"]);
      r.secondary = bySlug("drone");
      r.secondaryLabel = "满 10 岁可选";
      return r;
    }
    return base("drone", "喜欢动手 + 10 岁以上：直接进无人机创客，40 次课从仿真飞行做到真机组装试飞，训练量在同类课程中罕见。", ["无人机创客", "趣味益智 · AI 原理", "AI 研究员"]);
  }

  // 还不确定 → 体验中心兜底 + 三大实验室速览
  const r = base("s0", "还没方向：先约 3 节体验课，绘本生成 / 数字人 / 人脸识别各体验一次，再按孩子的现场兴趣选实验室。", ["体验中心", "三大实验室", "九证集齐"]);
  r.showLabs = true;
  return r;
}

/** 三大实验室一句话简介（兴趣=还不确定 时展示） */
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
