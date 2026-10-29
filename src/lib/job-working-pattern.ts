import { parseIsoDate } from "./programme-date";
import {
    addLocalCalendarDays, isValidIanaTimeZone, localStartOfDayUtc, localWallClockExists, localWeekday, nextLocalIsoDate,
} from "./job-working-local";

/** UTC civil weekdays: Sunday=0 through Saturday=6. Version 1 has no shift/hour capacity. */
export interface JobWorkingPatternV1 {
    readonly version: 1;
    readonly weekdays: readonly number[];
}

/** Explicit local timezone, intervals and capacity — all fields required; nothing is inferred. */
export interface JobWorkingInterval {
    readonly weekday: number;
    readonly startMinute: number;
    readonly endMinute: number;
}

export interface JobWorkingPatternV2 {
    readonly version: 2;
    readonly timezone: string;
    readonly weekdays: readonly number[];
    readonly intervals: readonly JobWorkingInterval[];
    readonly standardMinutesPerDay: number;
    readonly productivityPct: number;
}

export type JobWorkingPattern = JobWorkingPatternV1 | JobWorkingPatternV2;

export const DEFAULT_JOB_WORKING_PATTERN: JobWorkingPatternV1 = Object.freeze({
    version: 1,
    weekdays: Object.freeze([1, 2, 3, 4, 5]),
});

export function isJobWorkingPatternV2(pattern: JobWorkingPattern): pattern is JobWorkingPatternV2 {
    return pattern.version === 2;
}

function freezeV1(weekdays: number[]): JobWorkingPatternV1 {
    return Object.freeze({ version: 1, weekdays: Object.freeze([...weekdays]) });
}

function parseWeekdays(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.length < 1 || value.length > 7) return null;
    const weekdays: number[] = [];
    for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) return null;
        const day = value[index];
        if (!Number.isInteger(day) || day < 0 || day > 6) return null;
        weekdays.push(day);
    }
    if (new Set(weekdays).size !== weekdays.length) return null;
    return weekdays;
}

function parseInterval(value: unknown): JobWorkingInterval | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some(key => key !== "weekday" && key !== "startMinute" && key !== "endMinute")) return null;
    const weekday = row.weekday;
    const startMinute = row.startMinute;
    const endMinute = row.endMinute;
    if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
    if (typeof startMinute !== "number" || !Number.isInteger(startMinute) || startMinute < 0 || startMinute >= 1440) return null;
    if (typeof endMinute !== "number" || !Number.isInteger(endMinute) || endMinute < 0 || endMinute >= 1440) return null;
    if (startMinute === endMinute) return null;
    return { weekday, startMinute, endMinute };
}

function intervalSpanMinutes(interval: JobWorkingInterval): number {
    if (interval.endMinute > interval.startMinute) return interval.endMinute - interval.startMinute;
    return (1440 - interval.startMinute) + interval.endMinute;
}

function sameDayPortion(interval: JobWorkingInterval): { start: number; end: number } {
    if (interval.endMinute > interval.startMinute) return { start: interval.startMinute, end: interval.endMinute };
    return { start: interval.startMinute, end: 1440 };
}

function intervalsOverlap(a: JobWorkingInterval, b: JobWorkingInterval): boolean {
    if (a.weekday !== b.weekday) return false;
    const left = sameDayPortion(a);
    const right = sameDayPortion(b);
    return left.start < right.end && right.start < left.end;
}

function referenceIsoForWeekday(weekday: number): string {
    const base = new Date(Date.UTC(2026, 9, 18));
    for (let offset = 0; offset < 7; offset += 1) {
        const probe = new Date(base.getTime() + offset * 86_400_000);
        if (probe.getUTCDay() === weekday) return probe.toISOString().slice(0, 10);
    }
    return "2026-10-18";
}

function validateV2Intervals(pattern: Omit<JobWorkingPatternV2, "version">): boolean {
    if (!pattern.intervals.length || pattern.intervals.length > 21) return false;
    for (const interval of pattern.intervals) {
        if (!pattern.weekdays.includes(interval.weekday)) return false;
        if (intervalSpanMinutes(interval) <= 0 || intervalSpanMinutes(interval) > 1440) return false;
        const iso = referenceIsoForWeekday(interval.weekday);
        if (!localWallClockExists(iso, interval.startMinute, pattern.timezone)) return false;
        const endMinute = interval.endMinute > interval.startMinute ? interval.endMinute : interval.endMinute;
        if (!localWallClockExists(iso, endMinute === 0 ? 0 : Math.min(endMinute, 1439), pattern.timezone)) {
            if (interval.endMinute <= interval.startMinute) {
                const next = nextLocalIsoDate(iso, pattern.timezone);
                if (!next || !localWallClockExists(next, interval.endMinute, pattern.timezone)) return false;
            } else return false;
        }
    }
    for (let i = 0; i < pattern.intervals.length; i += 1) {
        for (let j = i + 1; j < pattern.intervals.length; j += 1) {
            if (intervalsOverlap(pattern.intervals[i], pattern.intervals[j])) return false;
        }
    }
    return true;
}

