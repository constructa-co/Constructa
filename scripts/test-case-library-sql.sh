#!/usr/bin/env bash
# Stage 2G.4 (G4A1): the case-study library foundation, in a throwaway local
# Postgres. No hosted project is contacted.
#
# Proves that:
#   - the migration applies cleanly and changes nothing that already existed:
#     profiles keeps its rows, its privileges and its (absent) triggers;
#   - the SQL rules give the same answer as the application's rules on the
#     shared vectors (src/lib/case-library/__fixtures__/contract-vectors.json);
#   - a signed-in contractor can read their own rows and write nothing, by
#     table or by function; another contractor and a signed-out visitor can
#     do nothing; no function is SECURITY DEFINER or open to a browser role;
#   - a link between one contractor's case study and another's discipline is
#     impossible even for the service role writing the table directly;
#   - limits (12 disciplines, 50 case studies, 6 tags, one adoption per older
#     entry) hold when several writers arrive at once;
#   - a save names the revision it replaces; every change to the draft, the
#     tags, a tag's label, its place in the list or its archived state moves
#     the case study's revision;
#   - a discipline has its own revision: a rename, a move or an archive must
#     name the one it replaces, a stale or missing one is refused and changes
#     nothing, also when six arrive at once; there is no unversioned form;
#   - approval copies the draft and the active tag labels by value, blanks a
#     hidden client and an unshown figure, changes nothing else, and is
#     refused if anything moved since the contractor was shown it, also when
#     the change and the approval arrive together;
#   - an adopted older entry is fingerprinted by the database from what is
#     stored, and the older entry is not changed;
#   - the reads the application's pages make return only the signed-in
#     contractor's rows, in the shape asked for, and nothing to anyone else;
#   - the photos migration carries real twelve-key drafts and approved copies,
#     written through the foundation's own functions, to three empty slots:
#     text, privacy, revisions, approval binding, tags and owners do not move,
#     a writer in flight is not left behind, a row it cannot carry stops the
#     whole migration, and a second run changes nothing;
#   - malformed photos are refused, never accepted and never a jsonb error.
#
# The shared vectors are the twelve-key contract, so they run before the photos
# migration, and again after it with empty slots added.
#
# It ends with a role matrix for a POSSIBLE later trigger. No trigger is
# installed by the migration; the matrix only records what a trigger would be
# able to see, so that a later design does not assume it.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-case-library.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55458}"
MIGRATION="$ROOT_DIR/supabase/migrations/20261012090000_case_library_foundation.sql"
PHOTO_MIGRATION="$ROOT_DIR/supabase/migrations/20261028120000_case_library_photos.sql"
VECTORS="$ROOT_DIR/src/lib/case-library/__fixtures__/contract-vectors.json"
PHOTO_VECTORS="$TEST_DIR/photo-vectors.json"

fail() { echo "FAILED: $1" >&2; exit 1; }

