-- Stage 2G.4 (G4A1): case-study library foundation. INACTIVE.
--
-- Three tables and the functions that write them. Nothing in the application
-- reads or writes any of this yet: no screen, action or proposal path is
-- changed by this migration, and no existing table, grant, policy, trigger or
-- row is touched. In particular:
--
--   - public.profiles.case_studies is not read into these tables, rewritten,
--     frozen or dropped. Existing case studies work exactly as before.
--   - Nothing here changes who may write public.profiles.
--   - Pictures are not part of this. There is no asset table.
--
-- The model:
--
--   contractor_disciplines   a contractor's own list of kinds of work;
--   case_studies             one past job: `draft` is what the contractor is
--                            editing, `approved` is a complete copy made at
--                            approval and is the only thing a proposal may
--                            ever read;
--   case_study_disciplines   which disciplines a case study is tagged with.
--
-- Signed-in contractors may READ their own rows. Every write goes through
-- the functions below, which only the server's service role may execute,
-- after the application has authenticated the contractor. Each function takes
-- that contractor's id, takes one lock for that contractor before it checks
-- or writes anything, and touches only that contractor's rows. The composite
-- foreign keys make a cross-contractor link impossible even for a writer
-- that does not use the functions.
--
-- Every change to what an approval would capture (the draft, the tags, a
-- tag's label or whether it is archived) raises the case study's revision.
-- Approval names the revision it was shown and is refused if it has moved.

BEGIN;

-- ── Shared rules, as functions so the tables can CHECK them ──────────────────

-- How a discipline label is compared: outer spaces removed, runs of spaces
-- collapsed, and the letters A to Z lowered. Only A to Z, on purpose: lower()
-- gives different answers for other letters depending on how a database was
-- set up, and this must give the same key everywhere and in the application.
-- The same rule is implemented in src/lib/case-library/labels.ts.
CREATE FUNCTION public.case_library_label_key(p_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT translate(btrim(regexp_replace(coalesce(p_label, ''), ' +', ' ', 'g'), ' '), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
$$;

-- NULL when a label is acceptable, otherwise a short code.
CREATE FUNCTION public.case_library_label_problem(p_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_label IS NULL THEN 'label'
        WHEN p_label <> btrim(p_label, ' ') THEN 'label'
        WHEN char_length(p_label) NOT BETWEEN 1 AND 80 THEN 'label'
        WHEN p_label ~ '[\x01-\x1F\x7F]' THEN 'label'
        WHEN p_label ~ '  ' THEN 'label'
        ELSE NULL
    END;
$$;

-- One text field of a case study. `p_multiline` allows line breaks and tabs.
CREATE FUNCTION public.case_library_text_ok(p_value jsonb, p_min integer, p_max integer, p_multiline boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_value IS NOT NULL
        AND jsonb_typeof(p_value) = 'string'
        AND char_length(p_value #>> '{}') BETWEEN p_min AND p_max
        AND NOT (p_value #>> '{}') ~ (CASE WHEN p_multiline THEN '[\x01-\x08\x0B-\x1F\x7F]' ELSE '[\x01-\x1F\x7F]' END);
$$;

-- CaseStudyContent v1. NULL when the value is acceptable, otherwise the code
-- of the first rule it breaks. Exactly these keys, no others, all present.
-- The same rules, in the same order, with the same codes, are implemented in
-- src/lib/case-library/content.ts and proved equal by shared test vectors.
CREATE FUNCTION public.case_library_content_problem(p_content jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_content IS NULL OR jsonb_typeof(p_content) <> 'object' THEN 'not-object'
        WHEN (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_content) AS k)
             IS DISTINCT FROM ARRAY['client_display', 'client_named_ok', 'client_text', 'delivered', 'duration_text', 'place', 'show_value', 'title', 'value_added', 'value_text', 'version', 'work_type'] THEN 'keys'
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
        ELSE NULL
    END;
$$;

-- What must also be true before a draft can be approved. NULL when it can.
-- A client is named or described only if the contractor has said so, and
-- named only with their confirmation that the client agreed.
CREATE FUNCTION public.case_library_approval_problem(p_content jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN public.case_library_content_problem(p_content) IS NOT NULL THEN public.case_library_content_problem(p_content)
        WHEN (p_content ->> 'client_display') IN ('described', 'named') AND btrim(p_content ->> 'client_text', ' ') = '' THEN 'client_text_missing'
        WHEN (p_content ->> 'client_display') = 'named' AND (p_content -> 'client_named_ok') IS DISTINCT FROM 'true'::jsonb THEN 'client_not_confirmed'
        WHEN (p_content -> 'show_value') = 'true'::jsonb AND btrim(p_content ->> 'value_text', ' ') = '' THEN 'value_text_missing'
        ELSE NULL
    END;
$$;

-- The approved copy: the draft, with the client and the value blanked unless
-- the contractor chose to show them, plus the tag labels as plain strings.
-- Nothing a proposal reads can then carry a hidden name or figure.
CREATE FUNCTION public.case_library_approved_value(p_content jsonb, p_labels text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_content
        || jsonb_build_object(
            'client_text', CASE WHEN (p_content ->> 'client_display') = 'hidden' THEN '' ELSE p_content ->> 'client_text' END,
            'client_named_ok', (p_content ->> 'client_display') = 'named',
            'value_text', CASE WHEN (p_content -> 'show_value') = 'true'::jsonb THEN p_content ->> 'value_text' ELSE '' END,
            'disciplines', to_jsonb(coalesce(p_labels, ARRAY[]::text[]))
        );
$$;

-- NULL when a stored approved copy is well formed.
CREATE FUNCTION public.case_library_approved_problem(p_approved jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_approved IS NULL OR jsonb_typeof(p_approved) <> 'object' THEN 'not-object'
        WHEN jsonb_typeof(p_approved -> 'disciplines') IS DISTINCT FROM 'array' THEN 'disciplines'
        WHEN jsonb_array_length(p_approved -> 'disciplines') > 6 THEN 'disciplines'
        WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_approved -> 'disciplines') AS label
            WHERE jsonb_typeof(label) <> 'string' OR public.case_library_label_problem(label #>> '{}') IS NOT NULL
        ) THEN 'disciplines'
        WHEN public.case_library_approval_problem(p_approved - 'disciplines') IS NOT NULL THEN public.case_library_approval_problem(p_approved - 'disciplines')
        WHEN (p_approved ->> 'client_display') = 'hidden' AND (p_approved ->> 'client_text') <> '' THEN 'client_text_hidden'
        WHEN (p_approved -> 'show_value') = 'false'::jsonb AND (p_approved ->> 'value_text') <> '' THEN 'value_text_hidden'
        ELSE NULL
    END;
$$;

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE public.contractor_disciplines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label text NOT NULL,
    label_key text NOT NULL,
    position integer NOT NULL DEFAULT 0,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contractor_disciplines_owner UNIQUE (id, user_id),
    CONSTRAINT contractor_disciplines_label CHECK (public.case_library_label_problem(label) IS NULL),
    CONSTRAINT contractor_disciplines_label_key CHECK (label_key = public.case_library_label_key(label)),
    CONSTRAINT contractor_disciplines_position CHECK (position BETWEEN 0 AND 1000)
);

-- One active discipline per label, however it is capitalised or spaced.
CREATE UNIQUE INDEX contractor_disciplines_active_label
    ON public.contractor_disciplines (user_id, label_key) WHERE archived_at IS NULL;

CREATE TABLE public.case_studies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Goes up by one whenever anything an approval would capture changes.
    revision integer NOT NULL DEFAULT 1,
    draft jsonb NOT NULL,
    -- A complete copy made at approval. The only thing a proposal may read.
    approved jsonb,
    approved_revision integer,
    approved_at timestamptz,
    -- Set when this was started from an entry in profiles.case_studies: where
    -- that entry was, and what it contained, as the database read it then.
    legacy_index integer,
    legacy_fingerprint text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT case_studies_owner UNIQUE (id, user_id),
    CONSTRAINT case_studies_revision CHECK (revision >= 1),
    CONSTRAINT case_studies_draft CHECK (public.case_library_content_problem(draft) IS NULL AND pg_column_size(draft) <= 65536),
    CONSTRAINT case_studies_approved CHECK (approved IS NULL OR (public.case_library_approved_problem(approved) IS NULL AND pg_column_size(approved) <= 65536)),
    CONSTRAINT case_studies_approved_together CHECK ((approved IS NULL) = (approved_revision IS NULL) AND (approved IS NULL) = (approved_at IS NULL)),
    CONSTRAINT case_studies_approved_revision CHECK (approved_revision IS NULL OR approved_revision BETWEEN 1 AND revision),
    CONSTRAINT case_studies_legacy_together CHECK ((legacy_index IS NULL) = (legacy_fingerprint IS NULL)),
    CONSTRAINT case_studies_legacy_index CHECK (legacy_index IS NULL OR legacy_index BETWEEN 0 AND 9999),
    CONSTRAINT case_studies_legacy_fingerprint CHECK (legacy_fingerprint IS NULL OR legacy_fingerprint ~ '^[0-9a-f]{32}$')
);

-- An older case study can be brought into the library once.
CREATE UNIQUE INDEX case_studies_one_adoption
    ON public.case_studies (user_id, legacy_index) WHERE legacy_index IS NOT NULL AND archived_at IS NULL;

CREATE INDEX case_studies_user_idx ON public.case_studies (user_id, created_at);

CREATE TABLE public.case_study_disciplines (
    case_study_id uuid NOT NULL,
    discipline_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (case_study_id, discipline_id),
    -- Both ends must belong to the same contractor as the link.
    CONSTRAINT case_study_disciplines_study FOREIGN KEY (case_study_id, user_id)
        REFERENCES public.case_studies (id, user_id) ON DELETE CASCADE,
    CONSTRAINT case_study_disciplines_discipline FOREIGN KEY (discipline_id, user_id)
        REFERENCES public.contractor_disciplines (id, user_id) ON DELETE CASCADE
);

CREATE INDEX case_study_disciplines_discipline_idx ON public.case_study_disciplines (discipline_id, user_id);

-- ── Access ───────────────────────────────────────────────────────────────────

ALTER TABLE public.contractor_disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_study_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read their own disciplines"
    ON public.contractor_disciplines FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Contractors read their own case studies"
    ON public.case_studies FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Contractors read their own case study tags"
    ON public.case_study_disciplines FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.contractor_disciplines, public.case_studies, public.case_study_disciplines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.contractor_disciplines, public.case_studies, public.case_study_disciplines TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.contractor_disciplines, public.case_studies, public.case_study_disciplines TO service_role;

-- ── Writes ───────────────────────────────────────────────────────────────────
--
-- Every function below: runs with the caller's own privileges (not SECURITY
-- DEFINER), with an empty search path; refuses a missing contractor; takes
-- the contractor's lock FIRST, before it reads anything it will rely on; and
-- then locks the case study row, if there is one, before any discipline row.
-- Because every writer for a contractor holds the same lock, two writers
-- never interleave, so limits cannot be passed by racing and the order of
-- row locks cannot deadlock.

CREATE FUNCTION public.case_library_lock(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A contractor is required.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('case_library:' || p_user_id::text, 0));
END;
$$;

-- Adds a discipline (p_id NULL) or changes one's label and position.
-- At most 12 active. Changing a label raises the revision of every case study
-- tagged with it, because the next approval would capture the new words.
CREATE FUNCTION public.case_library_discipline_save(p_user_id uuid, p_id uuid, p_label text, p_position integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.contractor_disciplines%ROWTYPE;
    v_key text := public.case_library_label_key(p_label);
    v_position integer := coalesce(p_position, 0);
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    IF public.case_library_label_problem(p_label) IS NOT NULL OR v_position NOT BETWEEN 0 AND 1000 THEN
        RETURN jsonb_build_object('outcome', 'invalid');
    END IF;

    IF p_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.contractor_disciplines WHERE user_id = p_user_id AND label_key = v_key AND archived_at IS NULL) THEN
            RETURN jsonb_build_object('outcome', 'duplicate');
        END IF;
        IF (SELECT count(*) FROM public.contractor_disciplines WHERE user_id = p_user_id AND archived_at IS NULL) >= 12 THEN
            RETURN jsonb_build_object('outcome', 'limit');
        END IF;
        INSERT INTO public.contractor_disciplines (user_id, label, label_key, position)
        VALUES (p_user_id, p_label, v_key, v_position)
        RETURNING * INTO v_row;
        RETURN jsonb_build_object('outcome', 'saved', 'id', v_row.id);
    END IF;

    SELECT * INTO v_row FROM public.contractor_disciplines WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_row.archived_at IS NULL AND EXISTS (
        SELECT 1 FROM public.contractor_disciplines WHERE user_id = p_user_id AND label_key = v_key AND archived_at IS NULL AND id <> p_id
    ) THEN
        RETURN jsonb_build_object('outcome', 'duplicate');
    END IF;

    IF v_row.label IS DISTINCT FROM p_label THEN
        UPDATE public.case_studies SET revision = revision + 1, updated_at = now()
        WHERE user_id = p_user_id
          AND id IN (SELECT case_study_id FROM public.case_study_disciplines WHERE discipline_id = p_id AND user_id = p_user_id);
    END IF;
    UPDATE public.contractor_disciplines SET label = p_label, label_key = v_key, position = v_position, updated_at = now()
    WHERE id = p_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'saved', 'id', p_id);
END;
$$;

-- Archives a discipline, or brings it back. Tags are kept. Either way the
-- labels the next approval would capture change, so tagged case studies move
-- to a new revision.
CREATE FUNCTION public.case_library_discipline_archive(p_user_id uuid, p_id uuid, p_archived boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.contractor_disciplines%ROWTYPE;
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    IF p_archived IS NULL THEN
        RETURN jsonb_build_object('outcome', 'invalid');
    END IF;
    SELECT * INTO v_row FROM public.contractor_disciplines WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF (v_row.archived_at IS NOT NULL) = p_archived THEN
        RETURN jsonb_build_object('outcome', 'saved', 'id', p_id);
    END IF;

    IF NOT p_archived THEN
        IF EXISTS (SELECT 1 FROM public.contractor_disciplines WHERE user_id = p_user_id AND label_key = v_row.label_key AND archived_at IS NULL) THEN
            RETURN jsonb_build_object('outcome', 'duplicate');
        END IF;
        IF (SELECT count(*) FROM public.contractor_disciplines WHERE user_id = p_user_id AND archived_at IS NULL) >= 12 THEN
            RETURN jsonb_build_object('outcome', 'limit');
        END IF;
    END IF;

    UPDATE public.case_studies SET revision = revision + 1, updated_at = now()
    WHERE user_id = p_user_id
      AND id IN (SELECT case_study_id FROM public.case_study_disciplines WHERE discipline_id = p_id AND user_id = p_user_id);
    UPDATE public.contractor_disciplines SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END, updated_at = now()
    WHERE id = p_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'saved', 'id', p_id);
END;
$$;

-- Starts a case study as a draft. At most 50 that are not archived.
-- p_legacy_index, if given, says this was started from that entry of the
-- contractor's older case studies. The database reads the entry itself and
-- records what it contained; the caller is not trusted to describe it, and
-- the older entry is not changed.
CREATE FUNCTION public.case_study_create(p_user_id uuid, p_content jsonb, p_legacy_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_id uuid;
    v_entry jsonb;
    v_fingerprint text;
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    IF public.case_library_content_problem(p_content) IS NOT NULL OR pg_column_size(p_content) > 65536 THEN
        RETURN jsonb_build_object('outcome', 'invalid', 'problem', coalesce(public.case_library_content_problem(p_content), 'too-large'));
    END IF;
    IF (SELECT count(*) FROM public.case_studies WHERE user_id = p_user_id AND archived_at IS NULL) >= 50 THEN
        RETURN jsonb_build_object('outcome', 'limit');
    END IF;

    IF p_legacy_index IS NOT NULL THEN
        IF p_legacy_index NOT BETWEEN 0 AND 9999 THEN
            RETURN jsonb_build_object('outcome', 'legacy-missing');
        END IF;
        SELECT CASE WHEN jsonb_typeof(case_studies) = 'array' THEN case_studies -> p_legacy_index END INTO v_entry
        FROM public.profiles WHERE id = p_user_id;
        IF v_entry IS NULL OR jsonb_typeof(v_entry) <> 'object' THEN
            RETURN jsonb_build_object('outcome', 'legacy-missing');
        END IF;
        IF EXISTS (SELECT 1 FROM public.case_studies WHERE user_id = p_user_id AND legacy_index = p_legacy_index AND archived_at IS NULL) THEN
            RETURN jsonb_build_object('outcome', 'already-adopted');
        END IF;
        v_fingerprint := md5(v_entry::text);
    END IF;

    INSERT INTO public.case_studies (user_id, draft, legacy_index, legacy_fingerprint)
    VALUES (p_user_id, p_content, p_legacy_index, v_fingerprint)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('outcome', 'saved', 'id', v_id, 'revision', 1);
END;
$$;

-- Saves the draft if, and only if, the caller has seen the latest revision.
-- The approved copy is not touched.
CREATE FUNCTION public.case_study_save_draft(p_user_id uuid, p_id uuid, p_expected_revision integer, p_content jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.case_studies%ROWTYPE;
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    IF public.case_library_content_problem(p_content) IS NOT NULL OR pg_column_size(p_content) > 65536 THEN
        RETURN jsonb_build_object('outcome', 'invalid', 'problem', coalesce(public.case_library_content_problem(p_content), 'too-large'));
    END IF;
    SELECT * INTO v_row FROM public.case_studies WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_row.revision IS DISTINCT FROM p_expected_revision THEN
        RETURN jsonb_build_object('outcome', 'conflict', 'revision', v_row.revision);
    END IF;
    UPDATE public.case_studies SET draft = p_content, revision = revision + 1, updated_at = now()
    WHERE id = p_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'saved', 'revision', v_row.revision + 1);
END;
$$;

-- Replaces a case study's tags. At most 6, each an active discipline of the
-- same contractor. Raises the revision.
CREATE FUNCTION public.case_study_set_disciplines(p_user_id uuid, p_id uuid, p_expected_revision integer, p_discipline_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.case_studies%ROWTYPE;
    v_wanted integer := coalesce(cardinality(p_discipline_ids), 0);
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    -- Checked before anything is unpacked: the list is short or it is refused.
    IF v_wanted > 6 OR (v_wanted > 0 AND array_ndims(p_discipline_ids) <> 1) OR array_position(p_discipline_ids, NULL) IS NOT NULL THEN
        RETURN jsonb_build_object('outcome', 'invalid');
    END IF;
    IF v_wanted <> (SELECT count(DISTINCT wanted) FROM unnest(coalesce(p_discipline_ids, ARRAY[]::uuid[])) AS wanted) THEN
        RETURN jsonb_build_object('outcome', 'invalid');
    END IF;

    SELECT * INTO v_row FROM public.case_studies WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_row.revision IS DISTINCT FROM p_expected_revision THEN
        RETURN jsonb_build_object('outcome', 'conflict', 'revision', v_row.revision);
    END IF;
    IF v_wanted <> (
        SELECT count(*) FROM public.contractor_disciplines
        WHERE user_id = p_user_id AND archived_at IS NULL AND id = ANY (coalesce(p_discipline_ids, ARRAY[]::uuid[]))
    ) THEN
        RETURN jsonb_build_object('outcome', 'unknown-discipline');
    END IF;

    DELETE FROM public.case_study_disciplines WHERE case_study_id = p_id AND user_id = p_user_id;
    INSERT INTO public.case_study_disciplines (case_study_id, discipline_id, user_id)
    SELECT p_id, wanted, p_user_id FROM unnest(coalesce(p_discipline_ids, ARRAY[]::uuid[])) AS wanted;
    UPDATE public.case_studies SET revision = revision + 1, updated_at = now() WHERE id = p_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'saved', 'revision', v_row.revision + 1);
END;
$$;

-- Approves exactly what is saved at the revision the contractor was shown.
-- Under the contractor's lock it re-reads the draft and the active tag labels
-- and stores them together as one complete copy. It changes no project, no
-- proposal selection and no other row. The draft is not changed either: a
-- client the contractor left hidden stays hidden in both.
CREATE FUNCTION public.case_study_approve(p_user_id uuid, p_id uuid, p_expected_revision integer, p_confirmed boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.case_studies%ROWTYPE;
    v_labels text[];
    v_problem text;
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    IF p_confirmed IS NOT TRUE THEN
        RETURN jsonb_build_object('outcome', 'unconfirmed');
    END IF;
    SELECT * INTO v_row FROM public.case_studies WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_row.archived_at IS NOT NULL THEN
        RETURN jsonb_build_object('outcome', 'archived');
    END IF;
    IF v_row.revision IS DISTINCT FROM p_expected_revision THEN
        RETURN jsonb_build_object('outcome', 'conflict', 'revision', v_row.revision);
    END IF;
    v_problem := public.case_library_approval_problem(v_row.draft);
    IF v_problem IS NOT NULL THEN
        RETURN jsonb_build_object('outcome', 'not-approvable', 'problem', v_problem);
    END IF;

    SELECT coalesce(array_agg(d.label ORDER BY d.position, d.label_key COLLATE "C"), ARRAY[]::text[]) INTO v_labels
    FROM public.case_study_disciplines AS link
    JOIN public.contractor_disciplines AS d ON d.id = link.discipline_id AND d.user_id = link.user_id
    WHERE link.case_study_id = p_id AND link.user_id = p_user_id AND d.archived_at IS NULL;

    UPDATE public.case_studies
    SET approved = public.case_library_approved_value(v_row.draft, v_labels), approved_revision = v_row.revision, approved_at = now(), updated_at = now()
    WHERE id = p_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'approved', 'revision', v_row.revision);
END;
$$;

-- Archives a case study, or brings it back. The row and its approved copy are
-- kept. Bringing one back counts towards the limit of 50.
CREATE FUNCTION public.case_study_archive(p_user_id uuid, p_id uuid, p_expected_revision integer, p_archived boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.case_studies%ROWTYPE;
BEGIN
    PERFORM public.case_library_lock(p_user_id);
    IF p_archived IS NULL THEN
        RETURN jsonb_build_object('outcome', 'invalid');
    END IF;
    SELECT * INTO v_row FROM public.case_studies WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_row.revision IS DISTINCT FROM p_expected_revision THEN
        RETURN jsonb_build_object('outcome', 'conflict', 'revision', v_row.revision);
    END IF;
    IF (v_row.archived_at IS NOT NULL) = p_archived THEN
        RETURN jsonb_build_object('outcome', 'saved', 'revision', v_row.revision);
    END IF;
    IF NOT p_archived THEN
        IF (SELECT count(*) FROM public.case_studies WHERE user_id = p_user_id AND archived_at IS NULL) >= 50 THEN
            RETURN jsonb_build_object('outcome', 'limit');
        END IF;
        IF v_row.legacy_index IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.case_studies WHERE user_id = p_user_id AND legacy_index = v_row.legacy_index AND archived_at IS NULL
        ) THEN
            RETURN jsonb_build_object('outcome', 'already-adopted');
        END IF;
    END IF;
    UPDATE public.case_studies SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END, revision = revision + 1, updated_at = now()
    WHERE id = p_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'saved', 'revision', v_row.revision + 1);
END;
$$;

-- ── Who may run what ─────────────────────────────────────────────────────────
--
-- The rule functions are needed by the table checks, which run as whoever
-- writes; only the service role writes. Nothing is granted to a browser role.

REVOKE ALL ON FUNCTION public.case_library_label_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_label_problem(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_text_ok(jsonb, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_content_problem(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_approval_problem(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_approved_value(jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_approved_problem(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_discipline_save(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_library_discipline_archive(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_study_create(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_study_save_draft(uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_study_set_disciplines(uuid, uuid, integer, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_study_approve(uuid, uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_study_archive(uuid, uuid, integer, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.case_library_label_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_label_problem(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_text_ok(jsonb, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_content_problem(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_approval_problem(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_approved_value(jsonb, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_approved_problem(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_discipline_save(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_library_discipline_archive(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_study_create(uuid, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_study_save_draft(uuid, uuid, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_study_set_disciplines(uuid, uuid, integer, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_study_approve(uuid, uuid, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_study_archive(uuid, uuid, integer, boolean) TO service_role;

COMMIT;
