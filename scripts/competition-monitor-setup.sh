#!/usr/bin/env bash
# 赛事自动监测 VPS 一次性初始化（幂等，可重复执行）。
#
# 用法：
#   部署用户执行：  bash scripts/competition-monitor-setup.sh
#   Chromium 安装（需 root）： sudo bash scripts/competition-monitor-setup.sh --chromium-only
#
# 准备事项（一次性，人工）：
#   1. 在 GitHub 仓库 Settings → Deploy keys 添加一个勾选 Allow write access 的密钥，
#      公钥对应 VPS 上部署用户的 ~/.ssh/competition_monitor_deploy（ssh-keygen 生成）；
#   2. ~/.ssh/config 增加： Host github.com-monitor\n        HostName github.com\n        IdentityFile ~/.ssh/competition_monitor_deploy
#   3. （可选）把告警 webhook 写入 /opt/dash-pr/competition-monitor/monitor.env：
#        DASH_MONITOR_WEBHOOK_URL=https://...

set -euo pipefail

BASE="${DASH_MONITOR_HOME:-/opt/dash-pr/competition-monitor}"
REPO_URL="${MONITOR_REPO_URL:-git@github.com-monitor:tripplemay/dash-ai-website.git}"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/node22/bin}"
export PATH="$NODE_BIN_DIR:$PATH"

if [[ "${1:-}" == "--chromium-only" ]]; then
  echo "安装 Chromium（渲染 SPA 站点所需）…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y chromium
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y chromium
  elif command -v yum >/dev/null 2>&1; then
    yum install -y chromium
  else
    echo "未识别的包管理器，请手动安装 Chromium 后在 monitor.env 配置 CHROMIUM_PATH。" >&2
    exit 1
  fi
  echo "Chromium 安装完成：$(command -v chromium || true)"
  exit 0
fi

echo "== 1/5 建目录 =="
mkdir -p "$BASE"/{state,reports}

echo "== 2/5 仓库 clone =="
if [[ -d "$BASE/repo/.git" ]]; then
  git -C "$BASE/repo" fetch origin main --quiet && git -C "$BASE/repo" reset --hard origin/main --quiet
  echo "repo 已存在，已同步到 origin/main。"
else
  git clone --depth 50 "$REPO_URL" "$BASE/repo"
fi

echo "== 3/5 安装 monitor 依赖（装进仓库 node_modules，--no-save 不碰清单）=="
npm install --prefix "$BASE/repo" --no-save --ignore-scripts --no-audit --no-fund cheerio playwright-core

echo "== 4/5 检测 Chromium =="
CHROMIUM_BIN=""
for candidate in "${CHROMIUM_PATH:-}" /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
  [[ -n "$candidate" && -x "$candidate" ]] && CHROMIUM_BIN="$candidate" && break
done
if [[ -n "$CHROMIUM_BIN" ]]; then
  echo "Chromium 可用：$CHROMIUM_BIN"
else
  echo "未找到 Chromium。SPA 站点（约 21 个）将无法自动渲染抓取。"
  echo "请用 root 执行：sudo bash $BASE/repo/scripts/competition-monitor-setup.sh --chromium-only"
fi

echo "== 5/5 写 monitor.env 与 cron =="
if [[ ! -f "$BASE/monitor.env" ]]; then
  cat > "$BASE/monitor.env" <<EOF
# 赛事监测环境变量
# 告警 webhook（可选）：Server酱/企业微信/任意接受 JSON POST 的地址
# DASH_MONITOR_WEBHOOK_URL=
${CHROMIUM_BIN:+CHROMIUM_PATH=$CHROMIUM_BIN}
EOF
  chmod 600 "$BASE/monitor.env"
fi

CRON_LINE="17 8,20 * * * $BASE/repo/scripts/competition-monitor-vps.sh >> $BASE/cron.log 2>&1"
if crontab -l 2>/dev/null | grep -qF "competition-monitor-vps.sh"; then
  echo "cron 已存在，跳过。"
else
  (crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
  echo "cron 已写入：$CRON_LINE"
fi

chmod +x "$BASE/repo/scripts/competition-monitor-vps.sh" || true

echo
echo "初始化完成。手动试跑一次："
echo "  bash $BASE/repo/scripts/competition-monitor-vps.sh"
