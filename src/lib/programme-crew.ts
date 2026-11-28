/**
 * Crew feasibility (D122): does the crew the contractor plans to put on each
 * stage have the hours to do the priced labour in the time the saved
 * programme allows?
 *
 * Demand is the stage's priced labour hours (the man-hours saved on the
 * programme stage), spread evenly over the stage's working shifts: its
 * working dates under the job's calendar × the shifts it works.
 *
 * Capacity is the planned crew's own figures: operatives × productive hours
 * per shift, once for each working date the crew is on that shift. A crew
 * shared by overlapping stages is counted once on each date, so two stages
 * cannot both spend the same people's hours. Hours are never taken from the
 * job's daily working pattern: a daily figure is not a per-shift figure when
 * a job works day and night, so a crew without its own hours is not checked.
 *
 * Nothing here is defaulted or invented. A stage-shift with no crew, no crew
 * size, no crew hours or no priced labour hours is reported as "cannot be
 * checked", never as fitting. The result is a warning only: it never changes
 * a date, a stage length or a price. The minimum paid gang is a cost floor
 * and is kept apart: it is not capacity, and planned crew is not cost.
 */

import type { CrewInput, ProgrammeCostInputs, ProgrammeCostStage, ShiftKey } from "./programme-costs";

export type CrewCheckReason =
    | "no_working_days"
    | "no_labour_hours"
    | "no_crew"
    | "crew_missing"
    | "crew_size_missing"
    | "crew_hours_missing";

export interface UncheckedStageShift {
    stage: number;
    stageName: string;
    shift: ShiftKey;
    reason: CrewCheckReason;
    crewName: string | null;
}

export interface CrewWindowCheck {
    date: string;
    shift: ShiftKey;
    crewId: string;
    /** Stage indexes this crew works on this date and shift. */
    stages: number[];
    demandHours: number;
    capacityHours: number;
    /** Hours of priced labour the crew cannot do in this window; 0 when it fits. */
    shortfallHours: number;
}

export interface CrewCheck {
    crewId: string;
    name: string;
    shift: ShiftKey;
    operatives: number;
    productiveHoursPerShift: number;
    stages: number[];
    /** Unique working dates the crew is on this shift (overlapping stages count once). */
    shiftCount: number;
    demandHours: number;
    capacityHours: number;
    shortWindows: CrewWindowCheck[];
    /** Sum of the shortfalls in the short windows (spare hours elsewhere are not netted off). */
    shortfallHours: number;
    firstShortDate: string | null;
    lastShortDate: string | null;
}

export interface PaidGangNote {
    shift: ShiftKey;
    minimumPaidGang: number;
    /** Checked dates on this shift where the planned crews total fewer operatives than the paid minimum. */
    datesBelow: number;
    lowestPlanned: number;
}

export type CrewFeasibilityStatus = "not_set" | "cannot_check" | "partial" | "fits" | "short";

export interface CrewFeasibility {
    status: CrewFeasibilityStatus;
    crews: CrewCheck[];
    windows: CrewWindowCheck[];
    unchecked: UncheckedStageShift[];
    checkedStageShifts: number;
    totalStageShifts: number;
    paidGangNotes: PaidGangNote[];
}

/** Rounds away binary noise before figures are compared or shown. */
function clean(value: number): number {
    return Math.round(value * 1e9) / 1e9;
}

function crewFor(stageCrewId: string | null, shift: ShiftKey, crews: ReadonlyMap<string, CrewInput>): { crew: CrewInput | null; reason: CrewCheckReason | null } {
    if (!stageCrewId) return { crew: null, reason: "no_crew" };
    const crew = crews.get(stageCrewId);
    if (!crew || crew.shift !== shift) return { crew: null, reason: "crew_missing" };
    if (crew.operatives === null) return { crew, reason: "crew_size_missing" };
    if (crew.productiveHoursPerShift === null) return { crew, reason: "crew_hours_missing" };
    return { crew, reason: null };
}

/**
 * Checks the planned crews against the saved programme's dated stages. The
 * stage settings must line up with the stages (as computeProgrammeCosts
 * requires); a stage without settings is skipped.
 */
