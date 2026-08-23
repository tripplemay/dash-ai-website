# DASH AI 实验室 · 营销资源中心

Next.js 全栈工程，为 DASH AI 少儿 AI 素养课程的合作伙伴提供营销资源下载、课程介绍与大屏播放。

> 本仓库仅含代码。营销资源文件（海报、课件模板、品牌资产等约 183MB）为内部资产，不随仓库公开，部署时单独分发。

## 技术栈

- Next.js 16（App Router，`output: 'standalone'`）+ TypeScript strict + Tailwind CSS v4 + pnpm
- shadcn/ui + Aceternity UI（`src/components/aceternity/`）
- next-intl 中英双语：`[locale]` 路由段，`zh` 默认，`en` 预留
- better-auth + better-sqlite3：username + password 登录，会话 cookie 守卫

## 本地开发

```bash
pnpm install
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
├── public/              # 不进 git：assets/ files/ brand/（部署时单独分发）
├── scripts/{migrate,migrate-auth,seed,backup-db,dedupe-resources,check-db}.mjs # Better Auth/资源迁移、播种、备份与校验
├── deploy/nginx/{dash-pr-upstream,dash-pr-files}.conf # /files 受保护反代模板（禁止 nginx 直出）
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

推送 `main` 分支即自动部署。工作流：安装依赖 → 使用 runner 临时目录中的隔离 SQLite 路径执行 `pnpm build` → 打包 standalone、seed 运行时依赖和 `.next/static` → 对打包后的 seed/server 做 smoke 与数据库/资产断言 → 在切换软链前备份并迁移 VPS 数据库 → scp/解压为新 release → 校验 native runtime ABI → 切换 `current` → `pm2 startOrReload`。构建期占位 `BETTER_AUTH_SECRET` 不参与运行时。

需要在仓库 Settings → Secrets 中配置：

| Secret           | 说明                     |
| ---------------- | ------------------------ |
| `DEPLOY_SSH_KEY` | VPS 部署私钥             |
| `DEPLOY_HOST`    | VPS 地址                 |
| `DEPLOY_USER`    | SSH 用户                 |
| `DEPLOY_KNOWN_HOSTS` | 固定的 VPS `known_hosts` 行，发布启用严格主机密钥校验 |
| `DASH_HEALTH_URL` | 必填的部署后公网 HTTPS origin，例如 `https://pr.dashedu.net` |

### VPS 侧一次性初始化（已固化在服务器，无需重复）

```
/opt/dash-pr/
├── releases/<时间戳>/   # 每次部署一个目录，自动保留最近 5 个
├── current -> releases/…  # 软链切换即发布/回滚
├── public/            # 静态资产卷（/assets、/brand 可直出；/files 必须禁止 nginx 直出）
├── dash-auth.db       # 账号库（持久化，不随发布变更）
└── ecosystem.config.js# pm2 配置（含生产环境变量，仅存在于服务器，chmod 600）
```

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

- 目录型资源通过 `/api/browse/<路径>` 渲染文件清单页；文件统一经 `/api/file/<路径>` 流式输出并校验真实会话和上架状态。`/files/*` 在 standalone 中由 proxy 重写到该端点。生产 nginx 不得用 `root`/`try_files` 直出 `/files`；请在 `http {}` 引入 `deploy/nginx/dash-pr-upstream.conf`、在对应 `server {}` 引入 `deploy/nginx/dash-pr-files.conf`（其中 `auth_request` 会同时校验会话和 `resources.enabled`），并将 upstream 端口与 PM2 对齐，或完全移除 `/files` 直出规则。
- 健康检查：`GET /api/health/live` 仅检查进程响应；`GET /api/health/ready` 检查 SQLite、核心表、`public/assets`/`public/files` 资产卷可读，并对 `public/files` 做受控临时写入/删除探针。两者均返回 `Cache-Control: no-store`，ready 失败时返回 `503`，不暴露数据库路径或错误详情。
- `dash-auth.db` 含账号数据，已 gitignore，勿提交。
- 若数据库或其 WAL/SHM 文件曾进入 Git 历史，仅新增忽略规则不能撤回历史内容；应先轮换账号密码与 `BETTER_AUTH_SECRET`，再按仓库保密流程清理历史。
- 回滚：部署脚本会在新版本 live/ready 或 `/files` 探针失败时切回旧 release，并再次验证旧版本健康；资源迁移是前向兼容的，旧代码回滚前仍需按备份恢复数据库或确认旧版本兼容新 schema。
- 备份目录需配置保留策略（例如仅保留最近 14 天并同步到独立对象存储），避免长期部署占满 VPS 磁盘。
- 当前本地存储覆盖写入使用进程内 object-key 锁，PM2 必须保持单实例 fork；扩容到多进程/多副本时应切换到带条件写入的对象存储驱动并把元数据迁移到 PostgreSQL。
- 部署 SSH 用户应与 PM2 ecosystem 的运行用户一致，并使用 Node 22（默认探测 `/opt/node22/bin/node`）；部署脚本会在切换软链前拒绝用户或 Node ABI 不匹配。
