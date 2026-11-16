import { GOV_UK_BANK_HOLIDAYS_URL, mergeGovUkBankHolidayFeed, type GovUkBankHolidaysFeed } from "./uk-bank-holidays";

const FEED_TTL_MS = 24 * 60 * 60 * 1000;
let lastMergedAtMs = 0;
let inflight: Promise<GovUkBankHolidaysFeed | null> | null = null;

function isFeed(value: unknown): value is GovUkBankHolidaysFeed {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return ["england-and-wales", "scotland", "northern-ireland"].every(key => key in (value as object));
}

/** Refresh programme holiday data from the GOV.UK JSON feed (bundled data remains the offline fallback). */
export async function refreshUkBankHolidaysFromGovUk(force = false): Promise<GovUkBankHolidaysFeed | null> {
    const now = Date.now();
    if (!force && now - lastMergedAtMs < FEED_TTL_MS) return null;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const response = await fetch(GOV_UK_BANK_HOLIDAYS_URL, {
                headers: { Accept: "application/json" },
                next: { revalidate: 86_400 },
            });
            if (!response.ok) return null;
            const feed: unknown = await response.json();
            if (!isFeed(feed)) return null;
            mergeGovUkBankHolidayFeed(feed);
            lastMergedAtMs = Date.now();
            return feed;
        } catch {
            return null;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

export function resetUkBankHolidayFeedRefreshStateForTests(): void {
    lastMergedAtMs = 0;
    inflight = null;
}