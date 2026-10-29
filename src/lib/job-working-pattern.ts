import { parseIsoDate } from "./programme-date";
import {
    elapsedLocalMinutes, isValidIanaTimeZone, localStartOfDayUtc, localWallClockStatus, localWeekday,
    nextLocalIsoDate,
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

interface IntervalSegment {
    weekday: number;
    start: number;
    end: number;
}

function intervalSegments(interval: JobWorkingInterval): IntervalSegment[] {
    if (interval.endMinute > interval.startMinute) {
        return [{ weekday: interval.weekday, start: interval.startMinute, end: interval.endMinute }];
    }
    return [
        { weekday: interval.weekday, start: interval.startMinute, end: 1440 },
        { weekday: (interval.weekday + 1) % 7, start: 0, end: interval.endMinute },
    ];
}

function segmentsOverlap(left: IntervalSegment, right: IntervalSegment): boolean {
    if (left.weekday !== right.weekday) return false;
    return left.start < right.end && right.start < left.end;
}

function overnightSpillAllowed(pattern: Omit<JobWorkingPatternV2, "version">, interval: JobWorkingInterval): boolean {
    if (interval.endMinute > interval.startMinute) return true;
    const spillWeekday = (interval.weekday + 1) % 7;
    return interval.endMinute === 0 || pattern.weekdays.includes(spillWeekday);
}

function validateV2IntervalsStructural(pattern: Omit<JobWorkingPatternV2, "version">): boolean {
    if (!pattern.intervals.length || pattern.intervals.length > 21) return false;
    const segments: IntervalSegment[] = [];
    for (const interval of pattern.intervals) {
        if (!pattern.weekdays.includes(interval.weekday)) return false;
        if (intervalSpanMinutes(interval) <= 0 || intervalSpanMinutes(interval) > 1440) return false;
        if (!overnightSpillAllowed(pattern, interval)) return false;
        segments.push(...intervalSegments(interval));
    }
    for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
            if (segmentsOverlap(segments[i], segments[j])) return false;
        }
    }
    return true;
}

export function programmeWeekUnitCount(pattern: JobWorkingPattern): number {
    if (pattern.version === 1) return pattern.weekdays.length;
    const active = new Set<number>();
    for (const day of pattern.weekdays) active.add(day);
    for (const interval of pattern.intervals) {
        active.add(interval.weekday);
        if (interval.endMinute <= interval.startMinute) active.add((interval.weekday + 1) % 7);
    }
    return active.size;
}

export type WorkingPatternFieldErrors = Record<string, string>;

export function validateWorkingPatternForProgramme(
    pattern: JobWorkingPatternV2, startIso: string, programmeDays: number,
): WorkingPatternFieldErrors {
    const errors: WorkingPatternFieldErrors = {};
    if (!isValidIanaTimeZone(pattern.timezone)) errors.workingPattern = "Enter a valid IANA timezone, for example Europe/London.";
    if (!validateV2IntervalsStructural(pattern)) errors.workingPattern ??= "Fix interval days, overlap, or overnight spill before saving.";
    const maxLocalDays = Math.min(Math.max(programmeDays, 1) * 14 + 14, 120);
    let current = startIso;
    for (let step = 0; step < maxLocalDays; step += 1) {
        if (effectiveLocalDayMinutesOnDate(current, pattern) === null) {
            errors.workingPattern = `Working hours are not supported on ${current} in ${pattern.timezone}. Adjust intervals or the start date.`;
            break;
        }
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) break;
        current = next;
    }
    return errors;
}

export function explainWorkingPatternDraft(value: unknown, startIso = "2026-01-05"): string | null {
    if (value == null) return null;
    if (typeof value !== "object" || Array.isArray(value) || (value as { version?: unknown }).version !== 2) return null;
    const row = value as Record<string, unknown>;
    if (typeof row.timezone !== "string" || !row.timezone.trim()) return "Enter the job timezone (IANA).";
    if (!isValidIanaTimeZone(row.timezone.trim())) return "Enter a valid IANA timezone, for example Europe/London.";
    const resolved = resolveJobWorkingPattern(value);
    if (!resolved || resolved.version !== 2) return "Complete every interval, capacity field, and working day before saving.";
    const schedule = validateWorkingPatternForProgramme(resolved, startIso, 60);
    return schedule.workingPattern ?? null;
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
    if (!validateV2IntervalsStructural(draft)) return null;
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
    for (const segment of pattern.intervals.flatMap(intervalSegments)) {
        if (segment.weekday === weekday) total += segment.end - segment.start;
    }
    return total;
}

export function effectiveLocalDayMinutes(pattern: JobWorkingPatternV2, weekday: number): number {
    return Math.round(intervalMinutesOnLocalDay(pattern, weekday) * (pattern.productivityPct / 100));
}

const dayMinutesCache = new Map<string, number | null>();

const wallSupportCache = new Map<string, boolean>();

function openWallMinutesSupported(iso: string, startMinute: number, endIso: string, endMinute: number, timeZone: string): boolean {
    const cacheKey = `${timeZone}|${iso}|${startMinute}|${endIso}|${endMinute}`;
    const hit = wallSupportCache.get(cacheKey);
    if (hit !== undefined) return hit;
    const checkRange = (dayIso: string, from: number, to: number) => {
        if (to <= from) return true;
        for (let minute = from; minute < to; minute += 15) {
            if (localWallClockStatus(dayIso, minute, timeZone) !== "unique") return false;
        }
        const last = to - 1;
        return last < from || localWallClockStatus(dayIso, last, timeZone) === "unique";
    };
    const ok = iso === endIso
        ? checkRange(iso, startMinute, endMinute)
        : checkRange(iso, startMinute, 1440) && checkRange(endIso, 0, endMinute);
    wallSupportCache.set(cacheKey, ok);
    return ok;
}

