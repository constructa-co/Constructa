/**
 * In-memory stand-in for the case-study library's tables and write functions,
 * with the rules the SQL has. Those rules are proved against a real database
 * in `scripts/test-case-library-sql.sh`; this lets the service and the
 * screens be exercised without one. Synthetic data only.
 *
 * `admin.rpc` is the service-role side. `reader` is the contractor's own
 * session: it returns only the given contractor's rows, as row-level security
 * does.
 */

import { approvalProblem, approvedValue, contentProblem, labelProblem, type CaseStudyContent } from "../content";
import { labelKey } from "../labels";
import type { LibraryRow } from "../resolve";
import type { LibraryReader, StoredDiscipline, StoredStudy } from "../store";

type Args = Record<string, unknown>;
interface Discipline { id: string; user_id: string; label: string; label_key: string; position: number; revision: number; archived: boolean }
interface Study { id: string; user_id: string; revision: number; draft: CaseStudyContent; approved: unknown; approved_revision: number | null; approved_at: string | null; legacy_index: number | null; archived: boolean; created: number }

export function fakeLibrary(options: { olderByUser?: Record<string, unknown[]> } = {}) {
    const disciplines: Discipline[] = [];
    const studies: Study[] = [];
    const links: Array<{ study: string; discipline: string; user_id: string }> = [];
    const older: Record<string, unknown[]> = options.olderByUser ?? {};
    const rpcCalls: Array<{ name: string; args: Args }> = [];
    const readCalls: string[] = [];
    /** Things to do to the next call of a function: fail before it runs, or fail after it has committed. */
    const faults: Array<{ name: string; when: "before" | "after"; times: number }> = [];
    const readFaults: Array<{ name: string; times: number }> = [];
    const hooks: Array<{ name: string; run: () => void }> = [];
    let unavailable = false;
    let nextId = 1;
    let clock = 1;
    const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

    const bumpTagged = (userId: string, disciplineId: string) => {
        for (const link of links) if (link.discipline === disciplineId && link.user_id === userId) studies.find((study) => study.id === link.study)!.revision += 1;
    };
    const activeLabels = (studyId: string, userId: string) => links
        .filter((link) => link.study === studyId && link.user_id === userId)
        .map((link) => disciplines.find((entry) => entry.id === link.discipline)!)
        .filter((entry) => !entry.archived)
        .sort((a, b) => a.position - b.position || (a.label_key < b.label_key ? -1 : 1))
        .map((entry) => entry.label);

    const functions: Record<string, (args: Args) => unknown> = {
        case_library_discipline_save: ({ p_user_id, p_id, p_expected_revision, p_label, p_position }) => {
            const user = String(p_user_id);
            const position = Number(p_position ?? 0);
            if (labelProblem(p_label) !== null || position < 0 || position > 1000) return { outcome: "invalid" };
            const label = String(p_label);
            const key = labelKey(label);
            if (p_id == null) {
                if (p_expected_revision !== 0) return { outcome: "invalid" };
                if (disciplines.some((entry) => entry.user_id === user && !entry.archived && entry.label_key === key)) return { outcome: "duplicate" };
                if (disciplines.filter((entry) => entry.user_id === user && !entry.archived).length >= 12) return { outcome: "limit" };
                const row: Discipline = { id: uuid(), user_id: user, label, label_key: key, position, revision: 1, archived: false };
                disciplines.push(row);
                return { outcome: "saved", id: row.id, revision: 1 };
            }
            const row = disciplines.find((entry) => entry.id === p_id && entry.user_id === user);
            if (!row) return { outcome: "not-found" };
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision };
            if (row.label === label && row.position === position) return { outcome: "saved", id: row.id, revision: row.revision };
            if (!row.archived && disciplines.some((entry) => entry.user_id === user && !entry.archived && entry.label_key === key && entry.id !== row.id)) return { outcome: "duplicate" };
            bumpTagged(user, row.id);
            Object.assign(row, { label, label_key: key, position, revision: row.revision + 1 });
            return { outcome: "saved", id: row.id, revision: row.revision };
        },
        case_library_discipline_archive: ({ p_user_id, p_id, p_expected_revision, p_archived }) => {
            const user = String(p_user_id);
            if (typeof p_archived !== "boolean" || p_id == null) return { outcome: "invalid" };
            const row = disciplines.find((entry) => entry.id === p_id && entry.user_id === user);
            if (!row) return { outcome: "not-found" };
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision };
            if (row.archived === p_archived) return { outcome: "saved", id: row.id, revision: row.revision };
            if (!p_archived) {
                if (disciplines.some((entry) => entry.user_id === user && !entry.archived && entry.label_key === row.label_key)) return { outcome: "duplicate" };
                if (disciplines.filter((entry) => entry.user_id === user && !entry.archived).length >= 12) return { outcome: "limit" };
            }
            bumpTagged(user, row.id);
            row.archived = p_archived;
            row.revision += 1;
            return { outcome: "saved", id: row.id, revision: row.revision };
        },
        case_study_create: ({ p_user_id, p_content, p_legacy_index }) => {
            const user = String(p_user_id);
            const problem = contentProblem(p_content);
            if (problem) return { outcome: "invalid", problem };
            if (studies.filter((study) => study.user_id === user && !study.archived).length >= 50) return { outcome: "limit" };
            let legacy: number | null = null;
            if (p_legacy_index != null) {
                legacy = Number(p_legacy_index);
                const entry = (older[user] ?? [])[legacy];
                if (!Number.isInteger(legacy) || legacy < 0 || !entry || typeof entry !== "object" || Array.isArray(entry)) return { outcome: "legacy-missing" };
                if (studies.some((study) => study.user_id === user && study.legacy_index === legacy && !study.archived)) return { outcome: "already-adopted" };
            }
            const row: Study = { id: uuid(), user_id: user, revision: 1, draft: structuredClone(p_content) as CaseStudyContent, approved: null, approved_revision: null, approved_at: null, legacy_index: legacy, archived: false, created: clock++ };
            studies.push(row);
            return { outcome: "saved", id: row.id, revision: 1 };
        },
        case_study_save_draft: ({ p_user_id, p_id, p_expected_revision, p_content }) => {
            const problem = contentProblem(p_content);
            if (problem) return { outcome: "invalid", problem };
            const row = studies.find((study) => study.id === p_id && study.user_id === p_user_id);
            if (!row) return { outcome: "not-found" };
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision };
            row.draft = structuredClone(p_content) as CaseStudyContent;
            row.revision += 1;
            return { outcome: "saved", revision: row.revision };
        },
        case_study_set_disciplines: ({ p_user_id, p_id, p_expected_revision, p_discipline_ids }) => {
            const user = String(p_user_id);
            const wanted = Array.isArray(p_discipline_ids) ? (p_discipline_ids as unknown[]) : [];
            if (wanted.length > 6 || wanted.some((id) => typeof id !== "string") || new Set(wanted).size !== wanted.length) return { outcome: "invalid" };
            const row = studies.find((study) => study.id === p_id && study.user_id === user);
            if (!row) return { outcome: "not-found" };
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision };
            if (wanted.some((id) => !disciplines.some((entry) => entry.id === id && entry.user_id === user && !entry.archived))) return { outcome: "unknown-discipline" };
            for (let index = links.length - 1; index >= 0; index -= 1) if (links[index].study === row.id) links.splice(index, 1);
            for (const id of wanted) links.push({ study: row.id, discipline: String(id), user_id: user });
            row.revision += 1;
            return { outcome: "saved", revision: row.revision };
        },
        case_study_approve: ({ p_user_id, p_id, p_expected_revision, p_confirmed }) => {
            const user = String(p_user_id);
            if (p_confirmed !== true) return { outcome: "unconfirmed" };
            const row = studies.find((study) => study.id === p_id && study.user_id === user);
            if (!row) return { outcome: "not-found" };
            if (row.archived) return { outcome: "archived" };
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision };
            const problem = approvalProblem(row.draft);
            if (problem) return { outcome: "not-approvable", problem };
            row.approved = approvedValue(row.draft, activeLabels(row.id, user));
            row.approved_revision = row.revision;
            row.approved_at = `2026-10-08T09:00:${String(clock++ % 60).padStart(2, "0")}Z`;
            return { outcome: "approved", revision: row.revision };
        },
        case_study_archive: ({ p_user_id, p_id, p_expected_revision, p_archived }) => {
            const user = String(p_user_id);
            if (typeof p_archived !== "boolean") return { outcome: "invalid" };
            const row = studies.find((study) => study.id === p_id && study.user_id === user);
            if (!row) return { outcome: "not-found" };
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision };
            if (row.archived === p_archived) return { outcome: "saved", revision: row.revision };
            if (!p_archived) {
                if (studies.filter((study) => study.user_id === user && !study.archived).length >= 50) return { outcome: "limit" };
                if (row.legacy_index !== null && studies.some((study) => study.user_id === user && study.legacy_index === row.legacy_index && !study.archived)) return { outcome: "already-adopted" };
            }
            row.archived = p_archived;
            row.revision += 1;
            return { outcome: "saved", revision: row.revision };
        },
    };

    const rpc = async (name: string, args: Args) => {
        rpcCalls.push({ name, args: structuredClone(args) });
        if (unavailable) return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
        const fault = faults.find((entry) => entry.name === name && entry.times > 0);
        if (fault?.when === "before") {
            fault.times -= 1;
            return { data: null, error: { code: "08006", message: "connection lost" } };
        }
        const hook = hooks.findIndex((entry) => entry.name === name);
        if (hook >= 0) hooks.splice(hook, 1)[0].run();
        const data = functions[name](args);
        if (fault?.when === "after") {
            // The write happened; the answer never arrived.
            fault.times -= 1;
            return { data: null, error: { code: "08006", message: "connection lost" } };
        }
        return { data, error: null };
    };

    const stored = (row: Study): StoredStudy => ({
        id: row.id, revision: row.revision, draft: structuredClone(row.draft), approved: structuredClone(row.approved), approvedRevision: row.approved_revision, approvedAt: row.approved_at,
        legacyIndex: row.legacy_index, archived: row.archived, disciplineIds: links.filter((link) => link.study === row.id).map((link) => link.discipline),
    });
    const storedDiscipline = (row: Discipline): StoredDiscipline => ({ id: row.id, label: row.label, position: row.position, revision: row.revision, archived: row.archived });
    const read = <T,>(name: string, value: () => T) => {
        readCalls.push(name);
        const fault = readFaults.find((entry) => (entry.name === name || entry.name === "*") && entry.times > 0);
        if (fault) { fault.times -= 1; return { state: "unavailable" } as const; }
        return unavailable ? ({ state: "unavailable" } as const) : ({ state: "ok", value: value() } as const);
    };

    const reader: LibraryReader = {
        library: async (userId) => read("library", () => ({
            studies: studies.filter((study) => study.user_id === userId).sort((a, b) => a.created - b.created).map(stored),
            disciplines: disciplines.filter((entry) => entry.user_id === userId).sort((a, b) => a.position - b.position || (a.label_key < b.label_key ? -1 : 1)).map(storedDiscipline),
        })),
        revision: async (userId, id) => read("revision", () => studies.find((study) => study.id === id && study.user_id === userId)?.revision ?? null),
        study: async (userId, id) => read("study", () => { const row = studies.find((study) => study.id === id && study.user_id === userId); return row ? stored(row) : null; }),
        disciplines: async (userId) => read("disciplines", () => disciplines.filter((entry) => entry.user_id === userId).sort((a, b) => a.position - b.position || (a.label_key < b.label_key ? -1 : 1)).map(storedDiscipline)),
        forProposal: async (userId, tickedIds) => read("forProposal", () => {
            const mine = studies.filter((study) => study.user_id === userId);
            const rows: LibraryRow[] = mine.filter((study) => !study.archived && study.approved !== null)
                .map((study) => ({ id: study.id, user_id: userId, approved: structuredClone(study.approved), approved_revision: study.approved_revision, archived_at: null }));
            const legacyIndexById: Record<string, number> = {};
            for (const study of mine) if (!study.archived && study.approved !== null && study.legacy_index !== null) legacyIndexById[study.id] = study.legacy_index;
            const known = new Set(rows.map((row) => row.id));
            for (const study of mine) {
                if (tickedIds.includes(study.id) && !known.has(study.id)) rows.push({ id: study.id, user_id: userId, approved: null, approved_revision: study.approved_revision, archived_at: study.archived ? "2026-10-01T00:00:00Z" : null });
            }
            return { rows, legacyIndexById };
        }),
        counts: async (userId) => read("counts", () => ({
            approved: studies.filter((study) => study.user_id === userId && !study.archived && study.approved !== null).length,
            unapproved: studies.filter((study) => study.user_id === userId && !study.archived && study.approved === null).length,
        })),
        olderEntry: async (userId, index) => read("olderEntry", () => (older[userId] ?? [])[index]),
    };

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin: { rpc } as any,
        reader,
        disciplines,
        studies,
        links,
        older,
        rpcCalls,
        readCalls,
        calls: (name: string) => rpcCalls.filter((call) => call.name === name),
        /** The next call fails without running. */
        failBefore: (name: string, times = 1) => faults.push({ name, when: "before", times }),
        /** The next call runs and commits, but its answer is lost. */
        failAfter: (name: string, times = 1) => faults.push({ name, when: "after", times }),
        /** The next read (of a kind, or "*" for any) cannot be made. */
        failRead: (name = "*", times = 1) => readFaults.push({ name, times }),
        /** Runs just before the next call of a function is applied: something happening "somewhere else". */
        beforeNext: (name: string, run: () => void) => hooks.push({ name, run }),
        /** As if the tables and functions were not there. */
        setUnavailable: (value: boolean) => { unavailable = value; },
    };
}
