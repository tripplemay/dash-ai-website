# 芯坐标 CORECOORD · 合作伙伴工作台

Next.js 全栈工程，为芯坐标 CORECOORD 少儿 AI 素养课程的合作伙伴提供品牌资源、课程项目与大屏播放。

> CORECOORD Logo Final 2026.1 与 VI System 2026.1 的批准资产已版本化收录在 `deploy/brand/2026.1/`；部署工作流会独立校验并物化到 VPS 的 `/assets/brand/corecoord/2026.1` 与 `/files/corecoord`。两个大字体以 `deploy/brand-chunks/2026.1/` 的无损 gzip 分片存储，检查/构建前自动还原为原始 TTF。旧数据库记录和品牌目录会在发布备份中保留，旧公网静态路径则由 nginx 返回 410。

## 技术栈

- Next.js 16（App Router，`output: 'standalone'`）+ TypeScript strict + Tailwind CSS v4 + pnpm
- shadcn/ui + Lucide React 图标
- next-intl 中英双语：`[locale]` 路由段，`zh` 默认，`en` 预留
- better-auth + better-sqlite3：username + password 登录，会话 cookie 守卫

## 本地开发

```bash
pnpm install
pnpm brand:check
pnpm brand:materialize --resource-root ./public
NODE_ENV=development BETTER_AUTH_SECRET=dev-secret-local-012345678901234567890123 SEED_INITIAL_PASSWORD=<初始密码> SEED_ADMIN_PASSWORD=<管理员密码> pnpm seed
pnpm dev
```

访问 `http://localhost:3000/` 跳转到 `/zh`，未登录重定向 `/zh/login`。
seed 幂等：已存在账号跳过、角色校正；`resources` 表仅在为空时播种（数据源 `scripts/resources-seed.json`）。
初始账号：`partner` / `teacher` / `guest`（密码为 `SEED_INITIAL_PASSWORD`）+ `admin`（密码为 `SEED_ADMIN_PASSWORD`，管理后台 `/admin` 仅 admin 可见）。

升级已有数据库时先执行 Better Auth 迁移，再执行资源迁移（请求路径不会自动建表）：

```bash
DASH_AUTH_DB=/opt/dash-pr/dash-auth.db node scripts/migrate-auth.mjs
DASH_AUTH_DB=/opt/dash-pr/dash-auth.db node scripts/migrate.mjs
```

`scripts/seed.mjs` 已内置同一迁移步骤；首次建库仍应使用 seed，以同时创建 Better Auth 表和初始账号。

品牌资产同步与检查：`pnpm brand:sync` 从相邻 `dashpr/品牌商标-芯坐标` 源目录更新批准清单并生成字体分片；`pnpm brand:assemble` 可单独还原两个 TTF；`pnpm brand:check` 会自动还原并校验 manifest、SHA256、分片清单和排除规则；`pnpm brand:materialize` 将公开静态包与受保护下载资源复制到指定的 `public` 根目录。发布时不应把旧 `public/files` 目录直接清空。

若迁移提示历史 `file_key` 重复，先备份数据库，再人工确认并执行审计式去重（保留最新 `updated_at` 的记录，不删除磁盘文件）：

```bash
DASH_AUTH_DB=/opt/dash-pr/dash-auth.db \
  DASH_DEDUPE_CONFIRM=YES node scripts/dedupe-resources.mjs
```

部署前可用 `scripts/check-db.mjs` 检查 Better Auth 核心表和数据库完整性；发布脚本在
Better Auth 迁移前使用 `DASH_CHECK_DB_AUTH_ONLY=1` 只验证旧库仍有用户表，迁移完成后再用
`DASH_CHECK_DB_REQUIRE_RESOURCES=1` 将 `resources` 表也纳入检查：

```bash
DASH_AUTH_DB=/opt/dash-pr/dash-auth.db node scripts/check-db.mjs
DASH_AUTH_DB=/opt/dash-pr/dash-auth.db \
  DASH_CHECK_DB_REQUIRE_RESOURCES=1 node scripts/check-db.mjs
```

