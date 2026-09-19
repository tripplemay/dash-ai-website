// 题目分片共享核心：questions 分片 -> papers-questions.json 的纯函数实现。
// 仅使用 Node 标准库，供 paper-questions-merge / validate-paper-questions / paper-extract 共同引用。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

export const QUESTION_SHARDS_DIR = path.join(SCRIPT_DIR, "competitions", "questions");
export const MERGED_QUESTIONS_PATH = path.join(SCRIPT_DIR, "papers-questions.json");
export const MERGED_QUESTIONS_REL = "scripts/papers-questions.json";

export const QUESTION_TYPES = ["choice", "multiple", "fill", "essay"];

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** 读取全部题目分片，返回 Map<slug, shard> */
export function readQuestionShards() {
  const shards = new Map();
  if (!fs.existsSync(QUESTION_SHARDS_DIR)) return shards;
  const files = fs
    .readdirSync(QUESTION_SHARDS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const file of files) {
    const filePath = path.join(QUESTION_SHARDS_DIR, file);
    let shard;
    try {
      shard = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      throw new Error(`题目分片 ${file} 不是合法 JSON：${error.message}`);
    }
    if (isRecord(shard) && typeof shard.slug === "string") {
      shards.set(shard.slug, shard);
    }
  }
  return shards;
}

/**
 * 合并题目分片，产出 papers-questions.json 的内存对象。
 * 非严格模式：无题目分片的赛事允许缺席（题目是渐进覆盖的增强内容）；
 * 但分片 slug 必须 ∈ registry（paperShards 用于校验 paperId 存在性，由 validate 层做）。
 */
export function buildQuestionsContent(registry, shards) {
  const problems = [];
  const registryList = Array.isArray(registry?.competitions) ? registry.competitions : [];
  const sets = {};

  for (const [slug, shard] of [...shards.entries()].sort()) {
    if (!registryList.some((entry) => entry.slug === slug)) {
      problems.push(`题目分片 ${slug} 不在 registry 中`);
      continue;
    }
    for (const set of shard.sets ?? []) {
      if (sets[set.paperId]) {
        problems.push(`题目集 paperId 重复：${set.paperId}（${slug}）`);
        continue;
      }
      sets[set.paperId] = {
        paperId: set.paperId,
        slug,
        extractor: set.extractor,
        questions: set.questions ?? [],
      };
    }
  }

  return { problems, content: { sets } };
}

export function serializeQuestionsContent(registry, shards, generatedAt) {
  const { problems, content } = buildQuestionsContent(registry, shards);
  if (problems.length) {
    throw new Error(`题目合并失败：\n- ${problems.join("\n- ")}`);
  }
  return { generatedAt, ...content };
}

export function stripQuestionsGeneratedAt(value) {
  if (!isRecord(value)) return value;
  const rest = { ...value };
  delete rest.generatedAt;
  return rest;
}

function validPoints(points, fallback) {
  return Number.isFinite(points) && points > 0 && points <= 100 ? points : fallback;
}

/**
 * 题目清洗（LLM 抽取产物的宽容化）：把不满足校验不变量的题目修复为合法形态——
 * 选项不足/答案不指向选项的选择题：先按选项文本重映射答案，失败则降级为填空（保留答案），
 * 无答案的丢弃。返回 { kept, dropped, repaired } 供写盘前使用与审计。
 */
export function sanitizeQuestions(questions) {
  const kept = [];
  const dropped = [];
  const repaired = [];

  for (const question of questions ?? []) {
    if (!question || !Number.isInteger(question.seq) || question.seq < 1 || typeof question.stem !== "string" || question.stem.trim().length < 4) {
      dropped.push(question?.id ?? "?");
      continue;
    }
    const type = QUESTION_TYPES.includes(question.type) ? question.type : "fill";
    const explanation = typeof question.explanation === "string" && question.explanation.trim() ? { explanation: question.explanation.trim() } : {};

    if (type === "choice" || type === "multiple") {
      const seen = new Set();
      const options = [];
      for (const option of Array.isArray(question.options) ? question.options : []) {
        const key = String(option?.key ?? "").trim().toUpperCase();
        const text = String(option?.text ?? "").trim();
        if (!/^[A-Z]$/.test(key) || !text || seen.has(key)) continue;
        seen.add(key);
        options.push({ key, text });
      }
      const keys = new Set(options.map((option) => option.key));
      let answer = null;
      let note = null;

      if (options.length >= 2) {
        if (type === "choice") {
          const raw = String(question.answer ?? "").trim().toUpperCase();
          if (keys.has(raw)) {
            answer = raw;
          } else {
            const rawText = String(question.answer ?? "").trim();
            const hit = options.find((option) => option.text === rawText || rawText.startsWith(`${option.key}.`) || rawText.startsWith(`${option.key}、`));
            if (hit) {
              answer = hit.key;
              note = "答案按选项文本重映射";
            }
          }
        } else {
          const rawKeys = (Array.isArray(question.answer) ? question.answer : String(question.answer ?? "").replace(/[,，、\s]+/g, "").split("")).map((key) =>
            String(key).trim().toUpperCase()
          );
          const valid = [...new Set(rawKeys.filter((key) => keys.has(key)))].sort();
          if (valid.length >= 1) {
            answer = valid;
            if (valid.length < rawKeys.length) note = "多选答案剔除无效字母";
          } else {
            const rawText = (Array.isArray(question.answer) ? question.answer.join(",") : String(question.answer ?? "")).trim();
            const hits = options.filter((option) => rawText.includes(option.text));
            if (hits.length >= 1) {
              answer = hits.map((option) => option.key).sort();
              note = "答案按选项文本重映射";
            }
          }
        }
      }

      if (answer !== null) {
        kept.push({
          id: question.id,
          seq: question.seq,
          type,
          stem: question.stem.trim(),
          options,
          answer,
          ...explanation,
          points: validPoints(question.points, type === "choice" ? 5 : 6),
        });
        if (note) repaired.push(`q${question.seq}: ${note}`);
        continue;
      }

      // 无法修复为选择题 → 有文本答案则降级为填空，否则丢弃
      const textAnswer = String(Array.isArray(question.answer) ? question.answer.join("") : question.answer ?? "").trim();
      if (textAnswer) {
        kept.push({
          id: question.id,
          seq: question.seq,
          type: "fill",
          stem: question.stem.trim(),
          answer: textAnswer,
          ...explanation,
          points: validPoints(question.points, 5),
        });
        repaired.push(`q${question.seq}: ${type}→fill（选项/答案非法）`);
      } else {
        dropped.push(`q${question.seq}（${type} 无有效选项与答案）`);
      }
      continue;
    }

    // fill/essay：答案非空（统一为字符串）
    const textAnswer = Array.isArray(question.answer) ? question.answer.join(" ").trim() : String(question.answer ?? "").trim();
    if (!textAnswer) {
      dropped.push(`q${question.seq}（${type} 缺答案）`);
      continue;
    }
    kept.push({
      id: question.id,
      seq: question.seq,
      type,
      stem: question.stem.trim(),
      answer: textAnswer,
      ...explanation,
      points: validPoints(question.points, type === "essay" ? 10 : 5),
    });
  }

  return { kept, dropped, repaired };
}
