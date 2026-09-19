# 备赛资料功能设计（真题/命题/规则/获奖范例，2026-09-19）

目标：教育部白名单 47 项赛事的备赛资料**全自动采集 → 结构化入库 → 站内展示**，与赛事动态监测同套纪律（git + CI 质量门禁、VPS cron 无人值守）。

## 覆盖策略：从"真题库"泛化为"备赛资料库"

47 项赛事中只有约 13 项是笔试（有"真题试卷"），其余赛事没有试卷但有公开的备赛核心资料。按赛事性质分四类采集（registry `paperPages` 配置驱动）：

| 类别 | 资料类型（`kind`） | 示例 |
|---|---|---|
| A 笔试类 | `paper` 真题试卷 / `answer` 答案 | 地科奥赛"往届真题"（已实证 13 份 PDF 入库） |
| B 命题创作类 | `problem` 历届命题/主题 | 作文大赛历届题目、书画比赛历史主题 |
| C 技能实操类 | `rules` 赛项规程 / `standard` 评分标准 | 机器人大赛规则 PDF、无人机任务书 |
| D 作品评审类 | `problem` / `gallery` 获奖名单/范例 | 丘成桐奖获奖专区、科技创新大赛指南 |

`kind` 受控词表：`paper | answer | problem | rules | standard | gallery | attachment`；
`stage` 受控词表：`初赛 | 预赛 | 联赛 | 复赛 | 省选 | 全国赛 | 决赛 | 总决赛 | 冬令营 | 其他`。

## 架构（与赛事动态监测同构）

```
VPS cron（每日 09:47 / 21:47 柏林时间，与动态监测错峰）
  └─ scripts/paper-collector-vps.sh
       1. git pull（复用 /opt/dash-pr/competition-monitor/repo）
       2. node scripts/paper-collector.mjs --write
            三层降级抓取（fetch → DoH → curl → Chromium 渲染，复用 competition-monitor 导出层）
            链接发现：附件（pdf/doc/zip/图片）+ 资料关键词文章页（深入一层提取附件）
            下载守护：扩展名白名单 + 单文件 50MB + magic number 校验 + sha256 去重
                     + 单赛事单次新增上限 30（--max-new 可调）
            文件落盘 DASH_PAPER_PUBLIC_DIR（VPS：/opt/dash-pr/public，nginx /files/ 直出 + 登录保护）
            元数据写 scripts/competitions/papers/<slug>.json 分片（单行条目格式）
       3. paper-merge → validate-papers 门禁（失败整体回滚：分片 + 合并产物 + 已下载文件，状态不保存）
       4. git commit → push main → GitHub Actions 现有管线自动部署
```

关键决策（同动态监测）：**元数据走 git + CI**（审计/回滚/质量门禁）；**二进制文件走 VPS 公共卷**（不入 git，登录保护，仅合作伙伴可见，天然满足版权约束）。

## 数据结构

### registry.json（每赛事可选）

```json
"paperPages": [{ "url": "https://ceso.ssoc.org.cn/kejian/", "label": "往届真题" }]
```

配置实况（2026-09-19 全量探测后）：21 站专属资料栏目 + 4 站 newsPages 兜底 + 15 站官网兜底 = **40 个配置目标**；7 站暂不配置（nqdrone DNS 迁移中、体育系 4 站封锁境外 IP、希望颂站点下线、模拟飞行 sport.gov.cn 同被封）——等 L2 搜索或代理通道。

### paper 分片 `scripts/competitions/papers/<slug>.json`

```json
{
  "slug": "ceso",
  "papers": [
    {"id":"ceso-2025-juesai-87f8ab","year":2025,"stage":"决赛","grade":null,
     "title":"2025-2026学年全国中学生地球科学奥赛决赛试题",
     "files":[{"kind":"paper","format":"pdf","fileKey":"files/papers/ceso/ceso-2025-juesai-87f8ab-paper.pdf","size":6570548,"sha256":"af5d…"}],
     "hasAnswer":false,"source":{"name":"往届真题","url":"https://ceso.ssoc.org.cn/kejian/"},
     "auto":true,"collectedAt":"2026-09-19"}
  ]
}
```

- `id` 稳定规则：`<slug>-<year>-<stageCode>-<title sha1 前 6 位>` —— 复抓生成同一 id，按 id 去重不重复入库；同年同阶段多套卷靠标题哈希区分。
- 文件条目二选一：`fileKey`（已下载，VPS 公共卷相对路径 + size + sha256）或 `externalUrl`（无附件的命题类网页，外链原文）。
- `disabled: true` 为人工下架开关（随 CI 生效）。
- 合并产物 `scripts/papers-content.json` 构建期内联，严格模式（registry 47 项均需分片，允许空数组）。

## 自动写入门禁与状态

- 只自动**追加**资料；从不自动修改已有条目（人工策展内容不被动摇）。
- 写盘后先跑 `paper-merge` 再跑 `validate-papers.mjs`：slug ∈ registry、id 唯一且前缀匹配、year ∈ [1990, 今年+1]、stage/kind ∈ 词表、fileKey 模式与 sha256 校验、source.url http(s)、合并产物新鲜度；任一失败**整体回滚**（分片 + 合并产物 + 已下载文件），且**采集状态不保存**（下次重试）。
- 状态目录 `DASH_PAPER_STATE_DIR`（默认 `scripts/competitions/paper-state` 随仓库提交；VPS 用外部目录）：记录每个候选 URL 的处理结果，避免跨运行重复下载。

## 前台

