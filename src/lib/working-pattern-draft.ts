import type { JobWorkingInterval } from "./job-working-pattern";

/** Editable programme draft; save path still uses resolveJobWorkingPattern. */
export interface JobWorkingPatternV2Draft {
    version: 2;
    timezone: string;
    weekdays: number[];
    intervals: JobWorkingInterval[];
    standardMinutesPerDay: number;
    productivityPct: number;
}

export function isWorkingPatternV2Draft(value: unknown): value is JobWorkingPatternV2Draft {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        && (value as { version?: unknown }).version === 2;
}

export function draftWeekdays(value: unknown): number[] {
    if (isWorkingPatternV2Draft(value)) return value.weekdays;
    if (value && typeof value === "object" && !Array.isArray(value) && (value as { version?: unknown }).version === 1) {
        const weekdays = (value as { weekdays?: unknown }).weekdays;
        if (Array.isArray(weekdays)) return weekdays.filter(day => Number.isInteger(day)) as number[];
    }
    return [1, 2, 3, 4, 5];
}

export function createWorkingPatternV2Draft(weekdays: number[]): JobWorkingPatternV2Draft {
    return {
        version: 2,
        timezone: "",
        weekdays: [...weekdays],
        intervals: [{ weekday: weekdays[0] ?? 1, startMinute: 0, endMinute: 1 }],
        standardMinutesPerDay: 0,
        productivityPct: 0,
    };
}
