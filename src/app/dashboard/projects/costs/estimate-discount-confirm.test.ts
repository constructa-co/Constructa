import { describe, expect, it } from "vitest";
import {
    adjustmentsDraftFromEstimate,
    estimatingReducer,
    initialEstimatingState,
    submitAdjustments,
} from "@/lib/simple-estimate";
import type { Estimate, EstimateLine } from "./types";
import { vi } from "vitest";

const line = (): EstimateLine => ({
    id: "line",
    estimate_id: "est-1",
    description: "Work",
    quantity: 1,
    unit: "item",
    unit_rate: 1000,
    line_total: 1000,
    trade_section: "General",
    line_type: "general",
    pricing_mode: "simple",
    estimate_line_components: [],
});

const estimate = (): Estimate => ({
    id: "est-1",
    project_id: "job",
    version_name: "Estimate",
    is_active: true,
    overhead_pct: 0,
    profit_pct: 0,
    risk_pct: 0,
    prelims_pct: 0,
    discount_pct: 10,
    discount_reason: "Saved reason",
    total_cost: 1000,
    estimate_lines: [line()],
});

describe("CON-069 simple adjustments cancel preserves acknowledged discount", () => {
    it("reverting the draft leaves the saved estimate unchanged and does not call save", async () => {
        const store = {
            getState: () => state,
            dispatch: (action: Parameters<typeof estimatingReducer>[1]) => {
                state = estimatingReducer(state, action);
            },
        };
        let state = initialEstimatingState([estimate()], { pendingEstimateId: "pending-estimate" });
        const server = { saveAdjustments: vi.fn(async () => ({ ok: true as const })) };

        state = estimatingReducer(state, { type: "adjustments/change", patch: { discount: "40", discountReason: "" } });
        expect(await submitAdjustments(store, server)).toEqual({
            ok: false,
            fieldErrors: { discountReason: expect.any(String) },
        });
        expect(server.saveAdjustments).not.toHaveBeenCalled();

        const acknowledged = adjustmentsDraftFromEstimate(estimate());
        store.dispatch({
            type: "adjustments/change",
            patch: { discount: acknowledged.discount, discountReason: acknowledged.discountReason },
        });
        expect(server.saveAdjustments).not.toHaveBeenCalled();
        expect(state.adjustments.draft).toMatchObject({ discount: "10", discountReason: "Saved reason" });
        expect(state.estimates[0].discount_pct).toBe(10);
    });
});