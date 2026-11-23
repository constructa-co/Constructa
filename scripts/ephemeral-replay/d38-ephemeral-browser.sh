#!/usr/bin/env bash
# D38 CON-001 / CON-002: ephemeral Supabase replay + Playwright browser test.
# Requires Docker and Node. Does not use hosted QA secrets or production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ephemeral-replay/guards.sh
source "$ROOT/scripts/ephemeral-replay/guards.sh"
# shellcheck source=scripts/ephemeral-replay/parse-supabase-status-env.sh
source "$ROOT/scripts/ephemeral-replay/parse-supabase-status-env.sh"

SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.39.3}"
SUPABASE_CLI=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")

export E2E_D38_BACKEND=ephemeral
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:3100}"
export E2E_STUB_URL="${E2E_STUB_URL:-http://127.0.0.1:3199}"
export E2E_D38_AUTH="${E2E_D38_AUTH:-seed}"

export CONSTRUCTA_DEPLOY_CONTEXT=e2e-replay
guard_ephemeral_test_context_only "$CONSTRUCTA_DEPLOY_CONTEXT" || exit 1

if ! command -v docker >/dev/null 2>&1; then
  echo "BLOCKER: docker is not available on this machine; ephemeral browser replay cannot run locally."
  echo "Use CI workflow d38-con-browser-replay.yml or install Docker."
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "BLOCKER: docker daemon is not reachable."
  exit 2
fi

guard_no_remote_supabase_link "$ROOT/supabase/.temp/project-ref" || exit 1
project_id="$(sed -n 's/^project_id = "\([^"]*\)"$/\1/p' "$ROOT/supabase/config.toml")"
guard_ephemeral_project_ref "$project_id" || exit 1

echo "Starting local Supabase stack (CLI ${SUPABASE_CLI_VERSION})…"
"${SUPABASE_CLI[@]}" start -x studio,imgproxy,vector,logflare,edge-runtime >/dev/null

ephemeral_load_supabase_status_from_cli "${SUPABASE_CLI[@]}"

guard_loopback_supabase_url "$API_URL" || exit 1
guard_loopback_database_url "$DB_URL" || exit 1
guard_no_production_urls "$API_URL" || exit 1
guard_ephemeral_project_ref "$project_id" || exit 1

echo "Applying migrations — local database reset only (loopback DB_URL verified)."
"${SUPABASE_CLI[@]}" db reset --local --yes

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export E2E_SUPABASE_PROJECT_REF="$project_id"
export CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF="$project_id"

guard_loopback_supabase_url "$NEXT_PUBLIC_SUPABASE_URL" || exit 1
guard_ephemeral_project_ref "$E2E_SUPABASE_PROJECT_REF" || exit 1
guard_ephemeral_test_context_only "$CONSTRUCTA_DEPLOY_CONTEXT" || exit 1

if [[ "$E2E_D38_AUTH" == "seed" ]]; then
  node scripts/ephemeral-replay/seed-disposable-auth.mjs
fi

if [[ "${E2E_D81_PROFILE_ISOLATION:-0}" == "1" ]]; then
  node scripts/ephemeral-replay/seed-d81-profile-isolation.mjs
fi

if [[ "${E2E_D78_SIGNUP_FIXTURE:-0}" == "1" ]]; then
  export DB_URL
  node scripts/ephemeral-replay/enable-disposable-signup-fixture.mjs
fi

echo "Running Playwright D38 ephemeral replay…"
npm run e2e:d38-ephemeral-replay
