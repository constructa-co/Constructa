import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveCaseStudiesAction } from "./actions";
import { SAVE_MESSAGES } from "./save-state";

/**
 * The real save action over a stand-in for the signed-in session and the
 * `profiles` table. The stand-in is an assumption about the database, not an
 * observation of one: an update replaces the named column on the row whose id
 * matches and returns the columns asked for from the rows it changed.
 *
 * These tests are about HONEST saving. None of them is about two tabs: see
 * the "STILL OPEN" tests in `save-state.test.ts`.
 */
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
type Row = Record<string, unknown>;
let rows: Map<string, Row>;
let calls: Array<{ table: string; payload: Row; filters: Array<[string, unknown]>; selected: string | null }>;
/** What the next write does instead of answering normally. */
let next: null | { kind: "answer"; reply: unknown } | { kind: "throw" } | { kind: "write-then-error"; error: unknown } | { kind: "write-then-throw" };
let logged: unknown[][];

const client = {
    from(table: string) {
        return {
            update(payload: Row) {
                const filters: Array<[string, unknown]> = [];
                let selected: string | null = null;
                const run = async () => {
                    calls.push({ table, payload, filters, selected });
                    const mode = next;
                    next = null;
                    if (mode?.kind === "throw") throw new Error("socket hang up: raw transport text that must never be shown");
                    if (mode?.kind === "answer") return mode.reply;
                    const changed: Row[] = [];
                    for (const [id, row] of rows) {
                        if (filters.every(([column, value]) => (column === "id" ? id : row[column]) === value)) { Object.assign(row, structuredClone(payload)); changed.push({ id }); }
                    }
                    if (mode?.kind === "write-then-error") return { data: null, error: mode.error };
                    if (mode?.kind === "write-then-throw") throw new Error("connection reset after commit: raw text");
                    return { data: selected === null ? null : changed, error: null };
                };
                const query = {
                    eq(column: string, value: unknown) { filters.push([column, value]); return query; },
                    select(columns: string) { selected = columns; return query; },
                    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return run().then(resolve, reject); },
                };
                return query;
            },
        };
    },
};

const study = (id: string, projectName: string, extra: Row = {}) => ({ id, projectName, projectType: "", contractValue: "", programmeDuration: "", client: "", location: "", whatWeDelivered: "", valueAdded: "", photos: ["", "", ""], ...extra });
const stored = () => rows.get(ME)?.case_studies;

beforeEach(() => {
    rows = new Map([[ME, { company_name: "Example Builders", phone: "0113 496 0000", logo_url: "https://images.example.test/logo.png", capability_statement: "Kept exactly.", case_studies: [study("s1", "Kitchen refit")] }]]);
    calls = [];
    next = null;
    logged = [];
    for (const mock of [mocks.requireAuth, mocks.createAdminClient, mocks.revalidatePath]) mock.mockReset();
    mocks.requireAuth.mockImplementation(async () => ({ user: { id: ME }, supabase: client }));
    mocks.createAdminClient.mockImplementation(() => { throw new Error("a save must never make the privileged client"); });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { logged.push(args); });
});

