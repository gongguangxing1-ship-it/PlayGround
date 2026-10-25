#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
PORT="${PORT:-3000}"
export PORT
export PROJECT_DIR
WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
export WEB_DIR
mkdir -p "$WEB_DIR"

echo "[start] project=$PROJECT_DIR"
echo "[start] port=$PORT"
echo "[start] metadata=$WEB_DIR"

INSTALL_STAMP="node_modules/.neon-rush-install"
if [[ ! -x node_modules/.bin/vite || ! -f "$INSTALL_STAMP" || package-lock.json -nt "$INSTALL_STAMP" || package.json -nt "$INSTALL_STAMP" ]]; then
  if [[ -f package-lock.json ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
  touch "$INSTALL_STAMP"
else
  echo "[start] dependencies already present"
fi

/usr/bin/time -p npm run build
/usr/bin/time -p node scripts/write-deployment.mjs

echo "[start] serving dist on 0.0.0.0:$PORT"
exec /usr/bin/time -p node server.mjs
