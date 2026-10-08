/**
 * Case-study library: reads. Every read here is made with the CONTRACTOR'S
 * OWN session, so row-level security decides what comes back. Nothing here
 * uses a privileged client, and nothing here writes.
 *
 * A read that fails for any reason, including the tables not existing, is
 * "unavailable". It is never an empty library.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryRow } from "./resolve";

export interface StoredDiscipline {
    id: string;
    label: string;
    position: number;
    revision: number;
    archived: boolean;
}

export interface StoredStudy {
    id: string;
    revision: number;
    draft: unknown;
    approved: unknown;
    approvedRevision: number | null;
    approvedAt: string | null;
    legacyIndex: number | null;
    archived: boolean;
    /** Ids of the disciplines it is tagged with, active or archived. */
    disciplineIds: string[];
}

export interface LibrarySnapshot {
    studies: StoredStudy[];
    disciplines: StoredDiscipline[];
}

export type Loaded<T> = { state: "ok"; value: T } | { state: "unavailable" };

/** What the pages and the save need to read. Implemented over Supabase here, and in memory for tests and fixtures. */
export interface LibraryReader {
    library(userId: string): Promise<Loaded<LibrarySnapshot>>;
    /**
     * One case study with its tags. The row and its tags are separate reads,
     * so on its own this is NOT a consistent picture of one revision. Anything
     * that relies on the revision uses `readStudyAtOneRevision` below.
     */
    study(userId: string, id: string): Promise<Loaded<StoredStudy | null>>;
    /** Just the case study's current revision, or null if there is no such case study. One small read. */
    revision(userId: string, id: string): Promise<Loaded<number | null>>;
    disciplines(userId: string): Promise<Loaded<StoredDiscipline[]>>;
    /**
     * For a proposal: the contractor's APPROVED, unarchived case studies with
     * their approved copies, and, for the given ticked ids only, whether each
     * exists, is archived or is unapproved. No draft content is read.
     */
    forProposal(userId: string, tickedIds: readonly string[]): Promise<Loaded<{ rows: LibraryRow[]; legacyIndexById: Record<string, number> }>>;
    /** How many of each. Counts only: no content. */
    counts(userId: string): Promise<Loaded<{ approved: number; unapproved: number }>>;
    /** One entry of the contractor's older case studies, by its place, as stored now. */
    olderEntry(userId: string, index: number): Promise<Loaded<unknown>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const unavailable = { state: "unavailable" } as const;

type Row = Record<string, unknown>;
const toDiscipline = (row: Row): StoredDiscipline => ({ id: String(row.id), label: String(row.label), position: Number(row.position), revision: Number(row.revision), archived: row.archived_at != null });
const toStudy = (row: Row, disciplineIds: string[]): StoredStudy => ({
    id: String(row.id),
    revision: Number(row.revision),
    draft: row.draft,
    approved: row.approved ?? null,
    approvedRevision: row.approved_revision == null ? null : Number(row.approved_revision),
    approvedAt: row.approved_at == null ? null : String(row.approved_at),
    legacyIndex: row.legacy_index == null ? null : Number(row.legacy_index),
    archived: row.archived_at != null,
    disciplineIds,
});

const STUDY_COLUMNS = "id, revision, draft, approved, approved_revision, approved_at, legacy_index, archived_at";

/** Reads through a contractor's own Supabase session. The `userId` filters are belt and braces: row-level security already limits rows to the session's own. */
export function sessionReader(supabase: Pick<SupabaseClient, "from">): LibraryReader {
    const links = async (userId: string, studyId?: string): Promise<Map<string, string[]> | null> => {
        let query = supabase.from("case_study_disciplines").select("case_study_id, discipline_id").eq("user_id", userId);
        if (studyId) query = query.eq("case_study_id", studyId);
        const { data, error } = await query;
        if (error) return null;
        const map = new Map<string, string[]>();
        for (const row of (data ?? []) as Row[]) map.set(String(row.case_study_id), [...(map.get(String(row.case_study_id)) ?? []), String(row.discipline_id)]);
        return map;
    };

    const disciplines = async (userId: string): Promise<Loaded<StoredDiscipline[]>> => {
        const { data, error } = await supabase.from("contractor_disciplines").select("id, label, position, revision, archived_at").eq("user_id", userId).order("position").order("label_key");
        return error ? unavailable : { state: "ok", value: ((data ?? []) as Row[]).map(toDiscipline) };
    };

    return {
        disciplines,
        revision: async (userId, id) => {
            if (!UUID.test(id)) return { state: "ok", value: null };
            const { data, error } = await supabase.from("case_studies").select("revision").eq("user_id", userId).eq("id", id).maybeSingle();
            if (error) return unavailable;
            return { state: "ok", value: data ? Number((data as Row).revision) : null };
        },
        library: async (userId) => {
            const [studies, tags, kinds] = await Promise.all([
                supabase.from("case_studies").select(STUDY_COLUMNS).eq("user_id", userId).order("created_at"),
                links(userId),
                disciplines(userId),
            ]);
            if (studies.error || tags === null || kinds.state !== "ok") return unavailable;
            return { state: "ok", value: { studies: ((studies.data ?? []) as Row[]).map((row) => toStudy(row, tags.get(String(row.id)) ?? [])), disciplines: kinds.value } };
        },
        study: async (userId, id) => {
            if (!UUID.test(id)) return { state: "ok", value: null };
            const [found, tags] = await Promise.all([
                supabase.from("case_studies").select(STUDY_COLUMNS).eq("user_id", userId).eq("id", id).maybeSingle(),
                links(userId, id),
            ]);
            if (found.error || tags === null) return unavailable;
            return { state: "ok", value: found.data ? toStudy(found.data as Row, tags.get(id) ?? []) : null };
        },
        forProposal: async (userId, tickedIds) => {
            const approved = await supabase.from("case_studies").select("id, user_id, approved, approved_revision, archived_at, legacy_index").eq("user_id", userId).is("archived_at", null).not("approved", "is", null);
            if (approved.error) return unavailable;
            const rows: LibraryRow[] = [];
            const legacyIndexById: Record<string, number> = {};
            for (const row of (approved.data ?? []) as Row[]) {
                rows.push({ id: String(row.id), user_id: String(row.user_id), approved: row.approved, approved_revision: Number(row.approved_revision), archived_at: null });
                if (row.legacy_index != null) legacyIndexById[String(row.id)] = Number(row.legacy_index);
            }
            // For ticked case studies that are not sendable: why not. Their content is not read.
            const known = new Set(rows.map((row) => row.id));
            const others = Array.from(new Set(tickedIds.filter((id) => UUID.test(id) && !known.has(id)))).slice(0, 50);
            if (others.length > 0) {
                const state = await supabase.from("case_studies").select("id, user_id, approved_revision, archived_at").eq("user_id", userId).in("id", others);
                if (state.error) return unavailable;
                for (const row of (state.data ?? []) as Row[]) {
                    rows.push({ id: String(row.id), user_id: String(row.user_id), approved: null, approved_revision: row.approved_revision == null ? null : Number(row.approved_revision), archived_at: row.archived_at == null ? null : String(row.archived_at) });
                }
            }
            return { state: "ok", value: { rows, legacyIndexById } };
        },
        counts: async (userId) => {
            const [approved, unapproved] = await Promise.all([
                supabase.from("case_studies").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).not("approved", "is", null),
                supabase.from("case_studies").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).is("approved", null),
            ]);
            if (approved.error || unapproved.error || approved.count == null || unapproved.count == null) return unavailable;
            return { state: "ok", value: { approved: approved.count, unapproved: unapproved.count } };
        },
        olderEntry: async (userId, index) => {
            const { data, error } = await supabase.from("profiles").select("case_studies").eq("id", userId).maybeSingle();
            if (error) return unavailable;
            const stored = (data as Row | null)?.case_studies;
            return { state: "ok", value: Array.isArray(stored) ? stored[index] : undefined };
        },
    };
}

