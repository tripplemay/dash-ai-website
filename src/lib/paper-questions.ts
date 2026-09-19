import "server-only";
import raw from "../../scripts/papers-questions.json";
import type { PaperQuestion, PaperQuestionSet } from "./paper-questions-domain";

export * from "./paper-questions-domain";

const content = raw as { generatedAt: string; sets: Record<string, PaperQuestionSet> };

export const PAPER_QUESTIONS_GENERATED_AT = content.generatedAt;

/** 某份试卷的完整题目集（含答案，仅服务端可用） */
export function getQuestionSet(paperId: string): PaperQuestionSet | null {
  return content.sets[paperId] ?? null;
}

export function getQuestionSetForPaper(paperId: string): PaperQuestion[] {
  return content.sets[paperId]?.questions ?? [];
}

/** paperId → 题目数（SSG 页面角标用） */
export function getQuestionCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [paperId, set] of Object.entries(content.sets)) {
    counts.set(paperId, set.questions.length);
  }
  return counts;
}

export function findQuestion(paperId: string, questionId: string): PaperQuestion | null {
  return getQuestionSetForPaper(paperId).find((question) => question.id === questionId) ?? null;
}
