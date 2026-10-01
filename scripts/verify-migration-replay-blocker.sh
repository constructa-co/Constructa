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

if ! grep -Fq "$expected_migration" "$output_file"; then
  echo "Migration replay failed before or after the expected first blocker." >&2
  sed -n '1,220p' "$output_file" >&2
  exit 1
fi

if ! grep -Eiq 'missing FROM-clause entry for table "new"|invalid reference.*new' "$output_file"; then
  echo "The expected migration failed for an unexpected reason." >&2
  sed -n '1,220p' "$output_file" >&2
  exit 1
fi

echo "constructa-migration-replay: confirmed first blocker in $expected_migration"