生产数据库建议按日执行在线备份，并将 `DASH_BACKUP_DIR` 指向独立磁盘或对象存储同步目录：

```bash
DASH_AUTH_DB=/opt/dash-pr/dash-auth.db \
  DASH_BACKUP_DIR=/opt/dash-pr/backups \
  node scripts/backup-db.mjs
```

### 环境变量

| 变量                    | 说明                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | 会话密钥，生产必须设置且至少 32 字符（不满足时运行会拒绝启动）          |
| `BETTER_AUTH_URL`       | 生产必填的站点对外 base URL（公网使用 `https://pr.dashedu.net`）                  |
| `DASH_AUTH_DB`          | SQLite 文件路径，默认 `./dash-auth.db`                          |
| `DASH_PUBLIC_ORIGIN`    | 生产必填：反向代理后的公开 origin（上传 CSRF 校验；如 `https://pr.dashedu.net`） |
| `DASH_HEALTH_URL`       | 生产必填的公网 HTTPS origin；部署后通过该地址验证应用和 `/files` 鉴权边界 |
| `DASH_UPLOAD_MAX_BYTES` | 单文件上传上限，默认 64 MiB                                     |
| `DASH_ZIP_MAX_BYTES`    | 分类 ZIP 总大小上限，默认 512 MiB                               |
| `DASH_ZIP_MAX_FILES`    | 分类 ZIP 文件数上限，默认 2000                                  |
| `DASH_ZIP_MAX_DIRECTORIES` | ZIP 递归目录数上限，默认 2000                              |
| `DASH_ZIP_MAX_DEPTH`     | ZIP 递归深度上限，默认 12                                         |
| `DASH_ZIP_MAX_SCANNED_ENTRIES` | ZIP 扫描条目上限，默认 10000                               |
| `DASH_ZIP_MAX_CONCURRENT` | 单进程并行 ZIP 任务上限，默认 2                                  |
| `DASH_BROWSE_MAX_ENTRIES` | 单目录清单条目上限，默认 1000                                  |
| `DASH_BROWSE_MAX_SCANNED_ENTRIES` | 单目录扫描条目上限，默认 10000                         |
| `DASH_BROWSE_MAX_HTML_BYTES` | 单目录清单 HTML 上限，默认 2 MiB                            |
| `SEED_INITIAL_PASSWORD` | 仅 seed 脚本使用：partner/teacher/guest 的初始密码（≥8 位）     |
| `SEED_ADMIN_PASSWORD`   | 仅 seed 脚本使用：admin 账号的初始密码（≥8 位）                 |
| `DASH_AUTH_DISABLED`    | `=1` 且 `NODE_ENV=development` 时跳过登录守卫（本地预览用）      |

## 目录结构

```
├── messages/            # zh.json / en.json 文案
├── deploy/brand/2026.1/ # CORECOORD 批准 Logo、VI、字体、预览、模板与发布清单
├── deploy/brand-chunks/  # 大字体的无损传输分片（运行前自动还原，不直接对外提供）
├── public/              # 不进 git：运行时 assets/ 与 files/（部署时由品牌包物化）
├── scripts/{sync-brand-assets,migrate,migrate-auth,seed,backup-db,dedupe-resources,check-db,prepare-pm2-config}.mjs # 资产同步、迁移、播种、备份、校验与发布配置
├── deploy/nginx/dash-pr.conf                         # 可直接安装的生产 vhost（含 /files 鉴权）
├── deploy/nginx/{dash-pr-upstream,dash-pr-files}.conf # 可组合的 /files 受保护反代片段
├── src/
│   ├── proxy.ts         # locale 路由 + 登录守卫
│   ├── i18n/ lib/ components/   # lib/db.ts 资源表 · lib/storage.ts 存储抽象 · lib/admin-guard.ts
│   └── app/
│       ├── api/auth/[...all]/    # better-auth 处理器
│       ├── api/browse/[...path]/ # 目录浏览清单（需登录）
│       ├── api/file/[...path]/   # 文件流（真实会话 + 上架状态校验）
│       ├── api/download/[id]/    # 资源下载端点（登录校验 → 302）
│       ├── api/admin/upload/     # 资源上传（admin，multipart 流式写盘）
│       └── [locale]/ (public)/login · (app)/{page,course,resources,player} · (admin)/admin{,/accounts,/resources}
└── .github/workflows/deploy.yml  # 推送 main 自动构建并部署到 VPS
```

