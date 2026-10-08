import { describe, expect, it } from "vitest";
import { readProposalLibrary } from "./proposal-read";
import { libraryTick } from "./resolve";
import { COHERENT_READ_ATTEMPTS, readStudyAtOneRevision, sessionReader } from "./store";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Row = Record<string, unknown>;

/**
 * A stand-in for the contractor's own Supabase session. It records every
 * query and answers it from the given tables, or with an error.
 */
function session(tables: Record<string, Row[] | { error: { code: string } }>) {
    const queries: Array<{ table: string; columns: string; filters: string[]; head: boolean }> = [];
    /** Things committed "somewhere else" just before the n-th query is answered (1 is the first). */
    const beforeAnswer = new Map<number, () => void>();
    /** Queries, by number, that fail as a dropped connection would. */
    const failAnswer = new Set<number>();
    let answered = 0;
    const from = (table: string) => {
        const query = { table, columns: "", filters: [] as string[], head: false };
        queries.push(query);
        const source = tables[table];
        const rows = () => {
            if (!Array.isArray(source)) return [];
            return source.filter((row) => query.filters.every((filter) => {
                const [kind, column, value] = filter.split("|");
                if (kind === "eq") return String(row[column]) === value;
                if (kind === "is-null") return row[column] == null;
                if (kind === "not-null") return row[column] != null;
                if (kind === "in") return value.split(",").includes(String(row[column]));
                return true;
            }));
        };
        const result = () => {
            answered += 1;
            beforeAnswer.get(answered)?.();
            if (failAnswer.has(answered)) return { data: null, error: { code: "08006" }, count: null };
            // A copy, as a database returns: what was read does not change afterwards.
            return structuredClone(answer());
        };
        const answer = () => (Array.isArray(source) ? { data: query.head ? null : rows(), error: null, count: rows().length } : { data: null, error: source?.error ?? { code: "PGRST205" }, count: null });
        const builder: Record<string, unknown> = {
            select: (columns: string, options?: { head?: boolean }) => { query.columns = columns; query.head = options?.head === true; return builder; },
            eq: (column: string, value: unknown) => { query.filters.push(`eq|${column}|${value}`); return builder; },
            is: (column: string) => { query.filters.push(`is-null|${column}|`); return builder; },
            not: (column: string) => { query.filters.push(`not-null|${column}|`); return builder; },
            in: (column: string, values: unknown[]) => { query.filters.push(`in|${column}|${values.join(",")}`); return builder; },
            order: () => builder,
            maybeSingle: async () => { const answer = result(); return { ...answer, data: Array.isArray(answer.data) ? answer.data[0] ?? null : null }; },
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
        };
        return builder;
    };
    return { client: { from } as never, queries, beforeAnswer, failAnswer, answeredSoFar: () => answered };
}

const study = (n: number, extra: Row = {}): Row => ({ id: uuid(n), user_id: ME, revision: 2, draft: { title: `Draft ${n}`, client_text: "Mrs Private" }, approved: null, approved_revision: null, approved_at: null, legacy_index: null, archived_at: null, ...extra });
const TABLES = {
    case_studies: [
        study(1, { approved: { title: "Approved one", disciplines: [] }, approved_revision: 2, legacy_index: 3 }),
        study(2),
        study(3, { approved: { title: "Archived" }, approved_revision: 1, archived_at: "2026-10-01T00:00:00Z" }),
    ],
    contractor_disciplines: [{ id: uuid(9), user_id: ME, label: "Kitchens", position: 0, revision: 4, archived_at: null }],
    case_study_disciplines: [{ case_study_id: uuid(1), discipline_id: uuid(9), user_id: ME }],
    profiles: [{ id: ME, case_studies: [{ projectName: "Older" }, "junk"] }],
};

