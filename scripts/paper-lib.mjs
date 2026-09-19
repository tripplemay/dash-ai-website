// 备赛资料（真题/命题/规则/获奖范例）共享核心：paper 分片 -> papers-content.json 的纯函数实现。
// 仅使用 Node 标准库，供 paper-merge.mjs / validate-papers.mjs / paper-collector.mjs 共同引用，
// 保证"合并产物"与"校验口径"始终一致。模式与 competition-lib.mjs 对齐。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

export const PAPER_SHARDS_DIR = path.join(SCRIPT_DIR, "competitions", "papers");
export const MERGED_PAPERS_PATH = path.join(SCRIPT_DIR, "papers-content.json");
export const MERGED_PAPERS_REL = "scripts/papers-content.json";
export const PAPER_STATE_DIR = path.join(SCRIPT_DIR, "competitions", "paper-state");

/** 资料类型受控词表（全量覆盖设计：笔试类收试卷，创作类收命题，实操类收规则，评审类收范例） */
export const PAPER_KINDS = ["paper", "answer", "problem", "rules", "standard", "gallery", "attachment"];

/** 赛事阶段受控词表（展示顺序即数组顺序） */
export const PAPER_STAGES = ["初赛", "预赛", "联赛", "复赛", "省选", "全国赛", "决赛", "总决赛", "冬令营", "其他"];

/** stage -> id 用 ASCII 码（fileKey 需要 URL 安全字符） */
export const STAGE_CODES = {
  初赛: "chuji",
  预赛: "yusai",
  联赛: "liansai",
  复赛: "fusai",
  省选: "shengxuan",
  全国赛: "quanguosai",
  决赛: "juesai",
  总决赛: "zongjuesai",
  冬令营: "donglingying",
  其他: "other",
};

export const PAPER_FILE_FORMATS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "jpg", "png", "webp", "txt", "html"];

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function isValidSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** 资料 id：kebab-case（稳定复抓去重的关键，见 paperMaterialId） */
export function isValidPaperId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

/** 落盘文件键：files/papers/<slug>/<ascii 文件名>（对应 VPS 公共卷 public/ 下的相对路径） */
export function isValidPaperFileKey(slug, fileKey) {
  if (typeof fileKey !== "string") return false;
  const pattern = new RegExp(`^files/papers/${slug}/[A-Za-z0-9._-]+$`);
  return pattern.test(fileKey);
}

export function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha1Hex(text) {
  return createHash("sha1").update(text).digest("hex");
}

/**
 * 资料稳定 id：<slug>-<year>-<stageCode>-<title 哈希 6 位>。
 * 同一来源标题复抓时生成同一 id，靠 id 去重而不重复入库；
 * 同年同阶段多套卷（一试/二试、A/B 卷）靠标题哈希区分。
 */
export function paperMaterialId(slug, year, stage, title) {
  const stageCode = STAGE_CODES[stage] ?? STAGE_CODES["其他"];
  return `${slug}-${year}-${stageCode}-${sha1Hex(String(title)).slice(0, 6)}`;
}

const YEAR_RE = /(20\d{2})\s*[年届\-_/]?/;

/** 从标题/URL 推断年份：优先"20XX 年/届"样式，其次任意 20XX */
export function inferYear(text) {
  if (!text) return null;
  const match = String(text).match(YEAR_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const current = new Date().getFullYear();
  return year >= 1990 && year <= current + 1 ? year : null;
}

const STAGE_RULES = [
  ["总决赛", "总决赛"],
  ["决赛", "决赛"],
  ["冬令营", "冬令营"],
  ["复赛", "复赛"],
  ["初赛", "初赛"],
  ["预赛", "预赛"],
  ["联赛", "联赛"],
  ["省选", "省选"],
  ["全国赛", "全国赛"],
];

/** 从标题推断赛事阶段，归入受控词表 */
export function inferStage(text) {
  if (!text) return "其他";
  for (const [keyword, stage] of STAGE_RULES) {
    if (String(text).includes(keyword)) return stage;
  }
  return "其他";
}

const KIND_RULES = [
  [/答案|解答|参考答案|解析/, "answer"],
  [/评分标准|评审标准|评分细则|评分办法/, "standard"],
  [/规程|规则|竞赛办法|比赛办法|章程|参赛指南|申报指南|活动指南|手册/, "rules"],
  [/获奖名单|名单公示|获奖作品|优秀作品|获奖论文|作品集/, "gallery"],
  [/试题|试卷|真题|考题/, "paper"],
  [/任务书|赛题|命题|主题|题目|选题/, "problem"],
];

/** 从标题推断资料类型（顺序即优先级：答案先于试卷，标准先于规则） */
export function inferKind(text) {
  for (const [pattern, kind] of KIND_RULES) {
    if (pattern.test(String(text ?? ""))) return kind;
  }
  return "attachment";
}

/** 从 URL/文件名推断文件格式，归一到受控格式表 */
export function inferFormat(url) {
  const match = String(url ?? "").toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
  if (!match) return null;
  const ext = match[1];
  if (ext === "jpeg") return "jpg";
  return PAPER_FILE_FORMATS.includes(ext) ? ext : null;
}

/** 读取全部 paper 分片，返回 Map<slug, shard>（按文件名排序保证确定性） */
export function readPaperShards() {
  const shards = new Map();
  if (!fs.existsSync(PAPER_SHARDS_DIR)) return shards;
  const files = fs
    .readdirSync(PAPER_SHARDS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const file of files) {
    const filePath = path.join(PAPER_SHARDS_DIR, file);
    let shard;
    try {
      shard = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      throw new Error(`paper 分片 ${file} 不是合法 JSON：${error.message}`);
    }
    if (isRecord(shard) && typeof shard.slug === "string") {
      shards.set(shard.slug, shard);
    }
  }
  return shards;
}

/**
 * 合并 registry 与 paper 分片，产出 papers-content.json 的内存对象。
 * 严格模式（与 content 分片一致）：registry 中每项赛事必须有 paper 分片（允许空 papers），
 * 分片不允许游离于 registry 之外 —— 覆盖状态由页面按 papers.length 推导。
 */
export function buildPapersContent(registry, shards) {
  const problems = [];
  const registryList = Array.isArray(registry?.competitions) ? registry.competitions : [];
  const merged = [];

  for (const entry of registryList) {
    const shard = shards.get(entry.slug);
    if (!shard) {
      problems.push(`registry 赛事 ${entry.slug} 缺少 paper 分片`);
      continue;
    }
    merged.push({
      slug: entry.slug,
      nameZh: entry.nameZh,
      category: entry.category,
      moeListIndex: entry.moeListIndex,
      papers: shard.papers ?? [],
    });
  }

  for (const slug of shards.keys()) {
    if (!registryList.some((entry) => entry.slug === slug)) {
      problems.push(`paper 分片 ${slug} 不在 registry 中`);
    }
  }

  return { problems, content: { competitions: merged } };
}

/** 生成最终落盘内容（generatedAt 由调用方注入，便于校验时做确定性对比） */
export function serializePapersContent(registry, shards, generatedAt) {
  const { problems, content } = buildPapersContent(registry, shards);
  if (problems.length) {
    throw new Error(`备赛资料合并失败：\n- ${problems.join("\n- ")}`);
  }
  return { generatedAt, ...content };
}

/** 供校验脚本做"合并产物是否与分片一致"的确定性对比（忽略 generatedAt） */
export function stripPapersGeneratedAt(value) {
  if (!isRecord(value)) return value;
  const rest = { ...value };
  delete rest.generatedAt;
  return rest;
}
