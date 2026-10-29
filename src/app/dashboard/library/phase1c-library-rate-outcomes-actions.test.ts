import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
    calls: [] as Array<{ table: string; op: string; values?: unknown; options?: unknown; filters: Array<[string, unknown]> }>,
    result: { error: null as null | { message: string } },
}));

/** Records each query chain and resolves it with the configured `{ error }`. */
function fakeClient() {
    return {
        from(table: string) {
            const call = { table, op: "select", filters: [] as Array<[string, unknown]> } as (typeof db.calls)[number];
            db.calls.push(call);
            const chain = {
                delete: () => { call.op = "delete"; return chain; },
                upsert: (values: unknown, options: unknown) => { call.op = "upsert"; call.values = values; call.options = options; return chain; },
                eq: (column: string, value: unknown) => { call.filters.push([column, value]); return chain; },
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                    Promise.resolve({ data: null, error: db.result.error }).then(resolve, reject),
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
import { deleteRateOverrideAction, upsertRateOverrideAction } from "./actions";

function form(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) fd.append(key, value);
    return fd;
}

beforeEach(() => {
    db.calls = [];
    db.result = { error: null };
    vi.mocked(revalidatePath).mockClear();
});

describe("deleteRateOverrideAction", () => {
    it("returns the database refusal and does not revalidate or report success", async () => {
        db.result = { error: { message: "permission denied for table mom_item_overrides" } };
        const result = await deleteRateOverrideAction(form({ mom_item_id: "item-7" }));
        expect(result).toEqual({ error: "permission denied for table mom_item_overrides" });
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("a confirmed delete (including an already-absent override) stays success with the same org and item scope", async () => {
        const result = await deleteRateOverrideAction(form({ mom_item_id: "item-7" }));
        expect(result).toEqual({ success: true });
        expect(db.calls).toEqual([{
            table: "mom_item_overrides", op: "delete",
            filters: [["organization_id", "org-1"], ["mom_item_id", "item-7"]],
        }]);
        expect(revalidatePath).toHaveBeenCalledTimes(1);
        expect(revalidatePath).toHaveBeenCalledWith("/dashboard/library");
    });
});

describe("upsertRateOverrideAction (unchanged baseline)", () => {
    it("still returns its explicit database error without revalidating", async () => {
        db.result = { error: { message: "rls refused" } };
        expect(await upsertRateOverrideAction(form({ mom_item_id: "item-7", custom_rate: "42.5" }))).toEqual({ error: "rls refused" });
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("still writes the same scoped row and confirms success", async () => {
        expect(await upsertRateOverrideAction(form({ mom_item_id: "item-7", custom_rate: "42.5" }))).toEqual({ success: true });
        expect(db.calls[0]).toMatchObject({
            table: "mom_item_overrides", op: "upsert",
            values: { organization_id: "org-1", mom_item_id: "item-7", custom_rate: 42.5, notes: null },
            options: { onConflict: "organization_id,mom_item_id" },
        });
        expect(revalidatePath).toHaveBeenCalledWith("/dashboard/library");
    });
});
