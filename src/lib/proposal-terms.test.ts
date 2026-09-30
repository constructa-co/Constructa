import { describe, expect, it } from "vitest";
import {
    PROPOSAL_TERMS_PROFILE_VERSION,
    resolveProposalTerms,
    STANDARD_PROPOSAL_TERMS,
    STANDARD_PROPOSAL_TERMS_MAX_CLAUSE,
} from "./proposal-terms";

describe("canonical proposal terms", () => {
    it("provides one versioned twelve-clause default across editor, onboarding and PDF", () => {
        expect(PROPOSAL_TERMS_PROFILE_VERSION).toBe("phase1-standard-v1");
        expect(STANDARD_PROPOSAL_TERMS).toHaveLength(12);
        expect(STANDARD_PROPOSAL_TERMS_MAX_CLAUSE).toBe(12);
        expect(resolveProposalTerms(null)).toEqual(STANDARD_PROPOSAL_TERMS);
    });

    it("copies custom terms and removes clauses the contractor hid", () => {
        const resolved = resolveProposalTerms([
            { clause_number: 1, title: "Shown", body: "Included" },
            { clause_number: 2, title: "Hidden", body: "Excluded", hidden: true },
        ]);

        expect(resolved).toEqual([{ clause_number: 1, title: "Shown", body: "Included" }]);
        resolved[0].title = "Changed";
        expect(STANDARD_PROPOSAL_TERMS[0].title).toBe("Jurisdiction");
    });
});