cleanup() {
  if [[ -f "$TEST_DIR/data/postmaster.pid" ]]; then
    "$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$TEST_DIR/data" --auth=trust --no-locale -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -l "$TEST_DIR/postgres.log" \
  -o "-p $PORT -k $TEST_DIR" start >/dev/null

PSQL=("$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$TEST_DIR" -p "$PORT" -d postgres)

ALPHA='aaaaaaaa-0000-0000-0000-000000000001'
BETA='bbbbbbbb-0000-0000-0000-000000000002'
GAMMA='cccccccc-0000-0000-0000-000000000003'
DELTA='dddddddd-0000-0000-0000-000000000004'

# [name, the value of `photos`, the answer]. Read by
# src/lib/case-library/photo-migration-source.test.ts too, so the application's
# strict rule is held to the same list. Synthetic urls only.
cat > "$PHOTO_VECTORS" <<'JSON'
[
 ["three empty slots", [{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}], null],
 ["a picture with a caption", [{"url":"https://images.example.test/a.jpg","caption":"Before"},{"url":"","caption":""},{"url":"","caption":""}], null],
 ["three pictures", [{"url":"https://images.example.test/a.jpg","caption":""},{"url":"https://images.example.test/b.jpg","caption":""},{"url":"https://images.example.test/c.jpg","caption":""}], null],
 ["a caption with no picture", [{"url":"","caption":"Before"},{"url":"","caption":""},{"url":"","caption":""}], null],
 ["a url of spaces is an empty slot", [{"url":"   ","caption":""},{"url":"","caption":""},{"url":"","caption":""}], null],
 ["local http with a port", [{"url":"http://localhost:3000/a.jpg","caption":""},{"url":"http://127.0.0.1/a.jpg","caption":""},{"url":"","caption":""}], null],
 ["json null", null, "photos"],
 ["a string", "x", "photos"],
 ["a number", 3, "photos"],
 ["a boolean", true, "photos"],
 ["an object", {}, "photos"],
 ["no slots", [], "photos"],
 ["two slots", [{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["four slots", [{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a null slot", [null,{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a bare url string", ["https://images.example.test/a.jpg",{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a number slot", [3,{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["an array slot", [[],{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["an empty object slot", [{},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a slot with no caption", [{"url":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a slot with no url", [{"caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a slot with an extra key", [{"url":"","caption":"","path":"x"},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a number url", [{"url":1,"caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a null url", [{"url":null,"caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a number caption", [{"url":"","caption":1},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a null caption", [{"url":"","caption":null},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a bad slot last", [{"url":"","caption":""},{"url":"","caption":""},{"url":"javascript:alert(1)","caption":""}], "photos"],
 ["an unsafe scheme", [{"url":"javascript:alert(1)","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["capitals in the scheme", [{"url":"HTTPS://images.example.test/a.jpg","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["plain http elsewhere", [{"url":"http://images.example.test/a.jpg","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a host that only starts like localhost", [{"url":"http://localhost.example.test/a.jpg","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["one slash", [{"url":"https:/images.example.test/a.jpg","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a line break in a url", [{"url":"https://images.example.test/\na.jpg","caption":""},{"url":"","caption":""},{"url":"","caption":""}], "photos"],
 ["a tab in a caption", [{"url":"","caption":"a\tb"},{"url":"","caption":""},{"url":"","caption":""}], "photos"]
]
JSON

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

-- profiles as the application has it for this purpose: self-only rows, and
-- the table-wide privileges the browser role really holds.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_name text,
  case_studies jsonb DEFAULT '[]'::jsonb
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003'),
  ('dddddddd-0000-0000-0000-000000000004'),
  ('eeeeeeee-0000-0000-0000-000000000005');
INSERT INTO public.profiles (id, company_name, case_studies) VALUES
  ('eeeeeeee-0000-0000-0000-000000000005', 'Epsilon Extensions', '[{"projectName":"Older extension","photos":["https://images.example.test/older.jpg"]}]'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Builders', '[{"id":"cs-a","projectName":"Kitchen","client":"Mrs Older"},{"projectName":"Loft"},"not an object"]'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Beta Joinery', '[{"projectName":"Stairs"}]'),
  ('cccccccc-0000-0000-0000-000000000003', 'Gamma Roofing', '[{"projectName":"Roof"}]'),
  ('dddddddd-0000-0000-0000-000000000004', 'Delta Tiling', '[]');

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

-- What existed before, to compare after the migration.
CREATE TABLE t.before AS
  SELECT (SELECT md5(string_agg(p::text, '|' ORDER BY id)) FROM public.profiles p) AS profiles,
         (SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'profiles') AS grants,
         (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal) AS triggers,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') AS policies;
SQL

"${PSQL[@]}" -f "$MIGRATION" >/dev/null

"${PSQL[@]}" -v vectors_file="$VECTORS" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set vectors `cat :'vectors_file'`
CREATE TABLE t.vectors AS SELECT :'vectors'::jsonb AS doc;
GRANT SELECT ON ALL TABLES IN SCHEMA t TO service_role;

-- ── Nothing that existed was changed ─────────────────────────────────────────
SELECT t.expect((SELECT md5(string_agg(p::text, '|' ORDER BY id)) FROM public.profiles p) = (SELECT profiles FROM t.before), 'no profile row was changed by the migration');
SELECT t.expect((SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'profiles') = (SELECT grants FROM t.before), 'privileges on profiles are exactly as they were');
SELECT t.expect((SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal) = (SELECT triggers FROM t.before) AND (SELECT triggers FROM t.before) = 0, 'no trigger was added to profiles: nothing is frozen');
SELECT t.expect((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') = (SELECT policies FROM t.before), 'policies on profiles are as they were');
SELECT t.expect((SELECT count(*) FROM public.case_studies) = 0 AND (SELECT count(*) FROM public.contractor_disciplines) = 0, 'no existing case study was copied into the new tables');
SELECT t.expect((SELECT array_agg(c.relname::text ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'profiles') = ARRAY['case_studies', 'case_study_disciplines', 'contractor_disciplines'], 'exactly three tables were added, and no asset table');

-- ── The SQL rules agree with the application's, on the shared vectors ───────
SELECT t.expect((SELECT count(*) FROM t.vectors, jsonb_array_elements(doc -> 'content') AS v) = 49, 'all content vectors were loaded');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'content') AS v
  WHERE public.case_library_content_problem(v -> 1) IS DISTINCT FROM (v ->> 2)
), 'content rules: SQL gives the listed answer for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'approval') AS v
  WHERE public.case_library_approval_problem(v -> 1) IS DISTINCT FROM (v ->> 2)
), 'approval rules: SQL gives the listed answer for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'approved') AS v
  WHERE public.case_library_approved_problem(v -> 1) IS DISTINCT FROM (v ->> 2)
), 'stored approved copy rules: SQL gives the listed answer for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'approvedValue') AS v
  WHERE public.case_library_approved_value(v -> 1, ARRAY(SELECT jsonb_array_elements_text(v -> 2))) IS DISTINCT FROM (v -> 3)
), 'the approved copy SQL builds is the one the application builds');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'labels') AS v
  WHERE public.case_library_label_key(v ->> 0) IS DISTINCT FROM (v ->> 1) OR public.case_library_label_problem(v ->> 0) IS DISTINCT FROM (v ->> 2)
), 'label rules: SQL gives the listed key and answer for every vector');
SELECT t.expect((SELECT count(*) FROM t.vectors, jsonb_array_elements(doc -> 'approval') AS v) = 12 AND (SELECT count(*) FROM t.vectors, jsonb_array_elements(doc -> 'approved') AS v) = 16 AND (SELECT count(*) FROM t.vectors, jsonb_array_elements(doc -> 'labels') AS v) = 14 AND (SELECT count(*) FROM t.vectors, jsonb_array_elements(doc -> 'approvedValue') AS v) = 3, 'every vector set was loaded in full');
SQL

# ── Real twelve-key rows, written by the foundation's own functions ──────────
"${PSQL[@]}" >/dev/null <<'SQL'
\set epsilon '''eeeeeeee-0000-0000-0000-000000000005'''
\set twelve '''{"version":1,"title":"Seed","work_type":"Extension","place":"York","client_display":"hidden","client_text":"Mrs Private","client_named_ok":false,"value_text":"£40,000","show_value":false,"duration_text":"9 weeks","delivered":"We built it.\\nOn time.","value_added":"No fuss."}'''
SET ROLE service_role;
SELECT (public.case_library_discipline_save(:epsilon, NULL, 0, 'Extensions', 0)) ->> 'id' AS seed_tag \gset

SELECT (public.case_study_create(:epsilon, jsonb_set(:twelve::jsonb, '{title}', '"Never approved"'), NULL)) ->> 'id' AS seed_never \gset

SELECT (public.case_study_create(:epsilon, jsonb_set(:twelve::jsonb, '{title}', '"Approved and current"'), NULL)) ->> 'id' AS seed_current \gset
SELECT public.case_study_set_disciplines(:epsilon, :'seed_current', 1, ARRAY[:'seed_tag']::uuid[]);
SELECT t.expect(public.case_study_approve(:epsilon, :'seed_current', 2, true) ->> 'outcome' = 'approved', 'seed: a twelve-key draft is approved');

SELECT (public.case_study_create(:epsilon, jsonb_set(:twelve::jsonb, '{title}', '"Approved then edited"'), NULL)) ->> 'id' AS seed_moved \gset
SELECT public.case_study_approve(:epsilon, :'seed_moved', 1, true);
SELECT public.case_study_save_draft(:epsilon, :'seed_moved', 1, jsonb_set(:twelve::jsonb, '{title}', '"Approved then edited"') || '{"delivered":"Edited after approval."}'::jsonb);

SELECT (public.case_study_create(:epsilon, jsonb_set(:twelve::jsonb, '{title}', '"Approved and archived"'), NULL)) ->> 'id' AS seed_archived \gset
SELECT public.case_study_approve(:epsilon, :'seed_archived', 1, true);
SELECT public.case_study_archive(:epsilon, :'seed_archived', 1, true);

SELECT (public.case_study_create(:epsilon, jsonb_set(:twelve::jsonb, '{title}', '"From an older entry"'), 0)) ->> 'id' AS seed_adopted \gset
SELECT public.case_study_approve(:epsilon, :'seed_adopted', 1, true);
RESET ROLE;

CREATE TABLE t.legacy_rows AS SELECT * FROM public.case_studies;
CREATE TABLE t.legacy_links AS SELECT * FROM public.case_study_disciplines;
CREATE TABLE t.legacy_disciplines AS SELECT * FROM public.contractor_disciplines;
SELECT t.expect((SELECT count(*) FROM t.legacy_rows) = 5 AND (SELECT count(*) FILTER (WHERE approved IS NOT NULL) FROM t.legacy_rows) = 4 AND (SELECT count(*) FROM t.legacy_links) = 1, 'seed: five drafts, four approved copies, one tag');
SELECT t.expect(NOT EXISTS (SELECT 1 FROM t.legacy_rows WHERE draft ? 'photos' OR coalesce(approved ? 'photos', false)), 'seed: every stored value really is the twelve-key shape');
SELECT t.expect((SELECT approved_revision < revision FROM t.legacy_rows WHERE draft ->> 'title' = 'Approved then edited'), 'seed: one approved copy is behind its draft');

-- A row the transition cannot make valid, with the rule that would have stopped it lifted.
ALTER TABLE public.case_studies DROP CONSTRAINT case_studies_draft;
INSERT INTO public.case_studies (user_id, draft)
  SELECT user_id, draft || '{"stray":true}'::jsonb FROM t.legacy_rows WHERE draft ->> 'title' = 'Never approved';
SQL

# A row it cannot carry stops the whole migration, and nothing is half done.
if "${PSQL[@]}" -f "$PHOTO_MIGRATION" >/dev/null 2>"$TEST_DIR/refused.log"; then
  fail "the photos migration committed with a row it could not carry."
fi
grep -q 'does not meet the thirteen-key contract' "$TEST_DIR/refused.log" || fail "the photos migration failed for some other reason: $(cat "$TEST_DIR/refused.log")"
"${PSQL[@]}" >/dev/null <<'SQL'
SELECT t.expect(to_regprocedure('public.case_library_photos_ok(jsonb)') IS NULL AND to_regprocedure('public.case_library_photo_slot_ok(jsonb)') IS NULL, 'a refused migration left no new function');
SELECT t.expect(public.case_library_content_problem((SELECT draft FROM t.legacy_rows LIMIT 1)) IS NULL, 'a refused migration left the twelve-key rule in place');
SELECT t.expect(NOT EXISTS (SELECT * FROM t.legacy_rows EXCEPT SELECT * FROM public.case_studies), 'a refused migration changed no row');
DELETE FROM public.case_studies WHERE draft ? 'stray';
ALTER TABLE public.case_studies ADD CONSTRAINT case_studies_draft CHECK (public.case_library_content_problem(draft) IS NULL AND pg_column_size(draft) <= 65536);
SQL

# A new twelve-key row, still uncommitted when the migration starts. Its row
# cannot be seen or waited on by the UPDATE, so only the table lock can keep it
# from being committed behind the transition.
LATE='{"version":1,"title":"Written while the migration waited","work_type":"","place":"","client_display":"hidden","client_text":"","client_named_ok":false,"value_text":"","show_value":false,"duration_text":"","delivered":"","value_added":""}'
"${PSQL[@]}" -At -c "SET ROLE service_role; BEGIN; SELECT public.case_study_create('eeeeeeee-0000-0000-0000-000000000005', '$LATE'::jsonb, NULL); SELECT pg_sleep(1.5); COMMIT;" >/dev/null &
LATE_WRITER=$!
sleep 0.4
"${PSQL[@]}" -f "$PHOTO_MIGRATION" >/dev/null
wait "$LATE_WRITER"

# A second run changes no row, not even a timestamp.
"${PSQL[@]}" >/dev/null <<'SQL'
CREATE TABLE t.after_first_run AS SELECT * FROM public.case_studies;
SQL
"${PSQL[@]}" -f "$PHOTO_MIGRATION" >/dev/null

"${PSQL[@]}" -v photo_vectors_file="$PHOTO_VECTORS" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set epsilon '''eeeeeeee-0000-0000-0000-000000000005'''
\set slots '[{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}]'
\set photo_vectors `cat :'photo_vectors_file'`
CREATE TABLE t.photo_vectors AS SELECT value AS v FROM jsonb_array_elements(:'photo_vectors'::jsonb);
CREATE TABLE t.valid_content AS SELECT (v -> 1) || jsonb_build_object('photos', :'slots'::jsonb) AS content FROM t.vectors, jsonb_array_elements(doc -> 'content') AS v WHERE v ->> 0 = 'a complete, ordinary draft';
GRANT SELECT ON ALL TABLES IN SCHEMA t TO service_role;

-- ── The transition ───────────────────────────────────────────────────────────
SELECT t.expect(NOT EXISTS (SELECT * FROM t.after_first_run EXCEPT SELECT * FROM public.case_studies) AND NOT EXISTS (SELECT * FROM public.case_studies EXCEPT SELECT * FROM t.after_first_run), 'a second run of the migration changed nothing');
SELECT t.expect((SELECT count(*) FROM public.case_studies c JOIN t.legacy_rows l USING (id)) = 5, 'every seeded row is still there');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM public.case_studies c JOIN t.legacy_rows l USING (id)
  WHERE c.draft IS DISTINCT FROM l.draft || jsonb_build_object('photos', :'slots'::jsonb)
     OR c.approved IS DISTINCT FROM CASE WHEN l.approved IS NULL THEN NULL ELSE l.approved || jsonb_build_object('photos', :'slots'::jsonb) END
), 'each draft and approved copy is exactly what it was, plus three empty slots');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM public.case_studies c JOIN t.legacy_rows l USING (id)
  WHERE (to_jsonb(c) - 'draft' - 'approved') IS DISTINCT FROM (to_jsonb(l) - 'draft' - 'approved')
), 'owner, revision, approved revision, every date and the older-entry record did not move');
SELECT t.expect((SELECT draft ->> 'client_text' = 'Mrs Private' AND approved ->> 'client_text' = '' AND approved ->> 'value_text' = '' AND approved::text NOT LIKE '%Mrs Private%' AND approved::text NOT LIKE '%40,000%' FROM public.case_studies WHERE draft ->> 'title' = 'Approved and current'), 'a hidden client and an unshown figure stay out of the approved copy');
SELECT t.expect(NOT EXISTS (SELECT 1 FROM public.case_studies WHERE draft::text LIKE '%older.jpg%' OR approved::text LIKE '%older.jpg%'), 'no older picture was borrowed');
SELECT t.expect((SELECT draft -> 'photos' = :'slots'::jsonb AND revision = 1 AND user_id = :epsilon FROM public.case_studies WHERE draft ->> 'title' = 'Written while the migration waited'), 'a twelve-key row committed while the migration waited was carried too, not left behind');
SELECT t.expect(NOT EXISTS (SELECT * FROM t.legacy_links EXCEPT SELECT * FROM public.case_study_disciplines) AND (SELECT count(*) FROM public.case_study_disciplines) = 1, 'tags are as they were');
SELECT t.expect(NOT EXISTS (SELECT * FROM t.legacy_disciplines EXCEPT SELECT * FROM public.contractor_disciplines) AND (SELECT count(*) FROM public.contractor_disciplines) = 1, 'disciplines are as they were');
SELECT t.expect((SELECT md5(string_agg(p::text, '|' ORDER BY id)) FROM public.profiles p) = (SELECT profiles FROM t.before), 'no profile row was changed by either migration');
SELECT t.expect((SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'profiles') = (SELECT grants FROM t.before), 'privileges on profiles are still as they were');
SELECT t.expect(NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.case_studies'::regclass AND conname IN ('case_studies_draft', 'case_studies_approved') AND NOT convalidated) AND (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.case_studies'::regclass AND conname IN ('case_studies_draft', 'case_studies_approved')) = 2, 'both table checks are still there and validated');

-- ── Photos: the listed answers, and no jsonb error on any shape ──────────────
SELECT t.expect((SELECT count(*) FROM t.photo_vectors) = 34, 'all photo vectors were loaded');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.photo_vectors, t.valid_content
  WHERE public.case_library_content_problem(jsonb_set(content, '{photos}', v -> 1)) IS DISTINCT FROM (v ->> 2)
), 'photo rules: SQL gives the listed answer for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.photo_vectors, t.valid_content
  WHERE public.case_library_approved_problem(jsonb_set(content, '{photos}', v -> 1) || '{"disciplines":[]}'::jsonb) IS DISTINCT FROM (v ->> 2)
), 'and the same for a stored approved copy');
SELECT t.expect(NOT EXISTS (SELECT 1 FROM t.photo_vectors WHERE public.case_library_photos_ok(v -> 1) IS DISTINCT FROM (v ->> 2 IS NULL)), 'photos_ok is true or false on every vector, never NULL');
SELECT t.expect(public.case_library_photos_ok(NULL) IS FALSE AND public.case_library_photo_slot_ok(NULL) IS FALSE, 'a missing value is false, not NULL');
SELECT t.expect(public.case_library_photo_slot_ok('null') IS FALSE AND public.case_library_photo_slot_ok('"x"') IS FALSE AND public.case_library_photo_slot_ok('3') IS FALSE AND public.case_library_photo_slot_ok('[]') IS FALSE AND public.case_library_photo_slot_ok('{}') IS FALSE, 'a slot of the wrong shape is false, not an error');
SELECT t.expect(public.case_library_content_problem((SELECT content - 'photos' FROM t.valid_content)) = 'keys', 'a draft with no photos key is refused');
SELECT t.expect(public.case_library_content_problem((SELECT content || '{"extra":1}'::jsonb FROM t.valid_content)) = 'keys', 'a draft with a fourteenth key is refused');

-- The limits, counted in characters.
SELECT t.expect(public.case_library_photo_slot_ok(jsonb_build_object('url', 'https://' || repeat('a', 1992), 'caption', repeat('c', 300))) IS TRUE, 'a url of 2000 and a caption of 300 fit');
SELECT t.expect(public.case_library_photo_slot_ok(jsonb_build_object('url', 'https://' || repeat('a', 1993), 'caption', '')) IS FALSE, 'a url of 2001 does not');
SELECT t.expect(public.case_library_photo_slot_ok(jsonb_build_object('url', '', 'caption', repeat('c', 301))) IS FALSE, 'nor a caption of 301');
SELECT t.expect(public.case_library_photo_slot_ok(jsonb_build_object('url', '', 'caption', repeat(U&'\+01F600', 300))) IS TRUE, 'a caption is counted in characters, not bytes');

-- ── The shared twelve-key vectors, as they read on the thirteen-key contract ─
-- With slots added the listed answer stands. The two that already carry a
-- `photos` key now have all thirteen keys, so the photos themselves are refused.
CREATE FUNCTION t.with_slots(p_value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'object' AND p_value -> 'photos' IS NULL
              THEN p_value || '{"photos":[{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}]}'::jsonb
              ELSE p_value END
$$;
SELECT t.expect((SELECT count(*) FROM t.vectors, jsonb_array_elements(doc -> 'content') AS v WHERE v -> 1 -> 'photos' IS NOT NULL) = 2, 'two content vectors already carry photos');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'content') AS v
  WHERE public.case_library_content_problem(t.with_slots(v -> 1)) IS DISTINCT FROM CASE WHEN v -> 1 -> 'photos' IS NULL THEN v ->> 2 ELSE 'photos' END
), 'content rules: unchanged by the slots, for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'approval') AS v
  WHERE public.case_library_approval_problem(t.with_slots(v -> 1)) IS DISTINCT FROM (v ->> 2)
), 'approval rules: unchanged by the slots, for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'approved') AS v
  WHERE public.case_library_approved_problem(t.with_slots(v -> 1)) IS DISTINCT FROM (v ->> 2)
), 'stored approved copy rules: unchanged by the slots, for every vector');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM t.vectors, jsonb_array_elements(doc -> 'approvedValue') AS v
  WHERE public.case_library_approved_value(t.with_slots(v -> 1), ARRAY(SELECT jsonb_array_elements_text(v -> 2))) IS DISTINCT FROM t.with_slots(v -> 3)
), 'the approved copy keeps the slots it was given');