- `/competitions/papers` **备赛资料中心**（SSG + 客户端筛选）：搜索、赛事下拉、资料类型筛选；按赛事 → 年份分组；每条显示年份/阶段/类型/含答案角标、文件下载（PDF 新窗口预览）、来源链接；页尾版权说明。
- 赛事详情页：有资料时追加"备赛资料"锚点 tab 与分组列表（复用同一资料卡片组件 `paper-material-card.tsx`）。
- 赛事列表页：工具栏"备赛资料"入口 + 卡片"资料 N"角标（仅 N>0）。
- i18n：messages zh/en 增 29 键（`competitions.paper*` + `metadata.pages.competitionPapers`）。

## 工程接线

- `package.json`：`papers:merge / papers:validate / papers:collect`；`content:validate` 纳入 validate-papers。
- deploy.yml：质量步骤 `node --check` 四个新脚本；打包步骤 `cp scripts/papers-content.json`。
- `competition-monitor-setup.sh`：增 paper-state/paper-reports 目录与第二条 cron（`47 9,21 * * *`）。
- 本地开发：`pnpm papers:collect`（dry-run）/ `--slug ceso --write`（单站写盘）。

## 已知边界

- **版权**：仅收录官网及公开渠道资料，页面标注来源；付费墙站点（学科网等）不采；`disabled` 下架机制。
- **无年份条目不入库**（id 需要年份）：报告记录 skipped 原因供人工补录。
- **7 个未配置站点**由 L2 搜索兜底（2026-09-19 起 Tavily 接入，见下节）；VPS 出口对体育系站点同样被封。
- **第二期（交互式练习）已上线**（2026-09-19）：题目结构化 + 在线作答 + 错题本，见下节。

## L2 全网搜索发现（2026-09-19 上线）

- **provider**：Tavily（`DASH_PAPER_SEARCH_PROVIDER/KEY` 配置于 VPS monitor.env，未配置自动跳过并记入报告）。
- **查询模板**：按赛事资料分类（A 笔试/B 创作/C 实操/D 评审，paper-search.mjs 内置映射）生成中文查询。
- **三重质量门禁**：付费墙/文库域名黑名单（学科网/21 世纪教育/组卷网等，明确不绕权限）；赛事名识别片段 + 策展别名（奥赛阶段赛自有名称，如"全国高中数学联赛"=CMO 预赛）的相关性过滤；与 L1 共用的下载守护/去重/校验/回滚。
- **限频**：同一赛事 L2 搜索间隔 ≥ 7 天（state.l2.lastSearchAt），控制搜索额度。
- 实测（2026-09-19）：L2 为 19 项 L1 空白的赛事找到首批资料（含体育系封锁站点与官网失效站点）。

## 第二期：交互式练习（2026-09-19 上线）

### 题目结构化（paper-extract.mjs）

- 对已采集的 `kind=paper & format=pdf` 资料逐卷抽取：**文本引擎**（pdftotext → deepseek-v3 JSON 模式）处理文字版 PDF，**视觉引擎**（pdftoppm 150dpi 页图 → kimi-k2.5 多模态）处理扫描件，auto 自动降级。
- 输出 `scripts/competitions/questions/<slug>.json` 题目分片（同 git-content 纪律）：题型 `choice/multiple/fill/essay`，含 options/answer/explanation/points 与 extractor 元数据（model/at/reviewed）。
- `validate-paper-questions` 门禁：paperId 必须 ∈ papers 分片、题号唯一、选项 key 合法、答案引用存在、合并产物新鲜度；失败整体回滚。合并产物 `scripts/papers-questions.json` 随 release 打包。
- LLM 端点：OpenAI 兼容（`DASH_EXTRACT_BASE_URL/API_KEY/MODEL/VISION_MODEL`）。

### 练习与错题本

- **API**（全部登录 + same-origin CSRF + 幂等）：`GET /api/papers/[paperId]/questions`（脱敏下发，不含答案解析）；`POST /api/practice/session`（同卷同模式复用 active 会话，断点续练）；`POST /api/practice/answer`（幂等键重放一致、同题 409，提交后才揭晓答案/解析）；`POST /api/practice/finish`（自动判分题百分比得分，幂等）；`POST /api/practice/self-mark`（解答题自评/错题掌握，修正会话计数）；`GET /api/practice/wrong-book`（每题最新作答 is_correct=0 派生错题本）。
- **判分规则**：单选精确命中；多选全对才得分（全或无）；填空归一化（全半角/空白/大小写，`|` 分隔多可接受答案）；解答题提交不判分，展示参考答案后用户自评。
- **页面**：资料卡片"开始练习"入口（有题目才显示）；`/competitions/papers/[paperId]/practice` 逐题作答（进度条、判分反馈、解析、解答题自评、交卷成绩）；`/competitions/papers/wrong-book` 错题本（我的答案 vs 正确答案 + 解析 + 已掌握移除）。
- **DB**（migration 015）：`practice_sessions` / `practice_answers`（幂等键 UNIQUE + 同会话同题 UNIQUE），错题本为派生查询不建表。
- **测试**：`tests/practice-grading.test.mjs`（判分 6 例）+ `tests/practice-db.test.mjs`（会话/幂等/判分/自评/错题本集成 4 例），strip-types loader 支持 server-only stub 与 @/ 别名；CI 纳入 `pnpm papers:test`。

### 第二期已知边界

- 题目为 AI 抽取（extractor.reviewed=false 起），数学/物理公式以 LaTeX 呈现（页面 v1 纯文本渲染，KaTeX 渲染为后续增强）；抽取错误随人工抽检修正（reviewed 标记）。
- 填空暂为单空精确匹配；多空题与部分给分（多选半对）为后续增强。
- 扫描件抽取依赖视觉模型额度（kimi-k2.5 约 $0.01/卷量级）。
