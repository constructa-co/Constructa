import { describe, expect, it, vi } from "vitest";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, currentSummary, estimatingReducer, initialEstimatingState, submitPriceLine, type EstimatingServer, type EstimatingStore } from "./simple-estimate";

function setup(activity = "Kitchen") {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 10, profit_pct: 5,
        risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 0, estimate_lines: [] };
    let state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    const store: EstimatingStore = { getState: () => state, dispatch: action => { state = estimatingReducer(state, action); } };
    store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "line", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Fit cupboards", amount: "100", activity } });
    const server: Pick<EstimatingServer, "saveLine" | "updateLine"> = { saveLine: vi.fn<EstimatingServer["saveLine"]>(async request => {
        const line: EstimateLine = { id: request.lineId, estimate_id: "estimate", ...request.line, trade_section: request.activity ?? "General", line_total: request.line.quantity * request.line.unit_rate,
            line_type: "general", pricing_mode: "simple", estimate_line_components: [] };
        return { ok: true, estimateId: "estimate", createdEstimate: null, line };
    }), updateLine: vi.fn() };
    const save = () => submitPriceLine(store, server, "job", NEW_LINE_KEY, { nextLineId: "next" });
    return { store, server, estimate, save };
}
describe("new line activity draft and confirmed-save contract", () => {
    it("sends one selected activity outside financial input, uses the returned section and clears it for add-next", async () => {
        const { store, server, save } = setup(" Kitchen ");
        expect(await save()).toBe(true);
        expect(server.saveLine).toHaveBeenCalledExactlyOnceWith({ projectId: "job", estimateId: "estimate", newEstimateId: "pending", lineId: "line", activity: "Kitchen",
            line: { description: "Fit cupboards", quantity: 1, unit: "item", unit_rate: 100 } });
        expect(store.getState().estimates[0].estimate_lines[0].trade_section).toBe("Kitchen");
        expect(store.getState().ops.new.draft).toEqual(EMPTY_PRICE_LINE_DRAFT); expect(server.updateLine).not.toHaveBeenCalled();
        expect(currentSummary(store.getState())).toMatchObject({ linesTotal: 100 });
    });
    it.each(["", "   "])("omits the activity field for blank input %j, keeping the General default", async activity => {
        const { store, server, save } = setup(activity); expect(await save()).toBe(true);
        expect(vi.mocked(server.saveLine).mock.calls[0][0]).not.toHaveProperty("activity");
        expect(store.getState().estimates[0].estimate_lines[0].trade_section).toBe("General");
    });
    it.each(["Preliminaries", "x".repeat(101)])("retains invalid activity %j without writing", async activity => {
        const { store, server, save } = setup(activity); expect(await save()).toBe(false);
        expect(store.getState().ops.new.draft.activity).toBe(activity); expect(store.getState().ops.new.fieldErrors.activity).toBeTruthy();
        expect(server.saveLine).not.toHaveBeenCalled();
    });
    it("refuses activity assignment for client BoQ without altering its existing structure", async () => {
        const { store, server, save } = setup(); store.getState().estimates[0].is_client_boq = true;
        expect(await save()).toBe(false); expect(server.saveLine).not.toHaveBeenCalled(); expect(store.getState().ops.new.draft.activity).toBe("Kitchen");
    });
    it("retains the exact activity/id on failed save and retry, with no continuation before confirmation", async () => {
        const { store, server, save } = setup(); vi.mocked(server.saveLine).mockResolvedValueOnce({ ok: false, error: "No confirmed save" });
        expect(await save()).toBe(false); expect(store.getState().ops.new).toMatchObject({ lineId: "line", status: "failed", draft: { activity: "Kitchen" } });
        expect(await save()).toBe(true); expect(vi.mocked(server.saveLine).mock.calls.map(call => [call[0].lineId, call[0].activity])).toEqual([["line", "Kitchen"], ["line", "Kitchen"]]);
        expect(store.getState().ops.new.lineId).toBe("next");
    });
    it("does not claim confirmation or discard the draft when the returned section differs", async () => {
        const { store, server, save } = setup(); const original = server.saveLine;
        server.saveLine = async request => { const result = await original(request); return result.ok ? { ...result, line: { ...result.line, trade_section: "Other" } } : result; };
        expect(await save()).toBe(false); expect(store.getState().ops.new).toMatchObject({ lineId: "line", status: "failed", draft: { activity: "Kitchen" } });
        expect(store.getState().estimates[0].estimate_lines).toEqual([]);
    });
    it("fences duplicate saves and edits to activity during the request", async () => {
        const { store, server, save } = setup(); const original = server.saveLine;
        let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
        server.saveLine = vi.fn(async request => { await pending; return original(request); });
        const first = save(); expect(await save()).toBe(false);
        store.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch: { activity: "Do not accept" } });
        expect(store.getState().ops.new.draft.activity).toBe("Kitchen"); release(); expect(await first).toBe(true); expect(server.saveLine).toHaveBeenCalledOnce();
    });
});
