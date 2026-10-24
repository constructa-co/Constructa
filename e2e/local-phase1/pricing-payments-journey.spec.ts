import { expect, test, type Download, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import { PROPOSAL_READINESS_PATH } from "../../src/lib/first-session";
import type { LocalPricingPaymentsJourneyFixture } from "./pricing-payments-journey-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    companySetup: "REAL_COMPONENT_MOCK_SAVE",
    readinessHandoff: "REAL_COMPONENT_MOCK_LINK_TO_NEW_JOB",
    newJob: "REAL_COMPONENT over MOCK_CREATE",
    brief: "REAL_COMPONENT over MOCK_SAVE",
    estimate: "REAL_EstimateClient; EMPTY_LINES then MOCK_ACK saveLine; no480seed",
    pricingPaymentStages: "REAL_PricingPaymentStages; MOCK savePricingPaymentStages only; null initial schedule",
    paymentRemount: "REAL_EstimateClient remount from MOCK project store",
    programmeEditor: "REAL_COMPONENT over MOCK_SAVE",
    proposalReviewAndPreview: "REAL_ReviewSendClient/frozen document",
    frozenSnapshot: "REAL_BUILDERS",
    proposalPdf: "REAL_BUILDER (jsPDF) + unpdf text decode",
    clientResponse: "REAL_UI_IN_PREVIEW_ONLY; no acceptance transport exercised",
    publishSendDelivery: "REFUSED_BY_FIXTURE",
    won: "NOT_RUN",
    serverActions: "NOT_RUN (MOCK payment-stage transport only)",
    auth: "NOT_RUN",
    database: "NOT_RUN",
    email: "NOT_RUN",
    durableReload: "NOT_RUN",
    hostedJourney: "NOT_RUN",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const WORK_TYPE = "Roof repairs and small extensions";
const COMPANY = "Example Local Builder";
const OPERATOR = "Test Operator";
const JOB = "Offline payment-stage job: front elevation";
const CLIENT = "Synthetic payment-stage client";
const SITE = "Synthetic site, front elevation";
const TYPE = "Repair";
const START = "2026-11-16";
const WORK = "Renew the front elevation tiles, replace damaged battens and repaint fascia boards.";
const ACTIVITIES = ["Strip and prepare the elevation", "Re-tile and finish the elevation"];
const CREATE = "Create project and start the brief";
const MONDAY = "2026-11-02";
const LINE_DESC = "Synthetic elevation tile renewal per item";
const LINE_QTY = "2";
const LINE_UNIT = "nr";
const LINE_RATE = "100";
const LINE_ACTIVITY = ACTIVITIES[0];
const TOTAL_INC_VAT = "£240.00";
const STAGE_ONE_NAME = "Deposit on acceptance";
const STAGE_ONE_DUE = "Within seven days of accepted proposal";
const STAGE_ONE_PCT = "30";
const STAGE_ONE_AMOUNT = "£60.00";
const STAGE_TWO_NAME = "Completion balance";
const STAGE_TWO_DUE = "On practical completion of the elevation works";
const STAGE_TWO_PCT = "70";
const STAGE_TWO_AMOUNT = "£140.00";
const SEEDED_PAYMENT_MARKER = "When the room is handed over";

const briefPath = (id: string) => `/dashboard/projects/brief?projectId=${encodeURIComponent(id)}`;
const pricingPath = (id: string) => `/dashboard/projects/costs?projectId=${encodeURIComponent(id)}`;
const programmePath = (id: string) => `/dashboard/projects/schedule?projectId=${encodeURIComponent(id)}`;
const proposalPath = (id: string) => `/dashboard/projects/proposal?projectId=${encodeURIComponent(id)}`;

interface FixtureSnapshot {
    view: LocalPricingPaymentsJourneyFixture["view"];
    jobId: string | null;
    estimates: LocalPricingPaymentsJourneyFixture["estimates"];
    priceSaveAcknowledgements: number;
    projectPaymentSchedule: LocalPricingPaymentsJourneyFixture["projectPaymentSchedule"];
    paymentStageSaveAttempts: LocalPricingPaymentsJourneyFixture["paymentStageSaveAttempts"];
    paymentStageAcknowledgements: number;
    pricingRemounts: number;
    programmeSaves: LocalPricingPaymentsJourneyFixture["programmeSaves"];
    projectRowPaymentSchedule: unknown;
    unexpected: string[];
}

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => {
    const f = window.__pricingPaymentsJourneyLocal;
    return {
        view: f.view,
        jobId: f.jobId,
        estimates: f.estimates,
        priceSaveAcknowledgements: f.priceSaveAcknowledgements,
        projectPaymentSchedule: f.projectPaymentSchedule,
        paymentStageSaveAttempts: f.paymentStageSaveAttempts,
        paymentStageAcknowledgements: f.paymentStageAcknowledgements,
        pricingRemounts: f.pricingRemounts,
        programmeSaves: f.programmeSaves,
        projectRowPaymentSchedule: f.projectRow.payment_schedule,
        unexpected: f.unexpected,
    };
});

