import { describe, expect, it, vi } from "vitest";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import {
    EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, currentSummary, estimatingReducer, initialEstimatingState,
    submitPriceLine, type EstimatingServer, type EstimatingStore, type PriceLineDraft,
} from "./simple-estimate";

const estimate = (id = "estimate"): Estimate => ({
    id, project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0,
    risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 0, estimate_lines: [],
});
function setup(draft: Partial<PriceLineDraft> = {}, estimates = [estimate()]) {
    let state = initialEstimatingState(estimates, { pendingEstimateId: "pending" });
    const store: EstimatingStore = { getState: () => state, dispatch: action => { state = estimatingReducer(state, action); } };
    store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "first", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Prepare walls", amount: "100", ...draft } });
    const server: Pick<EstimatingServer, "saveLine" | "updateLine"> = {
        saveLine: vi.fn<EstimatingServer["saveLine"]>(async request => {
            const estimateId = request.estimateId ?? request.newEstimateId;
            const line: EstimateLine = { id: request.lineId, estimate_id: estimateId, ...request.line,
                line_total: request.line.quantity * request.line.unit_rate, trade_section: "General",
                line_type: "general", pricing_mode: "simple", estimate_line_components: [] };
            return { ok: true, estimateId, createdEstimate: request.estimateId ? null : estimate(estimateId), line };
        }),
        updateLine: vi.fn(),
    };
    const submit = () => submitPriceLine(store, server, "job", NEW_LINE_KEY, { nextLineId: "second" });
    return { store, server, submit };
}