-- ── Carried rows work through the real functions ─────────────────────────────
SET ROLE service_role;
SELECT id AS never FROM public.case_studies WHERE draft ->> 'title' = 'Never approved' \gset
SELECT id AS current_study FROM public.case_studies WHERE draft ->> 'title' = 'Approved and current' \gset
SELECT id AS moved FROM public.case_studies WHERE draft ->> 'title' = 'Approved then edited' \gset
SELECT id AS tag FROM public.contractor_disciplines WHERE user_id = :epsilon \gset
SELECT draft AS current_draft FROM public.case_studies WHERE id = :'current_study' \gset
SELECT approved::text AS current_approved FROM public.case_studies WHERE id = :'current_study' \gset

SELECT t.expect(public.case_study_save_draft(:epsilon, :'never', 1, (:'current_draft'::jsonb) - 'photos') = '{"outcome":"invalid","problem":"keys"}'::jsonb, 'a twelve-key save is refused now, and says why');
SELECT t.expect(public.case_study_create(:epsilon, (:'current_draft'::jsonb) - 'photos', NULL) = '{"outcome":"invalid","problem":"keys"}'::jsonb, 'as is a twelve-key create');
SELECT t.expect(public.case_study_save_draft(:epsilon, :'never', 1, jsonb_set(:'current_draft'::jsonb, '{photos}', '[]')) = '{"outcome":"invalid","problem":"photos"}'::jsonb, 'malformed photos are an answer through the function, not an error');
SELECT t.expect(public.case_study_save_draft(:epsilon, :'never', 1, jsonb_set(:'current_draft'::jsonb, '{photos}', '"x"')) = '{"outcome":"invalid","problem":"photos"}'::jsonb, 'also when they are not a list');
SELECT t.expect(t.fails(format($q$ UPDATE public.case_studies SET draft = jsonb_set(draft, '{photos}', '[]') WHERE id = %L $q$, :'never')), 'even the service role cannot store malformed photos directly');
SELECT t.expect(t.fails(format($q$ UPDATE public.case_studies SET draft = draft - 'photos' WHERE id = %L $q$, :'never')), 'or take the key away again');
SELECT t.expect(t.fails(format($q$ UPDATE public.case_studies SET approved = jsonb_set(approved, '{photos}', '[]') WHERE id = %L $q$, :'current_study')), 'or store them in an approved copy');
SELECT t.expect((SELECT revision FROM public.case_studies WHERE id = :'never') = 1, 'none of those moved the revision');

-- The write that a twelve-key row left behind would have broken.
SELECT t.expect(public.case_library_discipline_save(:epsilon, :'tag', 1, 'Rear extensions', 0) ->> 'revision' = '2', 'renaming a tag on a carried row works');
SELECT t.expect((SELECT revision = 3 AND approved_revision = 2 AND approved::text = :'current_approved' FROM public.case_studies WHERE id = :'current_study'), 'and moves its revision, leaving the approved copy alone');

SELECT t.expect(public.case_study_save_draft(:beta, :'never', 1, :'current_draft'::jsonb) ->> 'outcome' = 'not-found' AND public.case_study_approve(:beta, :'never', 1, true) ->> 'outcome' = 'not-found', 'another contractor still cannot touch a carried row');
SELECT t.expect(public.case_study_approve(:alpha, :'current_study', 3, true) ->> 'outcome' = 'not-found', 'or approve one');
SELECT t.expect(public.case_study_approve(:epsilon, :'moved', 1, true) = '{"outcome":"conflict","revision":2}'::jsonb, 'an approval naming the revision of the old copy is still a conflict: the binding survived');
SELECT t.expect((SELECT approved_revision = 1 AND revision = 2 FROM public.case_studies WHERE id = :'moved'), 'and approved nothing');

