// L2 全网搜索发现（备赛资料）：对 L1（官网 paperPages）无收获的赛事，
// 用搜索 API 在公开网络发现真题/命题/规则/获奖范例，结果回到同一条下载/校验/去重管线。
// 仅使用 Node 标准库，供 paper-collector.mjs 引用。

import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// 赛事资料分类（与 docs/papers-feature-20260919.md 的四类覆盖设计一致）：
//   A 笔试类 → 真题试卷；B 命题创作类 → 历届命题；C 技能实操类 → 赛项规则；D 作品评审类 → 获奖/指南
// ---------------------------------------------------------------------------
const MATERIAL_CLASS = {
  cnao: "A", geodoctor: "A", cmo: "A", cpho: "A", ccho: "A", chsbo: "A", noi: "A", ceso: "A",
  "anti-drug-quiz": "A", "bantu-quiz": "A", "youth-psy-innovation": "A", nyseic: "A", "hs-innovation": "A",
  zuowendasai: "B", luxunwenxue: "B", "eco-essay": "B", "red-culture-contest": "B", "china-story-contest": "B",
  "tongsong-zhonghua": "B", "shici-meiyu": "B", "painting-calligraphy": "B", xiwangsong: "B", "fltrp-cup": "B",
  "wrc-youth": "C", nqdrone: "C", "nautical-model": "C", "vehicle-model": "C", "feibei-aeromodel": "C",
  "youth-flight-sim": "C", "traditional-sports": "C", nysec: "C", aild: "C", nyaic: "C",
  "soong-invention-award": "D", castic: "D", "yau-awards": "D", "icc-china": "D", nysic: "D",
  "water-tech-invention": "D", "ocean-design-contest": "D", "ai-digital-art": "D", "visual-art-workshop": "D",
  "national-defense-youth": "D", "drama-china-contest": "D", "ivy-campus-drama": "D", "ny-ai-contest": "D", nysim: "D",
};

const QUERY_TEMPLATES = {
  A: (name) => `${name} 历年真题 试题`,
  B: (name) => `${name} 历届 命题 主题 题目`,
  C: (name) => `${name} 竞赛规则 任务书 规程`,
  D: (name) => `${name} 获奖名单 申报指南 评分标准`,
};

export function materialClassFor(slug, fallbackCategory) {
  if (MATERIAL_CLASS[slug]) return MATERIAL_CLASS[slug];
  // 未登记的按大赛类别兜底：自然科学偏笔试/实操，人文偏创作，艺体偏实操/评审
  return fallbackCategory === "humanities" ? "B" : fallbackCategory === "art-sports" ? "C" : "A";
}

export function searchQueryFor(entry) {
  const klass = materialClassFor(entry.slug, entry.category);
  return { klass, query: QUERY_TEMPLATES[klass](entry.nameZh) };
}

// ---------------------------------------------------------------------------
// 域名黑名单：付费墙/文库/抓取陷阱站点（明确不绕权限），命中即丢弃搜索结果
// ---------------------------------------------------------------------------
const DOMAIN_BLACKLIST = [
  "zxxk.com", "21cnjy.com", "jyeoo.com", "xuekeedu.com", "zujuan.com", "cooco.net.cn",
  "docin.com", "doc88.com", "renrendoc.com", "book118.com", "51jiaoxi.com",
  "tiku.com.cn", "shitiku.cn", "baidu.com", "so.com", "douding.com", "taodocs.com",
  "deliwenku.com", "miyuedu.com", "51wendang.com", "docin.net", "dearedu.com",
];

export function isBlacklistedDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DOMAIN_BLACKLIST.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Tavily provider：POST https://api.tavily.com/search（Bearer 认证）
// ---------------------------------------------------------------------------
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 20_000;

function tavilyViaCurl(query, apiKey, maxResults) {
  const payload = JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_answer: false });
  const child = spawnSync(
    "curl",
    ["-sfS", "-X", "POST", TAVILY_ENDPOINT, "-H", "content-type: application/json", "-H", `authorization: Bearer ${apiKey}`, "--max-time", String(Math.ceil(SEARCH_TIMEOUT_MS / 1000)), "--data", payload],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
  );
  if (child.status !== 0) return { ok: false, error: `curl 调用失败：${(child.stderr ?? "").trim().slice(0, 200)}` };
  try {
    return { ok: true, data: JSON.parse(child.stdout) };
  } catch {
    return { ok: false, error: "Tavily 返回非 JSON" };
  }
}

