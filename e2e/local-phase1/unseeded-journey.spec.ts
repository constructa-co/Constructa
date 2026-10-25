import { expect, test, type Download, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import { PROPOSAL_READINESS_PATH } from "../../src/lib/first-session";
import type { LocalUnseededJourneyFixture } from "./unseeded-journey-entry";

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
    estimate: "REAL_EstimateClient/controller; EMPTY_LINES until MOCK_ACK saveLine; no480seed",
    programmeEditor: "REAL_COMPONENT over MOCK_SAVE",
    proposalReviewAndPreview: "REAL_COMPONENT over MOCK_ROUTING",
    frozenSnapshot: "REAL_BUILDERS",
    proposalPdf: "REAL_BUILDER (jsPDF) + unpdf text decode",
    clientResponse: "REAL_UI_IN_PREVIEW_ONLY; no acceptance transport exercised",
    publishSendDelivery: "REFUSED_BY_FIXTURE",
    won: "NOT_RUN",
    serverActions: "NOT_RUN",
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
const JOB = "Offline first job: rear roof slope";
const CLIENT = "Synthetic first client";
const SITE = "Synthetic site, rear of the terrace";
const TYPE = "Roof repair";
const START = "2026-11-16";
const START_SHOWN = "16 November 2026";
const WORK = "Strip and renew the rear roof slope, renew the gutters and repoint the chimney stack.";
const ACTIVITIES = ["Strip existing coverings and battens", "Re-felt, batten and re-tile the slope"];
const CREATE = "Create project and start the brief";
const MONDAY = "2026-11-02";
const LINE_DESC = "Synthetic rear slope renewal priced per item";
const LINE_QTY = "3";
const LINE_UNIT = "nr";
const LINE_RATE = "85";
const LINE_ACTIVITY = ACTIVITIES[0];
const TOTAL_INC_VAT = "£306.00";
const SEEDED_TOTAL_MARKER = "£576.00";
const SEEDED_LINE_MARKER = "Garage conversion, supplied and fitted";

const briefPath = (id: string) => `/dashboard/projects/brief?projectId=${encodeURIComponent(id)}`;
const pricingPath = (id: string) => `/dashboard/projects/costs?projectId=${encodeURIComponent(id)}`;
const programmePath = (id: string) => `/dashboard/projects/schedule?projectId=${encodeURIComponent(id)}`;
const proposalPath = (id: string) => `/dashboard/projects/proposal?projectId=${encodeURIComponent(id)}`;

interface FixtureSnapshot {
    view: LocalUnseededJourneyFixture["view"];
    profile: LocalUnseededJourneyFixture["profile"];
    setupCalls: LocalUnseededJourneyFixture["setupCalls"];
    setupNavigation: string[];
    attempts: LocalUnseededJourneyFixture["attempts"];
    rpcCalls: LocalUnseededJourneyFixture["rpcCalls"];
    jobId: string | null;
    briefSaves: LocalUnseededJourneyFixture["briefSaves"];
    navigation: string[];
    priceWrites: string[];
    estimates: LocalUnseededJourneyFixture["estimates"];
    priceSaveAttempts: LocalUnseededJourneyFixture["priceSaveAttempts"];
    priceSaveAcknowledgements: number;
    programmeSaves: LocalUnseededJourneyFixture["programmeSaves"];
    proposalContext: LocalUnseededJourneyFixture["proposalContext"];
    publicationsAttempted: number;
    unexpected: string[];
}

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => {
    const f = window.__unseededJourneyLocal;
    return {
        view: f.view, profile: f.profile, setupCalls: f.setupCalls, setupNavigation: f.setupNavigation,
        attempts: f.attempts, rpcCalls: f.rpcCalls, jobId: f.jobId, briefSaves: f.briefSaves,
        navigation: f.navigation, priceWrites: f.priceWrites, estimates: f.estimates,
        priceSaveAttempts: f.priceSaveAttempts, priceSaveAcknowledgements: f.priceSaveAcknowledgements,
        programmeSaves: f.programmeSaves, proposalContext: f.proposalContext,
        publicationsAttempted: f.publicationsAttempted, unexpected: f.unexpected,
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

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local unseeded company-to-draft-PDF fixture - MOCK price acknowledgement</title></head><body><p>LOCAL FIXTURE: company, job, brief, programme and routing are simulated. The first price line is entered on the real EstimateClient and acknowledged by an explicit MOCK save only. Snapshot, document and PDF use the real builders. No account, server, publication, client acceptance or Won.</p><div id="app"></div></body></html>');
    await page.exposeFunction("__localUnseededJourneySha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localUnseededJourneySha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localUnseededJourneySha256;
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

test("company through brief, unseeded first priced line with refused-then-acknowledged MOCK save, programme and draft PDF", async ({ page }, info) => {
    const stepResults: Record<string, string> = {};

    await page.getByLabel("What kind of work do you do?", { exact: true }).fill(WORK_TYPE);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.getByLabel("Business or trading name").fill(COMPANY);
    await page.getByLabel("Your name", { exact: false }).fill(OPERATOR);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: COMPANY, exact: true })).toBeVisible();
    const afterCompany = await snapshot(page);
    expect(afterCompany.setupCalls).toHaveLength(2);
    expect(afterCompany.setupNavigation).toEqual(["refresh", PROPOSAL_READINESS_PATH]);
    stepResults.companySetup = "PASS";

    await page.locator('[data-welcome-step="proposal"]').click();
    await fillNewJob(page);
    await page.getByRole("button", { name: CREATE, exact: true }).click();
    const created = await snapshot(page);
    const requestId = created.attempts[0].requestId;
    expect(requestId).toMatch(UUID);
    expect(created.jobId).toBe(requestId);
    stepResults.firstJob = "PASS";

    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const entry = page.getByLabel("Activity to add");
    for (const activity of ACTIVITIES) {
        await entry.fill(activity);
        await page.getByRole("button", { name: "Add activity", exact: true }).click();
    }
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();
    await expect(page.locator("[aria-labelledby='pricing-context-title']")).toContainText(WORK);
    const priced = await snapshot(page);
    expect(priced.briefSaves[0].payload.brief_scope).toBe(WORK);
    expect(priced.briefSaves[0].payload.brief_trade_sections).toEqual(ACTIVITIES);
    expect(priced.estimates).toEqual([]);
    expect(priced.priceSaveAttempts).toEqual([]);
    await expect(page.locator("[data-empty-estimate]")).toBeVisible();
    stepResults.briefToPricing = "PASS";

    await page.getByRole("button", { name: "Add the first price line", exact: true }).click();
    await page.getByRole("button", { name: "Show quantities and rates", exact: true }).click();
    await page.getByRole("button", { name: "Quantity and rate", exact: true }).click();
    await page.getByLabel("New work description").fill(LINE_DESC);
    await page.locator("[data-new-price-activity] summary").click();
    await page.getByLabel("Activity for this new line").fill(LINE_ACTIVITY);
    await page.getByLabel("New priced quantity").fill(LINE_QTY);
    await page.getByLabel("New priced unit").selectOption(LINE_UNIT);
    await page.getByLabel("New unit rate in pounds").fill(LINE_RATE);

    await page.evaluate(() => { window.__unseededJourneyLocal.nextPriceSave = "refused"; });
    await page.getByRole("button", { name: "Save line", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Local fixture: price save not acknowledged.");
    const refused = await snapshot(page);
    expect(refused.priceSaveAttempts).toHaveLength(1);
    expect(refused.priceSaveAcknowledgements).toBe(0);
    expect(refused.estimates).toEqual([]);
    expect(await page.locator("[data-price-line]").count()).toBe(0);
    expect(refused.priceSaveAttempts[0].line).toEqual({
        description: LINE_DESC,
        quantity: 3,
        unit: LINE_UNIT,
        unit_rate: 85,
    });
    expect(refused.priceSaveAttempts[0].activity).toBe(LINE_ACTIVITY);
    stepResults.priceSaveRefusal = "PASS";

    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("[data-price-line]")).toHaveCount(1);
    const acknowledged = await snapshot(page);
    expect(acknowledged.priceSaveAttempts).toHaveLength(2);
    expect(acknowledged.priceSaveAcknowledgements).toBe(1);
    expect(acknowledged.estimates).toHaveLength(1);
    expect(acknowledged.estimates[0].estimate_lines[0]).toMatchObject({
        description: LINE_DESC,
        quantity: 3,
        unit: LINE_UNIT,
        unit_rate: 85,
        line_total: 255,
        trade_section: LINE_ACTIVITY,
    });
    expect(acknowledged.priceWrites).toEqual([]);
    stepResults.firstPricedLineMockAck = "PASS";

    await page.getByRole("link", { name: /Next: Programme/ }).click();
    await page.getByLabel("Start on site", { exact: true }).fill(MONDAY);
    await page.getByRole("button", { name: "Break the job into stages", exact: true }).click();
    const stage1 = page.locator("[data-programme-stage]").nth(0);
    await stage1.getByLabel("How long", { exact: true }).fill("3");
    await stage1.getByLabel("Days or weeks for stage 1", { exact: true }).selectOption("days");
    await stage1.getByLabel("Stage 1", { exact: true }).fill("Strip out");
    await page.getByRole("button", { name: "Add a stage", exact: true }).click();
    const stage2 = page.locator("[data-programme-stage]").nth(1);
    await stage2.getByLabel("How long", { exact: true }).fill("4");
    await stage2.getByLabel("Days or weeks for stage 2", { exact: true }).selectOption("days");
    await stage2.getByLabel("Stage 2", { exact: true }).fill("First fix");
    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    stepResults.programme = "PASS";

    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();
    await expect(page.locator("[data-key-facts]")).toContainText(TOTAL_INC_VAT);
    await expect(page.locator("[data-key-facts]")).not.toContainText(SEEDED_TOTAL_MARKER);
    await expect(page.locator("[data-doc-section='scope']")).toContainText(WORK);
    stepResults.frozenProposal = "PASS";

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/_Proposal_Draft\.pdf$/);
    const pdf = await readPdfBytes(download);
    await download.saveAs(path.join(output, "unseeded-journey-draft.pdf"));
    const text = await pdfWords(pdf);
    expect(text).toContain(TOTAL_INC_VAT.replace("£", ""));
    expect(text).not.toContain("576");
    expect(text).not.toContain(SEEDED_LINE_MARKER);
    expect(text).toContain(LINE_DESC.replace(/\s+/g, " ").trim());
    stepResults.proposalPdfDecoded = "PASS";

    const finished = await snapshot(page);
    expect(finished.view).toBe("proposal");
    expect(finished.navigation).toEqual([
        "/dashboard/projects/new",
        briefPath(requestId),
        pricingPath(requestId),
        programmePath(requestId),
        proposalPath(requestId),
    ]);
    expect(finished.programmeSaves).toHaveLength(1);
    expect(finished.proposalContext?.startDate).toBe(MONDAY);
    expect(finished.publicationsAttempted).toBe(0);
    expect(finished.unexpected).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);

    await info.attach("step-results", { body: JSON.stringify(stepResults, null, 2), contentType: "application/json" });
    await info.attach("scope", { body: JSON.stringify({ ...scope, requestId, stepResults, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "unseeded-joined-journey.png"), fullPage: true });
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    test(`manual address explicit Use retains drafts across outer collapse and refused create at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.getByLabel("What kind of work do you do?", { exact: true }).fill(WORK_TYPE);
        await page.getByRole("button", { name: "Save and continue", exact: true }).click();
        await page.getByLabel("Business or trading name").fill(COMPANY);
        await page.getByLabel("Your name", { exact: false }).fill(OPERATOR);
        await page.getByRole("button", { name: "Save and continue", exact: true }).click();
        await page.locator('[data-welcome-step="proposal"]').click();
        await fillNewJob(page);
        const site = page.locator('[data-manual-address-entry="new-project-site-manual"]');
        const client = page.locator('[data-manual-address-entry="new-project-client-manual"]');
        await expect(site).not.toHaveAttribute("open", "");
        await site.locator("summary").click();
        await site.getByLabel("Address line 1", { exact: true }).fill("  Rear gate, plot 7!  ");
        await site.getByLabel("Town or city", { exact: true }).fill("Example town");
        await site.getByLabel("Postcode", { exact: true }).fill("AB1 2CD");
        await expect(page.getByLabel("Where is the job?", { exact: true })).toHaveValue(SITE);
        expect((await snapshot(page)).attempts).toEqual([]);
        const more = page.getByRole("button", { name: /^Add more details/ });
        await more.click();
        await expect(site).toBeHidden();
        await more.click();
        await expect(site.getByLabel("Address line 1", { exact: true })).toHaveValue("  Rear gate, plot 7!  ");
        const preview = "Rear gate, plot 7!\nExample town\nAB1 2CD";
        await expect(site.locator("pre")).toHaveText(preview);
        await site.getByRole("button", { name: "Use this address", exact: true }).click();
        await expect(page.getByLabel("Where is the job?", { exact: true })).toHaveValue(preview);
        await expect(page.getByLabel("Client's address, if different", { exact: true })).toHaveValue("");
        await client.locator("summary").click();
        await client.getByLabel("Address line 1", { exact: true }).fill("x".repeat(501));
        await expect(client.getByRole("button", { name: "Use this address", exact: true })).toBeDisabled();
        await expect(client.getByRole("alert")).toContainText("over 500 characters");
        await expect(page.getByLabel("Client's address, if different", { exact: true })).toHaveValue("");
        await client.getByLabel("Address line 1", { exact: true }).fill("Client billing only");
        await client.getByRole("button", { name: "Use this address", exact: true }).click();
        await expect(page.getByLabel("Where is the job?", { exact: true })).toHaveValue(preview);
        expect((await snapshot(page)).attempts).toEqual([]);
        await page.evaluate(() => { window.__unseededJourneyLocal.nextCreate = "refused"; });
        await page.getByRole("button", { name: CREATE, exact: true }).click();
        await expect(page.locator("[data-job-create-error]")).toBeVisible();
        const refused = await snapshot(page);
        expect(refused.attempts).toHaveLength(1);
        expect(refused.attempts[0].siteAddress).toBe(preview);
        expect(refused.attempts[0].clientAddress).toBe("Client billing only");
        expect(Object.keys(refused.attempts[0])).not.toContain("line1");
        expect(Object.keys(refused.attempts[0])).not.toContain("postcode");
        await expect(site.getByLabel("Address line 1", { exact: true })).toHaveValue("  Rear gate, plot 7!  ");
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        const acknowledged = await snapshot(page);
        expect(acknowledged.attempts).toHaveLength(2);
        expect(acknowledged.attempts[1]).toEqual(acknowledged.attempts[0]);
        expect(acknowledged.rpcCalls.map(call => call.outcome)).toEqual(["refused", "created"]);
        expect(acknowledged.publicationsAttempted).toBe(0);
        expect(acknowledged.priceWrites).toEqual([]);
        expect(acknowledged.unexpected).toEqual([]);
        expect(requests).toEqual([]);
        expect(pageErrors).toEqual([]);
    });
}
