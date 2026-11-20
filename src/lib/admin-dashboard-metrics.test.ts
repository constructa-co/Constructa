import { describe, expect, it } from "vitest";
import { signupConversionRatePct, sumSignupPoints } from "./admin-dashboard-metrics";

describe("admin dashboard metrics", () => {
    it("sums signup data points", () => {
        expect(sumSignupPoints([
            { key: "2026-04-01", label: "1", value: 2 },
            { key: "2026-04-02", label: "2", value: 3 },
        ])).toBe(5);
    });

    it("aligns conversion with the same 30d visitor window", () => {
        expect(signupConversionRatePct(5, 100)).toBe(5);
        expect(signupConversionRatePct(5, 0)).toBe(0);
    });
});