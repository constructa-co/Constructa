import { computeProgrammePlan, formatDateRange, formatPlanDate, formatWorkingDuration, PROGRAMME_BASIS_NOTE, stageBar, type ProgrammePlan } from "./programme-plan";
import { describeJobWorkingPattern, isDefaultJobWorkingPattern, isJobWorkingPatternV2, resolveJobWorkingPattern, type JobWorkingPattern } from "./job-working-pattern";

export const RELATIVE_PROGRAMME_BASIS = "relative_working_days" as const;
export const RELATIVE_PROGRAMME_NOTE = "Start date not agreed. Day numbers count working days, not calendar dates. A week means five working days.";

export interface RelativeProgrammePlan {
    basis: typeof RELATIVE_PROGRAMME_BASIS;
    working_pattern?: JobWorkingPattern;
    start_date?: never;
    end_date?: never;
    calendar_days?: never;
    working_days: number;
    duration_label: string;
    stages: Array<{
        name: string;
        start_day: number;
        end_day: number;
        working_days: number;
        start_date?: never;
        end_date?: never;
    }>;
}

export type DisplayProgrammePlan = ProgrammePlan | RelativeProgrammePlan;

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function hasRelativeProgramme(phases: unknown[] | null | undefined): boolean {
    return Array.isArray(phases) && phases.some(value => {
        const p = record(value);
        return p.timeBasis != null || p.workingDayOffset != null;
    });
}

/** Only explicitly marked, complete, sequential working-day phases are relative. */
export function computeRelativeProgramme(phases: unknown[] | null | undefined, rawPattern?: unknown): RelativeProgrammePlan | null {
    const pattern = resolveJobWorkingPattern(rawPattern);
    if (!pattern) return null;
    if (!Array.isArray(phases) || !phases.length || phases.length > 200) return null;
    let offset = 0;
    const stages: RelativeProgrammePlan["stages"] = [];
    for (const value of phases) {
        const p = record(value);
        const days = p.manualDays;
        if (p.timeBasis !== RELATIVE_PROGRAMME_BASIS || typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 80
            || typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 2600
            || p.workingDayOffset !== offset || p.startOffset != null || Boolean(p.start_date)
            || Number(p.pct_complete) > 0 || Boolean(p.actual_start_date) || Boolean(p.actual_finish_date)
            || (Array.isArray(p.dependsOn) && p.dependsOn.length > 0)) return null;
        stages.push({ name: p.name.trim(), start_day: offset + 1, end_day: offset + days, working_days: days });
        offset += days;
        if (offset > 2600) return null;
    }
    return {
        basis: RELATIVE_PROGRAMME_BASIS,
        ...(isDefaultJobWorkingPattern(pattern) ? {} : { working_pattern: pattern }),
        working_days: offset, duration_label: formatWorkingDuration(offset, pattern), stages,
    };
}

export function computeDisplayProgramme(startDate: string | null | undefined, phases: unknown[] | null | undefined, rawPattern?: unknown): DisplayProgrammePlan | null {
    return hasRelativeProgramme(phases) ? computeRelativeProgramme(phases, rawPattern) : computeProgrammePlan(startDate, phases, rawPattern);
}

export function programmeFacts(plan: DisplayProgrammePlan, style: "long" | "short" = "long") {
    return plan.basis === RELATIVE_PROGRAMME_BASIS ? [
        { label: "Start on site", value: "Start date not agreed" },
        { label: "Finish", value: `Day ${plan.working_days}` },
        { label: "Duration", value: plan.duration_label },
    ] : [
        { label: "Start on site", value: formatPlanDate(plan.start_date, style) },
        { label: "Finish", value: formatPlanDate(plan.end_date, style) },
        { label: "Duration", value: plan.duration_label },
    ];
}

export function programmeAxisLabels(plan: DisplayProgrammePlan): [string, string] {
    return plan.basis === RELATIVE_PROGRAMME_BASIS
        ? ["Day 1", `Day ${plan.working_days}`]
        : [formatPlanDate(plan.start_date, "short"), formatPlanDate(plan.end_date, "short")];
}

export function programmeStageRange(plan: DisplayProgrammePlan, index: number): string {
    if (plan.basis !== RELATIVE_PROGRAMME_BASIS) {
        const stage = plan.stages[index];
        return formatDateRange(stage.start_date, stage.end_date);
    }
    const stage = plan.stages[index];
    return stage.start_day === stage.end_day ? `Day ${stage.start_day}` : `Day ${stage.start_day} to Day ${stage.end_day}`;
}

export function programmeAxisDays(plan: DisplayProgrammePlan): number {
    return plan.basis === RELATIVE_PROGRAMME_BASIS ? plan.working_days : plan.calendar_days;
}

export function programmeStageBar(plan: DisplayProgrammePlan, index: number, minimumPct = 1) {
    if (plan.basis !== RELATIVE_PROGRAMME_BASIS) return stageBar(plan, plan.stages[index], minimumPct);
    const stage = plan.stages[index];
    return stageBar({ calendar_days: plan.working_days }, { offset_days: stage.start_day - 1, span_days: stage.working_days }, minimumPct);
}

export function programmeBasisNote(plan: DisplayProgrammePlan): string {
    const pattern = resolveJobWorkingPattern(plan.working_pattern);
    if (!pattern) return "Working pattern is invalid. Programme basis unavailable.";
    if (isJobWorkingPatternV2(pattern) || !isDefaultJobWorkingPattern(pattern)) {
        const basis = describeJobWorkingPattern(pattern);
        return plan.basis === RELATIVE_PROGRAMME_BASIS
            ? `Start date not agreed. Day numbers count working days, not calendar dates. ${basis}`
            : basis;
    }
    return plan.basis === RELATIVE_PROGRAMME_BASIS ? RELATIVE_PROGRAMME_NOTE : PROGRAMME_BASIS_NOTE;
}
