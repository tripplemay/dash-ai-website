// 备赛资料领域模型与展示逻辑（纯类型/函数，客户端与服务端组件共用）。
// 数据由 scripts/papers-content.json 在构建期内联（采集管线见 docs/competition-auto-monitor-20260919.md 同模式）。

export type PaperKind = "paper" | "answer" | "problem" | "rules" | "standard" | "gallery" | "attachment";

export type PaperStage = "初赛" | "预赛" | "联赛" | "复赛" | "省选" | "全国赛" | "决赛" | "总决赛" | "冬令营" | "其他";

export interface PaperFile {
  kind: PaperKind;
  format: string;
  fileKey?: string;
  externalUrl?: string;
  size?: number;
  sha256?: string;
}

export interface PaperMaterial {
  id: string;
  year: number;
  stage: PaperStage;
  grade: string | null;
  title: string;
  files: PaperFile[];
  hasAnswer: boolean;
  source: { name: string; url: string };
  auto?: boolean;
  collectedAt: string;
  disabled?: boolean;
}

export interface CompetitionPapers {
  slug: string;
  nameZh: string;
  category: string;
  moeListIndex: number;
  papers: PaperMaterial[];
}

/** 备赛资料中心页使用的赛事条目（papers 已过滤下架并排序） */
export interface PaperCompetitionEntry {
  slug: string;
  nameZh: string;
  category: string;
  moeListIndex: number;
  papers: PaperMaterial[];
}

export const PAPER_KINDS: PaperKind[] = ["paper", "answer", "problem", "rules", "standard", "gallery", "attachment"];

/** 展示顺序：真题最前，附件最后（与 messages 中 competitions.paperKind* 文案键一一对应） */
export const PAPER_KIND_LABEL_KEYS: Record<PaperKind, string> = {
  paper: "paperKindPaper",
  answer: "paperKindAnswer",
  problem: "paperKindProblem",
  rules: "paperKindRules",
  standard: "paperKindStandard",
  gallery: "paperKindGallery",
  attachment: "paperKindAttachment",
};

export const PAPER_STAGE_ORDER: PaperStage[] = ["初赛", "预赛", "联赛", "复赛", "省选", "全国赛", "决赛", "总决赛", "冬令营", "其他"];

/** 过滤已下架条目（disabled 为人工下架机制） */
export function visiblePapers(papers: PaperMaterial[]): PaperMaterial[] {
  return papers.filter((paper) => !paper.disabled);
}

function stageRank(stage: PaperStage): number {
  const index = PAPER_STAGE_ORDER.indexOf(stage);
  return index === -1 ? PAPER_STAGE_ORDER.length : index;
}

/** 排序：年份倒序 → 阶段进程顺序 → 标题 */
export function sortPapers(papers: PaperMaterial[]): PaperMaterial[] {
  return [...papers].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const stageDiff = stageRank(a.stage) - stageRank(b.stage);
    if (stageDiff !== 0) return stageDiff;
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

/** 按年份分组（组内已排序），返回 [year, materials][] 倒序 */
export function groupPapersByYear(papers: PaperMaterial[]): [number, PaperMaterial[]][] {
  const groups = new Map<number, PaperMaterial[]>();
  for (const paper of sortPapers(papers)) {
    const group = groups.get(paper.year) ?? [];
    group.push(paper);
    groups.set(paper.year, group);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

/** 资料涉及的 kind 集合（用于筛选器选项，按 PAPER_KINDS 顺序） */
export function paperKindsPresent(papers: PaperMaterial[]): PaperKind[] {
  const present = new Set(papers.flatMap((paper) => paper.files.map((file) => file.kind)));
  return PAPER_KINDS.filter((kind) => present.has(kind));
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
