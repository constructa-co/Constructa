import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import type { LocalProgrammePdfFixture } from "./programme-pdf-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    programmeEditor: "REAL_COMPONENT over MOCK_SAVE",
    proposalReviewAndPreview: "REAL_COMPONENT over MOCK_ROUTING",
    frozenSnapshot: "REAL_BUILDERS (buildPreviewSnapshot -> buildProposalPublicationSnapshot)",
    proposalDocument: "REAL_BUILDER (buildProposalDocument)",
    proposalPdf: "REAL_BUILDER (downloadProposalPdf -> renderProposalBrochure, jsPDF)",
    publishSendDelivery: "REFUSED_BY_FIXTURE",
    serverActions: "NOT_RUN",
    auth: "NOT_RUN",
    database: "NOT_RUN",
    email: "NOT_RUN",
    firstJob: "NOT_RUN",
    brief: "NOT_RUN",
    estimating: "NOT_RUN",
    clientResponse: "NOT_RUN",
    won: "NOT_RUN",
    advancedEstimating: "NOT_RUN",
    draftHashing: "REAL_NODE_WEBCRYPTO over explicit insecure-about:blank bridge, not native secure-origin WebCrypto",
    videoWalkthrough: "NOT_RUN",
};

const JOB_ID = "local-programme-pdf-job";
const PROPOSAL_PATH = `/dashboard/projects/proposal?projectId=${JOB_ID}`;
const MONDAY = "2026-11-02";
const SATURDAY = "2026-11-07";

interface FixtureSnapshot {
    saves: LocalProgrammePdfFixture["saves"];
    inclusionSaves: boolean[];
    navigation: string[];
    proposalContext: LocalProgrammePdfFixture["proposalContext"];
}

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => ({
    saves: window.__programmePdfLocal.saves,
    inclusionSaves: window.__programmePdfLocal.inclusionSaves,
    navigation: window.__programmePdfLocal.navigation,
    proposalContext: window.__programmePdfLocal.proposalContext,
}));

/** Reads a Playwright download fully, for checking the real PDF bytes. */
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
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local programme to PDF fixture - simulated saves</title></head><body><p>LOCAL FIXTURE: programme saves, inclusion choices and routing are simulated. The frozen snapshot, document and PDF are built by the real code. No account, server or database.</p><div id="app"></div></body></html>');
    // about:blank lacks secure-origin SubtleCrypto. Bridge only SHA-256 to
    // Node's real WebCrypto; no fixed hash, production shim or network call.
    await page.exposeFunction("__localProgrammeSha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localProgrammeSha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localProgrammeSha256;
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

test("a dated two-stage programme saves, freezes into the proposal preview and downloads the actual draft PDF", async ({ page }, info) => {
    // The existing working-week guard first: a Saturday start is refused
    // before any save happens.
    await page.getByLabel("Start on site", { exact: true }).fill(SATURDAY);
    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("#programme-start-error")).toHaveText("Choose a weekday. The programme counts Monday to Friday.");
    expect((await snapshot(page)).saves).toEqual([]);

    // Monday 2 November 2026, two back-to-back stages: 3 working days,
    // then 4 working days from the next working day.
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

    // The live preview already states the whole run by the one plan contract.
    await expect(page.locator("[data-programme-total]")).toHaveText("7 working days, from your stages");
    await expect(page.locator("[data-programme-finish]")).toContainText("Tuesday 10 November 2026");
    await expect(page.locator("[data-programme-finish]")).toContainText("7 working days");

    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    const saved = await snapshot(page);
    expect(saved.saves).toEqual([{
        startDate: MONDAY,
        stages: [
            { name: "Strip out", workingDays: 3, unit: "days", source: null },
            { name: "First fix", workingDays: 4, unit: "days", source: null },
        ],
    }]);

    // Next: Proposal navigates only because the save is confirmed; the
    // proposal review screen freezes its preview from what the mock holds.
    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();

    // The frozen headline facts: one price, the saved start, the calculated
    // finish and duration. Mon 2 Nov + 7 working days -> Tue 10 Nov 2026.
    const keyFacts = page.locator("[data-key-facts]");
    await expect(keyFacts).toContainText("Start on site");
    await expect(keyFacts).toContainText("2 Nov 2026");
    await expect(keyFacts).toContainText("Finish");
    await expect(keyFacts).toContainText("10 Nov 2026");
    await expect(keyFacts).toContainText("7 working days");
    await expect(keyFacts).toContainText("£576.00");

    // The frozen programme section states each stage in words, straight from
    // the frozen plan: start day counts as day one, next stage starts the
    // next working day.
    const programmeSection = page.locator("[data-doc-section='programme']");
    await expect(programmeSection).toContainText("Strip out");
    await expect(programmeSection).toContainText("2 Nov to 4 Nov 2026 · 3 working days");
    await expect(programmeSection).toContainText("First fix");
    await expect(programmeSection).toContainText("5 Nov to 10 Nov 2026 · 4 working days");
    await expect(page.locator("[data-check-code]")).toHaveText(/^[0-9A-F]{4}-[0-9A-F]{4}$/);

    // The actual PDF of the draft on screen, drawn by the real renderer.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Garage_conversion_Proposal_Draft.pdf");
    const realPdf = await expectPdfDownload(download);
    await realPdf.saveAs(path.join(output, "programme-draft-dated.pdf"));
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Draft PDF downloaded.");
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");

    // What the proposal leg froze: the raw saved start date and the exact
    // phases the confirmed save stored.
    const frozen = await snapshot(page);
    expect(frozen.saves).toHaveLength(1);
    expect(frozen.proposalContext?.startDate).toBe(MONDAY);
    expect(frozen.proposalContext?.phases).toEqual([
        { name: "Strip out", calculatedDays: 3, manualDays: 3, manhours: 0, startOffset: 0, duration_unit: "Days" },
        { name: "First fix", calculatedDays: 4, manualDays: 4, manhours: 0, startOffset: 3, duration_unit: "Days" },
    ]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "programme-pdf-dated.png"), fullPage: true });
});

