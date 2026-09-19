#!/usr/bin/env node

/**
 * 校验题目分片（scripts/competitions/questions/）与合并产物 papers-questions.json。
 * paperId 必须与 papers 分片中的资料 id 对应（题目挂在真题资料上）。
 * 用法：node scripts/validate-paper-questions.mjs [--json]
 */

import fs from "node:fs";
import { isValidSlug, readRegistry } from "./competition-lib.mjs";
import { readPaperShards } from "./paper-lib.mjs";
import {
  MERGED_QUESTIONS_PATH,
  MERGED_QUESTIONS_REL,
  QUESTION_TYPES,
  buildQuestionsContent,
  isRecord,
  isValidDate,
  nonEmptyString,
  readQuestionShards,
  stripQuestionsGeneratedAt,
} from "./paper-questions-lib.mjs";

function parseArgs(argv) {
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { json };
}

function validateOption(option, optionPath, errors, seenKeys) {
  if (!isRecord(option) || !nonEmptyString(option.key) || !nonEmptyString(option.text)) {
    errors.push({ code: "INVALID_OPTION", path: optionPath, message: "option must be {key, text} non-empty" });
    return;
  }
  if (!/^[A-Z]$/.test(option.key)) {
    errors.push({ code: "INVALID_OPTION_KEY", path: `${optionPath}.key`, message: "option key must be a single A-Z letter" });
  } else if (seenKeys.has(option.key)) {
    errors.push({ code: "DUPLICATE_OPTION_KEY", path: `${optionPath}.key`, message: `duplicate option key ${option.key}` });
  } else {
    seenKeys.add(option.key);
  }
}

function validateQuestion(question, questionPath, errors, seenIds, seenSeqs) {
  if (!isRecord(question)) {
    errors.push({ code: "INVALID_QUESTION", path: questionPath, message: "question must be an object" });
    return;
  }
  if (!nonEmptyString(question.id)) {
    errors.push({ code: "MISSING_QUESTION_ID", path: `${questionPath}.id`, message: "id must be a non-empty string" });
  } else if (seenIds.has(question.id)) {
    errors.push({ code: "DUPLICATE_QUESTION_ID", path: `${questionPath}.id`, message: `duplicate id ${question.id}` });
  } else {
    seenIds.add(question.id);
  }
  if (!Number.isInteger(question.seq) || question.seq < 1) {
    errors.push({ code: "INVALID_SEQ", path: `${questionPath}.seq`, message: "seq must be an integer >= 1" });
  } else if (seenSeqs.has(question.seq)) {
    errors.push({ code: "DUPLICATE_SEQ", path: `${questionPath}.seq`, message: `duplicate seq ${question.seq}` });
  } else {
    seenSeqs.add(question.seq);
  }
  if (!QUESTION_TYPES.includes(question.type)) {
    errors.push({ code: "INVALID_TYPE", path: `${questionPath}.type`, message: `type must be one of ${QUESTION_TYPES.join("/")}` });
    return;
  }
  if (!nonEmptyString(question.stem)) {
    errors.push({ code: "MISSING_STEM", path: `${questionPath}.stem`, message: "stem must be a non-empty string" });
  }
  if (!Number.isFinite(question.points) || question.points <= 0 || question.points > 100) {
    errors.push({ code: "INVALID_POINTS", path: `${questionPath}.points`, message: "points must be in (0, 100]" });
  }

  if (question.type === "choice" || question.type === "multiple") {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      errors.push({ code: "INVALID_OPTIONS", path: `${questionPath}.options`, message: "choice/multiple requires >= 2 options" });
    } else {
      const seenKeys = new Set();
      question.options.forEach((option, index) => validateOption(option, `${questionPath}.options[${index}]`, errors, seenKeys));
      const keys = new Set(question.options.map((option) => option.key));
      const expected = question.type === "choice" ? [String(question.answer ?? "")] : Array.isArray(question.answer) ? question.answer : null;
      if (expected === null) {
        errors.push({ code: "INVALID_ANSWER", path: `${questionPath}.answer`, message: "multiple answer must be an array of option keys" });
      } else if (expected.length === 0 || expected.some((key) => !keys.has(key))) {
        errors.push({ code: "ANSWER_NOT_IN_OPTIONS", path: `${questionPath}.answer`, message: "answer must reference existing option keys" });
      }
    }
  } else if (!nonEmptyString(question.answer) && !(Array.isArray(question.answer) && question.answer.length > 0)) {
    // fill/essay：参考答案必须非空（fill 为文本或 | 分隔的可接受答案，essay 为参考答案）
    errors.push({ code: "MISSING_ANSWER", path: `${questionPath}.answer`, message: "fill/essay answer must be non-empty" });
  }
  if (question.explanation !== undefined && typeof question.explanation !== "string") {
    errors.push({ code: "INVALID_EXPLANATION", path: `${questionPath}.explanation`, message: "explanation must be a string when present" });
  }
}