SELECT t.expect(public.case_study_approve(:epsilon, :'never', 1, true) ->> 'outcome' = 'approved', 'a carried draft can be approved at the revision it had');
SELECT t.expect((SELECT approved -> 'photos' = :'slots'::jsonb AND approved ->> 'client_text' = '' AND approved_revision = 1 FROM public.case_studies WHERE id = :'never'), 'with empty slots, and the hidden client still hidden');
SELECT t.expect(public.case_study_save_draft(:epsilon, :'never', 1, jsonb_set(:'current_draft'::jsonb, '{photos,0}', '{"url":"https://images.example.test/a.jpg","caption":"Before"}')) = '{"outcome":"saved","revision":2}'::jsonb, 'a real picture can be saved on a carried row');
SELECT t.expect((SELECT approved -> 'photos' = :'slots'::jsonb FROM public.case_studies WHERE id = :'never'), 'and does not reach the approved copy until it is approved');
SELECT t.expect(public.case_study_approve(:epsilon, :'never', 2, true) ->> 'outcome' = 'approved', 'approving it');
SELECT t.expect((SELECT approved #>> '{photos,0,url}' = 'https://images.example.test/a.jpg' AND approved #>> '{photos,0,caption}' = 'Before' AND jsonb_array_length(approved -> 'photos') = 3 FROM public.case_studies WHERE id = :'never'), 'puts the picture in the approved copy');
RESET ROLE;

-- ── Functions: who may run them, and how they run ────────────────────────────
SELECT t.expect((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (p.proname LIKE 'case\_library\_%' OR p.proname LIKE 'case\_study\_%')) = 17, 'fifteen functions were added, and two for photos');
SELECT t.expect(NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND (p.proname LIKE 'case\_library\_%' OR p.proname LIKE 'case\_study\_%')
    AND (p.prosecdef OR p.proconfig IS NULL OR NOT ('search_path=""' = ANY (p.proconfig))
         OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('public', p.oid, 'EXECUTE')
         OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'))
), 'none is SECURITY DEFINER, all have an empty search path, none can be run by a browser role or PUBLIC, all by the service role');

SELECT t.expect((SELECT array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'case\_library\_discipline\_%')
  = ARRAY['case_library_discipline_archive(p_user_id uuid, p_id uuid, p_expected_revision integer, p_archived boolean)', 'case_library_discipline_save(p_user_id uuid, p_id uuid, p_expected_revision integer, p_label text, p_position integer)'],
  'each discipline writer exists once, and only in the form that names a revision');
SELECT t.expect(t.fails($q$ SELECT public.case_library_discipline_save('aaaaaaaa-0000-0000-0000-000000000001'::uuid, NULL::uuid, 'Unversioned'::text, 0) $q$) AND t.fails($q$ SELECT public.case_library_discipline_archive('aaaaaaaa-0000-0000-0000-000000000001'::uuid, gen_random_uuid(), true) $q$), 'there is no way to call either without a revision');
SELECT t.expect((SELECT count(*) FROM public.contractor_disciplines) = 1, 'and those attempts created nothing: only the seeded discipline is there');

-- ── Disciplines ──────────────────────────────────────────────────────────────
SET ROLE service_role;
SELECT public.case_library_discipline_save(:alpha, NULL, 0, 'Kitchen Installation', 0) AS d1 \gset
SELECT t.expect((:'d1'::jsonb) ->> 'outcome' = 'saved' AND (:'d1'::jsonb) ->> 'revision' = '1', 'a discipline is saved, at revision 1');
SELECT (:'d1'::jsonb) ->> 'id' AS kitchen \gset
SELECT t.expect(public.case_library_discipline_save(:alpha, NULL, 0, 'KITCHEN installation', 1) ->> 'outcome' = 'duplicate', 'the same label in other capitals is a duplicate');
SELECT t.expect(public.case_library_discipline_save(:alpha, NULL, 0, ' Kitchens', 1) ->> 'outcome' = 'invalid', 'a label with a space before it is refused, not tidied behind the caller''s back');
SELECT t.expect(public.case_library_discipline_save(:alpha, NULL, 0, repeat('k', 81), 1) ->> 'outcome' = 'invalid', 'an over-long label is refused');
SELECT t.expect(public.case_library_discipline_save(:alpha, NULL, 0, E'Two\nlines', 1) ->> 'outcome' = 'invalid', 'a label with a line break is refused');
SELECT t.expect(public.case_library_discipline_save(:alpha, NULL, 0, 'Tiling', 5000) ->> 'outcome' = 'invalid', 'a position out of range is refused');
SELECT t.expect(t.fails($q$ SELECT public.case_library_discipline_save(NULL, NULL, 0, 'Tiling', 0) $q$), 'a contractor is required');
SELECT (public.case_library_discipline_save(:alpha, NULL, 0, 'Tiling', 1)) ->> 'id' AS tiling \gset
SELECT (public.case_library_discipline_save(:alpha, NULL, 0, 'Roofing', 2)) ->> 'id' AS roofing \gset
SELECT (public.case_library_discipline_save(:beta, NULL, 0, 'Kitchen Installation', 0)) ->> 'id' AS beta_kitchen \gset
SELECT t.expect(:'beta_kitchen' IS NOT NULL, 'another contractor may use the same label');
SELECT t.expect(public.case_library_discipline_save(:alpha, :'beta_kitchen', 1, 'Stolen', 0) ->> 'outcome' = 'not-found', 'one contractor cannot rename another''s discipline');
SELECT t.expect(public.case_library_discipline_archive(:alpha, :'beta_kitchen', 1, true) ->> 'outcome' = 'not-found', 'or archive it');
SELECT t.expect(public.case_library_discipline_save(:alpha, :'tiling', 1, 'Kitchen Installation', 1) ->> 'outcome' = 'duplicate', 'a rename onto an existing label is a duplicate');
SELECT t.expect((SELECT label FROM public.contractor_disciplines WHERE id = :'tiling') = 'Tiling', 'and changed nothing');

-- Twelve active, no more.
SELECT public.case_library_discipline_save(:alpha, NULL, 0, 'Extra ' || n, 10 + n) FROM generate_series(4, 12) AS n;
SELECT t.expect((SELECT count(*) FROM public.contractor_disciplines WHERE user_id = :alpha AND archived_at IS NULL) = 12, 'twelve disciplines are active');
SELECT t.expect(public.case_library_discipline_save(:alpha, NULL, 0, 'Thirteenth', 0) ->> 'outcome' = 'limit', 'a thirteenth is refused');
SELECT id AS extra12 FROM public.contractor_disciplines WHERE user_id = :alpha AND label = 'Extra 12' \gset
SELECT t.expect(public.case_library_discipline_archive(:alpha, :'extra12', 1, true) = jsonb_build_object('outcome', 'saved', 'id', :'extra12', 'revision', 2), 'archiving one');
SELECT (public.case_library_discipline_save(:alpha, NULL, 0, 'Thirteenth', 0)) ->> 'id' AS thirteenth \gset
SELECT t.expect(:'thirteenth' IS NOT NULL, 'makes room for another');
SELECT t.expect(public.case_library_discipline_archive(:alpha, :'extra12', 2, false) ->> 'outcome' = 'limit', 'bringing the archived one back is refused while twelve are active');
SELECT public.case_library_discipline_archive(:alpha, :'thirteenth', 1, true);
SELECT (public.case_library_discipline_save(:alpha, NULL, 0, 'Extra 12', 0)) ->> 'id' AS extra12_again \gset
SELECT t.expect(public.case_library_discipline_archive(:alpha, :'extra12', 2, false) ->> 'outcome' = 'duplicate', 'an archived discipline cannot come back onto a label now in use');
SELECT public.case_library_discipline_archive(:alpha, :'extra12_again', 1, true);
SELECT t.expect((SELECT revision FROM public.contractor_disciplines WHERE id = :'extra12') = 2, 'a refused return from the archive does not move the discipline''s revision');

-- ── Case studies and drafts ──────────────────────────────────────────────────
\set draft '''{"version":1,"title":"Kitchen at Example Road","work_type":"Kitchen Installation","place":"Leeds","client_display":"hidden","client_text":"Mrs Private","client_named_ok":false,"value_text":"£18,500","show_value":false,"duration_text":"3 weeks","delivered":"We refitted the kitchen.","value_added":"The family stayed in the house.","photos":[{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}]}'''
SELECT public.case_study_create(:alpha, :draft::jsonb, NULL) AS created \gset
SELECT t.expect((:'created'::jsonb) ->> 'outcome' = 'saved' AND (:'created'::jsonb) ->> 'revision' = '1', 'a case study starts as a draft at revision 1');
SELECT (:'created'::jsonb) ->> 'id' AS study \gset
SELECT t.expect((SELECT approved IS NULL AND approved_revision IS NULL AND approved_at IS NULL FROM public.case_studies WHERE id = :'study'), 'a new case study has no approved copy');
SELECT t.expect(public.case_study_create(:alpha, (:draft::jsonb || '{"assets":[]}'::jsonb), NULL) = '{"outcome":"invalid","problem":"keys"}'::jsonb, 'an unknown key is refused, not stored');
SELECT t.expect(public.case_study_create(:alpha, (:draft::jsonb || '{"photos":[]}'::jsonb), NULL) = '{"outcome":"invalid","problem":"photos"}'::jsonb, 'a list that is not three slots is refused, not stored');
SELECT t.expect(public.case_study_create(:alpha, '"text"'::jsonb, NULL) ->> 'problem' = 'not-object', 'content that is not an object is refused');
SELECT t.expect(public.case_study_create(:alpha, NULL, NULL) ->> 'outcome' = 'invalid', 'missing content is refused');
SELECT t.expect(t.fails(format($q$ INSERT INTO public.case_studies (user_id, draft) VALUES (%L, '{"title":"x"}') $q$, 'aaaaaaaa-0000-0000-0000-000000000001')), 'even the service role cannot store a malformed draft directly: the table checks it');
SELECT t.expect(t.fails(format($q$ UPDATE public.case_studies SET approved = '{"title":"x"}', approved_revision = 1, approved_at = now() WHERE id = %L $q$, :'study')), 'nor a malformed approved copy');
SELECT t.expect(t.fails(format($q$ UPDATE public.case_studies SET approved = draft || '{"disciplines":[]}'::jsonb, approved_revision = 1, approved_at = now() WHERE id = %L $q$, :'study')), 'nor an approved copy that still carries a hidden client''s name');

SELECT t.expect(public.case_study_save_draft(:alpha, :'study', 1, jsonb_set(:draft::jsonb, '{place}', '"Leeds LS1"')) = '{"outcome":"saved","revision":2}'::jsonb, 'a save that names the current revision goes through');
SELECT t.expect(public.case_study_save_draft(:alpha, :'study', 1, jsonb_set(:draft::jsonb, '{place}', '"Stale tab"')) = '{"outcome":"conflict","revision":2}'::jsonb, 'a save from a stale tab is refused and told the current revision');
SELECT t.expect((SELECT draft ->> 'place' FROM public.case_studies WHERE id = :'study') = 'Leeds LS1', 'the stale save changed nothing');
SELECT t.expect(public.case_study_save_draft(:beta, :'study', 2, :draft::jsonb) ->> 'outcome' = 'not-found', 'another contractor cannot save over it');
SELECT t.expect(public.case_study_save_draft(:alpha, :'study', 2, jsonb_set(:draft::jsonb, '{title}', '""')) ->> 'problem' = 'title', 'an invalid draft is refused');
SELECT t.expect((SELECT revision FROM public.case_studies WHERE id = :'study') = 2, 'and does not move the revision');

-- ── Tags, and the tenant boundary held by constraint ────────────────────────
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 2, ARRAY[:'kitchen', :'tiling']::uuid[]) = '{"outcome":"saved","revision":3}'::jsonb, 'tags are set, and the revision moves');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 2, ARRAY[:'roofing']::uuid[]) ->> 'outcome' = 'conflict', 'a tag change from a stale tab is refused');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 3, ARRAY[:'beta_kitchen']::uuid[]) ->> 'outcome' = 'unknown-discipline', 'another contractor''s discipline cannot be used as a tag');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 3, ARRAY[:'extra12']::uuid[]) ->> 'outcome' = 'unknown-discipline', 'nor an archived one');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 3, ARRAY[:'kitchen', :'kitchen']::uuid[]) ->> 'outcome' = 'invalid', 'nor the same one twice');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 3, ARRAY[:'kitchen', NULL]::uuid[]) ->> 'outcome' = 'invalid', 'nor a missing id');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 3, (SELECT array_agg(id) FROM (SELECT id FROM public.contractor_disciplines WHERE user_id = :alpha AND archived_at IS NULL ORDER BY position LIMIT 7) AS seven)) ->> 'outcome' = 'invalid', 'seven tags are refused');
SELECT t.expect(public.case_study_set_disciplines(:alpha, :'study', 3, ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 5000))) ->> 'outcome' = 'invalid', 'a very long list is refused before anything is looked up');
SELECT t.expect(public.case_study_set_disciplines(:beta, :'study', 3, ARRAY[:'beta_kitchen']::uuid[]) ->> 'outcome' = 'not-found', 'another contractor cannot tag it');
SELECT t.expect((SELECT array_agg(discipline_id::text ORDER BY discipline_id::text) FROM public.case_study_disciplines WHERE case_study_id = :'study') = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[:'kitchen', :'tiling']) AS x) AND (SELECT revision FROM public.case_studies WHERE id = :'study') = 3, 'every refused change left the tags and the revision as they were');

SELECT t.expect(t.fails(format($q$ INSERT INTO public.case_study_disciplines (case_study_id, discipline_id, user_id) VALUES (%L, %L, %L) $q$, :'study', :'beta_kitchen', 'aaaaaaaa-0000-0000-0000-000000000001')), 'the service role itself cannot link one contractor''s case study to another''s discipline');
SELECT t.expect(t.fails(format($q$ INSERT INTO public.case_study_disciplines (case_study_id, discipline_id, user_id) VALUES (%L, %L, %L) $q$, :'study', :'roofing', 'bbbbbbbb-0000-0000-0000-000000000002')), 'nor record a link under another contractor''s name');
SELECT t.expect(t.fails(format($q$ UPDATE public.case_studies SET user_id = %L WHERE id = %L $q$, 'bbbbbbbb-0000-0000-0000-000000000002', :'study')), 'nor move a tagged case study to another contractor');

-- A transaction that is rolled back leaves nothing behind.
BEGIN;
SELECT public.case_study_set_disciplines(:alpha, :'study', 3, ARRAY[:'roofing']::uuid[]);
SELECT public.case_study_create(:alpha, :draft::jsonb, NULL);
ROLLBACK;
SET ROLE service_role;
SELECT t.expect((SELECT revision FROM public.case_studies WHERE id = :'study') = 3 AND (SELECT count(*) FROM public.case_study_disciplines WHERE case_study_id = :'study') = 2 AND (SELECT count(*) FROM public.case_studies WHERE user_id = :alpha) = 1, 'a rolled-back change to tags and a rolled-back new case study left nothing');

-- ── Approval ─────────────────────────────────────────────────────────────────
SELECT md5(p::text) AS profile_before FROM public.profiles p WHERE id = :alpha \gset
SELECT t.expect(public.case_study_approve(:alpha, :'study', 3, false) ->> 'outcome' = 'unconfirmed', 'approval needs the contractor''s confirmation');
SELECT t.expect(public.case_study_approve(:alpha, :'study', 3, NULL) ->> 'outcome' = 'unconfirmed', 'a missing confirmation is not a confirmation');
SELECT t.expect(public.case_study_approve(:alpha, :'study', 2, true) = '{"outcome":"conflict","revision":3}'::jsonb, 'approval of a revision that has moved on is refused');
SELECT t.expect(public.case_study_approve(:beta, :'study', 3, true) ->> 'outcome' = 'not-found', 'another contractor cannot approve it');
SELECT t.expect((SELECT approved IS NULL FROM public.case_studies WHERE id = :'study'), 'nothing was approved by any of those');
SELECT t.expect(public.case_study_approve(:alpha, :'study', 3, true) = '{"outcome":"approved","revision":3}'::jsonb, 'approval of the revision shown goes through');
SELECT approved::text AS approved_v1 FROM public.case_studies WHERE id = :'study' \gset
SELECT t.expect((:'approved_v1'::jsonb) -> 'disciplines' = '["Kitchen Installation","Tiling"]'::jsonb, 'the approved copy holds the tag labels as words, in order');
SELECT t.expect((:'approved_v1'::jsonb) ->> 'client_text' = '' AND (:'approved_v1'::jsonb) ->> 'value_text' = '' AND (:'approved_v1'::jsonb) ->> 'client_display' = 'hidden' AND :'approved_v1' NOT LIKE '%Mrs Private%' AND :'approved_v1' NOT LIKE '%18,500%', 'a hidden client and an unshown figure are not in the approved copy');
SELECT t.expect((SELECT draft ->> 'client_text' = 'Mrs Private' AND draft ->> 'client_display' = 'hidden' AND revision = 3 AND approved_revision = 3 FROM public.case_studies WHERE id = :'study'), 'approval did not change the draft, the client choice or the revision');
SELECT t.expect((SELECT md5(p::text) FROM public.profiles p WHERE id = :alpha) = :'profile_before', 'approval changed nothing on the profile, including the older case studies');

