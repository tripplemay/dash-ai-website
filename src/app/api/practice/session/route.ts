import { NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/auth";
import { getQuestionSetForPaper } from "@/lib/paper-questions";
import { findPaperMaterial } from "@/lib/papers";
import { createOrResumeSession } from "@/lib/practice";
import { json, NO_STORE_HEADERS, passesSameOrigin, readSession, responseForError } from "@/lib/practice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 开始/继续练习：同用户同卷同模式复用 active 会话（断点续练），返回会话与已答记录 */
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

  const paperId = typeof body.paperId === "string" ? body.paperId : "";
  const mode = body.mode === "review" ? "review" : "practice";
  if (!paperId || !findPaperMaterial(paperId)) return json({ error: "PAPER_NOT_FOUND" }, 404);
  const questions = getQuestionSetForPaper(paperId);
  if (questions.length === 0) return json({ error: "QUESTIONS_NOT_FOUND" }, 404);

  try {
    const result = createOrResumeSession(session.user.id, paperId, mode, questions.length);
    return json({ data: result }, result.resumed ? 200 : 201);
  } catch (error) {
    return responseForError(error);
  }
}
