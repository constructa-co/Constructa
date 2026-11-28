import { describe, expect, it } from "vitest";
import { homeProjectContractValue } from "./home-project-contract-value";

const baseEst = {
    prelims_pct: 10,
    overhead_pct: 10,
    risk_pct: 5,
    profit_pct: 15,
    discount_pct: 0,
} as const;

describe("homeProjectContractValue (N2.6)", () => {
    it("uses canonical sum when estimate exists, including zero", () => {
        const lines = [{ trade_section: "General", line_total: 0, quantity: 1, unit_rate: 0 }];
        expect(homeProjectContractValue(baseEst, lines, 500_000)).toBe(0);
    });

    it("uses canonical sum when estimate exists, including negative direct (discount edge)", () => {
        const lines = [{ trade_section: "General", line_total: -100, quantity: 1, unit_rate: -100 }];
        const v = homeProjectContractValue({ ...baseEst, discount_pct: 0 }, lines, 99_000);
        expect(v).toBeLessThan(0);
        expect(v).not.toBe(99_000);
    });

    it("falls back to potential_value only when no estimate row", () => {
        expect(homeProjectContractValue(undefined, [], 42_000)).toBe(42_000);
        expect(homeProjectContractValue(undefined, [], null)).toBe(0);
    });
});