#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/server"

if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile || pnpm install
  exec pnpm start
elif command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  exec npm start
else
  echo "Neither pnpm nor npm found in PATH" >&2
  exit 1
fi
