/** CORECOORD / 芯坐标 brand baseline 2026.1. */

export const BRAND = {
  nameZh: "芯坐标",
  nameEn: "CORECOORD",
  taglineZh: "有方向的创造",
  taglineEn: "Create with direction.",
  reverseBackground: "#121A33",
  coreIndigo: "#22367B",
  signalCoral: "#FC7358",
  wordmarkOrange: "#F16C3E",
} as const;

export type CourseStageId = "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";

export interface CourseStage {
  id: CourseStageId;
  nameZh: string;
  nameEn: string;
  accent: string;
  strong: string;
  soft: string;
  onAccent: string;
}

export const CORECOORD_STAGES: Record<CourseStageId, CourseStage> = {
  "00": { id: "00", nameZh: "AI 初体验", nameEn: "Experience", accent: "#FC7358", strong: "#8F2D22", soft: "#FFF0EC", onAccent: "#171C25" },
  "01": { id: "01", nameZh: "视觉创作", nameEn: "Visual", accent: "#C93F78", strong: "#8E2555", soft: "#FDECF3", onAccent: "#FFFFFF" },
  "02": { id: "02", nameZh: "声音表达", nameEn: "Voice", accent: "#7257D9", strong: "#4932A1", soft: "#F1EEFF", onAccent: "#FFFFFF" },
  "03": { id: "03", nameZh: "动态叙事", nameEn: "Motion", accent: "#1B78C5", strong: "#155A91", soft: "#ECF6FF", onAccent: "#FFFFFF" },
  "04": { id: "04", nameZh: "应用构建", nameEn: "App", accent: "#40549C", strong: "#22367B", soft: "#EEF1FB", onAccent: "#FFFFFF" },
  "05": { id: "05", nameZh: "智能硬件", nameEn: "Maker", accent: "#1E9A91", strong: "#116A65", soft: "#E7F8F6", onAccent: "#171C25" },
  "06": { id: "06", nameZh: "编程创造", nameEn: "Code", accent: "#2B9A62", strong: "#17613B", soft: "#EAF8F0", onAccent: "#171C25" },
  "07": { id: "07", nameZh: "数据推理", nameEn: "Data", accent: "#E7A21B", strong: "#754B00", soft: "#FFF7E4", onAccent: "#171C25" },
  "08": { id: "08", nameZh: "AI 素养", nameEn: "Literacy", accent: "#F16C3E", strong: "#7F2D17", soft: "#FFF0E9", onAccent: "#171C25" },
};

export const CORECOORD_ASSET_ROOT = "/assets/brand/corecoord/2026.1";
const CORECOORD_RELEASE_QUERY = "?__corecoord_release=2026.1";
const CORECOORD_HORIZONTAL_LOGO_PATH = `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-logo-horizontal-color.svg`;
export const CORECOORD_LOGO = {
  // Keep the primary lockup on a fresh edge-cache key while legacy negative entries age out.
  horizontal: `${CORECOORD_HORIZONTAL_LOGO_PATH}${CORECOORD_RELEASE_QUERY}`,
  horizontalReverse: `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-logo-horizontal-reverse.svg`,
  stacked: `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-logo-stacked-color.svg`,
  stackedReverse: `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-logo-stacked-reverse.svg`,
  mark: `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-mark-color.svg`,
  markReverse: `${CORECOORD_ASSET_ROOT}/logo-final-2026/vector/corecoord-mark-reverse.svg`,
} as const;

export const CORECOORD_COORDINATE_FIELD = `${CORECOORD_ASSET_ROOT}/vi-system-2026/deliverables/assets/svg/corecoord-coordinate-field-light.svg`;

export const COURSE_STAGE_BY_SLUG: Record<string, CourseStageId> = {
  s0: "00",
  drawing: "01",
  voice: "02",
  video: "03",
  app: "04",
  drone: "05",
  python: "06",
  data: "07",
  theory: "08",
};

/** Resolve a stage token from data-driven accent values (case/whitespace tolerant). */
export function courseStageForColor(color: string | null | undefined): CourseStage | undefined {
  const normalized = color?.trim().toUpperCase();
  if (!normalized) return undefined;
  return Object.values(CORECOORD_STAGES).find((stage) => stage.accent.toUpperCase() === normalized);
}

/** Foreground color for text placed directly on a stage accent background. */
export function stageOnAccent(color: string | null | undefined, fallback = "#FFFFFF"): string {
  return courseStageForColor(color)?.onAccent ?? fallback;
}
