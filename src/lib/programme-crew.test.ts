import { describe, expect, it } from "vitest";
import {
    computeProgrammeCosts,
    parseProgrammeCostInputs,
    programmeStagesForCosts,
    type CrewInput,
    type ProgrammeCostInputs,
    type ProgrammeCostSource,
    type StageShiftInput,
} from "./programme-costs";
import { crewFeasibility } from "./programme-crew";

// Synthetic programme only. 1 March 2027 is a Monday; Mon–Fri, 8-hour days.
// Groundworks: Mon 1 – Fri 5 March, 80 h priced labour → 16 h on each of its 5 working days.
// Drainage:    Wed 3 – Tue 9 March, 80 h priced labour → 16 h on each of its 5 working days.
// They overlap on Wed 3, Thu 4 and Fri 5 March.
const SOURCE: ProgrammeCostSource = {
    start_date: "2027-03-01",
    region: "England",
    programme_phases: [
        { name: "Groundworks", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 0 },
        { name: "Drainage", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 2 },
    ],
};

const crew = (patch: Partial<CrewInput> = {}): CrewInput => ({ id: "gang-a", name: "Gang A", shift: "day", operatives: 2, productiveHoursPerShift: 8, ...patch });
const stage = (name: string, patch: Partial<StageShiftInput> = {}): StageShiftInput => ({
    name, shifts: ["day"], costedOperatives: null, crewByShift: { day: null, night: null }, ...patch,
});

function inputs(patch: Partial<ProgrammeCostInputs> = {}): ProgrammeCostInputs {
    const parsed = parseProgrammeCostInputs({ version: 2, stages: [stage("Groundworks"), stage("Drainage")], gangFloors: [], supervision: [], hires: [], crews: [], ...patch });
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    return parsed.inputs;
}

function check(patch: Partial<ProgrammeCostInputs> = {}, source: ProgrammeCostSource = SOURCE) {
    const programme = programmeStagesForCosts(source);
    if (!programme.ok) throw new Error(programme.reason);
    return crewFeasibility(programme.stages, inputs(patch));
}

const onBoth = (crewId: string) => [
    stage("Groundworks", { crewByShift: { day: crewId, night: null } }),
    stage("Drainage", { crewByShift: { day: crewId, night: null } }),
];

describe("crew feasibility: shared crews and overlapping stages", () => {
    it("counts a crew shared by overlapping stages once per date, and shows the short dates and figures", () => {
        const result = check({ crews: [crew()], stages: onBoth("gang-a") });
        expect(result.status).toBe("short");
        const [gang] = result.crews;
        // 7 unique working dates (1–5 and 8–9 March), not 10 stage-days: 7 × 2 × 8 h.
        expect(gang).toMatchObject({ shiftCount: 7, capacityHours: 112, demandHours: 160, stages: [0, 1] });
        expect(gang.shortWindows.map((window) => [window.date, window.stages, window.demandHours, window.capacityHours, window.shortfallHours])).toEqual([
            ["2027-03-03", [0, 1], 32, 16, 16],
            ["2027-03-04", [0, 1], 32, 16, 16],
            ["2027-03-05", [0, 1], 32, 16, 16],
        ]);
        expect(gang).toMatchObject({ shortfallHours: 48, firstShortDate: "2027-03-03", lastShortDate: "2027-03-05" });
    });

    it("gives separate crews their own hours, so the same programme fits", () => {
        const result = check({
            crews: [crew(), crew({ id: "gang-b", name: "Gang B" })],
            stages: [stage("Groundworks", { crewByShift: { day: "gang-a", night: null } }), stage("Drainage", { crewByShift: { day: "gang-b", night: null } })],
        });
        expect(result.status).toBe("fits");
        expect(result.crews.map((entry) => [entry.name, entry.shiftCount, entry.capacityHours, entry.demandHours])).toEqual([["Gang A", 5, 80, 80], ["Gang B", 5, 80, 80]]);
        expect(result.windows.every((window) => window.shortfallHours === 0)).toBe(true);
    });

    it("does not net spare hours on quiet dates against short dates", () => {
        // 3 operatives: 24 h a shift. 168 h available over the 7 dates is more than the 160 h needed,
        // but 32 h are needed on each overlap date, so those dates are still short.
        const result = check({ crews: [crew({ operatives: 3 })], stages: onBoth("gang-a") });
        expect(result.crews[0]).toMatchObject({ capacityHours: 168, demandHours: 160, shortfallHours: 24 });
        expect(result.status).toBe("short");
    });
});

