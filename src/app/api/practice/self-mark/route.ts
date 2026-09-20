import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { selfMarkAnswer } from "@/lib/practice";
import { json, NO_STORE_HEADERS, passesSameOrigin, readSession, responseForError } from "@/lib/practice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 解答题自评 / 错题掌握标记：更新该用户该题最新作答的 is_correct（幂等，重复同值结果一致） */
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
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const paperId = typeof body.paperId === "string" ? body.paperId : "";
  const isCorrect = body.isCorrect === 1 || body.isCorrect === true ? 1 : body.isCorrect === 0 || body.isCorrect === false ? 0 : null;
  if (!questionId || !paperId || isCorrect === null) return json({ error: "INVALID_BODY" }, 400);

  try {
    const answer = selfMarkAnswer({ userId: session.user.id, paperId, questionId, isCorrect });
    return json({ data: { answer } });
  } catch (error) {
    return responseForError(error);
  }
}
