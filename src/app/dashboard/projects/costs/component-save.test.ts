import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstimateLineComponent } from "./types";

const mocks = vi.hoisted(() => ({ access: vi.fn(), editable: vi.fn(), from: vi.fn(), result: null as unknown, error: null as { message: string } | null, calls: [] as unknown[][] }));
vi.mock("@/lib/supabase/auth-utils", () => ({ getActiveOrganizationId: vi.fn(), requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableAccessForVerifiedProject: mocks.editable, requireEditableProjectAccess: vi.fn(), requireEstimateAccess: vi.fn(), requireEstimateComponentAccess: mocks.access, requireEstimateLineAccess: mocks.access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./estimate-total", () => ({ recalcEstimateTotal: vi.fn() }));
import { addComponentAction, deleteComponentAction, updateComponentAction } from "./actions";

const row: EstimateLineComponent = { id: "resource", estimate_line_id: "line", component_type: "material", description: "Boards", quantity: 3.1234, unit: "nr", unit_rate: 10.12, line_total: 31.61, manhours_per_unit: 0, total_manhours: 0, sort_order: 0 };
beforeEach(() => {
    mocks.calls = []; mocks.result = row; mocks.error = null;
    mocks.from.mockReset().mockImplementation((table: string) => {
        expect(table).toBe("estimate_line_components");
        const query = {
            insert: (data: unknown) => { mocks.calls.push(["insert", data]); return query; },
            update: (data: unknown) => { mocks.calls.push(["update", data]); return query; },
            delete: () => { mocks.calls.push(["delete"]); return query; },
            eq: (field: string, value: unknown) => { mocks.calls.push(["eq", field, value]); return query; },
            select: (fields: string) => { mocks.calls.push(["select", fields]); return query; },
            single: async () => ({ data: mocks.result, error: mocks.error }),
        };
        return query;
    });
    const access = { estimateId: "estimate", projectId: "project", lineId: "line", supabase: { from: mocks.from } };
    mocks.access.mockReset().mockResolvedValue(access);
    mocks.editable.mockReset().mockResolvedValue(access);
});

describe("resource write acknowledgement", () => {
    it("passes consultancy through existing owner/edit-lock insert and stored acknowledgement unchanged", async () => {
        const consultancy: EstimateLineComponent = { ...row, component_type: "consultancy", description: "Engineer review" };
        mocks.result = consultancy;
        const input = { component_type: consultancy.component_type, description: consultancy.description, quantity: consultancy.quantity, unit: consultancy.unit, unit_rate: consultancy.unit_rate, manhours_per_unit: consultancy.manhours_per_unit, sort_order: consultancy.sort_order };
        await expect(addComponentAction("line", input)).resolves.toEqual(consultancy);
        expect(mocks.access).toHaveBeenCalledWith("line"); expect(mocks.editable).toHaveBeenCalled();
        expect(mocks.calls[0]).toEqual(["insert", { estimate_line_id: "line", ...input }]);
    });
    it("returns the stored row and retains both resource/line filters", async () => {
        await expect(updateComponentAction("resource", { quantity: 3.123456 })).resolves.toEqual(row);
        expect(mocks.calls).toEqual([["update", { quantity: 3.123456 }], ["eq", "id", "resource"], ["eq", "estimate_line_id", "line"], ["select", "*"]]);
    });
    it("returns stored generated totals on addition, not locally reconstructed values", async () => {
        const input = { component_type: row.component_type, description: row.description, quantity: row.quantity, unit: row.unit, unit_rate: row.unit_rate, manhours_per_unit: row.manhours_per_unit, sort_order: row.sort_order };
        await expect(addComponentAction("line", input)).resolves.toEqual(row);
        expect(mocks.calls[0]).toEqual(["insert", { estimate_line_id: "line", ...input }]);
    });
    it("confirms exactly the removed row under its line membership", async () => {
        await expect(deleteComponentAction("resource")).resolves.toBeUndefined();
        expect(mocks.calls).toEqual([["delete"], ["eq", "id", "resource"], ["eq", "estimate_line_id", "line"], ["select", "id, estimate_line_id"]]);
    });
    it.each([null, {}, { ...row, id: "other" }, { ...row, estimate_line_id: "other" }, { ...row, quantity: NaN }, { ...row, line_total: null }])("rejects an unconfirmed update: %j", async result => {
        mocks.result = result;
        await expect(updateComponentAction("resource", { quantity: 3 })).rejects.toThrow(/not confirmed.*may already/i);
    });
    it.each([null, {}, { ...row, id: "other" }, { ...row, estimate_line_id: "other" }])("rejects an unconfirmed removal: %j", async result => {
        mocks.result = result;
        await expect(deleteComponentAction("resource")).rejects.toThrow(/not confirmed.*may already/i);
    });
    it.each([null, {}, { ...row, estimate_line_id: "other" }, { ...row, unit_rate: null }])("does not acknowledge an unconfirmed addition: %j", async result => {
        mocks.result = result;
        await expect(addComponentAction("line", { component_type: "material", description: "Boards", quantity: 3, unit: "nr", unit_rate: 10, manhours_per_unit: 0, sort_order: 0 })).resolves.toBeNull();
    });
    it.each(["update", "delete"])("reports %s write errors as uncertain", async operation => {
        mocks.error = { message: "Response unavailable" };
        const request = operation === "update" ? updateComponentAction("resource", { quantity: 4 }) : deleteComponentAction("resource");
        await expect(request).rejects.toThrow(/not confirmed/i);
    });
    it.each(["update", "delete"])("retains the existing edit lock for %s", async operation => {
        mocks.editable.mockRejectedValueOnce(new Error("Estimate is locked"));
        const request = operation === "update" ? updateComponentAction("resource", { quantity: 4 }) : deleteComponentAction("resource");
        await expect(request).rejects.toThrow("Estimate is locked");
        expect(mocks.from).not.toHaveBeenCalled();
    });
});
