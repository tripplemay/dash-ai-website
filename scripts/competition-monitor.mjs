#!/usr/bin/env node

/**
 * 赛事信息监测脚本（v2，三层降级抓取 + 自动写回分片）：
 *   1. 抓取教育部名单公告页，检测白名单是否变更；
 *   2. 抓取 registry 中各赛事官网的通知/新闻列表页，提取条目并与上次快照 diff；
 *   3. 产出报告（report.md / diff.json / written.json），并更新快照；
 *   4. --write-updates 时把"官网新增动态"自动追加进 scripts/competitions/content/<slug>.json，
 *      写盘后跑 validate-competitions 门禁，失败则整体回滚。
 *
 * 抓取策略（对每个页面自动降级）：
 *   L1 plain fetch（undici，浏览器 UA，重试 3 次）
 *   L2 DoH 修复解析：L1 出现 DNS/证书/连接重置类错误时，经 DoH（阿里/DNSPod）
 *      解析真实 IP 后用 node:http(s) 直连（自定义 lookup），规避本地 DNS 污染；
 *   L3 Chromium 渲染：L1/L2 结果为错误、正文过短或提取不到条目时，用
 *      playwright-core + 系统 Chromium 渲染页面后再提取（需 CHROMIUM_PATH
 *      或常见路径可发现的浏览器；不可用时跳过并保持 needsManualCheck）。
 *
 * 用法：
 *   node scripts/competition-monitor.mjs [--slug <slug>] [--no-write] [--output <dir>]
 *                                        [--write-updates] [--no-render]
 *
 * 环境变量：
 *   DASH_MONITOR_STATE_DIR   快照目录（默认 scripts/competitions/state）
 *   DASH_MONITOR_OUTPUT_DIR  报告根目录（默认 output/competition-monitor）
 *   DASH_MONITOR_WEBHOOK_URL 告警 webhook（JSON POST，可选）
 *   CHROMIUM_PATH            Chromium/Chrome 可执行文件路径（可选，自动探测失败时用）
 *
 * 说明：
 *   - 快照记录每个目标的页面条目、errorStreak、lastOkAt，供 diff 与告警防抖；
 *   - 本脚本永远以 0 退出（参数错误除外），监测失败不应阻塞 CI/cron。
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { REPO_ROOT, STATE_DIR, isValidSlug, readRegistry } from "./competition-lib.mjs";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 DashCompMonitor/1.0";
const FETCH_TIMEOUT_MS = 20_000;
const RENDER_TIMEOUT_MS = 30_000;
const RENDER_SETTLE_MS = 3_500;
const MAX_ITEMS_PER_PAGE = 30;
const DATE_RE = /(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})/;
const CJK_RE = /[一-鿿]/;
const MIN_TEXT_LENGTH = 500;
const WAF_RE = /访问被阻断|安全威胁|应用防火墙|访问被拦截|Access Denied|Request Blocked/i;
const NOISE_TITLE_RE = /^(首页|返回|更多|查看更多|登录|注册|English|无障碍|联系我们|关于我们|版权所有)/;
const DOH_ENDPOINTS = [
  { name: "aliyun", url: (hostname) => `https://dns.alidns.com/resolve?name=${hostname}&type=A` },
  { name: "dnspod", url: (hostname) => `https://doh.pub/dns-query?name=${hostname}&type=A` },
];
const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/opt/google/chrome/chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const SHARDS_DIR = path.join(REPO_ROOT, "scripts", "competitions", "content");
const VALIDATE_SCRIPT = path.join(REPO_ROOT, "scripts", "validate-competitions.mjs");
const monitorStateDir = process.env.DASH_MONITOR_STATE_DIR || STATE_DIR;
const monitorOutputRoot = process.env.DASH_MONITOR_OUTPUT_DIR || path.join(REPO_ROOT, "output", "competition-monitor");

function parseArgs(argv) {
  const options = { slug: null, write: true, output: null, writeUpdates: false, render: true };
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
    } else if (arg === "--write-updates") {
      options.writeUpdates = true;
    } else if (arg === "--no-render") {
      options.render = false;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/competition-monitor.mjs [--slug <slug>] [--no-write] [--output <dir>] [--write-updates] [--no-render]"
      );
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

// ---------------------------------------------------------------------------
// curl 抓取（比 undici 更耐受本机代理/TUN 环境；macOS/Linux 均自带）
// ---------------------------------------------------------------------------

function fetchPageViaCurl(url, { json = false, method = "GET", body, headers: extraHeaders } = {}) {
  return new Promise((resolve) => {
    const args = [
      "-sS",
      "-L",
      "--compressed",
      "--max-time",
      String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
      "--connect-timeout",
      "10",
      "--max-redirs",
      "8",
      "-A",
      USER_AGENT,
      "-H",
      json ? "accept: application/json, text/plain, */*" : "accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H",
      "accept-language: zh-CN,zh;q=0.9",
    ];
    for (const [key, value] of Object.entries(extraHeaders ?? {})) {
      args.push("-H", `${key}: ${value}`);
    }
    if (String(method).toUpperCase() === "POST") {
      args.push("-X", "POST", "-H", "content-type: application/json", "--data", JSON.stringify(body ?? {}));
    }
    args.push("-w", "\n__CURL_META__%{http_code} %{url_effective}", url);
    const child = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const raw = child.stdout ?? "";
    const metaIndex = raw.lastIndexOf("\n__CURL_META__");
    if (child.error || metaIndex === -1) {
      resolve({ ok: false, status: 0, html: "", error: oneLine(child.error?.message ?? child.stderr ?? "curl 失败"), layer: "curl" });
      return;
    }
    const [statusText, finalUrl] = raw.slice(metaIndex + 14).trim().split(" ");
    const status = Number(statusText) || 0;
    resolve({ ok: status >= 200 && status < 300, status, html: raw.slice(0, metaIndex), finalUrl, layer: "curl" });
  });
}

