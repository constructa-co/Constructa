import { describe, expect, it } from "vitest";
import {
    discountNeedsConfirmation,
    evaluateDiscountSubmitGate,
    showHighDiscountWarning,
} from "./discount-confirm";

describe("CON-069 discount confirmation gate", () => {
    it("treats 25% as the boundary without needing confirmation", () => {
        expect(discountNeedsConfirmation(25)).toBe(false);
        expect(discountNeedsConfirmation(25.01)).toBe(true);
    });

    it("shows the large-discount warning above 25%, including 100%", () => {
        expect(showHighDiscountWarning(30)).toBe(true);
        expect(showHighDiscountWarning(100)).toBe(true);
        expect(showHighDiscountWarning(25)).toBe(false);
    });

    it("allows low discounts without reason or confirmation", () => {
        expect(evaluateDiscountSubmitGate(10, "", false)).toEqual({ ok: true });
        expect(evaluateDiscountSubmitGate(25, "", false)).toEqual({ ok: true });
    });

    it("requires reason and confirmation above 25%", () => {
        expect(evaluateDiscountSubmitGate(40, "", false)).toEqual({
            ok: false,
            fieldErrors: { discountReason: expect.any(String) },
        });
        expect(evaluateDiscountSubmitGate(40, "Returning client", false)).toEqual({
            ok: false,
            needsConfirm: true,
            discountPct: 40,
            showWarning: true,
        });
        expect(evaluateDiscountSubmitGate(40, "Returning client", true)).toEqual({ ok: true });
    });

    it("accepts 100% with confirm, reason, and the large-discount warning", () => {
        expect(evaluateDiscountSubmitGate(100, "Promotional", false)).toEqual({
            ok: false,
            needsConfirm: true,
            discountPct: 100,
            showWarning: true,
        });
        expect(evaluateDiscountSubmitGate(100, "Promotional", true)).toEqual({ ok: true });
    });
});