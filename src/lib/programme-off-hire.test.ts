import { describe, expect, it } from "vitest";
import {
    computeProgrammeCosts,
    hireDatesForNote,
    parseProgrammeCostInputs,
    programmeCostLineNote,
    programmeStagesForCosts,
    readAppliedHires,
    type HireInput,
    type ProgrammeCostInputs,
    type ProgrammeCostSource,
} from "./programme-costs";
import { offHireNeedsReview, offHireSchedule } from "./programme-off-hire";

// Synthetic programme only. Groundworks Mon 1 – Fri 5 March 2027; Drainage Wed 3 – Tue 9 March 2027.
const SOURCE: ProgrammeCostSource = {
    start_date: "2027-03-01",
    region: "England",
    programme_phases: [
        { name: "Groundworks", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 },
        { name: "Drainage", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 2 },
    ],
};
const LONGER_DRAINAGE: ProgrammeCostSource = {
    ...SOURCE,
    programme_phases: [(SOURCE.programme_phases as object[])[0], { ...(SOURCE.programme_phases as object[])[1], calculatedDays: 8 }],
};

function hire(patch: Partial<HireInput> = {}): HireInput {
    return {
        id: "dumper", description: "3 t dumper", unit: "week", ratePence: 12_000,
        chargeableDays: null, partPeriodRule: "whole_period", minimumPeriods: 1,
        onHire: { kind: "stage_start", stage: 0, stageName: "Groundworks" }, offHire: { kind: "stage_finish", stage: 1, stageName: "Drainage" },
        offHireRule: "call_date_plus_notice", offHireDays: 2, deliveryPence: 0, collectionPence: 0,
        ...patch,
    };
}

function inputs(hires: HireInput[]): ProgrammeCostInputs {
    const parsed = parseProgrammeCostInputs({
        version: 2,
        stages: ["Groundworks", "Drainage"].map((name) => ({ name, shifts: ["day"], costedOperatives: null, crewByShift: { day: null, night: null } })),
        gangFloors: [], supervision: [], hires, crews: [],
    });
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    return parsed.inputs;
}

function schedule(hires: HireInput[], source: ProgrammeCostSource = SOURCE, applied?: ReturnType<typeof readAppliedHires>) {
    const result = offHireSchedule(programmeStagesForCosts(source), inputs(hires), applied);
    if (!result.ok) throw new Error(result.reason);
    return result.rows;
}

/** Hire lines as the apply action writes them, from the programme as it was then. */
function appliedFrom(source: ProgrammeCostSource, hires: HireInput[]) {
    const outcome = computeProgrammeCosts(source, inputs(hires));
    if (!outcome.ok) throw new Error(outcome.errors.join());
    return outcome.result.lines.map((line, index) => {
        const result = outcome.result.hires.find((entry) => line.key.startsWith(`hire:${entry.id}`));
        return {
            id: `line-${index}`, quantity: line.quantity, unit: line.unit,
            notes: programmeCostLineNote(line, outcome.result.signature, outcome.inputs, result ? hireDatesForNote(result) : undefined),
        };
    });
}

