#!/usr/bin/env bash
# Synthetic journey marketing captures at the current checkout (no Supabase).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-/opt/cursor/artifacts/marketing-journey-output}"
EVIDENCE="$ROOT/docs/evidence/marketing-product-screenshots-2026-11-15"
mkdir -p "$EVIDENCE"
rm -rf "$OUT"
node "$ROOT/e2e/local-phase1/build-brief-price.mjs" "$OUT" journey
export CONSTRUCTA_LOCAL_PHASE1_OUTPUT="$OUT"
node "$ROOT/node_modules/@playwright/test/cli.js" test --config="$ROOT/playwright.local-marketing-captures.config.ts"
echo "Wrote captures under $EVIDENCE"