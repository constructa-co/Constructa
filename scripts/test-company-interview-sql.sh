#!/usr/bin/env bash
# Stage 2G.3.1: interview answers and narrative drafts keep their boundary.
#
# Runs the migration in a throwaway local Postgres and proves that:
#   - it applies cleanly;
#   - a signed-in contractor can read their own answers and drafts and write
#     nothing: no forged answer, draft, fact or approval, and no direct call
#     to any server-only function;
#   - another contractor and a signed-out visitor can do nothing at all;
#   - an answer is saved only against the revision the caller has seen, also
#     when several saves arrive at once;
#   - an approval is refused when the answers changed after the draft was
#     built, when the profile changed after it was shown, or when the text is
#     not plain; it writes the profile and its own record together or neither;
#     a fact is written exactly as the contractor typed it;
#   - none of this reads website-import drafts.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-company-interview.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55453}"

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

"${PSQL[@]}" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set V '''interview-v1'''

-- ── Answers and revisions ────────────────────────────────────────────────────
SET ROLE service_role;
SELECT t.expect(public.company_interview_save_answer(:alpha, 'work', 'Kitchens and bathrooms', false, 0, :V) = '{"outcome":"saved","revision":1}'::jsonb, 'a first answer is saved as revision 1');
SELECT t.expect(public.company_interview_save_answer(:alpha, 'work', 'Duplicate first save', false, 0, :V)->>'outcome' = 'conflict', 'a second "first" save is a conflict, not a second row');
SELECT t.expect(public.company_interview_save_answer(:alpha, 'work', 'Kitchens, bathrooms and tiling', false, 1, :V)->>'revision' = '2', 'a save that names the current revision goes through');
SELECT public.company_interview_save_answer(:alpha, 'work', 'Stale tab', false, 1, :V) AS stale \gset
SELECT t.expect((:'stale'::jsonb)->>'outcome' = 'conflict' AND (:'stale'::jsonb)->>'answer' = 'Kitchens, bathrooms and tiling' AND (:'stale'::jsonb)->>'revision' = '2', 'a save from a stale tab is refused and told what is saved now');
SELECT t.expect((SELECT answer FROM public.company_interview_answers WHERE user_id = :alpha AND question_key = 'work') = 'Kitchens, bathrooms and tiling', 'the stale save changed nothing');
SELECT t.expect(public.company_interview_save_answer(:alpha, 'area', '', true, 0, :V)->>'outcome' = 'saved', 'a skip is saved');
SELECT t.expect(t.fails(format($q$ SELECT public.company_interview_save_answer(%L, 'work', %L, false, 2, 'interview-v1') $q$, 'aaaaaaaa-0000-0000-0000-000000000001', repeat('x', 601))), 'an over-long answer is refused');
SELECT t.expect(t.fails($q$ SELECT public.company_interview_save_answer('aaaaaaaa-0000-0000-0000-000000000001', 'Work; DROP', 'x', false, 0, 'interview-v1') $q$), 'a question key must be a plain key');
SELECT t.expect((SELECT count(*) FROM public.company_interview_answers WHERE user_id = :beta) = 0, 'answers are saved for the named contractor only');
SELECT public.company_interview_save_answer(:alpha, 'memberships', 'Gas Safe registered, number 123456', false, 0, :V);
SELECT public.company_interview_save_answer(:alpha, 'business_started', '2017', false, 0, :V);

-- ── Draft ────────────────────────────────────────────────────────────────────
SELECT public.company_narrative_save_draft(:alpha, 'introduction', 'Alpha Builders specialises in kitchens.' || E'\n\n' || 'How we work: tidy.', 'template', 'intro-template-v1', NULL, :V,
  '[{"kind":"answer","key":"work"}]',
  '[{"field":"years_trading","proposed":"9","existing":null,"questionKey":"business_started","status":"pending","appliedAt":null},{"field":"accreditations","proposed":"Gas Safe registered, number 123456","existing":null,"questionKey":"memberships","status":"pending","appliedAt":null},{"field":"insurance_details","proposed":"","existing":null,"status":"pending"}]',
  NULL) AS first \gset
SELECT ((:'first'::jsonb)->>'id') AS first_id \gset
SELECT t.expect((:'first'::jsonb)->>'answers_fingerprint' = public.company_interview_fingerprint(:alpha), 'the fingerprint is taken by the server when the draft is saved');
SELECT t.expect((SELECT capability_statement IS NULL AND years_trading IS NULL AND accreditations IS NULL FROM public.profiles WHERE id = :alpha), 'saving a draft does not change the profile');
SELECT t.expect(t.fails($q$ SELECT public.company_narrative_save_draft('aaaaaaaa-0000-0000-0000-000000000001', 'why_us', 'x', 'template', 'v', NULL, 'interview-v1', '[]', '[]', NULL) $q$), 'only known sections are stored');
SELECT t.expect(t.fails(format($q$ SELECT public.company_narrative_save_draft('aaaaaaaa-0000-0000-0000-000000000001', 'introduction', %L, 'template', 'v', NULL, 'interview-v1', '[]', '[]', NULL) $q$, repeat('x', 2001))), 'an over-long draft is refused');
RESET ROLE;

