import { parseIsoDate } from "./programme-date";
import {
    elapsedLocalMinutes, isValidIanaTimeZone, localStartOfDayUtc, localWallClockStatus, localWeekday,
    nextLocalIsoDate,
} from "./job-working-local";
import {
    isUkBankHoliday,
    resolveUkBankHolidayDivision,
    ukBankHolidayWorkingDayClause,
    type UkBankHolidayDivision,
} from "./uk-bank-holidays";

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

/** Distinct shift-start weekdays (v2 intervals). Spill-only civil days are not week units. */
export function programmeWeekUnitCount(pattern: JobWorkingPattern): number {
    if (pattern.version === 1) return pattern.weekdays.length;
    return new Set(pattern.intervals.map(interval => interval.weekday)).size;
}

export type WorkingPatternFieldErrors = Record<string, string>;

export function validateWorkingPatternForProgramme(
    pattern: JobWorkingPatternV2, startIso: string | null | undefined, programmeDays: number,
): WorkingPatternFieldErrors {
    const errors: WorkingPatternFieldErrors = {};
    if (!isValidIanaTimeZone(pattern.timezone)) errors.workingPattern = "Enter a valid IANA timezone, for example Europe/London.";
    if (!validateV2IntervalsStructural(pattern)) errors.workingPattern ??= "Fix interval days, overlap, or overnight spill before saving.";
    const start = typeof startIso === "string" ? startIso.trim() : "";
    if (!start || parseIsoDate(start) === null) return errors;
    const maxLocalDays = Math.min(Math.max(programmeDays, 1) * 14 + 14, 5000);
    let current = start;
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

export function explainWorkingPatternDraft(value: unknown, startIso?: string | null): string | null {
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

export interface ProgrammeCalendar {
    pattern: JobWorkingPattern;
    bankHolidayDivision: UkBankHolidayDivision;
}

function isCalendarRow(value: Record<string, unknown>): boolean {
    return "bankHolidayDivision" in value || "pattern" in value || "workingPattern" in value;
}

/**
 * Resolve the pattern and UK bank-holiday division used for programme working-day math.
 * When only a pattern is supplied, England and Wales bank holidays apply unless a division is passed.
 */
export function resolveProgrammeCalendar(
    value?: unknown,
    bankHolidayDivision?: UkBankHolidayDivision | null,
): ProgrammeCalendar | null {
    const division = bankHolidayDivision ?? "england-and-wales";
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const row = value as Record<string, unknown>;
        if (isCalendarRow(row)) {
            const pattern = resolveJobWorkingPattern(row.pattern ?? row.workingPattern);
            if (!pattern) return null;
            const fromRow = row.bankHolidayDivision;
            const resolvedDivision = typeof fromRow === "string"
                ? (fromRow as UkBankHolidayDivision)
                : division;
            return { pattern, bankHolidayDivision: resolvedDivision };
        }
    }
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern) return null;
    return { pattern, bankHolidayDivision: division };
}