-- Every later change moves the revision and leaves the approved copy alone.
SELECT public.case_study_save_draft(:alpha, :'study', 3, jsonb_set(:draft::jsonb, '{delivered}', '"Edited after approval."'));
SELECT t.expect((SELECT approved::text = :'approved_v1' AND revision = 4 AND approved_revision = 3 FROM public.case_studies WHERE id = :'study'), 'editing the draft: approved copy unchanged, revision ahead of it');
SELECT public.case_study_set_disciplines(:alpha, :'study', 4, ARRAY[:'kitchen', :'tiling', :'roofing']::uuid[]);
SELECT t.expect((SELECT approved::text = :'approved_v1' AND revision = 5 FROM public.case_studies WHERE id = :'study'), 'changing the tags: approved copy unchanged, revision moved');
SELECT t.expect(public.case_library_discipline_save(:alpha, :'tiling', 1, 'Wall and floor tiling', 1) ->> 'revision' = '2', 'the rename names the revision it replaces');
SELECT t.expect((SELECT approved::text = :'approved_v1' AND revision = 6 FROM public.case_studies WHERE id = :'study'), 'renaming a tag: approved copy keeps the old words, revision moved');
SELECT t.expect(public.case_library_discipline_save(:alpha, :'tiling', 2, 'Wall and floor tiling', 1) ->> 'revision' = '2', 'saving a tag exactly as it already is changes nothing');
SELECT t.expect((SELECT revision FROM public.case_studies WHERE id = :'study') = 6, 'and does not move the case study''s revision');
SELECT public.case_library_discipline_archive(:alpha, :'roofing', 1, true);
SELECT t.expect((SELECT approved::text = :'approved_v1' AND revision = 7 FROM public.case_studies WHERE id = :'study'), 'archiving a tag: approved copy unchanged, revision moved');
SELECT t.expect((SELECT count(*) FROM public.case_study_disciplines WHERE case_study_id = :'study') = 3, 'archiving a discipline keeps its links');
-- The contractor was shown revision 5 (before the rename and the archive). Their approval is refused.
SELECT t.expect(public.case_study_approve(:alpha, :'study', 5, true) = '{"outcome":"conflict","revision":7}'::jsonb, 'approval is refused when a tag changed after the contractor was shown it');
SELECT t.expect((SELECT approved::text = :'approved_v1' FROM public.case_studies WHERE id = :'study'), 'and the approved copy is still the first one');
SELECT t.expect(public.case_study_approve(:alpha, :'study', 7, true) ->> 'outcome' = 'approved', 're-approving the current revision goes through');
SELECT t.expect((SELECT approved -> 'disciplines' = '["Kitchen Installation","Wall and floor tiling"]'::jsonb AND approved ->> 'delivered' = 'Edited after approval.' AND approved_revision = 7 FROM public.case_studies WHERE id = :'study'), 'and captures the new words, the renamed tag, and not the archived one');

-- What may and may not be approved.
SELECT public.case_study_save_draft(:alpha, :'study', 7, jsonb_set(jsonb_set(:draft::jsonb, '{client_display}', '"named"'), '{client_text}', '"Mrs Patel"'));
SELECT t.expect(public.case_study_approve(:alpha, :'study', 8, true) = '{"outcome":"not-approvable","problem":"client_not_confirmed"}'::jsonb, 'a client cannot be named without the contractor confirming they agreed');
SELECT t.expect((SELECT approved ->> 'client_display' = 'hidden' AND approved_revision = 7 FROM public.case_studies WHERE id = :'study'), 'and the earlier approved copy, with the client hidden, stands');
SELECT public.case_study_save_draft(:alpha, :'study', 8, :draft::jsonb || '{"client_display":"named","client_text":"Mrs Patel","client_named_ok":true,"show_value":true}'::jsonb);
SELECT t.expect(public.case_study_approve(:alpha, :'study', 9, true) ->> 'outcome' = 'approved', 'with that confirmation it is approved');
SELECT t.expect((SELECT approved ->> 'client_text' = 'Mrs Patel' AND approved ->> 'value_text' = '£18,500' FROM public.case_studies WHERE id = :'study'), 'and the name and figure the contractor chose to show are in the approved copy');

-- ── Archive ──────────────────────────────────────────────────────────────────
SELECT t.expect(public.case_study_archive(:alpha, :'study', 8, true) ->> 'outcome' = 'conflict', 'archiving names the revision too');
SELECT t.expect(public.case_study_archive(:alpha, :'study', 9, true) = '{"outcome":"saved","revision":10}'::jsonb, 'archiving moves the revision');
SELECT t.expect(public.case_study_approve(:alpha, :'study', 10, true) ->> 'outcome' = 'archived', 'an archived case study cannot be approved');
SELECT t.expect((SELECT approved IS NOT NULL FROM public.case_studies WHERE id = :'study'), 'archiving keeps the row and its approved copy');
SELECT t.expect(public.case_study_archive(:alpha, :'study', 10, false) ->> 'outcome' = 'saved', 'and it can be brought back');
SELECT t.expect(public.case_study_archive(:beta, :'study', 11, true) ->> 'outcome' = 'not-found', 'another contractor cannot archive it');

-- ── A discipline's own revision ──────────────────────────────────────────────
\set delta '''dddddddd-0000-0000-0000-000000000004'''
SET ROLE service_role;
SELECT t.expect(public.case_library_discipline_save(:delta, NULL, NULL, 'Kitchens', 0) ->> 'outcome' = 'invalid', 'adding must say there is nothing to replace: no revision is not accepted');
SELECT t.expect(public.case_library_discipline_save(:delta, NULL, 1, 'Kitchens', 0) ->> 'outcome' = 'invalid', 'nor is adding while naming a revision');
SELECT t.expect((SELECT count(*) FROM public.contractor_disciplines WHERE user_id = :delta) = 0, 'neither added anything');
SELECT (public.case_library_discipline_save(:delta, NULL, 0, 'Kitchens', 0)) ->> 'id' AS dk \gset
SELECT (public.case_library_discipline_save(:delta, NULL, 0, 'Tiling', 1)) ->> 'id' AS dt \gset

-- No revision, the adding convention, or a wrong one: a conflict that says where things stand, and no change.
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', NULL, 'Changed', 1) = '{"outcome":"conflict","revision":1}'::jsonb, 'a change that names no revision is a conflict');
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 0, 'Changed', 1) = '{"outcome":"conflict","revision":1}'::jsonb, 'so is a change that uses the adding convention');
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 9, 'Changed', 1) = '{"outcome":"conflict","revision":1}'::jsonb, 'and one that names a revision that never existed');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', NULL, true) = '{"outcome":"conflict","revision":1}'::jsonb AND public.case_library_discipline_archive(:delta, :'dt', 0, true) = '{"outcome":"conflict","revision":1}'::jsonb, 'archiving without the current revision is a conflict too');
SELECT t.expect((SELECT label = 'Tiling' AND position = 1 AND revision = 1 AND archived_at IS NULL FROM public.contractor_disciplines WHERE id = :'dt'), 'none of those changed anything');

-- Two tabs both loaded revision 1. The first renames; the second, unaware, is refused.
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 1, 'Wall tiling', 1) = jsonb_build_object('outcome', 'saved', 'id', :'dt', 'revision', 2), 'the first rename is saved as revision 2');
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 1, 'Floor tiling', 1) = '{"outcome":"conflict","revision":2}'::jsonb, 'the second rename, from a stale tab, is refused and told the current revision');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', 1, true) = '{"outcome":"conflict","revision":2}'::jsonb, 'as is a stale archive');
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 1, 'Wall tiling', 9) = '{"outcome":"conflict","revision":2}'::jsonb, 'and a stale move');
SELECT t.expect((SELECT label = 'Wall tiling' AND position = 1 AND revision = 2 AND archived_at IS NULL FROM public.contractor_disciplines WHERE id = :'dt'), 'the first rename stands');

-- Saving what is already there changes nothing and moves nothing. A stale caller is still told.
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 2, 'Wall tiling', 1) = jsonb_build_object('outcome', 'saved', 'id', :'dt', 'revision', 2), 'saving it as it is succeeds at the same revision');
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 1, 'Wall tiling', 1) = '{"outcome":"conflict","revision":2}'::jsonb, 'but not for a caller that has not seen the current revision');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', 2, false) = jsonb_build_object('outcome', 'saved', 'id', :'dt', 'revision', 2), 'asking for the archived state it already has also changes nothing');

-- Each real change moves the discipline's revision by one.
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 2, 'Wall tiling', 4) ->> 'revision' = '3', 'a move alone is revision 3');
SELECT t.expect(public.case_library_discipline_save(:delta, :'dt', 3, ' bad', 4) ->> 'outcome' = 'invalid' AND public.case_library_discipline_save(:delta, :'dt', 3, 'Kitchens', 4) ->> 'outcome' = 'duplicate', 'a refused label or a duplicate, at the right revision');
SELECT t.expect((SELECT revision FROM public.contractor_disciplines WHERE id = :'dt') = 3, 'moves nothing');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', 3, true) ->> 'revision' = '4', 'archiving is revision 4');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', 4, true) ->> 'revision' = '4', 'archiving again changes nothing');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', 3, true) = '{"outcome":"conflict","revision":4}'::jsonb, 'and a stale caller asking for the same state is still a conflict');
SELECT t.expect(public.case_library_discipline_archive(:delta, :'dt', 4, false) ->> 'revision' = '5', 'bringing it back is revision 5');
SELECT t.expect(public.case_library_discipline_archive(:delta, NULL, 0, true) ->> 'outcome' = 'invalid', 'there is no archiving without saying which');

-- Another contractor learns nothing, not even the revision.
SELECT t.expect(public.case_library_discipline_save(:alpha, :'dt', 5, 'Stolen', 0) = '{"outcome":"not-found"}'::jsonb AND public.case_library_discipline_save(:alpha, :'dt', 1, 'Stolen', 0) = '{"outcome":"not-found"}'::jsonb AND public.case_library_discipline_archive(:alpha, :'dt', 5, true) = '{"outcome":"not-found"}'::jsonb, 'another contractor is told "not found" whatever revision they name');

