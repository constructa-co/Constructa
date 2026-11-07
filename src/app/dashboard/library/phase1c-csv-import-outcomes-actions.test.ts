import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; rows: Array<Record<string, unknown>>; options: unknown; select?: string };

const db = vi.hoisted(() => ({
    calls: [] as Call[],
    // One queued result per upsert, in call order.
    results: [] as Array<{ data: unknown; error: null | { message: string } }>,
}));

/** Records each upsert(...).select(...) chain and resolves it with the next queued result. */
function fakeClient() {
    return {
        from(table: string) {
            const call: Call = { table, rows: [], options: undefined };
            const chain = {
                upsert: (rows: Array<Record<string, unknown>>, options: unknown) => {
                    call.rows = rows;
                    call.options = options;
                    db.calls.push(call);
                    return chain;
                },
                select: (columns: string) => { call.select = columns; return chain; },
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                    Promise.resolve(db.results.shift() ?? { data: [], error: null }).then(resolve, reject),
            };
            return chain;
        },
    };
}

vi.mock("@/lib/supabase/extended-module-auth-utils", () => ({
    requireAuth: vi.fn(async () => ({ supabase: fakeClient() })),
    getActiveOrganizationId: vi.fn(async () => "org-1"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { bulkAddMoMItemsAction } from "./actions";

const items = [
    { levels: ["Groundworks", "Excavation general"], code: "GW-01", description: "Excavate trench", unit: "m3", rate: 30 },
    { levels: ["Groundworks", "Excavation general"], code: "GW-02", description: "Cart away", unit: undefined, rate: 12.5 },
];
const level0 = { data: [{ id: "cat-g", code: "Groundworks" }], error: null };
const level1 = { data: [{ id: "cat-e", code: "Excavation" }], error: null };

beforeEach(() => {
    db.calls = [];
    db.results = [];
    vi.mocked(revalidatePath).mockClear();
});

describe("bulkAddMoMItemsAction outcomes", () => {
    it("a top-level category refusal stops before any later category or item write and reports it", async () => {
        db.results = [{ data: null, error: { message: "permission denied for table mom_categories" } }];
        const result = await bulkAddMoMItemsAction(items);
        expect(result).toMatchObject({ error: expect.stringContaining("permission denied for table mom_categories") });
        expect(db.calls.map(c => c.table)).toEqual(["mom_categories"]);
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("a later-level category refusal stops before items and does not claim nothing was saved", async () => {
        db.results = [level0, { data: null, error: { message: "row-level security" } }];
        const result = await bulkAddMoMItemsAction(items) as { error?: string };
        expect(result.error).toContain("row-level security");
        expect(result.error).toMatch(/may already have been saved/i);
        expect(db.calls.map(c => c.table)).toEqual(["mom_categories", "mom_categories"]);
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("an unconfirmed category id stops the import instead of writing uncategorised items", async () => {
        db.results = [level0, { data: [], error: null }];
        const result = await bulkAddMoMItemsAction(items) as { error?: string };
        expect(result.error).toMatch(/Excavation/);
        expect(db.calls.some(c => c.table === "mom_items")).toBe(false);
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("an item refusal is reported as an error, not a zero-count success", async () => {
        db.results = [level0, level1, { data: null, error: { message: "duplicate key violates constraint" } }];
        const result = await bulkAddMoMItemsAction(items) as { error?: string; count?: number };
        expect(result.count).toBeUndefined();
        expect(result.error).toContain("duplicate key violates constraint");
        expect(result.error).toMatch(/couldn.t confirm/i);
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("a lost item response returned as an error (postgrest-js status 0) does not claim nothing was imported", async () => {
        // postgrest-js returns fetch failures as { error, status: 0 } instead of throwing.
        db.results = [level0, level1, {
            data: null, status: 0, statusText: "", count: null,
            error: { message: "TypeError: fetch failed", details: "TypeError: fetch failed", hint: "", code: "" },
        } as never];
        const result = await bulkAddMoMItemsAction(items) as { error?: string; count?: number };
        expect(result.count).toBeUndefined();
        expect(result.error).toContain("TypeError: fetch failed");
        expect(result.error).not.toMatch(/no items were imported/i);
        expect(result.error).toMatch(/couldn.t confirm/i);
        expect(result.error).toMatch(/items may already have been saved/i);
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("a confirmed import keeps the exact category and item payloads, count and revalidation", async () => {
        db.results = [level0, level1, { data: [{ id: "i1" }, { id: "i2" }], error: null }];
        expect(await bulkAddMoMItemsAction(items)).toEqual({ count: 2 });
        expect(db.calls).toEqual([
            { table: "mom_categories", options: { onConflict: "organization_id, code" }, select: "id, code",
              rows: [{ organization_id: "org-1", parent_id: null, code: "Groundworks", name: "Groundworks" }] },
            { table: "mom_categories", options: { onConflict: "organization_id, code" }, select: "id, code",
              rows: [{ organization_id: "org-1", parent_id: "cat-g", code: "Excavation", name: "Excavation general" }] },
            { table: "mom_items", options: { onConflict: "organization_id, code" }, select: "id",
              rows: [
                  { organization_id: "org-1", category_id: "cat-e", code: "GW-01", description: "Excavate trench", unit: "m3", base_rate: 30 },
                  { organization_id: "org-1", category_id: "cat-e", code: "GW-02", description: "Cart away", unit: "Each", base_rate: 12.5 },
              ] },
        ]);
        expect(revalidatePath).toHaveBeenCalledTimes(1);
        expect(revalidatePath).toHaveBeenCalledWith("/dashboard/library");
    });
});
