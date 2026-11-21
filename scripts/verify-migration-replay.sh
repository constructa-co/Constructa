#!/usr/bin/env bash
set -euo pipefail

repaired_migration="20260117000000_foundations_estimator.sql"
repaired_path="supabase/migrations/$repaired_migration"
output_file="$(mktemp "${TMPDIR:-/tmp}/constructa-migration-replay.XXXXXX")"
d68_dir="scripts/fixtures/d68-schema-sequence"
d68_tsv="$d68_dir/manifest.tsv"

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

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  else
    echo "sha256sum or shasum is required for D68 fixture verification." >&2
    exit 1
  fi
}

verify_d68_file_hash() {
  local path="$1"
  local expected="$2"
  local label="$3"
  local actual
  actual="$(sha256_file "$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "D68 fixture hash mismatch for $label: expected $expected, got $actual" >&2
    exit 1
  fi
}

run_psql_file() {
  local migration_path="$1"
  local prior_count="${2:-0}"
  : >"$output_file"
  set +e
  psql "$MIGRATION_DATABASE_URL" \
    -X -v ON_ERROR_STOP=1 \
    -f "$migration_path" \
    >"$output_file" 2>&1
  local migration_status=$?
  set -e
  if [[ "$migration_status" -ne 0 ]]; then
    local failed_migration="${migration_path##*/}"
    echo "Migration replay failed after $prior_count successful migrations: $failed_migration" >&2
    sed -n '1,220p' "$output_file" >&2
    exit 1
  fi
}

run_stage_check() {
  local sql="$1"
  local result
  result="$(psql "$MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "$sql")"
  [[ "$result" == "0" ]] || {
    echo "D68 stage assertion failed (expected 0, got '$result')." >&2
    exit 1
  }
}

d68_stage_check() {
  local filename="$1"
  case "$filename" in
    20261115120000_d36_markup_method.sql)
      run_stage_check "
        SELECT CASE
          WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles'
                  AND column_name = 'markup_method' AND udt_name = 'text') <> 1 THEN 1
          WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'estimates'
                  AND column_name = 'markup_method' AND udt_name = 'text' AND is_nullable = 'YES') <> 1 THEN 1
          WHEN (SELECT count(*) FROM pg_constraint
                WHERE conname IN ('profiles_markup_method_check', 'estimates_markup_method_check')) <> 2 THEN 1
          WHEN COALESCE((SELECT column_default FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'markup_method'), '')
                NOT LIKE '%on_net%' THEN 1
          ELSE 0
        END;"
      ;;
    20261116140000_d36_phase1_project_graph_markup_method.sql)
      run_stage_check "
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'create_phase1_project_graph'
          ) THEN 1
          WHEN COALESCE((
            SELECT strpos(pg_get_functiondef(p.oid), 'markup_method')
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'create_phase1_project_graph'
             ORDER BY p.oid
             LIMIT 1
          ), 0) = 0 THEN 1
          ELSE 0
        END;"
      ;;
    20261116103000_con018_profile_vat_settings.sql)
      run_stage_check "
        SELECT CASE
          WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles'
                  AND column_name IN ('vat_registered', 'default_vat_rate', 'default_vat_reverse_charge')) <> 3 THEN 1
          WHEN COALESCE((SELECT column_default FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles'
                  AND column_name = 'default_vat_reverse_charge'), '') NOT LIKE '%false%' THEN 1
          ELSE 0
        END;"
      ;;
    20261118003000_con044_programme_planner_draft.sql)
      run_stage_check "
        SELECT CASE
          WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'projects'
                  AND column_name = 'programme_planner_draft' AND udt_name = 'jsonb') <> 1 THEN 1
          ELSE 0
        END;"
      ;;
    20261120032000_con073_pipeline_stage_history.sql)
      run_stage_check "
        SELECT CASE
          WHEN to_regclass('public.project_pipeline_stage_events') IS NULL THEN 1
          WHEN NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'project_pipeline_stage_events' AND c.relrowsecurity
          ) THEN 1
          WHEN (SELECT count(*) FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'project_pipeline_stage_events'
                  AND policyname IN (
                    'project_pipeline_stage_events_select_own',
                    'project_pipeline_stage_events_insert_own'
                  )) <> 2 THEN 1
          ELSE 0
        END;"
      ;;
    20261120040000_con068_estimate_line_included.sql)
      run_stage_check "
        SELECT CASE
          WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'estimate_lines'
                  AND column_name = 'included' AND udt_name = 'bool' AND is_nullable = 'NO') <> 1 THEN 1
          WHEN COALESCE((SELECT column_default FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'estimate_lines'
                  AND column_name = 'included'), '') NOT LIKE '%false%' THEN 1
          ELSE 0
        END;"
      ;;
    *)
      echo "No D68 stage check registered for $filename" >&2
      exit 1
      ;;
  esac
}

