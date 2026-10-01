#!/usr/bin/env bash
set -euo pipefail

expected_migration="20260117000000_foundations_estimator.sql"
expected_path="supabase/migrations/$expected_migration"
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

psql "$MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
SQL

set +e
psql "$MIGRATION_DATABASE_URL" \
  -X -v ON_ERROR_STOP=1 \
  -f "$expected_path" \
  >"$output_file" 2>&1
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  echo "$expected_migration replayed successfully; remove the known-blocker assertion." >&2
  exit 1
fi

error_pattern='(missing|invalid reference to) FROM-clause entry for table "new"'
if ! grep -Eiq "$error_pattern" "$output_file"; then
  echo "The expected migration failed for an unexpected reason." >&2
  sed -n '1,220p' "$output_file" >&2
  exit 1
fi

matched_error="$(grep -Ei "$error_pattern" "$output_file" | tail -n 1)"
echo "Attempted migration: $expected_migration"
echo "Matched PostgreSQL error: $matched_error"
echo "constructa-migration-replay: confirmed first blocker in $expected_migration"