describe("confirmed one-line save and next draft", () => {
    it.each(["amount", "rate"] as const)("saves exactly one %s line, then opens an unpriced fresh draft retaining only mode/unit", async mode => {
        const { store, server, submit } = setup({ mode, quantity: "2.5", unit: "crate", rate: "40" });
        expect(await submit()).toBe(true);
        expect(server.saveLine).toHaveBeenCalledTimes(1);
        expect(store.getState().estimates[0].estimate_lines).toHaveLength(1);
        expect(currentSummary(store.getState()).contractSum).toBe(100);
        expect(store.getState().ops.new).toMatchObject({ kind: "add", lineId: "second", status: "editing",
            draft: { ...EMPTY_PRICE_LINE_DRAFT, mode, unit: "crate" }, error: null, fieldErrors: {} });
        expect(server.updateLine).not.toHaveBeenCalled();
    });

    it("leaves ordinary Save line behavior unchanged", async () => {
        const { store, server } = setup();
        expect(await submitPriceLine(store, server, "job", NEW_LINE_KEY)).toBe(true);
        expect(store.getState().ops).toEqual({});
        expect(store.getState().estimates[0].estimate_lines).toHaveLength(1);
    });

    it("creates the first estimate only after confirmation and continues in it", async () => {
        const { store, submit } = setup({}, []);
        expect(await submit()).toBe(true);
        expect(store.getState().activeEstimateId).toBe("pending");
        expect(store.getState().estimates).toHaveLength(1);
        expect(store.getState().ops.new.lineId).toBe("second");
    });

    it("never saves the blank next draft automatically", async () => {
        const { store, server, submit } = setup();
        await submit();
        expect(await submit()).toBe(false);
        expect(server.saveLine).toHaveBeenCalledTimes(1);
        expect(store.getState().ops.new.fieldErrors).toHaveProperty("description");
        expect(store.getState().ops.new.lineId).toBe("second");
    });

    it("keeps the original draft/id and total on returned failure, then retries the same id", async () => {
        const { store, server, submit } = setup();
        const before = store.getState().ops.new.draft;
        vi.mocked(server.saveLine).mockResolvedValueOnce({ ok: false, error: "Could not confirm save" });
        expect(await submit()).toBe(false);
        expect(store.getState().ops.new).toMatchObject({ draft: before, lineId: "first", status: "failed" });
        expect(currentSummary(store.getState()).contractSum).toBe(0);
        expect(await submit()).toBe(true);
        expect(vi.mocked(server.saveLine).mock.calls.map(call => call[0].lineId)).toEqual(["first", "first"]);
        expect(store.getState().ops.new.lineId).toBe("second");
    });

    it("keeps the draft and does not continue on thrown failure", async () => {
        const { store, server, submit } = setup();
        vi.mocked(server.saveLine).mockRejectedValueOnce(new Error("disconnected"));
        expect(await submit()).toBe(false);
        expect(store.getState().ops.new).toMatchObject({ lineId: "first", status: "failed", draft: { description: "Prepare walls", amount: "100" } });
        expect(currentSummary(store.getState()).contractSum).toBe(0);
    });

    it("does not call the action or continue on invalid input", async () => {
        const { store, server, submit } = setup({ amount: "" });
        expect(await submit()).toBe(false);
        expect(server.saveLine).not.toHaveBeenCalled();
        expect(store.getState().ops.new.lineId).toBe("first");
        expect(store.getState().ops.new.fieldErrors).toHaveProperty("amount");
    });

    it("fences immediate duplicate requests and ignores edits/cancel while saving", async () => {
        const { store, server, submit } = setup();
        const original = server.saveLine;
        let release!: () => void;
        const ready = new Promise<void>(resolve => { release = resolve; });
        server.saveLine = vi.fn(async request => { await ready; return original(request); });
        const pending = submit();
        expect(store.getState().ops.new.status).toBe("saving");
        expect(currentSummary(store.getState()).contractSum).toBe(0);
        expect(await submit()).toBe(false);
        store.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch: { amount: "999" } });
        store.dispatch({ type: "op/cancel", key: NEW_LINE_KEY });
        expect(store.getState().ops.new.draft.amount).toBe("100");
        release(); await pending;
        expect(server.saveLine).toHaveBeenCalledTimes(1);
        expect(store.getState().ops.new.lineId).toBe("second");
    });

    it("preserves a confirmed-save warning while opening the next draft", async () => {
        const { store, server, submit } = setup();
        const original = server.saveLine;
        server.saveLine = async request => ({ ...await original(request), warning: "Stored total refresh needs checking" });
        await submit();
        expect(store.getState().notice).toBe("Stored total refresh needs checking");
        expect(store.getState().ops.new.lineId).toBe("second");
    });

    it("prices consecutive different lines in the same estimate with canonical totals and no copied prices", async () => {
        const { store, server, submit } = setup();
        await submit();
        store.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch: { description: "Fit skirting", mode: "rate", quantity: "12.5", unit: "m", rate: "8" } });
        expect(currentSummary(store.getState()).contractSum).toBe(100);
        expect(await submitPriceLine(store, server, "job", NEW_LINE_KEY, { nextLineId: "third" })).toBe(true);
        expect(store.getState().estimates[0].estimate_lines.map(line => line.description)).toEqual(["Prepare walls", "Fit skirting"]);
        expect(currentSummary(store.getState())).toMatchObject({ contractSum: 200, vat: 40, totalIncVat: 240 });
        expect(store.getState().ops.new).toMatchObject({ lineId: "third", draft: { description: "", mode: "rate", quantity: "", unit: "m", rate: "", amount: "" } });
        expect(server.saveLine).toHaveBeenCalledTimes(2);
        store.dispatch({ type: "op/cancel", key: NEW_LINE_KEY });
        expect(store.getState().ops).toEqual({});
        expect(currentSummary(store.getState()).contractSum).toBe(200);
    });

    it("refuses to reuse the just-saved id for a next draft", async () => {
        const { store, server } = setup();
        await submitPriceLine(store, server, "job", NEW_LINE_KEY, { nextLineId: "first" });
        expect(store.getState().ops).toEqual({});
        expect(store.getState().estimates[0].estimate_lines).toHaveLength(1);
    });

    it("does not open a next draft in a different estimate selected during the request", async () => {
        const { store, server, submit } = setup({}, [estimate(), estimate("other")]);
        const original = server.saveLine;
        server.saveLine = async request => {
            store.dispatch({ type: "estimate/select", estimateId: "other" });
            return original(request);
        };
        await submit();
        expect(store.getState().activeEstimateId).toBe("other");
        expect(store.getState().ops).toEqual({});
        expect(store.getState().estimates[0].estimate_lines).toHaveLength(1);
    });
});