emit_d68_receipt() {
  local pr="$1"
  local file="$2"
  local sha="$3"
  echo "d68-apply-receipt pr=${pr} file=${file} sha256=${sha} psql=ON_ERROR_STOP stage=verified"
}

d68_enabled=0
d68_pr=()
d68_file=()
d68_sha=()
d68_exclude=()

if [[ -f "$d68_tsv" ]]; then
  d68_enabled=1
  while IFS=$'\t' read -r pr file sha _head; do
    [[ "$pr" == "pr" || -z "$pr" ]] && continue
    [[ -z "$file" || -z "$sha" ]] && {
      echo "D68 manifest.tsv row is incomplete." >&2
      exit 1
    }
    d68_pr+=("$pr")
    d68_file+=("$file")
    d68_sha+=("$sha")
    d68_exclude+=("$file")
  done <"$d68_tsv"
  expected_pr=(176 176 185 222 223 224)
  expected_file=(20261115120000_d36_markup_method.sql 20261116140000_d36_phase1_project_graph_markup_method.sql 20261116103000_con018_profile_vat_settings.sql 20261118003000_con044_programme_planner_draft.sql 20261120032000_con073_pipeline_stage_history.sql 20261120040000_con068_estimate_line_included.sql)
  [[ "${#d68_file[@]}" -eq 6 ]] || { echo "D68 requires exactly six SQL files." >&2; exit 1; }
  for i in "${!expected_pr[@]}"; do
    [[ "${d68_pr[$i]}" == "${expected_pr[$i]}" && "${d68_file[$i]}" == "${expected_file[$i]}" ]] \
      || { echo "D68 order mismatch at index $i." >&2; exit 1; }
  done
fi

is_d68_excluded() {
  local name="$1"
  local f
  if [[ "$d68_enabled" -ne 1 ]]; then
    return 1
  fi
  for f in "${d68_exclude[@]}"; do
    [[ "$f" == "$name" ]] && return 0
  done
  return 1
}

mapfile -t migrations < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort
)
if [[ "${migrations[0]:-}" != "$repaired_path" ]]; then
  echo "Expected $repaired_migration to remain the first migration; found ${migrations[0]:-none}." >&2
  exit 1
fi

baseline_migrations=()
for migration_path in "${migrations[@]}"; do
  base="${migration_path##*/}"
  if is_d68_excluded "$base"; then
    continue
  fi
  baseline_migrations+=("$migration_path")
done

psql "$MIGRATION_DATABASE_URL" \
  -X -v ON_ERROR_STOP=1 \
  -f scripts/fixtures/supabase-storage.sql \
  >/dev/null

replayed_count=0
for migration_path in "${baseline_migrations[@]}"; do
  run_psql_file "$migration_path" "$replayed_count"
  replayed_count=$((replayed_count + 1))
done

d68_applied=0
if [[ "$d68_enabled" -eq 1 ]]; then
  echo "constructa-d68-sequence: baseline replayed ${#baseline_migrations[@]} migrations (${#d68_exclude[@]} filenames held for manifest order)"
  idx=0
  for file in "${d68_file[@]}"; do
    fixture_path="$d68_dir/$file"
    repo_path="supabase/migrations/$file"
    [[ -f "$fixture_path" ]] || {
      echo "D68 fixture missing: $fixture_path" >&2
      exit 1
    }
    verify_d68_file_hash "$fixture_path" "${d68_sha[$idx]}" "fixture $file"
    if [[ -f "$repo_path" ]]; then
      verify_d68_file_hash "$repo_path" "${d68_sha[$idx]}" "repo migration $file"
    fi
    run_psql_file "$fixture_path" "$((replayed_count + d68_applied))"
    d68_stage_check "$file"
    emit_d68_receipt "${d68_pr[$idx]}" "$file" "${d68_sha[$idx]}"
    idx=$((idx + 1))
    d68_applied=$((d68_applied + 1))
  done
fi

total=$((replayed_count + d68_applied))
if [[ "$d68_enabled" -eq 1 ]]; then
  echo "constructa-migration-replay: baseline $replayed_count + d68 fixtures $d68_applied = $total SQL files replayed successfully"
else
  echo "constructa-migration-replay: all $replayed_count migrations replayed successfully"
fi