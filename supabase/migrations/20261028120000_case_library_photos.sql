-- A038: up to three photos per library case study (url + optional caption).
-- SOURCE ONLY: not applied. Application rules live in src/lib/case-library/photos.ts
-- and content.ts; shared vectors prove TS/SQL parity when this is applied.
--
-- The content contract goes from twelve keys to thirteen. The table's CHECKs run
-- on every UPDATE of a row, including the revision moves made by the discipline
-- functions and the write made by approval, so a twelve-key row left behind could
-- never be changed again. Every stored draft and approved copy is therefore
-- carried to three empty slots here, in one transaction, in this order:
--
--   1. Lock out writers (readers carry on) so that no twelve-key row can be
--      committed behind the transition.
--   2. Replace the rules, and fix who may run the two new ones.
--   3. Add the empty slots to the draft and the approved copy in one UPDATE: each
--      CHECK reads only its own column, but a row must pass both on one write.
--   4. Refuse to commit unless every row now passes the new rules.
--
-- The transition adds one key and changes nothing else. Slots are always empty:
-- no picture is taken from profiles.case_studies, and an approved copy gains no
-- content the contractor did not approve. revision, approved_revision,
-- approved_at and updated_at do not move, so a case study that matched its
-- approved copy still does, and one that had moved on still has. Running this
-- again changes no row.
--
-- RELEASE: after this is applied, a write of twelve keys is refused with the
-- problem 'keys'. CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE (content.ts) is false in the
-- current build, so that build must not run against this schema: this migration
-- and a build that sends thirteen keys have to be released together. Applying
-- this does not change the constant.

BEGIN;

-- Conflicts with every writer and with no reader. Before anything else: a writer
-- already past its checks either finishes first, and is carried below, or waits
-- and then meets the new CHECK.
LOCK TABLE public.case_studies IN SHARE ROW EXCLUSIVE MODE;

-- CASE, not AND: AND does not promise an order, and the jsonb functions below
-- raise an error on a value of the wrong type. Always true or false, never NULL.
CREATE OR REPLACE FUNCTION public.case_library_photo_slot_ok(p_slot jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN jsonb_typeof(p_slot) IS DISTINCT FROM 'object' THEN false
        WHEN (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_slot) AS k)
             IS DISTINCT FROM ARRAY['caption', 'url'] THEN false
        WHEN NOT public.case_library_text_ok(p_slot -> 'url', 0, 2000, false) THEN false
        WHEN NOT public.case_library_text_ok(p_slot -> 'caption', 0, 300, false) THEN false
        ELSE btrim(p_slot ->> 'url', ' ') = ''
            OR btrim(p_slot ->> 'url', ' ') ~ '^https://'
            OR btrim(p_slot ->> 'url', ' ') ~ '^http://(localhost|127\.0\.0\.1)([:/]|$)'
    END;
$$;

CREATE OR REPLACE FUNCTION public.case_library_photos_ok(p_photos jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN jsonb_typeof(p_photos) IS DISTINCT FROM 'array' THEN false
        WHEN jsonb_array_length(p_photos) <> 3 THEN false
        ELSE NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_photos) AS slot
            WHERE public.case_library_photo_slot_ok(slot) IS NOT TRUE
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.case_library_content_problem(p_content jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_content IS NULL OR jsonb_typeof(p_content) <> 'object' THEN 'not-object'
        WHEN (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_content) AS k)
             IS DISTINCT FROM ARRAY['client_display', 'client_named_ok', 'client_text', 'delivered', 'duration_text', 'photos', 'place', 'show_value', 'title', 'value_added', 'value_text', 'version', 'work_type'] THEN 'keys'
        WHEN p_content -> 'version' IS DISTINCT FROM '1'::jsonb THEN 'version'
        WHEN NOT public.case_library_text_ok(p_content -> 'title', 1, 200, false) OR (p_content ->> 'title') <> btrim(p_content ->> 'title', ' ') THEN 'title'
        WHEN NOT public.case_library_text_ok(p_content -> 'work_type', 0, 200, false) THEN 'work_type'
        WHEN NOT public.case_library_text_ok(p_content -> 'place', 0, 200, false) THEN 'place'
        WHEN jsonb_typeof(p_content -> 'client_display') <> 'string' OR (p_content ->> 'client_display') NOT IN ('hidden', 'described', 'named') THEN 'client_display'
        WHEN NOT public.case_library_text_ok(p_content -> 'client_text', 0, 200, false) THEN 'client_text'
        WHEN jsonb_typeof(p_content -> 'client_named_ok') <> 'boolean' THEN 'client_named_ok'
        WHEN NOT public.case_library_text_ok(p_content -> 'value_text', 0, 50, false) THEN 'value_text'
        WHEN jsonb_typeof(p_content -> 'show_value') <> 'boolean' THEN 'show_value'
        WHEN NOT public.case_library_text_ok(p_content -> 'duration_text', 0, 100, false) THEN 'duration_text'
        WHEN NOT public.case_library_text_ok(p_content -> 'delivered', 0, 5000, true) THEN 'delivered'
        WHEN NOT public.case_library_text_ok(p_content -> 'value_added', 0, 5000, true) THEN 'value_added'
        WHEN NOT public.case_library_photos_ok(p_content -> 'photos') THEN 'photos'
        ELSE NULL
    END;
$$;

-- As for every other rule function: nothing for a browser role, and the service
-- role needs both because the table's CHECKs run as whoever writes.
REVOKE ALL ON FUNCTION public.case_library_photo_slot_ok(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_photos_ok(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.case_library_photo_slot_ok(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_photos_ok(jsonb) TO service_role;

-- A key is only ever added. A row with anything else wrong keeps it, and is
-- caught by a CHECK or by the test below. Nothing is rewritten to make it pass.
UPDATE public.case_studies
SET draft = CASE WHEN draft -> 'photos' IS NULL THEN draft || empty.photos ELSE draft END,
    approved = CASE WHEN approved IS NOT NULL AND approved -> 'photos' IS NULL THEN approved || empty.photos ELSE approved END
FROM (SELECT '{"photos":[{"url":"","caption":""},{"url":"","caption":""},{"url":"","caption":""}]}'::jsonb AS photos) AS empty
WHERE draft -> 'photos' IS NULL
   OR (approved IS NOT NULL AND approved -> 'photos' IS NULL);

-- Names no row and quotes no content: this message can reach a deployment log.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.case_studies
        WHERE public.case_library_content_problem(draft) IS NOT NULL
           OR (approved IS NOT NULL AND public.case_library_approved_problem(approved) IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'A stored case study does not meet the thirteen-key contract. Nothing was changed.' USING ERRCODE = 'check_violation';
    END IF;
END;
$$;

COMMIT;
