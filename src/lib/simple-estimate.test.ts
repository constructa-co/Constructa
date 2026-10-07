import { describe, expect, it, vi } from "vitest";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import { computeContractSum } from "./financial";
import {
    ADJUSTMENTS_SAVE_ERROR,
    EMPTY_PRICE_LINE_DRAFT,
    LINE_DELETE_ERROR,
    LINE_SAVE_ERROR,
    NEW_LINE_KEY,
    advancedCapabilities,
    buildAdjustments,
    buildPriceLine,
    currentEstimate,
    currentSummary,
    draftFromLine,
    draftLineTotal,
    estimatingReducer,
    initialEstimatingState,
    isSimpleEditable,
    pickInitialEstimateId,
    removePriceLine,
    submitAdjustments,
    submitPriceLine,
    summarisePrice,
    unitOptions,
    type EstimatingAction,
    type EstimatingServer,
    type EstimatingState,
    type EstimatingStore,
    type PriceLineDraft,
    type SavePriceLineRequest,
} from "./simple-estimate";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ESTIMATE_ID = "22222222-2222-4222-8222-222222222222";

function line(overrides: Partial<EstimateLine> = {}): EstimateLine {
    return {
        id: "line-1",
        estimate_id: "est-1",
        description: "Bathroom refit",
        quantity: 1,
        unit: "item",
        unit_rate: 2500,
        line_total: 2500,
        trade_section: "General",
        line_type: "general",
        pricing_mode: "simple",
        estimate_line_components: [],
        ...overrides,
    };
}

function estimate(overrides: Partial<Estimate> = {}): Estimate {
    return {
        id: "est-1",
        project_id: PROJECT_ID,
        version_name: "Estimate v1",
        overhead_pct: 0,
        profit_pct: 0,
        risk_pct: 0,
        prelims_pct: 0,
        discount_pct: 0,
        discount_reason: "",
        total_cost: 0,
        is_active: true,
        estimate_lines: [],
        ...overrides,
    };
}

function makeStore(estimates: Estimate[] = []): EstimatingStore {
    let state: EstimatingState = initialEstimatingState(estimates, { pendingEstimateId: PENDING_ESTIMATE_ID });
    return {
        getState: () => state,
        dispatch: (action: EstimatingAction) => { state = estimatingReducer(state, action); },
    };
}

function openAdd(store: EstimatingStore, draft: Partial<PriceLineDraft>, lineId = "new-line-id") {
    store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: { ...EMPTY_PRICE_LINE_DRAFT, ...draft }, lineId });
}

/** Stands in for the server: creates the estimate with the first line. */
function fakeServer(): EstimatingServer & { saveLine: ReturnType<typeof vi.fn<EstimatingServer["saveLine"]>> } {
    return {
        saveLine: vi.fn(async (request: SavePriceLineRequest) => {
            const estimateId = request.estimateId ?? request.newEstimateId;
            const saved = line({
                id: request.lineId,
                estimate_id: estimateId,
                ...request.line,
                line_total: request.line.quantity * request.line.unit_rate,
            });
            return {
                ok: true as const,
                estimateId,
                createdEstimate: request.estimateId ? null : estimate({ id: estimateId, estimate_lines: [saved] }),
                line: saved,
            };
        }),
        updateLine: vi.fn(async (_estimateId, lineId, input) => ({
            ok: true as const,
            line: { id: lineId, ...input, line_total: input.quantity * input.unit_rate },
        })),
        deleteLine: vi.fn(async () => ({ ok: true as const })),
        saveAdjustments: vi.fn(async () => ({ ok: true as const })),
    };
}