function resolveV2(row: Record<string, unknown>): JobWorkingPatternV2 | null {
    if (row.version !== 2) return null;
    const allowed = new Set(["version", "timezone", "weekdays", "intervals", "standardMinutesPerDay", "productivityPct"]);
    if (Object.keys(row).some(key => !allowed.has(key))) return null;
    const timezone = row.timezone;
    if (typeof timezone !== "string" || !isValidIanaTimeZone(timezone)) return null;
    const weekdays = parseWeekdays(row.weekdays);
    if (!weekdays) return null;
    if (!Array.isArray(row.intervals)) return null;
    const intervals = row.intervals.map(parseInterval);
    if (intervals.some(entry => entry === null)) return null;
    const standardMinutesPerDay = row.standardMinutesPerDay;
    const productivityPct = row.productivityPct;
    if (typeof standardMinutesPerDay !== "number" || !Number.isInteger(standardMinutesPerDay) || standardMinutesPerDay < 1 || standardMinutesPerDay > 1440 * 7) return null;
    if (typeof productivityPct !== "number" || !Number.isInteger(productivityPct) || productivityPct < 1 || productivityPct > 100) return null;
    const draft = {
        timezone,
        weekdays,
        intervals: intervals as JobWorkingInterval[],
        standardMinutesPerDay,
        productivityPct,
    };
    if (!validateV2Intervals(draft)) return null;
    return Object.freeze({
        version: 2,
        timezone,
        weekdays: Object.freeze(weekdays),
        intervals: Object.freeze(intervals.map(interval => Object.freeze({ ...interval! }))),
        standardMinutesPerDay,
        productivityPct,
    });
}

/** Missing legacy patterns retain Monday-Friday; malformed explicit data fails closed. */
export function resolveJobWorkingPattern(value: unknown): JobWorkingPattern | null {
    if (value == null) return DEFAULT_JOB_WORKING_PATTERN;
    if (typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (row.version === 2) return resolveV2(row);
    if (Object.keys(row).some(key => key !== "version" && key !== "weekdays") || row.version !== 1 || !Array.isArray(row.weekdays)) return null;
    const weekdays = parseWeekdays(row.weekdays);
    return weekdays ? freezeV1(weekdays) : null;
}

/** Weekday order does not change the meaning of the legacy Monday-Friday week. Version 2 is never default. */
export function isDefaultJobWorkingPattern(pattern: JobWorkingPattern): boolean {
    if (pattern.version !== 1) return false;
    return pattern.weekdays.length === 5 && DEFAULT_JOB_WORKING_PATTERN.weekdays.every(day => pattern.weekdays.includes(day));
}

export function intervalMinutesOnLocalDay(pattern: JobWorkingPatternV2, weekday: number): number {
    let total = 0;
    for (const interval of pattern.intervals) {
        if (interval.endMinute > interval.startMinute) {
            if (interval.weekday === weekday) total += interval.endMinute - interval.startMinute;
            continue;
        }
        if (interval.weekday === weekday) total += 1440 - interval.startMinute;
        const nextWeekday = (interval.weekday + 1) % 7;
        if (nextWeekday === weekday) total += interval.endMinute;
    }
    return total;
}

export function effectiveLocalDayMinutes(pattern: JobWorkingPatternV2, weekday: number): number {
    return Math.round(intervalMinutesOnLocalDay(pattern, weekday) * (pattern.productivityPct / 100));
}

const DAY_MS = 86_400_000;
const worksUtc = (ms: number, pattern: JobWorkingPatternV1) => pattern.weekdays.includes(new Date(ms).getUTCDay());

function rollForwardUtc(ms: number, pattern: JobWorkingPatternV1): number {
    while (!worksUtc(ms, pattern)) ms += DAY_MS;
    return ms;
}

function isoDateUtc(ms: number): string | null {
    const date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return null;
    const iso = date.toISOString().slice(0, 10);
    return parseIsoDate(iso) === ms ? iso : null;
}

function rollForwardLocal(iso: string, pattern: JobWorkingPatternV2): string | null {
    let current = iso;
    for (let guard = 0; guard < 4000; guard += 1) {
        const weekday = localWeekday(current, pattern.timezone);
        if (weekday !== null && pattern.weekdays.includes(weekday) && effectiveLocalDayMinutes(pattern, weekday) > 0) return current;
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return null;
        current = next;
    }
    return null;
}

function addJobWorkingDaysV2(startIso: string, workingDays: number, pattern: JobWorkingPatternV2): string | null {
    if (!Number.isFinite(workingDays) || workingDays < 1 || !Number.isSafeInteger(Math.round(workingDays))) return null;
    if (localStartOfDayUtc(startIso, pattern.timezone) === null) return null;
    const required = Math.round(workingDays) * pattern.standardMinutesPerDay;
    let current = rollForwardLocal(startIso, pattern);
    if (!current) return null;
    let accumulated = 0;
    for (let guard = 0; guard < 5000; guard += 1) {
        const weekday = localWeekday(current, pattern.timezone);
        if (weekday !== null && pattern.weekdays.includes(weekday)) {
            accumulated += effectiveLocalDayMinutes(pattern, weekday);
            if (accumulated >= required) return current;
        }
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return null;
        current = next;
    }
    return null;
}

function countJobWorkingDaysV2(startIso: string, endIso: string, pattern: JobWorkingPatternV2): number {
    const startUtc = localStartOfDayUtc(startIso, pattern.timezone);
    const endUtc = localStartOfDayUtc(endIso, pattern.timezone);
    if (startUtc === null || endUtc === null || endUtc < startUtc) return 0;
    let current = startIso;
    let capacity = 0;
    for (let guard = 0; guard < 5000; guard += 1) {
        const weekday = localWeekday(current, pattern.timezone);
        if (weekday !== null && pattern.weekdays.includes(weekday)) capacity += effectiveLocalDayMinutes(pattern, weekday);
        if (current === endIso) break;
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return 0;
        current = next;
    }
    return Math.floor(capacity / pattern.standardMinutesPerDay) || (capacity > 0 ? 1 : 0);
}

export function isJobWorkingDay(iso: string, value?: unknown): boolean {
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern) return false;
    if (isJobWorkingPatternV2(pattern)) {
        const weekday = localWeekday(iso, pattern.timezone);
        return weekday !== null && pattern.weekdays.includes(weekday) && effectiveLocalDayMinutes(pattern, weekday) > 0;
    }
    const ms = parseIsoDate(iso);
    return ms !== null && worksUtc(ms, pattern);
}

