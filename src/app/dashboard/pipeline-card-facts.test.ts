import { describe, expect, it } from "vitest";
import { pipelineDaysOpenAge, projectAge } from "./pipeline-card-facts";

describe("projectAge", () => {
    const now = Date.parse("2026-11-16T12:00:00.000Z");
    const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

    it.each([
        [0, "today"], [1, "1d"], [13, "13d"], [14, "2w"], [40, "5w"], [90, "12w"],
        [91, "3mo"], [364, "11mo"], [365, "1y"], [412, "1y 1mo"], [729, "1y 11mo"], [730, "2y"],
    ])("labels %i days as %s", (days, label) => {
        expect(projectAge(daysAgo(days), now)).toMatchObject({ days, label });
    });

    it("describes the age in full with the enquiry date", () => {
        expect(projectAge(daysAgo(0), now)?.description).toMatch(/^Open since today \(16 Nov 2026\)$/);
        expect(projectAge(daysAgo(1), now)?.description).toMatch(/^Open 1 day \(15 Nov 2026\)$/);
        expect(projectAge(daysAgo(40), now)?.description).toMatch(/^Open 40 days \(7 Oct 2026\)$/);
    });

    it.each([null, undefined, "", "not a date"])("returns null for %s", value => {
        expect(projectAge(value, now)).toBeNull();
    });

    it("treats small clock skew as today but refuses dates a day or more ahead", () => {
        expect(projectAge(new Date(now + 60_000).toISOString(), now)).toMatchObject({ days: 0, label: "today" });
        expect(projectAge(new Date(now + 86_400_000).toISOString(), now)).toBeNull();
    });
});

describe("pipelineDaysOpenAge", () => {
    const now = Date.parse("2026-11-16T12:00:00.000Z");
    const enquiry = new Date(now - 12 * 86_400_000).toISOString();
    const oldCreated = new Date(now - 218 * 86_400_000).toISOString();

    it("returns null for archived projects even with enquiry_date", () => {
        expect(pipelineDaysOpenAge({ enquiry_date: enquiry, is_archived: true }, now)).toBeNull();
    });

    it("returns null when only created_at is present (no enquiry_date)", () => {
        expect(pipelineDaysOpenAge({ enquiry_date: undefined, is_archived: false }, now)).toBeNull();
        expect(
            pipelineDaysOpenAge({ enquiry_date: null, is_archived: false }, now),
        ).toBeNull();
        expect(projectAge(oldCreated, now)?.days).toBe(218);
        expect(pipelineDaysOpenAge({ enquiry_date: undefined, is_archived: false }, now)).toBeNull();
    });

    it("matches projectAge when enquiry_date is set", () => {
        expect(pipelineDaysOpenAge({ enquiry_date: enquiry, is_archived: false }, now)).toEqual(
            projectAge(enquiry, now),
        );
    });
});