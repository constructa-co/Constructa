import { describe, expect, it } from "vitest";
import type { AnswerMap } from "./questions";
import { answersUsed, buildFacts, buildIntroduction } from "./template";

const a = (answer: string, revision = 1) => ({ answer, skipped: false, revision });
const NOW = 2026;
const PROFILE = { company_name: "Smith Builders", years_trading: null, accreditations: null, insurance_details: null };

const FULL: AnswerMap = {
    work: a("Kitchen and bathroom fitting, tiling and small extensions."),
    business_started: a("2017"),
    career_experience: a("22 years, starting as an apprentice joiner"),
    area: a("Leeds and about 20 miles around"),
    customers: a("Homeowners and a few local landlords"),
    strengths: a("We tidy up at the end of every day and turn up when we say we will", 3),
    memberships: a("Gas Safe registered. City & Guilds Level 3 in plumbing"),
    insurance: a("Public liability £2 million. Employers' liability"),
};

describe("buildIntroduction", () => {
    it("makes two short paragraphs out of the contractor's own answers and nothing else", () => {
        const draft = buildIntroduction(FULL, PROFILE, NOW)!;
        expect(draft.text).toBe(
            "Smith Builders specialises in kitchen and bathroom fitting, tiling and small extensions. We cover Leeds and about 20 miles around. "
            + "We mainly work for homeowners and a few local landlords. The business has been trading since 2017. "
            + "Experience in the trade: 22 years, starting as an apprentice joiner.\n\n"
            + "How we work: we tidy up at the end of every day and turn up when we say we will.",
        );
        expect(answersUsed(draft.basedOn)).toEqual(["work", "business_started", "career_experience", "area", "customers", "strengths"]);
        expect(draft.basedOn).toContainEqual({ kind: "answer", key: "strengths", revision: 3 });
        expect(draft.basedOn).toContainEqual({ kind: "profile", field: "company_name" });
    });

    it("gives the same text every time", () => {
        expect(buildIntroduction(FULL, PROFILE, NOW)).toEqual(buildIntroduction(FULL, PROFILE, NOW));
    });

    it("keeps how long the business has traded apart from how long the person has been in the trade", () => {
        // Twenty-two years in the trade, business started three years ago.
        const draft = buildIntroduction({ work: a("Roofing"), business_started: a("2023"), career_experience: a("22 years") }, PROFILE, NOW)!;
        expect(draft.text).toContain("The business has been trading since 2023.");
        expect(draft.text).toContain("Experience in the trade: 22 years.");
        expect(draft.text).not.toMatch(/trading (for|since) 22|22 years of trading|since 2004/);

        // Only personal experience given: the business's age is not stated at all.
        const careerOnly = buildIntroduction({ work: a("Roofing"), career_experience: a("22 years") }, PROFILE, NOW)!;
        expect(careerOnly.text).not.toMatch(/trading|since|established/i);
        expect(buildFacts({ career_experience: a("22 years") }, PROFILE, NOW)).toEqual([]);
    });

    it("never narrates memberships or insurance, which are facts with their own approval", () => {
        const draft = buildIntroduction(FULL, PROFILE, NOW)!;
        expect(draft.text).not.toMatch(/Gas Safe|City & Guilds|liability|insur/i);
        expect(answersUsed(draft.basedOn)).not.toContain("memberships");
    });

    it("leaves out whatever was skipped or not answered, and says nothing when there is nothing", () => {
        const draft = buildIntroduction({ work: a("Roofing"), area: { answer: "Leeds", skipped: true, revision: 2 }, customers: a("   ") }, PROFILE, NOW)!;
        expect(draft.text).toBe("Smith Builders specialises in roofing.");
        expect(buildIntroduction({}, PROFILE, NOW)).toBeNull();
        expect(buildIntroduction({ memberships: a("Gas Safe registered") }, PROFILE, NOW)).toBeNull();
        expect(buildIntroduction({ business_started: a("not a year") }, PROFILE, NOW)).toBeNull();
    });

    it("works without a saved business name, and leaves acronyms and names as typed", () => {
        expect(buildIntroduction({ work: a("uPVC windows and M&E fit-outs") }, { company_name: " " }, NOW)!.text).toBe("We specialise in uPVC windows and M&E fit-outs.");
        expect(buildIntroduction({ work: a("M&E") }, null, NOW)!.text).toBe("We specialise in M&E.");
    });
});

describe("buildFacts", () => {
    it("offers memberships and insurance in the contractor's exact words, as separate facts", () => {
        const facts = buildFacts(FULL, PROFILE, NOW);
        expect(facts.map((fact) => [fact.field, fact.proposed, fact.questionKey, fact.status])).toEqual([
            ["years_trading", "9", "business_started", "pending"],
            ["accreditations", "Gas Safe registered. City & Guilds Level 3 in plumbing", "memberships", "pending"],
            ["insurance_details", "Public liability £2 million. Employers' liability", "insurance", "pending"],
        ]);
    });

    it("invents nothing: no answer, no fact", () => {
        expect(buildFacts({ work: a("Gas boiler installs for homeowners, fully insured") }, PROFILE, NOW)).toEqual([]);
        expect(buildFacts({ memberships: { answer: "Gas Safe", skipped: true, revision: 2 } }, PROFILE, NOW)).toEqual([]);
    });

    it("works out years trading only from the year the business started, and not for a business under a year old", () => {
        expect(buildFacts({ business_started: a("2026") }, PROFILE, NOW)).toEqual([]);
        expect(buildFacts({ business_started: a("2025") }, PROFILE, NOW)[0]).toMatchObject({ field: "years_trading", proposed: "1" });
        expect(buildFacts({ business_started: a("2017"), career_experience: a("30 years") }, PROFILE, NOW)[0].proposed).toBe("9");
    });

    it("shows what is saved now and notices when it already matches", () => {
        const facts = buildFacts(FULL, { ...PROFILE, years_trading: 9, accreditations: "NICEIC", insurance_details: " public liability £2 million.  employers' liability " }, NOW);
        expect(facts.map((fact) => [fact.field, fact.existing, fact.status])).toEqual([
            ["years_trading", "9", "same"],
            ["accreditations", "NICEIC", "pending"],
            ["insurance_details", " public liability £2 million.  employers' liability ", "same"],
        ]);
    });
});
