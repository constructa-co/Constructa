import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), editable: vi.fn(), recalc: vi.fn(), writeError: null as { message: string } | null, writes: [] as unknown[], filters: [] as unknown[][], from: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ getActiveOrganizationId: vi.fn(), requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableAccessForVerifiedProject: mocks.editable, requireEditableProjectAccess: vi.fn(), requireEstimateAccess: vi.fn(), requireEstimateComponentAccess: vi.fn(), requireEstimateLineAccess: mocks.access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./estimate-total", () => ({ recalcEstimateTotal: mocks.recalc }));
import { updateLineBuiltUpRateAction } from "./actions";

beforeEach(() => {
    mocks.writes = []; mocks.filters = []; mocks.writeError = null;
    mocks.from.mockReset().mockImplementation((table: string) => {
        expect(table).toBe("estimate_lines");
        const read = { eq: () => read, single: async () => ({ data: { quantity: 3, estimate_id: "estimate" }, error: null }) };
        return {
            select: () => read,
            update: (patch: unknown) => {
                mocks.writes.push(patch);
                const write = {
                    eq: (field: string, value: string) => { mocks.filters.push([field, value]); return write; },
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
        await expect(updateLineBuiltUpRateAction("line", 10)).resolves.toBeUndefined();
        expect(mocks.writes).toEqual([{ unit_rate: 10, line_total: 30 }]);
        expect(mocks.filters).toEqual([["id", "line"], ["estimate_id", "estimate"]]);
        expect(mocks.recalc).toHaveBeenCalledExactlyOnceWith(expect.anything(), "estimate");
    });

    it("can reject after a successful line update, so a client must not claim definitely unsaved", async () => {
        mocks.recalc.mockRejectedValueOnce(new Error("Aggregate failed"));
        await expect(updateLineBuiltUpRateAction("line", 10)).rejects.toThrow("Aggregate failed");
        expect(mocks.writes).toEqual([{ unit_rate: 10, line_total: 30 }]);
    });

    it("rejects line-update errors before aggregate recalculation", async () => {
        mocks.writeError = { message: "Write failed" };
        await expect(updateLineBuiltUpRateAction("line", 10)).rejects.toThrow("Write failed");
        expect(mocks.recalc).not.toHaveBeenCalled();
    });

    it("keeps the existing editability gate before any query or price write", async () => {
        mocks.editable.mockRejectedValueOnce(new Error("Estimate is locked"));
        await expect(updateLineBuiltUpRateAction("line", 10)).rejects.toThrow("Estimate is locked");
        expect(mocks.from).not.toHaveBeenCalled();
    });
});
