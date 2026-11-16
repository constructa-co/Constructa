import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { legacyCaseStudiesStoredFingerprint } from "@/lib/server/legacy-case-studies-fingerprint";
import { LEGACY_CASE_STUDY_PHOTOS_MESSAGE } from "@/lib/case-library/legacy-photos";
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
type TableFilter = [string, unknown, "eq" | "is" | undefined];
let calls: Array<{ table: string; op: "select" | "update"; payload: Row | null; filters: TableFilter[]; selected: string | null }>;
/** What the next write does instead of answering normally. */
let next: null | { kind: "answer"; reply: unknown } | { kind: "throw" } | { kind: "write-then-error"; error: unknown } | { kind: "write-then-throw" };
let logged: unknown[][];

const rowMatches = (id: string, row: Row, filters: TableFilter[]) =>
    filters.every(([column, value, kind]) => {
        if (column === "id") return id === value;
        const current = row[column];
        if (column === "case_studies") {
            if (kind === "is") return (current === null || current === undefined) && value === null;
            return legacyCaseStudiesStoredFingerprint(current) === legacyCaseStudiesStoredFingerprint(value);
        }
        if (kind === "is") return (current === null || current === undefined) && value === null;
        return current === value;
    });

const client = {
    from(table: string) {
        const filters: TableFilter[] = [];
        let selected: string | null = null;
        let payload: Row | null = null;
        let op: "select" | "update" = "select";

        const run = async () => {
            calls.push({ table, op, payload, filters: structuredClone(filters), selected });
            const mode = op === "update" ? next : null;
            if (op === "update") next = null;

            if (op === "select") {
                for (const [id, row] of rows) {
                    if (rowMatches(id, row, filters)) {
                        return { data: { case_studies: structuredClone(row.case_studies) }, error: null };
                    }
                }
                return { data: null, error: null };
            }

            if (mode?.kind === "answer") return mode.reply;
            if (mode?.kind === "throw") throw new Error("socket hang up: raw transport text that must never be shown");

            const matched: Row[] = [];
            for (const [id, row] of rows) {
                if (rowMatches(id, row, filters)) matched.push(row);
            }
            if (matched.length === 0) return { data: [], error: null };

            matched.forEach((row) => {
                Object.assign(row, structuredClone(payload!));
            });
            const changed = matched.map((row) => ({ id: ME, case_studies: structuredClone(row.case_studies) }));

            if (mode?.kind === "write-then-error") return { data: null, error: mode.error };
            if (mode?.kind === "write-then-throw") throw new Error("connection reset after commit: raw text");
            return { data: selected === null ? null : changed, error: null };
        };

        return {
            select(columns: string) {
                op = "select";
                selected = columns;
                const query = {
                    eq(column: string, value: unknown) { filters.push([column, value, "eq"]); return query; },
                    maybeSingle() { return run(); },
                };
                return query;
            },
            update(nextPayload: Row) {
                op = "update";
                payload = nextPayload;
                const query = {
                    eq(column: string, value: unknown) { filters.push([column, value, "eq"]); return query; },
                    is(column: string, value: unknown) { filters.push([column, value, "is"]); return query; },
                    select(columns: string) { selected = columns; return query; },
                    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return run().then(resolve, reject); },
                };
                return query;
            },
        };
    },
};

