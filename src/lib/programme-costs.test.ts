import { describe, expect, it } from "vitest";
import {
    acknowledgementMatches,
    alignStageInputs,
    computeProgrammeCosts,
    gangFloorUplift,
    hireCost,
    parseProgrammeCostInputs,
    planProgrammeCostApplication,
    programmeCostLineNote,
    programmeCostStatus,
    programmeStagesForCosts,
    readAppliedProgrammeCosts,
    shiftWindows,
    supervisionUnion,
    type HireInput,
    type ProgrammeCostInputs,
    type ProgrammeCostSource,
    type StageShiftInput,
} from "./programme-costs";

// Synthetic programme only. 1 March 2027 is a Monday; Mon–Fri, 8-hour days.
// Groundworks: Mon 1 – Fri 5 March, 40 h  → 1 operative per day already costed.
// Drainage:    Wed 3 – Tue 9 March, 80 h  → 2 operatives per day already costed.
const SOURCE: ProgrammeCostSource = {
    start_date: "2027-03-01",
    region: "England",
    programme_phases: [
        { name: "Groundworks", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 },
        { name: "Drainage", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 2 },
    ],
};

// D121 (v1) stage settings. Every fixture below goes through the parser that
// reads notes of lines applied before D122, so these tests also prove old
// settings still read and price exactly as they did.
type V1Stage = Omit<StageShiftInput, "crewByShift">;
type V1Patch = Partial<Omit<ProgrammeCostInputs, "version" | "stages" | "crews">> & { stages?: V1Stage[] };

const DAY_ONLY: V1Stage[] = [
    { name: "Groundworks", shifts: ["day"], costedOperatives: null },
    { name: "Drainage", shifts: ["day"], costedOperatives: null },
];

function inputs(patch: V1Patch = {}): ProgrammeCostInputs {
    const parsed = parseProgrammeCostInputs({ version: 1, stages: DAY_ONLY, gangFloors: [], supervision: [], hires: [], ...patch });
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    return parsed.inputs;
}

function hire(patch: Partial<HireInput> = {}): HireInput {
    return {
        id: "dumper", description: "3 t dumper", unit: "week", ratePence: 12_000,
        chargeableDays: null, partPeriodRule: "whole_period", minimumPeriods: 1,
        onHire: { kind: "stage_start", stage: 0 }, offHire: { kind: "stage_finish", stage: 1 },
        offHireRule: "call_date_plus_notice", offHireDays: 0, deliveryPence: 0, collectionPence: 0,
        ...patch,
    };
}

function compute(patch: V1Patch = {}, source: ProgrammeCostSource = SOURCE) {
    const outcome = computeProgrammeCosts(source, inputs(patch));
    if (!outcome.ok) throw new Error(outcome.errors.join("; "));
    return outcome.result;
}

describe("programme as working shift-days", () => {
    it("reads the dated stages and their working dates from the saved programme", () => {
        const programme = programmeStagesForCosts(SOURCE);
        expect(programme.ok).toBe(true);
        if (!programme.ok) return;
        expect(programme.stages.map((stage) => [stage.name, stage.startDate, stage.endDate, stage.workingDates.length])).toEqual([
            ["Groundworks", "2027-03-01", "2027-03-05", 5],
            ["Drainage", "2027-03-03", "2027-03-09", 5],
        ]);
        expect(programme.stages[1].workingDates).toEqual(["2027-03-03", "2027-03-04", "2027-03-05", "2027-03-08", "2027-03-09"]);
        expect(programme.hoursPerShift).toBe(8);
    });

    it("refuses an undated, missing or unreadable programme instead of guessing", () => {
        expect(programmeStagesForCosts({ ...SOURCE, start_date: null })).toMatchObject({ ok: false });
        expect(programmeStagesForCosts({ ...SOURCE, programme_phases: [] })).toMatchObject({ ok: false });
        expect(programmeStagesForCosts({ ...SOURCE, programme_phases: "nope" })).toMatchObject({ ok: false });
        expect(programmeStagesForCosts({ ...SOURCE, programme_working_pattern: { version: 9 } })).toMatchObject({ ok: false });
        expect(programmeStagesForCosts({ ...SOURCE, programme_phases: [{ name: "Undated", calculatedDays: 0, manualDays: 0, manhours: 0, startOffset: 0 }] })).toMatchObject({ ok: false });
    });

    it("refuses settings made for a different set of stages, so a programme change is reviewed", () => {
        const renamed = { ...SOURCE, programme_phases: [{ ...(SOURCE.programme_phases as object[])[0], name: "Excavation" }, (SOURCE.programme_phases as object[])[1]] };
        const outcome = computeProgrammeCosts(renamed, inputs());
        expect(outcome.ok).toBe(false);
        expect(alignStageInputs([{ name: "Excavation" }, { name: "Drainage" }], DAY_ONLY)).toEqual([
            { name: "Excavation", shifts: ["day"], costedOperatives: null, crewByShift: { day: null, night: null } },
            { ...DAY_ONLY[1], crewByShift: { day: null, night: null } },
        ]);
    });

    it("never changes a programme date or stage length", () => {
        const before = JSON.stringify(SOURCE);
        compute({ gangFloors: [{ shift: "day", minimumPaidGang: 6, operativeDayRatePence: 25_000 }] });
        expect(JSON.stringify(SOURCE)).toBe(before);
    });
});