const fillNewJob = async (page: Page) => {
    await page.getByLabel("Job name", { exact: true }).fill(JOB);
    await page.getByLabel("Client name", { exact: true }).fill(CLIENT);
    const more = page.getByRole("button", { name: /^Add more details/ });
    if (await more.getAttribute("aria-expanded") !== "true") await more.click();
    await page.getByLabel("Where is the job?", { exact: true }).fill(SITE);
    await page.getByLabel("Type of job", { exact: true }).fill(TYPE);
    await page.getByLabel("Likely start date", { exact: true }).fill(START);
};

async function readPdfBytes(download: Download): Promise<Buffer> {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const pdf = Buffer.concat(chunks);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
    return pdf;
}

async function pdfWords(pdf: Buffer): Promise<string> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const proxy = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(proxy, { mergePages: true });
    return text.replace(/\s+/g, " ").trim();
}

const saveFirstPriceLine = async (page: Page) => {
    await page.getByRole("button", { name: "Add the first price line", exact: true }).click();
    await page.getByRole("button", { name: "Show quantities and rates", exact: true }).click();
    await page.getByRole("button", { name: "Quantity and rate", exact: true }).click();
    await page.getByLabel("New work description").fill(LINE_DESC);
    await page.locator("[data-new-price-activity] summary").click();
    await page.getByLabel("Activity for this new line").fill(LINE_ACTIVITY);
    await page.getByLabel("New priced quantity").fill(LINE_QTY);
    await page.getByLabel("New priced unit").selectOption(LINE_UNIT);
    await page.getByLabel("New unit rate in pounds").fill(LINE_RATE);
    await page.getByRole("button", { name: "Save line", exact: true }).click();
    await expect(page.locator("[data-price-line]")).toHaveCount(1);
};

