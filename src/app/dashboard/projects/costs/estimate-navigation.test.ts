import { describe, expect, it } from "vitest";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState } from "@/lib/simple-estimate";
import { hasOpenEstimateWork } from "./estimate-navigation";

describe("estimate project-navigation warning", () => {
    it("does not warn on a clean estimate or after an explicit line cancellation", () => {
        const clean = initialEstimatingState([], { pendingEstimateId: "pending" });
        expect(hasOpenEstimateWork(clean)).toBe(false);
        const editing = estimatingReducer(clean, { type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "local", draft: EMPTY_PRICE_LINE_DRAFT });
        expect(hasOpenEstimateWork(editing)).toBe(true);
        expect(hasOpenEstimateWork(estimatingReducer(editing, { type: "op/cancel", key: NEW_LINE_KEY }))).toBe(false);
    });

    it("continues warning while a line saves and after an unconfirmed failure", () => {
        const clean = initialEstimatingState([], { pendingEstimateId: "pending" });
        const editing = estimatingReducer(clean, { type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "local", draft: EMPTY_PRICE_LINE_DRAFT });
        const saving = estimatingReducer(editing, { type: "op/saving", key: NEW_LINE_KEY });
        expect(hasOpenEstimateWork(saving)).toBe(true);
        expect(hasOpenEstimateWork(estimatingReducer(saving, { type: "op/failed", key: NEW_LINE_KEY, error: "Unconfirmed" }))).toBe(true);
    });

    it("covers open adjustment drafts without changing their values", () => {
        const state = initialEstimatingState([], { pendingEstimateId: "pending" });
        state.adjustments.draft = { prelims: "0", overhead: "0", risk: "0", profit: "0", discount: "0", discountReason: "" };
        const before = JSON.stringify(state);
        expect(hasOpenEstimateWork(state)).toBe(true);
        expect(JSON.stringify(state)).toBe(before);
    });
});
