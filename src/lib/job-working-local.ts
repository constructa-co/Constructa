/** Local civil calendar helpers for explicit job time zones. Not used for legacy UTC weekday mode. */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const bag: Record<string, string> = {};
    for (const part of formatter.formatToParts(new Date(utcMs))) {
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

/** UTC ms for local civil midnight at the start of `iso` in `timeZone`, or null when the date is invalid. */
export function localStartOfDayUtc(iso: string, timeZone: string): number | null {
    const civil = civilDateParts(iso);
    if (!civil || !isValidIanaTimeZone(timeZone)) return null;
    const { year, month, day } = civil;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
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
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const index = names.indexOf(long);
    return index >= 0 ? index : null;
}

export function nextLocalIsoDate(iso: string, timeZone: string): string | null {
    const start = localStartOfDayUtc(iso, timeZone);
    if (start === null) return null;
    for (const hours of [24, 25, 26, 27, 28, 30, 32]) {
        const next = localIsoDateFromUtc(start + hours * 3_600_000, timeZone);
        if (next && next !== iso) return next;
    }
    return null;
}

export function previousLocalIsoDate(iso: string, timeZone: string): string | null {
    const start = localStartOfDayUtc(iso, timeZone);
    if (start === null) return null;
    for (const hours of [24, 25, 26, 27, 28, 30, 32]) {
        const prev = localIsoDateFromUtc(start - hours * 3_600_000, timeZone);
        if (prev && prev !== iso) return prev;
    }
    return null;
}

export function addLocalCalendarDays(iso: string, days: number, timeZone: string): string | null {
    if (!Number.isInteger(days) || days < 0) return null;
    let current = iso;
    for (let step = 0; step < days; step += 1) {
        const next = nextLocalIsoDate(current, timeZone);
        if (!next) return null;
        current = next;
    }
    return current;
}

export type LocalWallClockStatus = "invalid" | "nonexistent" | "ambiguous" | "unique";

/** Count UTC instants mapping to this local civil date and wall minute. */
export function localWallClockStatus(iso: string, minuteOfDay: number, timeZone: string): LocalWallClockStatus {
    if (minuteOfDay < 0 || minuteOfDay >= 1440 || !Number.isInteger(minuteOfDay)) return "invalid";
    const civil = civilDateParts(iso);
    const start = localStartOfDayUtc(iso, timeZone);
    if (!civil || start === null || !isValidIanaTimeZone(timeZone)) return "invalid";
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    let matches = 0;
    for (let ms = start - 4 * 3_600_000; ms <= start + 28 * 3_600_000; ms += 60_000) {
        const local = partsAt(ms, timeZone);
        if (local.year === civil.year && local.month === civil.month && local.day === civil.day
            && local.hour === hour && local.minute === minute) {
            matches += 1;
            if (matches > 1) return "ambiguous";
        }
    }
    if (matches === 0) return "nonexistent";
    return "unique";
}

export function localWallClockExists(iso: string, minuteOfDay: number, timeZone: string): boolean {
    return localWallClockStatus(iso, minuteOfDay, timeZone) === "unique";
}
