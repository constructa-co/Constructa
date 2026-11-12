import { describe, expect, it } from "vitest";
import { areaQuantity } from "./area-quantity";
import { buildPriceLine, EMPTY_PRICE_LINE_DRAFT } from "./simple-estimate";

describe("exact result-only area quantity", () => {
    it.each([
        ["3", "4", "12"], ["0.1", "0.2", "0.02"], ["1.25", "0.8", "1"],
        ["0.001", "1", "0.001"], ["2.5000", "4.0000", "10"],
        ["0002.50", "02", "5"], [" 2.5 ", " 3 ", "7.5"],
        ["0.0001", "10", "0.001"], ["1000", "1000", "1000000"],
        ["999999.999", "1", "999999.999"], ["0.00000000000000000001", "10000000000000000000", "0.1"],
    ])("multiplies %s by %s exactly as %s", (length, width, expected) => {
        const result = areaQuantity(length, width);
        expect(result).toEqual({ ok: true, quantity: expected });
        if (result.ok) expect(buildPriceLine({ ...EMPTY_PRICE_LINE_DRAFT, description: "Measured work", mode: "rate", quantity: result.quantity, unit: "m2", rate: "1" }).ok).toBe(true);
    });

    it.each([["0.001", "0.001"], ["1.234", "1.234"], ["0.3333", "1"]])("refuses %s x %s instead of rounding to three decimals", (length, width) => {
        expect(areaQuantity(length, width)).toMatchObject({ ok: false, error: expect.stringContaining("three decimal places") });
    });

    it.each([["1000", "1000.001"], ["1000001", "1"]])("refuses quantities beyond the existing maximum", (length, width) => {
        expect(areaQuantity(length, width)).toMatchObject({ ok: false, error: expect.stringContaining("1,000,000") });
    });

    it.each(["", "0", "-1", "+1", "1e2", "0x10", "£2", "1,000", "1 2", "1/2", "NaN", "Infinity", "2m", "1.", ".5", "1,5", "1".repeat(65)])("refuses ambiguous or invalid measurement %j", raw => {
        expect(areaQuantity(raw, "2").ok).toBe(false);
        expect(areaQuantity("2", raw).ok).toBe(false);
    });
});
