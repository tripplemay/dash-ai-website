# 赛事冒烟登录限流修复

日期：2026-09-19。用户已批准最小修复、补测、提交推送及继续部署；生产限流保持不变。

## 原因

- 首次发布提交 `cc65ca513ba212dbf3608e29f1345752609074eb` 的 CI `35450872736` 在 Package standalone 阶段失败，Deploy to VPS 未执行。
- standalone、校园屏、赛事三组冒烟共执行 4 次登录，时间集中在 10 秒内。安装的 Better Auth 对登录路径默认限制为每个来源 10 秒 3 次，第四次（赛事 partner 登录）返回 429。
- 本地此前只单独执行赛事冒烟，未触发跨套件累计限流。生产当时仍为 `release.ncd851sc`，ready 正常。

## 最小修复

- 仅调整赛事冒烟登录流程及其测试，不修改 `src/lib/auth.ts`、生产限流或 CI 安全门禁。
- 仅对 429 重试，最多重试 2 次（总计 3 次请求）；兼容标准 Retry-After 秒数/HTTP 日期及 Better Auth 的 X-Retry-After。
- 缺失或无效提示使用 10 秒默认窗口，额外等待 250ms 避免边界竞争；服务端提示超过 30 秒直接失败，不无限等待、不提前重试。
- 单次登录请求 15 秒超时。401/403、其他错误、网络故障均不重试；持续 429 仍由原有状态断言判为失败。
- 冒烟入口原有 localhost 限制保留；未向生产发送登录请求。

## 补测

- `pnpm competitions:test`：44/44 通过（新增 9 项限流重试测试）。
- 修改文件 ESLint 与 `node --check` 通过。
- 在既有隔离 SQLite 测试账号和本地 production standalone 上，先连续登录触发真实 429 / X-Retry-After: 10，再立即执行完整赛事冒烟。
- 实测等待 10250ms 后成功，28 项 HTTP 状态检查及账号隔离、关注持久化、提醒 opt-in、ICS 断言通过，总用时 10669ms。
- 证据：`rate-limit-smoke.log`、`rate-limit-tests.log`。

部署结果另记于 `DEPLOYMENT.md`；本文件记录提交前的修复验收，不代表生产业务登录验收。