describe("line calculations", () => {
    it("prices a line from one amount", () => {
        const built = buildPriceLine({ ...EMPTY_PRICE_LINE_DRAFT, description: " Bathroom refit ", mode: "amount", amount: "£2,500" });
        expect(built).toEqual({ ok: true, line: { description: "Bathroom refit", quantity: 1, unit: "item", unit_rate: 2500 } });
        expect(draftLineTotal({ ...EMPTY_PRICE_LINE_DRAFT, mode: "amount", amount: "2500" })).toBe(2500);
    });

    it("prices a line from quantity, unit and rate", () => {
        const draft: PriceLineDraft = { description: "Wall tiling", mode: "rate", amount: "", quantity: "12.5", unit: "m2", rate: "45.50" };
        expect(buildPriceLine(draft)).toEqual({ ok: true, line: { description: "Wall tiling", quantity: 12.5, unit: "m2", unit_rate: 45.5 } });
        expect(draftLineTotal(draft)).toBe(568.75);
    });

    it("rounds a line total to pence", () => {
        expect(draftLineTotal({ ...EMPTY_PRICE_LINE_DRAFT, mode: "rate", quantity: "3.333", unit: "m", rate: "9.99" })).toBe(33.3);
    });

    it("explains what is missing instead of saving a half-filled line", () => {
        const amount = buildPriceLine({ ...EMPTY_PRICE_LINE_DRAFT, mode: "amount" });
        expect(amount).toEqual({ ok: false, fieldErrors: { description: "Say what this price is for.", amount: "Enter the price as a number, for example 2500." } });

        const rate = buildPriceLine({ ...EMPTY_PRICE_LINE_DRAFT, description: "Tiling", mode: "rate", quantity: "0", rate: "x" });
        expect(rate).toEqual({ ok: false, fieldErrors: { quantity: "Enter a quantity above 0.", rate: "Enter the rate as a number." } });
        expect(draftLineTotal({ ...EMPTY_PRICE_LINE_DRAFT, mode: "amount", amount: "" })).toBeNull();
    });

    it("keeps a unit that is not on the standard list instead of changing it", () => {
        const imported = line({ description: "Labour", quantity: 16, unit: "hr", unit_rate: 35 });
        const draft = draftFromLine(imported);
        expect(draft).toMatchObject({ mode: "rate", unit: "hr" });
        expect(unitOptions("hr")).toContain("hr");
        expect(unitOptions("m2")).not.toContain("hr");
        expect(buildPriceLine(draft)).toEqual({ ok: true, line: { description: "Labour", quantity: 16, unit: "hr", unit_rate: 35 } });
    });

    it("rejects zero, negative, exponent and hex prices", () => {
        for (const amount of ["0", "-50", "1e5", "0x10", "12.345"]) {
            expect(buildPriceLine({ ...EMPTY_PRICE_LINE_DRAFT, description: "x", mode: "amount", amount }).ok, amount).toBe(false);
        }
    });

    it("reopens a saved line in the form it was entered", () => {
        expect(draftFromLine(line())).toMatchObject({ mode: "amount", amount: "2500" });
        expect(draftFromLine(line({ quantity: 12, unit: "m2", unit_rate: 45 }))).toMatchObject({ mode: "rate", quantity: "12", unit: "m2", rate: "45" });
        // A saved draft builds back to the same line.
        const original = line({ description: "Tiling", quantity: 12, unit: "m2", unit_rate: 45 });
        expect(buildPriceLine(draftFromLine(original))).toEqual({
            ok: true,
            line: { description: "Tiling", quantity: 12, unit: "m2", unit_rate: 45 },
        });
    });
});

