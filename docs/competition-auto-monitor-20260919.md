# 赛事自动监测与抓取机制设计（2026-09-19）

目标：47 项教育部白名单赛事 + 教育部名单页，**全部自动化监测**，检测到官网新动态后**自动更新网站内容并上线**，无需人工干预；只有结构性变化（名单调整、官网迁移、站点失效）才告警人工介入。

## 为什么这样设计

2026-09-19 的全量实测把 48 个监测目标分成三类（详见当次监测报告）：

| 类别 | 数量 | 根因 | 对策 |
|---|---|---|---|
| 直连可抓 | 17 | — | 现有 plain fetch（L1） |
| 网络层失败 | 10 | 本机 DNS 污染（5）、WAF 拦截（1）、站点 302 死循环（1）、间歇 DNS（3） | DoH 修正解析（L2）；VPS 干净出口天然规避 |
| SPA/JS 渲染 | 21 | 页面正文靠 JS 渲染，纯 fetch 拿不到 | 无头 Chromium 渲染（L3） |

实测确认：DoH 可修正污染域名；真实浏览器渲染后 SPA 内容完整（含报名时间等结构化信息）。因此**三层降级抓取**可以覆盖全部目标。

v2 在本机（网络受限环境）的首次全量实测：48 个目标中 27 个全自动抓取成功（含 10 个此前完全不可用的 SPA/异常站点经渲染层恢复），15 个仍需渲染后列表交互才能提取（降级为人工/Agent 跟进），6 个为服务端对本机 IP 的封锁（moe.gov.cn 与体育系站点，VPS/干净出口可解）。自动写入守门实测：校验失败会整体回滚（已验证 STALE_MERGED 场景），通过则按分片既有单行格式精确插入。

## 总体架构

```
VPS cron（每日 2 次）
  └─ scripts/competition-monitor-vps.sh
       1. git pull（VPS 上的仓库 clone：/opt/dash-pr/competition-monitor/repo）
       2. node scripts/competition-monitor.mjs --write-updates
            L1 plain fetch → L2 DoH 修复解析 → L3 Chromium 渲染（自动降级）
            diff 对比 state（/opt/dash-pr/competition-monitor/state/）
            news-added → 追加到 scripts/competitions/content/<slug>.json
            写盘前跑 validate-competitions 门禁，不过则回滚并告警
       3. 有变更 → competition-merge → git commit → push main
       4. GitHub Actions 现有管线（validate/build/打包/部署/冒烟）自动上线
       5. webhook 告警（名单变化 / 持续失败 / 写入校验失败）
```

### 关键决策：走 git + CI，而不是 VPS 直写数据库

赛事页面是 SSG，数据来自构建期内联的 `scripts/competitions-content.json`。让更新生效有两条路：

- **A（本方案）**：VPS 更新分片 JSON → push → CI 构建部署。复用现有全部质量门禁（validate 失败则部署失败，坏数据上不了线）；git 历史即审计与回滚；不改动网站运行架构。代价：更新延迟约 10 分钟，按日批处理足够。
- B（未采用）：页面改 ISR/动态读 DB。上线快但绕过策展审核，且要把三个页面从 SSG 改成动态渲染，风险大于收益。

### 抓取层（competition-monitor.mjs）

- **L1 plain fetch**：现状，带浏览器 UA、重试 3 次。
- **L2 DoH 修复**：L1 出现 DNS/证书/连接重置类错误时，用 `node:http(s)` 的 `lookup` 钩子把域名经 DoH（阿里 `223.5.5.5/resolve`，备用 DNSPod `1.12.12.12`）解析后直连真实 IP。纯 Node 内置模块，无新依赖。
- **L3 渲染**：L1/L2 拿到的是错误、正文过短或空列表时，用 `playwright-core` + 系统 Chromium（`CHROMIUM_PATH` 或常见路径自动探测）渲染页面后走同一套条目提取。Chromium 不可用时跳过并保持 `needsManualCheck`，不报错。
- **WAF 页识别**：HTTP 405 且正文含"访问被阻断"等 WAF 特征时按错误处理进入降级链。
- **302 死循环**（aiic.china61.org.cn）：识别自跳转，标记 `siteBroken`，进入告警但不反复重试。

