#!/usr/bin/env node

/**
 * 校验备赛资料数据：paper 分片（scripts/competitions/papers/）与合并产物 papers-content.json。
 * 仅使用 Node 标准库（paper-lib.mjs 同为零依赖），可在依赖安装前与 CI 中运行。
 * registry 中 paperPages 配置的校验在 validate-competitions.mjs（registry 单一门禁）。
 * 用法：node scripts/validate-papers.mjs [--json]
 */

import fs from "node:fs";
import {
  GRADES,
  isValidSlug,
  readRegistry,
} from "./competition-lib.mjs";
import {
  MERGED_PAPERS_PATH,
  MERGED_PAPERS_REL,
  PAPER_FILE_FORMATS,
  PAPER_KINDS,
  PAPER_STAGES,
  buildPapersContent,
  isRecord,
  isValidDate,
  isValidHttpUrl,
  isValidPaperFileKey,
  isValidPaperId,
  isValidSha256,
  nonEmptyString,
  readPaperShards,
  stripPapersGeneratedAt,
} from "./paper-lib.mjs";

function usage() {
  return "Usage: node scripts/validate-papers.mjs [--json]";
}

function parseArgs(argv) {
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }
  return { json };
}

function validatePaperFile(slug, file, filePath, errors) {
  if (!isRecord(file)) {
    errors.push({ code: "INVALID_PAPER_FILE", path: filePath, message: "file must be an object" });
    return;
  }
  if (!PAPER_KINDS.includes(file.kind)) {
    errors.push({ code: "INVALID_FILE_KIND", path: `${filePath}.kind`, message: `kind must be one of ${PAPER_KINDS.join("/")}` });
  }
  if (!PAPER_FILE_FORMATS.includes(file.format)) {
    errors.push({ code: "INVALID_FILE_FORMAT", path: `${filePath}.format`, message: `format must be one of ${PAPER_FILE_FORMATS.join("/")}` });
  }
  const hasFileKey = nonEmptyString(file.fileKey);
  const hasExternalUrl = nonEmptyString(file.externalUrl);
  if (hasFileKey === hasExternalUrl) {
    errors.push({ code: "FILE_LOCATION_AMBIGUOUS", path: filePath, message: "exactly one of fileKey / externalUrl must be present" });
  }
  if (hasFileKey) {
    if (!isValidPaperFileKey(slug, file.fileKey)) {
      errors.push({ code: "INVALID_FILE_KEY", path: `${filePath}.fileKey`, message: `fileKey must match files/papers/${slug}/<ascii name>` });
    }
    if (!Number.isInteger(file.size) || file.size < 0) {
      errors.push({ code: "INVALID_FILE_SIZE", path: `${filePath}.size`, message: "size must be a non-negative integer (bytes)" });
    }
    if (!isValidSha256(file.sha256)) {
      errors.push({ code: "INVALID_FILE_SHA256", path: `${filePath}.sha256`, message: "sha256 must be 64 lowercase hex chars" });
    }
  }
  if (hasExternalUrl && !isValidHttpUrl(file.externalUrl)) {
    errors.push({ code: "INVALID_EXTERNAL_URL", path: `${filePath}.externalUrl`, message: "externalUrl must be an http(s) URL" });
  }
}