describe("crew feasibility: planned crew is not the paid minimum", () => {
    const floor = { shift: "day" as const, minimumPaidGang: 3, operativeDayRatePence: 25_000 };

    it("never changes the paid gang cost, and never counts the paid minimum as working hours", () => {
        const withoutCrews = computeProgrammeCosts(SOURCE, inputs({ gangFloors: [floor] }));
        const withCrews = computeProgrammeCosts(SOURCE, inputs({ gangFloors: [floor], crews: [crew()], stages: onBoth("gang-a") }));
        if (!withoutCrews.ok || !withCrews.ok) throw new Error("expected costs");
        expect(withCrews.result.lines).toEqual(withoutCrews.result.lines);
        expect(withCrews.result.signature).toBe(withoutCrews.result.signature);

        const result = check({ gangFloors: [floor], crews: [crew()], stages: onBoth("gang-a") });
        // Capacity is the planned 2 operatives, not the paid minimum of 3.
        expect(result.crews[0].capacityHours).toBe(7 * 2 * 8);
        expect(result.paidGangNotes).toEqual([{ shift: "day", minimumPaidGang: 3, datesBelow: 7, lowestPlanned: 2 }]);
    });

    it("adds planned crews on a date when stages have their own crews", () => {
        const result = check({
            gangFloors: [floor],
            crews: [crew(), crew({ id: "gang-b", name: "Gang B" })],
            stages: [stage("Groundworks", { crewByShift: { day: "gang-a", night: null } }), stage("Drainage", { crewByShift: { day: "gang-b", night: null } })],
        });
        // 4 planned on 3–5 March; 2 on 1, 2, 8 and 9 March.
        expect(result.paidGangNotes).toEqual([{ shift: "day", minimumPaidGang: 3, datesBelow: 4, lowestPlanned: 2 }]);
    });
});

describe("crew feasibility: missing, zero and partial information is never a pass", () => {
    it("is not set when no crews are planned", () => {
        expect(check()).toMatchObject({ status: "not_set", checkedStageShifts: 0, totalStageShifts: 2 });
    });

    it("cannot check a crew with no size or no hours, and does not borrow the working pattern's hours", () => {
        const noSize = check({ crews: [crew({ operatives: null })], stages: onBoth("gang-a") });
        expect(noSize.status).toBe("cannot_check");
        expect(noSize.unchecked.map((item) => item.reason)).toEqual(["crew_size_missing", "crew_size_missing"]);
        const noHours = check({ crews: [crew({ productiveHoursPerShift: null })], stages: onBoth("gang-a") });
        expect(noHours.status).toBe("cannot_check");
        expect(noHours.unchecked.map((item) => item.reason)).toEqual(["crew_hours_missing", "crew_hours_missing"]);
        expect(noHours.windows).toEqual([]);
    });

    it("refuses a zero-size or zero-hour crew rather than treating it as no capacity", () => {
        expect(parseProgrammeCostInputs({ ...inputs(), crews: [crew({ operatives: 0 })] }).ok).toBe(false);
        expect(parseProgrammeCostInputs({ ...inputs(), crews: [crew({ productiveHoursPerShift: 0 })] }).ok).toBe(false);
        expect(parseProgrammeCostInputs({ ...inputs(), crews: [crew({ productiveHoursPerShift: 25 })] }).ok).toBe(false);
    });

    it("reports a partial check when only some stage shifts have a crew", () => {
        const result = check({ crews: [crew()], stages: [stage("Groundworks", { crewByShift: { day: "gang-a", night: null } }), stage("Drainage")] });
        expect(result).toMatchObject({ status: "partial", checkedStageShifts: 1, totalStageShifts: 2 });
        expect(result.unchecked).toEqual([{ stage: 1, stageName: "Drainage", shift: "day", reason: "no_crew", crewName: null }]);
    });

    it("cannot check a stage with no priced labour hours", () => {
        const source = { ...SOURCE, programme_phases: [(SOURCE.programme_phases as object[])[0], { ...(SOURCE.programme_phases as object[])[1], manhours: 0 }] };
        const result = check({ crews: [crew({ operatives: 4 })], stages: onBoth("gang-a") }, source);
        expect(result.status).toBe("partial");
        expect(result.unchecked).toEqual([{ stage: 1, stageName: "Drainage", shift: "day", reason: "no_labour_hours", crewName: "Gang A" }]);
    });

    it("cannot check a crew that was removed or works another shift", () => {
        const removed = check({ crews: [crew()], stages: onBoth("gang-gone") });
        expect(removed.unchecked.map((item) => item.reason)).toEqual(["crew_missing", "crew_missing"]);
        const otherShift = check({ crews: [crew({ shift: "night" })], stages: onBoth("gang-a") });
        expect(otherShift.status).toBe("cannot_check");
        expect(otherShift.unchecked.map((item) => item.reason)).toEqual(["crew_missing", "crew_missing"]);
    });

    it("has nothing to check when no stage works a shift", () => {
        expect(check({ crews: [crew()], stages: [stage("Groundworks", { shifts: [] }), stage("Drainage", { shifts: [] })] }).status).toBe("cannot_check");
    });
});