describe("minimum paid gang: a cost floor charged once per unique date and shift", () => {
    it("counts overlapping stages once per window and nets off labour already costed", () => {
        const result = compute({ gangFloors: [{ shift: "day", minimumPaidGang: 3, operativeDayRatePence: 25_000 }] });
        const floor = result.gangFloors[0];
        expect(floor.windows.map((window) => [window.date, window.costedOperatives, window.additionalOperatives])).toEqual([
            ["2027-03-01", 1, 2],
            ["2027-03-02", 1, 2],
            ["2027-03-03", 3, 0],
            ["2027-03-04", 3, 0],
            ["2027-03-05", 3, 0],
            ["2027-03-08", 2, 1],
            ["2027-03-09", 2, 1],
        ]);
        // Per-stage flooring would charge (3−1)×5 + (3−2)×5 = 15 operative-days; the union charges 6.
        expect(floor.additionalOperativeDays).toBe(6);
        expect(floor.chargedWindowCount).toBe(4);
        expect(floor.totalPence).toBe(150_000);
        expect(result.lines).toEqual([
            { key: "gang:day", description: "Minimum labour attendance – day shifts", quantity: 1, unit: "sum", unitRatePence: 150_000, totalPence: 150_000 },
        ]);
    });

    it("charges nothing when measured labour already meets the floor or the floor is zero", () => {
        expect(compute({ gangFloors: [{ shift: "day", minimumPaidGang: 1, operativeDayRatePence: 25_000 }] }).lines).toEqual([]);
        expect(compute({ gangFloors: [{ shift: "day", minimumPaidGang: 0, operativeDayRatePence: 25_000 }] }).lines).toEqual([]);
        expect(compute({ gangFloors: [{ shift: "day", minimumPaidGang: 4, operativeDayRatePence: 0 }] }).lines).toEqual([]);
    });

    it("uses the contractor's stated costed operatives over the derived figure", () => {
        const stages: V1Stage[] = [
            { name: "Groundworks", shifts: ["day"], costedOperatives: 3 },
            { name: "Drainage", shifts: ["day"], costedOperatives: 0 },
        ];
        const result = compute({ stages, gangFloors: [{ shift: "day", minimumPaidGang: 3, operativeDayRatePence: 10_000 }] });
        // Mar 8 and 9: only Drainage, costed 0 → 3 each.
        expect(result.gangFloors[0].additionalOperativeDays).toBe(6);
        expect(result.gangFloors[0].totalPence).toBe(60_000);
    });

    it("rounds each window half-up to the penny and totals the rounded windows", () => {
        const source: ProgrammeCostSource = { start_date: "2027-03-01", programme_phases: [{ name: "Fit out", calculatedDays: 3, manualDays: null, manhours: 8, startOffset: 0 }] };
        const result = compute({ stages: [{ name: "Fit out", shifts: ["day"], costedOperatives: null }], gangFloors: [{ shift: "day", minimumPaidGang: 1, operativeDayRatePence: 25_000 }] }, source);
        // 8 h over 3 days = 1/3 operative; 2/3 × £250 = £166.666… → £166.67 per window.
        expect(result.gangFloors[0].windows.map((window) => window.upliftPence)).toEqual([16_667, 16_667, 16_667]);
        expect(result.gangFloors[0].totalPence).toBe(50_001);
        expect(result.lines[0]).toMatchObject({ quantity: 1, unitRatePence: 50_001, totalPence: 50_001 });
    });

    it("prices day and night shifts separately, each at its own rate", () => {
        const stages: V1Stage[] = [
            { name: "Groundworks", shifts: ["day"], costedOperatives: null },
            { name: "Drainage", shifts: ["day", "night"], costedOperatives: null },
        ];
        const result = compute({
            stages,
            gangFloors: [
                { shift: "day", minimumPaidGang: 3, operativeDayRatePence: 25_000 },
                { shift: "night", minimumPaidGang: 2, operativeDayRatePence: 32_000 },
            ],
        });
        // Drainage's 80 h now spread over 10 shift-days: 1 operative per shift.
        const day = result.gangFloors.find((floor) => floor.shift === "day")!;
        const night = result.gangFloors.find((floor) => floor.shift === "night")!;
        expect(day.additionalOperativeDays).toBe(11); // 2+2 (Mar 1–2) + 1+1+1 (Mar 3–5) + 2+2 (Mar 8–9)
        expect(day.totalPence).toBe(275_000);
        expect(night.windows).toHaveLength(5);
        expect(night.additionalOperativeDays).toBe(5);
        expect(night.totalPence).toBe(160_000);
        expect(result.lines.map((line) => line.key)).toEqual(["gang:day", "gang:night"]);
    });
});

