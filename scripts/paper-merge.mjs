#!/usr/bin/env node

/**
 * 合并赛事 registry 与 paper 分片，产出运行时权威内容 scripts/papers-content.json。
 * 用法：node scripts/paper-merge.mjs [--check]
 *   --check  只检查合并产物是否与现有文件一致，不写盘（CI 可用）。
 */

import fs from "node:fs";
import { readRegistry } from "./competition-lib.mjs";
import {
  MERGED_PAPERS_PATH,
  MERGED_PAPERS_REL,
  readPaperShards,
  serializePapersContent,
  stripPapersGeneratedAt,
} from "./paper-lib.mjs";

const checkOnly = process.argv.includes("--check");

const registry = readRegistry();
const shards = readPaperShards();
const next = serializePapersContent(registry, shards, new Date().toISOString());

if (checkOnly) {
  const current = JSON.parse(fs.readFileSync(MERGED_PAPERS_PATH, "utf8"));
  const same = JSON.stringify(stripPapersGeneratedAt(current)) === JSON.stringify(stripPapersGeneratedAt(next));
  if (!same) {
    console.error(`${MERGED_PAPERS_REL} 与 registry/paper 分片不一致，请运行 pnpm papers:merge`);
    process.exitCode = 1;
  } else {
    console.log(`${MERGED_PAPERS_REL} 与分片一致。`);
  }
} else {
  fs.writeFileSync(MERGED_PAPERS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  const total = next.competitions.reduce((sum, item) => sum + item.papers.length, 0);
  console.log(`merged ${next.competitions.length} competitions (${total} materials) -> ${MERGED_PAPERS_REL}`);
}
