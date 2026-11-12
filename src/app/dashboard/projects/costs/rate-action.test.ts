import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), editable: vi.fn(), recalc: vi.fn(), writeError: null as { message: string } | null, readError: null as { message: string } | null, quantity: 3 as number | null, returned: undefined as undefined | null | Record<string, unknown>, writes: [] as unknown[], filters: [] as unknown[][], from: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ getActiveOrganizationId: vi.fn(), requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableAccessForVerifiedProject: mocks.editable, requireEditableProjectAccess: vi.fn(), requireEstimateAccess: vi.fn(), requireEstimateComponentAccess: vi.fn(), requireEstimateLineAccess: mocks.access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./estimate-total", () => ({ recalcEstimateTotal: mocks.recalc }));
import { updateLineBuiltUpRateAction } from "./actions";

beforeEach(() => {
    mocks.writes = []; mocks.filters = []; mocks.writeError = null;
    mocks.readError = null; mocks.quantity = 3; mocks.returned = undefined;
    mocks.from.mockReset().mockImplementation((table: string) => {
        expect(table).toBe("estimate_lines");
        const read = { eq: () => read, single: async () => ({ data: mocks.quantity === null ? null : { quantity: mocks.quantity, estimate_id: "estimate" }, error: mocks.readError }) };
        return {
            select: () => read,
            update: (patch: unknown) => {
                mocks.writes.push(patch);
                const write = {
                    eq: (field: string, value: string) => { mocks.filters.push([field, value]); return write; },
                    select: () => write,
                    single: async () => ({ data: mocks.returned === undefined ? { id: "line", estimate_id: "estimate", quantity: mocks.quantity, ...(patch as object) } : mocks.returned, error: mocks.writeError }),
                    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: mocks.writeError }).then(resolve),
                };
                return write;
            },
        };
    });
    const access = { estimateId: "estimate", projectId: "project", lineId: "line", supabase: { from: mocks.from } };
    mocks.access.mockReset().mockResolvedValue(access);
    mocks.editable.mockReset().mockResolvedValue(access);
    mocks.recalc.mockReset().mockResolvedValue(undefined);
});

describe("existing built-up rate action acknowledgement", () => {
    it("resolves only after its current line update and aggregate recalculation", async () => {
        await expect(updateLineBuiltUpRateAction("line", 10, 3)).resolves.toEqual({ unitRate: 10, lineTotal: 30, quantity: 3 });
        expect(mocks.writes).toEqual([{ unit_rate: 10, line_total: 30 }]);
        expect(mocks.filters).toEqual([["id", "line"], ["estimate_id", "estimate"], ["quantity", 3]]);
        expect(mocks.recalc).toHaveBeenCalledExactlyOnceWith(expect.anything(), "estimate");
    });

    it("can reject after a successful line update, so a client must not claim definitely unsaved", async () => {
        mocks.recalc.mockRejectedValueOnce(new Error("Aggregate failed"));
        await expect(updateLineBuiltUpRateAction("line", 10, 3)).rejects.toThrow("Aggregate failed");
        expect(mocks.writes).toEqual([{ unit_rate: 10, line_total: 30 }]);
    });

    it("rejects line-update errors before aggregate recalculation", async () => {
        mocks.writeError = { message: "Write failed" };
        await expect(updateLineBuiltUpRateAction("line", 10, 3)).rejects.toThrow();
        expect(mocks.recalc).not.toHaveBeenCalled();
    });

    it("keeps the existing editability gate before any query or price write", async () => {
        mocks.editable.mockRejectedValueOnce(new Error("Estimate is locked"));
        await expect(updateLineBuiltUpRateAction("line", 10, 3)).rejects.toThrow("Estimate is locked");
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it("does not replace a legitimate zero quantity with one", async () => {
        mocks.quantity = 0;
        await expect(updateLineBuiltUpRateAction("line", 10, 0)).resolves.toEqual({ unitRate: 10, lineTotal: 0, quantity: 0 });
        expect(mocks.writes).toEqual([{ unit_rate: 10, line_total: 0 }]);
    });

    it("rejects a changed priced quantity before writing a stale resource rate", async () => {
        await expect(updateLineBuiltUpRateAction("line", 10, 2)).rejects.toThrow(/quantity.*changed/i);
        expect(mocks.writes).toEqual([]);
        expect(mocks.recalc).not.toHaveBeenCalled();
    });

    it.each(["read error", "missing line"])("does not write after %s", async reason => {
        if (reason === "read error") mocks.readError = { message: "Read failed" };
        else mocks.quantity = null;
        await expect(updateLineBuiltUpRateAction("line", 10, 3)).rejects.toThrow();
        expect(mocks.writes).toEqual([]);
        expect(mocks.recalc).not.toHaveBeenCalled();
    });

    it.each([null, {}, { id: "line", estimate_id: "estimate", quantity: 4, unit_rate: 10, line_total: 40 }, { id: "other", estimate_id: "estimate", quantity: 3, unit_rate: 10, line_total: 30 }, { id: "line", estimate_id: "estimate", quantity: 3, unit_rate: NaN, line_total: 30 }])("requires an affected row with confirmed price and quantity: %j", async returned => {
        mocks.returned = returned;
        await expect(updateLineBuiltUpRateAction("line", 10, 3)).rejects.toThrow(/not confirmed/i);
        expect(mocks.recalc).not.toHaveBeenCalled();
    });

    it("returns stored numeric amounts rather than claiming the unrounded preview was stored", async () => {
        mocks.returned = { id: "line", estimate_id: "estimate", quantity: 3, unit_rate: 10.12, line_total: 30.37 };
        await expect(updateLineBuiltUpRateAction("line", 10.123, 3)).resolves.toEqual({ unitRate: 10.12, lineTotal: 30.37, quantity: 3 });
        expect(mocks.writes).toEqual([{ unit_rate: 10.123, line_total: 3 * 10.123 }]);
    });

    it.each([NaN, Infinity, -1])("refuses invalid rate %s before any database call", async rate => {
        await expect(updateLineBuiltUpRateAction("line", rate, 3)).rejects.toThrow();
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it.each([NaN, Infinity, -1])("refuses invalid priced quantity %s", async quantity => {
        await expect(updateLineBuiltUpRateAction("line", 10, quantity)).rejects.toThrow();
        expect(mocks.from).not.toHaveBeenCalled();
    });
});
