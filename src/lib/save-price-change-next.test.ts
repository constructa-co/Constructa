import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import {
    currentSummary, draftFromLine, estimatingReducer, initialEstimatingState,
    type EstimatingAction, type EstimatingServer, type EstimatingState, type EstimatingStore,
} from "./simple-estimate";
import { nextEditableSavedLine, savePriceAndChangeNext, type ReviewedPriceNext } from "./save-price-change-next";

const line = (id: string, mode: "simple" | "buildup" = "simple"): EstimateLine => ({
    id, estimate_id: "estimate", description: "Saved " + id, quantity: 2, unit: "m2", unit_rate: 30, line_total: 60,
    trade_section: "Decoration", line_type: "general", pricing_mode: mode, estimate_line_components: [],
});
let state: EstimatingState, store: EstimatingStore, server: Pick<EstimatingServer, "saveLine" | "updateLine">, allowed: ReturnType<typeof vi.fn<() => boolean>>;
const update = vi.fn<EstimatingServer["updateLine"]>(), insert = vi.fn<EstimatingServer["saveLine"]>();
beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "First", is_active: true,
        overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 180,
        estimate_lines: [line("one"), line("two"), line("three")] };
    state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    store = { getState: () => state, dispatch: (action: EstimatingAction) => { state = estimatingReducer(state, action); } };
    update.mockReset(); insert.mockReset(); allowed = vi.fn(() => true);
    update.mockImplementation(async (_estimate, id, input) => ({ ok: true, line: { id, ...input, line_total: input.quantity * input.unit_rate } }));
    server = { saveLine: insert, updateLine: update };
});
function review(): ReviewedPriceNext {
    const estimate = state.estimates[0], source = estimate.estimate_lines[0];
    store.dispatch({ type: "op/open", key: "one", kind: "edit", lineId: "one", draft: { ...draftFromLine(source), quantity: "3" } });
    return { estimate, lineId: "one", op: state.ops.one, nextId: "two", revision: JSON.stringify(estimate) };
}
const run = (reviewed: ReviewedPriceNext) => savePriceAndChangeNext(store, server, "job", reviewed, allowed);
describe("reviewed saved line continuation", () => {
    it("selects actual source order,skips read-only build-ups,and never wraps", () => {
        const estimate = state.estimates[0]; estimate.estimate_lines[1].pricing_mode = "buildup";
        expect(nextEditableSavedLine(estimate, "one")).toBe(estimate.estimate_lines[2]);
        expect(nextEditableSavedLine(estimate, "three")).toBeNull(); expect(nextEditableSavedLine(estimate, "missing")).toBeNull();
        expect(nextEditableSavedLine(estimate, "two")).toBeNull();
        estimate.is_client_boq = true; expect(nextEditableSavedLine(estimate, "one")).toBeNull();
    });
    it("saves just the current row then opens the next row's OWN saved draft", async () => {
        const reviewed = review(), next = state.estimates[0].estimate_lines[1], savedNext = JSON.stringify(next);
        expect(await run(reviewed)).toBe(next);
        expect(update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "Saved one", quantity: 3, unit: "m2", unit_rate: 30 });
        expect(insert).not.toHaveBeenCalled(); expect(state.ops.one).toBeUndefined();
        expect(state.ops.two).toMatchObject({ kind: "edit", lineId: "two", draft: draftFromLine(next) });
        expect(JSON.stringify(next)).toBe(savedNext); expect(currentSummary(state).contractSum).toBe(210);
        expect(state.estimates[0].estimate_lines.map(row => row.id)).toEqual(["one", "two", "three"]);
    });
    it("preserves an unrelated unchanged draft rather than copying or clearing it", async () => {
        const reviewed = review(); store.dispatch({ type: "op/open", key: "three", kind: "edit", lineId: "three", draft: { ...draftFromLine(line("three")), rate: "999" } });
        const other = state.ops.three; await run(reviewed); expect(state.ops.three).toBe(other); expect(state.ops.two.draft.rate).toBe("30");
    });
    it.each(["openNext", "pendingOther", "advanced", "adjustments", "denied", "wrongOwner", "boq", "changedSource", "differentOp", "nextChanged"])("refuses %s before any save", async block => {
        const reviewed = review();
        if (block === "openNext") store.dispatch({ type: "op/open", key: "two", kind: "edit", lineId: "two", draft: draftFromLine(line("two")) });
        if (block === "pendingOther") { store.dispatch({ type: "op/open", key: "three", kind: "edit", lineId: "three", draft: draftFromLine(line("three")) }); store.dispatch({ type: "op/saving", key: "three" }); }
        if (block === "advanced") state = { ...state, advancedOpen: true };
        if (block === "adjustments") state.adjustments.draft = { prelims: "0", overhead: "0", risk: "0", profit: "0", discount: "0", discountReason: "" };
        if (block === "denied") allowed.mockReturnValue(false);
        if (block === "wrongOwner") state.estimates[0].project_id = "other";
        if (block === "boq") state.estimates[0].is_client_boq = true;
        if (block === "changedSource") state.estimates[0].estimate_lines[1].description = "Newer wording";
        if (block === "differentOp") store.dispatch({ type: "op/change", key: "one", patch: { rate: "40" } });
        if (block === "nextChanged") reviewed.nextId = "three";
        const before = JSON.stringify(state); expect(await run(reviewed)).toBeNull();
        expect(update).not.toHaveBeenCalled(); expect(JSON.stringify(state)).toBe(before);
    });
    it.each(["invalid", "refused", "throw", "warning", "wrongId", "wrongAmount"])("retains the current draft and never advances after %s", async mode => {
        const reviewed = review();
        if (mode === "invalid") { store.dispatch({ type: "op/change", key: "one", patch: { rate: "bad" } }); reviewed.op = state.ops.one; }
        if (mode === "refused") update.mockResolvedValueOnce({ ok: false, error: "Not confirmed" });
        if (mode === "throw") update.mockRejectedValueOnce(Error("Lost response"));
        if (mode === "warning") update.mockResolvedValueOnce({ ok: true, line: { id: "one", description: "Saved one", quantity: 3, unit: "m2", unit_rate: 30, line_total: 90 }, warning: "Stored total could not be refreshed." });
        if (mode === "wrongId" || mode === "wrongAmount") update.mockResolvedValueOnce({ ok: true, line: { id: mode === "wrongId" ? "other" : "one", description: "Saved one", quantity: 3, unit: "m2", unit_rate: 30, line_total: mode === "wrongAmount" ? 91 : 90 } });
        expect(await run(reviewed)).toBeNull(); expect(state.ops.two).toBeUndefined();
        expect(state.ops.one.status).toBe(mode === "invalid" ? "editing" : "failed");
        if (mode === "invalid") expect(state.ops.one.fieldErrors.rate).toBeDefined();
        expect(state.ops.one.draft).toBe(reviewed.op.draft); expect(currentSummary(state).contractSum).toBe(180);
    });
    it("fences duplicate calls while awaiting acknowledgement", async () => {
        const reviewed = review(); let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
        update.mockImplementationOnce(async (_estimate, id, input) => { await wait; return { ok: true, line: { id, ...input, line_total: 90 } }; });
        const pending = run(reviewed); expect(await run(reviewed)).toBeNull(); expect(update).toHaveBeenCalledOnce(); expect(state.ops.two).toBeUndefined();
        release(); expect((await pending)?.id).toBe("two");
    });
    it.each(["version", "source", "nextDraft", "otherTyping", "denied", "newCurrentDraft"])("retains new work and refuses late %s context", async change => {
        const reviewed = review(); let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
        update.mockImplementationOnce(async (_estimate, id, input) => { await wait; return { ok: true, line: { id, ...input, line_total: 90 } }; });
        const pending = run(reviewed);
        if (change === "version") state = { ...state, activeEstimateId: "other" };
        if (change === "source") state.estimates[0].estimate_lines[1].description = "Newer next source";
        if (change === "nextDraft") store.dispatch({ type: "op/open", key: "two", kind: "edit", lineId: "two", draft: { ...draftFromLine(line("two")), rate: "777" } });
        if (change === "otherTyping") store.dispatch({ type: "op/open", key: "three", kind: "edit", lineId: "three", draft: { ...draftFromLine(line("three")), rate: "888" } });
        if (change === "denied") allowed.mockReturnValue(false);
        if (change === "newCurrentDraft") state = { ...state, ops: { ...state.ops, one: { ...reviewed.op, draft: { ...reviewed.op.draft, rate: "666" } } } };
        const nextDraft = state.ops.two, otherDraft = state.ops.three, newDraft = change === "newCurrentDraft" ? state.ops.one : null;
        release(); expect(await pending).toBeNull(); expect(state.ops.two).toBe(nextDraft); expect(state.ops.three).toBe(otherDraft);
        if (newDraft) expect(state.ops.one).toBe(newDraft); else expect(state.ops.one.draft).toBe(reviewed.op.draft);
        expect(state.estimates[0].total_cost).toBe(180);
        expect(state.estimates[0].estimate_lines[0].line_total).toBe(60);
    });
});
