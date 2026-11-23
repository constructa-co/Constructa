#!/usr/bin/env bash
# D101 / PR #176 actual undo-reapply drill. Runs INSIDE the disposable Postgres
# service container (see run-in-container.sh) against an empty localhost
# database. Nothing here touches a hosted database, customer data or secrets.
#
#   baseline replay (everything before the two #176 files)
#   -> seed legacy data with the OLD RPC
#   -> apply the exact two migrations, snapshot the reference
#   -> phase 1: clean rollback of both, verify old behaviour, roll forward, verify parity
#   -> phase 2: stored on_net/compound choices exist: refusal, acknowledged RPC-only
#      rollback, data preserved, roll forward, parity
#   -> replay the migrations after #176
set -euo pipefail

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is required}"
URL="$MIGRATION_DATABASE_URL"
case "$URL" in
  postgresql://*@localhost:*/*|postgres://*@localhost:*/*) ;;
  *) echo "D101 DRILL FAILURE: the database must be an isolated localhost database." >&2; exit 1 ;;
esac
[[ "$URL" != *'?'* && "$URL" != *'#'* ]] || { echo "D101 DRILL FAILURE: no connection-option overrides." >&2; exit 1; }

MIG_A="20261115120000_d36_markup_method.sql"
MIG_B="20261116140000_d36_phase1_project_graph_markup_method.sql"
SHA_A="c5d20b553216ce436c92fda526caf45fac2f3e55164319611445cf55324ecc6b"
SHA_B="d66f540b5b572ea5d559b104822abf05b21cdd0ac35c138c22aa2b4027e488c1"
DOWN_B="scripts/rollback/d36-markup-method/down-20261116140000-phase1-graph-rpc.sql"
DOWN_A="scripts/rollback/d36-markup-method/down-20261115120000-markup-columns.sql"
UID1="10000000-0000-0000-0000-00000000d101"
MD_MESSAGE="D101 drill closing message"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "D101 DRILL FAILURE: $*" >&2; exit 1; }
pass() { echo "D101 PASS: $*"; }

psql_() { psql "$URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
qa() { psql_ -At -c "$1"; }
expect_eq() { [[ "$1" == "$2" ]] || fail "$3: expected '$2' got '$1'"; }
run_file() { local f="$1"; shift; psql_ "$@" -f "$f"; }
snap() { psql_ -At -f scripts/d101/schema-snapshot.sql; }
sec_schema() { awk '/^function\|/{exit} {print}'; }   # columns + constraints
sec_function() { awk '/^function\|/{f=1} f{print}'; } # function line + definition

expect_fail() { # label pattern command...
  local label="$1" pattern="$2" out; shift 2
  if out="$("$@" 2>&1)"; then fail "$label: expected a refusal but the command succeeded"; fi
  grep -q -- "$pattern" <<<"$out" || fail "$label: refused, but not with '$pattern': $out"
}

create_job() { # request-id name estimates-json -> project id
  psql_ -At -v req="$1" -v nm="$2" -v ests="$3" -v uid="$UID1" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'uid', true) AS _sub \gset
SELECT project_id FROM public.create_phase1_project_graph(
  :'req'::uuid, jsonb_build_object('name', :'nm', 'status', 'Estimating'), :'ests'::jsonb);
RESET ROLE;
COMMIT;
SQL
}

est_json() { # markup-json-fragment-or-empty  e.g. ',"markup_method":"compound"'
  printf '[{"version_name":"Drill v1","total_cost":100,"overhead_pct":10,"profit_pct":15,"risk_pct":5,"prelims_pct":10,"is_active":true%s,"lines":[{"trade_section":"General","description":"Drill line","quantity":2,"unit":"item","unit_rate":50,"line_total":100}]},{"version_name":"Drill v2","total_cost":0,"is_active":false%s}]' "$1" "$1"
}

est_method() { qa "SELECT COALESCE(markup_method,'<NULL>') FROM public.estimates WHERE project_id='$1' AND version_name='$2'"; }
closing() { qa "SELECT COALESCE(closing_statement,'<NULL>') FROM public.projects WHERE id='$1'"; }
has_col() { qa "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='markup_method'"; }