describe("supervision: one charge per unique working date and shift", () => {
    it("takes the union of overlapping stages, never one supervisor per stage", () => {
        const result = compute({ supervision: [{ shift: "day", ratePerShiftPence: 18_000 }] });
        expect(result.supervision[0].shiftCount).toBe(7); // per-stage would be 10
        expect(result.lines).toEqual([
            { key: "supervision:day", description: "Site supervision – day shifts", quantity: 7, unit: "shift", unitRatePence: 18_000, totalPence: 126_000 },
        ]);
    });

    it("keeps supervision separate from the gang floor and counts night shifts on their own", () => {
        const stages: V1Stage[] = [
            { name: "Groundworks", shifts: ["day"], costedOperatives: null },
            { name: "Drainage", shifts: ["day", "night"], costedOperatives: null },
        ];
        const result = compute({
            stages,
            gangFloors: [{ shift: "day", minimumPaidGang: 3, operativeDayRatePence: 25_000 }],
            supervision: [{ shift: "day", ratePerShiftPence: 18_000 }, { shift: "night", ratePerShiftPence: 22_000 }],
        });
        expect(result.supervision.map((entry) => [entry.shift, entry.shiftCount, entry.totalPence])).toEqual([["day", 7, 126_000], ["night", 5, 110_000]]);
        expect(result.lines.map((line) => line.key)).toEqual(["gang:day", "supervision:day", "supervision:night"]);
    });

    it("has nothing to supervise when no stage works a shift", () => {
        const programme = programmeStagesForCosts(SOURCE);
        if (!programme.ok) throw new Error(programme.reason);
        const windows = shiftWindows(programme.stages, [{ name: "Groundworks", shifts: [], costedOperatives: null }, { name: "Drainage", shifts: [], costedOperatives: null }], 8);
        expect(windows).toEqual([]);
        expect(supervisionUnion(windows, { shift: "day", ratePerShiftPence: 18_000 })).toMatchObject({ shiftCount: 0, totalPence: 0 });
        expect(gangFloorUplift(windows, { shift: "day", minimumPaidGang: 5, operativeDayRatePence: 25_000 })).toMatchObject({ totalPence: 0 });
    });
});