-- ── The owner, from a browser: read only ─────────────────────────────────────
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT t.expect((SELECT count(*) FROM public.company_interview_answers) = 4 AND (SELECT count(*) FROM public.company_narrative_drafts) = 1, 'the owner can read their answers and draft');
SELECT t.expect(t.denied($q$ INSERT INTO public.company_interview_answers (user_id, question_key, answer, question_set_version) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'insurance', 'x', 'v') $q$), 'the owner cannot insert an answer from a browser');
SELECT t.expect(t.denied($q$ UPDATE public.company_interview_answers SET answer = 'x', revision = 99 $q$), 'the owner cannot rewrite an answer or its revision');
SELECT t.expect(t.denied($q$ DELETE FROM public.company_interview_answers $q$), 'the owner cannot delete answers');
SELECT t.expect(t.denied($q$ INSERT INTO public.company_narrative_drafts (user_id, section, draft_text, generator, generator_version, question_set_version, answers_fingerprint) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'introduction', 'FORGED', 'template', 'v', 'v', 'x') $q$), 'the owner cannot forge a draft');
SELECT t.expect(t.denied($q$ UPDATE public.company_narrative_drafts SET draft_text = 'FORGED' $q$), 'the owner cannot rewrite a draft');
SELECT t.expect(t.denied($q$ UPDATE public.company_narrative_drafts SET facts = jsonb_set(facts, '{1,proposed}', '"NICEIC approved"') $q$), 'the owner cannot rewrite an offered fact');
SELECT t.expect(t.denied($q$ UPDATE public.company_narrative_drafts SET status = 'approved', approved_edited = false, answers_fingerprint = 'x' $q$), 'the owner cannot fake an approval or a fingerprint');
SELECT t.expect(t.denied($q$ DELETE FROM public.company_narrative_drafts $q$), 'the owner cannot delete a draft');
SELECT t.expect(t.denied($q$ SELECT public.company_interview_save_answer('aaaaaaaa-0000-0000-0000-000000000001', 'work', 'x', false, 2, 'v') $q$), 'a browser cannot call the answer function');
SELECT t.expect(t.denied($q$ SELECT public.company_narrative_save_draft('aaaaaaaa-0000-0000-0000-000000000001', 'introduction', 'x', 'template', 'v', NULL, 'v', '[]', '[]', NULL) $q$), 'a browser cannot call the draft function');
SELECT t.expect(t.denied(format($q$ SELECT public.company_narrative_approve('aaaaaaaa-0000-0000-0000-000000000001', %L, 'introduction', 'x', NULL) $q$, :'first_id')), 'a browser cannot call the approval function');
SELECT t.expect(t.denied($q$ SELECT public.company_interview_fingerprint('aaaaaaaa-0000-0000-0000-000000000001') $q$), 'a browser cannot call the fingerprint function');

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
SELECT t.expect((SELECT count(*) FROM public.company_interview_answers) = 0 AND (SELECT count(*) FROM public.company_narrative_drafts) = 0, 'another contractor sees no answers and no drafts');
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT t.expect(t.denied('SELECT 1 FROM public.company_interview_answers') AND t.denied('SELECT 1 FROM public.company_narrative_drafts'), 'a signed-out visitor reads nothing');
SELECT t.expect(t.denied($q$ SELECT public.company_interview_save_answer('aaaaaaaa-0000-0000-0000-000000000001', 'work', 'x', false, 2, 'v') $q$), 'a signed-out visitor cannot save an answer');
RESET ROLE;

-- ── Approval ─────────────────────────────────────────────────────────────────
SET ROLE service_role;
SELECT t.expect(public.company_narrative_approve(:beta, :'first_id', 'introduction', NULL, 'Beta in its own words')->>'outcome' = 'not-found', 'a draft cannot be approved for another contractor');
SELECT t.expect((SELECT capability_statement FROM public.profiles WHERE id = :beta) = 'Beta in its own words', 'the other contractor''s profile is untouched');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'specialisms', NULL, NULL)->>'outcome' = 'unavailable', 'a column outside the list is refused');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'capability_statement = ''x'', company_name', NULL, NULL)->>'outcome' = 'unavailable', 'the target is a name from a fixed list, never SQL');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'insurance_details', NULL, NULL)->>'outcome' = 'unavailable', 'a fact with nothing offered cannot be approved');