legacy_snapshot() { # project id
  psql_ -At -v pid="$1" <<'SQL'
SELECT 'project|' || to_jsonb(t)::text FROM (SELECT id, name, status, closing_statement, organization_id FROM public.projects WHERE id = :'pid') t;
SELECT 'estimate|' || to_jsonb(t)::text FROM (SELECT id, project_id, organization_id, version_name, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, is_active FROM public.estimates WHERE project_id = :'pid' ORDER BY id) t;
SELECT 'line|' || to_jsonb(t)::text FROM (SELECT l.id, l.estimate_id, l.trade_section, l.description, l.quantity, l.unit, l.unit_rate, l.line_total, l.pricing_mode, l.line_type FROM public.estimate_lines l JOIN public.estimates e ON e.id = l.estimate_id WHERE e.project_id = :'pid' ORDER BY l.id) t;
SQL
}
choices_snapshot() {
  psql_ -At <<'SQL'
SELECT 'estimate|' || id || '|' || COALESCE(markup_method, '<NULL>') FROM public.estimates ORDER BY id;
SELECT 'profile|' || id || '|' || markup_method FROM public.profiles ORDER BY id;
SQL
}

apply_forward() { run_file "supabase/migrations/$MIG_A"; run_file "supabase/migrations/$MIG_B"; }

# ---- 0. exact candidate bytes ------------------------------------------------
expect_eq "$(sha256sum "supabase/migrations/$MIG_A" | cut -d' ' -f1)" "$SHA_A" "migration A sha256"
expect_eq "$(sha256sum "supabase/migrations/$MIG_B" | cut -d' ' -f1)" "$SHA_B" "migration B sha256"
pass "step0 exact migration bytes match the pinned sha256 values"

# ---- 1. baseline = every migration before the two #176 files ----------------
run_file scripts/fixtures/supabase-storage.sql >/dev/null
mapfile -t ALL < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
BASE_COUNT=0; AFTER=()
for m in "${ALL[@]}"; do
  b="${m##*/}"
  if [[ "$b" < "$MIG_A" ]]; then
    run_file "$m" >/dev/null 2>"$WORK/err" || { cat "$WORK/err" >&2; fail "baseline migration $b failed"; }
    BASE_COUNT=$((BASE_COUNT + 1))
  elif [[ "$b" != "$MIG_A" && "$b" != "$MIG_B" ]]; then
    AFTER+=("$m")
  fi
done
[[ "$BASE_COUNT" -gt 0 ]] || fail "no baseline migrations replayed"
expect_eq "$(has_col)" "0" "markup_method columns absent at baseline"
pass "step1 baseline replayed ($BASE_COUNT migrations before $MIG_A; ${#AFTER[@]} later migrations held back)"

# ---- 2. seed legacy data with the OLD RPC ------------------------------------
psql_ -c "INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('$UID1', 'd101-drill@example.test', '{\"full_name\":\"D101 Drill\"}'::jsonb)"
psql_ -c "UPDATE public.profiles SET md_message = '$MD_MESSAGE' WHERE id = '$UID1'"
[[ "$(qa "SELECT count(*) FROM public.profiles WHERE id='$UID1' AND md_message='$MD_MESSAGE'")" == "1" ]] || fail "seed profile not created by the signup trigger"
L1="$(create_job 20000000-0000-0000-0000-00000000d101 "D101 legacy one" "$(est_json '')")"
[[ -n "$L1" ]] || fail "old RPC returned no project id"
expect_eq "$(closing "$L1")" "$MD_MESSAGE" "old RPC A069 closing prefill"
expect_eq "$(qa "SELECT count(*) FROM public.estimates WHERE project_id='$L1'")" "2" "legacy estimate count"
snap > "$WORK/BASE.txt"
legacy_snapshot "$L1" > "$WORK/LEGACY.txt"
[[ -s "$WORK/BASE.txt" && -s "$WORK/LEGACY.txt" ]] || fail "baseline snapshots are empty"
grep -q '^function|' "$WORK/BASE.txt" || fail "baseline snapshot has no function line"
! grep -q '^column|' "$WORK/BASE.txt" || fail "baseline snapshot unexpectedly has markup_method columns"
pass "step2 legacy data seeded with the previous RPC; baseline definition, grants and legacy rows captured"