describe("reads made with the contractor's own session", () => {
    it("for a proposal: approved, unarchived copies; status only for ticked ones that cannot be sent; never a draft", async () => {
        const { client, queries } = session(TABLES);
        const result = await sessionReader(client).forProposal(ME, [uuid(2), uuid(3), uuid(7), "not-a-uuid"]);
        expect(result).toEqual({
            state: "ok",
            value: {
                rows: [
                    { id: uuid(1), user_id: ME, approved: { title: "Approved one", disciplines: [] }, approved_revision: 2, archived_at: null },
                    { id: uuid(2), user_id: ME, approved: null, approved_revision: null, archived_at: null },
                    { id: uuid(3), user_id: ME, approved: null, approved_revision: 1, archived_at: "2026-10-01T00:00:00Z" },
                ],
                legacyIndexById: { [uuid(1)]: 3 },
            },
        });
        expect(JSON.stringify(result)).not.toContain("Mrs Private");
        for (const query of queries) {
            expect(query.columns, "no draft column is asked for").not.toMatch(/\bdraft\b/);
            expect(query.filters, "every query names the contractor").toContain(`eq|user_id|${ME}`);
        }
        // The second query asks only about the ticked ids that were well formed and not already known.
        expect(queries[1].filters.find((filter) => filter.startsWith("in|"))).toBe(`in|id|${uuid(2)},${uuid(3)},${uuid(7)}`);
    });

    it("counts: approved and unapproved, unarchived only, with no content returned", async () => {
        const { client, queries } = session(TABLES);
        expect(await sessionReader(client).counts(ME)).toEqual({ state: "ok", value: { approved: 1, unapproved: 1 } });
        expect(queries.every((query) => query.head && query.columns === "id")).toBe(true);
    });

    it("one case study with its tags; a malformed id asks nothing", async () => {
        const { client, queries } = session(TABLES);
        const found = await sessionReader(client).study(ME, uuid(1));
        expect(found.state === "ok" && found.value).toMatchObject({ id: uuid(1), revision: 2, approvedRevision: 2, legacyIndex: 3, archived: false, disciplineIds: [uuid(9)] });
        expect(await sessionReader(client).study(ME, uuid(8))).toEqual({ state: "ok", value: null });
        const before = queries.length;
        expect(await sessionReader(client).study(ME, "'; DROP TABLE")).toEqual({ state: "ok", value: null });
        expect(queries.length).toBe(before);
    });

    it("the whole library, and one older entry by its place", async () => {
        const { client } = session(TABLES);
        const library = await sessionReader(client).library(ME);
        expect(library.state === "ok" && library.value.studies.map((entry) => entry.id)).toEqual([uuid(1), uuid(2), uuid(3)]);
        expect(library.state === "ok" && library.value.disciplines).toEqual([{ id: uuid(9), label: "Kitchens", position: 0, revision: 4, archived: false }]);
        expect(await sessionReader(client).olderEntry(ME, 0)).toEqual({ state: "ok", value: { projectName: "Older" } });
        expect(await sessionReader(client).olderEntry(ME, 5)).toEqual({ state: "ok", value: undefined });
    });

    it.each(["case_studies", "contractor_disciplines", "case_study_disciplines"])("a missing %s table is 'unavailable', never an empty library", async (missing) => {
        const { client } = session({ ...TABLES, [missing]: { error: { code: "PGRST205" } } });
        const reader = sessionReader(client);
        expect(await reader.library(ME)).toEqual({ state: "unavailable" });
        if (missing === "case_studies") {
            expect(await reader.forProposal(ME, [])).toEqual({ state: "unavailable" });
            expect(await reader.counts(ME)).toEqual({ state: "unavailable" });
            expect(await reader.study(ME, uuid(1))).toEqual({ state: "unavailable" });
        }
        if (missing === "contractor_disciplines") expect(await reader.disciplines(ME)).toEqual({ state: "unavailable" });
    });
});

describe("what a proposal is handed", () => {
    it("asks only about library ticks, and reports unapproved case studies as a number", async () => {
        const { client, queries } = session(TABLES);
        const library = await readProposalLibrary(sessionReader(client), ME, ["cs-1", 2, libraryTick(uuid(2)), "lib:junk", null]);
        expect(library).toMatchObject({ userId: ME, available: true, unapproved: 1, legacyIndexById: { [uuid(1)]: 3 } });
        expect(library.rows.map((row) => row.id)).toEqual([uuid(1), uuid(2)]);
        expect(queries.some((query) => query.filters.includes(`in|id|${uuid(2)}`))).toBe(true);
    });

    it("an unreadable library is 'not available' with no rows, and a reader that throws is the same", async () => {
        const { client } = session({ ...TABLES, case_studies: { error: { code: "42P01" } } });
        expect(await readProposalLibrary(sessionReader(client), ME, [libraryTick(uuid(1))])).toEqual({ userId: ME, rows: [], legacyIndexById: {}, available: false, unapproved: 0 });
        const broken = { forProposal: async () => { throw new Error("boom"); }, counts: async () => { throw new Error("boom"); } } as never;
        expect(await readProposalLibrary(broken, ME, [])).toMatchObject({ available: false, rows: [] });
    });
});