### 自动写入门禁

- 只自动追加 `updates`（官网动态链接：`{date, title, url, source: "official", auto: true}`）；**赛事元数据与赛程永远不自动改**。
- 无日期的条目用抓取当天日期；与分片已有条目按 URL 去重。
- 写盘后备份式跑 `validate-competitions.mjs`，失败则整体回滚本次写入并告警。
- `competition-merge.mjs` 重新生成 `competitions-content.json`，与分片同一 commit。

### 告警

`DASH_MONITOR_WEBHOOK_URL` 指向任意接受 JSON POST 的 webhook（Server 酱 / 企业微信 / Telegram Bot 均可包装）。触发事件：

- `moe-list-changed`：教育部名单页变化（每次必报）
- `write-validation-failed`：自动写入未过校验（已回滚）
- `persistent-error`：同一目标连续 ≥2 次抓取失败（防抖，瞬时抖动不报）
- `site-broken`：官网出现死循环/长期不可用迹象
- `git-push-failed`：更新已写盘但推送失败（下次运行会重试）

### 状态与报告

- 状态目录：`DASH_MONITOR_STATE_DIR`（VPS 默认 `/opt/dash-pr/competition-monitor/state`，本地默认仓库内 `scripts/competitions/state`）。每个目标记录快照、`errorStreak`、`lastOkAt`。
- 报告目录：`DASH_MONITOR_OUTPUT_DIR`（VPS 默认 `/opt/dash-pr/competition-monitor/reports/<日期>/`），含 `report.md` / `diff.json` / `written.json`。
- VPS 上 state/reports 都在仓库 clone 之外，跨部署持久。

## VPS 部署（一次性，runbook）

前置：VPS 已有 Node 22（`/opt/node22`）与部署用户（无 sudo，Chromium 安装需一次性 root）。

```bash
# 以部署用户执行（Chromium 安装步骤除外）
sudo bash scripts/competition-monitor-setup.sh   # 或按脚本内注释分步执行
```

脚本做的事：

1. 建目录 `/opt/dash-pr/competition-monitor/{repo,state,reports,deps}`
2. clone 仓库（用只写本仓库的 GitHub Deploy Key，需在仓库设置里勾选 **Allow write access**）
3. `npm install --prefix repo --no-save cheerio playwright-core`（monitor 依赖装进 clone 的 node_modules，不进 release 包）
4. 检测 Chromium；缺失时打印 root 安装命令（Debian/Ubuntu：`apt-get install -y chromium`，或 `npx playwright install --with-deps chromium`）
5. 写入 cron（部署用户）：`17 8,20 * * * /opt/dash-pr/competition-monitor/repo/scripts/competition-monitor-vps.sh`
6. 生成 `monitor.env` 模板（webhook、CHROMIUM_PATH 等）

## 本地开发/验证

```bash
pnpm competitions:monitor                       # 全量监测（自动三层降级）
node scripts/competition-monitor.mjs --slug noi --write-updates   # 单目标+写入
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  node scripts/competition-monitor.mjs          # 本机强制走 Chrome 渲染验证 SPA
```

## 已知的不可自动化残余

- `aiic.china61.org.cn` 站点自身 302 死循环：任何客户端都无法抓，只能等站点修复或换源（告警会提示）。
- 教育部名单调整、赛事赛程变更：监测能**发现**，但结构化入库仍需人工（质量要求高的策展内容）。
- 若 VPS 出口自身被某站点封锁（海外机房访问个别政务站点可能受限），该目标会持续 `error` 并触发告警；届时可为单站点配置代理或改为人工维护。
