import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireEditableProjectAccess: vi.fn(),
    requireEstimateAccess: vi.fn(),
    requireEditableAccessForVerifiedProject: vi.fn(),
}));
vi.mock("@/lib/supabase/project-resource-access", () => mocks);
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: vi.fn(), getActiveOrganizationId: vi.fn() }));

import {
    deleteSimplePriceLineAction,
    savePriceAdjustmentsAction,
    saveSimplePriceLineAction,
    updateSimplePriceLineAction,
} from "./simple-actions";
import { LINE_SAVE_ERROR } from "@/lib/simple-estimate";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ESTIMATE_ID = "22222222-2222-4222-8222-222222222222";
const LINE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_LINE_ID = "44444444-4444-4444-8444-444444444444";
const ORG_ID = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;
type Failure = { table: string; op: "insert" | "update" | "delete" | "select"; code: string; times: number };

/**
 * A small in-memory stand-in for the Supabase client: enough of the query
 * builder for these actions, primary keys that reject duplicates, and
 * failures that can be injected per table and operation.
 */
function fakeDb(seed: Partial<Record<string, Row[]>> = {}) {
    const tables: Record<string, Row[]> = {
        projects: [{ id: PROJECT_ID, user_id: USER_ID, organization_id: ORG_ID, status: "Lead" }],
        estimates: [],
        estimate_lines: [],
        ...seed,
    };
    const failures: Failure[] = [];
    const log: string[] = [];

    const takeFailure = (table: string, op: Failure["op"]) => {
        const failure = failures.find((f) => f.table === table && f.op === op && f.times > 0);
        if (!failure) return null;
        failure.times -= 1;
        return { code: failure.code, message: "injected failure" };
    };

    function from(table: string) {
        let op: Failure["op"] = "select";
        let payload: Row | null = null;
        let wantRows = false;
        const filters: [string, unknown][] = [];

        const run = () => {
            log.push(`${op}:${table}`);
            const injected = takeFailure(table, op);
            if (injected) return { data: null, error: injected };
            const rows = tables[table];
            const matches = (row: Row) => filters.every(([column, value]) => row[column] === value);

            if (op === "insert") {
                if (rows.some((row) => row.id === payload!.id)) return { data: null, error: { code: "23505", message: "duplicate key" } };
                rows.push({ ...payload! });
                return { data: [payload], error: null };
            }
            if (op === "update") {
                const hit = rows.filter(matches);
                hit.forEach((row) => Object.assign(row, payload));
                return { data: wantRows ? hit : null, error: null };
            }
            if (op === "delete") {
                tables[table] = rows.filter((row) => !matches(row));
                if (table === "estimates") {
                    const kept = new Set(tables.estimates.map((e) => e.id));
                    tables.estimate_lines = tables.estimate_lines.filter((l) => kept.has(l.estimate_id));
                }
                return { data: null, error: null };
            }
            const found = rows.filter(matches).map((row) =>
                table === "estimates"
                    ? { ...row, estimate_lines: tables.estimate_lines.filter((l) => l.estimate_id === row.id) }
                    : { ...row },
            );
            return { data: found, error: null };
        };

        const one = (strict: boolean) => {
            const result = run();
            if (result.error) return result;
            const rows = (result.data as Row[] | null) ?? [];
            if (rows.length === 0 && strict) return { data: null, error: { code: "PGRST116", message: "no rows" } };
            return { data: rows[0] ?? null, error: null };
        };

        const builder = {
            select: () => { wantRows = true; return builder; },
            insert: (row: Row) => { op = "insert"; payload = row; return builder; },
            update: (row: Row) => { op = "update"; payload = row; return builder; },
            delete: () => { op = "delete"; return builder; },
            eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
            order: () => builder,
            single: async () => one(true),
            maybeSingle: async () => one(false),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(run()).then(resolve, reject),
        };
        return builder;
    }

    return {
        tables,
        log,
        failNext: (table: string, op: Failure["op"], code = "08006", times = 1) => failures.push({ table, op, code, times }),
        supabase: { from },
    };
}

