import { describe, it, expect } from "vitest";
import {
    CONTRACTS_CONFIG,
    addDays,
    obligationRag,
    type ContractType,
} from "./contracts-config";

describe("addDays", () => {
    it("adds positive days", () => {
        expect(addDays("2026-04-01", 7)).toBe("2026-04-08");
    });

    it("adds negative days (subtracts)", () => {
        expect(addDays("2026-04-01", -1)).toBe("2026-03-31");
    });

    it("NEC4 8-week time bar math (cl. 61.3)", () => {
        // 8 weeks = 56 days. This is the career-saving calculation.
        expect(addDays("2026-04-01", 56)).toBe("2026-05-27");
    });

    it("FIDIC 28-day time bar math (cl. 20.1)", () => {
        expect(addDays("2026-04-01", 28)).toBe("2026-04-29");
    });

    it("FIDIC 42-day detailed claim (cl. 20.1 second paragraph)", () => {
        expect(addDays("2026-04-01", 42)).toBe("2026-05-13");
    });
});

describe("CONTRACTS_CONFIG — time bar invariants", () => {
    // The career-saving feature. Any regression here silently loses a
    // contractor tens of thousands of pounds.

    it("NEC4 ECC compensation event has 8-week (56 day) contractor time bar", () => {
        const ceEvent = CONTRACTS_CONFIG.NEC4_ECC.events.compensation_event;
        expect(ceEvent.contractorTimeBarDays).toBe(56);
        expect(ceEvent.timeBarClause).toBe("61.3");
    });

    it("NEC3 ECC compensation event has 8-week (56 day) contractor time bar", () => {
        const ceEvent = CONTRACTS_CONFIG.NEC3_ECC.events.compensation_event;
        expect(ceEvent.contractorTimeBarDays).toBe(56);
    });

    it("FIDIC Red 1999 claim has 28-day contractor time bar", () => {
        const claimEvent = CONTRACTS_CONFIG.FIDIC_RED_1999.events.claim;
        expect(claimEvent.contractorTimeBarDays).toBe(28);
    });

    it("FIDIC Red 2017 inherits 28-day bar (spread from 1999)", () => {
        const claimEvent = CONTRACTS_CONFIG.FIDIC_RED_2017.events.claim;
        expect(claimEvent.contractorTimeBarDays).toBe(28);
    });

    it("FIDIC Yellow 2017 inherits 28-day bar from Red 2017", () => {
        const claimEvent = CONTRACTS_CONFIG.FIDIC_YELLOW_2017.events.claim;
        expect(claimEvent.contractorTimeBarDays).toBe(28);
    });

    it("JCT SBC variation has no hard contractor bar (use reasonable time)", () => {
        // JCT does not impose a strict time-bar on variation notifications
        // — 'reasonable time' applies. Encoded as null so the engine
        // doesn't compute a spurious deadline.
        const ev = CONTRACTS_CONFIG.JCT_SBC.events.variation;
        expect(ev.contractorTimeBarDays).toBe(null);
    });

    it("FIDIC 1999 claim chain includes 42-day detailed claim anchored to dateAware", () => {
        // P1-2: the detailed-claim step is measured from dateAware, not
        // dateRaised, so a contractor who raises late doesn't see their
        // deadline drift. Explicit fromAware flag on the step.
        const chain = CONTRACTS_CONFIG.FIDIC_RED_1999.events.claim.chain;
        const detailed = chain.find(s => s.step === "contractor_submits_detailed_claim");
        expect(detailed).toBeDefined();
        expect(detailed?.daysFromPrevious).toBe(42);
        expect(detailed?.fromAware).toBe(true);
    });
});

describe("CONTRACTS_CONFIG — aiGuidance coverage", () => {
    // Every high-value event (one that triggers a time bar or a
    // contractual obligation the contractor might miss) should have
    // clause-specific AI drafting guidance so the notice engine
    // produces a contract-compliant draft rather than generic prose.
    const criticalEvents: Array<[ContractType, string]> = [
        ["NEC4_ECC", "compensation_event"],
        ["NEC4_ECC", "early_warning"],
        ["NEC3_ECC", "compensation_event"],
        ["JCT_SBC", "variation"],
        ["JCT_SBC", "extension_of_time"],
        ["JCT_SBC", "loss_and_expense"],
        ["FIDIC_RED_1999", "claim"],
        ["FIDIC_RED_1999", "engineer_instruction"],
        ["FIDIC_RED_2017", "claim"],
        ["FIDIC_RED_2017", "engineer_instruction"],
    ];

    for (const [type, eventKey] of criticalEvents) {
        it(`${type} · ${eventKey} has aiGuidance`, () => {
            const ev = CONTRACTS_CONFIG[type].events[eventKey];
            expect(ev).toBeDefined();
            expect(ev.aiGuidance).toBeTruthy();
            expect(ev.aiGuidance!.length).toBeGreaterThan(100); // substantive prose, not a placeholder
        });
    }
});

describe("obligationRag", () => {
    // Relative to today, so use a date well in the future / past.
    const future = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    };

    it("completed obligations → done (regardless of due date)", () => {
        expect(obligationRag(future(-30), "complete")).toBe("done");
        expect(obligationRag(future(30), "complete")).toBe("done");
    });

    it("overdue → red", () => {
        expect(obligationRag(future(-1), "pending")).toBe("red");
        expect(obligationRag(future(-14), "pending")).toBe("red");
    });

    it("within the 7-day warning window → amber", () => {
        expect(obligationRag(future(3), "pending")).toBe("amber");
        expect(obligationRag(future(7), "pending")).toBe("amber");
        expect(obligationRag(future(0), "pending")).toBe("amber"); // due today
    });

    it("more than 7 days out → green", () => {
        expect(obligationRag(future(14), "pending")).toBe("green");
        expect(obligationRag(future(60), "pending")).toBe("green");
    });
});