describe("one case study read at one revision, through the real queries", () => {
    const K_OLD = uuid(9);
    const K_OTHER = uuid(10);
    const tables = () => ({
        case_studies: [study(1, { revision: 2 })],
        contractor_disciplines: [
            { id: K_OLD, user_id: ME, label: "Old label", position: 0, revision: 1, archived_at: null },
            { id: K_OTHER, user_id: ME, label: "Other label", position: 1, revision: 1, archived_at: null },
        ] as Row[],
        case_study_disciplines: [{ case_study_id: uuid(1), discipline_id: K_OLD, user_id: ME }] as Row[],
        profiles: [],
    });
    type Tables = ReturnType<typeof tables>;
    /** Each is what the database does in ONE transaction: the change, and the case study's revision going up. */
    const COMMITS: Record<string, (t: Tables) => void> = {
        "a rename": (t) => { t.contractor_disciplines[0].label = "New label"; t.case_studies[0].revision = 3; },
        "an archive": (t) => { t.contractor_disciplines[0].archived_at = "2026-10-08T00:00:00Z"; t.case_studies[0].revision = 3; },
        "a tag replacement": (t) => { t.case_study_disciplines.splice(0, 1, { case_study_id: uuid(1), discipline_id: K_OTHER, user_id: ME }); t.case_studies[0].revision = 3; },
    };
    /** What a contractor would be shown from a read: the revision, and the labels of the active tags. */
    const picture = (read: Awaited<ReturnType<typeof readStudyAtOneRevision>>) => {
        if (read.state !== "ok") return read.state;
        const active = read.disciplines.filter((entry) => !entry.archived);
        return `${read.study.revision}:${read.study.disciplineIds.map((id) => active.find((entry) => entry.id === id)?.label ?? "(archived)").join("+")}`;
    };
    const BEFORE = "2:Old label";
    const AFTER: Record<string, string> = { "a rename": "3:New label", "an archive": "3:(archived)", "a tag replacement": "3:Other label" };

    it("asks for the revision alone, first and last, with the row, tags and kinds of work in between", async () => {
        const { client, queries } = session(tables());
        expect(picture(await readStudyAtOneRevision(sessionReader(client), ME, uuid(1)))).toBe(BEFORE);
        expect(queries.map((query) => `${query.table}:${query.columns === "revision" ? "revision" : "…"}`)).toEqual([
            "case_studies:revision", "case_studies:…", "case_study_disciplines:…", "contractor_disciplines:…", "case_studies:revision",
        ]);
        for (const query of queries) expect(query.filters).toContain(`eq|user_id|${ME}`);
    });

    it.each(Object.keys(COMMITS))("%s committed before any one of the queries never produces a mixture", async (name) => {
        // Before each of the five queries of the first attempt, and of the second.
        for (let position = 1; position <= 10; position += 1) {
            const t = tables();
            const { client, beforeAnswer } = session(t);
            beforeAnswer.set(position, () => COMMITS[name](t));
            const seen = picture(await readStudyAtOneRevision(sessionReader(client), ME, uuid(1)));
            // Either everything as it was before the change, or everything as it is after it. Never old labels with the new revision.
            expect([BEFORE, AFTER[name]], `committed before query ${position}`).toContain(seen);
            // Committed during the first attempt, it is noticed and read again; committed after, the first read stands.
            expect(seen, `committed before query ${position}`).toBe(position <= 5 ? AFTER[name] : BEFORE);
        }
    });

    it("the row and its tags are separate queries: on their own they CAN disagree, which is why the bracket is needed", async () => {
        const t = tables();
        const { client, beforeAnswer } = session(t);
        // The row is answered, then the tags are replaced, then the tags are answered.
        beforeAnswer.set(2, () => COMMITS["a tag replacement"](t));
        const alone = await sessionReader(client).study(ME, uuid(1));
        expect(alone.state === "ok" && alone.value && `${alone.value.revision}:${alone.value.disciplineIds.join()}`, "the old revision with the new tags").toBe(`2:${K_OTHER}`);
    });

    it("a case study that changes during every attempt is 'changing' after a fixed number of queries", async () => {
        const t = tables();
        const { client, beforeAnswer, answeredSoFar } = session(t);
        for (let attempt = 0; attempt < 10; attempt += 1) beforeAnswer.set(attempt * 5 + 3, () => { t.case_studies[0].revision = Number(t.case_studies[0].revision) + 1; });
        expect(await readStudyAtOneRevision(sessionReader(client), ME, uuid(1))).toEqual({ state: "changing" });
        expect(answeredSoFar()).toBe(COHERENT_READ_ATTEMPTS * 5);
    });

    it.each([1, 2, 3, 4, 5])("query %i failing is 'unavailable', never a partial picture", async (position) => {
        const { client, failAnswer, answeredSoFar } = session(tables());
        failAnswer.add(position);
        expect(await readStudyAtOneRevision(sessionReader(client), ME, uuid(1))).toEqual({ state: "unavailable" });
        // It stops there: it does not carry on and retry around a failed read.
        expect(answeredSoFar()).toBeLessThanOrEqual(5);
    });
});