export function programmeCalendarForProject(project: { region?: string | null }, patternValue?: unknown): ProgrammeCalendar | null {
    return resolveProgrammeCalendar(patternValue, resolveUkBankHolidayDivision(project.region));
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
const DAY_MINUTES_CACHE_MAX = 8000;

function cacheDayMinutes(key: string, value: number | null) {
    if (dayMinutesCache.size >= DAY_MINUTES_CACHE_MAX) {
        const first = dayMinutesCache.keys().next().value;
        if (first !== undefined) dayMinutesCache.delete(first);
    }
    dayMinutesCache.set(key, value);
}

/** End minute is exclusive; validates start + last included minute and elapsed vs wall span. */
function openLocalIntervalElapsed(
    startIso: string, startMinute: number, endIso: string, endMinute: number, timeZone: string,
): number | null {
    if (localWallClockStatus(startIso, startMinute, timeZone) !== "unique") return null;
    if (endIso === startIso) {
        if (endMinute <= startMinute) return null;
        const lastIncluded = endMinute - 1;
        if (localWallClockStatus(endIso, lastIncluded, timeZone) !== "unique") return null;
        const elapsed = elapsedLocalMinutes(startIso, startMinute, endIso, endMinute, timeZone);
        if (elapsed === null || elapsed !== endMinute - startMinute) return null;
        return elapsed;
    }
    if (endMinute > 0) {
        const lastIncluded = endMinute - 1;
        if (localWallClockStatus(endIso, lastIncluded, timeZone) !== "unique") return null;
    }
    const elapsed = elapsedLocalMinutes(startIso, startMinute, endIso, endMinute, timeZone);
    if (elapsed === null) return null;
    const wallSpan = (1440 - startMinute) + endMinute;
    if (elapsed !== wallSpan) return null;
    return elapsed;
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
        cacheDayMinutes(key, null);
        return null;
    }
    const next = nextLocalIsoDate(iso, pattern.timezone);
    let total = 0;
    for (const interval of pattern.intervals) {
        if (interval.endMinute > interval.startMinute) {
            if (interval.weekday !== weekday) continue;
            const elapsed = openLocalIntervalElapsed(iso, interval.startMinute, iso, interval.endMinute, pattern.timezone);
            if (elapsed === null) {
                cacheDayMinutes(key, null);
                return null;
            }
            total += elapsed;
            continue;
        }
        if (interval.weekday === weekday && next) {
            const elapsed = openLocalIntervalElapsed(iso, interval.startMinute, next, 0, pattern.timezone);
            if (elapsed === null) {
                cacheDayMinutes(key, null);
                return null;
            }
            total += elapsed;
        }
        const spillDay: number = (interval.weekday + 1) % 7;
        if (spillDay === weekday && interval.endMinute > 0) {
            const elapsed = openLocalIntervalElapsed(iso, 0, iso, interval.endMinute, pattern.timezone);
            if (elapsed === null) {
                cacheDayMinutes(key, null);
                return null;
            }
            total += elapsed;
        }
    }
    const rounded = Math.round(total * (pattern.productivityPct / 100));
    cacheDayMinutes(key, rounded);
    return rounded;
}

/** Version 1 patterns carry no capacity, so a programme day is the conventional eight hours. */
const DEFAULT_PRODUCTIVE_MINUTES_PER_DAY = 480;

/** Productive minutes in one programme working day: the explicit capacity for version 2, eight hours otherwise. */
export function jobProductiveMinutesPerDay(value?: unknown): number {
    const pattern = resolveJobWorkingPattern(value);
    return pattern && isJobWorkingPatternV2(pattern) ? pattern.standardMinutesPerDay : DEFAULT_PRODUCTIVE_MINUTES_PER_DAY;
}

/**
 * The first civil date on or after `iso` with working capacity: where a run of
 * working days actually begins. Version 2 only; null for anything else.
 */
export function jobCapacityStartDay(iso: string, value?: unknown): string | null {
    const calendar = resolveProgrammeCalendar(value);
    return calendar && isJobWorkingPatternV2(calendar.pattern)
        ? rollForwardLocal(iso, calendar.pattern, calendar, maxLocalWalkDays(60))
        : null;
}

/**
 * Productive minutes on the civil dates from `startIso` to `endIso`, both
 * included. An overnight shift contributes to the date each part falls on, so
 * this measures work rather than how many dates it touches. Version 2 only;
 * null when the pattern is not version 2 or a date cannot be resolved.
 */
export function jobCapacityMinutes(startIso: string, endIso: string, value?: unknown): number | null {
    const pattern = resolveJobWorkingPattern(value);
    if (!pattern || !isJobWorkingPatternV2(pattern)) return null;
    const startUtc = localStartOfDayUtc(startIso, pattern.timezone);
    const endUtc = localStartOfDayUtc(endIso, pattern.timezone);
    if (startUtc === null || endUtc === null) return null;
    if (endUtc < startUtc) return 0;
    let current = startIso;
    let total = 0;
    const maxDays = maxLocalWalkDays(Math.ceil((endUtc - startUtc) / DAY_MS) + 1);
    for (let guard = 0; guard < maxDays; guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return null;
        total += minutes;
        if (current === endIso) return total;
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return null;
        current = next;
    }
    return null;
}

