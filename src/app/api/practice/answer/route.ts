import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { findQuestion } from "@/lib/paper-questions";
import { getSessionForUser, submitAnswer } from "@/lib/practice";
import { json, NO_STORE_HEADERS, passesSameOrigin, readSession, responseForError } from "@/lib/practice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 提交一题作答（幂等）：判分落库后返回判分结果与正确答案/解析（提交前答案不下发）。
 * 幂等键重放返回既有结果；同会话同题重复提交 409。
 */
export async function POST(request: NextRequest) {
  if (AUTH_DISABLED) return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
  if (!passesSameOrigin(request)) return json({ error: "CSRF" }, 403);

  const session = await readSession(request);
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  const userAnswer = Array.isArray(body.answer) ? body.answer.join("") : typeof body.answer === "string" ? body.answer : "";
  if (!sessionId || !questionId || !idempotencyKey) return json({ error: "INVALID_BODY" }, 400);

  try {
    const practiceSession = getSessionForUser(sessionId, session.user.id);
    const question = findQuestion(practiceSession.paperId, questionId);
    if (!question) return json({ error: "QUESTION_NOT_FOUND" }, 404);
    const result = submitAnswer({
      userId: session.user.id,
      sessionId,
      question,
      userAnswer,
      idempotencyKey,
    });
    return json(
      {
        data: {
          answer: result.answer,
          grade: result.grade,
          correctAnswer: question.answer,
          explanation: question.explanation ?? null,
        },
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201
    );
  } catch (error) {
    return responseForError(error);
  }
}