function validateQuestionShard(shard, label, paperIds, errors) {
  if (!isRecord(shard)) {
    errors.push({ code: "INVALID_SHARD", path: label, message: "shard must be a JSON object" });
    return { sets: 0, questions: 0 };
  }
  if (!isValidSlug(shard.slug)) {
    errors.push({ code: "INVALID_SLUG", path: `${label}.slug`, message: "slug must be kebab-case" });
  }
  if (!Array.isArray(shard.sets)) {
    errors.push({ code: "INVALID_SETS", path: `${label}.sets`, message: "sets must be an array" });
    return { sets: 0, questions: 0 };
  }
  let questions = 0;
  const seenPaperIds = new Set();
  for (const [setIndex, set] of shard.sets.entries()) {
    const at = `${label}.sets[${setIndex}]`;
    if (!isRecord(set)) {
      errors.push({ code: "INVALID_SET", path: at, message: "set must be an object" });
      continue;
    }
    if (!nonEmptyString(set.paperId)) {
      errors.push({ code: "MISSING_PAPER_ID", path: `${at}.paperId`, message: "paperId must be a non-empty string" });
    } else {
      if (seenPaperIds.has(set.paperId)) {
        errors.push({ code: "DUPLICATE_PAPER_ID", path: `${at}.paperId`, message: `duplicate paperId ${set.paperId}` });
      } else {
        seenPaperIds.add(set.paperId);
      }
      if (!paperIds.has(set.paperId)) {
        errors.push({ code: "PAPER_ID_NOT_FOUND", path: `${at}.paperId`, message: `paperId ${set.paperId} 不在 papers 分片中（先采集资料再抽题）` });
      } else if (!set.paperId.startsWith(`${shard.slug}-`)) {
        errors.push({ code: "PAPER_ID_SLUG_MISMATCH", path: `${at}.paperId`, message: `paperId 前缀应与分片 slug ${shard.slug} 一致` });
      }
    }
    if (!isRecord(set.extractor) || !nonEmptyString(set.extractor.model) || !isValidDate(set.extractor.at) || typeof set.extractor.reviewed !== "boolean") {
      errors.push({ code: "INVALID_EXTRACTOR", path: `${at}.extractor`, message: "extractor must be {model, at: YYYY-MM-DD, reviewed: boolean}" });
    }
    if (!Array.isArray(set.questions) || set.questions.length === 0) {
      errors.push({ code: "EMPTY_QUESTIONS", path: `${at}.questions`, message: "questions must be a non-empty array" });
      continue;
    }
    questions += set.questions.length;
    const seenIds = new Set();
    const seenSeqs = new Set();
    for (const [questionIndex, question] of set.questions.entries()) {
      validateQuestion(question, `${at}.questions[${questionIndex}]`, errors, seenIds, seenSeqs);
    }
  }
  return { sets: shard.sets.length, questions };
}

function validateMerged(shards, registry, errors) {
  if (!fs.existsSync(MERGED_QUESTIONS_PATH)) {
    // 尚无合并产物：若也没有任何题目分片，视为合法的空状态（首次引入前）
    if (shards.size === 0) return { fresh: true, empty: true };
    errors.push({ code: "MISSING_MERGED", path: MERGED_QUESTIONS_REL, message: "run pnpm papers:questions:merge to generate it" });
    return { fresh: false };
  }
  let merged = null;
  try {
    merged = JSON.parse(fs.readFileSync(MERGED_QUESTIONS_PATH, "utf8"));
  } catch (error) {
    errors.push({ code: "INVALID_JSON", path: MERGED_QUESTIONS_REL, message: `merged file is not valid JSON: ${error.message}` });
    return { fresh: false };
  }
  const { problems, content } = buildQuestionsContent(registry, shards);
  for (const problem of problems) {
    errors.push({ code: "MERGE_MISMATCH", path: "registry↔questions", message: problem });
  }
  const fresh = JSON.stringify(stripQuestionsGeneratedAt(merged)) === JSON.stringify(stripQuestionsGeneratedAt({ generatedAt: null, ...content }));
  if (!fresh && problems.length === 0) {
    errors.push({ code: "STALE_MERGED", path: MERGED_QUESTIONS_REL, message: "merged questions content is stale; run pnpm papers:questions:merge" });
  }
  return { fresh: fresh && problems.length === 0 };
}

function validate() {
  const errors = [];
  let registry = null;
  try {
    registry = readRegistry();
  } catch (error) {
    errors.push({ code: "INVALID_JSON", path: "scripts/competitions/registry.json", message: error.message });
  }

  // 全部资料 id 集合（跨赛事），用于 paperId 存在性校验
  const paperIds = new Set();
  for (const shard of readPaperShards().values()) {
    for (const paper of shard.papers ?? []) paperIds.add(paper.id);
  }

  const shards = readQuestionShards();
  let sets = 0;
  let questions = 0;
  for (const [slug, shard] of [...shards.entries()].sort()) {
    const summary = validateQuestionShard(shard, `questions/${slug}.json`, paperIds, errors);
    sets += summary.sets;
    questions += summary.questions;
  }

  const mergedSummary = registry ? validateMerged(shards, registry, errors) : { fresh: false };

  return { ok: errors.length === 0, shards: shards.size, sets, questions, merged: mergedSummary, errors };
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = validate();
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log("Paper questions validation passed.");
    console.log(`- question shards: ${report.shards}; sets: ${report.sets}; questions: ${report.questions}; merged fresh: ${report.merged.fresh ? "yes" : "no"}`);
  } else {
    console.error(`Paper questions validation failed (${report.errors.length} issue${report.errors.length === 1 ? "" : "s"}):`);
    for (const issue of report.errors) console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
  }
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
