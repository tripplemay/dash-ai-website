#!/usr/bin/env bash
# 备赛资料采集 cron 入口（VPS）：拉取最新 main → 采集（三层降级抓取 + 下载守护）→
# 新资料写回分片 → 合并+校验 → commit & push（触发 GitHub Actions 现有部署管线自动上线）。
#
# 由 cron 调用，例如（每日 09:47 / 21:47，与动态监测错峰）：
#   47 9,21 * * * /opt/dash-pr/competition-monitor/repo/scripts/paper-collector-vps.sh >> /opt/dash-pr/competition-monitor/papers-cron.log 2>&1
#
# 目录约定（由 competition-monitor-setup.sh 建立）：
#   /opt/dash-pr/competition-monitor/
#     repo/         本仓库的 clone（用带写权限的 Deploy Key）
#     paper-state/  采集状态（跨运行持久，勿放 repo 内）
#     paper-reports/ 每次运行的采集报告
#     monitor.env   可选环境变量（CHROMIUM_PATH 等）

set -euo pipefail

BASE="${DASH_MONITOR_HOME:-/opt/dash-pr/competition-monitor}"
REPO="$BASE/repo"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/node22/bin}"

export PATH="$NODE_BIN_DIR:$PATH"
export DASH_PAPER_STATE_DIR="${DASH_PAPER_STATE_DIR:-$BASE/paper-state}"
export DASH_PAPER_OUTPUT_DIR="${DASH_PAPER_OUTPUT_DIR:-$BASE/paper-reports}"
# 文件落盘到站点公共卷：fileKey files/papers/... 相对此目录，nginx /files/ 直出
export DASH_PAPER_PUBLIC_DIR="${DASH_PAPER_PUBLIC_DIR:-/opt/dash-pr/public}"

if [[ -f "$BASE/monitor.env" ]]; then
  set -a; source "$BASE/monitor.env"; set +a
fi

echo "=== $(date '+%F %T') 备赛资料采集开始 ==="

cd "$REPO"
git fetch origin main --quiet
if git diff --quiet && git diff --cached --quiet; then
  if ! git merge --ff-only origin/main --quiet 2>/dev/null; then
    if ! git rebase origin/main --quiet 2>/dev/null; then
      git rebase --abort 2>/dev/null || true
      echo "警告：本地提交与远端冲突，重置到 origin/main（未推送的更新将由本次重采重新生成）" >&2
      git reset --hard origin/main --quiet
    fi
  fi
else
  echo "警告：工作区有残留改动，重置到 origin/main" >&2
  git reset --hard origin/main --quiet
fi

node scripts/paper-collector.mjs --write

# 有分片变更才走合并+提交
if git diff --quiet -- scripts/competitions/papers/ ; then
  echo "无新增资料，不触发部署。"
  echo "=== $(date '+%F %T') 采集结束（无变更）==="
  exit 0
fi

node scripts/paper-merge.mjs
node scripts/validate-papers.mjs

count="$(git diff --numstat -- scripts/competitions/papers/ scripts/papers-content.json | awk '{a+=$1} END {print a+0}')"
git add scripts/competitions/papers/ scripts/papers-content.json
git -c user.name="${GIT_AUTHOR_NAME:-dash-competition-bot}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-competition-bot@dashedu.net}" \
    commit --quiet -m "chore(papers): 自动采集写入 ${count} 行备赛资料更新"

if git push origin main; then
  echo "已推送 main，CI 将自动部署。"
else
  message="备赛资料采集：更新已写入但 git push 失败，下次运行将重试。"
  echo "$message" >&2
  if [[ -n "${DASH_MONITOR_WEBHOOK_URL:-}" ]]; then
    curl -fsS -m 10 -X POST "$DASH_MONITOR_WEBHOOK_URL" \
      -H 'content-type: application/json' \
      -d "{\"text\":\"$message\",\"events\":[{\"type\":\"git-push-failed\",\"message\":\"$message\"}]}" || true
  fi
  exit 1
fi

echo "=== $(date '+%F %T') 采集结束（已提交）==="