// ---------------------------------------------------------------------------
// L1：plain fetch
// ---------------------------------------------------------------------------

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
    return { ok: response.ok, status: response.status, html, finalUrl: response.url, layer: "fetch" };
  } catch (error) {
    if (attempt < 3) {
      await sleep(1500 * attempt);
      return fetchPage(url, attempt + 1);
    }
    const cause = error?.cause ? String(error.cause.message ?? error.cause) : "";
    return { ok: false, status: 0, html: "", error: `${error?.message ?? error}${cause ? ` (${cause})` : ""}`, layer: "fetch" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// L2：DoH 修复解析后直连（node:http(s) 自定义 lookup）
// ---------------------------------------------------------------------------

function isNetworkLayerError(error) {
  if (!error) return false;
  return /ENOTFOUND|EAI_AGAIN|getaddrinfo|ECONNREFUSED|ECONNRESET|ETIMEDOUT|SSL|certificate|altnames|Empty reply|fetch failed|aborted/i.test(
    error
  );
}

async function dohResolve(hostname) {
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(endpoint.url(hostname), {
        signal: controller.signal,
        headers: { accept: "application/dns-json" },
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      const data = await response.json();
      const answers = Array.isArray(data?.Answer) ? data.Answer : [];
      const addresses = answers.filter((a) => a.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(a.data)).map((a) => a.data);
      if (addresses.length) return addresses;
    } catch {
      // 尝试下一个 DoH 端点
    }
  }
  return null;
}

function rawRequest(url, addresses, redirectsLeft = 5) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const lookup = (_hostname, _options, callback) => {
      callback(null, addresses[0], 4);
    };
    const request = (isHttps ? https : http).request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        lookup, // 跳过系统 DNS，直接用 DoH 结果；TLS SNI 仍用域名
        servername: isHttps ? parsed.hostname : undefined,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9",
          host: parsed.host,
        },
        timeout: FETCH_TIMEOUT_MS,
      },
      (response) => {
        const location = response.headers.location;
        if (location && response.statusCode >= 300 && response.statusCode < 400) {
          response.resume();
          const next = new URL(location, url).toString();
          if (next === url || redirectsLeft <= 0) {
            resolve({ ok: false, status: response.statusCode, html: "", error: `重定向循环：${url}`, layer: "doh" });
            return;
          }
          if (new URL(next).hostname !== parsed.hostname) {
            // 跨域跳转回退给 L1 正常处理
            resolve({ ok: false, status: 0, html: "", error: `跨域重定向：${next}`, layer: "doh", crossOriginRedirect: next });
            return;
          }
          resolve(rawRequest(next, addresses, redirectsLeft - 1));
          return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const html = Buffer.concat(chunks).toString("utf8");
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, html, finalUrl: url, layer: "doh" });
        });
      }
    );
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, status: 0, html: "", error: "DoH 直连超时", layer: "doh" });
    });
    request.on("error", (error) => {
      resolve({ ok: false, status: 0, html: "", error: `DoH 直连失败：${error.message}`, layer: "doh" });
    });
    request.end();
  });
}

