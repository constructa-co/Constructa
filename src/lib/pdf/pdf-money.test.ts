import { describe, expect, it } from "vitest";
import {
    formatDeduction,
    formatGbp,
    formatGbpShort,
    formatSignedGbp,
} from "./pdf-money";

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 58 Phase 3 item #3. Tests for the canonical PDF money formatter.
// These are deliberately tighter than the Vitest tests for src/lib/financial.ts
// because a broken PDF formatter would corrupt every document sent to a client
// — proposals, invoices, variations, final accounts.
// ─────────────────────────────────────────────────────────────────────────────

describe("formatGbp", () => {
    it("formats a positive amount with 2dp", () => {
        expect(formatGbp(1753.29)).toBe("£1,753.29");
    });

    it("rounds to 2dp by default", () => {
        expect(formatGbp(1753.287)).toBe("£1,753.29");
        expect(formatGbp(1753.284)).toBe("£1,753.28");
    });

    it("handles 0 without negative-zero issue", () => {
        expect(formatGbp(0)).toBe("£0.00");
        expect(formatGbp(-0)).toBe("£0.00");
    });

    it("handles null/undefined/empty string as 0", () => {
        expect(formatGbp(null)).toBe("£0.00");
        expect(formatGbp(undefined)).toBe("£0.00");
        expect(formatGbp("")).toBe("£0.00");
    });

    it("coerces numeric strings (Supabase returns numerics as strings)", () => {
        expect(formatGbp("1753.29")).toBe("£1,753.29");
        expect(formatGbp("1200.00")).toBe("£1,200.00");
    });

    it("handles NaN and Infinity as 0", () => {
        expect(formatGbp(NaN)).toBe("£0.00");
        expect(formatGbp(Infinity)).toBe("£0.00");
        expect(formatGbp(-Infinity)).toBe("£0.00");
        expect(formatGbp("not a number")).toBe("£0.00");
    });

    it("respects the symbol option for table-cell use", () => {
        expect(formatGbp(1753.29, { symbol: false })).toBe("1,753.29");
    });

    it("respects the decimals option", () => {
        expect(formatGbp(1753.29, { decimals: 0 })).toBe("£1,753");
        expect(formatGbp(1753.29, { decimals: 4 })).toBe("£1,753.2900");
    });

    it("renders a negative amount with a minus sign", () => {
        expect(formatGbp(-1200)).toBe("£-1,200.00");
    });
});

describe("formatDeduction", () => {
    it("wraps non-zero amounts in parentheses (UK accounting convention)", () => {
        expect(formatDeduction(1250)).toBe("(£1,250.00)");
        expect(formatDeduction(699.24)).toBe("(£699.24)");
    });

    it("renders a zero deduction as plain £0.00 (never wraps (£0.00))", () => {
        expect(formatDeduction(0)).toBe("£0.00");
        expect(formatDeduction(-0)).toBe("£0.00");
        expect(formatDeduction(null)).toBe("£0.00");
        expect(formatDeduction(undefined)).toBe("£0.00");
    });

    it("accepts numeric strings from Supabase", () => {
        expect(formatDeduction("1250.00")).toBe("(£1,250.00)");
        expect(formatDeduction("0")).toBe("£0.00");
    });
});

describe("formatSignedGbp", () => {
    it("prefixes positive amounts with +", () => {
        expect(formatSignedGbp(1250)).toBe("+£1,250.00");
    });

    it("prefixes negative amounts with - and uses absolute value", () => {
        expect(formatSignedGbp(-900)).toBe("-£900.00");
    });

    it("renders 0 without any sign prefix", () => {
        expect(formatSignedGbp(0)).toBe("£0.00");
        expect(formatSignedGbp(-0)).toBe("£0.00");
    });
});

describe("formatGbpShort", () => {
    it("abbreviates millions with 1dp", () => {
        expect(formatGbpShort(1_200_000)).toBe("£1.2m");
        expect(formatGbpShort(2_500_000)).toBe("£2.5m");
    });

    it("abbreviates thousands with no decimals", () => {
        expect(formatGbpShort(45_000)).toBe("£45k");
        expect(formatGbpShort(99_500)).toBe("£100k");
    });

    it("formats small amounts with no decimals", () => {
        expect(formatGbpShort(2300)).toBe("£2k");
        expect(formatGbpShort(999)).toBe("£999");
        expect(formatGbpShort(0)).toBe("£0");
    });

    it("handles null/undefined/NaN safely", () => {
        expect(formatGbpShort(null)).toBe("£0");
        expect(formatGbpShort(undefined)).toBe("£0");
        expect(formatGbpShort(NaN)).toBe("£0");
    });
});