describe("canonical totals", () => {
    const lines = [line({ line_total: 2500 }), line({ id: "line-2", line_total: 1500 })];

    it("with no adjustments the total is exactly the contractor's lines", () => {
        const summary = summarisePrice(estimate(), lines);
        expect(summary).toMatchObject({ linesTotal: 4000, adjustments: [], adjustmentsTotal: 0, contractSum: 4000, vat: 800, totalIncVat: 4800 });
    });

    it("matches computeContractSum for every figure it shows", () => {
        const est = estimate({ prelims_pct: 10, overhead_pct: 10, risk_pct: 5, profit_pct: 15, discount_pct: 2.5 });
        const canonical = computeContractSum(est, lines);
        const summary = summarisePrice(est, lines);

        expect(summary.linesTotal).toBe(canonical.directCost);
        expect(summary.contractSum).toBeCloseTo(canonical.contractSum, 2);
        expect(summary.adjustments.map((a) => [a.key, a.pct])).toEqual([
            ["prelims", 10], ["overhead", 10], ["risk", 5], ["profit", 15], ["discount", 2.5],
        ]);
        expect(summary.adjustments.find((a) => a.key === "prelims")!.amount).toBeCloseTo(canonical.prelimsTotal, 2);
        expect(summary.adjustments.find((a) => a.key === "overhead")!.amount).toBeCloseTo(canonical.overheadAmount, 2);
        expect(summary.adjustments.find((a) => a.key === "risk")!.amount).toBeCloseTo(canonical.riskAmount, 2);
        expect(summary.adjustments.find((a) => a.key === "profit")!.amount).toBeCloseTo(canonical.profitAmount, 2);
        expect(summary.adjustments.find((a) => a.key === "discount")!.amount).toBeCloseTo(-canonical.discountAmount, 2);
        // The rows add up to the total shown.
        const rows = summary.linesTotal + summary.adjustments.reduce((sum, a) => sum + a.amount, 0);
        expect(rows).toBeCloseTo(summary.contractSum, 1);
    });

    it("uses the contractor's own preliminaries lines instead of the percentage", () => {
        const withPrelims = [...lines, line({ id: "p", trade_section: "Preliminaries", line_total: 600 })];
        const summary = summarisePrice(estimate({ prelims_pct: 10 }), withPrelims);
        expect(summary.prelimsFromLines).toBe(true);
        expect(summary.linesTotal).toBe(4600);
        expect(summary.adjustments).toEqual([]);
        expect(summary.contractSum).toBe(4600);
    });

    it("is zero for a blank project", () => {
        expect(summarisePrice(null, [])).toMatchObject({ linesTotal: 0, contractSum: 0, vat: 0, totalIncVat: 0, adjustments: [] });
    });
});

describe("blank project with no estimate", () => {
    it("starts empty: no estimate, no lines, nothing open, zero total", () => {
        const state = makeStore().getState();
        expect(currentEstimate(state)).toBeNull();
        expect(state.estimates).toEqual([]);
        expect(state.ops).toEqual({});
        expect(currentSummary(state).contractSum).toBe(0);
    });

    it("creates the estimate with the first real line and nothing else", async () => {
        const store = makeStore();
        const server = fakeServer();
        openAdd(store, { description: "Bathroom refit", amount: "2500" });

        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(true);

        expect(server.saveLine).toHaveBeenCalledWith({
            projectId: PROJECT_ID,
            estimateId: null,
            newEstimateId: PENDING_ESTIMATE_ID,
            lineId: "new-line-id",
            line: { description: "Bathroom refit", quantity: 1, unit: "item", unit_rate: 2500 },
        });
        const est = currentEstimate(store.getState())!;
        expect(est.id).toBe(PENDING_ESTIMATE_ID);
        expect(est.estimate_lines.map((l) => l.description)).toEqual(["Bathroom refit"]);
        expect(currentSummary(store.getState()).contractSum).toBe(2500);
        expect(store.getState().ops).toEqual({});
    });

    it("does not call the server for an incomplete first line", async () => {
        const store = makeStore();
        const server = fakeServer();
        openAdd(store, { description: "", amount: "" });

        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(false);
        expect(server.saveLine).not.toHaveBeenCalled();
        expect(store.getState().estimates).toEqual([]);
        expect(store.getState().ops[NEW_LINE_KEY].fieldErrors.description).toBeDefined();
    });

    it("retries a failed first line with the same estimate and line ids", async () => {
        const store = makeStore();
        const server = fakeServer();
        const working = server.saveLine.getMockImplementation()!;
        server.saveLine
            .mockResolvedValueOnce({ ok: false, error: LINE_SAVE_ERROR })
            .mockImplementation(working);
        openAdd(store, { description: "Bathroom refit", amount: "2500" });

        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(false);
        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(true);

        const [first, retry] = server.saveLine.mock.calls.map(([request]) => request);
        expect(retry).toEqual(first);
        expect(store.getState().estimates).toHaveLength(1);
        expect(currentEstimate(store.getState())!.estimate_lines).toHaveLength(1);
    });

    it("adds later lines to the estimate that now exists", async () => {
        const store = makeStore();
        const server = fakeServer();
        openAdd(store, { description: "Bathroom refit", amount: "2500" }, "line-a");
        await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY);
        openAdd(store, { description: "Tiling", mode: "rate", quantity: "12", unit: "m2", rate: "45" }, "line-b");
        await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY);

        expect(server.saveLine.mock.calls[1][0].estimateId).toBe(PENDING_ESTIMATE_ID);
        expect(store.getState().estimates).toHaveLength(1);
        expect(currentSummary(store.getState()).contractSum).toBe(3040);
    });
});

