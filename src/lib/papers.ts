import "server-only";
import raw from "../../scripts/papers-content.json";
import {
  sortPapers,
  visiblePapers,
  type CompetitionPapers,
  type PaperCompetitionEntry,
  type PaperMaterial,
} from "./paper-domain";

export * from "./paper-domain";

const content = raw as { generatedAt: string; competitions: CompetitionPapers[] };
export const PAPERS_GENERATED_AT = content.generatedAt;

const papersMap = new Map(content.competitions.map((item) => [item.slug, item]));

/** 某赛事的可见备赛资料（年份倒序、阶段进程顺序） */
export function getCompetitionPapers(slug: string): PaperMaterial[] {
  const item = papersMap.get(slug);
  if (!item) return [];
  return sortPapers(visiblePapers(item.papers));
}

export function getCompetitionPaperCount(slug: string): number {
  return getCompetitionPapers(slug).length;
}

/** 全站资料计数（slug → 可见资料数），供列表页角标使用 */
export function getPaperCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of content.competitions) {
    counts.set(item.slug, visiblePapers(item.papers).length);
  }
  return counts;
}

/** 有可见资料的赛事列表（按教育部名单顺序），供备赛资料中心页使用 */
export function listPaperCompetitions(): PaperCompetitionEntry[] {
  return content.competitions
    .map((item) => ({
      slug: item.slug,
      nameZh: item.nameZh,
      category: item.category,
      moeListIndex: item.moeListIndex,
      papers: sortPapers(visiblePapers(item.papers)),
    }))
    .filter((item) => item.papers.length > 0)
    .sort((a, b) => a.moeListIndex - b.moeListIndex);
}

/** 按 paperId 查找资料（含所属赛事），供练习页/练习 API 定位题目所属试卷 */
export function findPaperMaterial(paperId: string): { slug: string; nameZh: string; material: PaperMaterial } | null {
  for (const item of content.competitions) {
    const material = visiblePapers(item.papers).find((paper) => paper.id === paperId);
    if (material) return { slug: item.slug, nameZh: item.nameZh, material };
  }
  return null;
}
