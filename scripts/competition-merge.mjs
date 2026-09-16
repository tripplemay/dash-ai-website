#!/usr/bin/env node

/**
 * 合并赛事 registry 与 content 分片，产出运行时权威内容 scripts/competitions-content.json。
 * 用法：node scripts/competition-merge.mjs [--check]
 *   --check  只检查合并产物是否与现有文件一致，不写盘（CI 可用）。
 */

import fs from "node:fs";
import {
  MERGED_CONTENT_PATH,
  MERGED_CONTENT_REL,
  readRegistry,
  readContentShards,
  serializeCompetitionsContent,
  stripGeneratedAt,
} from "./competition-lib.mjs";

const checkOnly = process.argv.includes("--check");

const registry = readRegistry();
const shards = readContentShards();
const next = serializeCompetitionsContent(registry, shards, new Date().toISOString());

if (checkOnly) {
  const current = JSON.parse(fs.readFileSync(MERGED_CONTENT_PATH, "utf8"));
  const same = JSON.stringify(stripGeneratedAt(current)) === JSON.stringify(stripGeneratedAt(next));
  if (!same) {
    console.error(`${MERGED_CONTENT_REL} 与 registry/content 分片不一致，请运行 pnpm competitions:merge`);
    process.exitCode = 1;
  } else {
    console.log(`${MERGED_CONTENT_REL} 与分片一致。`);
  }
} else {
  fs.writeFileSync(MERGED_CONTENT_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `merged ${next.competitions.length} competitions -> ${MERGED_CONTENT_REL}`
  );
}
