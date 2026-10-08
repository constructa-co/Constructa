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
    study(userId: string, id: string): Promise<Loaded<StoredStudy | null>>;
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
