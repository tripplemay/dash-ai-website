#!/usr/bin/env node

/**
 * 校验赛事数据：registry.json、content 分片、合并产物 competitions-content.json。
 * 仅使用 Node 标准库（competition-lib.mjs 同为零依赖），可在依赖安装前与 CI 中运行。
 * 用法：node scripts/validate-competitions.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import {
  CATEGORIES,
  COURSE_SLUGS,
  GRADES,
  MERGED_CONTENT_PATH,
  MERGED_CONTENT_REL,
  REGISTRY_PATH,
  REPO_ROOT,
  UPDATE_SOURCES,
  buildCompetitionsContent,
  isRecord,
  isValidDate,
  isValidHttpUrl,
  isValidSlug,
  nonEmptyString,
  readJsonFile,
  readContentShards,
  stripGeneratedAt,
} from "./competition-lib.mjs";

function usage() {
  return "Usage: node scripts/validate-competitions.mjs [--json]";
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

function readJsonSafe(filePath, label, errors) {
  try {
    return readJsonFile(filePath);
  } catch (error) {
    errors.push({
      code: "INVALID_JSON",
      path: path.relative(REPO_ROOT, filePath),
      message: `${label} cannot be read as JSON: ${error.message}`,
    });
    return null;
  }
}

function validateRegistry(registry, errors) {
  const summary = { total: 0, categories: {}, withSite: 0 };
  if (!isRecord(registry)) {
    errors.push({ code: "INVALID_REGISTRY", path: "registry.json", message: "registry must be a JSON object" });
    return summary;
  }

  const moeList = registry.moeList;
  if (!isRecord(moeList)) {
    errors.push({ code: "INVALID_MOE_LIST", path: "registry.json.moeList", message: "moeList must be an object" });
  } else {
    if (!nonEmptyString(moeList.name)) {
      errors.push({ code: "MISSING_MOE_LIST_NAME", path: "registry.json.moeList.name", message: "name must be a non-empty string" });
    }
    if (!isValidHttpUrl(moeList.announcementUrl)) {
      errors.push({ code: "INVALID_MOE_LIST_URL", path: "registry.json.moeList.announcementUrl", message: "announcementUrl must be an http(s) URL" });
    }
    if (!isValidDate(moeList.publishedAt)) {
      errors.push({ code: "INVALID_MOE_LIST_DATE", path: "registry.json.moeList.publishedAt", message: "publishedAt must be YYYY-MM-DD" });
    }
    if (!Number.isInteger(moeList.totalCount) || moeList.totalCount < 1) {
      errors.push({ code: "INVALID_MOE_LIST_TOTAL", path: "registry.json.moeList.totalCount", message: "totalCount must be a positive integer" });
    }
  }

  if (!Array.isArray(registry.competitions) || registry.competitions.length === 0) {
    errors.push({ code: "INVALID_REGISTRY_LIST", path: "registry.json.competitions", message: "competitions must be a non-empty array" });
    return summary;
  }

  const seenSlugs = new Set();
  const seenIndexes = new Set();
  for (const [index, entry] of registry.competitions.entries()) {
    const entryPath = `registry.json.competitions[${index}]`;
    if (!isRecord(entry)) {
      errors.push({ code: "INVALID_REGISTRY_ENTRY", path: entryPath, message: "entry must be an object" });
      continue;
    }
    const at = (field) => `${entryPath}${isValidSlug(entry.slug) ? `(${entry.slug})` : ""}.${field}`;

    if (!isValidSlug(entry.slug)) {
      errors.push({ code: "INVALID_SLUG", path: `${entryPath}.slug`, message: "slug must be unique kebab-case" });
    } else if (seenSlugs.has(entry.slug)) {
      errors.push({ code: "DUPLICATE_SLUG", path: `${entryPath}.slug`, message: `duplicate slug ${entry.slug}` });
    } else {
      seenSlugs.add(entry.slug);
    }
    if (!nonEmptyString(entry.nameZh)) {
      errors.push({ code: "MISSING_NAME", path: at("nameZh"), message: "nameZh must be a non-empty string" });
    }
    if (!CATEGORIES.includes(entry.category)) {
      errors.push({ code: "INVALID_CATEGORY", path: at("category"), message: `category must be one of ${CATEGORIES.join("/")}` });
    } else {
      summary.categories[entry.category] = (summary.categories[entry.category] ?? 0) + 1;
    }
    if (!nonEmptyString(entry.organizer)) {
      errors.push({ code: "MISSING_ORGANIZER", path: at("organizer"), message: "organizer must be a non-empty string" });
    }
    if (!Array.isArray(entry.grades) || entry.grades.length === 0 || entry.grades.some((grade) => !GRADES.includes(grade))) {
      errors.push({ code: "INVALID_GRADES", path: at("grades"), message: `grades must be a non-empty subset of ${GRADES.join("/")}` });
    }
    if (entry.officialSite !== null && !isValidHttpUrl(entry.officialSite)) {
      errors.push({ code: "INVALID_OFFICIAL_SITE", path: at("officialSite"), message: "officialSite must be null or an http(s) URL" });
    } else if (entry.officialSite) {
      summary.withSite += 1;
    }
    if (entry.newsPages !== undefined) {
      if (!Array.isArray(entry.newsPages) || entry.newsPages.some((url) => !isValidHttpUrl(url))) {
        errors.push({ code: "INVALID_NEWS_PAGES", path: at("newsPages"), message: "newsPages must be an array of http(s) URLs" });
      }
    }
    if (entry.apiPages !== undefined) {
      if (!Array.isArray(entry.apiPages) || entry.apiPages.length === 0) {
        errors.push({ code: "INVALID_API_PAGES", path: at("apiPages"), message: "apiPages must be a non-empty array of API configs" });
      } else {
        for (const [apiIndex, api] of entry.apiPages.entries()) {
          const apiPath = `${at("apiPages")}[${apiIndex}]`;
          if (!isRecord(api)) {
            errors.push({ code: "INVALID_API_PAGE", path: apiPath, message: "api config must be an object" });
            continue;
          }
          if (!isValidHttpUrl(api.url)) {
            errors.push({ code: "INVALID_API_URL", path: `${apiPath}.url`, message: "url must be an http(s) URL" });
          }
          if (api.method !== undefined && !["GET", "POST"].includes(String(api.method).toUpperCase())) {
            errors.push({ code: "INVALID_API_METHOD", path: `${apiPath}.method`, message: "method must be GET or POST" });
          }
          if (typeof api.listPath !== "string") {
            errors.push({ code: "MISSING_API_LIST_PATH", path: `${apiPath}.listPath`, message: "listPath must be a dot path string (empty string = 根即为数组)" });
          }
          if (!nonEmptyString(api.titleField)) {
            errors.push({ code: "MISSING_API_TITLE_FIELD", path: `${apiPath}.titleField`, message: "titleField must be a non-empty string" });
          }
          for (const field of ["dateField", "urlField"]) {
            if (api[field] !== undefined && !nonEmptyString(api[field])) {
              errors.push({ code: "INVALID_API_FIELD", path: `${apiPath}.${field}`, message: `${field} must be a non-empty string when present` });
            }
          }
          if (api.urlTemplate !== undefined && (typeof api.urlTemplate !== "string" || !/^https?:\/\//.test(api.urlTemplate))) {
            errors.push({ code: "INVALID_API_URL_TEMPLATE", path: `${apiPath}.urlTemplate`, message: "urlTemplate must start with http(s)://" });
          }
          if (api.headers !== undefined && (!isRecord(api.headers) || Object.values(api.headers).some((v) => typeof v !== "string"))) {
            errors.push({ code: "INVALID_API_HEADERS", path: `${apiPath}.headers`, message: "headers must be an object of string values" });
          }
        }
      }
    }
    if (entry.paperPages !== undefined) {
      if (!Array.isArray(entry.paperPages) || entry.paperPages.length === 0) {
        errors.push({ code: "INVALID_PAPER_PAGES", path: at("paperPages"), message: "paperPages must be a non-empty array of {url, label?}" });
      } else {
        for (const [pageIndex, page] of entry.paperPages.entries()) {
          const pagePath = `${at("paperPages")}[${pageIndex}]`;
          if (!isRecord(page) || !isValidHttpUrl(page.url)) {
            errors.push({ code: "INVALID_PAPER_PAGE", path: `${pagePath}.url`, message: "paperPages entries must be objects with an http(s) url" });
          } else if (page.label !== undefined && !nonEmptyString(page.label)) {
            errors.push({ code: "INVALID_PAPER_PAGE_LABEL", path: `${pagePath}.label`, message: "label must be a non-empty string when present" });
          }
        }
      }
    }
    if (!Number.isInteger(entry.moeListIndex) || entry.moeListIndex < 1) {
      errors.push({ code: "INVALID_MOE_INDEX", path: at("moeListIndex"), message: "moeListIndex must be a positive integer" });
    } else if (seenIndexes.has(entry.moeListIndex)) {
      errors.push({ code: "DUPLICATE_MOE_INDEX", path: at("moeListIndex"), message: `duplicate moeListIndex ${entry.moeListIndex}` });
    } else {
      seenIndexes.add(entry.moeListIndex);
    }
  }

  summary.total = registry.competitions.length;
  if (Number.isInteger(moeList?.totalCount) && registry.competitions.length !== moeList.totalCount) {
    errors.push({
      code: "MOE_TOTAL_MISMATCH",
      path: "registry.json.competitions",
      message: `moeList.totalCount=${moeList.totalCount} but competitions has ${registry.competitions.length} entries`,
    });
  }
  return summary;
}

function validateShard(shard, label, errors) {
  if (!isRecord(shard)) {
    errors.push({ code: "INVALID_SHARD", path: label, message: "shard must be a JSON object" });
    return;
  }
  const at = (field) => `${label}.${field}`;

  if (!isValidSlug(shard.slug)) {
    errors.push({ code: "INVALID_SLUG", path: at("slug"), message: "slug must be kebab-case" });
  }
  if (shard.nameEn !== undefined && !nonEmptyString(shard.nameEn)) {
    errors.push({ code: "INVALID_NAME_EN", path: at("nameEn"), message: "nameEn must be a non-empty string when present" });
  }
  if (!nonEmptyString(shard.summary)) {
    errors.push({ code: "MISSING_SUMMARY", path: at("summary"), message: "summary must be a non-empty string" });
  }
  if (!nonEmptyString(shard.description)) {
    errors.push({ code: "MISSING_DESCRIPTION", path: at("description"), message: "description must be a non-empty string" });
  }
  if (!isValidDate(shard.sourceCheckedAt)) {
    errors.push({ code: "INVALID_CHECKED_AT", path: at("sourceCheckedAt"), message: "sourceCheckedAt must be YYYY-MM-DD" });
  }

  if (!Array.isArray(shard.schedule)) {
    errors.push({ code: "INVALID_SCHEDULE", path: at("schedule"), message: "schedule must be an array (empty allowed while 待公布)" });
  } else {
    for (const [index, stage] of shard.schedule.entries()) {
      const stagePath = `${at("schedule")}[${index}]`;
      if (!isRecord(stage) || !nonEmptyString(stage.stage)) {
        errors.push({ code: "INVALID_STAGE", path: stagePath, message: "stage must be an object with a non-empty stage name" });
        continue;
      }
      for (const field of ["start", "end"]) {
        if (stage[field] !== null && stage[field] !== undefined && !isValidDate(stage[field])) {
          errors.push({ code: "INVALID_STAGE_DATE", path: `${stagePath}.${field}`, message: `${field} must be YYYY-MM-DD or null` });
        }
      }
      if (isValidDate(stage.start) && isValidDate(stage.end) && stage.start > stage.end) {
        errors.push({ code: "STAGE_DATE_ORDER", path: stagePath, message: "stage start must not be after end" });
      }
      if (stage.completed !== undefined && typeof stage.completed !== "boolean") {
        errors.push({ code: "INVALID_STAGE_COMPLETED", path: `${stagePath}.completed`, message: "completed must be a boolean" });
      }
    }
  }

  if (!Array.isArray(shard.updates)) {
    errors.push({ code: "INVALID_UPDATES", path: at("updates"), message: "updates must be an array (empty allowed)" });
  } else {
    for (const [index, update] of shard.updates.entries()) {
      const updatePath = `${at("updates")}[${index}]`;
      if (!isRecord(update)) {
        errors.push({ code: "INVALID_UPDATE", path: updatePath, message: "update must be an object" });
        continue;
      }
      if (!isValidDate(update.date)) {
        errors.push({ code: "INVALID_UPDATE_DATE", path: `${updatePath}.date`, message: "date must be YYYY-MM-DD" });
      }
      if (!nonEmptyString(update.title)) {
        errors.push({ code: "MISSING_UPDATE_TITLE", path: `${updatePath}.title`, message: "title must be a non-empty string" });
      }
      if (update.url !== undefined && update.url !== null && !isValidHttpUrl(update.url)) {
        errors.push({ code: "INVALID_UPDATE_URL", path: `${updatePath}.url`, message: "url must be an http(s) URL" });
      }
      if (!UPDATE_SOURCES.includes(update.source)) {
        errors.push({ code: "INVALID_UPDATE_SOURCE", path: `${updatePath}.source`, message: `source must be one of ${UPDATE_SOURCES.join("/")}` });
      }
    }
  }

  if (!Array.isArray(shard.links) || shard.links.some((link) => !isRecord(link) || !nonEmptyString(link.label) || !isValidHttpUrl(link.url))) {
    errors.push({ code: "INVALID_LINKS", path: at("links"), message: "links must be an array of {label, url(http(s))}" });
  }
  if (!Array.isArray(shard.tags) || shard.tags.some((tag) => !nonEmptyString(tag))) {
    errors.push({ code: "INVALID_TAGS", path: at("tags"), message: "tags must be an array of non-empty strings" });
  }
  if (!Array.isArray(shard.relatedCourses) || shard.relatedCourses.some((slug) => !COURSE_SLUGS.includes(slug))) {
    errors.push({ code: "INVALID_RELATED_COURSES", path: at("relatedCourses"), message: `relatedCourses must be a subset of ${COURSE_SLUGS.join("/")}` });
  }
}

function validateMerged(shards, registry, errors) {
  if (!fs.existsSync(MERGED_CONTENT_PATH)) {
    errors.push({ code: "MISSING_MERGED", path: MERGED_CONTENT_REL, message: "run pnpm competitions:merge to generate it" });
    return { mergedTotal: 0, fresh: false };
  }
  const merged = readJsonSafe(MERGED_CONTENT_PATH, MERGED_CONTENT_REL, errors);
  if (!isRecord(merged)) return { mergedTotal: 0, fresh: false };

  const { problems, content } = buildCompetitionsContent(registry, shards);
  for (const problem of problems) {
    errors.push({ code: "MERGE_MISMATCH", path: "registry↔content", message: problem });
  }
  const fresh = JSON.stringify(stripGeneratedAt(merged)) === JSON.stringify(stripGeneratedAt({ generatedAt: null, ...content }));
  if (!fresh && problems.length === 0) {
    errors.push({ code: "STALE_MERGED", path: MERGED_CONTENT_REL, message: "merged content is stale; run pnpm competitions:merge" });
  }
  return {
    mergedTotal: Array.isArray(merged.competitions) ? merged.competitions.length : 0,
    fresh: fresh && problems.length === 0,
  };
}

function validate() {
  const errors = [];
  const registry = readJsonSafe(REGISTRY_PATH, "scripts/competitions/registry.json", errors);
  const registrySummary = validateRegistry(registry, errors);

  const shards = readContentShards();
  for (const [slug, shard] of [...shards.entries()].sort()) {
    validateShard(shard, `content/${slug}.json`, errors);
  }

  const mergedSummary = isRecord(registry) ? validateMerged(shards, registry, errors) : { mergedTotal: 0, fresh: false };

  return {
    ok: errors.length === 0,
    registry: registrySummary,
    shards: shards.size,
    merged: mergedSummary,
    errors,
  };
}

function printHuman(report) {
  if (report.ok) {
    console.log("Competitions validation passed.");
    console.log(`- competitions: ${report.registry.total} (official site confirmed: ${report.registry.withSite})`);
    console.log(`- categories: ${CATEGORIES.map((c) => `${c}=${report.registry.categories[c] ?? 0}`).join(", ")}`);
    console.log(`- content shards: ${report.shards}; merged file fresh: ${report.merged.fresh ? "yes" : "no"}`);
    return;
  }
  console.error(`Competitions validation failed (${report.errors.length} issue${report.errors.length === 1 ? "" : "s"}):`);
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
