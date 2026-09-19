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
- **7 个未配置站点**与 L2 全网搜索发现（搜索 API，需 `DASH_PAPER_SEARCH_*` 配置）为后续增强；VPS 出口对体育系站点同样被封。
- **第二期（交互式练习）**：题目级结构化（`paper_questions` 表外键 → 分片 id）、PDF→LLM 题目解析、在线作答/判分/错题本（复用 learning_events 事件溯源模式）；第一期稳定后排期。