/** Inclusive duration; a non-working start rolls forward. Version 2 uses explicit capacity minutes per day. */
export function addJobWorkingDays(startIso: string, workingDays: number, value?: unknown): string | null {
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern) return null;
    if (isJobWorkingPatternV2(pattern)) return addJobWorkingDaysV2(startIso, workingDays, pattern);
    const start = parseIsoDate(startIso);
    if (start === null || !Number.isFinite(workingDays) || workingDays < 1 || !Number.isSafeInteger(Math.round(workingDays))) return null;
    let cursor = rollForwardUtc(start, pattern), remaining = Math.round(workingDays) - 1;
    const weeks = Math.floor(remaining / pattern.weekdays.length);
    cursor += weeks * 7 * DAY_MS;
    remaining -= weeks * pattern.weekdays.length;
    if (!Number.isFinite(new Date(cursor).getTime())) return null;
    while (remaining > 0) {
        cursor += DAY_MS;
        if (!Number.isFinite(new Date(cursor).getTime())) return null;
        if (worksUtc(cursor, pattern)) remaining -= 1;
    }
    return isoDateUtc(cursor);
}

export function nextJobWorkingDayAfter(iso: string, value?: unknown): string | null {
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern) return null;
    if (isJobWorkingPatternV2(pattern)) {
        const next = nextLocalIsoDate(iso, pattern.timezone);
        return next ? rollForwardLocal(next, pattern) : null;
    }
    const ms = parseIsoDate(iso);
    return ms !== null ? isoDateUtc(rollForwardUtc(ms + DAY_MS, pattern)) : null;
}

/** Working dates in an inclusive range. Version 2 counts capacity-sized days from explicit intervals. */
export function countJobWorkingDays(startIso: string, endIso: string, value?: unknown): number {
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern) return 0;
    if (isJobWorkingPatternV2(pattern)) return countJobWorkingDaysV2(startIso, endIso, pattern);
    const start = parseIsoDate(startIso), end = parseIsoDate(endIso);
    if (start === null || end === null || end < start) return 0;
    const days = Math.round((end - start) / DAY_MS) + 1, weeks = Math.floor(days / 7);
    let count = weeks * pattern.weekdays.length;
    for (let cursor = start + weeks * 7 * DAY_MS; cursor <= end; cursor += DAY_MS) {
        if (worksUtc(cursor, pattern)) count += 1;
    }
    return count;
}

/** Calendar placement, independent of working-day duration or local timezone. */
export function jobCalendarOffset(fromIso: string, toIso: string): number | null {
    const from = parseIsoDate(fromIso), to = parseIsoDate(toIso);
    return from === null || to === null ? null : Math.round((to - from) / DAY_MS);
}

export function describeJobWorkingPattern(pattern: JobWorkingPattern): string {
    if (pattern.version === 1) {
        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const selected = weekdays.filter((_, day) => pattern.weekdays.includes(day)).join(", ");
        return `Working days are ${selected}. A week means ${pattern.weekdays.length} working ${pattern.weekdays.length === 1 ? "day" : "days"}. Bank holidays are not allowed for.`;
    }
    return `Working days follow ${pattern.timezone} local time with explicit intervals and ${pattern.productivityPct}% productivity. Each programme working day is ${pattern.standardMinutesPerDay} productive minutes. Bank holidays are not allowed for.`;
}
