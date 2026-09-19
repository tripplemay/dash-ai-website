#!/usr/bin/env node

/**
 * 题目结构化抽取管线（第二期）：把已采集的真题 PDF 解析为结构化题目分片。
 *   1. 从 papers 分片找到目标资料（kind=paper、format=pdf、文件已落盘）；
 *   2. pdftotext 抽文本（扫描件产出过少 → 标记 scan-suspected 跳过，等待 OCR 增强）；
 *   3. 文本按块调 LLM（OpenAI 兼容端点，JSON 模式）抽取题目；
 *   4. 合并去重、规范化（id=q<seq>），写入 scripts/competitions/questions/<slug>.json；
 *   5. merge + validate-paper-questions 门禁，失败整体回滚。
 *
 * 用法：
 *   node scripts/paper-extract.mjs --paper <paperId> [--write] [--force] [--model <m>]
 *   node scripts/paper-extract.mjs --slug <slug> [--write] [--force]
 *   默认 dry-run：只打印抽取结果，不写盘。
 *
 * 环境变量：
 *   DASH_EXTRACT_BASE_URL  OpenAI 兼容端点（默认 https://aigc.guangai.ai/v1）
 *   DASH_EXTRACT_API_KEY   端点 API key（必需）
 *   DASH_EXTRACT_MODEL     模型（默认 deepseek-v3）
 *   DASH_PAPER_PUBLIC_DIR  文件根（与 collector 一致，默认 output/papers-public）
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isValidSlug } from "./competition-lib.mjs";
import { readPaperShards } from "./paper-lib.mjs";
import { MERGED_QUESTIONS_PATH, QUESTION_SHARDS_DIR, QUESTION_TYPES, sanitizeQuestions } from "./paper-questions-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const MERGE_SCRIPT = path.join(SCRIPT_DIR, "paper-questions-merge.mjs");
const VALIDATE_SCRIPT = path.join(SCRIPT_DIR, "validate-paper-questions.mjs");

const BASE_URL = (process.env.DASH_EXTRACT_BASE_URL || "https://aigc.guangai.ai/v1").replace(/\/+$/, "");
const API_KEY = process.env.DASH_EXTRACT_API_KEY ?? "";
const DEFAULT_MODEL = process.env.DASH_EXTRACT_MODEL || "deepseek-v3";
const DEFAULT_VISION_MODEL = process.env.DASH_EXTRACT_VISION_MODEL || "kimi-k2.5";
const filesPublicDir = process.env.DASH_PAPER_PUBLIC_DIR || path.join(REPO_ROOT, "output", "papers-public");

const CHUNK_SIZE = 6000;
const MIN_TEXT_LENGTH = 500;
const LLM_TIMEOUT_MS = 180_000;
const VISION_PAGES_PER_CALL = 2;
const VISION_MAX_PAGES = 24;

const SYSTEM_PROMPT = `你是竞赛试题结构化专家。把试卷文本解析为 JSON 题目数组，严格遵守：
1. 题型映射：单选题→choice，多选题→multiple，填空题→fill，解答/证明/计算/实验/论述题→essay。
2. 题干 stem 保留原文（含公式符号；数学式用 LaTeX，行内用 $...$，独立行用 $$...$$）；去掉页眉页脚、水印、"第 X 页"等杂讯。
3. 选择题给出 options[{"key":"A","text":"..."}]，key 为单个大写字母。
4. answer：choice 为单个字母（如 "A"）；multiple 为字母数组（如 ["A","C"]）；fill 为标准答案文本（多个可接受答案用 " | " 分隔）；essay 为完整参考答案/评分要点（尽量保留原卷答案，缺失时给出你自己的规范解答）。
5. explanation 有把握就给出一行解析，没有就省略该字段。
6. points 按卷面标注分值；未标注时 choice/fill 给 5，multiple 给 6，essay 按大题常见分值给 10–20。
7. seq 使用试卷上印刷的原始题号（整数）。
8. 只输出 JSON：{"questions":[{seq,type,stem,options?,answer,explanation?,points}]}，不要输出任何其他文字。`;

function parseArgs(argv) {
  const options = { paper: null, slug: null, write: false, force: false, model: DEFAULT_MODEL, visionModel: DEFAULT_VISION_MODEL, engine: "auto" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--paper") {
      options.paper = argv[++index];
      if (!options.paper) throw new Error("--paper 需要 paperId");
    } else if (arg === "--slug") {
      options.slug = argv[++index];
      if (!options.slug || !isValidSlug(options.slug)) throw new Error("--slug 需要合法的 kebab-case 值");
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--model") {
      options.model = argv[++index];
      if (!options.model) throw new Error("--model 需要模型名");
    } else if (arg === "--vision-model") {
      options.visionModel = argv[++index];
      if (!options.visionModel) throw new Error("--vision-model 需要模型名");
    } else if (arg === "--engine") {
      options.engine = argv[++index];
      if (!["auto", "text", "vision"].includes(options.engine)) throw new Error("--engine 需要 auto|text|vision");
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/paper-extract.mjs (--paper <paperId> | --slug <slug>) [--write] [--force] [--model <m>] [--vision-model <m>] [--engine auto|text|vision]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.paper && !options.slug) throw new Error("必须指定 --paper 或 --slug");
  return options;
}

function pdftotext(filePath) {
  const result = spawnSync("pdftotext", ["-layout", "-enc", "UTF-8", filePath, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? "").trim().slice(0, 200) || "pdftotext 失败" };
  return { ok: true, text: result.stdout ?? "" };
}

/** 按行边界切成 ~6000 字块（题块过小则合并） */
function chunkText(text) {
  const lines = text.split("\n");
  const chunks = [];
  let current = "";
  for (const line of lines) {
    if (current.length + line.length > CHUNK_SIZE && current.length > CHUNK_SIZE / 2) {
      chunks.push(current);
      current = "";
    }
    current += `${line}\n`;
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

async function callLlm(chunk, meta) {
  const userPrompt = [
    `试卷：《${meta.title}》（${meta.year} 年 ${meta.stage}）`,
    meta.chunkCount > 1 ? `本块为第 ${meta.index + 1}/${meta.chunkCount} 块，题号在全卷范围内连续；本块可能包含不完整题目，尽力解析即可。` : "",
    "试卷文本：",
    chunk,
  ]
    .filter(Boolean)
    .join("\n");

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: meta.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`LLM HTTP ${response.status}：${text.slice(0, 150)}`);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed?.questions)) throw new Error("LLM 输出缺少 questions 数组");
      return parsed.questions;
    } catch (error) {
      if (attempt === 2) throw new Error(`LLM 抽取失败（2 次尝试）：${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

/** 各块题目按 seq 合并去重（同 seq 保留题干更长者），随后重排 id */
function mergeQuestions(chunkResults) {
  const bySeq = new Map();
  for (const questions of chunkResults) {
    for (const question of questions) {
      if (!Number.isInteger(question?.seq) || question.seq < 1) continue;
      if (typeof question.stem !== "string" || question.stem.trim().length < 4) continue;
      if (!QUESTION_TYPES.includes(question.type)) continue;
      const existing = bySeq.get(question.seq);
      if (!existing || String(question.stem).length > String(existing.stem).length) {
        bySeq.set(question.seq, question);
      }
    }
  }
  return [...bySeq.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, question]) => ({ id: `q${seq}`, ...question }));
}

// ---------------------------------------------------------------------------
// Vision 引擎：扫描件 PDF → pdftoppm 页图 → 视觉模型（base64 多模态输入）
// ---------------------------------------------------------------------------

function pdftoppmPages(filePath, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  const prefix = path.join(workDir, "page");
  const result = spawnSync("pdftoppm", ["-png", "-r", "150", filePath, prefix], { encoding: "utf8" });
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? "").trim().slice(0, 200) || "pdftoppm 失败" };
  const pages = fs
    .readdirSync(workDir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => path.join(workDir, name));
  return { ok: true, pages };
}

async function callVisionLlm(imagePaths, meta) {
  const instruction = [
    `试卷：《${meta.title}》（${meta.year} 年 ${meta.stage}）`,
    `附图是本卷第 ${meta.index * VISION_PAGES_PER_CALL + 1}–${meta.index * VISION_PAGES_PER_CALL + imagePaths.length} 页。请逐题识别并结构化（题号在全卷范围内连续，跨页题目按一道处理）。`,
  ].join("\n");
  const content = [
    { type: "text", text: instruction },
    ...imagePaths.map((imagePath) => ({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${fs.readFileSync(imagePath).toString("base64")}` },
    })),
  ];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: meta.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Vision LLM HTTP ${response.status}：${text.slice(0, 150)}`);
      }
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed?.questions)) throw new Error("Vision LLM 输出缺少 questions 数组");
      return parsed.questions;
    } catch (error) {
      if (attempt === 2) throw new Error(`Vision 抽取失败（2 次尝试）：${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

/** 扫描件视觉抽取：渲染页图 → 分批视觉识别 → 合并 */
async function extractViaVision(filePath, paper, options) {
  const workDir = path.join(REPO_ROOT, "tmp", "paper-extract", paper.id);
  fs.rmSync(workDir, { recursive: true, force: true });
  try {
    const rendered = pdftoppmPages(filePath, workDir);
    if (!rendered.ok) return { status: "error", error: rendered.error };
    const pages = rendered.pages.slice(0, VISION_MAX_PAGES);
    if (pages.length === 0) return { status: "error", error: "pdftoppm 未产出页图" };

    const groups = [];
    for (let index = 0; index < pages.length; index += VISION_PAGES_PER_CALL) {
      groups.push(pages.slice(index, index + VISION_PAGES_PER_CALL));
    }
    const meta = { title: paper.title, year: paper.year, stage: paper.stage, model: options.visionModel };
    const chunkResults = [];
    for (const [index, group] of groups.entries()) {
      const questions = await callVisionLlm(group, { ...meta, index });
      chunkResults.push(questions);
    }
    const questions = mergeQuestions(chunkResults);
    if (questions.length === 0) return { status: "empty", error: "Vision 未能抽取出任何题目" };
    return { status: "ok", questions, detail: `${pages.length} 页 / ${groups.length} 次视觉调用`, model: options.visionModel };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function loadQuestionShard(slug) {
  const file = path.join(QUESTION_SHARDS_DIR, `${slug}.json`);
  try {
    const shard = JSON.parse(fs.readFileSync(file, "utf8"));
    if (shard && Array.isArray(shard.sets)) return shard;
  } catch {
    // 尚无分片
  }
  return { slug, sets: [] };
}

function serializeQuestionShard(shard) {
  const lines = shard.sets.map((set) => `    ${JSON.stringify(set)}`);
  return `{\n  "slug": ${JSON.stringify(shard.slug)},\n  "sets": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

function findTargetPapers(options) {
  const targets = [];
  for (const [slug, shard] of readPaperShards()) {
    if (options.slug && slug !== options.slug) continue;
    for (const paper of shard.papers ?? []) {
      if (options.paper && paper.id !== options.paper) continue;
      const mainFile = paper.files.find((file) => file.kind === "paper" && file.format === "pdf" && file.fileKey);
      if (!mainFile) continue;
      targets.push({ slug, paper, mainFile });
    }
  }
  return targets;
}

async function extractPaper(target, options) {
  const { slug, paper, mainFile } = target;
  const filePath = path.join(filesPublicDir, mainFile.fileKey);
  if (!fs.existsSync(filePath)) return { paperId: paper.id, status: "missing-file", error: `文件不存在：${mainFile.fileKey}` };

  let outcome = null;
  if (options.engine !== "vision") {
    const extracted = pdftotext(filePath);
    if (!extracted.ok) return { paperId: paper.id, status: "error", error: extracted.error };
    const text = extracted.text.replace(/\f/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    if (text.length >= MIN_TEXT_LENGTH) {
      const chunks = chunkText(text);
      const meta = { title: paper.title, year: paper.year, stage: paper.stage, model: options.model, chunkCount: chunks.length };
      const chunkResults = [];
      for (const [index, chunk] of chunks.entries()) {
        const questions = await callLlm(chunk, { ...meta, index });
        chunkResults.push(questions);
      }
      const questions = mergeQuestions(chunkResults);
      outcome =
        questions.length > 0
          ? { status: "ok", questions, detail: `文本 ${text.length} 字 / ${chunks.length} 块`, model: options.model }
          : { status: "empty", error: "LLM 未能抽取出任何题目" };
    } else if (options.engine === "text") {
      outcome = { status: "scan-suspected", error: `文本仅 ${text.length} 字，疑似扫描件（--engine vision 走视觉抽取）` };
    }
  }
  // auto 引擎：文本不可用（扫描件）时自动降级视觉抽取
  if (!outcome && options.engine !== "text") {
    outcome = await extractViaVision(filePath, paper, options);
  }
  if (outcome.status !== "ok") return { paperId: paper.id, status: outcome.status, error: outcome.error };

  return {
    paperId: paper.id,
    status: "ok",
    set: {
      paperId: paper.id,
      slug,
      extractor: { model: outcome.model, at: new Date().toISOString().slice(0, 10), reviewed: false },
      questions: outcome.questions,
    },
    detail: outcome.detail,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!API_KEY) throw new Error("缺少 DASH_EXTRACT_API_KEY");

  const targets = findTargetPapers(options);
  if (targets.length === 0) throw new Error("没有匹配的试卷（需要 kind=paper 且 pdf 文件已落盘的资料）");

  // 过滤已抽取（--force 覆盖）
  const bySlug = new Map();
  for (const target of targets) {
    if (!bySlug.has(target.slug)) bySlug.set(target.slug, loadQuestionShard(target.slug));
    target.shard = bySlug.get(target.slug);
    target.already = target.shard.sets.some((set) => set.paperId === target.paper.id);
  }
  const pending = options.force ? targets : targets.filter((target) => !target.already);
  console.log(
    `目标试卷 ${targets.length} 份，待抽取 ${pending.length} 份（跳过已抽取 ${targets.length - pending.length}）… 模型：${options.model}，模式：${options.write ? "write" : "dry-run"}`
  );

  const results = [];
  const touchedSlugs = new Set();
  const shardOriginals = new Map();
  for (const target of pending) {
    // 单卷失败不中断批次（瞬时网关错误等），逐卷即时写盘防前功尽弃
    let outcome;
    try {
      outcome = await extractPaper(target, options);
    } catch (error) {
      outcome = { paperId: target.paper.id, status: "error", error: error instanceof Error ? error.message : String(error) };
    }
    results.push({ slug: target.slug, title: target.paper.title, ...outcome });
    if (outcome.status === "ok") {
      console.log(`✓ ${target.paper.title} → ${outcome.set.questions.length} 题（${outcome.detail}）`);
      if (options.write) {
        // 写盘前清洗：LLM 产物的非法选项/答案先修复（降级填空），避免整批过不了门禁
        const cleaned = sanitizeQuestions(outcome.set.questions);
        if (cleaned.dropped.length) console.log(`  丢弃 ${cleaned.dropped.length} 题：${cleaned.dropped.slice(0, 3).join("、")}`);
        if (cleaned.repaired.length) console.log(`  修复 ${cleaned.repaired.length} 题：${cleaned.repaired.slice(0, 3).join("、")}`);
        if (cleaned.kept.length === 0) {
          console.log(`✕ ${target.paper.title} [empty] 清洗后无合法题目`);
          continue;
        }
        const shard = target.shard;
        const shardFile = path.join(QUESTION_SHARDS_DIR, `${target.slug}.json`);
        if (!shardOriginals.has(target.slug)) {
          shardOriginals.set(target.slug, fs.existsSync(shardFile) ? fs.readFileSync(shardFile, "utf8") : null);
        }
        shard.sets = [...shard.sets.filter((set) => set.paperId !== target.paper.id), { ...outcome.set, questions: cleaned.kept }];
        fs.mkdirSync(QUESTION_SHARDS_DIR, { recursive: true });
        fs.writeFileSync(shardFile, serializeQuestionShard(shard));
        touchedSlugs.add(target.slug);
      }
    } else {
      console.log(`✕ ${target.paper.title} [${outcome.status}] ${outcome.error}`);
    }
  }
  if (options.write && touchedSlugs.size > 0) {
    const mergedOriginal = fs.existsSync(MERGED_QUESTIONS_PATH) ? fs.readFileSync(MERGED_QUESTIONS_PATH, "utf8") : null;
    const merge = spawnSync(process.execPath, [MERGE_SCRIPT], { encoding: "utf8" });
    const check = merge.status === 0 ? spawnSync(process.execPath, [VALIDATE_SCRIPT], { encoding: "utf8" }) : merge;
    const output = `${merge.stdout ?? ""}${merge.stderr ?? ""}${check.stdout ?? ""}${check.stderr ?? ""}`.trim();
    if (check.status !== 0) {
      for (const [slug, original] of shardOriginals) {
        const shardFile = path.join(QUESTION_SHARDS_DIR, `${slug}.json`);
        if (original === null) fs.rmSync(shardFile, { force: true });
        else fs.writeFileSync(shardFile, original);
      }
      if (mergedOriginal !== null) fs.writeFileSync(MERGED_QUESTIONS_PATH, mergedOriginal);
      console.error(`\n写入校验失败，已整体回滚（含合并产物）：\n${output}`);
      process.exitCode = 1;
    } else {
      console.log(`\n写入 ${touchedSlugs.size} 个题目分片（校验通过）。`);
    }
  } else if (!options.write) {
    const okCount = results.filter((result) => result.status === "ok").length;
    console.log(`\ndry-run 完成：${okCount}/${pending.length} 份可抽取。`);
    for (const result of results.filter((item) => item.status === "ok").slice(0, 3)) {
      console.log(`\n示例（${result.paperId} 首题）：`);
      console.log(JSON.stringify(result.set.questions[0], null, 2).slice(0, 800));
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`抽取失败：${error.message}`);
    process.exitCode = 1;
  });
}
