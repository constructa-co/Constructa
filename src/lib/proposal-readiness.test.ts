import { describe, expect, it } from "vitest";
import {
    evaluateProposalReadiness,
    getPublishGate,
    isUntouchedStarterProgramme,
    isValidPaymentRow,
    isValidProgrammePhase,
    showsPublishBlockReason,
    type ProposalReadinessInput,
    type ReadinessKey,
} from "./proposal-readiness";

// Synthetic data only.
const complete: ProposalReadinessInput = {
    projectName: "Example Extension",
    clientName: "Alex Client",
    scope: "Dig footings and build a single-storey rear extension.",
    contractSum: 12000,
    programmePhases: [{ name: "Groundworks", calculatedDays: 5, startOffset: 0 }],
    projectStartDate: "2026-11-02",
    paymentSchedule: [{ stage: "Deposit", percentage: 20 }],
    terms: [{ clause_number: 1, title: "Payment", body: "Payment is due within 14 days." }],
};

function missingKeys(input: ProposalReadinessInput): ReadinessKey[] {
    return evaluateProposalReadiness(input).missing.map((item) => item.key);
}

describe("evaluateProposalReadiness", () => {
    it("is ready when every mandatory fact is present", () => {
        const result = evaluateProposalReadiness(complete);
        expect(result.ready).toBe(true);
        expect(result.missing).toEqual([]);
        expect(result.mandatory).toHaveLength(6);
    });

    it("does not let recommended items block readiness", () => {
        const result = evaluateProposalReadiness({
            ...complete,
            hasPhotos: false,
            hasCaseStudies: false,
            exclusions: "",
            clarifications: "",
            closingStatement: "",
        });
        expect(result.ready).toBe(true);
        expect(result.recommended.map((item) => item.key)).toEqual([
            "photos", "caseStudies", "exclusions", "clarifications", "closingStatement",
        ]);
        expect(result.recommended.every((item) => !item.ok)).toBe(true);
    });

    it("marks recommended items as done when supplied", () => {
        const result = evaluateProposalReadiness({
            ...complete,
            hasPhotos: true,
            hasCaseStudies: true,
            exclusions: "Planning fees",
            clarifications: "Working hours 8-5",
            closingStatement: "Thanks for the opportunity.",
        });
        expect(result.recommended.every((item) => item.ok)).toBe(true);
    });

    describe("identity", () => {
        it.each([
            ["job name", { projectName: "  " }, "Add the job name in project details."],
            ["client name", { clientName: null }, "Add the client's name in project details."],
            ["both", { projectName: "", clientName: "" }, "Add the job name and the client's name in project details."],
        ])("fails without %s", (_label, patch, fix) => {
            const result = evaluateProposalReadiness({ ...complete, ...patch });
            expect(result.ready).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0].key).toBe("identity");
            expect(result.missing[0].fix).toBe(fix);
        });
    });

    it("fails on empty or whitespace scope", () => {
        expect(missingKeys({ ...complete, scope: "" })).toEqual(["scope"]);
        expect(missingKeys({ ...complete, scope: " \n " })).toEqual(["scope"]);
        expect(missingKeys({ ...complete, scope: undefined })).toEqual(["scope"]);
    });

    it("fails without a positive contract value", () => {
        expect(missingKeys({ ...complete, contractSum: 0 })).toEqual(["contractValue"]);
        expect(missingKeys({ ...complete, contractSum: -50 })).toEqual(["contractValue"]);
        expect(missingKeys({ ...complete, contractSum: null })).toEqual(["contractValue"]);
        expect(missingKeys({ ...complete, contractSum: Number.NaN })).toEqual(["contractValue"]);
    });

    it("fails without a valid programme phase", () => {
        expect(missingKeys({ ...complete, programmePhases: [] })).toEqual(["programme"]);
        expect(missingKeys({ ...complete, programmePhases: null })).toEqual(["programme"]);
        // Name missing.
        expect(missingKeys({ ...complete, programmePhases: [{ name: " ", calculatedDays: 5 }] })).toEqual(["programme"]);
        // Duration missing or zero.
        expect(missingKeys({ ...complete, programmePhases: [{ name: "Roof", calculatedDays: 0 }] })).toEqual(["programme"]);
        // No start date anywhere.
        expect(missingKeys({ ...complete, projectStartDate: null })).toEqual(["programme"]);
    });

    it("passes when at least one phase is valid among invalid ones", () => {
        expect(missingKeys({
            ...complete,
            programmePhases: [{ name: "", calculatedDays: 5 }, { name: "Roof", manualDays: 3, startOffset: 7 }],
        })).toEqual([]);
    });

    it("fails without a valid payment row", () => {
        expect(missingKeys({ ...complete, paymentSchedule: [] })).toEqual(["payment"]);
        expect(missingKeys({ ...complete, paymentSchedule: [{ stage: "", percentage: 20 }] })).toEqual(["payment"]);
        expect(missingKeys({ ...complete, paymentSchedule: [{ stage: "Deposit", percentage: 0 }] })).toEqual(["payment"]);
    });

    it("fails when no term is showing", () => {
        expect(missingKeys({ ...complete, terms: [] })).toEqual(["terms"]);
        expect(missingKeys({ ...complete, terms: [{ title: "Payment", body: "Due in 14 days.", hidden: true }] })).toEqual(["terms"]);
        expect(missingKeys({ ...complete, terms: [{ title: "Custom", body: "  " }] })).toEqual(["terms"]);
    });

    it("reports every unresolved mandatory item for an empty proposal", () => {
        const result = evaluateProposalReadiness({});
        expect(result.ready).toBe(false);
        expect(result.missing.map((item) => item.key)).toEqual([
            "identity", "scope", "contractValue", "programme", "payment", "terms",
        ]);
        expect(result.missing.every((item) => item.fix.length > 0)).toBe(true);
    });
});