## CI/CD（GitHub Actions → VPS）

推送 `main` 分支即自动部署。工作流：安装依赖 → 使用 runner 临时目录中的隔离 SQLite 路径执行 `pnpm build` → 打包 standalone、seed 运行时依赖、`.next/static` 和生产 nginx vhost → 对打包后的 seed/server 做 smoke 与数据库/资产断言 → 在切换软链前备份并迁移 VPS 数据库 → scp/解压为新 release → 校验 native runtime ABI 与 PM2 运行环境 → 切换 `current` → 使用发布专用 PM2 配置 reload → 安装并校验 nginx → 通过公网 live/ready 与 `/files` 鉴权探针后 `pm2 save`。构建期占位 `BETTER_AUTH_SECRET` 不参与运行时，nginx 配置和 PM2 配置失败都会自动回滚。

需要在仓库 Settings → Secrets 中配置：

| Secret           | 说明                     |
| ---------------- | ------------------------ |
| `DEPLOY_SSH_KEY` | VPS 部署私钥             |
| `DEPLOY_HOST`    | VPS 地址                 |
| `DEPLOY_USER`    | SSH 用户                 |
| `DEPLOY_KNOWN_HOSTS` | 固定的 VPS `known_hosts` 行，发布启用严格主机密钥校验 |
| `DASH_HEALTH_URL` | 必填且必须为 `https://pr.dashedu.net`；部署后用于验证公网边界 |

### VPS 侧一次性初始化（已固化在服务器，无需重复）

```
/opt/dash-pr/
├── releases/<时间戳>/   # 每次部署一个目录，自动保留最近 5 个
├── current -> releases/…  # 软链切换即发布/回滚
├── public/            # 静态资产卷（/assets/brand/corecoord/2026.1 可直出；/files 必须禁止 nginx 直出）
│   ├── assets/brand/corecoord/2026.1/ # 发布拥有的公开 CORECOORD 包
│   └── files/corecoord/               # 发布拥有的受保护资源副本，不放手工上传
├── backups/brand/     # 每次 CORECOORD 资源切换前的旧目录归档（保留最近 5 个）
├── dash-auth.db       # 账号库（持久化，不随发布变更）
└── ecosystem.config.js# pm2 配置（含生产环境变量，仅存在于服务器，chmod 600）
```

部署工作流会将 `deploy/nginx/dash-pr.conf` 安装为 `/etc/nginx/sites-available/dash-pr`，并更新
`sites-enabled/dash-pr`；切换前会在 `/opt/dash-pr/backups/nginx/` 留存旧文件。该 vhost 已内联
upstream 和 `/files` `auth_request` 规则，不要在同一 server 中重复 include `dash-pr-files.conf`。
目标机需要 Debian/Ubuntu 风格的 `sites-available`/`sites-enabled`、systemd、免密 sudo，且在首次
部署前已经为 `pr.dashedu.net` 配置可读的 Let's Encrypt 证书（`fullchain.pem` 与 `privkey.pem`）。
若 nginx 的其它文件仍声明 `server_name pr.dashedu.net`，请先停用旧 vhost；工作流会在写入前检测
重复声明并拒绝继续，避免公网请求落到旧的 `/files` 规则。