/** How many times the read below is tried before it gives up and says so. */
export const COHERENT_READ_ATTEMPTS = 3;

export type CoherentStudy =
    | { state: "ok"; study: StoredStudy; disciplines: StoredDiscipline[] }
    | { state: "missing" }
    /** A read could not be made. */
    | { state: "unavailable" }
    /** The case study kept changing while it was being read. Nothing is returned rather than a mixture. */
    | { state: "changing" };

/**
 * A case study, its tags and the contractor's kinds of work, all as they
 * stood at ONE revision.
 *
 * The row, the tags and the kinds of work are separate reads, each seeing
 * the database at its own moment. Read side by side they can disagree: the
 * row can show a new revision while the labels are still the old ones. An
 * approval check built from that would show one thing and approve another.
 *
 * So the reads are bracketed:
 *
 *   1. read the revision, and WAIT for the answer;
 *   2. only then read the row, its tags and the kinds of work;
 *   3. only when those have all answered, read the revision again.
 *
 * Every change that an approval would capture (the draft, the tags, a tag's
 * label, place or archived state) raises the case study's revision in the
 * same database transaction, and a revision only ever goes up. So if the
 * revision at step 3 equals the one at step 1, and the row read in between
 * shows that same revision, no such change was committed between steps 1 and
 * 3, and everything read in step 2 is as it stood at that revision.
 *
 * If they differ, the whole thing is read again, at most
 * `COHERENT_READ_ATTEMPTS` times. If it never settles, or any read fails,
 * nothing is returned. A change that lands after step 3 is not seen here; it
 * is caught when the contractor acts, because every write names the revision.
 *
 * This relies on each later read seeing everything committed before an
 * earlier read answered, which holds when all reads go to the same database.
 */
export async function readStudyAtOneRevision(reader: LibraryReader, userId: string, id: string): Promise<CoherentStudy> {
    for (let attempt = 0; attempt < COHERENT_READ_ATTEMPTS; attempt += 1) {
        const before = await reader.revision(userId, id);
        if (before.state !== "ok") return { state: "unavailable" };
        if (before.value === null) return { state: "missing" };

        // Started only now that the revision is known. Their order among themselves does not matter.
        const [study, disciplines] = await Promise.all([reader.study(userId, id), reader.disciplines(userId)]);
        if (study.state !== "ok" || disciplines.state !== "ok") return { state: "unavailable" };

        // Started only now that all of those have answered.
        const after = await reader.revision(userId, id);
        if (after.state !== "ok") return { state: "unavailable" };
        if (after.value === null || !study.value) {
            // Gone, or going, between the reads.
            if (after.value === null && !study.value) return { state: "missing" };
            continue;
        }
        if (after.value === before.value && study.value.revision === before.value) {
            return { state: "ok", study: study.value, disciplines: disciplines.value };
        }
    }
    return { state: "changing" };
}
