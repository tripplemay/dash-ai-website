import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { getQuestionSetForPaper } from "@/lib/paper-questions";
import { finishSession, getSessionForUser } from "@/lib/practice";
import { json, NO_STORE_HEADERS, passesSameOrigin, readSession, responseForError } from "@/lib/practice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 交卷：按自动判分题汇总百分比得分（解答题不计入自动分，自评后计入 correct_count），幂等 */
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
  if (!sessionId) return json({ error: "INVALID_BODY" }, 400);

  try {
    const practiceSession = getSessionForUser(sessionId, session.user.id);
    const autoGradablePoints = getQuestionSetForPaper(practiceSession.paperId)
      .filter((question) => question.type !== "essay")
      .reduce((sum, question) => sum + question.points, 0);
    const finished = finishSession(sessionId, session.user.id, autoGradablePoints);
    return json({ data: { session: finished, autoGradablePoints } });
  } catch (error) {
    return responseForError(error);
  }
}
