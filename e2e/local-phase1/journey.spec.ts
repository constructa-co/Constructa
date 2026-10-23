import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import { PROPOSAL_READINESS_PATH } from "../../src/lib/first-session";
import type { LocalJourneyFixture } from "./journey-entry";

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
    estimate: "REAL_COMPONENT over MOCK_ROUTING; MOCK_ESTIMATE_SEED for programme leg; price persistence REFUSED_BY_FIXTURE",
    programmeEditor: "REAL_COMPONENT over MOCK_SAVE",
    proposalReviewAndPreview: "REAL_COMPONENT over MOCK_ROUTING",
    frozenSnapshot: "REAL_BUILDERS",
    proposalPdf: "REAL_BUILDER (jsPDF)",
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

const briefPath = (id: string) => `/dashboard/projects/brief?projectId=${encodeURIComponent(id)}`;
const pricingPath = (id: string) => `/dashboard/projects/costs?projectId=${encodeURIComponent(id)}`;
const programmePath = (id: string) => `/dashboard/projects/schedule?projectId=${encodeURIComponent(id)}`;
const proposalPath = (id: string) => `/dashboard/projects/proposal?projectId=${encodeURIComponent(id)}`;

interface FixtureSnapshot {
    view: LocalJourneyFixture["view"];
    profile: LocalJourneyFixture["profile"];
    setupCalls: LocalJourneyFixture["setupCalls"];
    setupNavigation: string[];
    attempts: LocalJourneyFixture["attempts"];
    rpcCalls: LocalJourneyFixture["rpcCalls"];
    jobId: string | null;
    briefSaves: LocalJourneyFixture["briefSaves"];
    navigation: string[];
    priceWrites: string[];
    programmeSaves: LocalJourneyFixture["programmeSaves"];
    proposalContext: LocalJourneyFixture["proposalContext"];
    publicationsAttempted: number;
    unexpected: string[];
}

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => {
    const f = window.__journeyLocal;
    return {
        view: f.view, profile: f.profile, setupCalls: f.setupCalls, setupNavigation: f.setupNavigation,
        attempts: f.attempts, rpcCalls: f.rpcCalls, jobId: f.jobId, briefSaves: f.briefSaves,
        navigation: f.navigation, priceWrites: f.priceWrites, programmeSaves: f.programmeSaves,
        proposalContext: f.proposalContext, publicationsAttempted: f.publicationsAttempted,
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

async function expectPdfDownload(download: import("@playwright/test").Download) {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const pdf = Buffer.concat(chunks);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
    return download;
}

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local joined company-to-draft-PDF fixture - simulated saves</title></head><body><p>LOCAL FIXTURE: company, job, brief, pricing, programme and routing are simulated. Snapshot, document and PDF use the real builders. No account, server, publication, client acceptance or Won.</p><div id="app"></div></body></html>');
    await page.exposeFunction("__localJourneySha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localJourneySha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localJourneySha256;
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

test("company through first job, brief, seeded pricing, programme and draft PDF on one explicit mock journey", async ({ page }, info) => {
    await page.getByLabel("What kind of work do you do?", { exact: true }).fill(WORK_TYPE);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.getByLabel("Business or trading name").fill(COMPANY);
    await page.getByLabel("Your name", { exact: false }).fill(OPERATOR);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: COMPANY, exact: true })).toBeVisible();

    const afterCompany = await snapshot(page);
    expect(afterCompany.setupCalls).toHaveLength(2);
    expect(afterCompany.profile).toMatchObject({ business_type: WORK_TYPE, company_name: COMPANY, full_name: OPERATOR });
    expect(afterCompany.setupNavigation).toEqual(["refresh", PROPOSAL_READINESS_PATH]);
    await expect(page.locator('[data-welcome-step="proposal"]')).toHaveAttribute("href", "/dashboard/projects/new");

    await page.locator('[data-welcome-step="proposal"]').click();
    await expect(page.getByRole("heading", { name: "Add your first job", exact: true })).toBeVisible();

    await fillNewJob(page);
    await page.getByRole("button", { name: CREATE, exact: true }).click();
    await expect(page.getByText(`${JOB} for ${CLIENT}`, { exact: true })).toBeVisible();

    const created = await snapshot(page);
    const requestId = created.attempts[0].requestId;
    expect(requestId).toMatch(UUID);
    expect(created.jobId).toBe(requestId);
    expect(created.navigation).toContain("/dashboard/projects/new");
    expect(created.navigation).toContain(briefPath(requestId));

    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const entry = page.getByLabel("Activity to add");
    for (const activity of ACTIVITIES) {
        await entry.fill(activity);
        await page.getByRole("button", { name: "Add activity", exact: true }).click();
    }
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(SITE, { exact: true })).toBeVisible();
    await expect(page.locator("[data-brief-site-context]")).toContainText(START_SHOWN);
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();
    await expect(page.locator("[aria-labelledby='pricing-context-title']")).toContainText(WORK);
    const priced = await snapshot(page);
    expect(priced.briefSaves[0].payload.brief_scope).toBe(WORK);
    expect(priced.briefSaves[0].payload.brief_trade_sections).toEqual(ACTIVITIES);
    expect(priced.priceWrites).toEqual([]);

    await page.getByRole("link", { name: /Next: Programme/ }).click();
    await expect(page.getByLabel("Start on site", { exact: true })).toBeVisible();

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

    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();
    await expect(page.locator("[data-key-facts]")).toContainText("£576.00");
    await expect(page.locator("[data-doc-section='response']")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/_Proposal_Draft\.pdf$/);
    await expectPdfDownload(download);
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");

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

    await info.attach("scope", { body: JSON.stringify({ ...scope, requestId, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "joined-journey.png"), fullPage: true });
});
