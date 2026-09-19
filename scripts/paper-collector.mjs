#!/usr/bin/env node

/**
 * 备赛资料采集脚本（真题/命题/规则/获奖范例，全量覆盖设计）：
 *   1. 按 registry 中各赛事的 paperPages 配置抓取栏目页（复用 competition-monitor 的三层降级：
 *      fetch → DoH → curl → Chromium 渲染）；
 *   2. 发现候选链接：附件（pdf/doc/zip/图片等）与"含资料关键词"的文章页；
 *      文章页再深入一层提取附件；无附件但标题强匹配的命题类页面收录为 externalUrl 资料；
 *   3. 下载守护：扩展名白名单 + 单文件 50MB 上限 + magic number 校验 + sha256 去重
 *      + 单赛事单次新增上限（--max-new，默认 30）；
 *   4. --write 时把新资料追加进 scripts/competitions/papers/<slug>.json，
 *      写盘后跑 validate-papers 门禁，失败整体回滚（含已下载文件）。
 *
 * 用法：
 *   node scripts/paper-collector.mjs [--slug <slug>] [--write] [--no-render]
 *                                    [--output <dir>] [--max-new <n>]
 *   默认 dry-run：只发现不下载、不写盘。
 *
 * 环境变量：
 *   DASH_PAPER_PUBLIC_DIR  文件落盘根（fileKey files/papers/... 相对此目录；
 *                          默认 output/papers-public；VPS 上为 /opt/dash-pr/public）
 *   DASH_PAPER_STATE_DIR   抓取状态目录（默认 scripts/competitions/paper-state）
 *   DASH_PAPER_OUTPUT_DIR  报告根目录（默认 output/paper-collector）
 *   DASH_PAPER_MAX_NEW     单赛事单次新增上限（默认 30）
 *   CHROMIUM_PATH          Chromium 可执行文件（渲染层，见 competition-monitor）
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { isValidSlug, readRegistry } from "./competition-lib.mjs";
import {
  MERGED_PAPERS_PATH,
  PAPER_SHARDS_DIR,
  PAPER_STATE_DIR,
  inferFormat,
  inferKind,
  inferStage,
  inferYear,
  paperMaterialId,
  sha256Hex,
} from "./paper-lib.mjs";
import {
  USER_AGENT,
  closeRenderer,
  dohResolve,
  fetchPage,
  fetchPageViaCurl,
  fetchPageWithDoh,
  isNetworkLayerError,
  renderPage,
  sleep,
} from "./competition-monitor.mjs";
import { isBlacklistedDomain, isRelevantToCompetition, L2_RESEARCH_INTERVAL_MS, searchConfig, searchQueryFor, searchTavily } from "./paper-search.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const VALIDATE_SCRIPT = path.join(SCRIPT_DIR, "validate-papers.mjs");

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CANDIDATES_PER_PAGE = 40;
const MAX_ARTICLES_PER_PAGE = 15;
const DOWNLOAD_TIMEOUT_S = 120;
const MIN_TEXT_LENGTH = 400;

const ATTACHMENT_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|webp|txt)(\?[^"']*)?$/i;
const TITLE_KEYWORD_RE =
  /试题|真题|试卷|答案|解答|参考解答|命题|赛题|任务书|竞赛规程|竞赛规则|比赛规则|规程|规则|评分标准|评审标准|评分细则|获奖名单|名单公示|获奖作品|优秀作品|获奖论文|题目|主题|指南|手册/;
const NOISE_TITLE_RE = /^(首页|返回|更多|查看更多|登录|注册|English|无障碍|联系我们|关于我们|版权所有|下载|点击|附件)/;
const WAF_RE = /访问被阻断|安全威胁|应用防火墙|访问被拦截|Access Denied|Request Blocked/i;
/** 版权/转载授权类法律声明不是备赛资料（如"试题未经授权不得转载的公告"），命中即排除 */
const LEGAL_NOTICE_RE = /未经授权|不得转载|版权声明|维权|严正声明|侵权声明|许可任何网站/;