describe("supplier hire: the supplier's billing basis, minimum hire and off-hire rule", () => {
    const programme = programmeStagesForCosts(SOURCE);
    if (!programme.ok) throw new Error("synthetic programme");
    const { stages, calendar } = programme;
    const priced = (patch: Partial<HireInput>) => hireCost(hire(patch), stages, calendar);

    it("bills whole weeks from on-hire to off-hire and applies the minimum hire", () => {
        // Mon 1 – Tue 9 March: 9 calendar days → 2 weeks.
        expect(priced({})).toMatchObject({ ok: true, result: { calendarDays: 9, periodsFromDates: 2, periods: 2, minimumApplied: false, hirePence: 24_000 } });
        expect(priced({ minimumPeriods: 4 })).toMatchObject({ ok: true, result: { periodsFromDates: 2, periods: 4, minimumApplied: true, hirePence: 48_000 } });
        expect(priced({ unit: "four_week" })).toMatchObject({ ok: true, result: { periods: 1 } });
    });

    it("charges to the off-hire call plus notice, or to collection, as declared", () => {
        const base = { unit: "day" as const, chargeableDays: "calendar" as const, partPeriodRule: null, ratePence: 4_000 };
        expect(priced({ ...base })).toMatchObject({ ok: true, result: { billingEndDate: "2027-03-09", periods: 9 } });
        expect(priced({ ...base, offHireRule: "call_date_plus_notice", offHireDays: 1 })).toMatchObject({ ok: true, result: { billingEndDate: "2027-03-10", periods: 10 } });
        expect(priced({ ...base, offHireRule: "collection_date", offHireDays: 2 })).toMatchObject({ ok: true, result: { billingEndDate: "2027-03-11", periods: 11, hirePence: 44_000 } });
        expect(priced({ ...base, offHireRule: null })).toMatchObject({ ok: false });
    });

    it("does not treat all hire as calendar days: weekday and bank-holiday rules are explicit", () => {
        // Mon 22 March – Fri 2 April 2027 spans Good Friday (26th) and Easter Monday (29th) in England and Wales.
        const easter = { unit: "day" as const, partPeriodRule: null, onHire: { kind: "date" as const, date: "2027-03-22" }, offHire: { kind: "date" as const, date: "2027-04-02" } };
        expect(priced({ ...easter, chargeableDays: "calendar" })).toMatchObject({ ok: true, result: { chargeableDayCount: 12 } });
        expect(priced({ ...easter, chargeableDays: "mon_fri" })).toMatchObject({ ok: true, result: { chargeableDayCount: 10 } });
        expect(priced({ ...easter, chargeableDays: "mon_fri_no_bank_holidays" })).toMatchObject({ ok: true, result: { chargeableDayCount: 8 } });
        expect(priced({ ...easter, chargeableDays: null })).toMatchObject({ ok: false });
    });

    it("bills calendar months from the on-hire date and refuses an ambiguous month end", () => {
        const month = { unit: "month" as const, onHire: { kind: "date" as const, date: "2027-01-15" } };
        expect(priced({ ...month, offHire: { kind: "date", date: "2027-02-14" } })).toMatchObject({ ok: true, result: { periods: 1 } });
        expect(priced({ ...month, offHire: { kind: "date", date: "2027-02-15" } })).toMatchObject({ ok: true, result: { periods: 2 } });
        expect(priced({ unit: "month", onHire: { kind: "date", date: "2027-01-31" }, offHire: { kind: "date", date: "2027-02-20" } })).toMatchObject({ ok: false });
    });

    it("refuses an unsupported or ambiguous basis rather than inventing a price", () => {
        expect(priced({ partPeriodRule: null })).toMatchObject({ ok: false });
        expect(priced({ chargeableDays: "mon_fri" })).toMatchObject({ ok: false });
        expect(priced({ unit: "per_hire", minimumPeriods: 2 })).toMatchObject({ ok: false });
        expect(priced({ onHire: { kind: "stage_start", stage: 1 }, offHire: { kind: "date", date: "2027-03-02" } })).toMatchObject({ ok: false });
        expect(priced({ offHire: { kind: "stage_finish", stage: 7 } })).toMatchObject({ ok: false });
        const outcome = computeProgrammeCosts(SOURCE, { version: 1, stages: DAY_ONLY, gangFloors: [], supervision: [], hires: [hire({ unit: "fortnight" as never })] });
        expect(outcome.ok).toBe(false);
    });

    it("writes delivery and collection as their own line, named without supplier terms", () => {
        const result = compute({ hires: [hire({ minimumPeriods: 4, deliveryPence: 6_500, collectionPence: 6_500 })] });
        expect(result.lines).toEqual([
            { key: "hire:dumper", description: "Plant hire – 3 t dumper", quantity: 4, unit: "week", unitRatePence: 12_000, totalPence: 48_000 },
            { key: "hire:dumper:transport", description: "Delivery and collection – 3 t dumper", quantity: 1, unit: "sum", unitRatePence: 13_000, totalPence: 13_000 },
        ]);
        expect(result.totalPence).toBe(61_000);
    });

    it("charges a per-hire price once", () => {
        expect(priced({ unit: "per_hire", partPeriodRule: null, ratePence: 30_000 })).toMatchObject({ ok: true, result: { periods: 1, hirePence: 30_000 } });
    });
});