function useDb(db: ReturnType<typeof fakeDb>) {
    const access = { supabase: db.supabase, user: { id: USER_ID }, project: { id: PROJECT_ID, user_id: USER_ID } };
    mocks.requireEditableProjectAccess.mockResolvedValue(access);
    mocks.requireEstimateAccess.mockImplementation(async (estimateId: string) => ({ ...access, estimateId, projectId: PROJECT_ID }));
    mocks.requireEditableAccessForVerifiedProject.mockImplementation(async (verified: unknown) => verified);
}

const request = (overrides: Record<string, unknown> = {}) => ({
    projectId: PROJECT_ID,
    estimateId: null,
    newEstimateId: NEW_ESTIMATE_ID,
    lineId: LINE_ID,
    line: { description: "Bathroom refit", quantity: 1, unit: "item", unit_rate: 2500 },
    ...overrides,
});

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveSimplePriceLineAction — lazy estimate creation", () => {
    it("creates the estimate with the first line: no template lines, no mark-up", async () => {
        const db = fakeDb();
        useDb(db);

        const result = await saveSimplePriceLineAction(request());

        expect(result.ok).toBe(true);
        expect(db.tables.estimates).toEqual([{
            id: NEW_ESTIMATE_ID,
            project_id: PROJECT_ID,
            organization_id: ORG_ID,
            version_name: "Estimate v1",
            total_cost: 2500,
            prelims_pct: 0,
            overhead_pct: 0,
            risk_pct: 0,
            profit_pct: 0,
            is_active: true,
        }]);
        expect(db.tables.estimate_lines).toHaveLength(1);
        expect(db.tables.estimate_lines[0]).toMatchObject({
            id: LINE_ID,
            estimate_id: NEW_ESTIMATE_ID,
            trade_section: "General",
            description: "Bathroom refit",
            quantity: 1,
            unit: "item",
            unit_rate: 2500,
            line_total: 2500,
            pricing_mode: "simple",
        });
        if (!result.ok) throw new Error("expected ok");
        expect(result.estimateId).toBe(NEW_ESTIMATE_ID);
        expect(result.createdEstimate?.estimate_lines.map((l) => l.id)).toEqual([LINE_ID]);
        expect(result.line.line_total).toBe(2500);
    });

    it("moves a Lead project to Estimating when its first price is saved", async () => {
        const db = fakeDb();
        useDb(db);
        await saveSimplePriceLineAction(request());
        expect(db.tables.projects[0].status).toBe("Estimating");
    });

    it("multiplies quantity by rate for the stored line total", async () => {
        const db = fakeDb();
        useDb(db);
        await saveSimplePriceLineAction(request({ line: { description: "Wall tiling", quantity: 12.5, unit: "m2", unit_rate: 45.5 } }));
        expect(db.tables.estimate_lines[0].line_total).toBe(568.75);
        expect(db.tables.estimates[0].total_cost).toBe(568.75);
    });

    it("does not touch the database for a line with no description or price", async () => {
        const db = fakeDb();
        useDb(db);

        for (const line of [
            { description: " ", quantity: 1, unit: "item", unit_rate: 2500 },
            { description: "x", quantity: 1, unit: "item", unit_rate: 0 },
            { description: "x", quantity: -1, unit: "item", unit_rate: 10 },
            { description: "x", quantity: 1, unit: " ", unit_rate: 10 },
        ]) {
            expect((await saveSimplePriceLineAction(request({ line }))).ok).toBe(false);
        }
        expect(db.log).toEqual([]);
        expect(db.tables.estimates).toEqual([]);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
    });

    it("leaves no empty estimate behind when the first line fails to save", async () => {
        const db = fakeDb();
        useDb(db);
        db.failNext("estimate_lines", "insert");

        const result = await saveSimplePriceLineAction(request());

        expect(result).toEqual({ ok: false, error: LINE_SAVE_ERROR });
        expect(db.tables.estimates).toEqual([]);
        expect(db.tables.estimate_lines).toEqual([]);
        expect(db.tables.projects[0].status).toBe("Lead");
    });

    it("a retry after a failure creates exactly one estimate and one line", async () => {
        const db = fakeDb();
        useDb(db);
        db.failNext("estimate_lines", "insert");

        expect((await saveSimplePriceLineAction(request())).ok).toBe(false);
        expect((await saveSimplePriceLineAction(request())).ok).toBe(true);

        expect(db.tables.estimates.map((e) => e.id)).toEqual([NEW_ESTIMATE_ID]);
        expect(db.tables.estimate_lines.map((l) => l.id)).toEqual([LINE_ID]);
    });

    it("a retry after a lost response reports the saved line instead of duplicating it", async () => {
        const db = fakeDb();
        useDb(db);

        const first = await saveSimplePriceLineAction(request());
        // The browser never saw `first`, so it sends the same request again.
        const retry = await saveSimplePriceLineAction(request());

        expect(retry).toEqual(first);
        expect(db.tables.estimates).toHaveLength(1);
        expect(db.tables.estimate_lines).toHaveLength(1);
        expect(db.tables.estimates[0].total_cost).toBe(2500);
    });

    it("reuses an estimate that already exists rather than making a second", async () => {
        const db = fakeDb({
            estimates: [{ id: "existing-estimate", project_id: PROJECT_ID, is_active: true, overhead_pct: 10, profit_pct: 15 }],
            estimate_lines: [{ id: OTHER_LINE_ID, estimate_id: "existing-estimate", description: "Earlier line", line_total: 100 }],
        });
        useDb(db);

        const result = await saveSimplePriceLineAction(request());

        if (!result.ok) throw new Error("expected ok");
        expect(result.estimateId).toBe("existing-estimate");
        expect(db.tables.estimates).toHaveLength(1);
        // Its existing percentages are left alone.
        expect(db.tables.estimates[0]).toMatchObject({ overhead_pct: 10, profit_pct: 15 });
        expect(result.createdEstimate?.estimate_lines.map((l) => l.id)).toEqual([OTHER_LINE_ID, LINE_ID]);
    });

    it("adds to a named estimate without creating one", async () => {
        const db = fakeDb({ estimates: [{ id: NEW_ESTIMATE_ID, project_id: PROJECT_ID, is_active: true }] });
        useDb(db);

        const result = await saveSimplePriceLineAction(request({ estimateId: NEW_ESTIMATE_ID }));

        if (!result.ok) throw new Error("expected ok");
        expect(result.createdEstimate).toBeNull();
        expect(db.log.filter((entry) => entry === "insert:estimates")).toEqual([]);
        expect(db.tables.projects[0].status).toBe("Lead");
    });

    it("refuses an estimate that belongs to another project", async () => {
        const db = fakeDb({ estimates: [{ id: NEW_ESTIMATE_ID, project_id: "someone-elses-project", is_active: true }] });
        useDb(db);

        const result = await saveSimplePriceLineAction(request({ estimateId: NEW_ESTIMATE_ID }));

        expect(result.ok).toBe(false);
        expect(db.tables.estimate_lines).toEqual([]);
    });

    it("reports the line as saved, with a warning, when only the stored total could not refresh", async () => {
        const db = fakeDb();
        useDb(db);
        db.failNext("estimates", "update");

        const result = await saveSimplePriceLineAction(request());

        if (!result.ok) throw new Error("expected ok");
        expect(result.warning).toMatch(/stored estimate total could not be refreshed/);
        expect(db.tables.estimate_lines).toHaveLength(1);
    });

    it("returns the lock reason for an accepted proposal and writes nothing", async () => {
        const db = fakeDb();
        useDb(db);
        const reason = "This proposal has been accepted. Record later scope or price changes as variations.";
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error(reason));

        expect(await saveSimplePriceLineAction(request())).toEqual({ ok: false, error: reason });
        expect(db.log).toEqual([]);
    });

    it("returns a retryable message, not a thrown error, when the session fails", async () => {
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        expect(await saveSimplePriceLineAction(request())).toEqual({ ok: false, error: LINE_SAVE_ERROR });
    });
});

