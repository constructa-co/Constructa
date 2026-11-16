import { afterEach, describe, expect, it, vi } from "vitest";
import { isUkBankHoliday, resetUkBankHolidayFeedOverlayForTests } from "./uk-bank-holidays";
import { refreshUkBankHolidaysFromGovUk, resetUkBankHolidayFeedRefreshStateForTests } from "./uk-bank-holidays-feed";

describe("GOV.UK bank holiday feed", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        resetUkBankHolidayFeedOverlayForTests();
        resetUkBankHolidayFeedRefreshStateForTests();
    });

    it("merges fetched JSON over the bundled fallback", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({
                "england-and-wales": {
                    division: "england-and-wales",
                    events: [{ title: "Feed only", date: "2099-06-01", notes: "", bunting: false }],
                },
                scotland: { division: "scotland", events: [] },
                "northern-ireland": { division: "northern-ireland", events: [] },
            }),
        })) as unknown as typeof fetch);

        const feed = await refreshUkBankHolidaysFromGovUk(true);
        expect(feed).not.toBeNull();
        expect(isUkBankHoliday("2099-06-01", "england-and-wales")).toBe(true);
    });
});