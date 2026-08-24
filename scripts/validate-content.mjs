#!/usr/bin/env node

/**
 * Validate the checked-in lesson and resource catalogues without mutating them.
 *
 * This intentionally uses only Node's standard library so it can run before
 * dependencies are installed and from CI packaging steps.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const LESSON_SEED_PATH = path.join(SCRIPT_DIR, "lessons-seed.json");
const LESSON_CONTENT_PATH = path.join(SCRIPT_DIR, "lessons-content.json");
const RESOURCE_SEED_PATH = path.join(SCRIPT_DIR, "resources-seed.json");
const EXPECTED_TOTAL_LESSONS = 135;
const RESOURCE_BILINGUAL_FIELDS = ["title", "title_en", "category", "category_en"];

function usage() {
  return "Usage: node scripts/validate-content.mjs [--json]";
}

function parseArgs(argv) {
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }
  return { json };
}

function readJson(filePath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push({
      code: "INVALID_JSON",
      path: path.relative(REPO_ROOT, filePath),
      message: `${label} cannot be read as JSON: ${error.message}`,
    });
    return null;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateLessonMap(value, label, errors) {
  if (!isRecord(value)) {
    errors.push({ code: "INVALID_LESSON_MAP", path: label, message: `${label} must be a JSON object keyed by course slug` });
    return {};
  }

  const counts = {};
  for (const [course, lessons] of Object.entries(value)) {
    const coursePath = `${label}.${course}`;
    if (!Array.isArray(lessons)) {
      errors.push({ code: "INVALID_LESSON_LIST", path: coursePath, message: "course value must be an array" });
      counts[course] = 0;
      continue;
    }

    counts[course] = lessons.length;
    const seenNumbers = new Set();
    for (const [index, lesson] of lessons.entries()) {
      const lessonPath = `${coursePath}[${index}]`;
      if (!isRecord(lesson)) {
        errors.push({ code: "INVALID_LESSON", path: lessonPath, message: "lesson must be an object" });
        continue;
      }
      if (!Number.isInteger(lesson.n) || lesson.n < 1) {
        errors.push({ code: "INVALID_LESSON_NUMBER", path: `${lessonPath}.n`, message: "lesson n must be a positive integer" });
      } else if (seenNumbers.has(lesson.n)) {
        errors.push({ code: "DUPLICATE_LESSON_NUMBER", path: `${lessonPath}.n`, message: `duplicate lesson number ${lesson.n}` });
      } else {
        seenNumbers.add(lesson.n);
      }
      if (!nonEmptyString(lesson.title)) {
        errors.push({ code: "MISSING_LESSON_TITLE", path: `${lessonPath}.title`, message: "lesson title must be a non-empty string" });
      }
    }

    const expectedNumbers = Array.from({ length: lessons.length }, (_, index) => index + 1);
    if (lessons.every((lesson) => isRecord(lesson) && Number.isInteger(lesson.n)) &&
        lessons.some((lesson, index) => lesson.n !== expectedNumbers[index])) {
      errors.push({ code: "NON_CONTIGUOUS_LESSON_NUMBERS", path: coursePath, message: "lesson n values must be contiguous starting at 1" });
    }
  }
  return counts;
}

function validateLessonParity(seed, content, seedCounts, contentCounts, errors) {
  const seedKeys = Object.keys(seed);
  const contentKeys = Object.keys(content);
  const seedSet = new Set(seedKeys);
  const contentSet = new Set(contentKeys);
  const missingFromContent = seedKeys.filter((course) => !contentSet.has(course));
  const missingFromSeed = contentKeys.filter((course) => !seedSet.has(course));

  if (missingFromContent.length) {
    errors.push({ code: "CONTENT_COURSE_KEYS_MISSING", path: "lessons-content.json", message: `missing course keys: ${missingFromContent.join(", ")}` });
  }
  if (missingFromSeed.length) {
    errors.push({ code: "SEED_COURSE_KEYS_MISSING", path: "lessons-seed.json", message: `missing course keys: ${missingFromSeed.join(", ")}` });
  }

  for (const course of [...new Set([...seedKeys, ...contentKeys])].sort()) {
    if (seedCounts[course] !== contentCounts[course]) {
      errors.push({
        code: "LESSON_COUNT_MISMATCH",
        path: course,
        message: `lessons-seed has ${seedCounts[course] ?? 0}, lessons-content has ${contentCounts[course] ?? 0}`,
      });
    }
  }

  const seedTotal = Object.values(seedCounts).reduce((total, count) => total + count, 0);
  const contentTotal = Object.values(contentCounts).reduce((total, count) => total + count, 0);
  if (seedTotal !== EXPECTED_TOTAL_LESSONS) {
    errors.push({ code: "UNEXPECTED_SEED_TOTAL", path: "lessons-seed.json", message: `expected ${EXPECTED_TOTAL_LESSONS} lessons, found ${seedTotal}` });
  }
  if (contentTotal !== EXPECTED_TOTAL_LESSONS) {
    errors.push({ code: "UNEXPECTED_CONTENT_TOTAL", path: "lessons-content.json", message: `expected ${EXPECTED_TOTAL_LESSONS} lessons, found ${contentTotal}` });
  }

  return { seedKeys, contentKeys, seedTotal, contentTotal };
}

function validateResources(value, errors) {
  if (!Array.isArray(value)) {
    errors.push({ code: "INVALID_RESOURCE_SEED", path: "resources-seed.json", message: "resource seed must be a JSON array" });
    return { count: 0, uniqueFileKeys: false, bilingualFieldsComplete: false };
  }

  const seen = new Map();
  let uniqueFileKeys = true;
  let bilingualFieldsComplete = true;
  for (const [index, resource] of value.entries()) {
    const resourcePath = `resources-seed.json[${index}]`;
    if (!isRecord(resource)) {
      errors.push({ code: "INVALID_RESOURCE", path: resourcePath, message: "resource must be an object" });
      uniqueFileKeys = false;
      bilingualFieldsComplete = false;
      continue;
    }

    for (const field of RESOURCE_BILINGUAL_FIELDS) {
      if (!nonEmptyString(resource[field])) {
        bilingualFieldsComplete = false;
        errors.push({ code: "MISSING_BILINGUAL_FIELD", path: `${resourcePath}.${field}`, message: `${field} must be a non-empty string` });
      }
    }

    const fileKey = resource.file_key;
    if (!nonEmptyString(fileKey)) {
      uniqueFileKeys = false;
      errors.push({ code: "MISSING_FILE_KEY", path: `${resourcePath}.file_key`, message: "file_key must be a non-empty string" });
      continue;
    }
    const normalizedKey = fileKey.trim().replace(/^\/+|\/+$/g, "");
    if (!normalizedKey.startsWith("files/") || normalizedKey.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
      errors.push({ code: "INVALID_FILE_KEY", path: `${resourcePath}.file_key`, message: "file_key must be a safe path under files/" });
    }
    const previous = seen.get(normalizedKey);
    if (previous !== undefined) {
      uniqueFileKeys = false;
      errors.push({ code: "DUPLICATE_FILE_KEY", path: `${resourcePath}.file_key`, message: `duplicates resources-seed.json[${previous}].file_key` });
    } else {
      seen.set(normalizedKey, index);
    }
  }

  return { count: value.length, uniqueFileKeys, bilingualFieldsComplete };
}

function validate() {
  const errors = [];
  const seed = readJson(LESSON_SEED_PATH, "lessons-seed.json", errors);
  const content = readJson(LESSON_CONTENT_PATH, "lessons-content.json", errors);
  const resources = readJson(RESOURCE_SEED_PATH, "resources-seed.json", errors);

  const seedCounts = validateLessonMap(seed, "lessons-seed.json", errors);
  const contentCounts = validateLessonMap(content, "lessons-content.json", errors);
  const parity = isRecord(seed) && isRecord(content)
    ? validateLessonParity(seed, content, seedCounts, contentCounts, errors)
    : { seedKeys: Object.keys(seedCounts), contentKeys: Object.keys(contentCounts), seedTotal: 0, contentTotal: 0 };
  const resourceSummary = validateResources(resources, errors);

  return {
    ok: errors.length === 0,
    expectedTotalLessons: EXPECTED_TOTAL_LESSONS,
    courses: {
      seedKeys: parity.seedKeys,
      contentKeys: parity.contentKeys,
      seedCount: parity.seedKeys.length,
      contentCount: parity.contentKeys.length,
      counts: Object.fromEntries(parity.seedKeys.map((course) => [course, {
        seed: seedCounts[course] ?? 0,
        content: contentCounts[course] ?? 0,
      }])),
    },
    lessons: {
      seedTotal: parity.seedTotal,
      contentTotal: parity.contentTotal,
    },
    resources: resourceSummary,
    errors,
  };
}

function printHuman(report) {
  if (report.ok) {
    console.log("Content validation passed.");
    console.log(`- courses: ${report.courses.seedCount}`);
    console.log(`- lessons: ${report.lessons.seedTotal} (seed/content)`);
    console.log(`- resources: ${report.resources.count} (unique file_key; bilingual fields complete)`);
    return;
  }

  console.error(`Content validation failed (${report.errors.length} issue${report.errors.length === 1 ? "" : "s"}):`);
  for (const issue of report.errors) console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
}

const jsonMode = process.argv.includes("--json");
try {
  const options = parseArgs(process.argv.slice(2));
  const report = validate();
  if (options.json || jsonMode) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  const report = {
    ok: false,
    expectedTotalLessons: EXPECTED_TOTAL_LESSONS,
    courses: null,
    lessons: null,
    resources: null,
    errors: [{ code: "INVALID_ARGUMENT", path: "arguments", message: error.message }],
  };
  if (jsonMode) console.log(JSON.stringify(report, null, 2));
  else console.error(error.message);
  process.exitCode = 1;
}
