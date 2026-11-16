import bundledFeed from "@/data/uk-bank-holidays-bundled.json";

/** GOV.UK divisions in https://www.gov.uk/bank-holidays.json */
export type UkBankHolidayDivision = "england-and-wales" | "scotland" | "northern-ireland";

export const UK_BANK_HOLIDAY_DIVISIONS: readonly UkBankHolidayDivision[] = [
    "england-and-wales",
    "scotland",
    "northern-ireland",
];

export const GOV_UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";

const DIVISION_LABELS: Record<UkBankHolidayDivision, string> = {
    "england-and-wales": "England and Wales",
    scotland: "Scotland",
    "northern-ireland": "Northern Ireland",
};

export function ukBankHolidayDivisionLabel(division: UkBankHolidayDivision): string {
    return DIVISION_LABELS[division];
}

export interface GovUkHolidayEvent {
    title?: string;
    date: string;
    notes?: string;
    bunting?: boolean;
}

interface GovUkHolidayDivisionBlock {
    division: UkBankHolidayDivision;
    events: GovUkHolidayEvent[];
}

export type GovUkBankHolidaysFeed = Record<UkBankHolidayDivision, GovUkHolidayDivisionBlock>;

function datesFromFeed(feed: GovUkBankHolidaysFeed, division: UkBankHolidayDivision): Set<string> {
    const block = feed[division];
    if (!block?.events?.length) return new Set();
    return new Set(block.events.map(event => event.date).filter(Boolean));
}

function buildBundledSets(): Record<UkBankHolidayDivision, Set<string>> {
  const feed = bundledFeed as GovUkBankHolidaysFeed;
  return {
    "england-and-wales": datesFromFeed(feed, "england-and-wales"),
    scotland: datesFromFeed(feed, "scotland"),
    "northern-ireland": datesFromFeed(feed, "northern-ireland"),
  };
}

const bundledSets = buildBundledSets();

/** Dates from the latest successful GOV.UK fetch; merged over bundled at lookup time. */
let feedOverlay: Partial<Record<UkBankHolidayDivision, Set<string>>> | null = null;

export function mergeGovUkBankHolidayFeed(feed: GovUkBankHolidaysFeed): void {
    const overlay: Partial<Record<UkBankHolidayDivision, Set<string>>> = {};
    for (const division of UK_BANK_HOLIDAY_DIVISIONS) {
        const merged = new Set(bundledSets[division]);
        for (const date of datesFromFeed(feed, division)) merged.add(date);
        overlay[division] = merged;
    }
    feedOverlay = overlay;
}

export function resetUkBankHolidayFeedOverlayForTests(): void {
    feedOverlay = null;
}

function holidaySet(division: UkBankHolidayDivision): Set<string> {
    return feedOverlay?.[division] ?? bundledSets[division];
}

export function isUkBankHoliday(iso: string, division: UkBankHolidayDivision): boolean {
    return holidaySet(division).has(iso);
}

const SCOTLAND_REGION = /\b(scotland|scottish|highlands?|edinburgh|glasgow|aberdeen|dundee|fife|lothian|grampian|strathclyde|tayside|orkney|shetland|hebrides|inverness|perthshire)\b/i;
const NORTHERN_IRELAND_REGION = /\b(northern ireland|ulster|belfast|antrim|down|armagh|tyrone|fermanagh|londonderry|derry|lisburn|newry)\b/i;

/** Infer the GOV.UK division from a saved project region label. Defaults to England and Wales. */
export function parseUkBankHolidayDivision(value: unknown): UkBankHolidayDivision | null {
    if (typeof value !== "string" || !value.trim()) return null;
    return (UK_BANK_HOLIDAY_DIVISIONS as readonly string[]).includes(value) ? (value as UkBankHolidayDivision) : null;
}

export function resolveUkBankHolidayDivision(region?: string | null): UkBankHolidayDivision {
    const text = typeof region === "string" ? region.trim() : "";
    if (!text) return "england-and-wales";
    if (NORTHERN_IRELAND_REGION.test(text)) return "northern-ireland";
    if (SCOTLAND_REGION.test(text)) return "scotland";
    return "england-and-wales";
}

export function ukBankHolidayWorkingDayClause(division: UkBankHolidayDivision): string {
    return `UK bank holidays for ${ukBankHolidayDivisionLabel(division)} are not working days.`;
}

export function programmeBankHolidayBasisNote(division: UkBankHolidayDivision): string {
    return `Working days are Monday to Friday. ${ukBankHolidayWorkingDayClause(division)}`;
}