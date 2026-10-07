import { describe, expect, it } from "vitest";
import { addedClaims, plainTextProblem } from "./guard";

const SOURCES = ["Smith Builders", "Kitchen and bathroom fitting", "Leeds and about 20 miles around", "2017", "We tidy up every day"];
const FAITHFUL = "Smith Builders fits kitchens and bathrooms in Leeds and about 20 miles around. The business has been trading since 2017.\n\nWe tidy up every day.";

describe("addedClaims", () => {
    it("lets through wording that only restates the sources", () => {
        expect(addedClaims(FAITHFUL, SOURCES)).toEqual([]);
    });

    it.each([
        ["a number", "Smith Builders has completed over 500 kitchens in Leeds.", "adds a number: 500"],
        ["a year", "Trading since 2009, Smith Builders fits kitchens.", "adds a number: 2009"],
        ["a duration", "With 25 years of experience we fit kitchens.", "adds a number: 25"],
        ["a membership", "Smith Builders is Gas Safe registered and fits kitchens.", "adds a claim: gas safe, registered"],
        ["an accreditation", "We are a NICEIC approved contractor.", "adds a claim: niceic, approved"],
        ["an award", "Our award-winning team fits kitchens.", "adds a claim: award"],
        ["a guarantee", "All our work is guaranteed.", "adds a claim: guarantee, guaranteed"],
        ["insurance", "We are fully insured.", "adds a claim: insured"],
        ["a ranking", "The leading kitchen fitter in Leeds.", "adds a claim: leading"],
        ["a testimonial", "Customers say “the best fitters we have used”.", "contains quoted speech"],
        ["a link", "See www.smithbuilders.co.uk for more.", "contains markup, a link or an email address"],
        ["markup", "**Smith Builders** fits kitchens.", "contains markup, a link or an email address"],
        ["a list", "- Kitchens\n- Bathrooms", "contains markup, a link or an email address"],
    ])("flags %s", (_name, output, reason) => {
        expect(addedClaims(output, SOURCES)).toContain(reason);
    });

    it("does not flag a claim or number the contractor made themselves", () => {
        const own = [...SOURCES, "Gas Safe registered, 25 years in the trade, fully insured"];
        expect(addedClaims("Smith Builders is Gas Safe registered, with 25 years in the trade, and is fully insured.", own)).toEqual([]);
    });

    it("flags empty and over-long replies", () => {
        expect(addedClaims("   ", SOURCES)).toContain("is empty");
        expect(addedClaims(Array(230).fill("kitchen").join(" "), SOURCES)).toContain("is too long");
        expect(addedClaims("kitchen ".repeat(10), SOURCES, { maxWords: 5 })).toContain("is too long");
    });

    it("is a tripwire, not a fact check: a false statement with no flagged term passes", () => {
        // Nothing here can know whether this is true. Only the contractor's approval covers that.
        expect(addedClaims("Smith Builders also builds houses across Yorkshire.", SOURCES)).toEqual([]);
    });
});

describe("plainTextProblem", () => {
    it("accepts ordinary text with line breaks, whatever it claims", () => {
        expect(plainTextProblem("We fit kitchens.\n\nGas Safe registered since 2009.", 2000)).toBeNull();
    });

    it("refuses empty, over-long and non-plain text", () => {
        expect(plainTextProblem("   ", 2000)).toContain("Write something");
        expect(plainTextProblem("x".repeat(2001), 2000)).toContain("too long");
        expect(plainTextProblem("We are <b>great</b>", 2000)).toContain("plain text");
        expect(plainTextProblem("bell\u0007", 2000)).toContain("plain text");
    });
});
