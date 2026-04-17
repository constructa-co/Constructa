import { describe, it, expect } from "vitest";
import {
    calendarDayDiff,
    daysFromToday,
    daysSince,
    addCalendarDays,
    toIsoDate,
} from "./dates";

describe("calendarDayDiff", () => {
    it("returns 0 for the same date", () => {
        expect(calendarDayDiff("2026-04-01", "2026-04-01")).toBe(0);
    });

    it("returns positive when a is later than b", () => {
        expect(calendarDayDiff("2026-04-05", "2026-04-01")).toBe(4);
    });

    it("returns negative when a is earlier than b", () => {
        expect(calendarDayDiff("2026-03-30", "2026-04-02")).toBe(-3);
    });

    it("accepts Date objects", () => {
        expect(calendarDayDiff(new Date("2026-04-10"), new Date("2026-04-01"))).toBe(9);
    });

    it("ignores time-of-day within the same calendar day", () => {
        expect(calendarDayDiff("2026-04-01T23:59:59Z", "2026-04-01T00:00:01Z")).toBe(0);
    });

    it("is DST-safe — spring forward (last Sunday March)", () => {
        // UK BST begins 29 March 2026 at 01:00 UTC. A naive local-date
        // subtraction can off-by-one here; our UTC-based diff must not.
        expect(calendarDayDiff("2026-03-30", "2026-03-28")).toBe(2);
        expect(calendarDayDiff("2026-04-01", "2026-03-27")).toBe(5);
    });

    it("is DST-safe — fall back (last Sunday October)", () => {
        // UK BST ends 25 October 2026 at 01:00 UTC.
        expect(calendarDayDiff("2026-10-27", "2026-10-23")).toBe(4);
        expect(calendarDayDiff("2026-10-26", "2026-10-24")).toBe(2);
    });

    it("returns 0 when either input is invalid", () => {
        expect(calendarDayDiff("not-a-date", "2026-04-01")).toBe(0);
        expect(calendarDayDiff("2026-04-01", "")).toBe(0);
    });

    it("handles NEC4 8-week time bar (56 days)", () => {
        // dateAware = 2026-04-01, timeBar = 2026-05-27 (+ 56 days)
        expect(calendarDayDiff("2026-05-27", "2026-04-01")).toBe(56);
    });

    it("handles FIDIC 28-day time bar", () => {
        expect(calendarDayDiff("2026-04-29", "2026-04-01")).toBe(28);
    });

    it("handles FIDIC 42-day detailed claim window", () => {
        expect(calendarDayDiff("2026-05-13", "2026-04-01")).toBe(42);
    });
});

describe("daysFromToday / daysSince", () => {
    it("are opposites", () => {
        const future = new Date();
        future.setUTCDate(future.getUTCDate() + 10);
        expect(daysFromToday(future)).toBe(10);
        expect(daysSince(future)).toBe(-10);
    });
});

describe("addCalendarDays", () => {
    it("adds whole days", () => {
        const result = addCalendarDays("2026-04-01", 56);
        expect(toIsoDate(result)).toBe("2026-05-27");
    });

    it("subtracts with negative", () => {
        const result = addCalendarDays("2026-04-01", -7);
        expect(toIsoDate(result)).toBe("2026-03-25");
    });

    it("crosses DST boundary cleanly", () => {
        // Spring forward weekend
        const result = addCalendarDays("2026-03-28", 2);
        expect(toIsoDate(result)).toBe("2026-03-30");
    });
});

describe("toIsoDate", () => {
    it("formats as YYYY-MM-DD", () => {
        expect(toIsoDate(new Date("2026-04-01T15:30:00Z"))).toBe("2026-04-01");
    });
});