const MAGIC_SNIFFERS = {
  pdf: (buf) => buf.subarray(0, 5).toString("latin1") === "%PDF-",
  zip: (buf) => buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,
  docx: (buf) => MAGIC_SNIFFERS.zip(buf),
  xlsx: (buf) => MAGIC_SNIFFERS.zip(buf),
  pptx: (buf) => MAGIC_SNIFFERS.zip(buf),
  doc: (buf) => buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0,
  xls: (buf) => MAGIC_SNIFFERS.doc(buf),
  ppt: (buf) => MAGIC_SNIFFERS.doc(buf),
  rar: (buf) => buf.subarray(0, 4).toString("latin1") === "Rar!",
  jpg: (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  png: (buf) => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  webp: (buf) => buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP",
};

const filesPublicDir = process.env.DASH_PAPER_PUBLIC_DIR || path.join(REPO_ROOT, "output", "papers-public");
const stateDir = process.env.DASH_PAPER_STATE_DIR || PAPER_STATE_DIR;
const outputRoot = process.env.DASH_PAPER_OUTPUT_DIR || path.join(REPO_ROOT, "output", "paper-collector");

function parseArgs(argv) {
  const options = { slug: null, write: false, render: true, output: null, maxNew: Number(process.env.DASH_PAPER_MAX_NEW) || 30 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--slug") {
      options.slug = argv[++index];
      if (!options.slug || !isValidSlug(options.slug)) throw new Error("--slug 需要合法的 kebab-case 值");
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--dry-run") {
      options.write = false;
    } else if (arg === "--no-render") {
      options.render = false;
    } else if (arg === "--output") {
      options.output = argv[++index];
      if (!options.output) throw new Error("--output 需要目录路径");
    } else if (arg === "--max-new") {
      options.maxNew = Number(argv[++index]);
      if (!Number.isInteger(options.maxNew) || options.maxNew < 1) throw new Error("--max-new 需要正整数");
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/paper-collector.mjs [--slug <slug>] [--write] [--no-render] [--output <dir>] [--max-new <n>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function oneLine(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function isThin(html) {
  const text = String(html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  return text.length < MIN_TEXT_LENGTH;
}

/** 三层降级抓 HTML：fetch → DoH → curl → 渲染（正文过薄/WAF 也触发渲染） */
async function fetchBestHtml(url, { render = true } = {}) {
  let page = await fetchPage(url);
  if (!page.ok && isNetworkLayerError(page.error)) {
    const viaDoh = await fetchPageWithDoh(url);
    if (viaDoh.ok) page = viaDoh;
  }
  if (!page.ok) {
    const viaCurl = await fetchPageViaCurl(url);
    if (viaCurl.ok) page = viaCurl;
  }
  if (page.ok && WAF_RE.test(page.html)) {
    page = { ...page, ok: false, error: "WAF 拦截（访问被阻断页）" };
  }
  if ((!page.ok || isThin(page.html)) && render) {
    const rendered = await renderPage(url);
    if (rendered.ok && !isThin(rendered.html)) return rendered;
    if (!page.ok && rendered.ok) return rendered;
  }
  return page;
}

function cleanTitle(text) {
  return oneLine(String(text ?? "").replace(/【[^】]*】/g, "").replace(/\[下载\]|下载$|（.*?）$|\(.*?\)$/g, "")).slice(0, 80);
}

/** 从栏目页 HTML 发现候选：附件直连 + 资料关键词文章页 */
function discoverCandidates(html, pageUrl) {
  const $ = cheerio.load(html);
  const files = [];
  const articles = [];
  const seen = new Set();

  $("a[href]").each((_, el) => {
    const anchor = $(el);
    const rawHref = String(anchor.attr("href") ?? "").trim();
    if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) return;
    let url;
    try {
      url = new URL(rawHref, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:\/\//.test(url) || seen.has(url)) return;

    const anchorText = oneLine(anchor.text());
    const titleAttr = oneLine(anchor.attr("title"));
    const rowText = oneLine(anchor.closest("li,tr,td,p,div").text());
    const title = cleanTitle(titleAttr || anchorText) || cleanTitle(rowText);

    if (ATTACHMENT_RE.test(rawHref)) {
      const context = `${title}|${rowText}`;
      if (!TITLE_KEYWORD_RE.test(context) && !inferYear(context)) return;
      seen.add(url);
      files.push({ type: "file", url, title: title || cleanTitle(decodeURIComponent(url.split("/").pop() ?? "")) });
      return;
    }

    // 文章页候选：只跟同域链接，标题必须命中资料关键词
    if (new URL(url).hostname !== new URL(pageUrl).hostname) return;
    if (!TITLE_KEYWORD_RE.test(anchorText) && !TITLE_KEYWORD_RE.test(titleAttr)) return;
    if (anchorText.length < 6 || NOISE_TITLE_RE.test(anchorText)) return;
    if (!inferYear(anchorText) && !/试题|真题|命题|规程|规则|任务书/.test(anchorText)) return;
    seen.add(url);
    articles.push({ type: "article", url, title: cleanTitle(anchorText) });
  });

  return {
    files: files.slice(0, MAX_CANDIDATES_PER_PAGE),
    articles: articles.slice(0, MAX_ARTICLES_PER_PAGE),
  };
}

/** 在文章页内提取附件链接（保留文章标题作为资料标题） */
function extractArticleAttachments(html, articleUrl) {
  const $ = cheerio.load(html);
  const attachments = [];
  const seen = new Set();
  $("a[href]").each((_, el) => {
    const rawHref = String($(el).attr("href") ?? "").trim();
    if (!ATTACHMENT_RE.test(rawHref)) return;
    let url;
    try {
      url = new URL(rawHref, articleUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:\/\//.test(url) || seen.has(url)) return;
    seen.add(url);
    attachments.push({ url, anchorTitle: cleanTitle($(el).attr("title") || $(el).text()) });
  });
  return attachments.slice(0, 10);
}

function curlDownloadArgs(url, destPath, extra = []) {
  return [
    "-sfL",
    "--compressed",
    "--max-time",
    String(DOWNLOAD_TIMEOUT_S),
    "--connect-timeout",
    "15",
    "--max-filesize",
    String(MAX_FILE_BYTES),
    "-A",
    USER_AGENT,
    ...extra,
    "-w",
    "\n__CURL_META__%{url_effective}",
    "-o",
    destPath,
    url,
  ];
}

/** 粗略可注册域（org.cn/gov.cn 等二级后缀取三段，其余取两段），用于异域跳转防护 */
function registrableDomain(hostname) {
  const parts = String(hostname ?? "").toLowerCase().split(".");
  const twoLevelTlds = new Set(["com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "ac.cn"]);
  const tail2 = parts.slice(-2).join(".");
  return twoLevelTlds.has(tail2) ? parts.slice(-3).join(".") : tail2;
}

/** 主流云存储/CDN 域名白名单：官网附件常托管在对象存储（实测 ceso.ssoc.org.cn → myqcloud.com），放行 */
const STORAGE_CDN_SUFFIXES = [
  "myqcloud.com", // 腾讯云 COS
  "qcloud.com",
  "aliyuncs.com", // 阿里 OSS
  "qiniucdn.com",
  "qiniu.com",
  "amazonaws.com",
  "bcebos.com", // 百度 BOS
  "myhuaweicloud.com", // 华为 OBS
  "upyun.com",
  "alicdn.com",
  "tencentcos.cn",
];

/** 下载完成后的异域跳转检查：防止过期域名被抢注后投毒（实测 yau-awards.science 301 到赌博域名） */
function checkRedirectTarget(originalUrl, finalUrl) {
  try {
    const from = registrableDomain(new URL(originalUrl).hostname);
    const toHost = new URL(finalUrl).hostname.toLowerCase();
    const to = registrableDomain(toHost);
    if (from && to && from !== to) {
      if (STORAGE_CDN_SUFFIXES.some((suffix) => toHost === suffix || toHost.endsWith(`.${suffix}`))) return null;
      return `下载被重定向到异域 ${to}（源域 ${from}，疑似域名停放/劫持）`;
    }
  } catch {
    // URL 解析失败不拦截
  }
  return null;
}

/** 下载到 destPath：curl 直取，网络类失败时 DoH 解析后 curl --resolve 再试 */
function downloadFile(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const attempt = (extra = []) => {
    const result = spawnSync("curl", curlDownloadArgs(url, destPath, extra), { encoding: "utf8", maxBuffer: 1024 * 1024 });
    if (result.status !== 0) return { ok: false, error: oneLine(result.stderr) || "curl 下载失败" };
    const stdout = result.stdout ?? "";
    const metaIndex = stdout.lastIndexOf("\n__CURL_META__");
    const finalUrl = metaIndex === -1 ? url : stdout.slice(metaIndex + 14).trim();
    const hijack = checkRedirectTarget(url, finalUrl);
    if (hijack) {
      fs.rmSync(destPath, { force: true });
      return { ok: false, error: hijack };
    }
    return { ok: true };
  };
  const first = attempt();
  if (first.ok) return Promise.resolve(first);
  if (!isNetworkLayerError(first.error)) return Promise.resolve(first);
  try {
    const parsed = new URL(url);
    return dohResolve(parsed.hostname).then((addresses) => {
      if (!addresses) return first;
      const port = parsed.protocol === "https:" ? "443" : "80";
      return attempt([`--resolve:${parsed.hostname}:${port}:${addresses[0]}`]);
    });
  } catch {
    return Promise.resolve(first);
  }
}

/** 下载 + 守护（大小/magic/sha256），通过返回文件描述，失败返回 {skip} */
async function guardedDownload(url, slug, id, kind, seq) {
  const format = inferFormat(url);
  if (!format) return { skip: `不支持的文件类型：${url.split("?")[0].slice(-40)}` };
  const fileName = `${id}-${kind}${seq > 1 ? seq : ""}.${format}`;
  const fileKey = `files/papers/${slug}/${fileName}`;
  const destPath = path.join(filesPublicDir, fileKey);

  const downloaded = await downloadFile(url, destPath);
  if (!downloaded.ok) return { skip: `下载失败：${downloaded.error}` };

  const buffer = fs.readFileSync(destPath);
  if (buffer.length === 0) {
    fs.rmSync(destPath, { force: true });
    return { skip: "空文件" };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    fs.rmSync(destPath, { force: true });
    return { skip: `超过大小上限 ${MAX_FILE_BYTES / 1024 / 1024}MB` };
  }
  const sniffer = MAGIC_SNIFFERS[format];
  if (sniffer && !sniffer(buffer)) {
    fs.rmSync(destPath, { force: true });
    return { skip: `文件头与扩展名 ${format} 不符（疑似伪装的 HTML 错误页）` };
  }
  return { file: { kind, format, fileKey, size: buffer.length, sha256: sha256Hex(buffer) }, destPath };
}

function loadState(slug) {
  const file = path.join(stateDir, `${slug}.json`);
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (state && typeof state === "object" && state.seen && typeof state.seen === "object") return state;
  } catch {
    // 首次运行
  }
  return { seen: {} };
}

function saveState(slug, state) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, `${slug}.json`), `${JSON.stringify(state, null, 2)}\n`);
}

function loadShard(slug) {
  const file = path.join(PAPER_SHARDS_DIR, `${slug}.json`);
  try {
    const shard = JSON.parse(fs.readFileSync(file, "utf8"));
    if (shard && Array.isArray(shard.papers)) return shard;
  } catch {
    // 尚无分片
  }
  return { slug, papers: [] };
}

function serializeShard(shard) {
  const lines = shard.papers.map((paper) => `    ${JSON.stringify(paper)}`);
  return `{\n  "slug": ${JSON.stringify(shard.slug)},\n  "papers": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

/** 组装备赛资料条目（同一文章页的多个附件合并为一条多文件资料）；year/stage 由调用方用标题+URL 统一推断 */
function buildMaterial({ slug, title, year, stage, files, sourceUrl, sourceName }) {
  const id = paperMaterialId(slug, year, stage, title);
  return {
    id,
    year,
    stage,
    grade: null,
    title,
    files,
    hasAnswer: files.some((file) => file.kind === "answer"),
    source: { name: sourceName, url: sourceUrl },
    auto: true,
    collectedAt: new Date().toISOString().slice(0, 10),
  };
}

function makeCollectContext(entry, options) {
  const slug = entry.slug;
  const result = {
    slug,
    name: entry.nameZh,
    status: "ok",
    pages: [],
    newMaterials: [],
    skipped: [],
    errors: [],
    l2: null,
    totalAfter: 0,
  };
  const shard = loadShard(slug);
  const state = loadState(slug);
  const ctx = {
    entry,
    slug,
    options,
    result,
    shard,
    state,
    existingIds: new Set(shard.papers.map((paper) => paper.id)),
    existingSha: new Set(shard.papers.flatMap((paper) => paper.files.map((file) => file.sha256).filter(Boolean))),
    existingExternal: new Set(shard.papers.flatMap((paper) => paper.files.map((file) => file.externalUrl).filter(Boolean))),
    downloadedPaths: [],
    overflow: 0,
  };
  ctx.skip = (url, reason) => {
    result.skipped.push({ url, reason });
    state.seen[url] = { at: new Date().toISOString(), status: "skipped", reason };
  };
  return ctx;
}

/** 处理附件直连候选（L1 栏目页与 L2 搜索结果共用） */
async function processFileCandidate(candidate, ctx, source) {
  const { entry, slug, options, result, shard, state } = ctx;
  if (result.newMaterials.length >= options.maxNew) {
    ctx.overflow += 1;
    return;
  }
  if (state.seen[candidate.url]) return;
  const title = candidate.title;
  if (LEGAL_NOTICE_RE.test(title)) {
    ctx.skip(candidate.url, "版权/转载声明类公告，不作为资料收录");
    return;
  }
  const year = inferYear(`${title} ${candidate.url}`);
  if (!year) {
    ctx.skip(candidate.url, "标题/URL 缺年份");
    return;
  }
  const stage = inferStage(title);
  // 栏目标签明示"真题/试题"时，兜底类型升级为 paper（如"选拔赛决赛"这类不含关键词的标题）
  const labelHint = /真题|试题/.test(source.label ?? "") ? "paper" : null;
  const kind = inferKind(title) === "attachment" && labelHint ? labelHint : inferKind(title);
  const id = paperMaterialId(slug, year, stage, title);
  if (ctx.existingIds.has(id)) {
    ctx.skip(candidate.url, "id 已存在");
    return;
  }
  if (!options.write) {
    result.newMaterials.push({ id, title, kind, stage, year, dry: true, url: candidate.url });
    state.seen[candidate.url] = { at: new Date().toISOString(), status: "dry" };
    return;
  }
  const outcome = await guardedDownload(candidate.url, slug, id, kind, 1);
  if (outcome.skip) {
    ctx.skip(candidate.url, outcome.skip);
    return;
  }
  if (ctx.existingSha.has(outcome.file.sha256)) {
    fs.rmSync(outcome.destPath, { force: true });
    ctx.skip(candidate.url, "sha256 与已有资料重复");
    return;
  }
  ctx.downloadedPaths.push(outcome.destPath);
  ctx.existingSha.add(outcome.file.sha256);
  ctx.existingIds.add(id);
  const material = buildMaterial({
    slug,
    title,
    year,
    stage,
    files: [outcome.file],
    sourceUrl: source.url,
    sourceName: source.label ?? entry.organizer ?? new URL(source.url).hostname,
  });
  result.newMaterials.push(material);
  shard.papers.push(material);
  state.seen[candidate.url] = { at: new Date().toISOString(), status: "collected", id };
  await sleep(300);
}

/** 处理文章页候选（深入一层提取附件；无附件但标题有明确资料类型时收录为外链） */
async function processArticleCandidate(candidate, ctx, source) {
  const { entry, slug, options, result, shard, state } = ctx;
  if (result.newMaterials.length >= options.maxNew) {
    ctx.overflow += 1;
    return;
  }
  if (state.seen[candidate.url]) return;
  await sleep(300);
  const article = await fetchBestHtml(candidate.url, { render: options.render });
  if (!article.ok) {
    ctx.skip(candidate.url, `文章页抓取失败：${article.error ?? `HTTP ${article.status}`}`);
    return;
  }
  const articleUrl = article.finalUrl ?? candidate.url;
  const title = candidate.title;
  if (LEGAL_NOTICE_RE.test(title)) {
    ctx.skip(candidate.url, "版权/转载声明类公告，不作为资料收录");
    return;
  }
  const attachments = extractArticleAttachments(article.html, articleUrl);
  const year = inferYear(`${title} ${articleUrl}`);
  if (!year) {
    ctx.skip(candidate.url, "标题/URL 缺年份");
    return;
  }
  const sourceName = source.label ?? entry.organizer ?? new URL(articleUrl).hostname;

  if (attachments.length === 0) {
    // 无附件的网页型资料：标题能推断出明确资料类型（rules/gallery/problem/paper…）即收录为外链
    const externalKind = inferKind(title);
    if (externalKind === "attachment") {
      ctx.skip(candidate.url, "文章页无附件且标题无明确资料类型");
      return;
    }
    const stage = inferStage(title);
    const id = paperMaterialId(slug, year, stage, title);
    if (ctx.existingIds.has(id) || ctx.existingExternal.has(articleUrl)) {
      ctx.skip(candidate.url, "已收录");
      return;
    }
    const file = { kind: externalKind, format: "html", externalUrl: articleUrl };
    if (!options.write) {
      result.newMaterials.push({ id, title, dry: true, external: articleUrl });
      state.seen[candidate.url] = { at: new Date().toISOString(), status: "dry" };
      return;
    }
    ctx.existingIds.add(id);
    ctx.existingExternal.add(articleUrl);
    const material = buildMaterial({ slug, title, year, stage, files: [file], sourceUrl: articleUrl, sourceName });
    result.newMaterials.push(material);
    shard.papers.push(material);
    state.seen[candidate.url] = { at: new Date().toISOString(), status: "collected", id };
    return;
  }

  // 有附件 → 多文件资料
  const stage = inferStage(title);
  const id = paperMaterialId(slug, year, stage, title);
  if (ctx.existingIds.has(id)) {
    ctx.skip(candidate.url, "id 已存在");
    return;
  }
  if (!options.write) {
    result.newMaterials.push({ id, title, dry: true, attachments: attachments.length, url: articleUrl });
    state.seen[candidate.url] = { at: new Date().toISOString(), status: "dry" };
    return;
  }
  const files = [];
  let failed = 0;
  for (const [index, attachment] of attachments.entries()) {
    const fileKind = attachment.anchorTitle && inferKind(attachment.anchorTitle) !== "attachment" ? inferKind(attachment.anchorTitle) : inferKind(title);
    const outcome = await guardedDownload(attachment.url, slug, id, fileKind, index + 1);
    if (outcome.skip) {
      failed += 1;
      result.skipped.push({ url: attachment.url, reason: outcome.skip });
      continue;
    }
    if (ctx.existingSha.has(outcome.file.sha256)) {
      fs.rmSync(outcome.destPath, { force: true });
      result.skipped.push({ url: attachment.url, reason: "sha256 与已有资料重复" });
      continue;
    }
    ctx.downloadedPaths.push(outcome.destPath);
    ctx.existingSha.add(outcome.file.sha256);
    files.push(outcome.file);
    await sleep(300);
  }
  if (files.length === 0) {
    ctx.skip(candidate.url, `附件全部下载失败（${failed} 个）`);
    return;
  }
  ctx.existingIds.add(id);
  const material = buildMaterial({ slug, title, year, stage, files, sourceUrl: articleUrl, sourceName });
  result.newMaterials.push(material);
  shard.papers.push(material);
  state.seen[candidate.url] = { at: new Date().toISOString(), status: "collected", id };
}

/** L1：官网 paperPages 栏目抓取 */
async function collectFromPaperPages(entry, ctx) {
  for (const pageConf of entry.paperPages ?? []) {
    if (ctx.result.newMaterials.length >= ctx.options.maxNew) break;
    const page = await fetchBestHtml(pageConf.url, { render: ctx.options.render });
    ctx.result.pages.push({ url: pageConf.url, ok: page.ok, layer: page.layer, error: page.error });
    if (!page.ok) {
      ctx.result.errors.push({ url: pageConf.url, error: page.error ?? `HTTP ${page.status}` });
      continue;
    }
    const baseUrl = page.finalUrl ?? pageConf.url;
    const candidates = discoverCandidates(page.html, baseUrl);
    for (const candidate of candidates.files) {
      await processFileCandidate(candidate, ctx, { url: baseUrl, label: pageConf.label });
    }
    for (const candidate of candidates.articles) {
      await processArticleCandidate(candidate, ctx, { url: baseUrl, label: pageConf.label });
    }
  }
}

/**
 * L2：全网搜索发现（L1 无收获的赛事，按周限频）。
 * 搜索结果（附件直连/文章页）回到与 L1 完全相同的候选处理器与下载守护。
 */
async function collectFromSearch(entry, ctx) {
  const cfg = searchConfig();
  const { result, state } = ctx;
  if (!cfg) {
    result.l2 = { skipped: "未配置 DASH_PAPER_SEARCH_PROVIDER/KEY" };
    return;
  }
  if (result.newMaterials.length >= ctx.options.maxNew) {
    result.l2 = { skipped: "已达新增上限" };
    return;
  }
  const lastAt = Date.parse(state.l2?.lastSearchAt ?? "");
  if (Number.isFinite(lastAt) && Date.now() - lastAt < L2_RESEARCH_INTERVAL_MS) {
    result.l2 = { skipped: `距上次搜索不足 ${L2_RESEARCH_INTERVAL_MS / 86400000} 天`, lastSearchAt: state.l2.lastSearchAt };
    return;
  }

  const { klass, query } = searchQueryFor(entry);
  const searchedAt = new Date().toISOString();
  const response = await searchTavily(query, { apiKey: cfg.apiKey, maxResults: 8 });
  state.l2 = { lastSearchAt: searchedAt, query };
  result.l2 = { query, klass, searchedAt, resultCount: response.ok ? response.results.length : 0, error: response.ok ? undefined : response.error };
  if (!response.ok) return;

  for (const item of response.results) {
    if (result.newMaterials.length >= ctx.options.maxNew) {
      ctx.overflow += 1;
      continue;
    }
    if (ctx.state.seen[item.url]) continue;
    if (isBlacklistedDomain(item.url)) {
      ctx.skip(item.url, "付费墙/文库类域名黑名单");
      continue;
    }
    const title = cleanTitle(item.title) || item.title;
    if (!isRelevantToCompetition(entry, title, item.snippet)) {
      ctx.skip(item.url, "标题/摘要与赛事名不匹配（L2 相关性过滤）");
      continue;
    }
    const source = { url: item.url, label: new URL(item.url).hostname };
    if (ATTACHMENT_RE.test(item.url)) {
      await processFileCandidate({ type: "file", url: item.url, title }, ctx, source);
    } else {
      await processArticleCandidate({ type: "article", url: item.url, title }, ctx, source);
    }
  }
}

async function collectCompetition(entry, options) {
  const ctx = makeCollectContext(entry, options);
  await collectFromPaperPages(entry, ctx);
  // L1 无收获（分片仍为空）时落入 L2 全网搜索发现
  if (ctx.shard.papers.length === 0) {
    await collectFromSearch(entry, ctx);
  }
  ctx.result.totalAfter = ctx.shard.papers.length;
  if (ctx.overflow > 0) ctx.result.skipped.push({ url: "(overflow)", reason: `达单赛事新增上限 ${options.maxNew}，剩余 ${ctx.overflow} 个候选下次处理` });
  return { result: ctx.result, shard: ctx.shard, downloadedPaths: ctx.downloadedPaths, state: ctx.state };
}

function renderReport(results, startedAt, writeMode) {
  const lines = [
    `# 备赛资料采集报告 ${startedAt}`,
    "",
    `模式：${writeMode ? "write（已写盘）" : "dry-run（只发现不写盘）"}`,
    "",
    `共 ${results.length} 个目标：covered ${results.filter((r) => r.totalAfter > 0).length}，新增 ${results.reduce((sum, r) => sum + r.newMaterials.length, 0)} 条，错误 ${results.reduce((sum, r) => sum + r.errors.length, 0)} 个；L2 搜索 ${results.filter((r) => r.l2 && !r.l2.skipped).length} 项`,
    "",
    "## 各赛事明细",
    "",
  ];
  for (const result of results) {
    lines.push(`### ${result.name}（${result.slug}）`);
    lines.push(`- 资料总数：${result.totalAfter}；新增：${result.newMaterials.length}；跳过：${result.skipped.length}；错误：${result.errors.length}`);
    if (result.l2) {
      if (result.l2.skipped) {
        lines.push(`- L2 搜索：跳过（${result.l2.skipped}）`);
      } else {
        lines.push(`- L2 搜索：「${result.l2.query}」（${result.l2.klass} 类，${result.l2.resultCount} 个结果${result.l2.error ? `，错误：${result.l2.error}` : ""}）`);
      }
    }
    for (const material of result.newMaterials.slice(0, 20)) {
      lines.push(`  - + [${material.kind ?? "dry"}] ${material.title}`);
    }
    if (result.newMaterials.length > 20) lines.push(`  - … 另 ${result.newMaterials.length - 20} 条`);
    for (const error of result.errors) lines.push(`  - ✕ ${error.url}：${error.error}`);
    const skipReasons = new Map();
    for (const item of result.skipped) skipReasons.set(item.reason, (skipReasons.get(item.reason) ?? 0) + 1);
    for (const [reason, count] of skipReasons) lines.push(`  - 跳过 ×${count}：${reason}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = readRegistry();
  const competitions = Array.isArray(registry.competitions) ? registry.competitions : [];

  // 全部赛事均为采集目标：有 paperPages 的走 L1，无配置的由 L2 搜索兜底
  const targets = competitions.filter((entry) => !options.slug || entry.slug === options.slug);
  const l1Count = competitions.filter((entry) => Array.isArray(entry.paperPages) && entry.paperPages.length > 0).length;

  const startedAt = new Date().toISOString();
  console.log(
    `采集 ${targets.length} 个目标（${new Date().toLocaleString("zh-CN")}）… 模式：${options.write ? "write" : "dry-run"}${options.render ? "" : "（渲染关闭）"}；L1 配置 ${l1Count} 项，L2 兜底 ${targets.length - l1Count} 项`
  );

  const results = [];
  const shardOriginals = new Map();
  const downloadedPaths = [];
  const pendingStates = new Map();
  try {
    for (const entry of targets) {
      const { result, shard, downloadedPaths: paths, state } = await collectCompetition(entry, options);
      results.push(result);
      downloadedPaths.push(...paths);
      pendingStates.set(entry.slug, state);
      if (options.write && result.newMaterials.length > 0) {
        const shardFile = path.join(PAPER_SHARDS_DIR, `${entry.slug}.json`);
        if (!shardOriginals.has(entry.slug)) {
          shardOriginals.set(entry.slug, fs.existsSync(shardFile) ? fs.readFileSync(shardFile, "utf8") : null);
        }
        fs.mkdirSync(PAPER_SHARDS_DIR, { recursive: true });
        fs.writeFileSync(shardFile, serializeShard(shard));
      }
      const flag = result.errors.length ? "✕" : result.newMaterials.length ? "●" : "·";
      console.log(`${flag} ${entry.nameZh} [资料 ${result.totalAfter}，新增 ${result.newMaterials.length}]`);
      await sleep(400);
    }
  } finally {
    await closeRenderer();
  }

  // 写盘门禁：先 merge 再 validate（与 VPS runner 后续步骤幂等兼容），失败整体回滚（分片 + 合并产物 + 已下载文件）
  let validation = null;
  if (options.write && results.some((r) => r.newMaterials.length > 0)) {
    const mergedOriginal = fs.existsSync(MERGED_PAPERS_PATH) ? fs.readFileSync(MERGED_PAPERS_PATH, "utf8") : null;
    const merge = spawnSync(process.execPath, [path.join(SCRIPT_DIR, "paper-merge.mjs")], { encoding: "utf8" });
    if (merge.status !== 0) {
      validation = { ok: false, output: `${merge.stdout ?? ""}${merge.stderr ?? ""}`.trim() };
    } else {
      const check = spawnSync(process.execPath, [VALIDATE_SCRIPT], { encoding: "utf8" });
      validation = { ok: check.status === 0, output: `${check.stdout ?? ""}${check.stderr ?? ""}`.trim() };
    }
    if (!validation.ok) {
      for (const [slug, original] of shardOriginals) {
        const shardFile = path.join(PAPER_SHARDS_DIR, `${slug}.json`);
        if (original === null) fs.rmSync(shardFile, { force: true });
        else fs.writeFileSync(shardFile, original);
      }
      if (mergedOriginal !== null) fs.writeFileSync(MERGED_PAPERS_PATH, mergedOriginal);
      for (const filePath of downloadedPaths) fs.rmSync(filePath, { force: true });
      console.error(`\n写入校验失败，已整体回滚（分片 ${shardOriginals.size} 个、文件 ${downloadedPaths.length} 个）：\n${validation.output}`);
      console.error("采集状态未保存，下次运行将重新处理本次候选。");
      process.exitCode = 1;
    } else {
      for (const [slug, state] of pendingStates) saveState(slug, state);
      console.log(`\n写入 ${results.reduce((sum, r) => sum + r.newMaterials.length, 0)} 条新资料到分片（校验通过）。`);
    }
  } else if (options.write) {
    // 无新增也保存状态（跳过原因需要持久化，避免重复处理）
    for (const [slug, state] of pendingStates) saveState(slug, state);
  }

  const stamp = startedAt.slice(0, 19).replaceAll(":", "").replace("T", "-");
  const outputDir = options.output ?? path.join(outputRoot, stamp);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.md"), `${renderReport(results, startedAt, options.write)}\n`);
  fs.writeFileSync(
    path.join(outputDir, "collected.json"),
    `${JSON.stringify(
      {
        startedAt,
        write: options.write,
        validation,
        noPaperPages: competitions.filter((entry) => !Array.isArray(entry.paperPages) || entry.paperPages.length === 0).map((entry) => entry.slug),
        results: results.map((result) => ({
          slug: result.slug,
          name: result.name,
          totalAfter: result.totalAfter,
          newCount: result.newMaterials.length,
          l2: result.l2,
          newMaterials: result.newMaterials,
          skipped: result.skipped,
          errors: result.errors,
          pages: result.pages,
        })),
      },
      null,
      2
    )}\n`
  );
  console.log(`\n报告已写入 ${path.relative(REPO_ROOT, outputDir)}/（report.md / collected.json）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`采集脚本执行失败：${error.message}`);
    process.exitCode = 1;
  });
}