const fillPaymentStagesDraft = async (page: Page) => {
    await page.getByRole("button", { name: "Set payment stages", exact: true }).click();
    await page.getByRole("button", { name: "Add payment stage", exact: true }).click();
    await page.getByLabel("Stage 1 name", { exact: true }).fill(STAGE_ONE_NAME);
    await page.getByLabel("Stage 1 percentage", { exact: true }).fill(STAGE_ONE_PCT);
    await page.getByLabel("Stage 1 due", { exact: true }).fill(STAGE_ONE_DUE);
    await page.getByRole("button", { name: "Add payment stage", exact: true }).click();
    await page.getByLabel("Stage 2 name", { exact: true }).fill(STAGE_TWO_NAME);
    await page.getByLabel("Stage 2 percentage", { exact: true }).fill(STAGE_TWO_PCT);
    await page.getByLabel("Stage 2 due", { exact: true }).fill(STAGE_TWO_DUE);
};

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local pricing payment stages to proposal fixture</title></head><body><p>LOCAL FIXTURE: pricing uses real EstimateClient and PricingPaymentStages. payment_schedule starts null. Only savePricingPaymentStages is MOCK-acknowledged into the labelled project store. Remount reads that store. Frozen document and PDF use real builders. No Auth/DB/publication.</p><div id="app"></div></body></html>');
    await page.exposeFunction("__localPricingPaymentsJourneySha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localPricingPaymentsJourneySha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localPricingPaymentsJourneySha256;
        Object.defineProperty(crypto, "subtle", { value: {
            digest: async (algorithm: string, data: BufferSource) => {
                const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                return new Uint8Array(await bridge(algorithm, Array.from(bytes))).buffer;
            },
        } });
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test("pricing payment stages MOCK-acknowledged, remounted on EstimateClient, then shown in frozen proposal and PDF", async ({ page }, info) => {
    const stepResults: Record<string, string> = {};

    await page.getByLabel("What kind of work do you do?", { exact: true }).fill(WORK_TYPE);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.getByLabel("Business or trading name").fill(COMPANY);
    await page.getByLabel("Your name", { exact: false }).fill(OPERATOR);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.locator('[data-welcome-step="proposal"]').click();
    await fillNewJob(page);
    await page.getByRole("button", { name: CREATE, exact: true }).click();
    const created = await snapshot(page);
    const requestId = created.jobId!;
    expect(requestId).toMatch(UUID);
    stepResults.companyAndJob = "PASS";

    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const entry = page.getByLabel("Activity to add");
    for (const activity of ACTIVITIES) {
        await entry.fill(activity);
        await page.getByRole("button", { name: "Add activity", exact: true }).click();
    }
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();
    await expect(page.locator("[data-pricing-payments]")).toContainText("No payment stages saved yet");
    const atPricing = await snapshot(page);
    expect(atPricing.projectPaymentSchedule).toBeNull();
    stepResults.briefToPricingNullSchedule = "PASS";

    await saveFirstPriceLine(page);
    const priced = await snapshot(page);
    expect(priced.priceSaveAcknowledgements).toBe(1);
    expect(priced.estimates[0].estimate_lines[0]).toMatchObject({ quantity: 2, unit_rate: 100, line_total: 200 });
    stepResults.mockAckPriceLine = "PASS";

    await fillPaymentStagesDraft(page);
    await page.evaluate(() => { window.__pricingPaymentsJourneyLocal.nextPaymentStageSave = "refused"; });
    await page.getByRole("button", { name: "Save payment stages", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("payment stages save not acknowledged");
    const refused = await snapshot(page);
    expect(refused.paymentStageSaveAttempts).toHaveLength(1);
    expect(refused.paymentStageAcknowledgements).toBe(0);
    expect(refused.projectPaymentSchedule).toBeNull();
    expect(refused.paymentStageSaveAttempts[0]).toMatchObject({ projectId: requestId, expected: null });
    expect(refused.paymentStageSaveAttempts[0].rows).toEqual([
        expect.objectContaining({ stage: STAGE_ONE_NAME, description: STAGE_ONE_DUE, percentage: 30 }),
        expect.objectContaining({ stage: STAGE_TWO_NAME, description: STAGE_TWO_DUE, percentage: 70 }),
    ]);
    stepResults.paymentStageRefusal = "PASS";

    await page.getByRole("button", { name: "Save payment stages", exact: true }).click();
    await expect(page.locator("[data-pricing-payments]")).toContainText(`${STAGE_ONE_NAME} - ${STAGE_ONE_PCT}%`);
    const acknowledged = await snapshot(page);
    expect(acknowledged.paymentStageSaveAttempts).toHaveLength(2);
    expect(acknowledged.paymentStageAcknowledgements).toBe(1);
    expect(acknowledged.projectPaymentSchedule).toHaveLength(2);
    expect(acknowledged.projectRowPaymentSchedule).toEqual(acknowledged.projectPaymentSchedule);
    stepResults.paymentStageMockAck = "PASS";

    await page.evaluate(() => { window.__pricingPaymentsJourneyLocal.remountPricing(); });
    await expect(page.locator("[data-pricing-payments]")).toContainText(`${STAGE_TWO_NAME} - ${STAGE_TWO_PCT}%`);
    const remounted = await snapshot(page);
    expect(remounted.pricingRemounts).toBe(1);
    expect(remounted.projectPaymentSchedule).toEqual(acknowledged.projectPaymentSchedule);
    stepResults.pricingRemountReadback = "PASS";

    await page.getByRole("link", { name: /Next: Programme/ }).click();
    await page.getByLabel("Start on site", { exact: true }).fill(MONDAY);
    await page.getByRole("button", { name: "Break the job into stages", exact: true }).click();
    const stage1 = page.locator("[data-programme-stage]").nth(0);
    await stage1.getByLabel("How long", { exact: true }).fill("5");
    await stage1.getByLabel("Days or weeks for stage 1", { exact: true }).selectOption("days");
    await stage1.getByLabel("Stage 1", { exact: true }).fill("Elevation renewal");
    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    stepResults.programme = "PASS";

    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();
    await expect(page.locator("[data-key-facts]")).toContainText(TOTAL_INC_VAT);
    const payments = page.locator("#review-payments");
    await expect(payments).toContainText(STAGE_ONE_NAME);
    await expect(payments).toContainText(STAGE_TWO_NAME);
    await expect(payments).toContainText(STAGE_ONE_PCT);
    await expect(payments).toContainText(STAGE_TWO_PCT);
    await expect(payments).toContainText(STAGE_ONE_AMOUNT);
    await expect(payments).toContainText(STAGE_TWO_AMOUNT);
    await expect(payments).not.toContainText(SEEDED_PAYMENT_MARKER);
    stepResults.frozenProposalPayments = "PASS";

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    const pdf = await readPdfBytes(download);
    await download.saveAs(path.join(output, "pricing-payments-journey-draft.pdf"));
    const text = await pdfWords(pdf);
    expect(text).toContain(STAGE_ONE_NAME);
    expect(text).toContain(STAGE_TWO_NAME);
    expect(text).toContain("30");
    expect(text).toContain("70");
    expect(text).toContain(STAGE_ONE_AMOUNT.replace("£", ""));
    expect(text).toContain(STAGE_TWO_AMOUNT.replace("£", ""));
    expect(text).not.toContain(SEEDED_PAYMENT_MARKER);
    stepResults.proposalPdfPayments = "PASS";

    const finished = await snapshot(page);
    expect(finished.view).toBe("proposal");
    expect(finished.unexpected).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);

    await info.attach("step-results", { body: JSON.stringify(stepResults, null, 2), contentType: "application/json" });
    await info.attach("scope", { body: JSON.stringify({ ...scope, requestId, stepResults, paymentStageCalls: finished.paymentStageSaveAttempts.length }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "pricing-payments-joined-journey.png"), fullPage: true });
});
