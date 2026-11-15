# shellcheck shell=bash
# Parses `supabase status -o env` without eval. Exports only whitelisted keys.
# Never prints secret values to stdout/stderr.
set -euo pipefail

# Names we accept from `supabase status -o env` (no other keys are exported).
EPHEMERAL_STATUS_KEYS=(API_URL ANON_KEY SERVICE_ROLE_KEY DB_URL)

ephemeral_parse_supabase_status_file() {
  local file="${1:?status env file required}"
  local line key raw value

  unset "${EPHEMERAL_STATUS_KEYS[@]}" 2>/dev/null || true

  while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" != *"="* ]]; then
      echo "EPHEMERAL PARSE FAILURE: status line is not KEY=value." >&2
      return 1
    fi
    key="${line%%=*}"
    raw="${line#*=}"
    case "$key" in
      API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL) ;;
      *) continue ;;
    esac
  value="$raw"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value#\"}"
    value="${value%\"}"
  fi
  if [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value#\'}"
    value="${value%\'}"
  fi
    export "$key=$value"
  done <"$file"
}

ephemeral_load_supabase_status_from_cli() {
  local cli_invoke=("$@")
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/supabase-status-env.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" RETURN
  "${cli_invoke[@]}" status -o env >"$tmp"
  ephemeral_parse_supabase_status_file "$tmp"
  local k
  for k in "${EPHEMERAL_STATUS_KEYS[@]}"; do
    if [[ -z "${!k:-}" ]]; then
      echo "EPHEMERAL PARSE FAILURE: missing required key $k from supabase status." >&2
      return 1
    fi
  done
  echo "Ephemeral status: parsed $((${#EPHEMERAL_STATUS_KEYS[@]})) keys from local supabase status (values not logged)."
}