export function crewFeasibility(
    stages: readonly ProgrammeCostStage[],
    inputs: Pick<ProgrammeCostInputs, "stages" | "crews" | "gangFloors">,
): CrewFeasibility {
    const crews = new Map(inputs.crews.map((crew) => [crew.id, crew]));
    const windows = new Map<string, CrewWindowCheck>();
    const crewStages = new Map<string, Set<number>>();
    const unchecked: UncheckedStageShift[] = [];
    let checked = 0;
    let total = 0;

    for (const stage of stages) {
        const input = inputs.stages[stage.index];
        if (!input) continue;
        for (const shift of input.shifts) {
            total += 1;
            const { crew, reason: crewReason } = crewFor(input.crewByShift?.[shift] ?? null, shift, crews);
            const reason: CrewCheckReason | null = stage.workingDates.length === 0
                ? "no_working_days"
                : !(stage.manhours > 0) ? "no_labour_hours" : crewReason;
            if (reason || !crew || crew.operatives === null || crew.productiveHoursPerShift === null) {
                unchecked.push({ stage: stage.index, stageName: stage.name, shift, reason: reason ?? "crew_missing", crewName: crew?.name ?? null });
                continue;
            }
            checked += 1;
            const share = stage.manhours / (stage.workingDates.length * input.shifts.length);
            const capacity = crew.operatives * crew.productiveHoursPerShift;
            const used = crewStages.get(crew.id) ?? new Set<number>();
            used.add(stage.index);
            crewStages.set(crew.id, used);
            for (const date of stage.workingDates) {
                const key = `${date}|${crew.id}`;
                const window = windows.get(key) ?? { date, shift, crewId: crew.id, stages: [], demandHours: 0, capacityHours: capacity, shortfallHours: 0 };
                window.stages.push(stage.index);
                window.demandHours += share;
                windows.set(key, window);
            }
        }
    }

    const allWindows = [...windows.values()]
        .map((window) => {
            const demandHours = clean(window.demandHours);
            return { ...window, demandHours, shortfallHours: clean(Math.max(0, demandHours - window.capacityHours)) };
        })
        .sort((a, b) => (a.date === b.date ? (a.crewId < b.crewId ? -1 : 1) : a.date < b.date ? -1 : 1));

    const crewChecks: CrewCheck[] = [];
    for (const crew of inputs.crews) {
        const own = allWindows.filter((window) => window.crewId === crew.id);
        if (own.length === 0 || crew.operatives === null || crew.productiveHoursPerShift === null) continue;
        const short = own.filter((window) => window.shortfallHours > 0);
        crewChecks.push({
            crewId: crew.id,
            name: crew.name,
            shift: crew.shift,
            operatives: crew.operatives,
            productiveHoursPerShift: crew.productiveHoursPerShift,
            stages: [...(crewStages.get(crew.id) ?? [])].sort((a, b) => a - b),
            shiftCount: own.length,
            demandHours: clean(own.reduce((sum, window) => sum + window.demandHours, 0)),
            capacityHours: clean(own.reduce((sum, window) => sum + window.capacityHours, 0)),
            shortWindows: short,
            shortfallHours: clean(short.reduce((sum, window) => sum + window.shortfallHours, 0)),
            firstShortDate: short[0]?.date ?? null,
            lastShortDate: short.at(-1)?.date ?? null,
        });
    }

    // The paid minimum and the planned crew are different things; say so when they disagree, never adjust either.
    const paidGangNotes: PaidGangNote[] = [];
    for (const floor of inputs.gangFloors) {
        if (floor.minimumPaidGang <= 0) continue;
        const plannedByDate = new Map<string, number>();
        for (const window of allWindows) {
            if (window.shift !== floor.shift) continue;
            const crew = crews.get(window.crewId);
            plannedByDate.set(window.date, (plannedByDate.get(window.date) ?? 0) + (crew?.operatives ?? 0));
        }
        const below = [...plannedByDate.values()].filter((planned) => planned < floor.minimumPaidGang);
        if (below.length > 0) {
            paidGangNotes.push({ shift: floor.shift, minimumPaidGang: floor.minimumPaidGang, datesBelow: below.length, lowestPlanned: Math.min(...below) });
        }
    }

    let status: CrewFeasibilityStatus;
    if (total === 0) status = "cannot_check";
    else if (inputs.crews.length === 0) status = "not_set";
    else if (crewChecks.some((crew) => crew.shortWindows.length > 0)) status = "short";
    else if (checked === 0) status = "cannot_check";
    else if (unchecked.length > 0) status = "partial";
    else status = "fits";

    return { status, crews: crewChecks, windows: allWindows, unchecked, checkedStageShifts: checked, totalStageShifts: total, paidGangNotes };
}

export const CREW_CHECK_REASON_TEXT: Record<CrewCheckReason, string> = {
    no_working_days: "the stage has no working days on the job's calendar",
    no_labour_hours: "the stage has no priced labour hours",
    no_crew: "no crew is planned for this shift",
    crew_missing: "the planned crew has been removed or works a different shift",
    crew_size_missing: "the crew has no number of operatives",
    crew_hours_missing: "the crew has no productive hours per shift",
};
