/**
 * Plant off-hire driven by the saved programme (D122).
 *
 * Each hire is tied to the programme through the D121 anchors (start of a
 * stage for on-hire, end of a stage for off-hire, or a fixed date). This
 * schedule shows three dates separately, because they are different things:
 *
 *  - on hire: when the plant arrives and the supplier starts charging;
 *  - planned off-hire: when the programme says the plant is no longer
 *    needed (the off-hire call date, or the date it is ready to collect);
 *  - charged to: the last date the supplier still charges, after its notice
 *    period or until collection.
 *
 * It is worked out from the programme as saved now, so moving a stage moves
 * the dates and the billable periods in the preview. When hire lines are
 * already on the estimate, it shows what they were applied with and how far
 * the dates have moved; the estimate keeps its price until the contractor
 * reviews and applies a change. A hire whose stage is gone, renamed or
 * moved, or whose supplier basis is not stated, is refused with the reason.
 *
 * A planned off-hire is a date on a plan. It is not an off-hire instruction
 * to a supplier and nothing here contacts, books or cancels anything.
 */

import { parseIsoDate } from "./programme-plan";
import {
    hireCost,
    type AppliedHireRecord,
    type HireAnchor,
    type HireUnit,
    type OffHireRule,
    type ProgrammeCostInputs,
    type ProgrammeCostStage,
    type ProgrammeStagesResult,
} from "./programme-costs";

export type HireAnchorSource = { kind: "stage"; stageName: string } | { kind: "date" };

export interface OffHireRow {
    id: string;
    description: string;
    status: "planned" | "refused";
    reason: string | null;
    onHireSource: HireAnchorSource | null;
    offHireSource: HireAnchorSource | null;
    offHireRule: OffHireRule | null;
    /** Calendar days the supplier still charges after the planned off-hire date. */
    offHireDays: number;
    onHireDate: string | null;
    plannedOffHireDate: string | null;
    chargedToDate: string | null;
    unit: HireUnit;
    /** Calendar days from on hire to charged to, inclusive. */
    calendarDays: number | null;
    /** Days the supplier charges, for day hire. */
    chargeableDayCount: number | null;
    /** Periods the dates give, before the minimum hire. */
    periodsFromDates: number | null;
    periods: number | null;
    minimumApplied: boolean;
    /** What the hire's lines on the estimate were applied with, when any are applied. */
    applied: AppliedHireRecord | null;
    /** Calendar days each date has moved since it was applied (positive = later). Null when not known. */
    moved: { onHire: number; plannedOffHire: number; chargedTo: number } | null;
}

export type OffHireSchedule = { ok: true; rows: OffHireRow[] } | { ok: false; reason: string };

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
    return Math.round((parseIsoDate(toIso)! - parseIsoDate(fromIso)!) / DAY_MS);
}

function sourceOf(anchor: HireAnchor, stages: readonly Pick<ProgrammeCostStage, "name">[]): HireAnchorSource | null {
    if (anchor.kind === "date") return { kind: "date" };
    const stage = stages[anchor.stage];
    if (!stage || (anchor.stageName !== undefined && anchor.stageName !== stage.name)) return null;
    return { kind: "stage", stageName: stage.name };
}

/**
 * The hire dates the saved programme gives now, one row per hire, with the
 * dates its applied lines carry for comparison.
 */
export function offHireSchedule(
    programme: ProgrammeStagesResult,
    inputs: Pick<ProgrammeCostInputs, "stages" | "hires">,
    applied: ReadonlyMap<string, AppliedHireRecord> = new Map(),
): OffHireSchedule {
    if (!programme.ok) return { ok: false, reason: programme.reason };
    const { stages, calendar } = programme;
    const stagesChanged = inputs.stages.length !== stages.length || inputs.stages.some((stage, index) => stage.name !== stages[index].name);

    const rows = inputs.hires.map((hire): OffHireRow => {
        const appliedRecord = applied.get(hire.id) ?? null;
        const base: OffHireRow = {
            id: hire.id,
            description: hire.description,
            status: "refused",
            reason: null,
            onHireSource: sourceOf(hire.onHire, stages),
            offHireSource: sourceOf(hire.offHire, stages),
            offHireRule: hire.offHireRule,
            offHireDays: hire.offHireDays,
            onHireDate: null,
            plannedOffHireDate: null,
            chargedToDate: null,
            unit: hire.unit,
            calendarDays: null,
            chargeableDayCount: null,
            periodsFromDates: null,
            periods: null,
            minimumApplied: false,
            applied: appliedRecord,
            moved: null,
        };
        // A D121 anchor carries no stage name: if the stages have changed since, its index may now mean another stage.
        const unnamedStageAnchor = [hire.onHire, hire.offHire].some((anchor) => anchor.kind !== "date" && anchor.stageName === undefined);
        if (stagesChanged && unnamedStageAnchor) {
            return { ...base, onHireSource: null, offHireSource: null, reason: `"${hire.description}": the programme stages have changed since this hire was set. Choose its on-hire and off-hire stages again.` };
        }
        const priced = hireCost(hire, stages, calendar);
        if (!priced.ok) return { ...base, reason: priced.error };
        const result = priced.result;
        const dates = appliedRecord?.dates ?? null;
        return {
            ...base,
            status: "planned",
            onHireDate: result.onHireDate,
            plannedOffHireDate: result.offHireDate,
            chargedToDate: result.billingEndDate,
            calendarDays: result.calendarDays,
            chargeableDayCount: result.chargeableDayCount,
            periodsFromDates: result.periodsFromDates,
            periods: result.periods,
            minimumApplied: result.minimumApplied,
            moved: dates
                ? {
                    onHire: daysBetween(dates.onHire, result.onHireDate),
                    plannedOffHire: daysBetween(dates.offHire, result.offHireDate),
                    chargedTo: daysBetween(dates.chargedTo, result.billingEndDate),
                }
                : null,
        };
    });
    return { ok: true, rows };
}

/** True when any applied hire's dates or periods differ from what the programme gives now. */
export function offHireNeedsReview(rows: readonly OffHireRow[]): boolean {
    return rows.some((row) => row.applied !== null && (
        row.status === "refused"
        || (row.moved !== null && (row.moved.onHire !== 0 || row.moved.plannedOffHire !== 0 || row.moved.chargedTo !== 0))
        || (row.applied.savedPeriods !== null && row.periods !== null && row.applied.savedPeriods !== row.periods)
    ));
}
