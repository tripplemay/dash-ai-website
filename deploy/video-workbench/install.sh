#!/usr/bin/env bash
# Install only the loopback workbench; never alter nginx, PM2 or website data.
set -Eeuo pipefail
umask 077

INCOMING="${1:?incoming directory required}"
SHA="${2:?commit SHA required}"
RUN="${3:?run ID required}"
[[ "$INCOMING" =~ ^/opt/dash-pr/incoming/video-[a-f0-9]{40}-[0-9]+-[0-9]+$ ]]
[[ "$SHA" =~ ^[a-f0-9]{40}$ && "$RUN" =~ ^[0-9]+-[0-9]+$ ]]
[[ "$EUID" -eq 0 ]]
ROOT=/opt/dash-video
SERVICE=dash-video-workbench.service
UNIT=/etc/systemd/system/$SERVICE
RELEASE="$ROOT/releases/$SHA-$RUN"
BACKUP="$ROOT/backups/$SHA-$RUN"

for command in python3 ffmpeg ffprobe systemctl curl ss flock tar sha256sum; do
  command -v "$command" >/dev/null || { echo "Required server dependency missing: $command" >&2; exit 1; }
done
/usr/bin/python3 -c 'import sys; assert sys.version_info >= (3, 9), "Python >=3.9 required"'
if [[ -f "$UNIT" ]] && ! grep -Fq '# Managed by deploy/video-workbench/install.sh' "$UNIT"; then
  echo "Refusing to overwrite an unmanaged service" >&2
  exit 1
fi
[[ ! -L "$ROOT" && ! -L "$ROOT/projects" ]]
install -d -m 755 "$ROOT" "$ROOT/releases"
install -d -m 700 "$ROOT/backups"
exec 9>"$ROOT/deploy.lock"
flock -w 180 9
[[ ! -e "$RELEASE" && ! -e "$BACKUP" ]]
(cd "$INCOMING" && sha256sum --check bundle.sha256)
python3 - "$INCOMING/workbench.tar.gz" <<'PY'
import sys, tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1]) as archive:
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
            raise SystemExit('Refusing unsafe archive member')
PY
if ! id dash-video >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$ROOT" --no-create-home --shell /usr/sbin/nologin dash-video
fi
[[ "$(id -u dash-video)" != 0 ]]
install -d -m 700 -o dash-video -g dash-video "$ROOT/projects"
install -d -m 700 "$BACKUP"
PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$ROOT/current" ]]; then
  [[ "$PREVIOUS" == "$ROOT/releases/"* && -d "$PREVIOUS" ]]
else
  PREVIOUS=""
  [[ ! -e "$ROOT/current" ]]
fi
WAS_ACTIVE=0
WAS_ENABLED=0
systemctl is-active --quiet "$SERVICE" && WAS_ACTIVE=1
systemctl is-enabled --quiet "$SERVICE" 2>/dev/null && WAS_ENABLED=1
[[ ! -f "$UNIT" ]] || cp -p "$UNIT" "$BACKUP/service.previous"
printf '%s\n' "$PREVIOUS" > "$BACKUP/previous-release"
rollback() {
  code=${1:-$?}
  trap - ERR HUP INT TERM
  echo "Workbench deployment failed; restoring previous service" >&2
  systemctl stop "$SERVICE" 2>/dev/null || true
  if (( ! WAS_ENABLED )); then systemctl disable "$SERVICE" 2>/dev/null || true; fi
  if [[ -n "$PREVIOUS" ]]; then
    ln -sfn "$PREVIOUS" "$ROOT/current.rollback"
    mv -Tf "$ROOT/current.rollback" "$ROOT/current"
  elif [[ -L "$ROOT/current" ]]; then
    unlink "$ROOT/current"
  fi
  if [[ -f "$BACKUP/service.previous" ]]; then
    cp -p "$BACKUP/service.previous" "$UNIT"
  else
    rm -f "$UNIT"
  fi
  systemctl daemon-reload || true
  if (( WAS_ENABLED )); then systemctl enable "$SERVICE" || true; else systemctl disable "$SERVICE" 2>/dev/null || true; fi
  if (( WAS_ACTIVE )); then systemctl start "$SERVICE" || true; fi
  echo "Rollback attempted; backup retained: $BACKUP" >&2
  exit "$code"
}
trap rollback ERR
trap 'rollback 129' HUP
trap 'rollback 130' INT
trap 'rollback 143' TERM
if (( WAS_ACTIVE )); then systemctl stop "$SERVICE"; fi
[[ -z "$(ss -H -ltn 'sport = :18877')" ]] || { echo "Port 18877 belongs to another process" >&2; false; }

# Snapshot only this service's SQLite ledgers. Media is immutable and not modified.
python3 - "$ROOT/projects" "$BACKUP" <<'PY'
import contextlib, json, sqlite3, sys
from pathlib import Path
root, backup = map(Path, sys.argv[1:])
rows = []
for source in sorted(root.glob('*/.video-production/state.sqlite')):
    if not source.resolve().is_relative_to(root.resolve()):
        raise SystemExit('Database path escapes workbench workspace')
    destination = backup / (source.parent.parent.name + '.sqlite')
    with contextlib.closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src:
        if src.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise SystemExit('Existing ledger integrity check failed')
        with contextlib.closing(sqlite3.connect(destination)) as dst:
            src.backup(dst)
            if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise SystemExit('Backup integrity check failed')
    rows.append(source.parent.parent.name)
(backup / 'backup.json').write_text(json.dumps({'projects': rows, 'schema_migration': False}))
print('Workbench ledger backups verified:', len(rows))
PY
install -d -m 755 "$RELEASE"
tar --no-same-owner -xzf "$INCOMING/workbench.tar.gz" -C "$RELEASE"
printf 'VIDEO_WORKBENCH_RELEASE=%s\n' "$SHA" > "$RELEASE/service.env"
chmod -R u=rwX,go=rX "$RELEASE"
runuser -u dash-video -- /usr/bin/python3 -m unittest discover -s "$RELEASE/tests" -v
install -m 644 "$INCOMING/dash-video-workbench.service" "$UNIT"
systemd-analyze verify "$UNIT"
ln -sfn "$RELEASE" "$ROOT/current.new"
mv -Tf "$ROOT/current.new" "$ROOT/current"
systemctl daemon-reload
systemctl enable --now "$SERVICE"
for _ in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:18877/api/health > "$BACKUP/health.json"; then break; fi
  sleep 1
done
systemctl is-active --quiet "$SERVICE"
python3 - "$BACKUP/health.json" "$SHA" <<'PY'
import json, sys
from pathlib import Path
h = json.loads(Path(sys.argv[1]).read_text())
assert h['status'] == 'ok' and h['workspace_writable']
assert h['release'] == sys.argv[2] and h['bind'] == '127.0.0.1' and h['port'] == 18877
print(json.dumps(h))
PY
ss -H -ltn 'sport = :18877' | awk 'BEGIN { found=0; bad=0 } { found++; if ($4 != "127.0.0.1:18877") bad=1 } END { exit (!found || bad) }'
[[ "$(systemctl show -p User --value "$SERVICE")" == dash-video ]]
[[ "$(stat -c '%U:%a' "$ROOT/projects")" == dash-video:700 ]]
trap - ERR HUP INT TERM
echo "Workbench deployed: $SHA"
echo "Release: $RELEASE"
echo "Backup: $BACKUP"
echo "Listening only on 127.0.0.1:18877; no nginx or website changes"
