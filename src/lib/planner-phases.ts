/**
 * What the detailed programme planner starts from.
 *
 * The saved programme is the contractor's. The planner opens on it exactly
 * as it was saved and never swaps it for stages worked out from the
 * estimate. Only when nothing is saved does it offer a starting point, and
 * that is a suggestion: it is not saved, and no proposal uses it, until the
 * contractor changes it or saves it.
 *
 * An estimate priced on the simple screen keeps every line in one section
 * called "General". That is a filing label, not a stage of the job, so it
 * is never offered as a stage name.
 */

import { SIMPLE_LINE_SECTION } from "./simple-estimate";
import { WHOLE_JOB_NAME } from "./simple-programme";

export interface PlannerPhase {
    name: string;
    /** Working days worked out from man-hours. */
    calculatedDays: number;
    /** Working days the contractor set, when they set them. */
    manualDays: number | null;
    manhours: number;
    /** Calendar days from the project start. */
    startOffset: number;
    color?: string;
    dependsOn?: number[];
    pct_complete?: number;
    actual_start_date?: string;
    actual_finish_date?: string;
}

export interface PlannerEstimate {
    estimate_lines?: Array<{
        trade_section?: string | null;
        quantity?: number | null;
        estimate_line_components?: Array<{ total_manhours?: number | null }> | null;
    }> | null;
}

/** Working days as the calendar days the planner's weekly grid gives them. */
export function plannerCalendarDays(workingDays: number, daysPerWeek: number): number {
    if (daysPerWeek >= 7) return workingDays;
    return Math.ceil(workingDays / daysPerWeek) * 7;
}

/**
 * The phases saved on the project, as the planner can draw them. The column
 * is JSON, so anything that is not an object with a name is left out rather
 * than allowed to break the chart.
 */
export function savedPlannerPhases(raw: unknown): PlannerPhase[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (phase): phase is PlannerPhase =>
            phase !== null && typeof phase === "object" && typeof (phase as { name?: unknown }).name === "string",
    );
}

/** The name a suggested stage is given for an estimate section. */
export function suggestedStageName(section: string | null | undefined): string {
    const name = (section ?? "").trim();
    return !name || name === SIMPLE_LINE_SECTION ? WHOLE_JOB_NAME : name;
}

/** Suggested stages placed one after another, with stage names in place of filing labels. */
export function sequenceSuggestedPhases<T extends Pick<PlannerPhase, "name" | "calculatedDays" | "manualDays">>(
    phases: readonly T[],
    daysPerWeek: number,
): Array<T & { startOffset: number }> {
    let offset = 0;
    return phases.map((phase) => {
        const placed = { ...phase, name: suggestedStageName(phase.name), startOffset: offset };
        offset += plannerCalendarDays(phase.manualDays ?? phase.calculatedDays, daysPerWeek);
        return placed;
    });
}

/** Stages worked out from the labour hours in an estimate, one per section that has any. */
export function estimateSuggestedPhases(estimate: PlannerEstimate | null | undefined, daysPerWeek: number): PlannerPhase[] {
    const sectionManhours = new Map<string, number>();
    for (const line of estimate?.estimate_lines ?? []) {
        const hours = (line.estimate_line_components ?? []).reduce((sum, component) => sum + (component.total_manhours || 0), 0);
        const section = line.trade_section || SIMPLE_LINE_SECTION;
        sectionManhours.set(section, (sectionManhours.get(section) ?? 0) + hours * (line.quantity || 1));
    }
    const phases = [...sectionManhours.entries()]
        .filter(([, manhours]) => manhours > 0)
        .map(([name, manhours]) => ({
            name,
            calculatedDays: Math.max(Math.ceil(manhours / 8), 1),
            manualDays: null,
            manhours,
        }));
    return sequenceSuggestedPhases(phases, daysPerWeek);
}

export interface PlannerOpening {
    phases: PlannerPhase[];
    /**
     * "saved": the contractor's programme, untouched.
     * "suggested": a starting point from the estimate that has not been saved.
     * "empty": nothing saved and nothing to suggest yet.
     */
    origin: "saved" | "suggested" | "empty";
}

/**
 * The phases the planner shows when it opens. Saved phases always win and
 * are returned as they are: same stages, same order, same lengths.
 */
export function plannerPhasesOnOpen(saved: PlannerPhase[], estimate: PlannerEstimate | null | undefined, daysPerWeek: number): PlannerOpening {
    if (saved.length > 0) return { phases: saved, origin: "saved" };
    const suggested = estimateSuggestedPhases(estimate, daysPerWeek);
    return suggested.length > 0 ? { phases: suggested, origin: "suggested" } : { phases: [], origin: "empty" };
}
