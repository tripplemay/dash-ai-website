import { NextRequest } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { findQuestion } from "@/lib/paper-questions";
import { findPaperMaterial } from "@/lib/papers";
import { listWrongAnswers } from "@/lib/practice";
import { json, readSession, responseForError } from "@/lib/practice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;

/** 错题本：每题取最新作答、is_correct=0 者，联题目内容与所属试卷返回（自评/重练翻正后自动移出） */
export async function GET(request: NextRequest) {
  if (AUTH_DISABLED) return json({ data: [], items: [] });

  const session = await readSession(request);
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);

  try {
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit && /^\d+$/.test(rawLimit) ? Math.min(Math.max(1, Number(rawLimit)), MAX_LIMIT) : 100;
    const wrongs = listWrongAnswers(session.user.id, limit);
    const items = wrongs.map((answer) => {
      const question = findQuestion(answer.paperId, answer.questionId);
      const material = findPaperMaterial(answer.paperId);
      return {
        ...answer,
        question: question
          ? {
              seq: question.seq,
              type: question.type,
              stem: question.stem,
              options: question.options ?? null,
              correctAnswer: question.answer,
              explanation: question.explanation ?? null,
              points: question.points,
            }
          : null,
        paper: material ? { paperId: answer.paperId, title: material.material.title, competition: material.nameZh, slug: material.slug } : null,
      };
    });
    return json({ data: items, items });
  } catch (error) {
    return responseForError(error);
  }
}
