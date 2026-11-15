# shellcheck shell=bash
# Fail-closed guards for D38 ephemeral replay. Sources only; no credentials logged.
set -euo pipefail

PRODUCTION_REF="pudadynieiuypxeoimnz"
APPROVED_EPHEMERAL_REF="ephemeralreplay00001"

guard_no_production_urls() {
  local value="${1:-}"
  if [[ "$value" == *"${PRODUCTION_REF}"* ]]; then
    echo "EPHEMERAL GUARD FAILURE: value references production project ${PRODUCTION_REF}." >&2
    exit 1
  fi
}

guard_loopback_supabase_url() {
  local url="${1:-}"
  case "$url" in
    http://127.0.0.1:54321|http://127.0.0.1:54321/*|http://localhost:54321|http://localhost:54321/*) return 0 ;;
    *)
      echo "EPHEMERAL GUARD FAILURE: NEXT_PUBLIC_SUPABASE_URL must be local port 54321, got: ${url:-<unset>}." >&2
      exit 1
      ;;
  esac
}

guard_ephemeral_project_ref() {
  local ref="${1:-}"
  if [[ "$ref" != "$APPROVED_EPHEMERAL_REF" ]]; then
    echo "EPHEMERAL GUARD FAILURE: E2E_SUPABASE_PROJECT_REF must be ${APPROVED_EPHEMERAL_REF}." >&2
    exit 1
  fi
}