const fp = () => legacyCaseStudiesStoredFingerprint(stored());

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
        const result = await saveCaseStudiesAction(list, fp());
        expect(result).toMatchObject({ status: "saved", refreshed: true });
        if (result.status === "saved") expect(result.fingerprint).toMatch(/^[0-9a-f]{32}$/);
        expect(calls).toHaveLength(2);
        expect(calls[0].op).toBe("select");
        expect(calls[1].table).toBe("profiles");
        expect(calls[1].op).toBe("update");
        expect(Object.keys(calls[1].payload!)).toEqual(["case_studies"]);
        expect(calls[1].filters).toContainEqual(["id", ME, "eq"]);
        expect(calls[1].selected).toBe("id, case_studies");
        expect(stored()).toEqual(list);
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings/case-studies");
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("leaves every other profile column exactly as it was", async () => {
        const before = structuredClone(rows.get(ME)!);
        await saveCaseStudiesAction([study("s2", "Loft")], fp());
        const after = rows.get(ME)!;
        expect({ ...after, case_studies: null }).toEqual({ ...before, case_studies: null });
    });

    it("sends every entry and every key exactly as given when pictures are valid", async () => {
        const long = "x".repeat(60_000);
        const legacy: unknown[] = [
            { id: "old-1", projectName: "  Spaces kept  ", whatWeDelivered: long, valueAdded: "line one\r\nline two\n\n", photos: ["https://images.example.test/a.jpg", "", ""], unknownKey: { nested: [1, 2, { deep: true }] }, another: null, count: 42, flag: false },
            { id: "", projectName: "", extra_legacy_field: "kept" },
            {},
            "a bare string entry",
            null,
            17,
            ["a nested list"],
            ...Array.from({ length: 300 }, (_, index) => ({ id: `many-${index}`, projectName: `Job ${index}`, photos: ["", "", ""] })),
        ];
        const given = structuredClone(legacy);
        expect((await saveCaseStudiesAction(legacy, fp())).status).toBe("saved");
        const updateCall = calls.find((call) => call.op === "update");
        expect(updateCall!.payload!.case_studies).toEqual(given);
        expect(JSON.stringify(updateCall!.payload!.case_studies)).toEqual(JSON.stringify(given));
        expect(stored()).toEqual(given);
        expect(legacy).toEqual(given);
    });

    it("refuses a fourth photograph, an unsafe link, or pictures that are not a list", async () => {
        await expect(saveCaseStudiesAction([study("s1", "Kitchen", { photos: ["a", "b", "c", "d"] })], fp())).resolves.toEqual({
            status: "refused",
            message: LEGACY_CASE_STUDY_PHOTOS_MESSAGE,
        });
        expect(calls).toHaveLength(0);
        await expect(saveCaseStudiesAction([study("s1", "Kitchen", { photos: ["https://images.example.test/a.jpg", "", "http://not-https.example.test/b.png"] })], fp())).resolves.toEqual({
            status: "refused",
            message: LEGACY_CASE_STUDY_PHOTOS_MESSAGE,
        });
        expect(calls).toHaveLength(0);
        await expect(saveCaseStudiesAction([study("s1", "Kitchen", { photos: "not a list" })], fp())).resolves.toEqual({
            status: "refused",
            message: LEGACY_CASE_STUDY_PHOTOS_MESSAGE,
        });
        expect(calls).toHaveLength(0);
        expect(stored()).toEqual([study("s1", "Kitchen refit")]);
    });

    it("an empty list is a deliberate clear, and is saved", async () => {
        expect((await saveCaseStudiesAction([], fp())).status).toBe("saved");
        expect(stored()).toEqual([]);
    });

    it("stays 'saved' when telling other pages to reload fails afterwards: the write was confirmed", async () => {
        mocks.revalidatePath.mockImplementation(() => { throw new Error("Invariant: static generation store missing: raw framework text"); });
        const list = [study("s1", "Kitchen refit", { location: "Leeds" })];
        expect(await saveCaseStudiesAction(list, fp())).toMatchObject({ status: "saved", refreshed: false });
        expect(stored()).toEqual(list);
        expect(JSON.stringify(logged)).not.toContain("Invariant");
    });
});

