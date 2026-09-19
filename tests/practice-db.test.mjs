// 练习 DB 层集成测试：迁移建表 → 会话 → 幂等作答 → 交卷判分 → 自评 → 错题本派生。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "practice-test-"));
process.env.DASH_AUTH_DB = path.join(tmpDir, "practice.db");

// user 表由 better-auth 迁移创建（子进程跑 migrate-auth），随后跑内容迁移
const { spawnSync } = await import("node:child_process");
const authMigration = spawnSync(process.execPath, ["scripts/migrate-auth.mjs"], {
  env: { ...process.env, DASH_AUTH_DB: process.env.DASH_AUTH_DB },
  encoding: "utf8",
});
if (authMigration.status !== 0) throw new Error(`migrate-auth 失败：${authMigration.stderr}`);

const { runMigrations } = await import("../scripts/migrate.mjs");
const Database = (await import("better-sqlite3")).default;
const db = new Database(process.env.DASH_AUTH_DB);
runMigrations(db);

// practice.ts 通过 getDb() 读 DASH_AUTH_DB —— 在迁移后导入
const practice = await import("../src/lib/practice.ts");
const { createOrResumeSession, submitAnswer, finishSession, selfMarkAnswer, listWrongAnswers } = practice;

const USER_ID = "test-user-practice";
db.prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))`).run(
  USER_ID,
  "练习测试",
  "practice-test@example.com"
);

const choice = { id: "q1", seq: 1, type: "choice", stem: "s", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], answer: "B", points: 5 };
const fill = { id: "q2", seq: 2, type: "fill", stem: "s", answer: "42", points: 5 };
const essay = { id: "q3", seq: 3, type: "essay", stem: "s", answer: "ref", points: 20 };
const PAPER = "test-2025-paper-abcdef";

test("会话创建与断点续练（同卷同模式复用 active 会话）", () => {
  const first = createOrResumeSession(USER_ID, PAPER, "practice", 3);
  assert.equal(first.resumed, false);
  assert.equal(first.session.status, "active");
  const second = createOrResumeSession(USER_ID, PAPER, "practice", 3);
  assert.equal(second.resumed, true);
  assert.equal(second.session.sessionId, first.session.sessionId);
});

test("幂等作答：判分正确、重放一致、同题重复 409", () => {
  const { session } = createOrResumeSession(USER_ID, PAPER, "practice", 3);
  const key = "test-idem-0001-0001";
  const first = submitAnswer({ userId: USER_ID, sessionId: session.sessionId, question: choice, userAnswer: "B", idempotencyKey: key });
  assert.equal(first.grade.isCorrect, 1);
  assert.equal(first.replayed, false);
  const replay = submitAnswer({ userId: USER_ID, sessionId: session.sessionId, question: choice, userAnswer: "B", idempotencyKey: key });
  assert.equal(replay.replayed, true);
  assert.equal(replay.answer.answerId, first.answer.answerId);
  assert.throws(
    () => submitAnswer({ userId: USER_ID, sessionId: session.sessionId, question: choice, userAnswer: "A", idempotencyKey: "test-idem-0001-0002" }),
    (error) => error?.code === "ALREADY_ANSWERED"
  );
});

test("交卷判分：自动判分题百分比得分，幂等交卷", () => {
  const { session } = createOrResumeSession(USER_ID, PAPER, "practice", 3);
  submitAnswer({ userId: USER_ID, sessionId: session.sessionId, question: fill, userAnswer: "41", idempotencyKey: "test-idem-0001-0003" });
  submitAnswer({ userId: USER_ID, sessionId: session.sessionId, question: essay, userAnswer: "我的解答", idempotencyKey: "test-idem-0001-0004" });
  const finished = finishSession(session.sessionId, USER_ID, 10); // choice 5 + fill 5
  assert.equal(finished.status, "finished");
  // 答对 choice(5) 答错 fill(0) → 5/10 = 50.0
  assert.equal(finished.score, 50);
  const again = finishSession(session.sessionId, USER_ID, 10);
  assert.equal(again.score, 50);
});

test("解答题自评与错题本派生（自评翻正后自动移出）", () => {
  let wrongs = listWrongAnswers(USER_ID);
  // 答错的 fill 入选；essay 未自评前 is_correct=null 不入选
  assert.deepEqual(wrongs.map((answer) => answer.questionId), ["q2"]);

  const marked = selfMarkAnswer({ userId: USER_ID, questionId: "q3", isCorrect: 0 });
  assert.equal(marked.isCorrect, 0);
  assert.equal(marked.selfMarked, 1);
  wrongs = listWrongAnswers(USER_ID);
  assert.deepEqual(
    wrongs.map((answer) => answer.questionId).sort(),
    ["q2", "q3"]
  );

  selfMarkAnswer({ userId: USER_ID, questionId: "q2", isCorrect: 1 });
  wrongs = listWrongAnswers(USER_ID);
  assert.deepEqual(wrongs.map((answer) => answer.questionId), ["q3"]);
});
