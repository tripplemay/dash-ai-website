// 真题练习 DB 访问层：会话、逐题作答（幂等）、交卷判分、错题本、解答题自评。
// 题目内容在 papers-questions.json（构建期内联），本层只处理用户进度数据。

import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { gradeAnswer, type GradeResult, type PaperQuestion } from "@/lib/paper-questions-domain";

export type PracticeSession = {
  sessionId: string;
  userId: string;
  paperId: string;
  mode: "practice" | "review";
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  score: number | null;
  status: "active" | "finished";
  startedAt: string;
  finishedAt: string | null;
};

export type PracticeAnswer = {
  answerId: string;
  sessionId: string;
  paperId: string;
  questionId: string;
  questionSeq: number;
  questionType: string;
  userAnswer: string;
  isCorrect: 0 | 1 | null;
  selfMarked: 0 | 1;
  score: number | null;
  answeredAt: string;
};

export class PracticeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PracticeError";
    this.code = code;
  }
}

type SessionRow = {
  session_id: string;
  user_id: string;
  paper_id: string;
  mode: "practice" | "review";
  total_questions: number;
  answered_count: number;
  correct_count: number;
  score: number | null;
  status: "active" | "finished";
  started_at: string;
  finished_at: string | null;
};

type AnswerRow = {
  answer_id: string;
  session_id: string;
  user_id: string;
  paper_id: string;
  question_id: string;
  question_seq: number;
  question_type: string;
  user_answer: string;
  is_correct: 0 | 1 | null;
  self_marked: 0 | 1;
  score: number | null;
  answered_at: string;
};

function toSession(row: SessionRow): PracticeSession {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    paperId: row.paper_id,
    mode: row.mode,
    totalQuestions: row.total_questions,
    answeredCount: row.answered_count,
    correctCount: row.correct_count,
    score: row.score,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function toAnswer(row: AnswerRow): PracticeAnswer {
  return {
    answerId: row.answer_id,
    sessionId: row.session_id,
    paperId: row.paper_id,
    questionId: row.question_id,
    questionSeq: row.question_seq,
    questionType: row.question_type,
    userAnswer: row.user_answer,
    isCorrect: row.is_correct,
    selfMarked: row.self_marked,
    score: row.score,
    answeredAt: row.answered_at,
  };
}

function requireValidKey(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 8 || value.length > 200) {
    throw new PracticeError("INVALID_IDEMPOTENCY_KEY", `${field} must be 8-200 chars`);
  }
}

/** 取得或创建进行中的练习会话（同用户同卷同模式复用 active 会话实现断点续练） */
export function createOrResumeSession(userId: string, paperId: string, mode: "practice" | "review", totalQuestions: number) {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT * FROM practice_sessions
       WHERE user_id = ? AND paper_id = ? AND mode = ? AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`
    )
    .get(userId, paperId, mode) as SessionRow | undefined;
  if (existing) {
    return { session: toSession(existing), resumed: true, answers: listSessionAnswers(existing.session_id) };
  }
  const sessionId = randomUUID();
  db.prepare(
    `INSERT INTO practice_sessions (session_id, user_id, paper_id, mode, total_questions)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, userId, paperId, mode, totalQuestions);
  const row = db.prepare(`SELECT * FROM practice_sessions WHERE session_id = ?`).get(sessionId) as SessionRow;
  return { session: toSession(row), resumed: false, answers: [] as PracticeAnswer[] };
}

export function getSessionForUser(sessionId: string, userId: string): PracticeSession {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM practice_sessions WHERE session_id = ?`).get(sessionId) as SessionRow | undefined;
  if (!row) throw new PracticeError("SESSION_NOT_FOUND", "session not found");
  if (row.user_id !== userId) throw new PracticeError("USER_MISMATCH", "session belongs to another user");
  return toSession(row);
}

export function listSessionAnswers(sessionId: string): PracticeAnswer[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM practice_answers WHERE session_id = ? ORDER BY question_seq ASC`).all(sessionId) as AnswerRow[];
  return rows.map(toAnswer);
}

/**
 * 提交一题作答：判分 → 幂等落库 → 更新会话计数。
 * 幂等：同 idempotency_key 重放返回既有结果；同会话同题只允许多次提交中的第一次（409）。
 */