describe("no write is attempted", () => {
    it("signed out: says so, and the database is never asked", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        expect(await saveCaseStudiesAction([study("s1", "Edited")], fp())).toEqual({ status: "signed-out", message: SAVE_MESSAGES.signedOut });
        expect(calls).toEqual([]);
        expect(stored()).toEqual([study("s1", "Kitchen refit")]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([["a string", "not a list at all"], ["an object", { 0: "a", length: 1 }], ["null", null], ["undefined", undefined], ["a number", 3], ["true", true]])("%s is not a list: refused, and the database is never asked", async (_name, value) => {
        expect(await saveCaseStudiesAction(value, fp())).toEqual({ status: "refused", message: SAVE_MESSAGES.refused });
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
        const fingerprint = fp();
        next = { kind: "answer", reply: { data: [], error: null } };
        expect(await saveCaseStudiesAction([study("s1", "Kitchen refit")], fingerprint)).toEqual({ status: "no-row", message: SAVE_MESSAGES.noRow });
        expect(calls.some((call) => call.op === "update")).toBe(true);
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
        const result = await saveCaseStudiesAction([study("s1", "Edited")], fp());
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
        expect(await saveCaseStudiesAction(list, fp())).toEqual(unknown);
        expect(stored(), "the write did land").toEqual(list);
        expect(SAVE_MESSAGES.unknown).not.toMatch(/nothing was (changed|saved|sent)/i);
    });

    it("a call that throws, before or after the write, is 'not known'", async () => {
        next = { kind: "throw" };
        expect(await saveCaseStudiesAction([study("s1", "Edited")], fp())).toEqual(unknown);
        expect(stored()).toEqual([study("s1", "Kitchen refit")]);
        const list = [study("s1", "Written, then the call threw")];
        next = { kind: "write-then-throw" };
        expect(await saveCaseStudiesAction(list, fp())).toEqual(unknown);
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
        expect(await saveCaseStudiesAction([study("s1", "Edited")], fp())).toEqual(unknown);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([["another contractor's id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"], ["an id of another type", 1], ["an empty id", ""]])("one row back whose id is not the caller's (%s) is 'not known', never 'saved'", async (_name, id) => {
        next = { kind: "answer", reply: { data: [{ id, case_studies: [] }], error: null } };
        expect(await saveCaseStudiesAction([study("s1", "Edited")], fp())).toEqual(unknown);
        expect(logged).toEqual([["case studies save: outcome not known", { kind: "row-not-own" }]]);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("tells the contractor to save again without promising the outcome", () => {
        expect(SAVE_MESSAGES.unknown).toContain("Save again to retry");
        expect(SAVE_MESSAGES.conflict).toMatch(/Another tab or window/);
    });

    it("refuses when the fingerprint does not match storage", async () => {
        expect(await saveCaseStudiesAction([study("s1", "Edited")], "00000000000000000000000000000000")).toEqual({
            status: "conflict",
            message: SAVE_MESSAGES.conflict,
        });
        expect(calls.filter((call) => call.op === "update")).toHaveLength(0);
    });

    it("a list this tab sent itself, with the answer lost, is not another tab's: saving again over it is saved", async () => {
        const loadedWith = fp();
        const sentBefore = [study("s1", "Written, then the call threw")];
        next = { kind: "write-then-throw" };
        expect(await saveCaseStudiesAction(sentBefore, loadedWith)).toEqual(unknown);
        expect(stored()).toEqual(sentBefore);

        const again = [study("s1", "Typed after the lost answer")];
        // Without naming what it sent, the tab cannot be told from a stale one.
        expect((await saveCaseStudiesAction(again, loadedWith)).status).toBe("conflict");
        // Named, and read back in whatever key order storage keeps.
        const asSent = [Object.fromEntries(Object.entries(sentBefore[0]).reverse())];
        expect(await saveCaseStudiesAction(again, loadedWith, [asSent])).toMatchObject({ status: "saved", refreshed: true });
        expect(stored()).toEqual(again);
    });

    it.each([
        ["lists that are not what is stored", [[study("s1", "Something this tab sent once")], []]],
        ["no lists", []],
        ["something that is not a list of lists", "not lists"],
        ["entries that are not lists", [null, 3, { 0: "x" }]],
    ])("naming %s does not get a stale tab past another tab's save", async (_name, unconfirmed) => {
        const loadedWith = fp();
        rows.get(ME)!.case_studies = [study("s1", "Saved in another tab")];
        expect(await saveCaseStudiesAction([study("s1", "Edited")], loadedWith, unconfirmed)).toEqual({ status: "conflict", message: SAVE_MESSAGES.conflict });
        expect(calls.filter((call) => call.op === "update")).toHaveLength(0);
        expect(stored()).toEqual([study("s1", "Saved in another tab")]);
    });

    it("nothing is retried by itself: one request per call, whatever the outcome", async () => {
        for (const mode of [{ kind: "throw" }, { kind: "answer", reply: { data: null, error: { code: "08006" } } }, { kind: "answer", reply: { data: [], error: null } }] as const) {
            calls.length = 0;
            next = mode as typeof next;
            await saveCaseStudiesAction([study("s1", "Edited")], fp());
            expect(calls.filter((call) => call.op === "update")).toHaveLength(1);
        }
    });
});
