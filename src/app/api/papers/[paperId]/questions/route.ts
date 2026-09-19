import { NextRequest } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { getQuestionSetForPaper, sanitizeQuestion } from "@/lib/paper-questions";
import { findPaperMaterial } from "@/lib/papers";
import { json, readSession } from "@/lib/practice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 下发试卷题目（脱敏：不含答案/解析）。登录合作伙伴可用。
 * 判分与答案揭晓走 /api/practice/answer（提交后才返回正确答案）。
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  const material = findPaperMaterial(paperId);
  if (!material) return json({ error: "PAPER_NOT_FOUND" }, 404);

  const questions = getQuestionSetForPaper(paperId);
  if (questions.length === 0) return json({ error: "QUESTIONS_NOT_FOUND" }, 404);

  if (!AUTH_DISABLED) {
    const session = await readSession(request);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
  }

  const autoGradablePoints = questions.filter((question) => question.type !== "essay").reduce((sum, question) => sum + question.points, 0);
  return json({
    data: {
      paperId,
      title: material.material.title,
      competition: { slug: material.slug, nameZh: material.nameZh },
      totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
      autoGradablePoints,
      questions: questions.map(sanitizeQuestion),
    },
  });
}