export function clearJobWorkingPatternCachesForTests() {
    dayMinutesCache.clear();
}

const DAY_MS = 86_400_000;

function worksUtc(ms: number, pattern: JobWorkingPatternV1, calendar: ProgrammeCalendar): boolean {
    if (!pattern.weekdays.includes(new Date(ms).getUTCDay())) return false;
    const iso = isoDateUtc(ms);
    return iso !== null && !isUkBankHoliday(iso, calendar.bankHolidayDivision);
}

function rollForwardUtc(ms: number, pattern: JobWorkingPatternV1, calendar: ProgrammeCalendar): number {
    while (!worksUtc(ms, pattern, calendar)) ms += DAY_MS;
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

function rollForwardLocal(
    iso: string, pattern: JobWorkingPatternV2, calendar: ProgrammeCalendar, maxDays = 400,
): string | null {
    let current = iso;
    for (let guard = 0; guard < maxDays; guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return null;
        if (minutes > 0 && !isUkBankHoliday(current, calendar.bankHolidayDivision)) return current;
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return null;
        current = next;
    }
    return null;
}

function addJobWorkingDaysV2(startIso: string, workingDays: number, pattern: JobWorkingPatternV2, calendar: ProgrammeCalendar): string | null {
    if (!Number.isFinite(workingDays) || workingDays < 1 || !Number.isSafeInteger(Math.round(workingDays))) return null;
    if (localStartOfDayUtc(startIso, pattern.timezone) === null) return null;
    const required = Math.round(workingDays) * pattern.standardMinutesPerDay;
    let current = rollForwardLocal(startIso, pattern, calendar, maxLocalWalkDays(workingDays));
    if (!current) return null;
    let accumulated = 0;
    for (let guard = 0; guard < maxLocalWalkDays(workingDays); guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return null;
        if (minutes > 0 && !isUkBankHoliday(current, calendar.bankHolidayDivision)) {
            accumulated += minutes;
            if (accumulated >= required) return current;
        }
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return null;
        current = next;
    }
    return null;
}

function countJobWorkingDaysV2(startIso: string, endIso: string, pattern: JobWorkingPatternV2, calendar: ProgrammeCalendar): number {
    const startUtc = localStartOfDayUtc(startIso, pattern.timezone);
    const endUtc = localStartOfDayUtc(endIso, pattern.timezone);
    if (startUtc === null || endUtc === null || endUtc < startUtc) return 0;
    let current = startIso;
    let count = 0;
    const maxDays = maxLocalWalkDays(Math.ceil((endUtc - startUtc) / DAY_MS) + 1);
    for (let guard = 0; guard < maxDays; guard += 1) {
        const minutes = effectiveLocalDayMinutesOnDate(current, pattern);
        if (minutes === null) return 0;
        if (minutes > 0 && !isUkBankHoliday(current, calendar.bankHolidayDivision)) count += 1;
        if (current === endIso) break;
        const next = nextLocalIsoDate(current, pattern.timezone);
        if (!next) return 0;
        current = next;
    }
    return count;
}

function walkAddV1(startIso: string, workingDays: number, calendar: ProgrammeCalendar): string | null {
    const pattern = calendar.pattern;
    if (pattern.version !== 1) return null;
    const start = parseIsoDate(startIso);
    if (start === null) return null;
    let cursor = rollForwardUtc(start, pattern, calendar);
    let remaining = Math.round(workingDays) - 1;
    for (let guard = 0; guard < maxLocalWalkDays(workingDays) && remaining > 0; guard += 1) {
        cursor += DAY_MS;
        if (!Number.isFinite(new Date(cursor).getTime())) return null;
        if (worksUtc(cursor, pattern, calendar)) remaining -= 1;
    }
    return remaining === 0 ? isoDateUtc(cursor) : null;
}

export function isJobWorkingDay(iso: string, value?: unknown): boolean {
    const calendar = resolveProgrammeCalendar(value);
    if (!calendar) return false;
    const pattern = calendar.pattern;
    if (isJobWorkingPatternV2(pattern)) {
        const minutes = effectiveLocalDayMinutesOnDate(iso, pattern);
        return minutes !== null && minutes > 0 && !isUkBankHoliday(iso, calendar.bankHolidayDivision);
    }
    const ms = parseIsoDate(iso);
    return ms !== null && worksUtc(ms, pattern, calendar);
}

/** Inclusive duration; a non-working start rolls forward. Version 2 uses explicit capacity minutes per day. */
export function addJobWorkingDays(startIso: string, workingDays: number, value?: unknown): string | null {
    const calendar = resolveProgrammeCalendar(value);
    if (!calendar) return null;
    const pattern = calendar.pattern;
    if (!Number.isFinite(workingDays) || workingDays < 1 || !Number.isSafeInteger(Math.round(workingDays))) return null;
    if (isJobWorkingPatternV2(pattern)) return addJobWorkingDaysV2(startIso, workingDays, pattern, calendar);
  return walkAddV1(startIso, workingDays, calendar);
}

export function nextJobWorkingDayAfter(iso: string, value?: unknown): string | null {
    const calendar = resolveProgrammeCalendar(value);
    if (!calendar) return null;
    const pattern = calendar.pattern;
    if (isJobWorkingPatternV2(pattern)) {
        const next = nextLocalIsoDate(iso, pattern.timezone);
        return next ? rollForwardLocal(next, pattern, calendar) : null;
    }
    const ms = parseIsoDate(iso);
    return ms !== null ? isoDateUtc(rollForwardUtc(ms + DAY_MS, pattern, calendar)) : null;
}

/** Working dates in an inclusive range. Version 2 counts capacity-sized days from explicit intervals. */
export function countJobWorkingDays(startIso: string, endIso: string, value?: unknown): number {
    const calendar = resolveProgrammeCalendar(value);
    if (!calendar) return 0;
    const pattern = calendar.pattern;
    if (isJobWorkingPatternV2(pattern)) return countJobWorkingDaysV2(startIso, endIso, pattern, calendar);
    const start = parseIsoDate(startIso), end = parseIsoDate(endIso);
    if (start === null || end === null || end < start) return 0;
    let count = 0;
    const maxDays = Math.min(5000, Math.round((end - start) / DAY_MS) + 1);
    for (let cursor = start, guard = 0; guard <= maxDays && cursor <= end; guard += 1, cursor += DAY_MS) {
        if (worksUtc(cursor, pattern, calendar)) count += 1;
    }
    return count;
}

/** Calendar placement, independent of working-day duration or local timezone. */
export function jobCalendarOffset(fromIso: string, toIso: string): number | null {
    const from = parseIsoDate(fromIso), to = parseIsoDate(toIso);
    return from === null || to === null ? null : Math.round((to - from) / DAY_MS);
}

export function describeJobWorkingPattern(pattern: JobWorkingPattern, bankHolidayDivision?: ProgrammeCalendar["bankHolidayDivision"]): string {
    const bankClause = ukBankHolidayWorkingDayClause(bankHolidayDivision ?? "england-and-wales");
    if (pattern.version === 1) {
        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const selected = weekdays.filter((_, day) => pattern.weekdays.includes(day)).join(", ");
        return `Working days are ${selected}. A week means ${pattern.weekdays.length} working ${pattern.weekdays.length === 1 ? "day" : "days"}. ${bankClause}`;
    }
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const days = names.filter((_, day) => pattern.weekdays.includes(day)).join(", ");
    const intervals = [...pattern.intervals]
        .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute || a.endMinute - b.endMinute)
        .map(interval => `${names[interval.weekday]} ${clock(interval.startMinute)}-${clock(interval.endMinute)}`)
        .join("; ");
    return `Working days follow ${pattern.timezone} local time. Working weekdays are ${days}. Working intervals are ${intervals}. Productivity is ${pattern.productivityPct}%. Each programme working day is ${pattern.standardMinutesPerDay} productive minutes. ${bankClause}`;
}