function validatePaperShard(shard, label, errors) {
  if (!isRecord(shard)) {
    errors.push({ code: "INVALID_SHARD", path: label, message: "shard must be a JSON object" });
    return { materials: 0 };
  }
  if (!isValidSlug(shard.slug)) {
    errors.push({ code: "INVALID_SLUG", path: `${label}.slug`, message: "slug must be kebab-case" });
  }
  if (!Array.isArray(shard.papers)) {
    errors.push({ code: "INVALID_PAPERS", path: `${label}.papers`, message: "papers must be an array (empty allowed)" });
    return { materials: 0 };
  }

  const slug = shard.slug;
  const seenIds = new Set();
  const currentYear = new Date().getFullYear();
  for (const [index, paper] of shard.papers.entries()) {
    const at = `${label}.papers[${index}]`;
    if (!isRecord(paper)) {
      errors.push({ code: "INVALID_PAPER", path: at, message: "paper must be an object" });
      continue;
    }
    if (!isValidPaperId(paper.id)) {
      errors.push({ code: "INVALID_PAPER_ID", path: `${at}.id`, message: "id must be kebab-case ascii" });
    } else {
      if (isValidSlug(slug) && !paper.id.startsWith(`${slug}-`)) {
        errors.push({ code: "PAPER_ID_PREFIX", path: `${at}.id`, message: `id must start with "${slug}-"` });
      }
      if (seenIds.has(paper.id)) {
        errors.push({ code: "DUPLICATE_PAPER_ID", path: `${at}.id`, message: `duplicate id ${paper.id}` });
      } else {
        seenIds.add(paper.id);
      }
    }
    if (!Number.isInteger(paper.year) || paper.year < 1990 || paper.year > currentYear + 1) {
      errors.push({ code: "INVALID_PAPER_YEAR", path: `${at}.year`, message: `year must be an integer in [1990, ${currentYear + 1}]` });
    }
    if (!PAPER_STAGES.includes(paper.stage)) {
      errors.push({ code: "INVALID_PAPER_STAGE", path: `${at}.stage`, message: `stage must be one of ${PAPER_STAGES.join("/")}` });
    }
    if (paper.grade !== null && paper.grade !== undefined && !GRADES.includes(paper.grade)) {
      errors.push({ code: "INVALID_PAPER_GRADE", path: `${at}.grade`, message: `grade must be null or one of ${GRADES.join("/")}` });
    }
    if (!nonEmptyString(paper.title)) {
      errors.push({ code: "MISSING_PAPER_TITLE", path: `${at}.title`, message: "title must be a non-empty string" });
    }
    if (!Array.isArray(paper.files) || paper.files.length === 0) {
      errors.push({ code: "INVALID_PAPER_FILES", path: `${at}.files`, message: "files must be a non-empty array" });
    } else {
      for (const [fileIndex, file] of paper.files.entries()) {
        validatePaperFile(slug, file, `${at}.files[${fileIndex}]`, errors);
      }
    }
    if (typeof paper.hasAnswer !== "boolean") {
      errors.push({ code: "INVALID_HAS_ANSWER", path: `${at}.hasAnswer`, message: "hasAnswer must be a boolean" });
    }
    if (!isRecord(paper.source) || !nonEmptyString(paper.source.name) || !isValidHttpUrl(paper.source.url)) {
      errors.push({ code: "INVALID_PAPER_SOURCE", path: `${at}.source`, message: "source must be {name: non-empty, url: http(s)}" });
    }
    if (paper.auto !== undefined && typeof paper.auto !== "boolean") {
      errors.push({ code: "INVALID_AUTO", path: `${at}.auto`, message: "auto must be a boolean when present" });
    }
    if (!isValidDate(paper.collectedAt)) {
      errors.push({ code: "INVALID_COLLECTED_AT", path: `${at}.collectedAt`, message: "collectedAt must be YYYY-MM-DD" });
    }
    if (paper.disabled !== undefined && typeof paper.disabled !== "boolean") {
      errors.push({ code: "INVALID_DISABLED", path: `${at}.disabled`, message: "disabled must be a boolean when present" });
    }
  }
  return { materials: shard.papers.length };
}

function validateMerged(shards, registry, errors) {
  if (!fs.existsSync(MERGED_PAPERS_PATH)) {
    errors.push({ code: "MISSING_MERGED", path: MERGED_PAPERS_REL, message: "run pnpm papers:merge to generate it" });
    return { fresh: false };
  }
  let merged = null;
  try {
    merged = JSON.parse(fs.readFileSync(MERGED_PAPERS_PATH, "utf8"));
  } catch (error) {
    errors.push({ code: "INVALID_JSON", path: MERGED_PAPERS_REL, message: `merged file is not valid JSON: ${error.message}` });
    return { fresh: false };
  }
  const { problems, content } = buildPapersContent(registry, shards);
  for (const problem of problems) {
    errors.push({ code: "MERGE_MISMATCH", path: "registry↔papers", message: problem });
  }
  const fresh = JSON.stringify(stripPapersGeneratedAt(merged)) === JSON.stringify(stripPapersGeneratedAt({ generatedAt: null, ...content }));
  if (!fresh && problems.length === 0) {
    errors.push({ code: "STALE_MERGED", path: MERGED_PAPERS_REL, message: "merged papers content is stale; run pnpm papers:merge" });
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

  const shards = readPaperShards();
  let materials = 0;
  for (const [slug, shard] of [...shards.entries()].sort()) {
    materials += validatePaperShard(shard, `papers/${slug}.json`, errors).materials;
  }

  const mergedSummary = registry ? validateMerged(shards, registry, errors) : { fresh: false };

  return {
    ok: errors.length === 0,
    shards: shards.size,
    materials,
    merged: mergedSummary,
    errors,
  };
}

function printHuman(report) {
  if (report.ok) {
    console.log("Papers validation passed.");
    console.log(`- paper shards: ${report.shards}; materials: ${report.materials}; merged file fresh: ${report.merged.fresh ? "yes" : "no"}`);
    return;
  }
  console.error(`Papers validation failed (${report.errors.length} issue${report.errors.length === 1 ? "" : "s"}):`);
  for (const issue of report.errors) console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = validate();
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
