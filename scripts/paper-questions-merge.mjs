#!/usr/bin/env node

/**
 * 合并题目分片，产出运行时权威内容 scripts/papers-questions.json。
 * 用法：node scripts/paper-questions-merge.mjs [--check]
 */

import fs from "node:fs";
import { readRegistry } from "./competition-lib.mjs";
import {
  MERGED_QUESTIONS_PATH,
  MERGED_QUESTIONS_REL,
  readQuestionShards,
  serializeQuestionsContent,
  stripQuestionsGeneratedAt,
} from "./paper-questions-lib.mjs";

const checkOnly = process.argv.includes("--check");

const registry = readRegistry();
const shards = readQuestionShards();
const next = serializeQuestionsContent(registry, shards, new Date().toISOString());

if (checkOnly) {
  if (!fs.existsSync(MERGED_QUESTIONS_PATH)) {
    console.error(`${MERGED_QUESTIONS_REL} 不存在，请运行 pnpm papers:questions:merge`);
    process.exitCode = 1;
  } else {
    const current = JSON.parse(fs.readFileSync(MERGED_QUESTIONS_PATH, "utf8"));
    const same = JSON.stringify(stripQuestionsGeneratedAt(current)) === JSON.stringify(stripQuestionsGeneratedAt(next));
    if (!same) {
      console.error(`${MERGED_QUESTIONS_REL} 与题目分片不一致，请运行 pnpm papers:questions:merge`);
      process.exitCode = 1;
    } else {
      console.log(`${MERGED_QUESTIONS_REL} 与分片一致。`);
    }
  }
} else {
  fs.writeFileSync(MERGED_QUESTIONS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  const total = Object.values(next.sets).reduce((sum, set) => sum + set.questions.length, 0);
  console.log(`merged ${Object.keys(next.sets).length} question sets (${total} questions) -> ${MERGED_QUESTIONS_REL}`);
}