async function fetchPageWithDoh(url) {
  const hostname = new URL(url).hostname;
  const addresses = await dohResolve(hostname);
  if (!addresses) {
    return { ok: false, status: 0, html: "", error: "DoH 解析失败", layer: "doh" };
  }
  const result = await rawRequest(url, addresses);
  if (result.crossOriginRedirect) {
    // 例如 cnypa 这类跳转到其它子域的站点，跨域后 DNS 未必被污染，交给 L1
    const followed = await fetchPage(result.crossOriginRedirect);
    return { ...followed, layer: "doh+fetch" };
  }
  return result;
}

// ---------------------------------------------------------------------------
// JSON API 直抓（registry apiPages 配置驱动，用于 SPA 站点）
// ---------------------------------------------------------------------------

function getByPath(value, dotPath) {
  let current = value;
  for (const key of String(dotPath ?? "").split(".")) {
    if (!key) continue;
    if (current === null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

/** 归一化 API 返回的日期：YYYY-MM-DD / YYYY/M/D / 带时间的字符串 / 秒或毫秒时间戳 */
function normalizeApiDate(value) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
  }
  const text = String(value).trim();
  const match = text.match(DATE_RE);
  if (match) return normalizeDate(match);
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : undefined;
}

function resolveApiItemUrl(api, item) {
  if (api.urlField && typeof item[api.urlField] === "string" && /^https?:\/\//.test(item[api.urlField])) {
    return item[api.urlField];
  }
  if (api.urlTemplate) {
    const resolved = api.urlTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, field) => encodeURIComponent(String(item[field] ?? "")));
    if (/\{|\}/.test(resolved) === false && /^https?:\/\//.test(resolved)) return resolved;
  }
  return undefined;
}

/** 条目稳定键：优先 URL，无 URL 的接口条目退化为 标题+日期（diff/去重共用） */
function itemKey(item) {
  return item.url ?? `${item.title}|${item.date ?? ""}`;
}

/** 抓取一个 JSON API 列表页，归一化为 {title, url?, date?} 条目 */
async function fetchApiItems(api) {
  const headers = { "user-agent": USER_AGENT, accept: "application/json, text/plain, */*", ...(api.headers ?? {}) };
  const init = { redirect: "follow", headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) };
  if (String(api.method ?? "GET").toUpperCase() === "POST") {
    init.method = "POST";
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(api.body ?? {});
  }

  let jsonText;
  let layer = "api";
  try {
    const response = await fetch(api.url, init);
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}`, items: [], layer };
    jsonText = await response.text();
  } catch (error) {
    // 降级链：DoH 直连（仅 GET）→ curl
    const message = String(error?.cause?.message ?? error?.message ?? error);
    if (init.method !== "POST" && isNetworkLayerError(message)) {
      const addresses = await dohResolve(new URL(api.url).hostname);
      if (addresses) {
        const viaDoh = await rawRequest(api.url, addresses);
        if (viaDoh.ok) {
          jsonText = viaDoh.html;
          layer = "api+doh";
        }
      }
    }
    if (jsonText === undefined) {
      const viaCurl = await fetchPageViaCurl(api.url, { json: true, method: init.method ?? "GET", body: api.body, headers: api.headers });
      if (viaCurl.ok) {
        jsonText = viaCurl.html;
        layer = "api+curl";
      } else {
        return { ok: false, status: viaCurl.status, error: oneLine(message), items: [], layer: viaCurl.layer };
      }
    }
  }

  let data;
  try {
    // 雪花 ID 等 19 位整数超出 Number 安全范围，先加引号再解析，避免详情 URL 拼错
    const safeText = jsonText.replace(/:\s*(\d{15,})(\s*[,}\]])/g, ':"$1"$2');
    data = JSON.parse(safeText);
  } catch {
    return { ok: false, status: 200, error: "接口未返回 JSON", items: [], layer };
  }
  const list = getByPath(data, api.listPath);
  if (!Array.isArray(list)) {
    return { ok: false, status: 200, error: `listPath ${api.listPath} 不是数组（结构可能已变化）`, items: [], layer };
  }
  const items = [];
  const seen = new Set();
  for (const entry of list) {
    if (items.length >= MAX_ITEMS_PER_PAGE) break;
    if (!entry || typeof entry !== "object") continue;
    const title = String(entry[api.titleField] ?? "")
      .replace(/<[^>]+>/g, "") // 字段可能含 <br> 等 HTML 标签
      .replace(/\s+/g, " ")
      .trim();
    if (title.length < 4) continue;
    const url = resolveApiItemUrl(api, entry);
    const key = url ?? `${title}|${normalizeApiDate(api.dateField ? entry[api.dateField] : undefined) ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const date = api.dateField ? normalizeApiDate(entry[api.dateField]) : undefined;
    items.push({ title, ...(url ? { url } : {}), ...(date ? { date } : {}) });
  }
  if (!items.length) return { ok: false, status: 200, error: "接口列表为空（可能反爬或结构变化）", items: [], layer };
  return { ok: true, status: 200, items, layer };
}