describe("failed line operations keep a truthful screen", () => {
    const existing = () => [estimate({ estimate_lines: [line(), line({ id: "line-2", description: "Tiling", quantity: 12, unit: "m2", unit_rate: 45, line_total: 540 })] })];

    it("a failed add keeps what was typed and leaves the total alone", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        server.saveLine.mockResolvedValue({ ok: false, error: LINE_SAVE_ERROR });
        openAdd(store, { description: "Skip hire", amount: "320" });

        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(false);

        const state = store.getState();
        expect(state.ops[NEW_LINE_KEY]).toMatchObject({ status: "failed", error: LINE_SAVE_ERROR, draft: { description: "Skip hire", amount: "320" } });
        expect(currentEstimate(state)!.estimate_lines).toHaveLength(2);
        expect(currentSummary(state).contractSum).toBe(3040);
    });

    it("the total only moves once an add is confirmed", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const working = server.saveLine.getMockImplementation()!;
        server.saveLine.mockImplementation(async (request) => { await gate; return working(request); });
        openAdd(store, { description: "Skip hire", amount: "320" });

        const running = submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY);
        expect(store.getState().ops[NEW_LINE_KEY].status).toBe("saving");
        expect(currentSummary(store.getState()).contractSum).toBe(3040);

        release();
        await running;
        expect(currentSummary(store.getState()).contractSum).toBe(3360);
    });

    it("a second submit while saving is ignored", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        openAdd(store, { description: "Skip hire", amount: "320" });

        const running = submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY);
        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(false);
        await running;
        expect(server.saveLine).toHaveBeenCalledTimes(1);
    });

    it("a failed edit keeps the typed change and shows the saved line unchanged", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        vi.mocked(server.updateLine).mockResolvedValueOnce({ ok: false, error: LINE_SAVE_ERROR });
        store.dispatch({ type: "op/open", key: "line-1", kind: "edit", draft: draftFromLine(line()), lineId: "line-1" });
        store.dispatch({ type: "op/change", key: "line-1", patch: { amount: "3000" } });

        expect(await submitPriceLine(store, server, PROJECT_ID, "line-1")).toBe(false);
        let state = store.getState();
        expect(state.ops["line-1"]).toMatchObject({ status: "failed", draft: { amount: "3000" } });
        expect(currentEstimate(state)!.estimate_lines[0].line_total).toBe(2500);
        expect(currentSummary(state).contractSum).toBe(3040);

        expect(await submitPriceLine(store, server, PROJECT_ID, "line-1")).toBe(true);
        state = store.getState();
        expect(currentEstimate(state)!.estimate_lines[0]).toMatchObject({ id: "line-1", unit_rate: 3000, line_total: 3000, trade_section: "General" });
        expect(currentSummary(state).contractSum).toBe(3540);
    });

    it("a failed delete keeps the line and the total, and can be retried", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        vi.mocked(server.deleteLine).mockResolvedValueOnce({ ok: false, error: LINE_DELETE_ERROR });
        store.dispatch({ type: "op/open", key: "line-2", kind: "delete", draft: draftFromLine(line()), lineId: "line-2" });

        expect(await removePriceLine(store, server, "line-2")).toBe(false);
        let state = store.getState();
        expect(state.ops["line-2"]).toMatchObject({ kind: "delete", status: "failed", error: LINE_DELETE_ERROR });
        expect(currentEstimate(state)!.estimate_lines).toHaveLength(2);
        expect(currentSummary(state).contractSum).toBe(3040);

        expect(await removePriceLine(store, server, "line-2")).toBe(true);
        state = store.getState();
        expect(currentEstimate(state)!.estimate_lines.map((l) => l.id)).toEqual(["line-1"]);
        expect(currentSummary(state).contractSum).toBe(2500);
    });

    it("a line is only removed after the contractor has confirmed it", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        expect(await removePriceLine(store, server, "line-2")).toBe(false);
        expect(server.deleteLine).not.toHaveBeenCalled();
    });

    it("a thrown request is a failure with the input kept", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        server.saveLine.mockRejectedValue(new Error("offline"));
        openAdd(store, { description: "Skip hire", amount: "320" });

        expect(await submitPriceLine(store, server, PROJECT_ID, NEW_LINE_KEY)).toBe(false);
        expect(store.getState().ops[NEW_LINE_KEY]).toMatchObject({ status: "failed", error: LINE_SAVE_ERROR, draft: { amount: "320" } });
    });

    it("typing after a failure clears the error but keeps the draft open", () => {
        const store = makeStore(existing());
        openAdd(store, { description: "Skip hire", amount: "320" });
        store.dispatch({ type: "op/failed", key: NEW_LINE_KEY, error: null, fieldErrors: { amount: "bad" } });
        store.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch: { amount: "330" } });
        expect(store.getState().ops[NEW_LINE_KEY].fieldErrors).toEqual({});
        expect(store.getState().ops[NEW_LINE_KEY].draft.amount).toBe("330");
    });
});