-- Not plain text: refused whoever wrote it.
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'introduction', 'We are <b>great</b>', NULL)->>'outcome' = 'invalid-text', 'markup in an edited introduction is refused');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'introduction', E'bell\x07', NULL)->>'outcome' = 'invalid-text', 'control characters are refused');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'introduction', '   ', NULL)->>'outcome' = 'invalid-text', 'an empty introduction is refused');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'introduction', repeat('x', 2001), NULL)->>'outcome' = 'invalid-text', 'an over-long edit is refused');
SELECT t.expect((SELECT capability_statement IS NULL FROM public.profiles WHERE id = :alpha), 'nothing was written by the refused approvals');

-- The profile changed after the draft was shown.
UPDATE public.profiles SET capability_statement = 'Typed by hand in another tab' WHERE id = :alpha;
SELECT public.company_narrative_approve(:alpha, :'first_id', 'introduction', NULL, NULL) AS stale \gset
SELECT t.expect((:'stale'::jsonb)->>'outcome' = 'conflict' AND (:'stale'::jsonb)->>'current' = 'Typed by hand in another tab', 'a changed introduction is reported, not overwritten');
SELECT t.expect((SELECT capability_statement FROM public.profiles WHERE id = :alpha) = 'Typed by hand in another tab', 'the hand-typed introduction is kept');
SELECT t.expect((SELECT profile_baseline FROM public.company_narrative_drafts WHERE id = :'first_id') = 'Typed by hand in another tab', 'the draft now shows the newer saved value');

-- The answers changed after the draft was built: nothing in it can be approved.
SELECT public.company_interview_save_answer(:alpha, 'work', 'Kitchens only now', false, 2, :V);
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'introduction', NULL, 'Typed by hand in another tab')->>'outcome' = 'stale-answers', 'a draft built from older answers cannot be approved');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'accreditations', NULL, NULL)->>'outcome' = 'stale-answers', 'nor can a fact from it');
SELECT t.expect((SELECT accreditations IS NULL AND capability_statement = 'Typed by hand in another tab' FROM public.profiles WHERE id = :alpha), 'and nothing was written');

-- Rebuilt from the current answers. The earlier draft is retired.
SELECT public.company_narrative_save_draft(:alpha, 'introduction', 'Alpha Builders specialises in kitchens only now.', 'template', 'intro-template-v1', NULL, :V, '[]',
  '[{"field":"years_trading","proposed":"9","existing":null,"questionKey":"business_started","status":"pending","appliedAt":null},{"field":"accreditations","proposed":"Gas Safe registered, number 123456","existing":null,"questionKey":"memberships","status":"pending","appliedAt":null}]',
  'Typed by hand in another tab') AS second \gset
SELECT ((:'second'::jsonb)->>'id') AS second_id \gset
SELECT t.expect((SELECT status FROM public.company_narrative_drafts WHERE id = :'first_id') = 'superseded', 'the earlier draft is retired');
SELECT t.expect(public.company_narrative_approve(:alpha, :'first_id', 'introduction', NULL, 'Typed by hand in another tab')->>'outcome' = 'stale-answers', 'a retired draft cannot be approved');

-- Facts: individually, verbatim, against the value shown.
SELECT t.expect(public.company_narrative_approve(:alpha, :'second_id', 'accreditations', 'NICEIC approved contractor', NULL)->>'outcome' = 'applied', 'a fact is approved');
SELECT t.expect((SELECT accreditations FROM public.profiles WHERE id = :alpha) = 'Gas Safe registered, number 123456', 'the fact written is the contractor''s saved answer word for word, whatever text came with the call');
SELECT t.expect((SELECT years_trading IS NULL AND insurance_details IS NULL FROM public.profiles WHERE id = :alpha), 'facts that were not approved are untouched');
SELECT t.expect(public.company_narrative_approve(:alpha, :'second_id', 'accreditations', NULL, 'Gas Safe registered, number 123456')->>'outcome' = 'unavailable', 'a fact is approved once');
UPDATE public.profiles SET years_trading = 3 WHERE id = :alpha;
SELECT t.expect(public.company_narrative_approve(:alpha, :'second_id', 'years_trading', NULL, NULL)->>'current' = '3', 'a changed years-trading value is reported, not overwritten');
SELECT t.expect(public.company_narrative_approve(:alpha, :'second_id', 'years_trading', NULL, '3')->>'outcome' = 'applied', 'and can be approved against the value now shown');
SELECT t.expect((SELECT years_trading FROM public.profiles WHERE id = :alpha) = 9, 'years trading is the number saved in the draft');

