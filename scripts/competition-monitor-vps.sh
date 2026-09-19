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

command -v flock >/dev/null || { echo "缺少 flock，请安装 util-linux。" >&2; exit 1; }
exec 9>"$BASE/monitor.lock"
flock -n 9 || { echo "监测已在运行，跳过重叠任务。"; exit 0; }

cd "$REPO"
commit_content() {
  # Recover interrupted content writes without staging unrelated files or discarding an outbox.
  local changed
  while IFS= read -r changed; do
    case "$changed" in
      scripts/competitions/content/*.json|scripts/competitions-content.json) ;;
      "") ;;
      *) echo "存在非监测改动，保留现场并停止：$changed" >&2; return 1 ;;
    esac
  done < <(git diff --name-only HEAD)
  if git diff --quiet HEAD -- scripts/competitions/content/ scripts/competitions-content.json; then
    return 0
  fi
  node scripts/competition-merge.mjs
  node scripts/validate-competitions.mjs
  git add scripts/competitions/content/ scripts/competitions-content.json
  git -c user.name="${GIT_AUTHOR_NAME:-dash-competition-bot}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-competition-bot@dashedu.net}" \
      commit --quiet -m "chore(competitions): publish validated competition updates"
}

push_pending() {
  if [[ "$(git rev-list --count origin/main..HEAD)" -eq 0 ]]; then return 0; fi
  if git push origin HEAD:main; then
    echo "已推送待发布提交，CI 将自动部署。"
  else
    local message="赛事监测：git push 失败，提交已保留，下次运行将优先重试。"
    echo "$message" >&2
    if [[ -n "${DASH_MONITOR_WEBHOOK_URL:-}" ]]; then
      curl -fsS -m 10 -X POST "$DASH_MONITOR_WEBHOOK_URL" \
        -H 'content-type: application/json' \
        -d "{\"text\":\"$message\",\"events\":[{\"type\":\"git-push-failed\",\"message\":\"$message\"}]}" || true
    fi
    return 1
  fi
}

commit_content
git fetch origin main --quiet
if ! git merge --ff-only origin/main --quiet 2>/dev/null; then
  if ! git -c user.name="dash-competition-bot" -c user.email="competition-bot@dashedu.net" rebase origin/main --quiet; then
    git rebase --abort 2>/dev/null || true
    echo "本地提交与远端冲突，已保留待发布数据，请人工处理。" >&2
    exit 1
  fi
fi
push_pending

node scripts/competition-monitor.mjs --write-updates
commit_content
push_pending

echo "=== $(date '+%F %T') 监测结束 ==="
