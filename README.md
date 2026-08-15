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
BETTER_AUTH_SECRET=dev-secret SEED_INITIAL_PASSWORD=<本地演示密码> pnpm seed   # 建表 + 写入三个初始账号
pnpm dev
```

访问 `http://localhost:3000/` 跳转到 `/zh`，未登录重定向 `/zh/login`。
初始账号：`partner` / `teacher` / `guest`，密码为 seed 时传入的 `SEED_INITIAL_PASSWORD`。

### 环境变量

| 变量                    | 说明                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | 会话密钥，生产必须设置（缺失时生产构建/运行会拒绝启动）          |
| `BETTER_AUTH_URL`       | 站点对外 base URL，如 `https://pr.dashedu.net`                  |
| `DASH_AUTH_DB`          | SQLite 文件路径，默认 `./dash-auth.db`                          |
| `SEED_INITIAL_PASSWORD` | 仅 seed 脚本使用：三个初始账号的初始密码（≥8 位）               |
| `DASH_AUTH_DISABLED`    | `=1` 且 `NODE_ENV=development` 时跳过登录守卫（本地预览用）      |

## 目录结构

```
├── messages/            # zh.json / en.json 文案
├── public/              # 不进 git：assets/ files/ brand/（部署时单独分发）
├── scripts/seed.mjs     # 建表 + 初始账号（密码来自 SEED_INITIAL_PASSWORD）
├── src/
│   ├── proxy.ts         # locale 路由 + 登录守卫
│   ├── i18n/ lib/ components/
│   └── app/
│       ├── api/auth/[...all]/    # better-auth 处理器
│       ├── api/browse/[...path]/ # public 目录浏览清单
│       └── [locale]/ (public)/login · (app)/{page,course,resources,player} · (admin)/
└── .github/workflows/deploy.yml  # 推送 main 自动构建并部署到 VPS
```

## CI/CD（GitHub Actions → VPS）

推送 `main` 分支即自动部署。工作流：安装依赖 → `pnpm build`（构建期使用占位 `BETTER_AUTH_SECRET`，不参与运行时）→ 打包 standalone + `.next/static` + `scripts/` → scp 到 VPS → 解压为新 release → 切换 `current` 软链 → `pm2 startOrReload`。

需要在仓库 Settings → Secrets 中配置：

| Secret           | 说明                     |
| ---------------- | ------------------------ |
| `DEPLOY_SSH_KEY` | VPS 部署私钥             |
| `DEPLOY_HOST`    | VPS 地址                 |
| `DEPLOY_USER`    | SSH 用户                 |

### VPS 侧一次性初始化（已固化在服务器，无需重复）

```
/opt/dash-pr/
├── releases/<时间戳>/   # 每次部署一个目录，自动保留最近 5 个
├── current -> releases/…  # 软链切换即发布/回滚
├── public/            # 静态资产（rsync 单独分发，nginx 直接伺服 /assets /files /brand）
├── dash-auth.db       # 账号库（持久化，不随发布变更）
└── ecosystem.config.js# pm2 配置（含生产环境变量，仅存在于服务器，chmod 600）
```

首次建库（在 VPS 上执行一次）：

```bash
cd /opt/dash-pr/current
NODE_ENV=production BETTER_AUTH_SECRET=<与ecosystem一致> \
  DASH_AUTH_DB=/opt/dash-pr/dash-auth.db \
  SEED_INITIAL_PASSWORD=<强随机密码> node scripts/seed.mjs
```

## 备注

- 目录型资源通过 `/api/browse/<路径>` 渲染文件清单页；单文件由 nginx 从 `/files/...` 直出。
- `dash-auth.db` 含账号数据，已 gitignore，勿提交。
- 回滚：将 `/opt/dash-pr/current` 软链指回旧 release 后 `pm2 reload dash-pr`。