/**
 * 调 Tavily 搜索，返回 { ok, results: [{title, url, snippet}], error }。
 * fetch 失败（本机代理/TUN 环境）时降级 curl。
 */
export async function searchTavily(query, { apiKey, maxResults = 8 } = {}) {
  const payload = JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_answer: false });
  let data = null;
  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: payload,
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // 限流/额度不足等明确信号直接返回，不重试
      return { ok: false, error: `Tavily HTTP ${response.status}：${text.slice(0, 120)}`, httpStatus: response.status };
    }
    data = await response.json();
  } catch {
    const viaCurl = tavilyViaCurl(query, apiKey, maxResults);
    if (!viaCurl.ok) return { ok: false, error: viaCurl.error };
    data = viaCurl.data;
  }
  const results = (Array.isArray(data?.results) ? data.results : [])
    .filter((item) => item && typeof item.url === "string" && typeof item.title === "string")
    .map((item) => ({
      title: item.title.replace(/\s+/g, " ").trim(),
      url: item.url,
      snippet: typeof item.content === "string" ? item.content.slice(0, 300) : "",
    }));
  return { ok: true, results };
}

/** L2 搜索配置（环境变量）；未配置时 collector 自动跳过并在报告注明 */
export function searchConfig() {
  const provider = process.env.DASH_PAPER_SEARCH_PROVIDER ?? "";
  const apiKey = process.env.DASH_PAPER_SEARCH_KEY ?? "";
  if (!provider || !apiKey) return null;
  return { provider, apiKey };
}

/** 同一赛事两次 L2 搜索的最小间隔（控制搜索 API 额度消耗） */
export const L2_RESEARCH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// L2 相关性门禁：搜索结果是第三方来源，标题/摘要必须含有赛事的识别性名称片段，
// 防止"目录""XX 年鉴"及同名异赛（如智能无人系统应用大赛≠无人机大赛）混入。
// ---------------------------------------------------------------------------
const GENERIC_NAME_WORDS = /全国|青少年|中学生|小学生|中小学|青年|少年|儿童|大赛|竞赛|比赛|活动|锦标赛|教育|展示|征集|选拔赛|中国区|赛区|学年|面向|的/g;

/** 从赛事名提取识别性片段：引号内专有名词（如“外研社杯”）+ 去通用词后的名称主体 + 策展别名（奥赛阶段赛自有名称） */
const NAME_ALIASES = {
  cmo: ["数学联赛", "高中数学联赛", "数学奥林匹克"],
  cpho: ["中学生物理竞赛", "物理奥林匹克", "CPhO"],
  ccho: ["化学奥林匹克", "化学竞赛"],
  chsbo: ["生物学联赛", "生物竞赛", "生物奥林匹克"],
  noi: ["NOIP", "信息学奥赛", "信息学奥林匹克"],
  ceso: ["地球科学奥赛", "地球科学奥林匹克"],
  cnao: ["天文知识竞赛", "天文奥赛", "CNAO"],
  nqdrone: ["无人机大赛", "无人机创新教育竞赛"],
  nyaic: ["人工智能创新挑战赛"],
  "wrc-youth": ["世界机器人大会", "WRC"],
  "anti-drug-quiz": ["禁毒知识竞赛"],
  "bantu-quiz": ["版图知识竞赛", "美丽中国"],
  "fltrp-cup": ["外研社杯", "外语素养大赛"],
};

export function nameTokensFor(entry) {
  const name = String(entry?.nameZh ?? "");
  const tokens = new Set(NAME_ALIASES[entry?.slug] ?? []);
  for (const match of name.matchAll(/[“「『]([^”」』]+)[”」』]/g)) {
    if (match[1].length >= 2) tokens.add(match[1]);
  }
  const stripped = name.replace(/[“”「」『』《》（）()·\s-]/g, "").replace(GENERIC_NAME_WORDS, "");
  if (stripped.length >= 3) tokens.add(stripped);
  if (name.length >= 4) tokens.add(name.replace(/[“”「」『』]/g, ""));
  return [...tokens].sort((a, b) => b.length - a.length);
}

/** 标题或摘要命中任一识别性片段即为相关（片段按长度降序，优先长片段） */
export function isRelevantToCompetition(entry, title, snippet = "") {
  const haystack = `${title ?? ""}\n${snippet ?? ""}`.toLowerCase();
  return nameTokensFor(entry).some((token) => haystack.includes(token.toLowerCase()));
}