-- The introduction, edited by the contractor before approving.
SELECT public.company_narrative_approve(:alpha, :'second_id', 'introduction', E'Alpha Builders fits kitchens.\n\nWe turn up when we say we will.', 'Typed by hand in another tab') AS edited \gset
SELECT t.expect((:'edited'::jsonb) = '{"outcome":"applied","edited":true}'::jsonb, 'an edited introduction is approved and recorded as edited');
SELECT t.expect((SELECT capability_statement FROM public.profiles WHERE id = :alpha) = E'Alpha Builders fits kitchens.\n\nWe turn up when we say we will.', 'the profile holds the approved text, line breaks kept');
SELECT t.expect((SELECT status = 'approved' AND approved_edited AND approved_at IS NOT NULL AND approved_text = E'Alpha Builders fits kitchens.\n\nWe turn up when we say we will.' FROM public.company_narrative_drafts WHERE id = :'second_id'), 'the approval is recorded with the text and that the contractor edited it');
SELECT t.expect(public.company_narrative_approve(:alpha, :'second_id', 'introduction', NULL, E'Alpha Builders fits kitchens.\n\nWe turn up when we say we will.')->>'outcome' = 'unavailable', 'an introduction is approved once per draft');
RESET ROLE;

-- Unedited approval is recorded as not edited.
SET ROLE service_role;
SELECT public.company_interview_save_answer(:beta, 'work', 'Joinery', false, 0, :V);
SELECT public.company_narrative_save_draft(:beta, 'introduction', 'Beta Joinery specialises in joinery.', 'template', 'intro-template-v1', NULL, :V, '[]', '[]', 'Beta in its own words') AS beta_draft \gset
SELECT ((:'beta_draft'::jsonb)->>'id') AS beta_id \gset
RESET ROLE;

-- All or nothing: if the approval cannot be recorded, the profile is not changed.
CREATE FUNCTION t.break_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'record write failed'; END $$;
CREATE TRIGGER break_record BEFORE UPDATE ON public.company_narrative_drafts FOR EACH ROW EXECUTE FUNCTION t.break_record();
SET ROLE service_role;
SELECT t.expect(t.fails(format($q$ SELECT public.company_narrative_approve('bbbbbbbb-0000-0000-0000-000000000002', %L, 'introduction', NULL, 'Beta in its own words') $q$, :'beta_id')), 'an approval that cannot be recorded fails');
SELECT t.expect((SELECT capability_statement FROM public.profiles WHERE id = :beta) = 'Beta in its own words', 'and the profile change is rolled back with it');
RESET ROLE;
DROP TRIGGER break_record ON public.company_narrative_drafts;
SET ROLE service_role;
SELECT t.expect(public.company_narrative_approve(:beta, :'beta_id', 'introduction', NULL, 'Beta in its own words') = '{"outcome":"applied","edited":false}'::jsonb, 'the same approval succeeds on retry, recorded as not edited');
RESET ROLE;

SELECT t.expect((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.company_interview_answers'::regclass, 'public.company_narrative_drafts'::regclass)), 'row level security is on for both tables');
SELECT t.expect(NOT has_table_privilege('authenticated', 'public.company_interview_answers', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'the browser role holds no write privilege on answers');
SELECT t.expect(NOT has_table_privilege('authenticated', 'public.company_narrative_drafts', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'the browser role holds no write privilege on drafts');
SELECT t.expect((SELECT count(*) FROM pg_proc WHERE proname LIKE 'company\_interview\_%' OR proname LIKE 'company\_narrative\_%') = 4
  AND (SELECT bool_and(prosrc NOT ILIKE '%company_import%') FROM pg_proc WHERE proname LIKE 'company\_interview\_%' OR proname LIKE 'company\_narrative\_%'), 'no interview function refers to website-import drafts');
SQL

# ── Several first saves of the same answer at once ────────────────────────────
for i in 1 2 3 4 5 6; do
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.company_interview_save_answer('cccccccc-0000-0000-0000-000000000003', 'work', 'tab $i', false, 0, 'interview-v1')->>'outcome';" > "$TEST_DIR/save.$i" &
done
wait
saved="$(cat "$TEST_DIR"/save.* | grep -c '^saved$' || true)"
conflict="$(cat "$TEST_DIR"/save.* | grep -c '^conflict$' || true)"
if [[ "$saved" != "1" || "$conflict" != "5" ]]; then
  echo "FAILED: six simultaneous first saves gave $saved saved and $conflict conflicts; expected 1 and 5." >&2
  exit 1
fi

echo "company interview: revisions, read-only boundary, atomic approval and tenant isolation hold"
