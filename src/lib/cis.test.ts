import { describe, it, expect } from "vitest";
import {
    calculateCisDeduction,
    deductionRate,
    getTaxMonthStart,
} from "./cis";

describe("deductionRate", () => {
    it("returns 0% for gross-status subcontractors", () => {
        expect(deductionRate("gross")).toBe(0);
    });

    it("returns 20% for standard (verified) subcontractors", () => {
        expect(deductionRate("standard")).toBe(20);
    });

    it("returns 30% for higher rate (unverified UTR or not registered)", () => {
        expect(deductionRate("higher")).toBe(30);
    });

    it("returns 30% for unverified subcontractors (HMRC default)", () => {
        // Per HMRC: until verification is complete, the 30% higher rate
        // applies to all payments to a new subcontractor.
        expect(deductionRate("unverified")).toBe(30);
    });
});

describe("calculateCisDeduction — standard rate (20%)", () => {
    it("Gemini worked example: gross £1000, materials £600 → £80 deduction", () => {
        const { labour, rate, deduction, net } = calculateCisDeduction({
            gross: 1000,
            materials: 600,
            status: "standard",
        });
        expect(labour).toBe(400);
        expect(rate).toBe(20);
        expect(deduction).toBe(80);
        expect(net).toBe(920);
    });

    it("100% materials → zero deduction", () => {
        const { deduction, net } = calculateCisDeduction({
            gross: 1000,
            materials: 1000,
            status: "standard",
        });
        expect(deduction).toBe(0);
        expect(net).toBe(1000);
    });

    it("100% labour → full 20% deduction on whole gross", () => {
        const { deduction, net } = calculateCisDeduction({
            gross: 500,
            materials: 0,
            status: "standard",
        });
        expect(deduction).toBe(100);
        expect(net).toBe(400);
    });

    it("rounds to whole pence (HMRC requirement)", () => {
        // gross 123.45, materials 50, labour 73.45, 20% = 14.69
        const { deduction } = calculateCisDeduction({
            gross: 123.45,
            materials: 50,
            status: "standard",
        });
        expect(deduction).toBe(14.69);
    });
});

describe("calculateCisDeduction — higher rate (30%)", () => {
    it("unverified subbie: gross £500, materials £100 → £120 deduction", () => {
        const { deduction, rate, net } = calculateCisDeduction({
            gross: 500,
            materials: 100,
            status: "higher",
        });
        expect(rate).toBe(30);
        expect(deduction).toBe(120);
        expect(net).toBe(380);
    });
});

describe("calculateCisDeduction — gross-status (0%)", () => {
    it("no deduction regardless of labour split", () => {
        const { deduction, net } = calculateCisDeduction({
            gross: 2500,
            materials: 800,
            status: "gross",
        });
        expect(deduction).toBe(0);
        expect(net).toBe(2500);
    });
});

describe("calculateCisDeduction — edge cases", () => {
    it("clamps labour to 0 when materials > gross (no negative deduction)", () => {
        const { labour, deduction, net } = calculateCisDeduction({
            gross: 100,
            materials: 250,
            status: "standard",
        });
        expect(labour).toBe(0);
        expect(deduction).toBe(0);
        expect(net).toBe(100);
    });

    it("handles zero gross", () => {
        const { deduction, net } = calculateCisDeduction({
            gross: 0,
            materials: 0,
            status: "standard",
        });
        expect(deduction).toBe(0);
        expect(net).toBe(0);
    });

    it("coerces stringy numbers to 0 defensively", () => {
        const { deduction } = calculateCisDeduction({
            gross: NaN as any,
            materials: 50,
            status: "standard",
        });
        expect(deduction).toBe(0);
    });

    it("plant with operator: operator cost goes to labour (gross £1000, mat £400 incl plant excl operator) → £120 deduction", () => {
        // Scenario: excavator hired at £400 with operator charging £600 labour
        // The subcontractor's invoice says gross £1000, materials £400 (plant only)
        // → labour £600, deduction £120
        const { labour, deduction } = calculateCisDeduction({
            gross: 1000,
            materials: 400,
            status: "standard",
        });
        expect(labour).toBe(600);
        expect(deduction).toBe(120);
    });

    it("plant without operator: whole plant cost goes to materials (gross £800, mat £800) → £0 deduction", () => {
        // Scenario: self-drive telehandler £800 for a week — pure materials
        const { deduction } = calculateCisDeduction({
            gross: 800,
            materials: 800,
            status: "standard",
        });
        expect(deduction).toBe(0);
    });
});

describe("getTaxMonthStart", () => {
    it("returns same-month start for payments on/after the 6th", () => {
        expect(getTaxMonthStart("2026-04-06")).toBe("2026-04-06");
        expect(getTaxMonthStart("2026-04-15")).toBe("2026-04-06");
        expect(getTaxMonthStart("2026-05-05")).toBe("2026-04-06");
    });

    it("returns previous-month start for payments before the 6th", () => {
        expect(getTaxMonthStart("2026-04-01")).toBe("2026-03-06");
        expect(getTaxMonthStart("2026-04-05")).toBe("2026-03-06");
    });

    it("handles January → previous year rollover", () => {
        expect(getTaxMonthStart("2026-01-03")).toBe("2025-12-06");
    });

    it("handles month boundaries correctly", () => {
        expect(getTaxMonthStart("2026-06-06")).toBe("2026-06-06");
        expect(getTaxMonthStart("2026-07-05")).toBe("2026-06-06");
    });
});