describe("applying to the estimate: explicit, acknowledged, never doubled", () => {
    const estimate = { prelims_pct: 10, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0 };
    const labour = { id: "labour", trade_section: "Groundworks", description: "Excavate trench", quantity: 1, unit_rate: 1000, line_total: 1000, notes: null };
    const supervisionInputs = inputs({ supervision: [{ shift: "day", ratePerShiftPence: 18_000 }] });

    function appliedLines(lines: ReturnType<typeof compute>["lines"], signature: string, prefix = "applied", inputsUsed: ProgrammeCostInputs = supervisionInputs) {
        return lines.map((line, index) => ({
            id: `${prefix}-${index}`, trade_section: "Preliminaries", description: line.description,
            quantity: line.quantity, unit: line.unit, unit_rate: line.unitRatePence / 100, line_total: line.quantity * (line.unitRatePence / 100),
            notes: programmeCostLineNote(line, signature, inputsUsed),
        }));
    }

    it("shows the exact before and after price, including the preliminaries percentage that stops applying", () => {
        const result = compute(supervisionInputs);
        const plan = planProgrammeCostApplication(estimate, [labour], result.lines);
        expect(plan).toMatchObject({
            removeLineIds: [],
            beforePence: 110_000, // £1,000 + 10% prelims
            afterPence: 226_000, // £1,000 + £1,260 supervision lines; the 10% no longer applies
            changePence: 116_000,
            prelimsBasisChange: "pct_to_lines",
            prelimsPctPenceDropped: 10_000,
        });
    });

    it("replaces the applied set on re-apply instead of adding a second charge, and keeps every other line", () => {
        const result = compute(supervisionInputs);
        const lines = [labour, ...appliedLines(result.lines, result.signature)];
        const plan = planProgrammeCostApplication(estimate, lines, result.lines);
        expect(plan.removeLineIds).toEqual(["applied-0"]);
        expect(plan.changePence).toBe(0);
        expect(plan.prelimsBasisChange).toBeNull();
    });

    it("flags other preliminaries lines that may already pay for the same thing", () => {
        const manual = { id: "manual", trade_section: "Preliminaries", description: "Supervisor allowance", quantity: 1, unit_rate: 500, line_total: 500, notes: null };
        const plan = planProgrammeCostApplication(estimate, [labour, manual], compute(supervisionInputs).lines);
        expect(plan.possibleDuplicates).toEqual(["Supervisor allowance"]);
        expect(plan.prelimsBasisChange).toBeNull();
    });

    it("says when removing every programme cost hands preliminaries back to the percentage", () => {
        const result = compute(supervisionInputs);
        const plan = planProgrammeCostApplication(estimate, [labour, ...appliedLines(result.lines, result.signature)], []);
        expect(plan).toMatchObject({ prelimsBasisChange: "lines_to_pct", beforePence: 226_000, afterPence: 110_000 });
    });

    it("ties the acknowledgement to the figures seen: a programme change after review is refused", () => {
        const reviewed = compute(supervisionInputs);
        const plan = planProgrammeCostApplication(estimate, [labour], reviewed.lines);
        const ack = { signature: reviewed.signature, beforePence: plan.beforePence, afterPence: plan.afterPence };
        expect(acknowledgementMatches(ack, reviewed.signature, plan)).toBe(true);

        const longer = { ...SOURCE, programme_phases: [(SOURCE.programme_phases as object[])[0], { ...(SOURCE.programme_phases as object[])[1], calculatedDays: 8 }] };
        const now = computeProgrammeCosts(longer, supervisionInputs);
        if (!now.ok) throw new Error(now.errors.join());
        const replan = planProgrammeCostApplication(estimate, [labour], now.result.lines);
        expect(now.result.signature).not.toBe(reviewed.signature);
        expect(acknowledgementMatches(ack, now.result.signature, replan)).toBe(false);
    });

    it("reports pending review when the programme changes, without touching the applied lines", () => {
        const result = compute(supervisionInputs);
        const lines = [labour, ...appliedLines(result.lines, result.signature)];
        const applied = readAppliedProgrammeCosts(lines);
        expect(applied).toMatchObject({ lineIds: ["applied-0"], signature: result.signature, consistent: true });
        expect(applied.inputs).toEqual(supervisionInputs);
        expect(programmeCostStatus(applied, result.signature)).toBe("up_to_date");
        expect(programmeCostStatus(applied, "00000000")).toBe("review");
        expect(programmeCostStatus(applied, null)).toBe("review");
        expect(programmeCostStatus(readAppliedProgrammeCosts([labour]), result.signature)).toBe("not_applied");
    });

    it("reads the amounts actually saved: an edited or deleted applied line is never reported as up to date", () => {
        const both = inputs({ gangFloors: [{ shift: "day", minimumPaidGang: 3, operativeDayRatePence: 25_000 }], supervision: [{ shift: "day", ratePerShiftPence: 18_000 }] });
        const outcome = computeProgrammeCosts(SOURCE, both);
        if (!outcome.ok) throw new Error(outcome.errors.join());
        const saved = [labour, ...appliedLines(outcome.result.lines, outcome.result.signature, "applied", both)];
        const current = outcome.result.signature;
        expect(programmeCostStatus(readAppliedProgrammeCosts(saved), current)).toBe("up_to_date");
        // Stored order does not matter.
        expect(programmeCostStatus(readAppliedProgrammeCosts([...saved].reverse()), current)).toBe("up_to_date");

        // The contractor changes the supervision line's quantity in the estimate; its note still carries the old signature.
        const edited = saved.map((line) => (line.id === "applied-1" ? { ...line, quantity: 5, line_total: 900 } : line));
        const editedRead = readAppliedProgrammeCosts(edited);
        expect(editedRead).toMatchObject({ edited: true, appliedSignature: current, consistent: true });
        expect(programmeCostStatus(editedRead, current)).toBe("review");

        // The contractor deletes one applied line; the settings survive on the other.
        const deleted = saved.filter((line) => line.id !== "applied-0");
        const deletedRead = readAppliedProgrammeCosts(deleted);
        expect(deletedRead).toMatchObject({ edited: true, lineIds: ["applied-1"], inputs: both });
        expect(programmeCostStatus(deletedRead, current)).toBe("review");

        // A description change counts too, and the edited price itself is what the estimate keeps.
        const renamed = saved.map((line) => (line.id === "applied-0" ? { ...line, description: "Labour attendance" } : line));
        expect(programmeCostStatus(readAppliedProgrammeCosts(renamed), current)).toBe("review");
        expect(planProgrammeCostApplication(estimate, edited, outcome.result.lines).beforePence).toBe(100_000 + 150_000 + 90_000);
    });

    it("treats two applied sets as inconsistent rather than silently charging both", () => {
        const result = compute(supervisionInputs);
        const lines = [...appliedLines(result.lines, result.signature, "a"), ...appliedLines(result.lines, "ffffffff", "b")];
        const applied = readAppliedProgrammeCosts(lines);
        expect(applied.consistent).toBe(false);
        expect(programmeCostStatus(applied, result.signature)).toBe("inconsistent");
        // Applying still replaces both sets.
        expect(planProgrammeCostApplication(estimate, lines, result.lines).removeLineIds).toEqual(["a-0", "b-0"]);
    });

    it("ignores ordinary notes and malformed tags", () => {
        const lines = [
            { id: "1", notes: "Customer asked for weekend working", trade_section: "General" },
            { id: "2", notes: '{"constructaProgrammeCost":1,"key":', trade_section: "Preliminaries" },
        ];
        expect(readAppliedProgrammeCosts(lines)).toMatchObject({ lineIds: [], consistent: true });
    });
});
