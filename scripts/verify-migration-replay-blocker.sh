#!/usr/bin/env bash
set -euo pipefail

expected_migration="20260117000000_foundations_estimator.sql"
output_file="$(mktemp "${TMPDIR:-/tmp}/constructa-migration-replay.XXXXXX")"

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
  rm -f "$output_file"
}
trap cleanup EXIT

set +e
supabase db start >"$output_file" 2>&1
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  echo "The migration stack replayed successfully; remove the known-blocker assertion." >&2
  exit 1
fi

last_attempted_migration="$(
  grep -Eo 'Applying migration [^[:space:]]+' "$output_file" \
    | tail -n 1 \
    | awk '{print $3}' \
    || true
)"

if [[ "$last_attempted_migration" != "$expected_migration" ]]; then
  echo "Migration replay did not stop in the expected first migration." >&2
  sed -n '1,220p' "$output_file" >&2
  exit 1
fi

error_pattern='(missing|invalid reference to) FROM-clause entry for table "new"'
if ! grep -Eiq "$error_pattern" "$output_file"; then
  echo "The expected migration failed for an unexpected reason." >&2
  sed -n '1,220p' "$output_file" >&2
  exit 1
fi

matched_error="$(grep -Ei "$error_pattern" "$output_file" | tail -n 1)"
echo "Last attempted migration: $last_attempted_migration"
echo "Matched PostgreSQL error: $matched_error"
echo "constructa-migration-replay: confirmed first blocker in $expected_migration"
