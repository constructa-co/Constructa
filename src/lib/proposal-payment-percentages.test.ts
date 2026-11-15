import { describe, expect, it } from "vitest";
import {
    paymentStagesMeetHundredPercent,
    sumPaymentStagePercentages,
    validatePercentagePaymentStagesForPersist,
} from "./proposal-payment-percentages";

describe("proposal payment percentage totals", () => {
    it("rounds staged percentages the same way pricing and proposal saves do", () => {
        expect(sumPaymentStagePercentages([{ percentage: 33.33 }, { percentage: 33.33 }, { percentage: 33.34 }])).toBe(100);
    });

    it.each([
        [[] as Array<{ percentage: number }>, true],
        [[{ percentage: 100 }], true],
        [[{ percentage: 40 }, { percentage: 60 }], true],
        [[{ percentage: 40 }], false],
        [[{ percentage: 60 }, { percentage: 50 }], false],
    ])("persist validation for %j expects complete totals only when non-empty", (rows, ok) => {
        const result = validatePercentagePaymentStagesForPersist(rows);
        expect(result.ok).toBe(ok);
        if (!ok && rows.length > 0 && sumPaymentStagePercentages(rows) < 100) {
            expect(result).toMatchObject({ error: expect.stringMatching(/100%/) });
        }
    });

    it("treats tolerance band as exactly 100%", () => {
        expect(paymentStagesMeetHundredPercent(99.995)).toBe(true);
        expect(paymentStagesMeetHundredPercent(99.98)).toBe(false);
    });
});