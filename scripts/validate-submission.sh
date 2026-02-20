#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOYMENT_FILE="$ROOT_DIR/deployment.txt"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

[ -f "$DEPLOYMENT_FILE" ] || fail "deployment.txt not found at repo root."

frontend_line="$(grep -E '^Frontend URL:' "$DEPLOYMENT_FILE" || true)"
[ -n "$frontend_line" ] || fail "deployment.txt must contain 'Frontend URL: ...'."

frontend_url="${frontend_line#Frontend URL: }"
frontend_url="$(echo "$frontend_url" | xargs)"

[ -n "$frontend_url" ] || fail "Frontend URL cannot be empty."

if [[ "$frontend_url" == "<replace-before-submission>" ]]; then
  fail "Frontend URL placeholder is still present."
fi

if [[ ! "$frontend_url" =~ ^https?://[^[:space:]]+$ ]]; then
  fail "Frontend URL must be a valid http/https URL."
fi

echo "OK: deployment.txt passed validation."