describe("price adjustments", () => {
    const existing = () => [estimate({ estimate_lines: [line({ line_total: 1000, unit_rate: 1000 })] })];

    it("are closed by default", () => {
        expect(makeStore(existing()).getState().adjustments.open).toBe(false);
    });

    it("change the total only once saved", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        store.dispatch({ type: "adjustments/toggle" });
        store.dispatch({ type: "adjustments/change", patch: { overhead: "10", profit: "20" } });
        expect(currentSummary(store.getState()).contractSum).toBe(1000);

        expect(await submitAdjustments(store, server)).toBe(true);

        expect(server.saveAdjustments).toHaveBeenCalledWith("est-1", {
            prelims_pct: 0, overhead_pct: 10, risk_pct: 0, profit_pct: 20, discount_pct: 0, discount_reason: "",
        });
        expect(currentSummary(store.getState()).contractSum).toBe(1320);
        expect(store.getState().adjustments.draft).toBeNull();
    });

    it("a failed save keeps the typed percentages and the old total", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        vi.mocked(server.saveAdjustments).mockResolvedValueOnce({ ok: false, error: ADJUSTMENTS_SAVE_ERROR });
        store.dispatch({ type: "adjustments/change", patch: { profit: "20" } });

        expect(await submitAdjustments(store, server)).toBe(false);
        expect(store.getState().adjustments).toMatchObject({ status: "failed", error: ADJUSTMENTS_SAVE_ERROR, draft: { profit: "20" } });
        expect(currentSummary(store.getState()).contractSum).toBe(1000);

        expect(await submitAdjustments(store, server)).toBe(true);
        expect(currentSummary(store.getState()).contractSum).toBe(1200);
    });

    it("rejects percentages outside 0 to 100 without calling the server", async () => {
        const store = makeStore(existing());
        const server = fakeServer();
        store.dispatch({ type: "adjustments/change", patch: { profit: "150", risk: "-5" } });

        expect(await submitAdjustments(store, server)).toBe(false);
        expect(server.saveAdjustments).not.toHaveBeenCalled();
        expect(Object.keys(store.getState().adjustments.fieldErrors).sort()).toEqual(["profit", "risk"]);
        expect(buildAdjustments({ prelims: "", overhead: "12.5%", risk: "0", profit: "15", discount: "", discountReason: " Returning client " })).toEqual({
            ok: true,
            input: { prelims_pct: 0, overhead_pct: 12.5, risk_pct: 0, profit_pct: 15, discount_pct: 0, discount_reason: "Returning client" },
        });
    });
});

