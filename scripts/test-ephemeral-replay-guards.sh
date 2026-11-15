#!/usr/bin/env bash
# Validates ephemeral replay shell guards, status parsing, workflow posture, and orchestrator rules.
# No Docker, network, or secrets required.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/constructa-ephemeral-guards.XXXXXX")"
WORK="$(cd "$WORK" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT

failures=0
pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1" >&2; failures=$((failures + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

WORKFLOW="$ROOT_DIR/.github/workflows/d38-con-browser-replay.yml"
ORCH="$ROOT_DIR/scripts/ephemeral-replay/d38-ephemeral-browser.sh"
PARSE="$ROOT_DIR/scripts/ephemeral-replay/parse-supabase-status-env.sh"
GUARDS="$ROOT_DIR/scripts/ephemeral-replay/guards.sh"

echo "Workflow posture"
check "contents permission is read-only" "grep -qE '^permissions:[[:space:]]*$' '$WORKFLOW' && grep -A1 '^permissions:' '$WORKFLOW' | grep -qF 'contents: read'"
check "Playwright Chromium install step exists" "grep -qF 'playwright install chromium --with-deps' '$WORKFLOW'"
check "shell validation step exists" "grep -qF 'test-ephemeral-replay-guards.sh' '$WORKFLOW'"
check "no workflow secrets are referenced" "! grep -qE 'secrets\\.' '$WORKFLOW'"
check "no workflow write permissions" "! grep -qE 'contents: write|packages: write|id-token: write' '$WORKFLOW'"

echo "Orchestrator hardening"
check "orchestrator never uses eval on CLI status" "! grep -qE '\\beval\\b' '$ORCH'"
check "orchestrator sources strict status parser" "grep -qF 'parse-supabase-status-env.sh' '$ORCH'"
check "local db reset is labelled" "grep -qiF 'local database reset' '$ORCH'"
check "db reset runs only after DB_URL guard" "awk '/guard_loopback_database_url/ {g=1} /db reset/ {r=1} END {exit !(g&&r)}' '$ORCH'"
check "e2e-replay context is set" "grep -qF 'CONSTRUCTA_DEPLOY_CONTEXT=e2e-replay' '$ORCH'"
check "orchestrator refuses remote link when present" "grep -qF 'guard_no_remote_supabase_link' '$ORCH'"
check "orchestrator refuses Vercel in test guard" "grep -qF 'guard_ephemeral_test_context_only' '$ORCH'"

echo "Status parser (no eval)"
# shellcheck source=scripts/ephemeral-replay/parse-supabase-status-env.sh
source "$PARSE"
FAKE="$WORK/status.env"
cat >"$FAKE" <<'EOF'
API_URL=http://127.0.0.1:54321
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.a
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.a
PROJECT_ID=ephemeralreplay00001
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SECRET_SHOULD_NOT_EXPORT=leak
EOF
if ephemeral_parse_supabase_status_file "$FAKE"; then pass "parser exports required keys"; else fail "parser exports required keys"; fi
check "parser kept loopback API_URL" "[[ \"\${API_URL:-}\" == 'http://127.0.0.1:54321' ]]"
check "parser did not export unknown keys" "[[ -z \"\${SECRET_SHOULD_NOT_EXPORT:-}\" ]]"

echo "Guards behaviour"
# shellcheck source=scripts/ephemeral-replay/guards.sh
source "$GUARDS"
if guard_loopback_supabase_url "http://127.0.0.1:54321"; then pass "loopback API guard accepts 127.0.0.1:54321"; else fail "loopback API guard accepts 127.0.0.1:54321"; fi
if guard_loopback_supabase_url "https://umqtzfsnyoofmgfbnrgv.supabase.co" 2>/dev/null; then fail "API guard rejects hosted URL"; else pass "API guard rejects hosted URL"; fi
if guard_loopback_database_url "postgresql://postgres:postgres@127.0.0.1:54322/postgres"; then pass "DB guard accepts loopback"; else fail "DB guard accepts loopback"; fi
if guard_loopback_database_url "postgresql://postgres:postgres@db.pudadynieiuypxeoimnz.supabase.co:5432/postgres" 2>/dev/null; then
  fail "DB guard rejects remote"
else
  pass "DB guard rejects remote"
fi

if (
  VERCEL=1
  export CONSTRUCTA_DEPLOY_CONTEXT=e2e-replay
  ! guard_ephemeral_test_context_only "e2e-replay" 2>/dev/null
); then pass "Vercel blocks ephemeral test context"; else fail "Vercel blocks ephemeral test context"; fi

if guard_ephemeral_test_context_only "e2e-replay" 2>/dev/null; then pass "off-Vercel allows e2e-replay"; else fail "off-Vercel allows e2e-replay"; fi

LINK_DIR="$WORK/supabase/.temp"
mkdir -p "$LINK_DIR"
echo -n "pudadynieiuypxeoimnz" >"$LINK_DIR/project-ref"
if (
  cd "$ROOT_DIR"
  ! guard_no_remote_supabase_link "$LINK_DIR/project-ref" 2>/dev/null
); then pass "linked production ref is refused"; else fail "linked production ref is refused"; fi

echo "Application guard (loopback cannot pass preview)"
TARGET="$ROOT_DIR/src/lib/deployment/supabase-target.test.ts"
check "supabase-target tests loopback on preview" "grep -qF 'loopback test address' '$TARGET' || grep -qF 'only permitted in the e2e-replay context' '$ROOT_DIR/src/lib/deployment/supabase-target.mjs'"

if [[ "$failures" -gt 0 ]]; then
  echo "$failures guard validation(s) failed." >&2
  exit 1
fi
echo "All ephemeral replay guard validations passed."