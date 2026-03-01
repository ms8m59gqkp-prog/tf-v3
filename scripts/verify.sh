#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WEB="$ROOT/apps/web"

cd "$WEB"

echo "== (1) Typecheck =="
pnpm -s tsc --noEmit

echo "== (2) ESLint =="
pnpm -s eslint . --max-warnings 0

echo "== (3) Tests =="
pnpm -s vitest run --passWithNoTests

echo "== (4) Build =="
pnpm -s next build

cd "$ROOT"
echo "== (5) Grep Guards =="
bash scripts/grep-guards.sh

echo "✅ verify: all checks passed"