describe("isValidProgrammePhase", () => {
    it("accepts a legacy phase carrying its own start date", () => {
        expect(isValidProgrammePhase({ name: "Structure", start_date: "2026-11-09", duration_days: 21 })).toBe(true);
    });

    it("accepts a Programme-tab phase anchored on the project start date", () => {
        expect(isValidProgrammePhase({ name: "Structure", calculatedDays: 10, startOffset: 14 }, "2026-11-02")).toBe(true);
        expect(isValidProgrammePhase({ name: "Structure", calculatedDays: 10, startOffset: 14 }, null)).toBe(false);
    });

    it("treats a manual duration as the contractor's answer", () => {
        expect(isValidProgrammePhase({ name: "Structure", manualDays: 0, calculatedDays: 10 }, "2026-11-02")).toBe(false);
        expect(isValidProgrammePhase({ name: "Structure", manualDays: 4, calculatedDays: 0 }, "2026-11-02")).toBe(true);
    });

    it("rejects unusable dates, offsets and non-objects", () => {
        expect(isValidProgrammePhase({ name: "Structure", start_date: "not a date", duration_days: 5 })).toBe(false);
        expect(isValidProgrammePhase({ name: "Structure", calculatedDays: 5, startOffset: -7 }, "2026-11-02")).toBe(false);
        expect(isValidProgrammePhase(null, "2026-11-02")).toBe(false);
        expect(isValidProgrammePhase("Structure", "2026-11-02")).toBe(false);
    });
});

describe("isValidPaymentRow", () => {
    it("accepts a named stage with a percentage or an amount", () => {
        expect(isValidPaymentRow({ stage: "Deposit", percentage: 20 })).toBe(true);
        expect(isValidPaymentRow({ stage: "Deposit", percentage: 0, amount: 1500 })).toBe(true);
        expect(isValidPaymentRow({ stage: "Deposit", percentage: "25" })).toBe(true);
    });

    it("rejects unnamed or zero-value rows", () => {
        expect(isValidPaymentRow({ stage: "", percentage: 20 })).toBe(false);
        expect(isValidPaymentRow({ stage: "Deposit" })).toBe(false);
        expect(isValidPaymentRow({ stage: "Deposit", percentage: 0, amount: 0 })).toBe(false);
        expect(isValidPaymentRow(undefined)).toBe(false);
    });
});

describe("getPublishGate", () => {
    const ready = evaluateProposalReadiness(complete);
    const notReady = evaluateProposalReadiness({ ...complete, scope: "", contractSum: 0 });

    it("allows publication when saved and ready", () => {
        expect(getPublishGate({ saveState: "idle", readiness: ready })).toEqual({ blocked: false, reason: null, message: null });
        expect(getPublishGate({ saveState: "saved", readiness: ready }).blocked).toBe(false);
    });

    it("blocks while an autosave or manual save is in flight", () => {
        expect(getPublishGate({ saveState: "saving", readiness: ready }).reason).toBe("saving");
        expect(getPublishGate({ saveState: "idle", saving: true, readiness: ready }).reason).toBe("saving");
    });

    it("blocks after a failed save and tells the contractor to retry", () => {
        const gate = getPublishGate({ saveState: "error", readiness: ready });
        expect(gate.blocked).toBe(true);
        expect(gate.reason).toBe("save-failed");
        expect(gate.message).toContain("Retry save");
    });

    it("keeps a failed save blocking even while a retry is in flight", () => {
        expect(getPublishGate({ saveState: "error", saving: true, readiness: ready }).reason).toBe("save-failed");
    });

    it("blocks while a publication is in flight", () => {
        expect(getPublishGate({ saveState: "idle", publishing: true, readiness: ready }).reason).toBe("publishing");
    });

    it("blocks when mandatory facts are unresolved and counts them", () => {
        const gate = getPublishGate({ saveState: "idle", readiness: notReady });
        expect(gate.reason).toBe("not-ready");
        expect(gate.message).toBe("Finish 2 items above before you send.");
        const one = evaluateProposalReadiness({ ...complete, scope: "" });
        expect(getPublishGate({ saveState: "idle", readiness: one }).message).toBe("Finish 1 item above before you send.");
    });
});

