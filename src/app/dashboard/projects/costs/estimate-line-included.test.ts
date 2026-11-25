import { describe, expect, it } from "vitest";
import { toEstimateLine } from "./estimate-mapping";
import { isIncludedNotChargedLine } from "@/lib/simple-estimate";

describe("estimate_lines.included persistence (CON-068)", () => {
    it("maps a stored true flag through toEstimateLine without inferring from unit_rate alone", () => {
        const row = toEstimateLine({
            id: "line",
            estimate_id: "est",
            description: "Labour included in main contract",
            quantity: 1,
            unit: "item",
            unit_rate: 0,
            line_total: 0,
            pricing_mode: "simple",
            included: true,
        });
        expect(row.included).toBe(true);
        expect(isIncludedNotChargedLine(row)).toBe(true);
    });

    it("does not infer Included intent when the column is absent", () => {
        const row = toEstimateLine({
            id: "line",
            estimate_id: "est",
            description: "Tiling",
            quantity: 10,
            unit: "m2",
            unit_rate: 45,
            line_total: 450,
            pricing_mode: "simple",
        });
        expect(row.included).toBe(false);
        expect(isIncludedNotChargedLine(row)).toBe(false);
    });

    it("keeps ambiguous legacy zero placeholders out of the Included badge", () => {
        const row = toEstimateLine({
            id: "line",
            estimate_id: "est",
            description: "Placeholder",
            quantity: 1,
            unit: "item",
            unit_rate: 0,
            line_total: 0,
            pricing_mode: "simple",
            included: false,
        });
        expect(isIncludedNotChargedLine(row)).toBe(false);
    });
});