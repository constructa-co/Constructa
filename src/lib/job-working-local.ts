/** Local civil calendar helpers for explicit job time zones. Not used for legacy UTC weekday mode. */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
    let cached = formatterCache.get(timeZone);
    if (!cached) {
        cached = new Intl.DateTimeFormat("en-GB", {
            timeZone,
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        formatterCache.set(timeZone, cached);
    }
    return cached;
}

export function isValidIanaTimeZone(timeZone: string): boolean {
    if (typeof timeZone !== "string" || !timeZone.trim()) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone });
        return true;
    } catch {
        return false;
    }
}

function partsAt(utcMs: number, timeZone: string) {
    const bag: Record<string, string> = {};
    for (const part of formatter(timeZone).formatToParts(new Date(utcMs))) {
        if (part.type !== "literal") bag[part.type] = part.value;
    }
    return {
        year: Number(bag.year),
        month: Number(bag.month),
        day: Number(bag.day),
        hour: Number(bag.hour),
        minute: Number(bag.minute),
        second: Number(bag.second),
    };
}

function civilDateParts(iso: string) {
    const match = ISO_RE.exec(iso);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function matchesWallClock(iso: string, minuteOfDay: number, utcMs: number, timeZone: string): boolean {
    const civil = civilDateParts(iso);
    if (!civil) return false;
    const local = partsAt(utcMs, timeZone);
    return local.year === civil.year && local.month === civil.month && local.day === civil.day
        && local.hour * 60 + local.minute === minuteOfDay;
}

/** UTC ms for local civil midnight at the start of `iso` in `timeZone`, or null when the date is invalid. */
export function localStartOfDayUtc(iso: string, timeZone: string): number | null {
    const civil = civilDateParts(iso);
    if (!civil || !isValidIanaTimeZone(timeZone)) return null;
    const { year, month, day } = civil;
    let utc = Date.UTC(year, month - 1, day, 12, 0, 0);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const local = partsAt(utc, timeZone);
        const deltaDays = (local.year - year) * 372 + (local.month - month) * 31 + (local.day - day);
        if (deltaDays === 0 && local.hour === 0 && local.minute === 0 && local.second === 0) return utc;
        utc -= ((local.hour * 60 + local.minute) * 60 + local.second + deltaDays * 86_400) * 1000;
        if (!Number.isFinite(utc)) return null;
    }
    return null;
}

export function localIsoDateFromUtc(utcMs: number, timeZone: string): string | null {
    if (!Number.isFinite(utcMs) || !isValidIanaTimeZone(timeZone)) return null;
    const local = partsAt(utcMs, timeZone);
    const iso = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
    return ISO_RE.test(iso) ? iso : null;
}

export function localWeekday(iso: string, timeZone: string): number | null {
    const utc = localStartOfDayUtc(iso, timeZone);
    if (utc === null) return null;
    const long = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(new Date(utc));
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(long);
}

export function nextLocalIsoDate(iso: string, timeZone: string): string | null {
    const start = localStartOfDayUtc(iso, timeZone);
    if (start === null) return null;
    for (const hours of [24, 25, 26, 27, 28]) {
        const next = localIsoDateFromUtc(start + hours * 3_600_000, timeZone);
        if (next && next !== iso) return next;
    }
    return null;
}

export function previousLocalIsoDate(iso: string, timeZone: string): string | null {
    const start = localStartOfDayUtc(iso, timeZone);
    if (start === null) return null;
    for (const hours of [24, 25, 26, 27, 28]) {
        const prev = localIsoDateFromUtc(start - hours * 3_600_000, timeZone);
        if (prev && prev !== iso) return prev;
    }
    return null;
}

export type LocalWallClockStatus = "invalid" | "nonexistent" | "ambiguous" | "unique";

const wallUtcCache = new Map<string, number | "ambiguous" | "nonexistent">();

function cacheKey(iso: string, minuteOfDay: number, timeZone: string) {
    return `${timeZone}|${iso}|${minuteOfDay}`;
}

/** Resolve one UTC instant for a local wall minute, bounded search with formatter cache. */
export function resolveWallClockUtc(iso: string, minuteOfDay: number, timeZone: string): number | "ambiguous" | "nonexistent" | "invalid" {
    if (minuteOfDay < 0 || minuteOfDay >= 1440 || !Number.isInteger(minuteOfDay)) return "invalid";
    const key = cacheKey(iso, minuteOfDay, timeZone);
    const hit = wallUtcCache.get(key);
    if (hit !== undefined) return hit === "ambiguous" || hit === "nonexistent" ? hit : hit;
    const start = localStartOfDayUtc(iso, timeZone);
    if (start === null) return "invalid";
    const noon = start + 12 * 3_600_000;
    const noonParts = partsAt(noon, timeZone);
    const offsetMinutes = ((noon - Date.UTC(noonParts.year, noonParts.month - 1, noonParts.day, noonParts.hour, noonParts.minute)) / 60_000);
    const guess = start + minuteOfDay * 60_000 - offsetMinutes * 60_000;
    const matches: number[] = [];
    for (let tweak = -180; tweak <= 180; tweak += 1) {
        const candidate = guess + tweak * 60_000;
        if (matchesWallClock(iso, minuteOfDay, candidate, timeZone)) matches.push(candidate);
        if (matches.length > 1) {
            wallUtcCache.set(key, "ambiguous");
            return "ambiguous";
        }
    }
    if (matches.length === 0) {
        wallUtcCache.set(key, "nonexistent");
        return "nonexistent";
    }
    wallUtcCache.set(key, matches[0]);
    return matches[0];
}

const statusCache = new Map<string, LocalWallClockStatus>();

export function localWallClockStatus(iso: string, minuteOfDay: number, timeZone: string): LocalWallClockStatus {
    const key = cacheKey(iso, minuteOfDay, timeZone);
    const cached = statusCache.get(key);
    if (cached) return cached;
    const resolved = resolveWallClockUtc(iso, minuteOfDay, timeZone);
    const status: LocalWallClockStatus = resolved === "invalid" ? "invalid"
        : resolved === "ambiguous" ? "ambiguous"
            : resolved === "nonexistent" ? "nonexistent"
                : "unique";
    statusCache.set(key, status);
    return status;
}

export function localWallClockExists(iso: string, minuteOfDay: number, timeZone: string): boolean {
    return localWallClockStatus(iso, minuteOfDay, timeZone) === "unique";
}

/** Elapsed minutes between two wall times on one or two local dates (end exclusive at boundary minute). */
export function elapsedLocalMinutes(
    startIso: string, startMinute: number, endIso: string, endMinute: number, timeZone: string,
): number | null {
    const startUtc = resolveWallClockUtc(startIso, startMinute, timeZone);
    const endUtc = resolveWallClockUtc(endIso, endMinute, timeZone);
    if (typeof startUtc !== "number" || typeof endUtc !== "number") return null;
    if (endUtc <= startUtc) return null;
    return Math.round((endUtc - startUtc) / 60_000);
}

export function clearLocalTimeCachesForTests() {
    wallUtcCache.clear();
    formatterCache.clear();
    statusCache.clear();
}