describe("advanced estimating is reachable but not the default", () => {
    it("starts closed and opens on request", () => {
        const store = makeStore();
        expect(store.getState().advancedOpen).toBe(false);
        store.dispatch({ type: "advanced/toggle" });
        expect(store.getState().advancedOpen).toBe(true);
        store.dispatch({ type: "advanced/toggle" });
        expect(store.getState().advancedOpen).toBe(false);
    });

    it("always offers the BoQ, build-ups, cost library and versions", () => {
        expect(advancedCapabilities("cohort").map((c) => c.key)).toEqual(["boq", "build-ups", "cost-library", "versions"]);
    });

    it("offers client BoQ import and drawing take-off where the launch profile allows them", () => {
        expect(advancedCapabilities("full").map((c) => c.key)).toEqual([
            "boq", "build-ups", "cost-library", "versions", "client-boq", "drawing-takeoff",
        ]);
    });

    it("changes made in the advanced workspace flow into the same total", () => {
        const store = makeStore([estimate({ estimate_lines: [line()] })]);
        store.dispatch({
            type: "estimates/replace",
            update: (estimates) => estimates.map((e) => ({ ...e, estimate_lines: [...e.estimate_lines, line({ id: "adv", line_total: 500 })] })),
        });
        expect(currentSummary(store.getState()).contractSum).toBe(3000);
    });

    it("sends build-up and client BoQ lines to the advanced workspace for editing", () => {
        expect(isSimpleEditable(line(), estimate())).toBe(true);
        expect(isSimpleEditable(line({ pricing_mode: "buildup" }), estimate())).toBe(false);
        expect(isSimpleEditable(line(), estimate({ is_client_boq: true }))).toBe(false);
    });
});

describe("established estimates", () => {
    const v1 = estimate({ id: "v1", is_active: false, estimate_lines: [line({ estimate_id: "v1" })] });
    const v2 = estimate({
        id: "v2", is_active: true, overhead_pct: 10, profit_pct: 15, prelims_pct: 10,
        estimate_lines: [line({ id: "b", estimate_id: "v2", pricing_mode: "buildup", trade_section: "Groundworks", line_total: 10000 })],
    });

    it("opens on the estimate the proposal uses, or the one asked for", () => {
        expect(pickInitialEstimateId([v1, v2])).toBe("v2");
        expect(pickInitialEstimateId([v1, v2], "v1")).toBe("v1");
        expect(pickInitialEstimateId([v1, v2], "missing")).toBe("v2");
        expect(pickInitialEstimateId([{ ...v1 }, { ...v2, is_active: false }])).toBe("v1");
    });

    it("keeps every line and the existing percentages", () => {
        const state = initialEstimatingState([v1, v2], { pendingEstimateId: PENDING_ESTIMATE_ID });
        expect(state.estimates).toEqual([v1, v2]);
        expect(currentSummary(state).contractSum).toBeCloseTo(computeContractSum(v2, v2.estimate_lines).contractSum, 2);
        expect(currentSummary(state).contractSum).toBe(13915);
    });

    it("switching version closes open edits rather than applying them to the wrong estimate", () => {
        const store = makeStore([v1, v2]);
        openAdd(store, { description: "x", amount: "1" });
        store.dispatch({ type: "estimate/select", estimateId: "v1" });
        expect(store.getState().activeEstimateId).toBe("v1");
        expect(store.getState().ops).toEqual({});
    });
});