`ecosystem.config.js` 的 production app 必须显式设置 `NODE_ENV=production`、
`DASH_AUTH_DB=/opt/dash-pr/dash-auth.db`，并将 `cwd` 固定为 `/opt/dash-pr/current`
或 `/opt/dash-pr`；`interpreter` 必须显式指向 `/opt/node22/bin/node`（若实际安装路径
不同则与部署脚本探测到的 Node 22 路径保持一致）。发布脚本会拒绝不满足这些
条件的配置，避免误连 release 目录中的临时数据库。

全新 VPS 的第一次 GitHub Actions 部署会先将 release 放到
`/opt/dash-pr/current`，随后因数据库尚未初始化而有意停止；这一步让下面的
seed 命令有稳定的工作目录。执行 seed 后重新运行一次部署即可恢复正常的健康检查与滚动发布。

首次建库（在 VPS 上执行一次）：

```bash
cd /opt/dash-pr/current
umask 077
NODE_ENV=production BETTER_AUTH_SECRET=<与ecosystem一致> \
  BETTER_AUTH_URL=https://pr.dashedu.net \
  DASH_PUBLIC_ORIGIN=https://pr.dashedu.net \
  DASH_AUTH_DB=/opt/dash-pr/dash-auth.db \
  SEED_INITIAL_PASSWORD=<普通账号初始密码> \
  SEED_ADMIN_PASSWORD=<管理员初始密码> node scripts/seed.mjs
```

## 备注

- 目录型资源通过 `/api/browse/<路径>` 渲染文件清单页；文件统一经 `/api/file/<路径>` 流式输出并校验真实会话和上架状态。`/files/*` 在 standalone 中由 proxy 重写到该端点。生产 nginx 不得用 `root`/`try_files` 直出 `/files`；默认部署使用自包含的 `deploy/nginx/dash-pr.conf`。若采用组合式 nginx 配置，则在 `http {}` 引入 `deploy/nginx/dash-pr-upstream.conf`、在对应 `server {}` 引入 `deploy/nginx/dash-pr-files.conf`（其中 `auth_request` 会同时校验会话和 `resources.enabled`），并将 upstream 端口与 PM2 对齐。
- 健康检查：`GET /api/health/live` 仅检查进程响应；`GET /api/health/ready` 检查 SQLite、核心表、`public/assets`/`public/files` 资产卷可读，并对 `public/files` 做受控临时写入/删除探针。两者均返回 `Cache-Control: no-store`，ready 失败时返回 `503`，不暴露数据库路径或错误详情。
- `dash-auth.db` 含账号数据，已 gitignore，勿提交。
- 若数据库或其 WAL/SHM 文件曾进入 Git 历史，仅新增忽略规则不能撤回历史内容；应先轮换账号密码与 `BETTER_AUTH_SECRET`，再按仓库保密流程清理历史。
- 回滚：部署脚本会在新版本 live/ready 或 `/files` 探针失败时切回旧 release，并同时恢复 `backups/brand/<release-id>/` 中的旧 CORECOORD 静态与下载资源；资源迁移是前向兼容的，旧代码回滚前仍需按备份恢复数据库或确认旧版本兼容新 schema。若 PM2/nginx 回滚状态不明确，脚本会保留候选 release、品牌归档和 nginx 备份供人工恢复，不会删除可能仍被进程引用的目录。
- 备份目录需配置保留策略（例如仅保留最近 14 天并同步到独立对象存储），避免长期部署占满 VPS 磁盘。
- 品牌发布前会清理超过 60 分钟的 `.corecoord-stage.*`/`brand.*` 暂存目录，并按归档、解包和 staged copy 的峰值做磁盘预检；若 `/opt/dash-pr/public` 可用空间不足会在切换前中止。
- 当前本地存储覆盖写入使用进程内 object-key 锁，PM2 必须保持单实例 fork；扩容到多进程/多副本时应切换到带条件写入的对象存储驱动并把元数据迁移到 PostgreSQL。
- 部署 SSH 用户应与 PM2 ecosystem 的运行用户一致，并使用 Node 22（默认探测 `/opt/node22/bin/node`）；部署脚本会在切换软链前拒绝用户或 Node ABI 不匹配。
