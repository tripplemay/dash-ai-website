// 赛事数据共享核心：registry + content 分片 -> competitions-content.json 的纯函数实现。
// 仅使用 Node 标准库，供 competition-merge.mjs / validate-competitions.mjs 共同引用，
// 保证"合并产物"与"校验口径"始终一致。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

export const REGISTRY_PATH = path.join(SCRIPT_DIR, "competitions", "registry.json");
export const CONTENT_SHARDS_DIR = path.join(SCRIPT_DIR, "competitions", "content");
export const MERGED_CONTENT_PATH = path.join(SCRIPT_DIR, "competitions-content.json");
export const MERGED_CONTENT_REL = "scripts/competitions-content.json";
export const STATE_DIR = path.join(SCRIPT_DIR, "competitions", "state");

export const CATEGORIES = ["natural-science", "humanities", "art-sports"];
export const GRADES = ["小学", "初中", "高中", "中专", "职高"];
export const UPDATE_SOURCES = ["official", "moe", "media"];
// 与 src/lib/lessons.ts 的课程域保持一致，校验 relatedCourses 的合法范围
export const COURSE_SLUGS = ["s0", "drawing", "voice", "video", "python", "app", "data", "drone", "theory"];

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidSlug(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
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

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** 动态条目的稳定 slug：赛事 slug + 日期 + 内容短哈希，供 content_entries 使用 */
export function competitionUpdateSlug(competitionSlug, update) {
  const hash = createHash("sha1")
    .update(`${update.date}|${update.title}|${update.url ?? ""}`)
    .digest("hex")
    .slice(0, 8);
  const datePart = String(update.date || "unknown").replaceAll("-", "");
  return `${competitionSlug}-${datePart}-${hash}`;
}

export function readRegistry() {
  return readJsonFile(REGISTRY_PATH);
}

/** 读取全部 content 分片，返回 Map<slug, shard>（按文件名排序保证确定性） */
export function readContentShards() {
  const shards = new Map();
  if (!fs.existsSync(CONTENT_SHARDS_DIR)) return shards;
  const files = fs
    .readdirSync(CONTENT_SHARDS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const file of files) {
    const filePath = path.join(CONTENT_SHARDS_DIR, file);
    let shard;
    try {
      shard = readJsonFile(filePath);
    } catch (error) {
      throw new Error(`content 分片 ${file} 不是合法 JSON：${error.message}`);
    }
    if (isRecord(shard) && typeof shard.slug === "string") {
      shards.set(shard.slug, shard);
    }
  }
  return shards;
}

/**
 * 合并 registry 与 content 分片，产出 competitions-content.json 的内存对象。
 * 严格模式：registry 中每项赛事必须有对应分片，分片不允许游离于 registry 之外。
 */
export function buildCompetitionsContent(registry, shards) {
  const problems = [];
  const registryList = Array.isArray(registry?.competitions) ? registry.competitions : [];
  const merged = [];

  for (const entry of registryList) {
    const shard = shards.get(entry.slug);
    if (!shard) {
      problems.push(`registry 赛事 ${entry.slug} 缺少 content 分片`);
      continue;
    }
    const item = {
      slug: entry.slug,
      nameZh: entry.nameZh,
      ...(nonEmptyString(shard.nameEn) ? { nameEn: shard.nameEn } : {}),
      category: entry.category,
      organizer: entry.organizer,
      grades: entry.grades,
      officialSite: entry.officialSite ?? null,
      ...(Array.isArray(entry.newsPages) && entry.newsPages.length ? { newsPages: entry.newsPages } : {}),
      moeListIndex: entry.moeListIndex,
      summary: shard.summary,
      description: shard.description,
      schedule: shard.schedule ?? [],
      updates: shard.updates ?? [],
      links: shard.links ?? [],
      tags: shard.tags ?? [],
      relatedCourses: shard.relatedCourses ?? [],
      sourceCheckedAt: shard.sourceCheckedAt,
    };
    merged.push(item);
  }

  for (const slug of shards.keys()) {
    if (!registryList.some((entry) => entry.slug === slug)) {
      problems.push(`content 分片 ${slug} 不在 registry 中`);
    }
  }

  return {
    problems,
    content: {
      moeList: registry?.moeList ?? null,
      competitions: merged,
    },
  };
}

/** 生成最终落盘内容（generatedAt 由调用方注入，便于校验时做确定性对比） */
export function serializeCompetitionsContent(registry, shards, generatedAt) {
  const { problems, content } = buildCompetitionsContent(registry, shards);
  if (problems.length) {
    throw new Error(`赛事内容合并失败：\n- ${problems.join("\n- ")}`);
  }
  return { generatedAt, ...content };
}

/** 供校验脚本做"合并产物是否与分片一致"的确定性对比（忽略 generatedAt） */
export function stripGeneratedAt(value) {
  if (!isRecord(value)) return value;
  const rest = { ...value };
  delete rest.generatedAt;
  return rest;
}