async function checkApiPage(api) {
  const result = await fetchApiItems(api);
  if (!result.ok) {
    return { url: api.url, status: "error", httpStatus: result.status, error: result.error, items: [], layer: result.layer };
  }
  const hash = createHash("sha1").update(JSON.stringify(result.items.map((item) => [item.title, item.url, item.date]))).digest("hex");
  return { url: api.url, status: "ok", items: result.items, hash, layer: result.layer };
}

// ---------------------------------------------------------------------------
// L3：Chromium 渲染（playwright-core + 系统浏览器，可选）
// ---------------------------------------------------------------------------

let chromiumExecutableCache;
function findChromiumExecutable() {
  if (chromiumExecutableCache !== undefined) return chromiumExecutableCache;
  chromiumExecutableCache = CHROMIUM_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
  return chromiumExecutableCache;
}

let rendererModulePromise;
async function getRenderer() {
  if (rendererModulePromise !== undefined) return rendererModulePromise;
  rendererModulePromise = (async () => {
    const executablePath = findChromiumExecutable();
    if (!executablePath) return null;
    try {
      // 优先正常解析（VPS 上依赖装在仓库 node_modules）；
      // 其次走 DASH_MONITOR_DEPS_DIR（本地开发隔离目录，避免动 pnpm 的 node_modules）
      let chromium;
      try {
        ({ chromium } = await import("playwright-core"));
      } catch {
        const depsDir = process.env.DASH_MONITOR_DEPS_DIR;
        if (!depsDir) return null;
        const { createRequire } = await import("node:module");
        ({ chromium } = createRequire(path.join(depsDir, "package.json"))("playwright-core"));
      }
      const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      return browser;
    } catch {
      return null;
    }
  })();
  return rendererModulePromise;
}