# ---- 3. apply both exact migrations; reference snapshot ----------------------
apply_forward
snap > "$WORK/REF.txt"
expect_eq "$(has_col)" "2" "markup_method columns present after apply"
expect_eq "$(grep -c '^constraint|' "$WORK/REF.txt")" "2" "both check constraints present"
! diff -q "$WORK/BASE.txt" "$WORK/REF.txt" >/dev/null || fail "apply changed nothing"
expect_eq "$(qa "SELECT count(*) FROM public.estimates WHERE project_id='$L1' AND markup_method IS NOT NULL")" "0" "legacy estimates stay NULL (compound)"
expect_eq "$(qa "SELECT markup_method FROM public.profiles WHERE id='$UID1'")" "on_net" "profile default on_net"
legacy_snapshot "$L1" | diff - "$WORK/LEGACY.txt" >/dev/null || fail "apply altered legacy rows"
pass "step3 applied exact A then B; legacy rows unchanged and NULL; reference captured"

# ---- 4. PHASE 1: clean rollback ---------------------------------------------
expect_fail "column rollback before RPC rollback" "Run the RPC rollback first" run_file "$DOWN_A"
snap | diff - "$WORK/REF.txt" >/dev/null || fail "refused column rollback changed the schema"
run_file "$DOWN_B"
run_file "$DOWN_A"
snap > "$WORK/AFTER_DOWN.txt"
diff "$WORK/BASE.txt" "$WORK/AFTER_DOWN.txt" || fail "after rollback the schema/function/grants differ from the verified baseline"
legacy_snapshot "$L1" | diff - "$WORK/LEGACY.txt" || fail "rollback altered legacy rows"
run_file "$DOWN_B"; run_file "$DOWN_A"   # idempotent re-run
snap | diff - "$WORK/BASE.txt" >/dev/null || fail "rollback re-run changed the baseline"
L2="$(create_job 20000000-0000-0000-0000-00000000d102 "D101 old behaviour" "$(est_json '')")"
expect_eq "$(closing "$L2")" "$MD_MESSAGE" "old behaviour: closing prefill after rollback"
expect_eq "$(has_col)" "0" "old behaviour: no markup_method column after rollback"
expect_eq "$(qa "SELECT count(*) FROM public.estimates WHERE project_id='$L2'")" "2" "old behaviour: estimates created"
pass "step4 phase 1: rollback restored the exact previous RPC, grants and schema; old behaviour verified; re-run idempotent"

# ---- 5. roll forward ----------------------------------------------------------
apply_forward
snap | diff - "$WORK/REF.txt" || fail "roll-forward parity: schema/function/grants differ from the first apply"
legacy_snapshot "$L1" | diff - "$WORK/LEGACY.txt" || fail "roll-forward altered legacy rows"
expect_eq "$(qa "SELECT count(*) FROM public.estimates WHERE project_id IN ('$L1','$L2') AND markup_method IS NOT NULL")" "0" "legacy and rolled-back-period estimates stay NULL (no backfill)"
pass "step5 roll-forward parity with the first apply; no backfill"

# ---- 6. new behaviour parity ---------------------------------------------------
N1="$(create_job 20000000-0000-0000-0000-00000000d103 "D101 new default" "$(est_json '')")"
expect_eq "$(est_method "$N1" 'Drill v1')" "on_net" "new estimate takes profile default on_net"
psql_ -c "UPDATE public.profiles SET markup_method='compound' WHERE id='$UID1'"
N2="$(create_job 20000000-0000-0000-0000-00000000d104 "D101 company compound" "$(est_json '')")"
expect_eq "$(est_method "$N2" 'Drill v1')" "compound" "new estimate takes company compound choice"
N3="$(create_job 20000000-0000-0000-0000-00000000d105 "D101 explicit on_net" "$(est_json ',"markup_method":"on_net"')")"
expect_eq "$(est_method "$N3" 'Drill v1')" "on_net" "explicit on_net honoured"
N4="$(create_job 20000000-0000-0000-0000-00000000d106 "D101 invalid ignored" "$(est_json ',"markup_method":"bogus"')")"
expect_eq "$(est_method "$N4" 'Drill v1')" "compound" "invalid value falls back to the company choice"
expect_eq "$(closing "$N1")" "$MD_MESSAGE" "A069 closing prefill preserved"
N1R="$(create_job 20000000-0000-0000-0000-00000000d103 "D101 retry" '[]')"
expect_eq "$N1R" "$N1" "idempotent retry returns the same project"
psql_ -c "UPDATE public.profiles SET markup_method='on_net' WHERE id='$UID1'"
choices_snapshot > "$WORK/CHOICES.txt"
grep -q '|on_net$' "$WORK/CHOICES.txt" && grep -q '^estimate|.*|compound$' "$WORK/CHOICES.txt" || fail "choices snapshot lacks both methods"
pass "step6 new behaviour after roll-forward: profile default, company choice, explicit, invalid fallback, closing, idempotency"

