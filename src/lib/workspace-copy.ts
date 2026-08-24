import type { ResourceDTO, ResourceRow } from "@/lib/db";

export type WorkspaceLocale = "zh" | "en";

const PREVIEW_ROOT = "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews";

export interface WorkspaceLabCopy {
  anchor: "create" | "build" | "explore";
  key: "CREATE LAB" | "BUILD LAB" | "EXPLORE LAB";
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  hours: number;
  ageZh: string;
  ageEn: string;
  color: string;
  preview: string;
}

/** Homepage-facing copy keeps the source course catalogue data language-neutral. */
export const WORKSPACE_LABS: WorkspaceLabCopy[] = [
  {
    anchor: "create",
    key: "CREATE LAB",
    nameZh: "创想实验室",
    nameEn: "Create Lab",
    descriptionZh: "AI 创作力：图像、声音与影像",
    descriptionEn: "AI creative fluency across image, voice, and motion.",
    hours: 28,
    ageZh: "5–14 岁",
    ageEn: "Ages 5–14",
    color: "#C93F78",
    preview: `${PREVIEW_ROOT}/corecoord-presentation-cover-16x9.png`,
  },
  {
    anchor: "build",
    key: "BUILD LAB",
    nameZh: "工程实验室",
    nameEn: "Build Lab",
    descriptionZh: "编程工程力：代码、应用与数据",
    descriptionEn: "Engineering fluency across code, apps, and data.",
    hours: 51,
    ageZh: "10–16 岁",
    ageEn: "Ages 10–16",
    color: "#40549C",
    preview: `${PREVIEW_ROOT}/corecoord-coordinate-field-light.png`,
  },
  {
    anchor: "explore",
    key: "EXPLORE LAB",
    nameZh: "远征实验室",
    nameEn: "Explore Lab",
    descriptionZh: "硬件与 AI 思维：造出飞行器，读懂 AI",
    descriptionEn: "Hardware and AI thinking: build, test, and understand.",
    hours: 53,
    ageZh: "8–16 岁",
    ageEn: "Ages 8–16",
    color: "#1E9A91",
    preview: `${PREVIEW_ROOT}/corecoord-stage-palette.png`,
  },
];

export interface WorkspacePreview {
  key: "cover" | "stages" | "certificate" | "field";
  image: string;
  category: string;
}

export const WORKSPACE_PREVIEWS: WorkspacePreview[] = [
  {
    key: "cover",
    image: `${PREVIEW_ROOT}/corecoord-presentation-cover-16x9.png`,
    category: "visual-previews",
  },
  {
    key: "stages",
    image: `${PREVIEW_ROOT}/corecoord-stage-palette.png`,
    category: "brand-system",
  },
  {
    key: "certificate",
    image: `${PREVIEW_ROOT}/corecoord-certificate-a4-landscape.png`,
    category: "visual-previews",
  },
  {
    key: "field",
    image: `${PREVIEW_ROOT}/corecoord-coordinate-field-light.png`,
    category: "brand-system",
  },
];

const RESOURCE_TITLE_COPY: Record<string, { zh: string; en: string }> = {
  "CORECOORD Logo 套件": { zh: "CORECOORD Logo 套件", en: "CORECOORD logo kit" },
  "CORECOORD 图标与应用图标": { zh: "CORECOORD 图标与应用图标", en: "CORECOORD icons and app marks" },
  "CORECOORD 色彩与坐标图形": { zh: "CORECOORD 色彩与坐标图形", en: "CORECOORD color and coordinate graphics" },
  "CORECOORD VI System 2026.1 手册": { zh: "CORECOORD VI System 2026.1 手册", en: "CORECOORD VI System 2026.1 manual" },
  "CORECOORD VI 预览图集": { zh: "CORECOORD VI 预览图集", en: "CORECOORD VI preview collection" },
  "CORECOORD 课件与印刷模板": { zh: "CORECOORD 课件与印刷模板", en: "CORECOORD course and print templates" },
};

const CATEGORY_COPY: Record<string, { zh: string; en: string }> = {
  品牌系统: { zh: "品牌系统", en: "Brand system" },
  使用指南: { zh: "使用指南", en: "Guides" },
  视觉预览: { zh: "视觉预览", en: "Visual previews" },
  课件模板: { zh: "课件模板", en: "Course templates" },
  课程海报: { zh: "课程海报", en: "Course posters" },
  招募物料: { zh: "招募物料", en: "Recruitment" },
  证书手册: { zh: "证书手册", en: "Certificates" },
  社媒: { zh: "社媒", en: "Social media" },
  品牌资产: { zh: "品牌资产", en: "Brand assets" },
  吉祥物: { zh: "吉祥物", en: "Mascots" },
};

export function localizeResourceTitle(title: string, locale: WorkspaceLocale) {
  return RESOURCE_TITLE_COPY[title]?.[locale] ?? title;
}

export function localizedResourceTitle(resource: Pick<ResourceDTO, "title" | "titleEn"> | Pick<ResourceRow, "title" | "title_en">, locale: WorkspaceLocale) {
  if (locale === "en") {
    const english = "titleEn" in resource ? resource.titleEn : resource.title_en;
    return english || localizeResourceTitle(resource.title, locale);
  }
  return resource.title;
}

export function localizeResourceCategory(category: string, locale: WorkspaceLocale) {
  return CATEGORY_COPY[category]?.[locale] ?? category;
}

const COURSE_TITLE_COPY: Record<string, { zh: string; en: string }> = {
  s0: { zh: "AI 体验课", en: "AI Experience" },
  drawing: { zh: "AI 绘图", en: "AI Drawing" },
  voice: { zh: "AI 配音", en: "AI Voice" },
  video: { zh: "AI 视频", en: "AI Video" },
  python: { zh: "Python 基础", en: "Python Fundamentals" },
  app: { zh: "APP 开发", en: "App Development" },
  data: { zh: "AI 数据分析", en: "AI Data Analysis" },
  drone: { zh: "无人机创客", en: "Drone Maker" },
  theory: { zh: "趣味益智 · AI 原理", en: "AI Principles" },
};

export function localizeCourseTitle(slug: string, fallback: string, locale: WorkspaceLocale) {
  return COURSE_TITLE_COPY[slug]?.[locale] ?? fallback;
}

export function formatWorkspaceDate(value: string, locale: WorkspaceLocale) {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;

  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return locale === "zh" ? "今天" : "Today";
  if (days === 1) return locale === "zh" ? "昨天" : "Yesterday";
  if (days < 30) return locale === "zh" ? `${days} 天前` : `${days} days ago`;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function resourceActivityItem(resource: ResourceDTO | ResourceRow, locale: WorkspaceLocale) {
  const title = localizedResourceTitle(resource as ResourceDTO & ResourceRow, locale);
  const categoryEn = "categoryEn" in resource ? resource.categoryEn : resource.category_en;
  const category =
    locale === "en" && categoryEn
      ? categoryEn
      : localizeResourceCategory(resource.category, locale);
  return {
    id: String(resource.id),
    title,
    meta: [category, resource.format, formatWorkspaceDate("updatedAt" in resource ? resource.updatedAt : resource.updated_at, locale)]
      .filter(Boolean)
      .join(" · "),
    href: `/resources/${resource.id}`,
  };
}