describe("crew feasibility: calendars, shifts and programme changes", () => {
    it("only counts the job's working dates, skipping weekends and bank holidays", () => {
        // Wed 24 March 2027, five working days: Good Friday (26th), the weekend and Easter Monday (29th) are not worked.
        const source: ProgrammeCostSource = { start_date: "2027-03-24", region: "England", programme_phases: [{ name: "Fit out", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 0 }] };
        const fits = check({ crews: [crew()], stages: [stage("Fit out", { crewByShift: { day: "gang-a", night: null } })] }, source);
        expect(fits.windows.map((window) => window.date)).toEqual(["2027-03-24", "2027-03-25", "2027-03-30", "2027-03-31", "2027-04-01"]);
        expect(fits.status).toBe("fits");
        const short = check({ crews: [crew({ operatives: 1 })], stages: [stage("Fit out", { crewByShift: { day: "gang-a", night: null } })] }, source);
        expect(short.crews[0]).toMatchObject({ capacityHours: 40, demandHours: 80, shortfallHours: 40 });
    });

    it("checks day and night crews on their own stated hours, splitting the stage's hours over its shifts", () => {
        const result = check({
            crews: [crew(), crew({ id: "nights", name: "Night gang", shift: "night", operatives: 3, productiveHoursPerShift: 7 })],
            stages: [stage("Groundworks"), stage("Drainage", { shifts: ["day", "night"], crewByShift: { day: "gang-a", night: "nights" } })],
        });
        const night = result.windows.filter((window) => window.shift === "night");
        expect(night).toHaveLength(5);
        // 80 h over 5 dates × 2 shifts = 8 h a shift. Night capacity is 3 × 7 h = 21 h, not 3 × the 8-hour working day.
        expect(night[0]).toMatchObject({ demandHours: 8, capacityHours: 21, shortfallHours: 0 });
        expect(result.unchecked).toEqual([{ stage: 0, stageName: "Groundworks", shift: "day", reason: "no_crew", crewName: null }]);
        expect(result.status).toBe("partial");
    });

    it("follows the saved programme: a longer stage clears the shortfall, without changing any date", () => {
        const settings = { crews: [crew({ operatives: 3 })], stages: onBoth("gang-a") };
        expect(check(settings).status).toBe("short");
        const longer: ProgrammeCostSource = { ...SOURCE, programme_phases: [(SOURCE.programme_phases as object[])[0], { ...(SOURCE.programme_phases as object[])[1], calculatedDays: 10 }] };
        const before = JSON.stringify(longer);
        // Drainage now needs 8 h a day; 16 + 8 = 24 h on the overlap dates, exactly the crew's 24 h.
        expect(check(settings, longer).status).toBe("fits");
        expect(JSON.stringify(longer)).toBe(before);
    });
});
