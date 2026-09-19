#!/usr/bin/env bash
# 赛事监测 cron 入口（VPS）：拉取最新 main → 三层抓取监测 → 新动态写回分片 →
# 合并+校验 → commit & push（触发 GitHub Actions 现有部署管线自动上线）。
#
# 由 cron 调用，例如（每日 08:17 / 20:17）：
#   17 8,20 * * * /opt/dash-pr/competition-monitor/repo/scripts/competition-monitor-vps.sh >> /opt/dash-pr/competition-monitor/cron.log 2>&1
#
# 目录约定（由 competition-monitor-setup.sh 建立）：
#   /opt/dash-pr/competition-monitor/
#     repo/     本仓库的 clone（用带写权限的 Deploy Key；monitor 依赖装在 repo/node_modules）
#     state/    监测快照（跨运行持久，勿放 repo 内）
#     reports/  每次运行的报告
#     monitor.env  可选环境变量（DASH_MONITOR_WEBHOOK_URL、CHROMIUM_PATH 等）

set -euo pipefail

BASE="${DASH_MONITOR_HOME:-/opt/dash-pr/competition-monitor}"
REPO="$BASE/repo"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/node22/bin}"

export PATH="$NODE_BIN_DIR:$PATH"
export DASH_MONITOR_STATE_DIR="$BASE/state"
export DASH_MONITOR_OUTPUT_DIR="$BASE/reports"

if [[ -f "$BASE/monitor.env" ]]; then
  set -a; source "$BASE/monitor.env"; set +a
fi

echo "=== $(date '+%F %T') 赛事监测开始 ==="

cd "$REPO"
git fetch origin main --quiet
# 上次可能已 commit 但 push 失败：优先 ff，其次 rebase 保留本地提交，冲突才重置（并重爬生成）
if git diff --quiet && git diff --cached --quiet; then
  if ! git merge --ff-only origin/main --quiet 2>/dev/null; then
    if ! git rebase origin/main --quiet 2>/dev/null; then
      git rebase --abort 2>/dev/null || true
      echo "警告：本地提交与远端冲突，重置到 origin/main（未推送的更新将由本次重爬重新生成）" >&2
      git reset --hard origin/main --quiet
    fi
  fi
else
  echo "警告：工作区有残留改动，重置到 origin/main" >&2
  git reset --hard origin/main --quiet
fi

node scripts/competition-monitor.mjs --write-updates

# 有分片变更才走合并+提交
if git diff --quiet -- scripts/competitions/ ; then
  echo "无新增动态，不触发部署。"
  echo "=== $(date '+%F %T') 监测结束（无变更）==="
  exit 0
fi

node scripts/competition-merge.mjs
node scripts/validate-competitions.mjs

count="$(git diff --numstat -- scripts/competitions/ scripts/competitions-content.json | awk '{a+=$1} END {print a+0}')"
git add scripts/competitions/ scripts/competitions-content.json
git -c user.name="${GIT_AUTHOR_NAME:-dash-competition-bot}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-competition-bot@dashedu.net}" \
    commit --quiet -m "chore(competitions): 自动监测写入 ${count} 行赛事动态更新"

if git push origin main; then
  echo "已推送 main，CI 将自动部署。"
else
  message="赛事监测：更新已写入但 git push 失败，下次运行将重试。"
  echo "$message" >&2
  if [[ -n "${DASH_MONITOR_WEBHOOK_URL:-}" ]]; then
    curl -fsS -m 10 -X POST "$DASH_MONITOR_WEBHOOK_URL" \
      -H 'content-type: application/json' \
      -d "{\"text\":\"$message\",\"events\":[{\"type\":\"git-push-failed\",\"message\":\"$message\"}]}" || true
  fi
  exit 1
fi

echo "=== $(date '+%F %T') 监测结束（已提交）==="
