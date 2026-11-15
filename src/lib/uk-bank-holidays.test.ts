import { describe, expect, it } from "vitest";
import {
    addWorkingDays,
    countWorkingDays,
} from "./programme-plan";
import {
    isUkBankHoliday,
    mergeGovUkBankHolidayFeed,
    programmeBankHolidayBasisNote,
    resetUkBankHolidayFeedOverlayForTests,
    resolveUkBankHolidayDivision,
    type GovUkBankHolidaysFeed,
    type UkBankHolidayDivision,
} from "./uk-bank-holidays";
import bundled from "@/data/uk-bank-holidays-bundled.json";

describe("UK bank holidays (CON-004)", () => {
    it("resolves GOV.UK divisions from project regions", () => {
        expect(resolveUkBankHolidayDivision(null)).toBe("england-and-wales");
        expect(resolveUkBankHolidayDivision("London")).toBe("england-and-wales");
        expect(resolveUkBankHolidayDivision("Scotland")).toBe("scotland");
        expect(resolveUkBankHolidayDivision("Glasgow")).toBe("scotland");
        expect(resolveUkBankHolidayDivision("Belfast")).toBe("northern-ireland");
        expect(resolveUkBankHolidayDivision("Northern Ireland")).toBe("northern-ireland");
    });

    it("recognises England and Wales dates from the bundled fallback", () => {
        expect(isUkBankHoliday("2027-03-29", "england-and-wales")).toBe(true);
        expect(isUkBankHoliday("2027-03-29", "scotland")).toBe(false);
    });

    it("counts 65 England working days from Monday 1 February 2027 to Wednesday 5 May 2027", () => {
        const start = "2027-02-01";
        const end = addWorkingDays(start, 65, { bankHolidayDivision: "england-and-wales" });
        expect(end).toBe("2027-05-05");
        expect(countWorkingDays(start, end!, { bankHolidayDivision: "england-and-wales" })).toBe(65);
        expect(programmeBankHolidayBasisNote("england-and-wales")).toContain("England and Wales");
    });

    it("merges a GOV.UK feed over the bundled fallback without dropping bundled dates", () => {
        resetUkBankHolidayFeedOverlayForTests();
        const baseline = bundled as GovUkBankHolidaysFeed;
        const extra: GovUkBankHolidaysFeed = {
            "england-and-wales": {
                division: "england-and-wales",
                events: [{ title: "Synthetic test day", date: "2099-01-02", notes: "", bunting: false }],
            },
            scotland: { ...baseline.scotland, events: [...baseline.scotland.events] },
            "northern-ireland": { ...baseline["northern-ireland"], events: [...baseline["northern-ireland"].events] },
        };
        mergeGovUkBankHolidayFeed(extra);
        expect(isUkBankHoliday("2099-01-02", "england-and-wales")).toBe(true);
        expect(isUkBankHoliday("2027-03-26", "england-and-wales")).toBe(true);
        resetUkBankHolidayFeedOverlayForTests();
    });

    it.each([
        ["england-and-wales", "2027-01-01"],
        ["scotland", "2027-01-01"],
        ["northern-ireland", "2027-01-01"],
    ] as const satisfies readonly [UkBankHolidayDivision, string][])(
        "treats %s new year substitute dates as non-working",
        (division, date) => {
            expect(isUkBankHoliday(date, division)).toBe(true);
        },
    );
});