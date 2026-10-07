/**
 * The synthetic job the journey prices and sends, and the figures it must
 * produce. The expected totals are worked out here from the inputs, not read
 * from the application, so a wrong total anywhere fails the run.
 */

/** The provider stub adds this to every AI reply, so a suggestion can be told from the contractor's own words. */
export const AI_MARKER = "Wording tidied by the assistant.";

export const COMPANY = { trade: "Bathroom & Kitchen Fitting", name: "Example Bathrooms Ltd", owner: "Sam Example" };

export const JOB = {
    name: "14 Example Road bathroom refit",
    client: "Alex Client",
    clientEmail: "alex.client@example.com",
    site: "14 Example Road, Exampleton",
    description: "Strip out the old bathroom and fit a new suite with tiling throughout",
    siteNotes: "Rear access only. Client to clear the room before we start.",
    closing: "Thank you for asking us to price this job.",
    laterEdit: "This sentence was added after version 1 was sent.",
};

export const PRICE = {
    onePrice: { description: "Bathroom refit, labour and materials", amount: 6500 },
    measured: { description: "Wall and floor tiling", quantity: 18, unit: "m2", rate: 65 },
    preliminaries: { description: "Skip hire and site welfare", amount: 450 },
    overheadPct: 10,
    /** Deliberately not a default. */
    riskPct: 7.5,
    profitPct: 12,
    vatPct: 20,
};

/** What the "Deposit and balance" preset must produce, with no arithmetic by the contractor. */
export const PAYMENT_STAGES = [
    { name: "Deposit", share: "30", when: "On booking" },
    { name: "Balance", share: "70", when: "On completion" },
];

const round2 = (value: number) => Math.round(value * 100) / 100;

export const gbp = (value: number) =>
    `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Preliminaries are priced as their own line, so no preliminaries percentage
 * applies. Overhead, then risk, then profit are each added on top of the
 * running figure, and VAT is added to the result.
 */
export function expectedPrice() {
    const lines = PRICE.onePrice.amount + PRICE.measured.quantity * PRICE.measured.rate + PRICE.preliminaries.amount;
    const overhead = lines * (PRICE.overheadPct / 100);
    const risk = (lines + overhead) * (PRICE.riskPct / 100);
    const profit = (lines + overhead + risk) * (PRICE.profitPct / 100);
    const beforeVat = round2(lines + overhead + risk + profit);
    const vat = round2(beforeVat * (PRICE.vatPct / 100));
    // The last payment stage takes the rounding, so the stages add up to the price.
    const deposit = round2(beforeVat * (Number(PAYMENT_STAGES[0].share) / 100));
    return {
        deposit: gbp(deposit),
        balance: gbp(round2(beforeVat - deposit)),
        lines: gbp(lines),
        overhead: gbp(round2(overhead)),
        risk: gbp(round2(risk)),
        profit: gbp(round2(profit)),
        beforeVat: gbp(beforeVat),
        vat: gbp(vat),
        includingVat: gbp(round2(beforeVat + vat)),
    };
}

// ── Programme ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const STAGES = [
    { name: "Strip out", length: "3", unit: "working days", workingDays: 3 },
    { name: "First fix and tiling", length: "2", unit: "weeks", workingDays: 10 },
    { name: "Second fix and finish", length: "4", unit: "working days", workingDays: 4 },
];

const iso = (date: Date) => date.toISOString().slice(0, 10);
const longDate = (date: Date) =>
    `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** The last working day of a job that starts on `start` and lasts `workingDays` (Monday to Friday). */
function finishAfter(start: Date, workingDays: number): Date {
    const date = new Date(start);
    for (let counted = 1; counted < workingDays; ) {
        date.setUTCDate(date.getUTCDate() + 1);
        if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) counted += 1;
    }
    return date;
}

const shortDate = (date: Date, withYear = true) =>
    `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}${withYear ? ` ${date.getUTCFullYear()}` : ""}`;

/** "2 Nov to 4 Nov 2026": the first year is stated only when it differs from the second. */
function shortRange(start: Date, end: Date): string {
    if (start.getTime() === end.getTime()) return shortDate(end);
    return `${shortDate(start, start.getUTCFullYear() !== end.getUTCFullYear())} to ${shortDate(end)}`;
}

/** The first working day after `date`. */
function nextWorkingDay(date: Date): Date {
    const next = new Date(date);
    do next.setUTCDate(next.getUTCDate() + 1); while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
    return next;
}

/** A Monday comfortably in the future, with the finish dates the programme must show. */
export function expectedProgramme(today = new Date()) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 28));
    while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);
    const stagedDays = STAGES.reduce((total, stage) => total + stage.workingDays, 0);
    // Each stage starts on the working day after the one before it finishes.
    let stageStart = new Date(start);
    const stages = STAGES.map((stage) => {
        const finish = finishAfter(stageStart, stage.workingDays);
        const dated = { name: stage.name, dates: shortRange(stageStart, finish) };
        stageStart = nextWorkingDay(finish);
        return dated;
    });
    return {
        /** Every stage by name with the dates it must show, in order. */
        stages,
        startIso: iso(start),
        start: longDate(start),
        /** Three weeks as one bar. */
        simpleFinish: longDate(finishAfter(start, 15)),
        /** The three stages run one after another. */
        stagedFinish: longDate(finishAfter(start, stagedDays)),
    };
}
