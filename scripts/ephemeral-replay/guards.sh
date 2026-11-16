# shellcheck shell=bash
# Fail-closed guards for D38 ephemeral replay. Sources only; no credentials logged.
set -euo pipefail

PRODUCTION_REF="pudadynieiuypxeoimnz"
APPROVED_EPHEMERAL_REF="ephemeralreplay00001"

_ephemeral_guard_fail() {
  echo "$1" >&2
  return 1
}

guard_no_production_urls() {
  local value="${1:-}"
  if [[ "$value" == *"${PRODUCTION_REF}"* ]]; then
    _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: value references production project ${PRODUCTION_REF}."
  fi
}

guard_loopback_supabase_url() {
  local url="${1:-}"
  case "$url" in
    http://127.0.0.1:54321|http://127.0.0.1:54321/*|http://localhost:54321|http://localhost:54321/*) return 0 ;;
    *)
      _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: NEXT_PUBLIC_SUPABASE_URL must be local port 54321, got: ${url:-<unset>}."
      ;;
  esac
}

guard_ephemeral_project_ref() {
  local ref="${1:-}"
  if [[ "$ref" != "$APPROVED_EPHEMERAL_REF" ]]; then
    _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: E2E_SUPABASE_PROJECT_REF must be ${APPROVED_EPHEMERAL_REF}."
  fi
}

guard_loopback_database_url() {
  local url="${1:-}"
  if [[ -z "$url" ]]; then
    _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: DB_URL is empty."
  fi
  guard_no_production_urls "$url"
  case "$url" in
    postgres://*@127.0.0.1:*/*|postgres://*@127.0.0.1/* \
    |postgresql://*@127.0.0.1:*/*|postgresql://*@127.0.0.1/* \
    |postgres://*@localhost:*/*|postgresql://*@localhost:*/*)
      return 0
      ;;
    *)
      _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: db reset refused — DB_URL is not a loopback database."
      ;;
  esac
}

guard_no_remote_supabase_link() {
  local link_file="${1:-supabase/.temp/project-ref}"
  if [[ ! -f "$link_file" ]]; then
    return 0
  fi
  local linked
  linked="$(tr -d '[:space:]' <"$link_file")"
  if [[ "$linked" == "$PRODUCTION_REF" ]]; then
    echo "Ephemeral replay: dropping stale production supabase link metadata (supabase/.temp)." >&2
    rm -rf "$(dirname "$link_file")"
    return 0
  fi
  if [[ -n "$linked" && "$linked" != "$APPROVED_EPHEMERAL_REF" ]]; then
    _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: supabase link must be absent or local (${APPROVED_EPHEMERAL_REF})."
  fi
}

guard_ephemeral_test_context_only() {
  local ctx="${1:-}"
  if [[ "$ctx" != "e2e-replay" ]]; then
    _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: CONSTRUCTA_DEPLOY_CONTEXT must be e2e-replay."
  fi
  if [[ -n "${VERCEL:-}" || -n "${VERCEL_ENV:-}" ]]; then
    _ephemeral_guard_fail "EPHEMERAL GUARD FAILURE: ephemeral replay cannot run on Vercel (preview/production)."
  fi
}