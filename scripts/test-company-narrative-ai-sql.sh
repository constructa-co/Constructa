#!/usr/bin/env bash
# Stage 2G.3.2, candidate B: an AI-worded draft needs a real budgeted attempt.
#
# Applies the three migrations in order (interview, AI budget, attempt binding)
# in a throwaway local Postgres and proves that:
#   - the earlier save function is gone: exactly one remains, with the attempt
#     argument, executable only by the service role;
#   - an 'ai' draft is saved only with an attempt that is the contractor's own,
#     for company.introduction, finished ok, written from exactly the stated
#     sources, with matching model and prompt version, and not used before;
#   - a template draft with an attempt or a model is refused;
#   - every refusal leaves the draft table exactly as it was;
#   - source binding is unchanged: stale sources are refused first, also when
#     the change and the save arrive at the same moment, for both generators;
#   - an attempt left unattached stays a truthful, unchanged record;
#   - company.introduction is still switched off after all three migrations.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-narrative-ai.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55455}"

cleanup() {
  if [[ -f "$TEST_DIR/data/postmaster.pid" ]]; then
    "$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$TEST_DIR/data" --auth=trust --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -l "$TEST_DIR/postgres.log" \
  -o "-p $PORT -k $TEST_DIR" start >/dev/null

PSQL=("$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$TEST_DIR" -p "$PORT" -d postgres)

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_name text, capability_statement text, years_trading integer,
  accreditations text, insurance_details text, specialisms text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003');
INSERT INTO public.profiles (id, company_name, capability_statement, years_trading) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Builders', NULL, NULL),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Beta Joinery', 'Beta in its own words', 4),
  ('cccccccc-0000-0000-0000-000000000003', 'Gamma Roofing', NULL, NULL);

CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
CREATE FUNCTION t.expect(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', message; END IF;
END $$;
CREATE FUNCTION t.denied(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN RETURN true;
END $$;
CREATE FUNCTION t.fails(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN true;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261008090000_company_interview.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261009090000_ai_generation_budget.sql" >/dev/null

# Rows written before the new migration must survive it.
"${PSQL[@]}" >/dev/null <<'SQL'
SET ROLE service_role;
SELECT public.company_interview_save_answer('bbbbbbbb-0000-0000-0000-000000000002', 'work', 'Joinery', false, 0, 'interview-v1');
SELECT public.company_narrative_save_draft('bbbbbbbb-0000-0000-0000-000000000002', 'introduction', 'Beta Joinery specialises in joinery.', 'template', 'intro-template-v1', NULL, 'interview-v1', '[]', '[]', NULL, public.company_interview_fingerprint('bbbbbbbb-0000-0000-0000-000000000002'));
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261010090000_company_narrative_ai_attempt.sql" >/dev/null

"${PSQL[@]}" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set V '''interview-v1'''

-- ── One function, the new one, service role only ─────────────────────────────
SELECT t.expect((SELECT count(*) FROM pg_proc WHERE proname = 'company_narrative_save_draft') = 1, 'exactly one save function exists');
SELECT t.expect((SELECT pronargs = 12 AND proargnames[12] = 'p_ai_attempt_id' FROM pg_proc WHERE proname = 'company_narrative_save_draft'), 'and it is the one that takes the attempt');
SELECT t.expect(to_regprocedure('public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text)') IS NULL, 'the earlier signature no longer exists');
SELECT t.expect(t.fails($q$ SELECT public.company_narrative_save_draft('aaaaaaaa-0000-0000-0000-000000000001', 'introduction', 'x', 'ai', 'intro-ai-v1', 'm', 'interview-v1', '[]', '[]', NULL, repeat('0', 32)) $q$), 'calling the earlier signature fails: there is no older way in');
SELECT t.expect(has_function_privilege('service_role', 'public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, uuid)', 'EXECUTE'), 'only the service role may execute it');
SELECT t.expect((SELECT bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND (p.proname LIKE 'company\_interview\_%' OR p.proname LIKE 'company\_narrative\_%' OR p.proname LIKE 'ai\_generation\_%')),
  'no browser role can execute any interview, narrative or budget function, across the whole chain');
SELECT t.expect((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (p.proname LIKE 'company\_interview\_%' OR p.proname LIKE 'company\_narrative\_%' OR p.proname LIKE 'ai\_generation\_%')) = 7,
  'the chain defines seven such functions and no stray overloads');
SELECT t.expect((SELECT enabled FROM public.ai_generation_features WHERE feature = 'company.introduction') = false, 'AI wording for the interview is still switched off');
SELECT t.expect((SELECT generator = 'template' AND ai_attempt_id IS NULL FROM public.company_narrative_drafts WHERE user_id = :beta), 'a draft saved before this migration is intact');
SELECT t.expect(NOT has_table_privilege('authenticated', 'public.company_narrative_drafts', 'INSERT, UPDATE, DELETE'), 'drafts are still read-only to the browser');

-- Helpers for the test. p_fp NULL means "the sources as they are now".
CREATE FUNCTION t.snapshot(p_user uuid) RETURNS jsonb LANGUAGE sql AS
$$ SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id), '[]') FROM public.company_narrative_drafts d WHERE d.user_id = p_user $$;
CREATE FUNCTION t.attempt(p_user uuid, p_fp text, p_outcome text, p_model text, p_version text) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  r := public.ai_generation_reserve(p_user, 'company.introduction', 500, p_fp);
  PERFORM t.expect(r->>'status' = 'reserved', 'test attempt reserved');
  PERFORM public.ai_generation_finish(p_user, (r->>'attempt_id')::uuid, p_outcome, 300, CASE WHEN p_outcome = 'error' THEN NULL ELSE 120 END, p_model, p_version);
  RETURN (r->>'attempt_id')::uuid;
END $$;
CREATE FUNCTION t.save(p_user uuid, p_generator text, p_version text, p_model text, p_fp text, p_attempt uuid, p_text text DEFAULT 'AI TEXT') RETURNS jsonb LANGUAGE sql AS
$$ SELECT public.company_narrative_save_draft(p_user, 'introduction', p_text, p_generator, p_version, p_model, 'interview-v1', '[]', '[]', NULL, p_fp, p_attempt) $$;
CREATE FUNCTION t.refused(p_label text, p_user uuid, p_generator text, p_version text, p_model text, p_fp text, p_attempt uuid, p_expected text DEFAULT 'invalid-attempt') RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_before jsonb := t.snapshot(p_user); v_result jsonb;
BEGIN
  v_result := t.save(p_user, p_generator, p_version, p_model, p_fp, p_attempt, 'REFUSED TEXT');
  PERFORM t.expect(v_result = jsonb_build_object('outcome', p_expected), p_label || ': refused as ' || p_expected || ', got ' || v_result::text);
  PERFORM t.expect(v_before = t.snapshot(p_user), p_label || ': nothing inserted, retired or altered');
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO service_role;

-- The test switches the feature on for itself. The migration leaves it off.
UPDATE public.ai_generation_features SET enabled = true WHERE feature = 'company.introduction';
UPDATE public.ai_generation_limits SET per_hour_attempts = NULL, per_day_attempts = 1000, per_day_output_tokens = 1000000 WHERE scope = 'contractor';

SET ROLE service_role;
SELECT public.company_interview_save_answer(:alpha, 'work', 'Kitchen fitting', false, 0, :V);
SELECT public.company_interview_fingerprint(:alpha) AS fp \gset
SELECT public.company_interview_fingerprint(:beta) AS beta_fp \gset

-- A plain draft first, so "not retired" has something to protect.
SELECT t.expect(t.save(:alpha, 'template', 'intro-template-v1', NULL, :'fp', NULL, 'Plain text')->>'outcome' = 'saved', 'the existing plain caller, passing no attempt, still saves');

-- ── Every way an AI draft can lack its proof ─────────────────────────────────
SELECT t.refused('no attempt', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', NULL);
SELECT t.refused('an attempt that does not exist', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', gen_random_uuid());

SELECT t.attempt(:beta, :'fp', 'ok', 'model-a', 'intro-ai-v1') AS foreign_id \gset
SELECT t.refused('another contractor''s attempt', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'foreign_id');

SELECT t.attempt(:alpha, :'fp', 'error', NULL, 'intro-ai-v1') AS failed_id \gset
SELECT t.refused('an attempt that failed', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'failed_id');
SELECT t.attempt(:alpha, :'fp', 'rejected:tripwire', 'model-a', 'intro-ai-v1') AS rejected_id \gset
SELECT t.refused('an attempt whose reply was rejected', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'rejected_id');
SELECT t.attempt(:alpha, :'fp', 'sources-moved', 'model-a', 'intro-ai-v1') AS moved_id \gset
SELECT t.refused('an attempt whose sources moved', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'moved_id');

SELECT (public.ai_generation_reserve(:alpha, 'company.introduction', 500, :'fp')->>'attempt_id') AS open_id \gset
SELECT t.refused('an attempt still in flight', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'open_id');
SELECT public.ai_generation_finish(:alpha, :'open_id', 'error', NULL, NULL, NULL, NULL);

SELECT t.attempt(:alpha, 'ffffffffffffffffffffffffffffffff', 'ok', 'model-a', 'intro-ai-v1') AS other_fp_id \gset
SELECT t.refused('an attempt written from other sources', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'other_fp_id');

SELECT t.attempt(:alpha, :'fp', 'ok', 'model-a', 'intro-ai-v1') AS good_id \gset
SELECT t.refused('a different model from the attempt''s', :alpha, 'ai', 'intro-ai-v1', 'model-b', :'fp', :'good_id');
SELECT t.refused('no model', :alpha, 'ai', 'intro-ai-v1', NULL, :'fp', :'good_id');
SELECT t.refused('a different prompt version from the attempt''s', :alpha, 'ai', 'intro-ai-v2', 'model-a', :'fp', :'good_id');
SELECT t.refused('a plain draft carrying an attempt', :alpha, 'template', 'intro-template-v1', NULL, :'fp', :'good_id');
SELECT t.refused('a plain draft carrying a model', :alpha, 'template', 'intro-template-v1', 'model-a', :'fp', NULL);
SELECT t.refused('an unknown generator', :alpha, 'human', 'v', NULL, :'fp', NULL);
SELECT t.refused('an attempt for the profile rewrite feature', :alpha, 'ai', 'profile-rewrite-v1', 'model-a', :'fp',
  (SELECT id FROM (SELECT (public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700, NULL)->>'attempt_id')::uuid AS id) r
   WHERE public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', r.id, 'ok', 10, 10, 'model-a', 'profile-rewrite-v1')));

-- Stale sources are still refused first, whatever the attempt.
SELECT t.refused('stale sources with a good attempt', :alpha, 'ai', 'intro-ai-v1', 'model-a', repeat('0', 32), :'good_id', 'stale-source');
SELECT t.refused('stale sources on a plain draft', :alpha, 'template', 'intro-template-v1', NULL, repeat('0', 32), NULL, 'stale-source');

-- ── The one way that works ───────────────────────────────────────────────────
SELECT t.save(:alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'good_id', 'Worded text') AS saved \gset
SELECT t.expect((:'saved'::jsonb)->>'outcome' = 'saved', 'an AI draft with its own good attempt is saved');
SELECT t.expect((SELECT generator = 'ai' AND ai_attempt_id = :'good_id' AND model = 'model-a' AND generator_version = 'intro-ai-v1' AND answers_fingerprint = :'fp' AND status = 'draft' FROM public.company_narrative_drafts WHERE id = ((:'saved'::jsonb)->'draft'->>'id')::uuid),
  'it records the attempt, the model, the prompt version and the sources');
SELECT t.expect((SELECT status FROM public.company_narrative_drafts WHERE user_id = :alpha AND draft_text = 'Plain text') = 'superseded', 'only the accepted save retired the plain draft');
SELECT t.refused('the same attempt a second time', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'good_id');
SELECT t.expect(t.fails(format($q$ UPDATE public.company_narrative_drafts SET ai_attempt_id = %L WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002' $q$, :'good_id')), 'the table itself refuses one attempt on two drafts');
SELECT t.expect(t.fails($q$ UPDATE public.company_narrative_drafts SET generator = 'ai', model = 'm' WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002' $q$), 'and refuses a draft relabelled as AI with no attempt, even by the server');
SELECT t.expect(t.fails($q$ UPDATE public.company_narrative_drafts SET ai_attempt_id = NULL WHERE generator = 'ai' $q$), 'and refuses an AI draft losing its attempt');

-- Approval of an AI draft, edited: saved as the contractor's words; the generator is not rewritten.
SELECT t.expect(public.company_narrative_approve(:alpha, ((:'saved'::jsonb)->'draft'->>'id')::uuid, 'introduction', 'Worded text, with my change.', NULL) = '{"outcome":"applied","edited":true}'::jsonb, 'an edited AI draft is approved and recorded as edited');
SELECT t.expect((SELECT generator = 'ai' AND approved_edited AND approved_text = 'Worded text, with my change.' AND ai_attempt_id = :'good_id' FROM public.company_narrative_drafts WHERE id = ((:'saved'::jsonb)->'draft'->>'id')::uuid), 'the record still says how the draft was produced and that the contractor changed it');

-- ── Sources move after the attempt finished ok, before the save ──────────────
SELECT t.attempt(:alpha, :'fp', 'ok', 'model-a', 'intro-ai-v1') AS late_id \gset
SELECT public.company_interview_save_answer(:alpha, 'work', 'Roofing only', false, 1, :V);
SELECT t.refused('sources moved between finish and save', :alpha, 'ai', 'intro-ai-v1', 'model-a', :'fp', :'late_id', 'stale-source');
-- Even stating the new sources does not help: the attempt was written from the old ones.
SELECT t.refused('the new sources stated against an attempt written from the old', :alpha, 'ai', 'intro-ai-v1', 'model-a', public.company_interview_fingerprint(:alpha), :'late_id');
SELECT t.expect((SELECT outcome = 'ok' AND completion_tokens = 120 AND charged_output_tokens = 120 AND finished_at IS NOT NULL FROM public.ai_generation_attempts WHERE id = :'late_id'), 'the unattached attempt stays what it was: a valid reply, paid for, never attached');
SELECT t.expect(NOT EXISTS (SELECT 1 FROM public.company_narrative_drafts WHERE ai_attempt_id = :'late_id'), 'and no draft carries it');
SELECT t.expect(t.fails(format($q$ UPDATE public.ai_generation_attempts SET outcome = 'sources-moved' WHERE id = %L $q$, :'late_id')), 'its outcome cannot be rewritten afterwards');
-- The plain fallback, from the fresh sources, works.
SELECT t.expect(t.save(:alpha, 'template', 'intro-template-v1', NULL, public.company_interview_fingerprint(:alpha), NULL, 'Plain text from fresh sources')->>'outcome' = 'saved', 'the plain draft from the fresh sources is saved');
RESET ROLE;
SQL

# ── The same for real: a source changes in another session as the AI save arrives ──
race() { # label, SQL that changes a source inside an open transaction
  local label="$1" change="$2" fp attempt result before after
  fp="$("${PSQL[@]}" -At -c "SELECT public.company_interview_fingerprint('aaaaaaaa-0000-0000-0000-000000000001');")"
  attempt="$("${PSQL[@]}" -At -c "SELECT t.attempt('aaaaaaaa-0000-0000-0000-000000000001', '$fp', 'ok', 'model-a', 'intro-ai-v1');" | tail -n 1)"
  before="$("${PSQL[@]}" -At -c "SELECT md5(t.snapshot('aaaaaaaa-0000-0000-0000-000000000001')::text);")"
  "${PSQL[@]}" -q -c "BEGIN; $change SELECT pg_sleep(1.5); COMMIT;" >/dev/null &
  sleep 0.5
  # The save waits for the other session, then compares, then refuses.
  result="$("${PSQL[@]}" -At -c "SET ROLE service_role; SELECT t.save('aaaaaaaa-0000-0000-0000-000000000001', 'ai', 'intro-ai-v1', 'model-a', '$fp', '$attempt', 'OLD AI TEXT')->>'outcome';" | tail -n 1)"
  wait
  after="$("${PSQL[@]}" -At -c "SELECT md5(t.snapshot('aaaaaaaa-0000-0000-0000-000000000001')::text);")"
  if [[ "$result" != "stale-source" || "$before" != "$after" ]]; then
    echo "FAILED: $label as the AI save arrived: outcome '$result', drafts changed: $([[ "$before" == "$after" ]] && echo no || echo yes)." >&2
    exit 1
  fi
}
race "an answer saved" "SET LOCAL ROLE service_role; SELECT public.company_interview_save_answer('aaaaaaaa-0000-0000-0000-000000000001', 'work', 'Cladding', false, (SELECT revision FROM public.company_interview_answers WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND question_key = 'work'), 'interview-v1');"
race "the business name changed" "UPDATE public.profiles SET company_name = 'Alpha ' || clock_timestamp()::text WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';"

# ── Two saves of the same good attempt at once: one draft ─────────────────────
fp="$("${PSQL[@]}" -At -c "SELECT public.company_interview_fingerprint('aaaaaaaa-0000-0000-0000-000000000001');")"
attempt="$("${PSQL[@]}" -At -c "SELECT t.attempt('aaaaaaaa-0000-0000-0000-000000000001', '$fp', 'ok', 'model-a', 'intro-ai-v1');" | tail -n 1)"
for i in 1 2 3 4; do
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT t.save('aaaaaaaa-0000-0000-0000-000000000001', 'ai', 'intro-ai-v1', 'model-a', '$fp', '$attempt', 'tab $i')->>'outcome';" | tail -n 1 > "$TEST_DIR/attach.$i" &
done
wait
saved="$(cat "$TEST_DIR"/attach.* | grep -c '^saved$' || true)"
refused="$(cat "$TEST_DIR"/attach.* | grep -c '^invalid-attempt$' || true)"
if [[ "$saved" != "1" || "$refused" != "3" ]]; then
  echo "FAILED: four simultaneous saves of one attempt gave $saved saved and $refused refused; expected 1 and 3." >&2
  exit 1
fi

echo "company narrative ai attempt: binding, single save function, source binding and isolation hold; AI wording still off"