describe("showsPublishBlockReason", () => {
    const ready = evaluateProposalReadiness(complete);
    const notReady = evaluateProposalReadiness({ ...complete, scope: "" });

    it("shows the reason for every block the contractor can act on", () => {
        expect(showsPublishBlockReason(getPublishGate({ saveState: "error", readiness: ready }))).toBe(true);
        expect(showsPublishBlockReason(getPublishGate({ saveState: "saving", readiness: ready }))).toBe(true);
        expect(showsPublishBlockReason(getPublishGate({ saveState: "idle", readiness: notReady }))).toBe(true);
    });

    it("shows nothing while publishing or when clear to send, so no control may reference it", () => {
        expect(showsPublishBlockReason(getPublishGate({ saveState: "idle", publishing: true, readiness: ready }))).toBe(false);
        expect(showsPublishBlockReason(getPublishGate({ saveState: "idle", readiness: ready }))).toBe(false);
    });
});

describe("isUntouchedStarterProgramme", () => {
    const seeds = [
        { name: "Groundworks", duration_days: 14, duration_unit: "Weeks" },
        { name: "Structure", duration_days: 21, duration_unit: "Weeks" },
    ];
    const START = "2026-11-02";
    const seeded = (start: string) => seeds.map((seed, i) => ({ ...seed, id: String(i + 1), color: "blue", start_date: start }));

    it("recognises exact starter content seeded with the project start date", () => {
        expect(isUntouchedStarterProgramme(seeded(START), seeds, START)).toBe(true);
    });

    it("recognises starter content seeded before the project had a start date", () => {
        expect(isUntouchedStarterProgramme(seeded(""), seeds, null)).toBe(true);
        expect(isUntouchedStarterProgramme(seeded(""), seeds, START)).toBe(true);
    });

    it("ignores ids and colours", () => {
        const regenerated = seeded(START).map((phase, i) => ({ ...phase, id: `uuid-${i}`, color: "teal" }));
        expect(isUntouchedStarterProgramme(regenerated, seeds, START)).toBe(true);
    });

    it("treats a changed duration as the contractor's programme", () => {
        const phases = seeded(START);
        phases[1] = { ...phases[1], duration_days: 10 };
        expect(isUntouchedStarterProgramme(phases, seeds, START)).toBe(false);
    });

    it("treats a changed duration unit as the contractor's programme", () => {
        const phases = seeded(START);
        phases[0] = { ...phases[0], duration_unit: "Days" };
        expect(isUntouchedStarterProgramme(phases, seeds, START)).toBe(false);
    });

    it("treats a changed start as the contractor's programme", () => {
        const phases = seeded(START);
        phases[1] = { ...phases[1], start_date: "2026-11-16" };
        expect(isUntouchedStarterProgramme(phases, seeds, START)).toBe(false);
    });

    it("treats a changed name as the contractor's programme", () => {
        const phases = seeded(START);
        phases[0] = { ...phases[0], name: "Dig out and footings" };
        expect(isUntouchedStarterProgramme(phases, seeds, START)).toBe(false);
    });

    it("treats an added or removed phase as the contractor's programme", () => {
        expect(isUntouchedStarterProgramme(seeded(START).slice(0, 1), seeds, START)).toBe(false);
        expect(isUntouchedStarterProgramme([...seeded(START), { name: "Roofing", duration_days: 14, duration_unit: "Weeks", start_date: START }], seeds, START)).toBe(false);
        expect(isUntouchedStarterProgramme([], seeds, START)).toBe(false);
        expect(isUntouchedStarterProgramme(null, seeds, START)).toBe(false);
    });

    it("lets an edited starter list satisfy the programme check, and an untouched one not", () => {
        const edited = seeded(START);
        edited[0] = { ...edited[0], duration_days: 5 };
        const programmeFor = (phases: unknown[]) => evaluateProposalReadiness({
            ...complete,
            programmePhases: isUntouchedStarterProgramme(phases, seeds, START) ? [] : phases,
            projectStartDate: START,
        }).mandatory.find((item) => item.key === "programme")?.ok;
        expect(programmeFor(edited)).toBe(true);
        expect(programmeFor(seeded(START))).toBe(false);
    });
});
