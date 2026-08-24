/** Shared chapter contract for the directly rendered CORECOORD VI manual. */

export const BRAND_MANUAL_SECTIONS = [
  { id: "cover", zh: "封面", en: "Cover" },
  { id: "system-map", zh: "系统与目录", en: "System map" },
  { id: "brand", zh: "品牌战略", en: "Brand strategy" },
  { id: "education", zh: "教育理念", en: "Education" },
  { id: "visual-concept", zh: "视觉哲学", en: "Visual concept" },
  { id: "logo", zh: "标志系统", en: "Logo system" },
  { id: "color", zh: "色彩系统", en: "Color system" },
  { id: "type", zh: "字体与排版", en: "Type & layout" },
  { id: "layout", zh: "网格与空间", en: "Grid & space" },
  { id: "graphics", zh: "辅助图形", en: "Graphics" },
  { id: "imagery", zh: "影像与图形内容", en: "Imagery" },
  { id: "motion", zh: "动效与声音", en: "Motion & sound" },
  { id: "course", zh: "课程材料", en: "Course materials" },
  { id: "marketing", zh: "营销模板", en: "Marketing templates" },
  { id: "llm", zh: "LLM 生产", en: "LLM production" },
  { id: "qa", zh: "输出与审计", en: "Output & QA" },
  { id: "standards", zh: "标准依据", en: "Standards" },
  { id: "assets", zh: "资产地图", en: "Asset map" },
] as const;

export type BrandManualSectionId = (typeof BRAND_MANUAL_SECTIONS)[number]["id"];

const BRAND_MANUAL_SECTION_IDS = new Set<string>(BRAND_MANUAL_SECTIONS.map((section) => section.id));

export function isBrandManualSectionId(value: unknown): value is BrandManualSectionId {
  return typeof value === "string" && BRAND_MANUAL_SECTION_IDS.has(value);
}
