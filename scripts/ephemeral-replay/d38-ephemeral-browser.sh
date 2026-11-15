#!/usr/bin/env bash
# D38 CON-001 / CON-002: ephemeral Supabase replay + Playwright browser test.
# Requires Docker and Node. Does not use hosted QA secrets or production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ephemeral-replay/guards.sh
source "$ROOT/scripts/ephemeral-replay/guards.sh"

SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.39.3}"
export E2E_D38_BACKEND=ephemeral
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:3100}"
export E2E_STUB_URL="${E2E_STUB_URL:-http://127.0.0.1:3199}"
export E2E_D38_AUTH="${E2E_D38_AUTH:-seed}"

if ! command -v docker >/dev/null 2>&1; then
  echo "BLOCKER: docker is not available on this machine; ephemeral browser replay cannot run locally."
  echo "Use CI workflow d38-con-browser-replay.yml or install Docker."
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "BLOCKER: docker daemon is not reachable."
  exit 2
fi

echo "Starting local Supabase stack (CLI ${SUPABASE_CLI_VERSION})…"
npx --yes "supabase@${SUPABASE_CLI_VERSION}" start -x studio,imgproxy,vector,logflare,edge-runtime

echo "Applying migrations (db reset)…"
npx --yes "supabase@${SUPABASE_CLI_VERSION}" db reset --yes

# shellcheck disable=SC2046
eval "$(npx --yes "supabase@${SUPABASE_CLI_VERSION}" status -o env | sed -n 's/^\([A-Z_]*\)=\(.*\)$/export \1=\2/p')"

export NEXT_PUBLIC_SUPABASE_URL="${API_URL:?API_URL missing from supabase status}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY:?ANON_KEY missing}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY missing}"
export E2E_SUPABASE_PROJECT_REF="${PROJECT_ID:-ephemeralreplay00001}"
export CONSTRUCTA_DEPLOY_CONTEXT=e2e-replay
export CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF="$E2E_SUPABASE_PROJECT_REF"

guard_no_production_urls "$NEXT_PUBLIC_SUPABASE_URL"
guard_loopback_supabase_url "$NEXT_PUBLIC_SUPABASE_URL"
guard_ephemeral_project_ref "$E2E_SUPABASE_PROJECT_REF"

if [[ "$E2E_D38_AUTH" == "seed" ]]; then
  node scripts/ephemeral-replay/seed-disposable-auth.mjs
fi

echo "Running Playwright D38 ephemeral replay…"
npm run e2e:d38-ephemeral-replay