async function renderPage(url) {
  const browser = await getRenderer();
  if (!browser) return { ok: false, status: 0, html: "", error: "Chromium 不可用", layer: "render", unavailable: true };
  let page;
  try {
    page = await browser.newPage({ userAgent: USER_AGENT, locale: "zh-CN" });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: RENDER_TIMEOUT_MS });
    await page.waitForTimeout(RENDER_SETTLE_MS);
    const html = await page.content();
    const status = response?.status() ?? 0;
    return { ok: status >= 200 && status < 400, status, html, finalUrl: page.url(), layer: "render" };
  } catch (error) {
    return { ok: false, status: 0, html: "", error: `渲染失败：${error?.message ?? error}`, layer: "render" };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function closeRenderer() {
  const browser = await rendererModulePromise;
  if (browser) await browser.close().catch(() => {});
}

// ---------------------------------------------------------------------------
// 条目提取与判定
// ---------------------------------------------------------------------------

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
    if (NOISE_TITLE_RE.test(title)) return;
    const href = anchor.attr("href") ?? "";
    // 过滤空锚点，但保留 SPA hash 路由链接（#/...）
    if (/^(javascript:|mailto:|#(?!\/))/i.test(href)) return;
    let absolute;
    try {
      absolute = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    if (new URL(absolute).origin !== new URL(pageUrl).origin) return;
    if (seen.has(absolute)) return;

    const context = anchor.closest("li, tr, dd, div, p").text() || anchor.parent().text() || "";
    const dateMatch = context.match(DATE_RE) ?? absolute.match(DATE_RE); // 上下文无日期时尝试从 URL 提取（如 /xw/2026-09-19/）
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

/** 错误信息压缩为单行，避免 Playwright 调用栈等多行内容污染报告/告警 */
function oneLine(text) {
  return String(text ?? "").split("\n")[0].slice(0, 200);
}

function isWafBlock(result) {
  return (result.status === 405 || result.status === 403) && WAF_RE.test(result.html ?? "");
}

// ---------------------------------------------------------------------------
// 单页检查：L1 → L2 → L3 自动降级
// ---------------------------------------------------------------------------

async function checkPage(url, kind, options) {
  let result = await fetchPage(url);

  // L2：仅当 L1 是 DNS/连接/证书类网络错误时，DoH 修复才有意义（WAF 与 DNS 无关）
  if (!result.ok && isNetworkLayerError(result.error)) {
    const viaDoh = await fetchPageWithDoh(url);
    if (viaDoh.ok) result = viaDoh;
    else if (/重定向循环/.test(viaDoh.error ?? "")) result = viaDoh; // 站点自身死循环，保留该诊断
  }

  // L2b：curl 兜底——本机代理/TUN 环境下 undici 常失败而 curl 可用；WAF 也可能因 TLS 指纹差异放行
  if (!result.ok) {
    const viaCurl = await fetchPageViaCurl(url);
    if (viaCurl.ok) result = viaCurl;
  }

  const buildOutcome = (res, note) => {
    // WAF 拦截页先于通用 HTTP 错误判断（405/403 也属于 !ok）
    if (isWafBlock(res)) {
      return { url, status: "error", httpStatus: res.status, error: "WAF 拦截（访问被阻断页）", items: [], layer: res.layer };
    }
    if (!res.ok) {
      return {
        url,
        status: "error",
        httpStatus: res.status,
        error: oneLine(res.error) || `HTTP ${res.status}`,
        items: [],
        layer: res.layer,
        ...(note ? { note } : {}),
      };
    }
    const { hash, textLength } = pageTextHash(res.html);
    if (textLength < MIN_TEXT_LENGTH) {
      return { url, status: "thin", textLength, reason: "页面正文过短，疑似 JS 渲染或反爬拦截", items: [], hash, layer: res.layer };
    }
    const items = kind === "news" ? extractNewsItems(res.html, res.finalUrl || url) : [];
    if (kind === "news" && items.length === 0) {
      return { url, status: "thin", textLength, reason: "未能提取到新闻条目，疑似 JS 渲染列表", items: [], hash, layer: res.layer };
    }
    return { url, status: "ok", items, hash, layer: res.layer };
  };

  let outcome = buildOutcome(result);
  if (outcome.status === "ok" || !options.render) return finalizeThin(outcome);

  // L3：渲染回退
  const rendered = await renderPage(url);
  if (!rendered.unavailable) {
    const renderedOutcome = buildOutcome(rendered);
    if (renderedOutcome.status === "ok") return renderedOutcome;
    // 渲染后仍是错误/稀薄：保留信息量更大的那个结果
    if (outcome.status === "error") outcome = renderedOutcome;
  }
  return finalizeThin(outcome);
}

function finalizeThin(outcome) {
  if (outcome.status === "thin") {
    return { ...outcome, status: "needsManualCheck", reason: outcome.reason };
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// diff / 状态
// ---------------------------------------------------------------------------

function diffItems(previousItems, currentItems) {
  const previousKeys = new Map((previousItems ?? []).map((item) => [itemKey(item), item]));
  const currentKeys = new Map(currentItems.map((item) => [itemKey(item), item]));
  const added = currentItems.filter((item) => !previousKeys.has(itemKey(item)));
  const removed = (previousItems ?? []).filter((item) => !currentKeys.has(itemKey(item)));
  return { added, removed };
}

function loadState(key) {
  const file = path.join(monitorStateDir, `${key}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveState(key, state) {
  fs.mkdirSync(monitorStateDir, { recursive: true });
  fs.writeFileSync(path.join(monitorStateDir, `${key}.json`), `${JSON.stringify(state, null, 2)}\n`);
}

async function checkTarget(target, options) {
  const previous = loadState(target.key);
  const pages = [];
  const changes = [];
  const checkedPages = [];
  for (const api of target.apis ?? []) {
    checkedPages.push(await checkApiPage(api));
  }
  for (const url of target.urls) {
    checkedPages.push(await checkPage(url, target.kind === "moe" ? "moe" : "news", options));
  }
  for (const page of checkedPages) {
    const url = page.url;
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

  const now = new Date().toISOString();
  const errorStreak = status === "error" ? (previous?.errorStreak ?? 0) + 1 : 0;
  // 基线合并：本次成功的页面覆盖旧快照，失败/未抓的页面保留旧基线，
  // 避免一次瞬时故障清空基线导致恢复后整页条目被误判为“新增”
  const okPages = Object.fromEntries(
    pages
      .filter((page) => page.status === "ok")
      .map((page) => [page.url, { hash: page.hash, layer: page.layer, ...(page.items?.length ? { items: page.items } : {}) }])
  );
  const state = {
    key: target.key,
    name: target.name,
    checkedAt: now,
    status,
    errorStreak,
    ...(status === "ok" || status === "changed" || status === "unchanged" ? { lastOkAt: now } : previous?.lastOkAt ? { lastOkAt: previous.lastOkAt } : {}),
    pages: { ...(previous?.pages ?? {}), ...okPages },
  };
  if (options.write) saveState(target.key, state);
  return { target, status, pages, changes, errorStreak };
}

// ---------------------------------------------------------------------------
// 自动写回分片
// ---------------------------------------------------------------------------

function shardPath(slug) {
  return path.join(SHARDS_DIR, `${slug}.json`);
}

/** 单行 JSON 对象，与分片现有 updates 格式一致（无 URL 的条目省略 url 字段） */
function formatUpdateLine(item) {
  const urlPart = item.url ? `, "url": ${JSON.stringify(item.url)}` : "";
  return `    {"date": ${JSON.stringify(item.date)}, "title": ${JSON.stringify(item.title)}${urlPart}, "source": "official", "auto": true},`;
}

/** 把 news-added 条目以外科手术方式插入分片原文（不重排其它字段）；按 URL 或 标题+日期 去重。返回写入明细。 */
function writeUpdatesToShards(results) {
  const written = [];
  const originals = new Map(); // file -> 原始内容（内存备份，回滚用）
  const pending = new Map(); // file -> 新内容

  try {
    for (const result of results) {
      if (result.target.kind !== "competition") continue;
      const added = result.changes.filter((change) => change.type === "news-added").flatMap((change) => change.items);
      if (!added.length) continue;

      const file = shardPath(result.target.key);
      if (!fs.existsSync(file)) continue;
      if (!originals.has(file)) {
        const original = fs.readFileSync(file, "utf8");
        originals.set(file, original);
        pending.set(file, original);
      }
      const shard = JSON.parse(pending.get(file));
      const updates = Array.isArray(shard.updates) ? shard.updates : [];
      const knownKeys = new Set(updates.map((update) => itemKey(update)));

      const lines = [];
      for (const item of added) {
        // 只自动写页面上带日期的条目：无日期条目噪声风险高，留在报告里人工/Agent 拾取
        if (!item.date || knownKeys.has(itemKey(item))) continue;
        knownKeys.add(itemKey(item));
        lines.push(formatUpdateLine(item));
        written.push({ slug: result.target.key, date: item.date, title: item.title, url: item.url ?? null });
      }
      if (!lines.length) continue;

      const raw = pending.get(file);
      const emptyArray = /"updates":\s*\[\s*\]/.exec(raw);
      if (emptyArray) {
        // 空数组：展开为多行
        const replacement = `"updates": [\n${lines.join("\n").replace(/,\s*$/, "")}\n  ]`;
        pending.set(file, raw.slice(0, emptyArray.index) + replacement + raw.slice(emptyArray.index + emptyArray[0].length));
        continue;
      }
      const open = /"updates":\s*\[/.exec(raw);
      if (!open) {
        throw new Error(`${path.basename(file)} 缺少 updates 数组，无法自动写入`);
      }
      const insertAt = open.index + open[0].length;
      pending.set(file, `${raw.slice(0, insertAt)}\n${lines.join("\n")}${raw.slice(insertAt)}`);
    }

    if (!written.length) return { written, validated: true };

    for (const [file, content] of pending) {
      fs.writeFileSync(file, content);
    }

    // 先重生成合并产物，再跑校验（validate 会检查 merged 是否与分片一致）
    const mergedFile = path.join(REPO_ROOT, "scripts", "competitions-content.json");
    if (fs.existsSync(mergedFile)) originals.set(mergedFile, fs.readFileSync(mergedFile, "utf8"));
    const merge = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts", "competition-merge.mjs")], { encoding: "utf8" });
    if (merge.status !== 0) {
      rollbackShards(originals);
      return { written: [], validated: false, validationOutput: `合并失败：${(merge.stderr ?? merge.stdout ?? "").trim()}` };
    }

    const validation = spawnSync(process.execPath, [VALIDATE_SCRIPT], { encoding: "utf8" });
    if (validation.status !== 0) {
      rollbackShards(originals);
      return { written: [], validated: false, validationOutput: `${validation.stdout ?? ""}${validation.stderr ?? ""}`.trim() };
    }
    return { written, validated: true };
  } catch (error) {
    rollbackShards(originals);
    return { written: [], validated: false, validationOutput: `写入异常：${error.message}` };
  }
}

/** 从内存备份恢复分片，不触碰工作区其它未提交改动 */
function rollbackShards(originals) {
  for (const [file, content] of originals) {
    try {
      fs.writeFileSync(file, content);
    } catch (error) {
      console.error(`分片回滚失败 ${file}：${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 告警
// ---------------------------------------------------------------------------

function collectAlertEvents(results, writeResult) {
  const events = [];
  for (const result of results) {
    for (const change of result.changes) {
      if (change.type === "moe-list-changed") {
        events.push({ type: "moe-list-changed", message: `⚠️ ${change.note}：${change.url}` });
      }
    }
    // 告警防抖：第 2 次连续失败时报一次，之后每 14 次（约每周）复报，避免长期宕机站点每日刷屏
    if (result.status === "error" && (result.errorStreak === 2 || (result.errorStreak > 2 && result.errorStreak % 14 === 0))) {
      const detail = result.pages.find((page) => page.status === "error");
      events.push({
        type: "persistent-error",
        message: `✕ ${result.target.name} 连续 ${result.errorStreak} 次抓取失败：${detail?.error ?? ""}（${detail?.url ?? ""}）`,
      });
    }
  }
  if (writeResult && writeResult.validated === false) {
    events.push({ type: "write-validation-failed", message: `自动写入未过校验，已回滚：${writeResult.validationOutput?.slice(0, 400)}` });
  }
  return events;
}

async function sendWebhook(events, reportPath) {
  const url = process.env.DASH_MONITOR_WEBHOOK_URL;
  if (!url || !events.length) return;
  const text = [`【赛事监测】${new Date().toLocaleString("zh-CN")}`, ...events.map((event) => event.message), reportPath ? `报告：${reportPath}` : ""]
    .filter(Boolean)
    .join("\n");
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, events }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(`告警 webhook 发送失败：${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------

function renderReport(results, startedAt, writeResult) {
  const lines = [];
  lines.push(`# 赛事监测报告 ${startedAt}`);
  lines.push("");
  const counts = {};
  for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
  lines.push(
    `共 ${results.length} 个监测目标：` +
      Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => `${status} ${count}`)
        .join("，")
  );
  lines.push("");

  if (writeResult) {
    lines.push("## 自动写入");
    if (writeResult.written?.length) {
      lines.push(`已追加 ${writeResult.written.length} 条动态到分片（校验${writeResult.validated ? "通过" : "失败"}）：`);
      for (const item of writeResult.written) lines.push(`- [${item.slug}] [${item.date}] ${item.title} — ${item.url}`);
    } else {
      lines.push(writeResult.validated === false ? `写入校验失败，已回滚：${writeResult.validationOutput ?? ""}` : "无新增动态需要写入。");
    }
    lines.push("");
  }

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
        lines.push(
          `- [${result.status}] ${result.target.name} — ${page.url}：${page.error ?? page.reason ?? ""}${page.layer ? `（${page.layer}）` : ""}`
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

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
    if (options.slug && entry.slug !== options.slug) continue;
    // apiPages 存在时优先直抓 JSON 接口（SPA 站点的全自动通道），否则走 HTML 页面三层降级
    const apis = Array.isArray(entry.apiPages)
      ? entry.apiPages.filter((api) => api && api.url && typeof api.listPath === "string" && api.titleField)
      : [];
    const urls =
      apis.length > 0
        ? []
        : Array.isArray(entry.newsPages) && entry.newsPages.length
          ? entry.newsPages
          : entry.officialSite
            ? [entry.officialSite]
            : [];
    if (!apis.length && !urls.length) continue;
    targets.push({ key: entry.slug, name: entry.nameZh, kind: "competition", apis, urls });
  }

  const startedAt = new Date().toISOString();
  const rendererAvailable = options.render ? Boolean(findChromiumExecutable()) : false;
  console.log(
    `监测 ${targets.length} 个目标（${new Date().toLocaleString("zh-CN")}）… 抓取层：fetch + DoH${rendererAvailable ? " + render" : "（render 不可用）"}`
  );
  const results = [];
  try {
    for (const target of targets) {
      const result = await checkTarget(target, options);
      results.push(result);
      const flag = { changed: "●", unchanged: "·", "first-scan": "○", error: "✕", needsManualCheck: "?" }[result.status] ?? "?";
      const layers = [...new Set(result.pages.map((page) => page.layer).filter(Boolean))].join("/");
      console.log(`${flag} ${target.name} [${result.status}]${layers ? ` <${layers}>` : ""}`);
      await sleep(400); // 温和抓取，避免对官网造成压力
    }
  } finally {
    await closeRenderer();
  }

  // 自动写回分片（--no-write 或快照关闭时不写）
  let writeResult = null;
  if (options.writeUpdates && options.write) {
    writeResult = writeUpdatesToShards(results);
    if (writeResult.written?.length) {
      console.log(`\n已写入 ${writeResult.written.length} 条新动态到分片（校验通过）。`);
    } else if (writeResult.validated === false) {
      console.error(`\n写入校验失败，已回滚：${writeResult.validationOutput ?? ""}`);
    }
  }

  const stamp = startedAt.slice(0, 19).replaceAll(":", "").replace("T", "-");
  const outputDir = options.output ?? path.join(monitorOutputRoot, stamp);
  fs.mkdirSync(outputDir, { recursive: true });
  const report = renderReport(results, startedAt, writeResult);
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
          errorStreak: result.errorStreak,
          changes: result.changes,
          pages: result.pages.map((page) => ({ url: page.url, status: page.status, layer: page.layer, error: page.error ?? page.reason })),
        })),
      },
      null,
      2
    )}\n`
  );
  if (writeResult) {
    fs.writeFileSync(path.join(outputDir, "written.json"), `${JSON.stringify(writeResult, null, 2)}\n`);
  }

  const alertEvents = collectAlertEvents(results, writeResult);
  await sendWebhook(alertEvents, outputDir);
  if (alertEvents.length) console.log(`告警事件 ${alertEvents.length} 条${process.env.DASH_MONITOR_WEBHOOK_URL ? "（已推送 webhook）" : "（未配置 webhook）"}。`);

  console.log(`\n报告已写入 ${path.relative(REPO_ROOT, outputDir)}/（report.md / diff.json${writeResult ? " / written.json" : ""}）`);
}

main().catch((error) => {
  console.error(`监测脚本执行失败：${error.message}`);
  process.exitCode = 1;
});
