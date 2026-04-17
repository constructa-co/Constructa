/**
 * Constructa — date utilities.
 *
 * P1-8 — UK construction contracts are date-critical (NEC4 cl. 61.3
 * 8-week time bar, FIDIC cl. 20.1 28-day, JCT 2.27.1 "forthwith"
 * with 42 days for detailed particulars). Day-diff math that rounds
 * over millisecond differences will drift by ±1 day at DST
 * transitions (BST ↔ GMT on the last Sunday of March / October),
 * and an off-by-one on a contractual deadline is the difference
 * between a contractor keeping or losing entitlement.
 *
 * This utility normalises both dates to UTC midnight before
 * differencing, which is timezone-agnostic and DST-safe.
 */

/**
 * Number of calendar days between two dates, ignoring time-of-day
 * and timezone. Both dates are normalised to UTC midnight before
 * differencing, so BST/GMT transitions can't produce off-by-one
 * results around the last Sundays of March/October.
 *
 * Returns positive if `a` is later than `b`, negative if earlier.
 *
 * ```ts
 * calendarDayDiff(new Date("2026-04-01"), new Date("2026-03-30")); // 2
 * calendarDayDiff("2026-04-01", "2026-03-30"); // 2 (strings accepted)
 * calendarDayDiff("2026-03-30T23:59:59Z", "2026-04-01T00:00:01Z"); // -2
 * ```
 */
export function calendarDayDiff(a: Date | string, b: Date | string): number {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) {
        return 0;
    }
    const utcA = Date.UTC(da.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate());
    const utcB = Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), db.getUTCDate());
    return Math.round((utcA - utcB) / 86_400_000);
}

/**
 * Convenience: days from today to the given date. Positive when the
 * date is in the future, negative when in the past.
 */
export function daysFromToday(date: Date | string): number {
    return calendarDayDiff(date, new Date());
}

/**
 * Convenience: days from the given date to today. Positive when the
 * date is in the past (e.g. "due 5 days ago" → 5), negative when
 * in the future.
 */
export function daysSince(date: Date | string): number {
    return calendarDayDiff(new Date(), date);
}

/**
 * Add whole calendar days to a date, producing a new date. Returns
 * a Date set to UTC midnight on the resulting day. Useful for
 * computing time_bar_date = dateAware + contractorTimeBarDays.
 */
export function addCalendarDays(date: Date | string, days: number): Date {
    const d = date instanceof Date ? date : new Date(date);
    const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return new Date(utc + days * 86_400_000);
}

/**
 * Format a Date as YYYY-MM-DD (UTC) — suitable for
 * `<input type="date">` values and PostgreSQL DATE columns.
 */
export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
