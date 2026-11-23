import { describe, expect, it } from "vitest";
import { computeContractSum } from "@/lib/financial";
import { toEstimate } from "./estimate-mapping";

// D96-S2: the estimate screen reads rows through toEstimate(); proposal, billing,
// home and live read the raw row. A stored NULL mark-up must mean 0 on both paths.

const line = { id: "line-1", trade_section: "General", line_type: "general", quantity: 1, unit_rate: 10000, line_total: 10000 };

function row(markups: Record<string, unknown>) {
    return { id: "estimate-1", total_cost: 10000, estimate_lines: [line], ...markups };
}

/** Same row through both paths: normalized (screen) vs raw (proposal/billing). */
function bothSums(source: ReturnType<typeof row>) {
    const screen = toEstimate(source);
    return {
        screen: computeContractSum(screen, screen.estimate_lines).contractSum,
        raw: computeContractSum(source, source.estimate_lines).contractSum,
        mapped: screen,
    };
}

describe("toEstimate mark-up semantics match the raw canonical readers", () => {
    it("legacy NULL overhead and profit map to 0, so a £10,000 line stays £10,000 on both paths", () => {
        const { screen, raw, mapped } = bothSums(row({ overhead_pct: null, profit_pct: null }));
        expect(mapped.overhead_pct).toBe(0);
        expect(mapped.profit_pct).toBe(0);
        expect(raw).toBe(10000);
        expect(screen).toBe(raw);
    });

    it("missing mark-up columns behave the same as NULL", () => {
        const { screen, raw, mapped } = bothSums(row({}));
        expect(mapped.overhead_pct).toBe(0);
        expect(mapped.profit_pct).toBe(0);
        expect(screen).toBe(10000);
        expect(screen).toBe(raw);
    });

    it("keeps explicit zero as zero", () => {
        const { screen, raw, mapped } = bothSums(row({ overhead_pct: 0, profit_pct: 0 }));
        expect(mapped.overhead_pct).toBe(0);
        expect(mapped.profit_pct).toBe(0);
        expect(screen).toBe(10000);
        expect(screen).toBe(raw);
    });

    it("keeps explicit non-zero mark-ups, including the old 10/15 values", () => {
        const stored = bothSums(row({ overhead_pct: 5, profit_pct: 7 }));
        expect(stored.mapped.overhead_pct).toBe(5);
        expect(stored.mapped.profit_pct).toBe(7);
        expect(stored.screen).toBeCloseTo(10000 * 1.05 * 1.07, 6);
        expect(stored.screen).toBe(stored.raw);

        const tenFifteen = bothSums(row({ overhead_pct: 10, profit_pct: 15 }));
        expect(tenFifteen.mapped.overhead_pct).toBe(10);
        expect(tenFifteen.mapped.profit_pct).toBe(15);
        expect(tenFifteen.screen).toBeCloseTo(12650, 6);
        expect(tenFifteen.screen).toBe(tenFifteen.raw);
    });

    it("only the NULL mark-up becomes 0 when the other is stored", () => {
        const noOverhead = bothSums(row({ overhead_pct: null, profit_pct: 15 }));
        expect(noOverhead.mapped.overhead_pct).toBe(0);
        expect(noOverhead.mapped.profit_pct).toBe(15);
        expect(noOverhead.screen).toBeCloseTo(11500, 6);
        expect(noOverhead.screen).toBe(noOverhead.raw);

        const noProfit = bothSums(row({ overhead_pct: 10, profit_pct: null }));
        expect(noProfit.mapped.overhead_pct).toBe(10);
        expect(noProfit.mapped.profit_pct).toBe(0);
        expect(noProfit.screen).toBeCloseTo(11000, 6);
        expect(noProfit.screen).toBe(noProfit.raw);
    });

    it("passes numeric strings through unchanged and still agrees with the raw path", () => {
        const { screen, raw, mapped } = bothSums(row({ overhead_pct: "12.5", profit_pct: "0" }));
        expect(mapped.overhead_pct).toBe("12.5");
        expect(mapped.profit_pct).toBe("0");
        expect(screen).toBeCloseTo(11250, 6);
        expect(screen).toBe(raw);
    });
});