# ---- 7. PHASE 2: stored choices exist ----------------------------------------
expect_fail "column rollback with RPC applied" "Run the RPC rollback first" run_file "$DOWN_A"
expect_fail "RPC rollback without acknowledgement" "stored on_net estimate" run_file "$DOWN_B"
snap | diff - "$WORK/REF.txt" >/dev/null || fail "refused rollbacks changed the schema"
choices_snapshot | diff - "$WORK/CHOICES.txt" >/dev/null || fail "refused rollbacks changed stored choices"
run_file "$DOWN_B" -v ack_on_net_incompatible=yes
snap > "$WORK/P2_DOWN.txt"
diff <(sec_function <"$WORK/BASE.txt") <(sec_function <"$WORK/P2_DOWN.txt") || fail "phase 2: restored function/grants differ from the verified previous definition"
diff <(sec_schema <"$WORK/REF.txt") <(sec_schema <"$WORK/P2_DOWN.txt") || fail "phase 2: additive columns/constraints were not preserved"
choices_snapshot | diff - "$WORK/CHOICES.txt" || fail "phase 2: stored estimate/profile choices changed by the RPC rollback"
expect_fail "column rollback with stored choices" "Keep the additive columns" run_file "$DOWN_A"
expect_eq "$(has_col)" "2" "columns kept after refused column rollback"
choices_snapshot | diff - "$WORK/CHOICES.txt" >/dev/null || fail "phase 2: refused column rollback lost data"
psql_ -c "UPDATE public.profiles SET markup_method='compound' WHERE id='$UID1'"
O1="$(create_job 20000000-0000-0000-0000-00000000d107 "D101 old rpc with columns" "$(est_json '')")"
expect_eq "$(est_method "$O1" 'Drill v1')" "<NULL>" "old RPC does not stamp markup_method (read as compound)"
expect_eq "$(closing "$O1")" "$MD_MESSAGE" "old RPC closing prefill"
psql_ -c "UPDATE public.profiles SET markup_method='on_net' WHERE id='$UID1'"
pass "step7 phase 2: refusals change nothing; acknowledged RPC-only rollback restores the exact previous definition/grants and preserves every stored choice"

# ---- 8. roll forward again, parity, data intact -------------------------------
run_file "supabase/migrations/$MIG_B"
snap | diff - "$WORK/REF.txt" || fail "phase 2 roll-forward parity differs from the first apply"
for line in $(cat "$WORK/CHOICES.txt"); do
  grep -qxF "$line" <(choices_snapshot) || fail "phase 2 roll-forward lost stored choice: $line"
done
expect_eq "$(est_method "$O1" 'Drill v1')" "<NULL>" "estimate made while rolled back stays NULL (no backfill)"
N5="$(create_job 20000000-0000-0000-0000-00000000d108 "D101 new after reapply" "$(est_json '')")"
expect_eq "$(est_method "$N5" 'Drill v1')" "on_net" "new behaviour restored after roll-forward"
pass "step8 phase 2 roll-forward parity; all stored choices intact; new behaviour restored"

# ---- 9. the rest of the chain -------------------------------------------------
for m in "${AFTER[@]}"; do
  run_file "$m" >/dev/null 2>"$WORK/err" || { cat "$WORK/err" >&2; fail "later migration ${m##*/} failed"; }
done
pass "step9 ${#AFTER[@]} later migration(s) replay after #176"
echo "D101-DRILL: ALL ASSERTIONS PASSED"
