#!/usr/bin/env node

/**
 * 赛事信息监测脚本：
 *   1. 抓取教育部名单公告页，检测白名单是否变更；
 *   2. 抓取 registry 中各赛事官网的通知/新闻列表页，提取条目并与上次快照 diff；
 *   3. 产出 output/competition-monitor/<时间戳>/report.md + diff.json，并更新快照。
 *
 * 用法：
 *   node scripts/competition-monitor.mjs [--slug <slug>] [--no-write] [--output <dir>]
 *
 * 说明：
 *   - 快照存于 scripts/competitions/state/<key>.json 并随仓库提交，保证多次运行可对比；
 *   - 抓取失败或疑似 JS 渲染的页面标记 needsManualCheck，交由 agent 用浏览器工具深查；
 *   - 本脚本永远以 0 退出（参数错误除外），监测失败不应阻塞 CI。
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import {
  REPO_ROOT,
  STATE_DIR,
  isValidSlug,
  readRegistry,
} from "./competition-lib.mjs";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 DashCompMonitor/1.0";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_ITEMS_PER_PAGE = 30;
const DATE_RE = /(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})/;
const CJK_RE = /[一-鿿]/;

function parseArgs(argv) {
  const options = { slug: null, write: true, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--slug") {
      options.slug = argv[++index];
      if (!options.slug || !isValidSlug(options.slug)) throw new Error("--slug 需要合法的 kebab-case 值");
    } else if (arg === "--no-write") {
      options.write = false;
    } else if (arg === "--output") {
      options.output = argv[++index];
      if (!options.output) throw new Error("--output 需要目录路径");
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/competition-monitor.mjs [--slug <slug>] [--no-write] [--output <dir>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9",
      },
    });
    const html = await response.text();
    return { ok: response.ok, status: response.status, html, finalUrl: response.url };
  } catch (error) {
    if (attempt < 3) {
      await sleep(1500 * attempt);
      return fetchPage(url, attempt + 1);
    }
    return { ok: false, status: 0, html: "", error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeDate(match) {
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** 从列表页 HTML 中提取 (title, url, date?) 条目，启发式：带日期的中文链接优先 */
function extractNewsItems(html, pageUrl) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const items = [];
  const seen = new Set();
  $("a[href]").each((_, element) => {
    if (items.length >= MAX_ITEMS_PER_PAGE) return false;
    const anchor = $(element);
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (title.length < 6 || title.length > 80 || !CJK_RE.test(title)) return;
    const href = anchor.attr("href") ?? "";
    if (/^(javascript:|#|mailto:)/i.test(href)) return;
    let absolute;
    try {
      absolute = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    if (new URL(absolute).origin !== new URL(pageUrl).origin) return;
    if (seen.has(absolute)) return;

    const context = anchor.closest("li, tr, dd, div, p").text() || anchor.parent().text() || "";
    const dateMatch = context.match(DATE_RE);
    seen.add(absolute);
    items.push({
      title,
      url: absolute,
      ...(dateMatch ? { date: normalizeDate(dateMatch) } : {}),
    });
  });
  return items;
}

function pageTextHash(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { hash: createHash("sha1").update(text).digest("hex"), textLength: text.length };
}

function loadState(key) {
  const file = path.join(STATE_DIR, `${key}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveState(key, state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, `${key}.json`), `${JSON.stringify(state, null, 2)}\n`);
}

async function checkPage(url, kind) {
  const result = await fetchPage(url);
  if (!result.ok) {
    return {
      url,
      status: "error",
      httpStatus: result.status,
      error: result.error ?? `HTTP ${result.status}`,
      items: [],
    };
  }
  const { hash, textLength } = pageTextHash(result.html);
  if (textLength < 500) {
    return { url, status: "needsManualCheck", reason: "页面正文过短，疑似 JS 渲染或反爬拦截", items: [], hash };
  }
  const items = kind === "news" ? extractNewsItems(result.html, result.finalUrl || url) : [];
  if (kind === "news" && items.length === 0) {
    return { url, status: "needsManualCheck", reason: "未能提取到新闻条目，疑似 JS 渲染列表", items: [], hash };
  }
  return { url, status: "ok", items, hash };
}

function diffItems(previousItems, currentItems) {
  const previousUrls = new Map((previousItems ?? []).map((item) => [item.url, item]));
  const currentUrls = new Map(currentItems.map((item) => [item.url, item]));
  const added = currentItems.filter((item) => !previousUrls.has(item.url));
  const removed = (previousItems ?? []).filter((item) => !currentUrls.has(item.url));
  return { added, removed };
}

async function checkTarget(target, options) {
  const previous = loadState(target.key);
  const pages = [];
  const changes = [];
  for (const url of target.urls) {
    const page = await checkPage(url, target.kind === "moe" ? "moe" : "news");
    const previousPage = previous?.pages?.[url];
    if (page.status === "ok") {
      if (target.kind === "moe") {
        if (previousPage && previousPage.hash !== page.hash) {
          changes.push({ type: "moe-list-changed", url, note: "教育部名单公告页内容发生变化，需人工核对名单" });
        }
      } else {
        const { added, removed } = diffItems(previousPage?.items, page.items);
        if (previousPage && added.length) {
          changes.push({ type: "news-added", url, items: added });
        }
        if (previousPage && removed.length) {
          changes.push({ type: "news-removed", url, items: removed });
        }
      }
    }
    pages.push(page);
  }

  const hasBaseline = Boolean(previous && Object.keys(previous.pages ?? {}).length > 0);
  const status = pages.some((page) => page.status === "error")
    ? "error"
    : pages.some((page) => page.status === "needsManualCheck")
      ? "needsManualCheck"
      : changes.length
        ? "changed"
        : hasBaseline
          ? "unchanged"
          : "first-scan";

  const state = {
    key: target.key,
    name: target.name,
    checkedAt: new Date().toISOString(),
    status,
    pages: Object.fromEntries(
      pages
        .filter((page) => page.status === "ok")
        .map((page) => [page.url, { hash: page.hash, ...(page.items?.length ? { items: page.items } : {}) }])
    ),
  };
  if (options.write) saveState(target.key, state);
  return { target, status, pages, changes };
}

function renderReport(results, startedAt) {
  const lines = [];
  lines.push(`# 赛事监测报告 ${startedAt}`);
  lines.push("");
  const counts = { changed: 0, unchanged: 0, "first-scan": 0, error: 0, needsManualCheck: 0 };
  for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
  lines.push(
    `共 ${results.length} 个监测目标：` +
      Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => `${status} ${count}`)
        .join("，")
  );
  lines.push("");

  const withChanges = results.filter((result) => result.changes.length > 0);
  if (withChanges.length) {
    lines.push("## 检测到变化");
    for (const result of withChanges) {
      lines.push(`### ${result.target.name}`);
      for (const change of result.changes) {
        if (change.type === "moe-list-changed") {
          lines.push(`- ⚠️ ${change.note}：${change.url}`);
        } else {
          lines.push(`- ${change.type === "news-added" ? "新增" : "移除"}（${change.url}）：`);
          for (const item of change.items) {
            lines.push(`  - [${item.date ?? "未知日期"}] ${item.title} — ${item.url}`);
          }
        }
      }
      lines.push("");
    }
  } else {
    lines.push("## 未检测到变化");
    lines.push("");
  }

  const problems = results.filter((result) => result.status === "error" || result.status === "needsManualCheck");
  if (problems.length) {
    lines.push("## 需要人工/Agent 跟进");
    for (const result of problems) {
      for (const page of result.pages.filter((p) => p.status !== "ok")) {
        lines.push(`- [${result.status}] ${result.target.name} — ${page.url}：${page.error ?? page.reason ?? ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = readRegistry();
  const targets = [];

  if (registry.moeList?.announcementUrl && !options.slug) {
    targets.push({
      key: "moe-list",
      name: registry.moeList.name ?? "教育部名单公告",
      kind: "moe",
      urls: [registry.moeList.announcementUrl],
    });
  }
  for (const entry of registry.competitions ?? []) {
    if (!entry.officialSite) continue;
    if (options.slug && entry.slug !== options.slug) continue;
    const urls = Array.isArray(entry.newsPages) && entry.newsPages.length ? entry.newsPages : [entry.officialSite];
    targets.push({ key: entry.slug, name: entry.nameZh, kind: "competition", urls });
  }

  const startedAt = new Date().toISOString();
  console.log(`监测 ${targets.length} 个目标（${new Date().toLocaleString("zh-CN")}）…`);
  const results = [];
  for (const target of targets) {
    const result = await checkTarget(target, options);
    results.push(result);
    const flag = { changed: "●", unchanged: "·", "first-scan": "○", error: "✕", needsManualCheck: "?" }[result.status] ?? "?";
    console.log(`${flag} ${target.name} [${result.status}]`);
    await sleep(400); // 温和抓取，避免对官网造成压力
  }

  const stamp = startedAt.slice(0, 19).replaceAll(":", "").replace("T", "-");
  const outputDir = options.output ?? path.join(REPO_ROOT, "output", "competition-monitor", stamp);
  fs.mkdirSync(outputDir, { recursive: true });
  const report = renderReport(results, startedAt);
  fs.writeFileSync(path.join(outputDir, "report.md"), `${report}\n`);
  fs.writeFileSync(
    path.join(outputDir, "diff.json"),
    `${JSON.stringify(
      {
        startedAt,
        results: results.map((result) => ({
          key: result.target.key,
          name: result.target.name,
          status: result.status,
          changes: result.changes,
          pages: result.pages.map((page) => ({ url: page.url, status: page.status, error: page.error ?? page.reason })),
        })),
      },
      null,
      2
    )}\n`
  );
  console.log(`\n报告已写入 ${path.relative(REPO_ROOT, outputDir)}/（report.md / diff.json）`);
}

main().catch((error) => {
  console.error(`监测脚本执行失败：${error.message}`);
  process.exitCode = 1;
});
