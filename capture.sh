#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${CAPTURE_URL:-}" ]]; then
  echo "CAPTURE_URL is required." >&2
  exit 1
fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then
  echo "CAPTURE_DIR is required." >&2
  exit 1
fi

mkdir -p "$CAPTURE_DIR"
echo "[capture] url=$CAPTURE_URL"
echo "[capture] output=$CAPTURE_DIR"

if /usr/bin/time -p node scripts/capture.mjs; then
  exit 0
else
  exit $?
fi
