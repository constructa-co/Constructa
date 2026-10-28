-- A038: up to three photos per library case study (url + optional caption).
-- SOURCE ONLY: not applied. Application rules live in src/lib/case-library/photos.ts
-- and content.ts; shared vectors prove TS/SQL parity when this is applied.

BEGIN;

CREATE OR REPLACE FUNCTION public.case_library_photo_slot_ok(p_slot jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_slot IS NOT NULL
        AND jsonb_typeof(p_slot) = 'object'
        AND (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_slot) AS k) = ARRAY['caption', 'url']::text[]
        AND public.case_library_text_ok(p_slot -> 'url', 0, 2000, false)
        AND public.case_library_text_ok(p_slot -> 'caption', 0, 300, false)
        AND (
            btrim(p_slot ->> 'url', ' ') = ''
            OR (
                btrim(p_slot ->> 'url', ' ') ~ '^https://'
                OR btrim(p_slot ->> 'url', ' ') ~ '^http://(localhost|127\.0\.0\.1)([:/]|$)'
            )
        );
$$;

CREATE OR REPLACE FUNCTION public.case_library_photos_ok(p_photos jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_typeof(p_photos) = 'array'
        AND jsonb_array_length(p_photos) = 3
        AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_photos) AS slot
            WHERE NOT public.case_library_photo_slot_ok(slot)
        );
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

COMMIT;