describe("off-hire dates from the saved programme", () => {
    it("shows on hire, planned off-hire and the supplier's charged-to date separately", () => {
        const [row] = schedule([hire()]);
        expect(row).toMatchObject({
            status: "planned",
            onHireDate: "2027-03-01", onHireSource: { kind: "stage", stageName: "Groundworks" },
            plannedOffHireDate: "2027-03-09", offHireSource: { kind: "stage", stageName: "Drainage" },
            // Off-hire call on 9 March plus 2 days' notice: charged to 11 March, 11 calendar days, 2 weeks.
            chargedToDate: "2027-03-11", calendarDays: 11, periodsFromDates: 2, periods: 2, minimumApplied: false,
            offHireRule: "call_date_plus_notice", offHireDays: 2, applied: null, moved: null,
        });
    });

    it("keeps the notice and collection rules distinct, and applies the minimum hire after them", () => {
        const [call, collection, minimum] = schedule([
            hire({ id: "call", offHireDays: 0 }),
            hire({ id: "collect", offHireRule: "collection_date", offHireDays: 3 }),
            hire({ id: "minimum", minimumPeriods: 4 }),
        ]);
        expect([call.plannedOffHireDate, call.chargedToDate, call.periods]).toEqual(["2027-03-09", "2027-03-09", 2]);
        expect([collection.plannedOffHireDate, collection.chargedToDate, collection.periods]).toEqual(["2027-03-09", "2027-03-12", 2]);
        expect(minimum).toMatchObject({ periodsFromDates: 2, periods: 4, minimumApplied: true });
    });

    it("counts day hire on the supplier's chargeable days across Easter 2027", () => {
        const [row] = schedule([hire({
            unit: "day", chargeableDays: "mon_fri_no_bank_holidays", partPeriodRule: null, offHireDays: 0,
            onHire: { kind: "date", date: "2027-03-24" }, offHire: { kind: "date", date: "2027-04-02" },
        })]);
        // Wed 24 Mar – Fri 2 Apr: 10 calendar days, without the weekend, Good Friday and Easter Monday.
        expect(row).toMatchObject({ calendarDays: 10, chargeableDayCount: 6, periods: 6, onHireSource: { kind: "date" }, offHireSource: { kind: "date" } });
    });

    it("moves stage-linked dates when the programme changes and shows how far, against what was applied", () => {
        const hires = [hire({ minimumPeriods: 1 })];
        const applied = readAppliedHires(appliedFrom(SOURCE, hires));
        expect(applied.get("dumper")).toEqual({ dates: { onHire: "2027-03-01", offHire: "2027-03-09", chargedTo: "2027-03-11" }, savedPeriods: 2 });

        const unchanged = schedule(hires, SOURCE, applied);
        expect(unchanged[0].moved).toEqual({ onHire: 0, plannedOffHire: 0, chargedTo: 0 });
        expect(offHireNeedsReview(unchanged)).toBe(false);

        // Drainage now runs Wed 3 – Fri 12 March.
        const [row] = schedule(hires, LONGER_DRAINAGE, applied);
        expect(row).toMatchObject({ onHireDate: "2027-03-01", plannedOffHireDate: "2027-03-12", chargedToDate: "2027-03-14", periods: 2 });
        expect(row.moved).toEqual({ onHire: 0, plannedOffHire: 3, chargedTo: 3 });
        expect(offHireNeedsReview([row])).toBe(true);
    });

    it("flags a change in billed periods even for lines applied before dates were recorded", () => {
        // A D121 line: note without hire dates; saved quantity 2 weeks.
        const outcome = computeProgrammeCosts(SOURCE, inputs([hire()]));
        if (!outcome.ok) throw new Error(outcome.errors.join());
        const line = outcome.result.lines[0];
        const applied = readAppliedHires([{ id: "old", quantity: 2, notes: programmeCostLineNote(line, outcome.result.signature, outcome.inputs) }]);
        expect(applied.get("dumper")).toEqual({ dates: null, savedPeriods: 2 });
        const longer: ProgrammeCostSource = { ...SOURCE, programme_phases: [(SOURCE.programme_phases as object[])[0], { ...(SOURCE.programme_phases as object[])[1], calculatedDays: 12 }] };
        const [row] = schedule([hire()], longer, applied);
        expect(row.moved).toBeNull();
        expect(row.periods).toBe(3);
        expect(offHireNeedsReview([row])).toBe(true);
    });

    it("does not move a hire on fixed dates when the programme changes", () => {
        const fixed = hire({ onHire: { kind: "date", date: "2027-03-01" }, offHire: { kind: "date", date: "2027-03-09" } });
        expect(schedule([fixed], LONGER_DRAINAGE)[0]).toMatchObject({ plannedOffHireDate: "2027-03-09", chargedToDate: "2027-03-11" });
    });
});

describe("off-hire refusals are visible per hire, never guessed", () => {
    it("refuses a hire whose stage was renamed, while other hires are still worked out", () => {
        const renamed: ProgrammeCostSource = { ...SOURCE, programme_phases: [(SOURCE.programme_phases as object[])[0], { ...(SOURCE.programme_phases as object[])[1], name: "Drain runs" }] };
        const result = offHireSchedule(programmeStagesForCosts(renamed), inputs([hire(), hire({ id: "fixed", onHire: { kind: "date", date: "2027-03-01" }, offHire: { kind: "date", date: "2027-03-05" } })]));
        if (!result.ok) throw new Error(result.reason);
        expect(result.rows[0]).toMatchObject({ status: "refused", plannedOffHireDate: null, offHireSource: null });
        expect(result.rows[0].reason).toMatch(/renamed or moved/);
        expect(result.rows[1]).toMatchObject({ status: "planned", chargedToDate: "2027-03-07" });
    });

    it("refuses a D121 hire (no stage names) once the stages have changed", () => {
        const v1Hire = hire({ onHire: { kind: "stage_start", stage: 0 }, offHire: { kind: "stage_finish", stage: 1 } });
        const renamed: ProgrammeCostSource = { ...SOURCE, programme_phases: [{ ...(SOURCE.programme_phases as object[])[0], name: "Excavation" }, (SOURCE.programme_phases as object[])[1]] };
        const [row] = schedule([v1Hire], renamed);
        expect(row.status).toBe("refused");
        expect(row.reason).toMatch(/stages have changed/);
        expect(schedule([v1Hire])[0].status).toBe("planned");
    });

    it("refuses missing or unsupported supplier terms with the reason", () => {
        const [noRule, noPart, workingWeeks] = schedule([
            hire({ id: "a", offHireRule: null }),
            hire({ id: "b", partPeriodRule: null }),
            hire({ id: "c", chargeableDays: "mon_fri" }),
        ]);
        expect(noRule).toMatchObject({ status: "refused", periods: null, chargedToDate: null });
        expect(noRule.reason).toMatch(/how the supplier stops charging/);
        expect(noPart.reason).toMatch(/part period/);
        expect(workingWeeks.reason).toMatch(/working-day rules only apply to day hire/);
    });

    it("says why when there is no usable programme", () => {
        expect(offHireSchedule(programmeStagesForCosts({ ...SOURCE, start_date: null }), inputs([hire()]))).toMatchObject({ ok: false });
    });
});