describe("a confirmed save", () => {
    it("is one update of the caller's own row, naming one column, asking for the row's id back", async () => {
        const list = [study("s1", "Kitchen refit", { location: "Leeds" })];
        expect(await saveCaseStudiesAction(list)).toEqual({ status: "saved", refreshed: true });
        expect(calls).toHaveLength(1);
        expect(calls[0].table).toBe("profiles");
        expect(Object.keys(calls[0].payload)).toEqual(["case_studies"]);
        expect(calls[0].filters).toEqual([["id", ME]]);
        expect(calls[0].selected).toBe("id");
        expect(stored()).toEqual(list);
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings/case-studies");
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("leaves every other profile column exactly as it was", async () => {
        const before = structuredClone(rows.get(ME)!);
        await saveCaseStudiesAction([study("s2", "Loft")]);
        const after = rows.get(ME)!;
        expect({ ...after, case_studies: null }).toEqual({ ...before, case_studies: null });
    });

    it("sends every entry and every key exactly as given: nothing inspected, capped, tidied or dropped", async () => {
        const long = "x".repeat(60_000);
        const legacy: unknown[] = [
            { id: "old-1", projectName: "  Spaces kept  ", whatWeDelivered: long, valueAdded: "line one\r\nline two\n\n", photos: ["https://images.example.test/a.jpg", "", "http://not-https.example.test/b.png", "a fourth slot"], unknownKey: { nested: [1, 2, { deep: true }] }, another: null, count: 42, flag: false },
            { projectName: "No id at all", photos: "not a list" },
            { id: "", projectName: "", extra_legacy_field: "kept" },
            {},
            "a bare string entry",
            null,
            17,
            ["a nested list"],
            ...Array.from({ length: 300 }, (_, index) => ({ id: `many-${index}`, projectName: `Job ${index}` })),
        ];
        const given = structuredClone(legacy);
        expect((await saveCaseStudiesAction(legacy)).status).toBe("saved");
        expect(calls[0].payload.case_studies).toEqual(given);
        expect(JSON.stringify(calls[0].payload.case_studies)).toBe(JSON.stringify(given));
        expect(stored()).toEqual(given);
        // And what the caller handed over was not altered either.
        expect(legacy).toEqual(given);
    });

    it("an empty list is a deliberate clear, and is saved", async () => {
        expect((await saveCaseStudiesAction([])).status).toBe("saved");
        expect(stored()).toEqual([]);
    });

    it("stays 'saved' when telling other pages to reload fails afterwards: the write was confirmed", async () => {
        mocks.revalidatePath.mockImplementation(() => { throw new Error("Invariant: static generation store missing: raw framework text"); });
        const list = [study("s1", "Kitchen refit", { location: "Leeds" })];
        expect(await saveCaseStudiesAction(list)).toEqual({ status: "saved", refreshed: false });
        expect(stored()).toEqual(list);
        expect(JSON.stringify(logged)).not.toContain("Invariant");
    });
});

describe("no write is attempted", () => {
    it("signed out: says so, and the database is never asked", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        expect(await saveCaseStudiesAction([study("s1", "Edited")])).toEqual({ status: "signed-out", message: SAVE_MESSAGES.signedOut });
        expect(calls).toEqual([]);
        expect(stored()).toEqual([study("s1", "Kitchen refit")]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([["a string", "not a list at all"], ["an object", { 0: "a", length: 1 }], ["null", null], ["undefined", undefined], ["a number", 3], ["true", true]])("%s is not a list: refused, and the database is never asked", async (_name, value) => {
        expect(await saveCaseStudiesAction(value)).toEqual({ status: "refused", message: SAVE_MESSAGES.refused });
        expect(calls).toEqual([]);
        expect(stored()).toEqual([study("s1", "Kitchen refit")]);
    });

    it("the messages for these two say truthfully that nothing was sent", () => {
        expect(SAVE_MESSAGES.signedOut).toContain("nothing was sent");
        expect(SAVE_MESSAGES.refused).toContain("nothing was sent");
    });
});

describe("the write ran and no row came back", () => {
    it("is 'not confirmed', never 'saved', and does not pretend to know why", async () => {
        rows.clear();
        expect(await saveCaseStudiesAction([study("s1", "Kitchen refit")])).toEqual({ status: "no-row", message: SAVE_MESSAGES.noRow });
        expect(calls).toHaveLength(1);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(SAVE_MESSAGES.noRow).toContain("wasn't confirmed");
        expect(SAVE_MESSAGES.noRow).not.toMatch(/doesn't exist|not found|permission|not yours/i);
    });
});

describe("anything else at the write is NOT KNOWN: no error is taken as proof that nothing was written", () => {
    const unknown = { status: "unknown", message: SAVE_MESSAGES.unknown };

    it.each([
        ["a constraint code", { code: "23514", message: "new row violates check constraint: RAW DATABASE TEXT" }],
        ["a permission code", { code: "42501", message: "permission denied for table profiles: RAW DATABASE TEXT" }],
        ["an API code", { code: "PGRST301", message: "JWT expired: RAW DATABASE TEXT" }],
        ["a connection code", { code: "08006", message: "connection failure: RAW DATABASE TEXT" }],
        ["a server error with a status", { status: 500, message: "upstream error: RAW DATABASE TEXT" }],
        ["a gateway timeout", { code: "504", message: "Gateway Timeout: RAW DATABASE TEXT" }],
        ["no code at all", { message: "TypeError: fetch failed: RAW DATABASE TEXT" }],
        ["a bare string", "RAW DATABASE TEXT"],
    ])("an error reply (%s) is 'not known', with fixed words and none of its own text or code", async (_name, error) => {
        next = { kind: "answer", reply: { data: null, error } };
        const result = await saveCaseStudiesAction([study("s1", "Edited")]);
        expect(result).toEqual(unknown);
        const everything = JSON.stringify([result, logged]);
        expect(everything).not.toContain("RAW DATABASE TEXT");
        for (const code of ["23514", "42501", "PGRST301", "08006", "504"]) expect(everything).not.toContain(code);
        expect(logged).toEqual([["case studies save: outcome not known", { kind: "error-returned" }]]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("WHY: an error can come back after the write was made. Reported 'not known', and the list WAS replaced", async () => {
        const list = [study("s1", "Written, then the answer was an error")];
        next = { kind: "write-then-error", error: { code: "57014", message: "canceling statement due to statement timeout" } };
        expect(await saveCaseStudiesAction(list)).toEqual(unknown);
        expect(stored(), "the write did land").toEqual(list);
        expect(SAVE_MESSAGES.unknown).not.toMatch(/nothing was (changed|saved|sent)/i);
    });

    it("a call that throws, before or after the write, is 'not known'", async () => {
        next = { kind: "throw" };
        expect(await saveCaseStudiesAction([study("s1", "Edited")])).toEqual(unknown);
        expect(stored()).toEqual([study("s1", "Kitchen refit")]);
        const list = [study("s1", "Written, then the call threw")];
        next = { kind: "write-then-throw" };
        expect(await saveCaseStudiesAction(list)).toEqual(unknown);
        expect(stored()).toEqual(list);
        expect(JSON.stringify(logged)).not.toMatch(/socket hang up|connection reset|raw/i);
    });

    it.each([
        ["no reply at all", undefined],
        ["a reply that is not an object", "ok"],
        ["no data", { data: null, error: null }],
        ["data that is not rows", { data: { id: ME }, error: null }],
        ["a row with no id", { data: [{}], error: null }],
        ["a null row", { data: [null], error: null }],
        ["two rows", { data: [{ id: ME }, { id: ME }], error: null }],
    ])("a reply that is not understood (%s) is 'not known'", async (_name, reply) => {
        next = { kind: "answer", reply };
        expect(await saveCaseStudiesAction([study("s1", "Edited")])).toEqual(unknown);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([["another contractor's id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"], ["an id of another type", 1], ["an empty id", ""]])("one row back whose id is not the caller's (%s) is 'not known', never 'saved'", async (_name, id) => {
        next = { kind: "answer", reply: { data: [{ id }], error: null } };
        expect(await saveCaseStudiesAction([study("s1", "Edited")])).toEqual(unknown);
        expect(logged).toEqual([["case studies save: outcome not known", { kind: "row-not-own" }]]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("says plainly that saving again replaces whatever is stored, including another tab's changes, and promises no safe retry", () => {
        expect(SAVE_MESSAGES.unknown).toContain("replaces whatever is stored, including anything changed in another tab or window");
        expect(SAVE_MESSAGES.unknown).not.toMatch(/safe|won't be lost|no risk/i);
    });

    it("nothing is retried by itself: one request per call, whatever the outcome", async () => {
        for (const mode of [{ kind: "throw" }, { kind: "answer", reply: { data: null, error: { code: "08006" } } }, { kind: "answer", reply: { data: [], error: null } }] as const) {
            calls.length = 0;
            next = mode as typeof next;
            await saveCaseStudiesAction([study("s1", "Edited")]);
            expect(calls).toHaveLength(1);
        }
    });
});
