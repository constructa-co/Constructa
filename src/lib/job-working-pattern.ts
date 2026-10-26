import { parseIsoDate } from "./programme-date";

/** UTC civil weekdays: Sunday=0 through Saturday=6. No shift/hour capacity. */
export interface JobWorkingPattern {
    readonly version: 1;
    readonly weekdays: readonly number[];
}

export const DEFAULT_JOB_WORKING_PATTERN: JobWorkingPattern = Object.freeze({
    version: 1,
    weekdays: Object.freeze([1, 2, 3, 4, 5]),
});

/** Missing legacy patterns retain Monday-Friday; malformed explicit data fails closed. */
export function resolveJobWorkingPattern(value: unknown): JobWorkingPattern | null {
    if (value == null) return DEFAULT_JOB_WORKING_PATTERN;
    if (typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some(key => key !== "version" && key !== "weekdays")
        || row.version !== 1 || !Array.isArray(row.weekdays)
        || row.weekdays.length < 1 || row.weekdays.length > 7
        || ![...row.weekdays].every(day => Number.isInteger(day) && day >= 0 && day <= 6)
        || new Set(row.weekdays).size !== row.weekdays.length) return null;
    return Object.freeze({ version: 1, weekdays: Object.freeze([...row.weekdays]) });
}

/** Weekday order does not change the meaning of the legacy Monday-Friday week. */
export function isDefaultJobWorkingPattern(pattern: JobWorkingPattern): boolean {
    return pattern.weekdays.length === 5 && DEFAULT_JOB_WORKING_PATTERN.weekdays.every(day => pattern.weekdays.includes(day));
}

const DAY_MS = 86_400_000;
const works = (ms: number, pattern: JobWorkingPattern) => pattern.weekdays.includes(new Date(ms).getUTCDay());

function rollForward(ms: number, pattern: JobWorkingPattern): number {
    while (!works(ms, pattern)) ms += DAY_MS;
    return ms;
}

function isoDate(ms: number): string | null {
    const date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return null;
    const iso = date.toISOString().slice(0, 10);
    return parseIsoDate(iso) === ms ? iso : null;
}

export function isJobWorkingDay(iso: string, value?: unknown): boolean {
    const pattern = resolveJobWorkingPattern(value), ms = parseIsoDate(iso);
    return pattern !== null && ms !== null && works(ms, pattern);
}

/** Inclusive duration and rounding match addWorkingDays; a non-working start rolls forward. */
export function addJobWorkingDays(startIso: string, workingDays: number, value?: unknown): string | null {
    const pattern = resolveJobWorkingPattern(value), start = parseIsoDate(startIso);
    if (!pattern || start === null || !Number.isFinite(workingDays) || workingDays < 1
        || !Number.isSafeInteger(Math.round(workingDays))) return null;
    let cursor = rollForward(start, pattern), remaining = Math.round(workingDays) - 1;
    const weeks = Math.floor(remaining / pattern.weekdays.length);
    cursor += weeks * 7 * DAY_MS;
    remaining -= weeks * pattern.weekdays.length;
    if (!Number.isFinite(new Date(cursor).getTime())) return null;
    while (remaining > 0) {
        cursor += DAY_MS;
        if (!Number.isFinite(new Date(cursor).getTime())) return null;
        if (works(cursor, pattern)) remaining -= 1;
    }
    return isoDate(cursor);
}

export function nextJobWorkingDayAfter(iso: string, value?: unknown): string | null {
    const pattern = resolveJobWorkingPattern(value), ms = parseIsoDate(iso);
    return pattern && ms !== null ? isoDate(rollForward(ms + DAY_MS, pattern)) : null;
}

/** Working dates in an inclusive range, matching the legacy zero result for invalid/reversed dates. */
export function countJobWorkingDays(startIso: string, endIso: string, value?: unknown): number {
    const pattern = resolveJobWorkingPattern(value), start = parseIsoDate(startIso), end = parseIsoDate(endIso);
    if (!pattern || start === null || end === null || end < start) return 0;
    const days = Math.round((end - start) / DAY_MS) + 1, weeks = Math.floor(days / 7);
    let count = weeks * pattern.weekdays.length;
    for (let cursor = start + weeks * 7 * DAY_MS; cursor <= end; cursor += DAY_MS) {
        if (works(cursor, pattern)) count += 1;
    }
    return count;
}

/** Calendar placement, independent of working-day duration or local timezone. */
export function jobCalendarOffset(fromIso: string, toIso: string): number | null {
    const from = parseIsoDate(fromIso), to = parseIsoDate(toIso);
    return from === null || to === null ? null : Math.round((to - from) / DAY_MS);
}
