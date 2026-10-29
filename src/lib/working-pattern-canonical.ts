import { resolveJobWorkingPattern, type JobWorkingPattern } from "./job-working-pattern";
import { isWorkingPatternV2Draft, type JobWorkingPatternV2Draft } from "./working-pattern-draft";

function sortNumbers(values: number[]) {
    return [...values].sort((a, b) => a - b);
}

function normalizeDraft(value: unknown): unknown {
    if (value == null) return null;
    if (isWorkingPatternV2Draft(value)) {
        const draft = value as JobWorkingPatternV2Draft;
        return {
            version: 2,
            timezone: draft.timezone.trim(),
            weekdays: sortNumbers(draft.weekdays),
            standardMinutesPerDay: draft.standardMinutesPerDay,
            productivityPct: draft.productivityPct,
            intervals: draft.intervals.map(row => ({
                weekday: row.weekday,
                startMinute: row.startMinute,
                endMinute: row.endMinute,
            })).sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute || a.endMinute - b.endMinute),
        };
    }
    if (typeof value === "object" && !Array.isArray(value) && (value as { version?: unknown }).version === 1) {
        const row = value as { weekdays?: unknown };
        return {
            version: 1,
            weekdays: sortNumbers(Array.isArray(row.weekdays) ? row.weekdays.filter(d => Number.isInteger(d)) as number[] : []),
        };
    }
    return value;
}

export function canonicalWorkingPatternComparable(value: unknown): string {
    return JSON.stringify(normalizeDraft(value));
}

function resolvedJsonEqual(left: JobWorkingPattern, right: JobWorkingPattern): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

export function workingPatternsEquivalent(left: unknown, right: unknown): boolean {
    const resolvedLeft = resolveJobWorkingPattern(left);
    const resolvedRight = resolveJobWorkingPattern(right);
    if (resolvedLeft && resolvedRight) return resolvedJsonEqual(resolvedLeft, resolvedRight);
    return canonicalWorkingPatternComparable(left) === canonicalWorkingPatternComparable(right);
}

export function canonicalResolvedPattern(pattern: JobWorkingPattern): string {
    return JSON.stringify(pattern);
}
