import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), editable: vi.fn(), recalc: vi.fn(), from: vi.fn(), current: null as Record<string, unknown> | null, readError: null as { message: string } | null, writeError: null as { message: string } | null, returned: undefined as Record<string, unknown> | null | undefined, writes: [] as Record<string, unknown>[], filters: [] as unknown[][] }));
vi.mock("@/lib/supabase/auth-utils", () => ({ getActiveOrganizationId: vi.fn(), requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableAccessForVerifiedProject: mocks.editable, requireEditableProjectAccess: vi.fn(), requireEstimateAccess: vi.fn(), requireEstimateComponentAccess: vi.fn(), requireEstimateLineAccess: mocks.access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./estimate-total", () => ({ recalcEstimateTotal: mocks.recalc }));
import { updateLineItemAction } from "./actions";

beforeEach(() => {
    mocks.current = { id: "line", estimate_id: "estimate", quantity: 3, unit_rate: 10, line_total: 30, description: "Boards" };
    mocks.readError = null; mocks.writeError = null; mocks.returned = undefined; mocks.writes = []; mocks.filters = [];
    mocks.from.mockReset().mockImplementation((table: string) => {
        expect(table).toBe("estimate_lines");
        let patch: Record<string, unknown> | null = null;
        const query = {
            select: () => query,
            update: (input: Record<string, unknown>) => { patch = input; mocks.writes.push(input); return query; },
            eq: (field: string, value: unknown) => { if (patch) mocks.filters.push([field, value]); return query; },
            is: (field: string, value: unknown) => { if (patch) mocks.filters.push([field, value]); return query; },
            single: async () => patch
                ? { data: mocks.returned === undefined ? { ...mocks.current, ...patch } : mocks.returned, error: mocks.writeError }
                : { data: mocks.current, error: mocks.readError },
            then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: mocks.writeError }).then(resolve),
        };
        return query;
    });
    const access = { estimateId: "estimate", projectId: "project", lineId: "line", supabase: { from: mocks.from } };
    mocks.access.mockReset().mockResolvedValue(access); mocks.editable.mockReset().mockResolvedValue(access);
    mocks.recalc.mockReset().mockResolvedValue(undefined);
});

describe("partial priced-line confirmation", () => {
    it("recomputes a quantity-only edit using the stored rate without replacing it", async () => {
        const result = await updateLineItemAction("line", { quantity: 4 });
        expect(mocks.writes).toEqual([{ quantity: 4, line_total: 40 }]);
        expect(result).toMatchObject({ success: true, line: { id: "line", quantity: 4, unit_rate: 10, line_total: 40 } });
        expect(mocks.filters).toEqual([["id", "line"], ["estimate_id", "estimate"], ["quantity", 3], ["unit_rate", 10]]);
    });
    it("recomputes a rate-only edit using the stored quantity without replacing it", async () => {
        await expect(updateLineItemAction("line", { unit_rate: 12 })).resolves.toMatchObject({ success: true, line: { quantity: 3, unit_rate: 12, line_total: 36 } });
        expect(mocks.writes).toEqual([{ unit_rate: 12, line_total: 36 }]);
    });
    it("preserves a real zero quantity", async () => {
        mocks.current!.quantity = 0;
        await expect(updateLineItemAction("line", { unit_rate: 12 })).resolves.toMatchObject({ success: true, line: { quantity: 0, line_total: 0 } });
        expect(mocks.writes).toEqual([{ unit_rate: 12, line_total: 0 }]);
    });
    it("keeps description-only acknowledgements free of price fields", async () => {
        const result = await updateLineItemAction("line", { description: "New boards" });
        expect(mocks.writes).toEqual([{ description: "New boards" }]);
        expect(result).toMatchObject({ success: true, line: { id: "line", description: "New boards" } });
        expect(result.line).not.toHaveProperty("unit_rate");
    });
    it("uses authoritative stored amounts without introducing application rounding", async () => {
        mocks.returned = { ...mocks.current, quantity: 4.123, unit_rate: 10, line_total: 41.23 };
        const result = await updateLineItemAction("line", { quantity: 4.123456 });
        expect(mocks.writes).toEqual([{ quantity: 4.123456, line_total: 4.123456 * 10 }]);
        expect(result).toMatchObject({ success: true, line: { quantity: 4.123, line_total: 41.23 } });
    });
    it.each(["missing", "read failure"])("does not invent a counterpart after %s", async reason => {
        if (reason === "missing") mocks.current = null; else mocks.readError = { message: "Read failed" };
        await expect(updateLineItemAction("line", { quantity: 4 })).resolves.toMatchObject({ success: false });
        expect(mocks.writes).toEqual([]); expect(mocks.recalc).not.toHaveBeenCalled();
    });
    it.each([null, {}, { id: "other", estimate_id: "estimate" }, { id: "line", estimate_id: "other" }, { id: "line", estimate_id: "estimate", quantity: 4, unit_rate: 10, line_total: NaN }])("does not claim an unconfirmed write: %j", async returned => {
        mocks.returned = returned;
        const result = await updateLineItemAction("line", { quantity: 4 });
        expect(result.success).toBe(false); expect(result.error).toMatch(/not confirmed.*may already/i);
        expect(mocks.recalc).not.toHaveBeenCalled();
    });
    it("retains confirmed line values when aggregate refresh fails", async () => {
        mocks.recalc.mockRejectedValueOnce(new Error("Aggregate failed"));
        await expect(updateLineItemAction("line", { quantity: 4 })).resolves.toMatchObject({ success: true, warning: expect.any(String), line: { quantity: 4, line_total: 40 } });
    });
    it.each([NaN, Infinity])("refuses non-finite quantities %s", async quantity => {
        await expect(updateLineItemAction("line", { quantity })).resolves.toMatchObject({ success: false });
        expect(mocks.writes).toEqual([]);
    });
    it("retains the existing owner and edit lock boundary", async () => {
        mocks.editable.mockRejectedValueOnce(new Error("Estimate is locked"));
        await expect(updateLineItemAction("line", { quantity: 4 })).resolves.toMatchObject({ success: false, error: "Estimate is locked" });
        expect(mocks.from).not.toHaveBeenCalled();
    });
});

describe("existing unit-only acknowledgement contract", () => {
    it("sends only the exact unit under existing owner/estimate filters with no numeric conversion or acknowledgement", async () => {
        const result = await updateLineItemAction("line", { unit: "m2" });
        expect(mocks.writes).toEqual([{ unit: "m2" }]);
        expect(mocks.filters).toEqual([["id", "line"], ["estimate_id", "estimate"]]);
        expect(result.line).toEqual({ id: "line", unit: "m2" });
        expect(mocks.access).toHaveBeenCalledWith("line"); expect(mocks.editable).toHaveBeenCalledTimes(1);
        expect(mocks.recalc).toHaveBeenCalledTimes(1);
    });
    it("reports the existing aggregate warning rather than inventing new totals", async () => {
        mocks.recalc.mockRejectedValueOnce(new Error("Aggregate unavailable"));
        const result = await updateLineItemAction("line", { unit: "kg" });
        expect(result).toMatchObject({ success: true, line: { id: "line", unit: "kg" }, warning: expect.any(String) });
        expect(result.line).not.toHaveProperty("line_total"); expect(mocks.writes).toEqual([{ unit: "kg" }]);
    });
    it("retains unit-only operational lock refusal with no write", async () => {
        mocks.editable.mockRejectedValueOnce(new Error("Estimate is locked"));
        await expect(updateLineItemAction("line", { unit: "m2" })).resolves.toMatchObject({ success: false, error: "Estimate is locked" });
        expect(mocks.writes).toEqual([]); expect(mocks.recalc).not.toHaveBeenCalled();
    });
});

describe("existing line-type-only acknowledgement contract", () => {
    it("sends only the chosen type through existing owner/estimate filters without numeric conversion", async () => {
        const result = await updateLineItemAction("line", { line_type: "labour" });
        expect(mocks.writes).toEqual([{ line_type: "labour" }]);
        expect(mocks.filters).toEqual([["id", "line"], ["estimate_id", "estimate"]]);
        expect(result.line).toEqual({ id: "line", line_type: "labour" });
        expect(mocks.access).toHaveBeenCalledWith("line"); expect(mocks.editable).toHaveBeenCalledTimes(1);
        expect(mocks.recalc).toHaveBeenCalledTimes(1);
    });
    it("keeps the aggregate warning and exact type acknowledgement without inventing price fields", async () => {
        mocks.recalc.mockRejectedValueOnce(new Error("Aggregate unavailable"));
        const result = await updateLineItemAction("line", { line_type: "plant" });
        expect(result).toMatchObject({ success: true, line: { id: "line", line_type: "plant" }, warning: expect.any(String) });
        expect(result.line).not.toHaveProperty("line_total"); expect(mocks.writes).toEqual([{ line_type: "plant" }]);
    });
    it("retains type-only operational lock refusal with no write", async () => {
        mocks.editable.mockRejectedValueOnce(new Error("Estimate is locked"));
        await expect(updateLineItemAction("line", { line_type: "labour" })).resolves.toMatchObject({ success: false, error: "Estimate is locked" });
        expect(mocks.writes).toEqual([]); expect(mocks.recalc).not.toHaveBeenCalled();
    });
});