test("a refused programme save keeps everything typed until the deliberate retry reaches the proposal", async ({ page }, info) => {
    await page.getByLabel("Start on site", { exact: true }).fill(MONDAY);
    await page.getByLabel("How long it takes", { exact: true }).fill("1");

    await page.evaluate(() => { window.__programmePdfLocal.nextSave = "refused"; });
    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await expect(page.locator("[data-programme-save-error]")).toContainText("Local fixture: programme save not acknowledged.");
    await expect(page.getByLabel("Start on site", { exact: true })).toHaveValue(MONDAY);
    await expect(page.getByLabel("How long it takes", { exact: true })).toHaveValue("1");
    const refused = await snapshot(page);
    expect(refused.saves).toHaveLength(1);
    expect(refused.navigation).toEqual([]);

    await page.locator("[data-programme-save-error]").getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();

    // One week from Monday 2 November 2026 is Friday 6 November 2026.
    const keyFacts = page.locator("[data-key-facts]");
    await expect(keyFacts).toContainText("2 Nov 2026");
    await expect(keyFacts).toContainText("6 Nov 2026");
    await expect(keyFacts).toContainText("1 week");
    await expect(page.locator("[data-doc-section='programme']")).toContainText("Works on site");
    await expect(page.locator("[data-doc-section='programme']")).toContainText("2 Nov to 6 Nov 2026 · 1 week");

    const retried = await snapshot(page);
    expect(retried.saves).toHaveLength(2);
    expect(retried.saves[1]).toEqual({
        startDate: MONDAY,
        stages: [{ name: "Works on site", workingDays: 5, unit: "weeks", source: null }],
    });
    expect(retried.navigation).toEqual([PROPOSAL_PATH]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});

test("a relative Day 1 programme saves without dates and freezes Day numbers, never invented dates", async ({ page }, info) => {
    await page.getByLabel("Programme timing", { exact: true }).selectOption("relative");
    await page.getByLabel("How long it takes", { exact: true }).fill("2");
    await expect(page.locator("[data-programme-finish]")).toContainText("Day 10");
    await expect(page.locator("[data-programme-finish]")).toContainText("2 weeks");

    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();

    const relative = await snapshot(page);
    expect(relative.saves).toEqual([{
        timeBasis: "relative",
        startDate: "",
        stages: [{ name: "Works on site", workingDays: 10, unit: "weeks", source: null }],
    }]);
    expect(relative.proposalContext?.startDate).toBeNull();

    const keyFacts = page.locator("[data-key-facts]");
    await expect(keyFacts).toContainText("Start date not agreed");
    await expect(keyFacts).toContainText("Day 10");
    await expect(keyFacts).toContainText("2 weeks");
    const programmeSection = page.locator("[data-doc-section='programme']");
    await expect(programmeSection).toContainText("Day 1 to Day 10 · 2 weeks");
    // The relative programme must carry no calendar dates at all. (The
    // document's issue/valid-until dates live outside this section.)
    await expect(programmeSection).not.toContainText("Nov");
    await expect(programmeSection).not.toContainText("2026");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Garage_conversion_Proposal_Draft.pdf");
    const realPdf = await expectPdfDownload(download);
    await realPdf.saveAs(path.join(output, "programme-draft-relative.pdf"));
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");

    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});

test("omitting the programme through the real inclusion control removes it from the frozen proposal and PDF preview", async ({ page }, info) => {
    await page.getByLabel("Start on site", { exact: true }).fill(MONDAY);
    await page.getByLabel("How long it takes", { exact: true }).fill("3");
    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();

    // The real inclusion control writes the single trailing omit marker.
    await page.getByRole("button", { name: "Omit programme from proposal", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Programme deliberately omitted from the proposal" })).toBeVisible();

    await page.getByRole("link", { name: "Next: Proposal", exact: true }).click();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();

    // The frozen document carries no programme section and no programme
    // headline facts; the price section remains.
    await expect(page.locator("[data-doc-section='programme']")).toHaveCount(0);
    await expect(page.locator("[data-key-facts]")).not.toContainText("Start on site");
    await expect(page.locator("[data-doc-section='price']")).toBeVisible();

    // The mock server holds exactly one omit marker after the saved phase.
    const omitted = await snapshot(page);
    expect(omitted.inclusionSaves).toEqual([false]);
    expect(omitted.proposalContext?.phases).toEqual([
        { name: "Works on site", calculatedDays: 15, manualDays: 15, manhours: 0, startOffset: 0, duration_unit: "Weeks" },
        { programmeIntent: "omit", intent_version: 1 },
    ]);
    expect(omitted.navigation).toEqual([PROPOSAL_PATH]);
    expect(omitted.saves).toHaveLength(1);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});