-- ── A tag's place in the list is part of what an approval captures ───────────
SELECT public.case_library_discipline_save(:delta, :'dt', 5, 'Tiling', 1) \g /dev/null
SELECT (public.case_study_create(:delta, :draft::jsonb, NULL)) ->> 'id' AS ds \gset
SELECT (public.case_study_create(:delta, :draft::jsonb, NULL)) ->> 'id' AS untagged \gset
SELECT public.case_study_set_disciplines(:delta, :'ds', 1, ARRAY[:'dk', :'dt']::uuid[]) \g /dev/null
-- The contractor is shown revision 2: Kitchens, then Tiling. Elsewhere, Kitchens is moved below Tiling.
SELECT t.expect(public.case_library_discipline_save(:delta, :'dk', 1, 'Kitchens', 5) ->> 'revision' = '2', 'a tag is moved down the list');
SELECT t.expect((SELECT revision FROM public.case_studies WHERE id = :'ds') = 3, 'moving a tag moves the revision of a case study tagged with it');
SELECT t.expect((SELECT revision FROM public.case_studies WHERE id = :'untagged') = 1, 'and of no other case study');
SELECT t.expect(public.case_study_approve(:delta, :'ds', 2, true) = '{"outcome":"conflict","revision":3}'::jsonb, 'approval of the order the contractor was shown is refused once the order has changed');
SELECT t.expect((SELECT approved IS NULL FROM public.case_studies WHERE id = :'ds'), 'and nothing is approved in an order nobody was shown');
SELECT t.expect(public.case_study_approve(:delta, :'ds', 3, true) ->> 'outcome' = 'approved', 'approving the current revision goes through');
SELECT t.expect((SELECT approved -> 'disciplines' = '["Tiling","Kitchens"]'::jsonb FROM public.case_studies WHERE id = :'ds'), 'in the order now saved');
-- Moving it back afterwards does not reach into the approved copy.
SELECT public.case_library_discipline_save(:delta, :'dk', 2, 'Kitchens', 0) \g /dev/null
SELECT t.expect((SELECT approved -> 'disciplines' = '["Tiling","Kitchens"]'::jsonb AND approved_revision = 3 AND revision = 4 FROM public.case_studies WHERE id = :'ds'), 'a later move leaves the approved order as approved, and shows as a change since');

-- ── Starting from an older case study ────────────────────────────────────────
SELECT md5(p::text) AS profile_before FROM public.profiles p WHERE id = :alpha \gset
SELECT public.case_study_create(:alpha, :draft::jsonb, 0) AS adopted \gset
SELECT (:'adopted'::jsonb) ->> 'id' AS adopted_id \gset
SELECT t.expect((SELECT legacy_index = 0 AND legacy_fingerprint = (SELECT md5((case_studies -> 0)::text) FROM public.profiles WHERE id = :alpha) FROM public.case_studies WHERE id = :'adopted_id'), 'the database records where the older entry was and a fingerprint of what it read there');
SELECT t.expect(public.case_study_create(:alpha, :draft::jsonb, 0) ->> 'outcome' = 'already-adopted', 'the same older entry cannot be brought in twice');
SELECT t.expect(public.case_study_create(:alpha, :draft::jsonb, 2) ->> 'outcome' = 'legacy-missing', 'an older entry that is not an object cannot be brought in');
SELECT t.expect(public.case_study_create(:alpha, :draft::jsonb, 3) ->> 'outcome' = 'legacy-missing', 'nor a place past the end of the list');
SELECT t.expect(public.case_study_create(:alpha, :draft::jsonb, -1) ->> 'outcome' = 'legacy-missing', 'nor a negative place');
SELECT t.expect(public.case_study_create(:beta, :draft::jsonb, 1) ->> 'outcome' = 'legacy-missing', 'a contractor''s places are looked up in their own list only');
SELECT t.expect((SELECT md5(p::text) FROM public.profiles p WHERE id = :alpha) = :'profile_before', 'bringing an older entry in does not change it');
SELECT t.expect(t.fails(format($q$ INSERT INTO public.case_studies (user_id, draft, legacy_index, legacy_fingerprint) VALUES (%L, (SELECT draft FROM public.case_studies WHERE id = %L), 0, repeat('a', 32)) $q$, 'aaaaaaaa-0000-0000-0000-000000000001', :'adopted_id')), 'the one-adoption rule is a constraint, not only a check in the function');
SELECT public.case_study_archive(:alpha, :'adopted_id', 1, true);
SELECT (public.case_study_create(:alpha, :draft::jsonb, 0)) ->> 'id' AS adopted_again \gset
SELECT t.expect(:'adopted_again' IS NOT NULL, 'after the first is archived the older entry can be brought in again');
SELECT t.expect(public.case_study_archive(:alpha, :'adopted_id', 2, false) ->> 'outcome' = 'already-adopted', 'and then the archived one cannot come back beside it');

