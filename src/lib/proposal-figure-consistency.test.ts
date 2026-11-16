import { describe, expect, it } from "vitest";
import { evaluateProposalFigureConsistency } from "./proposal-figure-consistency";

const base = {
    contractSumExVat: 7552.05,
    contractSumIncVat: 9062.46,
    paymentAmounts: [2718.74],
    wordingFields: ["Thank you for asking us to quote."],
    briefText: "Refit the bathroom on a fixed price basis.",
};

describe("CON-017 proposal and brief figure consistency", () => {
    it("returns no warnings when wording matches inc-VAT or ex-VAT totals", () => {
        const warnings = evaluateProposalFigureConsistency({
            ...base,
            wordingFields: ["The price is £9,062.46 including VAT."],
        });
        expect(warnings).toEqual([]);
    });

    it("warns when the introduction states a different £ figure", () => {
        const warnings = evaluateProposalFigureConsistency({
            ...base,
            wordingFields: ["We agreed £6,500 with the client for this work."],
        });
        expect(warnings).toHaveLength(1);
        expect(warnings[0].figure).toBe("£6,500.00");
        expect(warnings[0].message).toMatch(/does not match the price here/);
    });

    it("scans the saved brief scope as well as proposal wording", () => {
        const warnings = evaluateProposalFigureConsistency({
            ...base,
            briefText: "Client budget is £4,000 for a full refit.",
        });
        expect(warnings[0].amount).toBe(4000);
    });

    it("treats payment stage amounts as authoritative", () => {
        const warnings = evaluateProposalFigureConsistency({
            ...base,
            wordingFields: ["Deposit of £2,718.74 on acceptance."],
        });
        expect(warnings).toEqual([]);
    });
});