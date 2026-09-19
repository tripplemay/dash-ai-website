// 练习判分与题目校验的单元测试（node:test，与 tests/competition-*.test.mjs 同套运行时）。
import test from "node:test";
import assert from "node:assert/strict";

import { gradeAnswer, normalizeFillAnswer, sanitizeQuestion } from "../src/lib/paper-questions-domain.ts";

const choice = { id: "q1", seq: 1, type: "choice", stem: "s", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], answer: "B", points: 5 };
const multiple = { id: "q2", seq: 2, type: "multiple", stem: "s", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], answer: ["A", "C"], points: 6 };
const fill = { id: "q3", seq: 3, type: "fill", stem: "s", answer: "42.5", points: 5 };
const fillMulti = { id: "q4", seq: 4, type: "fill", stem: "s", answer: "氧气 | O2", points: 5 };
const essay = { id: "q5", seq: 5, type: "essay", stem: "s", answer: "ref", points: 20 };

test("choice：精确命中得分，错误/空答不得分", () => {
  assert.deepEqual(gradeAnswer(choice, "B"), { isCorrect: 1, earnedPoints: 5 });
  assert.deepEqual(gradeAnswer(choice, "b"), { isCorrect: 1, earnedPoints: 5 });
  assert.deepEqual(gradeAnswer(choice, "A"), { isCorrect: 0, earnedPoints: 0 });
  assert.deepEqual(gradeAnswer(choice, ""), { isCorrect: 0, earnedPoints: 0 });
});

test("multiple：集合全对才得分（全或无）", () => {
  assert.deepEqual(gradeAnswer(multiple, "AC"), { isCorrect: 1, earnedPoints: 6 });
  assert.deepEqual(gradeAnswer(multiple, "C,A"), { isCorrect: 1, earnedPoints: 6 });
  assert.deepEqual(gradeAnswer(multiple, ["A", "C"]), { isCorrect: 1, earnedPoints: 6 });
  assert.deepEqual(gradeAnswer(multiple, "A"), { isCorrect: 0, earnedPoints: 0 });
  assert.deepEqual(gradeAnswer(multiple, "ABC"), { isCorrect: 0, earnedPoints: 0 });
});

test("fill：归一化匹配（全半角/空白/大小写）", () => {
  assert.equal(normalizeFillAnswer("４２.５"), "42.5");
  assert.equal(normalizeFillAnswer(" 42 . 5 "), "42.5");
  assert.deepEqual(gradeAnswer(fill, "４２．５"), { isCorrect: 1, earnedPoints: 5 });
  assert.deepEqual(gradeAnswer(fill, "42"), { isCorrect: 0, earnedPoints: 0 });
});

test("fill：| 分隔的多个可接受答案", () => {
  assert.deepEqual(gradeAnswer(fillMulti, "氧气"), { isCorrect: 1, earnedPoints: 5 });
  assert.deepEqual(gradeAnswer(fillMulti, "o2"), { isCorrect: 1, earnedPoints: 5 });
  assert.deepEqual(gradeAnswer(fillMulti, "Ｏ２"), { isCorrect: 1, earnedPoints: 5 });
  assert.deepEqual(gradeAnswer(fillMulti, "氢气"), { isCorrect: 0, earnedPoints: 0 });
});

test("essay：提交后不判分（isCorrect=null），不计自动得分", () => {
  assert.deepEqual(gradeAnswer(essay, "我的解答"), { isCorrect: null, earnedPoints: 0 });
});

test("sanitizeQuestion：下发题目不含答案与解析", () => {
  const safe = sanitizeQuestion({ ...choice, explanation: "why" });
  assert.equal("answer" in safe, false);
  assert.equal("explanation" in safe, false);
  assert.equal(safe.id, "q1");
  assert.deepEqual(safe.options, choice.options);
});