describe("edit, delete and adjustments", () => {
    const seeded = () => fakeDb({
        estimates: [{ id: NEW_ESTIMATE_ID, project_id: PROJECT_ID, is_active: true, total_cost: 2500, overhead_pct: 0, profit_pct: 0 }],
        estimate_lines: [
            { id: LINE_ID, estimate_id: NEW_ESTIMATE_ID, description: "Bathroom refit", quantity: 1, unit: "item", unit_rate: 2500, line_total: 2500, pricing_mode: "simple" },
            { id: OTHER_LINE_ID, estimate_id: NEW_ESTIMATE_ID, description: "Built up", quantity: 2, unit: "m2", unit_rate: 50, line_total: 100, pricing_mode: "buildup" },
        ],
    });

    it("updates a line and the stored total", async () => {
        const db = seeded();
        useDb(db);

        const result = await updateSimplePriceLineAction(NEW_ESTIMATE_ID, LINE_ID, { description: "Bathroom refit", quantity: 1, unit: "item", unit_rate: 3000 });

        expect(result).toMatchObject({ ok: true, line: { id: LINE_ID, unit_rate: 3000, line_total: 3000 } });
        expect(db.tables.estimates[0].total_cost).toBe(3100);
    });

    it("leaves the line as it was when the update fails", async () => {
        const db = seeded();
        useDb(db);
        db.failNext("estimate_lines", "update");

        const result = await updateSimplePriceLineAction(NEW_ESTIMATE_ID, LINE_ID, { description: "Changed", quantity: 1, unit: "item", unit_rate: 3000 });

        expect(result).toEqual({ ok: false, error: LINE_SAVE_ERROR });
        expect(db.tables.estimate_lines[0]).toMatchObject({ description: "Bathroom refit", unit_rate: 2500 });
    });

    it("will not overwrite a rate build-up line from the simple screen", async () => {
        const db = seeded();
        useDb(db);

        const result = await updateSimplePriceLineAction(NEW_ESTIMATE_ID, OTHER_LINE_ID, { description: "x", quantity: 1, unit: "item", unit_rate: 1 });

        expect(result.ok).toBe(false);
        expect(db.tables.estimate_lines[1]).toMatchObject({ unit_rate: 50, line_total: 100 });
    });

    it("deletes a line, and deleting it again is still a success", async () => {
        const db = seeded();
        useDb(db);

        expect(await deleteSimplePriceLineAction(NEW_ESTIMATE_ID, LINE_ID)).toEqual({ ok: true });
        expect(await deleteSimplePriceLineAction(NEW_ESTIMATE_ID, LINE_ID)).toEqual({ ok: true });
        expect(db.tables.estimate_lines.map((l) => l.id)).toEqual([OTHER_LINE_ID]);
        expect(db.tables.estimates[0].total_cost).toBe(100);
    });

    it("keeps the line when the delete fails", async () => {
        const db = seeded();
        useDb(db);
        db.failNext("estimate_lines", "delete");

        expect((await deleteSimplePriceLineAction(NEW_ESTIMATE_ID, LINE_ID)).ok).toBe(false);
        expect(db.tables.estimate_lines).toHaveLength(2);
    });

    it("saves every adjustment in one update", async () => {
        const db = seeded();
        useDb(db);
        const input = { prelims_pct: 5, overhead_pct: 10, risk_pct: 2.5, profit_pct: 15, discount_pct: 0, discount_reason: "" };

        expect(await savePriceAdjustmentsAction(NEW_ESTIMATE_ID, input)).toEqual({ ok: true });
        expect(db.tables.estimates[0]).toMatchObject(input);
        expect(db.log.filter((entry) => entry === "update:estimates")).toHaveLength(1);
    });

    it("rejects out-of-range adjustments before touching the database", async () => {
        const db = seeded();
        useDb(db);
        const result = await savePriceAdjustmentsAction(NEW_ESTIMATE_ID, {
            prelims_pct: 0, overhead_pct: 250, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
        });
        expect(result.ok).toBe(false);
        expect(db.log).toEqual([]);
    });

    it("refuses edits on a locked project with the lock reason", async () => {
        const db = seeded();
        useDb(db);
        const reason = "This project is archived. Restore it before editing pre-contract information.";
        mocks.requireEditableAccessForVerifiedProject.mockRejectedValue(new Error(reason));

        expect(await deleteSimplePriceLineAction(NEW_ESTIMATE_ID, LINE_ID)).toEqual({ ok: false, error: reason });
        expect(await savePriceAdjustmentsAction(NEW_ESTIMATE_ID, {
            prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
        })).toEqual({ ok: false, error: reason });
        expect(db.tables.estimate_lines).toHaveLength(2);
    });
});