export function submitAnswer(input: {
  userId: string;
  sessionId: string;
  question: PaperQuestion;
  userAnswer: string;
  idempotencyKey: string;
}): { answer: PracticeAnswer; grade: GradeResult; replayed: boolean } {
  requireValidKey(input.idempotencyKey, "idempotencyKey");
  const db = getDb();
  const session = getSessionForUser(input.sessionId, input.userId);
  if (session.status !== "active") throw new PracticeError("SESSION_FINISHED", "session already finished");
  const replay = db.prepare(`SELECT * FROM practice_answers WHERE idempotency_key = ?`).get(input.idempotencyKey) as AnswerRow | undefined;
  if (replay) {
    if (replay.user_id !== input.userId) throw new PracticeError("USER_MISMATCH", "idempotency key belongs to another user");
    return {
      answer: toAnswer(replay),
      grade: { isCorrect: replay.is_correct, earnedPoints: replay.score ?? 0 },
      replayed: true,
    };
  }

  const duplicate = db
    .prepare(`SELECT answer_id FROM practice_answers WHERE session_id = ? AND question_id = ?`)
    .get(input.sessionId, input.question.id) as { answer_id: string } | undefined;
  if (duplicate) throw new PracticeError("ALREADY_ANSWERED", "question already answered in this session");

  const grade = gradeAnswer(input.question, input.userAnswer);
  const answerId = randomUUID();
  const insert = db.prepare(
    `INSERT INTO practice_answers
       (answer_id, session_id, user_id, paper_id, question_id, question_seq, question_type, user_answer, is_correct, score, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const bump = db.prepare(
    `UPDATE practice_sessions
     SET answered_count = answered_count + 1,
         correct_count = correct_count + ?,
         updated_at = datetime('now')
     WHERE session_id = ?`
  );
  const tx = db.transaction(() => {
    insert.run(
      answerId,
      input.sessionId,
      input.userId,
      session.paperId,
      input.question.id,
      input.question.seq,
      input.question.type,
      String(input.userAnswer ?? ""),
      grade.isCorrect,
      grade.earnedPoints,
      input.idempotencyKey
    );
    bump.run(grade.isCorrect === 1 ? 1 : 0, input.sessionId);
  });
  tx();
  const row = db.prepare(`SELECT * FROM practice_answers WHERE answer_id = ?`).get(answerId) as AnswerRow;
  return { answer: toAnswer(row), grade, replayed: false };
}

/** 交卷：汇总得分（自动判分题按得分/满分百分比），置为 finished（幂等：已 finished 直接返回） */
export function finishSession(sessionId: string, userId: string, autoGradablePoints: number): PracticeSession {
  const db = getDb();
  const session = getSessionForUser(sessionId, userId);
  if (session.status === "finished") return session;
  const earned = (
    db.prepare(`SELECT COALESCE(SUM(score), 0) AS total FROM practice_answers WHERE session_id = ?`).get(sessionId) as { total: number }
  ).total;
  const score = autoGradablePoints > 0 ? Math.round((earned / autoGradablePoints) * 1000) / 10 : null;
  db.prepare(`UPDATE practice_sessions SET status = 'finished', score = ?, finished_at = datetime('now'), updated_at = datetime('now') WHERE session_id = ?`).run(
    score,
    sessionId
  );
  return getSessionForUser(sessionId, userId);
}

/**
 * 解答题自评/错题掌握标记：更新该用户该题最新一条作答的 is_correct（self_marked=1）。
 * 自评本身幂等（重复设置同值结果一致），并同步修正涉及会话的 correct_count。
 */
export function selfMarkAnswer(input: { userId: string; questionId: string; isCorrect: 0 | 1 }): PracticeAnswer {
  const db = getDb();
  const latest = db
    .prepare(`SELECT * FROM practice_answers WHERE user_id = ? AND question_id = ? ORDER BY answered_at DESC LIMIT 1`)
    .get(input.userId, input.questionId) as AnswerRow | undefined;
  if (!latest) throw new PracticeError("ANSWER_NOT_FOUND", "no answer to mark");
  if (latest.is_correct === input.isCorrect && latest.self_marked === 1) return toAnswer(latest);

  const tx = db.transaction(() => {
    db.prepare(`UPDATE practice_answers SET is_correct = ?, self_marked = 1 WHERE answer_id = ?`).run(input.isCorrect, latest.answer_id);
    // 会话计数修正：原值 → 新值的差分
    const delta = (input.isCorrect === 1 ? 1 : 0) - (latest.is_correct === 1 ? 1 : 0);
    if (delta !== 0) {
      db.prepare(`UPDATE practice_sessions SET correct_count = correct_count + ?, updated_at = datetime('now') WHERE session_id = ?`).run(
        delta,
        latest.session_id
      );
    }
  });
  tx();
  const row = db.prepare(`SELECT * FROM practice_answers WHERE answer_id = ?`).get(latest.answer_id) as AnswerRow;
  return toAnswer(row);
}

/** 错题本：每题取最新一条作答，is_correct=0 者入选（自评/重练翻正后自动移出） */
export function listWrongAnswers(userId: string, limit = 100): PracticeAnswer[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT pa.* FROM practice_answers pa
       WHERE pa.user_id = @userId AND pa.is_correct = 0
         AND pa.answered_at = (
           SELECT MAX(answered_at) FROM practice_answers
           WHERE user_id = @userId AND question_id = pa.question_id
         )
       ORDER BY pa.answered_at DESC LIMIT @limit`
    )
    .all({ userId, limit }) as AnswerRow[];
  return rows.map(toAnswer);
}
