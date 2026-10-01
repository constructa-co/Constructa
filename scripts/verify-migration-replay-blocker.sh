#!/usr/bin/env bash
set -euo pipefail

repaired_migration="20260117000000_foundations_estimator.sql"
repaired_path="supabase/migrations/$repaired_migration"
expected_blocker="20260226260000_lean_library.sql"
expected_success_count=28
expected_error='column "category" does not exist'
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

psql "$MIGRATION_DATABASE_URL" \
  -X -v ON_ERROR_STOP=1 \
  -f scripts/fixtures/supabase-storage.sql \
  >/dev/null

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
    failed_migration="${migration_path##*/}"
    if [[ "$failed_migration" != "$expected_blocker" || "$replayed_count" -ne "$expected_success_count" ]]; then
      echo "Unexpected replay failure after $replayed_count successful migrations: $failed_migration" >&2
      sed -n '1,220p' "$output_file" >&2
      exit 1
    fi
    if ! grep -Fq "$expected_error" "$output_file"; then
      echo "$expected_blocker failed for an unexpected reason." >&2
      sed -n '1,220p' "$output_file" >&2
      exit 1
    fi

    matched_error="$(grep -F "$expected_error" "$output_file" | tail -n 1)"
    echo "Replayed migrations: $replayed_count"
    echo "Expected blocker: $failed_migration"
    echo "Matched PostgreSQL error: $matched_error"
    echo "constructa-migration-replay: confirmed next blocker in $failed_migration"
    exit 0
  fi

  replayed_count=$((replayed_count + 1))
done

echo "All $replayed_count migrations replayed; remove the stale blocker assertion." >&2
exit 1
