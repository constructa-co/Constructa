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
        weekday: "short",
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

/** UTC ms for local civil midnight at the start of `iso` in `timeZone`, or null when the date is invalid. */
export function localStartOfDayUtc(iso: string, timeZone: string): number | null {
    const match = ISO_RE.exec(iso);
    if (!match || !isValidIanaTimeZone(timeZone)) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    let utc = Date.UTC(year, month - 1, day, 12, 0, 0);
    for (let attempt = 0; attempt < 6; attempt += 1) {
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
    for (const hours of [24, 25, 26, 27, 28]) {
        const next = localIsoDateFromUtc(start + hours * 3_600_000, timeZone);
        if (next && next !== iso) return next;
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

/**
 * True when local wall clock (hour:minute) exists on `iso` in `timeZone`.
 * Fails closed on ambiguous/nonexistent DST wall times.
 */
export function localWallClockExists(iso: string, minuteOfDay: number, timeZone: string): boolean {
    if (minuteOfDay < 0 || minuteOfDay >= 1440 || !Number.isInteger(minuteOfDay)) return false;
    const start = localStartOfDayUtc(iso, timeZone);
    if (start === null) return false;
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const utcMs = start + (hour * 60 + minute) * 60_000;
    const local = partsAt(utcMs, timeZone);
    const back = localStartOfDayUtc(iso, timeZone);
    if (back === null) return false;
    const expectedOffset = utcMs - back;
    const actualOffset = ((local.hour * 60 + local.minute) * 60 + local.second) * 1000;
    if (actualOffset !== expectedOffset) return false;
    const matches = local.year === Number(iso.slice(0, 4))
        && local.month === Number(iso.slice(5, 7))
        && local.day === Number(iso.slice(8, 10))
        && local.hour === hour
        && local.minute === minute;
    if (!matches) return false;
    const roundTrip = localStartOfDayUtc(iso, timeZone)! + expectedOffset;
    return partsAt(roundTrip, timeZone).hour === hour && partsAt(roundTrip, timeZone).minute === minute;
}