function dayMinutesCacheKey(iso: string, pattern: JobWorkingPatternV2): string {
    return `${pattern.timezone}|${pattern.productivityPct}|${JSON.stringify(pattern.intervals)}|${iso}`;
}

/** Capacity on one local civil date; null when elapsed time cannot be resolved on that date. */
export function effectiveLocalDayMinutesOnDate(iso: string, pattern: JobWorkingPatternV2): number | null {
    const key = dayMinutesCacheKey(iso, pattern);
    if (dayMinutesCache.has(key)) return dayMinutesCache.get(key)!;
    const weekday = localWeekday(iso, pattern.timezone);
    if (weekday === null) {
        dayMinutesCache.set(key, null);
        return null;
    }
    const next = nextLocalIsoDate(iso, pattern.timezone);
    let total = 0;
    for (const interval of pattern.intervals) {
        if (interval.endMinute > interval.startMinute) {
            if (interval.weekday !== weekday) continue;
            if (!openWallMinutesSupported(iso, interval.startMinute, iso, interval.endMinute, pattern.timezone)) {
                dayMinutesCache.set(key, null);
                return null;
            }
            const elapsed = elapsedLocalMinutes(iso, interval.startMinute, iso, interval.endMinute, pattern.timezone);
            if (elapsed === null) {
                dayMinutesCache.set(key, null);
                return null;
            }
            total += elapsed;
            continue;
        }
        if (interval.weekday === weekday && next) {
            if (!openWallMinutesSupported(iso, interval.startMinute, next, 0, pattern.timezone)) {
                dayMinutesCache.set(key, null);
                return null;
            }
            const elapsed = elapsedLocalMinutes(iso, interval.startMinute, next, 0, pattern.timezone);
            if (elapsed === null) {
                dayMinutesCache.set(key, null);
                return null;
            }
            total += elapsed;
        }
        const spillDay: number = (interval.weekday + 1) % 7;
        if (spillDay === weekday && interval.endMinute > 0) {
            if (!openWallMinutesSupported(iso, 0, iso, interval.endMinute, pattern.timezone)) {
                dayMinutesCache.set(key, null);
                return null;
            }
            const elapsed = elapsedLocalMinutes(iso, 0, iso, interval.endMinute, pattern.timezone);
            if (elapsed === null) {
                dayMinutesCache.set(key, null);
                return null;
            }
            total += elapsed;
        }
    }
    const rounded = Math.round(total * (pattern.productivityPct / 100));
    dayMinutesCache.set(key, rounded);
    return rounded;
}

export function clearJobWorkingPatternCachesForTests() {
    dayMinutesCache.clear();
    wallSupportCache.clear();
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

function maxLocalWalkDays(workingDays: number): number {
    return Math.min(5000, Math.max(Math.ceil(workingDays) * 14 + 21, 28));
}

function rollForwardLocal(iso: string, pattern: JobWorkingPatternV2, maxDays = 400): string | null {
    let current = iso;
    for (let guard = 0; guard < maxDays; guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return null;
        if (minutes > 0) return current;
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
    let current = rollForwardLocal(startIso, pattern, maxLocalWalkDays(workingDays));
    if (!current) return null;
    let accumulated = 0;
    let streak = 0;
    let streakMinutes = 0;
    for (let guard = 0; guard < maxLocalWalkDays(workingDays); guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return null;
        if (minutes > 0) {
            if (minutes === streakMinutes) streak += 1;
            else {
                streak = 1;
                streakMinutes = minutes;
            }
            accumulated += minutes;
            if (accumulated >= required) return current;
            if (streak >= 5 && streakMinutes > 0) {
                const blockMinutes = streakMinutes * 5;
                const remaining = required - accumulated;
                const fullBlocks = Math.floor(remaining / blockMinutes);
                if (fullBlocks > 0) {
                    accumulated += fullBlocks * blockMinutes;
                    if (accumulated >= required) {
                        for (let block = 0; block < fullBlocks; block += 1) {
                            for (let day = 0; day < 7; day += 1) {
                                const next = nextLocalIsoDate(current, pattern.timezone);
                                if (!next) return null;
                                current = next;
                            }
                        }
                        return current;
                    }
                    for (let block = 0; block < fullBlocks; block += 1) {
                        for (let day = 0; day < 7; day += 1) {
                            const next = nextLocalIsoDate(current, pattern.timezone);
                            if (!next) return null;
                            current = next;
                        }
                    }
                    streak = 0;
                    streakMinutes = 0;
                    continue;
                }
            }
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
    let credit = 0;
    let programmeDays = 0;
    const maxDays = maxLocalWalkDays(Math.ceil((endUtc - startUtc) / DAY_MS) + 1);
    for (let guard = 0; guard < maxDays; guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return 0;
        if (minutes > 0) {
            credit += minutes;
            while (credit >= pattern.standardMinutesPerDay) {
                programmeDays += 1;
                credit -= pattern.standardMinutesPerDay;
            }
        }
        if (current === endIso) break;
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return 0;
        current = next;
    }
    return programmeDays;
}

export function isJobWorkingDay(iso: string, value?: unknown): boolean {
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern) return false;
    if (isJobWorkingPatternV2(pattern)) {
        const minutes = effectiveLocalDayMinutesOnDate(iso, pattern);
        return minutes !== null && minutes > 0;
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