-- ── The browser boundary ─────────────────────────────────────────────────────
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT t.expect((SELECT count(*) FROM public.case_studies) = 3 AND (SELECT count(*) FROM public.contractor_disciplines) > 0 AND (SELECT count(*) FROM public.case_study_disciplines) = 3, 'a contractor can read their own case studies, disciplines and tags');
SELECT t.expect(NOT EXISTS (SELECT 1 FROM public.contractor_disciplines WHERE user_id <> 'aaaaaaaa-0000-0000-0000-000000000001') AND NOT EXISTS (SELECT 1 FROM public.case_studies WHERE user_id <> 'aaaaaaaa-0000-0000-0000-000000000001'), 'and nobody else''s');
SELECT t.expect(t.denied($q$ INSERT INTO public.case_studies (user_id, draft) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '{}') $q$), 'a contractor cannot insert a case study directly');
SELECT t.expect(t.denied($q$ UPDATE public.case_studies SET approved = draft $q$), 'or approve one by updating the table');
SELECT t.expect(t.denied($q$ UPDATE public.case_studies SET revision = 1 $q$), 'or rewind a revision');
SELECT t.expect(t.denied($q$ DELETE FROM public.case_studies $q$), 'or delete one');
SELECT t.expect(t.denied($q$ INSERT INTO public.contractor_disciplines (user_id, label, label_key) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'X', 'x') $q$), 'or insert a discipline');
SELECT t.expect(t.denied($q$ UPDATE public.contractor_disciplines SET label = 'X' $q$) AND t.denied($q$ DELETE FROM public.contractor_disciplines $q$), 'or change or delete one');
SELECT t.expect(t.denied($q$ INSERT INTO public.case_study_disciplines (case_study_id, discipline_id, user_id) SELECT c.id, d.id, c.user_id FROM public.case_studies c, public.contractor_disciplines d LIMIT 1 $q$) AND t.denied($q$ DELETE FROM public.case_study_disciplines $q$), 'or write a tag');
SELECT t.expect(t.denied($q$ SELECT public.case_study_create('aaaaaaaa-0000-0000-0000-000000000001', '{}'::jsonb, NULL) $q$), 'a contractor cannot call create');
SELECT t.expect(t.denied($q$ SELECT public.case_study_save_draft('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 1, '{}'::jsonb) $q$), 'or save_draft');
SELECT t.expect(t.denied($q$ SELECT public.case_study_set_disciplines('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 1, ARRAY[]::uuid[]) $q$), 'or set_disciplines');
SELECT t.expect(t.denied($q$ SELECT public.case_study_approve('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 1, true) $q$), 'or approve');
SELECT t.expect(t.denied($q$ SELECT public.case_study_archive('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 1, true) $q$), 'or archive');
SELECT t.expect(t.denied($q$ SELECT public.case_library_discipline_save('aaaaaaaa-0000-0000-0000-000000000001', NULL, 0, 'X', 0) $q$), 'or discipline_save');
SELECT t.expect(t.denied($q$ SELECT public.case_library_discipline_archive('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 1, true) $q$), 'or discipline_archive');
SELECT t.expect(t.denied($q$ SELECT public.case_library_lock('aaaaaaaa-0000-0000-0000-000000000001') $q$), 'or take another contractor''s lock, or their own');
SELECT t.expect(t.denied($q$ SELECT public.case_library_content_problem('{}'::jsonb) $q$) AND t.denied($q$ SELECT public.case_library_approved_value('{}'::jsonb, ARRAY[]::text[]) $q$), 'or run the rule functions');

-- ── The reads the application's pages make, as the contractor's own role ────
-- (src/lib/case-library/store.ts). Still signed in as the first contractor.
SELECT t.expect((SELECT array_agg(id::text) FROM (SELECT id, user_id, approved, approved_revision, archived_at, legacy_index FROM public.case_studies WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND archived_at IS NULL AND approved IS NOT NULL) AS for_proposal) = ARRAY[:'study'], 'the proposal read returns exactly the contractor''s approved, unarchived case studies');
SELECT t.expect((SELECT count(*) FROM public.case_studies WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND archived_at IS NULL AND approved IS NOT NULL) = 1 AND (SELECT count(*) FROM public.case_studies WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND archived_at IS NULL AND approved IS NULL) = 1, 'the two counts: one approved, one not, with the archived one in neither');
SELECT t.expect((SELECT count(*) FROM (SELECT id, user_id, approved_revision, archived_at FROM public.case_studies WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND id IN (:'adopted_id', :'adopted_again')) AS status_only) = 2, 'the status of a ticked case study that cannot be sent is readable without its content');
SELECT t.expect((SELECT count(*) FROM (SELECT id, label, position, revision, archived_at FROM public.contractor_disciplines WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' ORDER BY position, label_key) AS kinds) > 0 AND (SELECT count(*) FROM (SELECT case_study_id, discipline_id FROM public.case_study_disciplines WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND case_study_id = :'study') AS tags) = 3, 'kinds of work and a case study''s tags are readable in the shape the pages ask for');
SELECT t.expect((SELECT jsonb_typeof(case_studies) FROM public.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'array', 'the contractor''s older case studies are readable for starting a new version');

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
SELECT t.expect((SELECT count(*) FROM public.case_studies) = 0 AND (SELECT count(*) FROM public.case_study_disciplines) = 0 AND (SELECT count(*) FROM public.contractor_disciplines) = 1, 'another contractor sees none of it, only their own discipline');
-- The same reads, asked for the first contractor's rows by a different contractor: nothing comes back.
SELECT t.expect((SELECT count(*) FROM public.case_studies WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0 AND (SELECT count(*) FROM public.case_studies WHERE id = :'study') = 0, 'asking by another contractor''s id, or by a case study''s id, returns nothing to someone else');
SELECT t.expect((SELECT count(*) FROM public.contractor_disciplines WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0 AND (SELECT count(*) FROM public.case_study_disciplines WHERE case_study_id = :'study') = 0, 'nor their kinds of work or tags');
SELECT t.expect((SELECT count(*) FROM public.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'nor their older case studies');

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT t.expect(t.denied($q$ SELECT * FROM public.case_studies $q$) AND t.denied($q$ SELECT * FROM public.contractor_disciplines $q$) AND t.denied($q$ SELECT * FROM public.case_study_disciplines $q$), 'a signed-out visitor can read none of the three tables');
SELECT t.expect(t.denied($q$ SELECT public.case_study_approve(gen_random_uuid(), gen_random_uuid(), 1, true) $q$), 'or call anything');
RESET ROLE;
SQL

# ── Several writers at once ───────────────────────────────────────────────────
svc() { "${PSQL[@]}" -At -c "SET ROLE service_role; $1" | tail -n 1; }
tally() { cat "$TEST_DIR"/$1.* | sort | uniq -c | tr -s ' ' | sed 's/^ //' | tr '\n' ';'; }
DRAFT='{"version":1,"title":"Roof","work_type":"","place":"","client_display":"hidden","client_text":"","client_named_ok":false,"value_text":"","show_value":false,"duration_text":"","delivered":"","value_added":"","photos":[{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}]}'

# Eleven active disciplines, then eight different ones at once: one fits.
svc "SELECT public.case_library_discipline_save('$GAMMA', NULL, 0, 'Seed ' || n, n) FROM generate_series(1, 11) AS n;" >/dev/null
for i in 1 2 3 4 5 6 7 8; do svc "SELECT public.case_library_discipline_save('$GAMMA', NULL, 0, 'Racer $i', 0)->>'outcome';" > "$TEST_DIR/disc.$i" & done
wait
[[ "$(tally disc)" == "7 limit;1 saved;" ]] || fail "eight simultaneous disciplines at the limit gave $(tally disc); expected 7 limit and 1 saved."
[[ "$(svc "SELECT count(*) FROM public.contractor_disciplines WHERE user_id = '$GAMMA' AND archived_at IS NULL;")" == "12" ]] || fail "more than twelve disciplines are active after the race."

# The same new label eight times at once, with room for it: one is saved.
svc "SELECT public.case_library_discipline_archive('$GAMMA', id, revision, true) FROM public.contractor_disciplines WHERE user_id = '$GAMMA' AND label LIKE 'Seed%' AND position > 5;" >/dev/null
for i in 1 2 3 4 5 6 7 8; do svc "SELECT public.case_library_discipline_save('$GAMMA', NULL, 0, 'Same Label', 0)->>'outcome';" > "$TEST_DIR/dup.$i" & done
wait
[[ "$(tally dup)" == "7 duplicate;1 saved;" ]] || fail "eight simultaneous identical labels gave $(tally dup); expected 7 duplicate and 1 saved."

# Forty-nine case studies, then eight at once: one fits.
svc "SELECT public.case_study_create('$GAMMA', '$DRAFT'::jsonb, NULL) FROM generate_series(1, 49);" >/dev/null
for i in 1 2 3 4 5 6 7 8; do svc "SELECT public.case_study_create('$GAMMA', '$DRAFT'::jsonb, NULL)->>'outcome';" > "$TEST_DIR/study.$i" & done
wait
[[ "$(tally study)" == "7 limit;1 saved;" ]] || fail "eight simultaneous case studies at the limit gave $(tally study); expected 7 limit and 1 saved."
[[ "$(svc "SELECT count(*) FROM public.case_studies WHERE user_id = '$GAMMA' AND archived_at IS NULL;")" == "50" ]] || fail "more than fifty case studies after the race."

# The same older entry brought in six times at once: once.
svc "UPDATE public.case_studies SET archived_at = now() WHERE id IN (SELECT id FROM public.case_studies WHERE user_id = '$GAMMA' ORDER BY created_at, id LIMIT 10);" >/dev/null
for i in 1 2 3 4 5 6; do svc "SELECT public.case_study_create('$GAMMA', '$DRAFT'::jsonb, 0)->>'outcome';" > "$TEST_DIR/adopt.$i" & done
wait
[[ "$(tally adopt)" == "5 already-adopted;1 saved;" ]] || fail "six simultaneous adoptions gave $(tally adopt); expected 5 already-adopted and 1 saved."

# Six saves naming the same revision at once: one wins.
STUDY="$(svc "SELECT id FROM public.case_studies WHERE user_id = '$GAMMA' AND legacy_index = 0 AND archived_at IS NULL;")"
for i in 1 2 3 4 5 6; do svc "SELECT public.case_study_save_draft('$GAMMA', '$STUDY', 1, jsonb_set('$DRAFT'::jsonb, '{place}', '\"Writer $i\"'))->>'outcome';" > "$TEST_DIR/cas.$i" & done
wait
[[ "$(tally cas)" == "5 conflict;1 saved;" ]] || fail "six simultaneous saves of one revision gave $(tally cas); expected 5 conflict and 1 saved."
[[ "$(svc "SELECT revision FROM public.case_studies WHERE id = '$STUDY';")" == "2" ]] || fail "the revision moved more than once."

# A tag change and an approval, both naming the same revision, at once, twelve
# times over. Whichever goes first, the approved copy must hold exactly the
# tags that were saved at the revision it says it approved.
OLD="$(svc "SELECT id FROM public.contractor_disciplines WHERE user_id = '$GAMMA' AND label = 'Seed 1';")"
NEW="$(svc "SELECT id FROM public.contractor_disciplines WHERE user_id = '$GAMMA' AND label = 'Seed 2';")"
tag_first=0; approve_first=0
for round in 1 2 3 4 5 6 7 8 9 10 11 12; do
  REV="$(svc "SELECT (public.case_study_set_disciplines('$GAMMA', '$STUDY', (SELECT revision FROM public.case_studies WHERE id = '$STUDY'), ARRAY['$OLD']::uuid[]))->>'revision';")"
  BEFORE="$(svc "SELECT coalesce(approved::text, 'none') FROM public.case_studies WHERE id = '$STUDY';")"
  svc "SELECT public.case_study_set_disciplines('$GAMMA', '$STUDY', $REV, ARRAY['$NEW']::uuid[])->>'outcome';" > "$TEST_DIR/race.tag" &
  svc "SELECT public.case_study_approve('$GAMMA', '$STUDY', $REV, true)->>'outcome';" > "$TEST_DIR/race.approve" &
  wait
  TAG="$(cat "$TEST_DIR/race.tag")"; APPROVE="$(cat "$TEST_DIR/race.approve")"
  STATE="$(svc "SELECT revision || '|' || coalesce(approved_revision::text, '') || '|' || coalesce(approved->'disciplines', 'null'::jsonb)::text || '|' || (coalesce(approved::text, 'none') = \$\$${BEFORE}\$\$)::text FROM public.case_studies WHERE id = '$STUDY';")"
  if [[ "$TAG" == "saved" && "$APPROVE" == "conflict" ]]; then
    # The tag change landed first. Nothing may have been approved.
    [[ "$STATE" == "$((REV + 1))|"*"|true" ]] || fail "round $round: approval was refused but the approved copy changed ($STATE)."
    tag_first=$((tag_first + 1))
  elif [[ "$TAG" == "saved" && "$APPROVE" == "approved" ]]; then
    # The approval landed first, at REV, with the old tag. The tag change then moved the revision on.
    [[ "$STATE" == "$((REV + 1))|$REV|[\"Seed 1\"]|"* ]] || fail "round $round: approval at revision $REV does not hold the tags of that revision ($STATE)."
    approve_first=$((approve_first + 1))
  else
    fail "round $round: tag change gave '$TAG' and approval gave '$APPROVE'; the tag change names the current revision and must be saved."
  fi
done

# The same two writers again, but with the order forced: a third session holds
# the contractor's lock while both queue behind it, one clearly before the
# other. This shows the lock is what orders them, and pins both outcomes.
forced() { # $1 = which goes first: tag | approve
  REV="$(svc "SELECT (public.case_study_set_disciplines('$GAMMA', '$STUDY', (SELECT revision FROM public.case_studies WHERE id = '$STUDY'), ARRAY['$OLD']::uuid[]))->>'revision';")"
  BEFORE_REV="$(svc "SELECT coalesce(approved_revision::text, 'none') FROM public.case_studies WHERE id = '$STUDY';")"
  "${PSQL[@]}" -At -c "SET ROLE service_role; BEGIN; SELECT public.case_library_lock('$GAMMA'); SELECT pg_sleep(1.5); COMMIT;" >/dev/null &
  sleep 0.4
  local tag="SELECT public.case_study_set_disciplines('$GAMMA', '$STUDY', $REV, ARRAY['$NEW']::uuid[])->>'outcome';"
  local approve="SELECT public.case_study_approve('$GAMMA', '$STUDY', $REV, true)->>'outcome';"
  if [[ "$1" == "tag" ]]; then
    svc "$tag" > "$TEST_DIR/forced.tag" & sleep 0.4; svc "$approve" > "$TEST_DIR/forced.approve" &
  else
    svc "$approve" > "$TEST_DIR/forced.approve" & sleep 0.4; svc "$tag" > "$TEST_DIR/forced.tag" &
  fi
  wait
  AFTER="$(svc "SELECT revision || '|' || coalesce(approved_revision::text, 'none') || '|' || coalesce(approved->'disciplines', 'null'::jsonb)::text FROM public.case_studies WHERE id = '$STUDY';")"
  echo "$(cat "$TEST_DIR/forced.tag")|$(cat "$TEST_DIR/forced.approve")|$AFTER|$REV|$BEFORE_REV"
}
IFS='|' read -r F_TAG F_APPROVE F_REVISION F_APPROVED_REV F_LABELS F_REV F_BEFORE <<< "$(forced tag)"
[[ "$F_TAG" == "saved" && "$F_APPROVE" == "conflict" && "$F_REVISION" == "$((F_REV + 1))" && "$F_APPROVED_REV" == "$F_BEFORE" ]] \
  || fail "tag change queued first: expected the tag saved, the approval refused and the approved copy untouched; got tag=$F_TAG approve=$F_APPROVE revision=$F_REVISION approved_revision=$F_APPROVED_REV (was $F_BEFORE)."
IFS='|' read -r F_TAG F_APPROVE F_REVISION F_APPROVED_REV F_LABELS F_REV F_BEFORE <<< "$(forced approve)"
[[ "$F_TAG" == "saved" && "$F_APPROVE" == "approved" && "$F_REVISION" == "$((F_REV + 1))" && "$F_APPROVED_REV" == "$F_REV" && "$F_LABELS" == '["Seed 1"]' ]] \
  || fail "approval queued first: expected it approved at revision $F_REV with the old tag, then the tag saved; got tag=$F_TAG approve=$F_APPROVE revision=$F_REVISION approved_revision=$F_APPROVED_REV labels=$F_LABELS."

# Six tabs all loaded the same discipline at the same revision, and each
# changes it differently at once: two renames, two moves, two archives.
D_ID="$(svc "SELECT (public.case_library_discipline_save('$DELTA', NULL, 0, 'Raced', 3))->>'id';")"
D_REV=1
svc "SELECT public.case_library_discipline_save('$DELTA', '$D_ID', $D_REV, 'Raced one', 3)->>'outcome';" > "$TEST_DIR/drace.1" &
svc "SELECT public.case_library_discipline_save('$DELTA', '$D_ID', $D_REV, 'Raced two', 3)->>'outcome';" > "$TEST_DIR/drace.2" &
svc "SELECT public.case_library_discipline_save('$DELTA', '$D_ID', $D_REV, 'Raced', 7)->>'outcome';" > "$TEST_DIR/drace.3" &
svc "SELECT public.case_library_discipline_save('$DELTA', '$D_ID', $D_REV, 'Raced', 8)->>'outcome';" > "$TEST_DIR/drace.4" &
svc "SELECT public.case_library_discipline_archive('$DELTA', '$D_ID', $D_REV, true)->>'outcome';" > "$TEST_DIR/drace.5" &
svc "SELECT public.case_library_discipline_archive('$DELTA', '$D_ID', $D_REV, true)->>'outcome';" > "$TEST_DIR/drace.6" &
wait
[[ "$(tally drace)" == "5 conflict;1 saved;" ]] || fail "six simultaneous changes to one discipline revision gave $(tally drace); expected 5 conflict and 1 saved."
[[ "$(svc "SELECT revision FROM public.contractor_disciplines WHERE id = '$D_ID';")" == "2" ]] || fail "the discipline's revision moved more than once."
# Exactly one of the three kinds of change is what is stored.
[[ "$(svc "SELECT ((label <> 'Raced')::int + (position <> 3)::int + (archived_at IS NOT NULL)::int) FROM public.contractor_disciplines WHERE id = '$D_ID';")" == "1" ]] || fail "more than one of the simultaneous changes was applied."

# A move that changes the approved order, and an approval naming the revision
# shown before it, queued behind a held lock in each order.
PK="$(svc "SELECT id FROM public.contractor_disciplines WHERE user_id = '$DELTA' AND label = 'Kitchens';")"
PS="$(svc "SELECT id FROM public.case_studies WHERE user_id = '$DELTA' AND revision > 1 ORDER BY revision DESC LIMIT 1;")"
forced_move() { # $1 = which goes first: move | approve ; $2 = position to move Kitchens to
  local rev drev before
  rev="$(svc "SELECT revision FROM public.case_studies WHERE id = '$PS';")"
  drev="$(svc "SELECT revision FROM public.contractor_disciplines WHERE id = '$PK';")"
  before="$(svc "SELECT (approved->'disciplines')::text || '@' || approved_revision FROM public.case_studies WHERE id = '$PS';")"
  "${PSQL[@]}" -At -c "SET ROLE service_role; BEGIN; SELECT public.case_library_lock('$DELTA'); SELECT pg_sleep(1.5); COMMIT;" >/dev/null &
  sleep 0.4
  local move="SELECT public.case_library_discipline_save('$DELTA', '$PK', $drev, 'Kitchens', $2)->>'outcome';"
  local approve="SELECT public.case_study_approve('$DELTA', '$PS', $rev, true)->>'outcome';"
  if [[ "$1" == "move" ]]; then
    svc "$move" > "$TEST_DIR/fm.move" & sleep 0.4; svc "$approve" > "$TEST_DIR/fm.approve" &
  else
    svc "$approve" > "$TEST_DIR/fm.approve" & sleep 0.4; svc "$move" > "$TEST_DIR/fm.move" &
  fi
  wait
  echo "$(cat "$TEST_DIR/fm.move")|$(cat "$TEST_DIR/fm.approve")|$(svc "SELECT revision || '|' || (approved->'disciplines')::text || '@' || approved_revision FROM public.case_studies WHERE id = '$PS';")|$rev|$before"
}
# Kitchens is at 0 (above Tiling at 1); the approved copy says Tiling, Kitchens.
IFS='|' read -r M_MOVE M_APPROVE M_REVISION M_APPROVED M_REV M_BEFORE <<< "$(forced_move move 6)"
[[ "$M_MOVE" == "saved" && "$M_APPROVE" == "conflict" && "$M_REVISION" == "$((M_REV + 1))" && "$M_APPROVED" == "$M_BEFORE" ]] \
  || fail "move queued first: expected the move saved, the approval refused and the approved copy untouched; got move=$M_MOVE approve=$M_APPROVE revision=$M_REVISION approved=$M_APPROVED (was $M_BEFORE)."
# Kitchens is now at 6 (below Tiling). Approval first captures Tiling, Kitchens at the revision shown; the move back to 0 then shows as a change since.
IFS='|' read -r M_MOVE M_APPROVE M_REVISION M_APPROVED M_REV M_BEFORE <<< "$(forced_move approve 0)"
[[ "$M_MOVE" == "saved" && "$M_APPROVE" == "approved" && "$M_REVISION" == "$((M_REV + 1))" && "$M_APPROVED" == "[\"Tiling\", \"Kitchens\"]@$M_REV" ]] \
  || fail "approval queued first: expected it approved at revision $M_REV in the order saved then, and the move saved after; got move=$M_MOVE approve=$M_APPROVE revision=$M_REVISION approved=$M_APPROVED."
# And once more with the order the other way round at approval, so the captured order is seen to follow what was saved.
svc "SELECT public.case_study_approve('$DELTA', '$PS', (SELECT revision FROM public.case_studies WHERE id = '$PS'), true);" >/dev/null
[[ "$(svc "SELECT (approved->'disciplines')::text FROM public.case_studies WHERE id = '$PS';")" == '["Kitchens", "Tiling"]' ]] || fail "after the move back, re-approval did not capture Kitchens before Tiling."

# ── What a LATER trigger could see (no trigger is installed by the migration) ─
#
# The writes are made from a login role that is a member of the browser and
# service roles and switches between them, which is how the hosted data API is
# documented to connect. That the hosted project really is set up this way was
# not checked.
"${PSQL[@]}" >/dev/null <<'SQL'
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
CREATE TABLE t.probe (id integer PRIMARY KEY, note text);
CREATE TABLE t.seen (path text, trigger_kind text, cur_user text, sess_user text, role_setting text, claim_role text);
CREATE TABLE t.switching (who text, could_become_service_role boolean);
INSERT INTO t.probe VALUES (1, 'x');
GRANT SELECT, UPDATE ON t.probe TO authenticated, service_role;
GRANT INSERT, SELECT ON t.seen, t.switching TO authenticated, service_role;

CREATE FUNCTION t.note_invoker() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t.seen VALUES (NEW.note, 'invoker', current_user, session_user, current_setting('role', true), current_setting('request.jwt.claim.role', true));
  RETURN NEW;
END $$;
CREATE FUNCTION t.note_definer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO t.seen VALUES (NEW.note, 'definer', current_user, session_user, current_setting('role', true), current_setting('request.jwt.claim.role', true));
  RETURN NEW;
END $$;
CREATE TRIGGER probe_invoker BEFORE UPDATE ON t.probe FOR EACH ROW EXECUTE FUNCTION t.note_invoker();
CREATE TRIGGER probe_definer BEFORE UPDATE ON t.probe FOR EACH ROW EXECUTE FUNCTION t.note_definer();

CREATE FUNCTION t.write_as_caller(p_note text) RETURNS void LANGUAGE sql AS $$ UPDATE t.probe SET note = p_note WHERE id = 1 $$;
CREATE FUNCTION t.write_as_owner(p_note text) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE t.probe SET note = p_note WHERE id = 1 $$;
GRANT EXECUTE ON FUNCTION t.write_as_caller(text), t.write_as_owner(text) TO authenticated, service_role;
SQL

"${PSQL[@]}" -U authenticator >/dev/null <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
UPDATE t.probe SET note = '1 browser role, direct' WHERE id = 1;
SELECT t.write_as_caller('2 browser role, through an ordinary function');
SELECT t.write_as_owner('3 browser role, through a SECURITY DEFINER function');
SELECT set_config('request.jwt.claim.role', 'service_role', false);
UPDATE t.probe SET note = '4 browser role, having set the claim setting itself' WHERE id = 1;
-- Could SQL running as the browser role switch itself to the service role?
INSERT INTO t.switching SELECT 'SQL running as the browser role, in a session whose login role may act as either', NOT t.fails($q$ SET ROLE service_role $q$);
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
UPDATE t.probe SET note = '5 service role, direct' WHERE id = 1;
SELECT t.write_as_caller('6 service role, through an ordinary function');
SELECT t.write_as_owner('7 service role, through a SECURITY DEFINER function');
RESET ROLE;
SQL

"${PSQL[@]}" -At > "$TEST_DIR/matrix.txt" <<'SQL'
\set QUIET on
-- The owner is whoever created the test database; shown as "owner".
SELECT path || ' | trigger ' || trigger_kind
    || ' | current_user=' || CASE WHEN cur_user IN ('authenticated', 'service_role', 'anon') THEN cur_user ELSE 'owner' END
    || ' | session_user=' || sess_user
    || ' | role setting=' || CASE WHEN role_setting IN ('authenticated', 'service_role', 'anon', 'none') THEN role_setting ELSE 'owner' END
    || ' | claim setting=' || coalesce(claim_role, '')
FROM t.seen ORDER BY path, trigger_kind;
SELECT 'switching | ' || who || ' | could become the service role: ' || could_become_service_role FROM t.switching;

SELECT t.expect((SELECT count(*) FROM t.seen) = 14, 'matrix: seven paths were recorded by both triggers');
SELECT t.expect((SELECT cur_user FROM t.seen WHERE path LIKE '1 %' AND trigger_kind = 'invoker') = 'authenticated', 'matrix: a browser write is seen as the browser role');
SELECT t.expect((SELECT cur_user FROM t.seen WHERE path LIKE '5 %' AND trigger_kind = 'invoker') = 'service_role' AND (SELECT cur_user FROM t.seen WHERE path LIKE '6 %' AND trigger_kind = 'invoker') = 'service_role', 'matrix: a service-role write, direct or through an ordinary function, is seen as the service role');
SELECT t.expect((SELECT cur_user FROM t.seen WHERE path LIKE '3 %' AND trigger_kind = 'invoker') = (SELECT cur_user FROM t.seen WHERE path LIKE '7 %' AND trigger_kind = 'invoker') AND (SELECT cur_user FROM t.seen WHERE path LIKE '7 %' AND trigger_kind = 'invoker') NOT IN ('service_role', 'authenticated'), 'matrix: through a SECURITY DEFINER function the browser role and the service role have the same current_user, and it is not the service role');
SELECT t.expect((SELECT count(DISTINCT cur_user) FROM t.seen WHERE trigger_kind = 'definer') = 1, 'matrix: a SECURITY DEFINER trigger function sees its own owner whoever wrote');
SELECT t.expect((SELECT count(DISTINCT sess_user) FROM t.seen) = 1, 'matrix: session_user is the login role on every path, so it tells nothing apart');
SELECT t.expect((SELECT role_setting FROM t.seen WHERE path LIKE '3 %' AND trigger_kind = 'invoker') = 'authenticated' AND (SELECT role_setting FROM t.seen WHERE path LIKE '7 %' AND trigger_kind = 'invoker') = 'service_role', 'matrix: the role setting still differs through a SECURITY DEFINER function');
SELECT t.expect((SELECT could_become_service_role FROM t.switching), 'matrix: but SQL in such a session can switch its own role, so the role setting is only as strong as the rule that the data API runs no arbitrary SQL');
SELECT t.expect((SELECT claim_role FROM t.seen WHERE path LIKE '4 %' AND trigger_kind = 'invoker') = 'service_role' AND (SELECT cur_user FROM t.seen WHERE path LIKE '4 %' AND trigger_kind = 'invoker') = 'authenticated', 'matrix: the claim setting can be set by the session itself, so it proves nothing');
SQL

echo "role matrix for a possible later trigger (nothing is installed):"
grep -E ' \| trigger |^switching' "$TEST_DIR/matrix.txt" | sed 's/^/  /'
echo "approval race: free-running, tag change first in $tag_first rounds and approval first in $approve_first rounds; each order also forced once; consistent every time"
echo "discipline revisions: stale and unversioned changes refused; six simultaneous changes to one revision gave one winner; a move that reorders approved labels is bound to approval in both orders"
echo "photos transition: twelve-key drafts and approved copies carried to three empty slots with text, privacy, revisions, approvals, tags and owners unchanged; a row it could not carry stopped it; a writer in flight was carried; a second run changed nothing"
echo "case library foundation: rules agree with the application, isolation holds, limits hold under simultaneous writers, approval is bound to its revision, nothing existing was changed"
