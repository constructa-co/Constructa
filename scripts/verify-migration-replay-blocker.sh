#!/usr/bin/env bash
set -euo pipefail

repaired_migration="20260117000000_foundations_estimator.sql"
repaired_path="supabase/migrations/$repaired_migration"
output_file="$(mktemp "${TMPDIR:-/tmp}/constructa-migration-replay.XXXXXX")"

cleanup() {
  rm -f "$output_file"
}
trap cleanup EXIT

if [[ -z "${MIGRATION_DATABASE_URL:-}" ]]; then
  echo "MIGRATION_DATABASE_URL is required." >&2
  exit 1
fi

if [[ "$MIGRATION_DATABASE_URL" == *'?'* || "$MIGRATION_DATABASE_URL" == *'#'* ]]; then
  echo "Migration replay target must not contain connection-option overrides." >&2
  exit 1
fi

case "$MIGRATION_DATABASE_URL" in
  postgresql://*@localhost:*/*|postgres://*@localhost:*/*) ;;
  *)
    echo "Migration replay target must be an isolated localhost database." >&2
    exit 1
    ;;
esac

command -v psql >/dev/null || {
  echo "psql is required." >&2
  exit 1
}

mapfile -t migrations < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort
)
if [[ "${migrations[0]:-}" != "$repaired_path" ]]; then
  echo "Expected $repaired_migration to remain the first migration; found ${migrations[0]:-none}." >&2
  exit 1
fi

replayed_count=0
for migration_path in "${migrations[@]}"; do
  : >"$output_file"
  set +e
  psql "$MIGRATION_DATABASE_URL" \
    -X -v ON_ERROR_STOP=1 \
    -f "$migration_path" \
    >"$output_file" 2>&1
  migration_status=$?
  set -e

  if [[ "$migration_status" -ne 0 ]]; then
    echo "First replay failure after $replayed_count successful migrations: ${migration_path##*/}" >&2
    sed -n '1,220p' "$output_file" >&2
    exit 1
  fi

  replayed_count=$((replayed_count + 1))
done

echo "constructa-migration-replay: all $replayed_count migrations replayed successfully"
