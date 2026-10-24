import { expect, test, type Download, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import type { LocalBuiltUpProposalFixture } from "./built-up-proposal-entry";

// A049: a price built up from entered resources is carried, unchanged, through
// the actual programme and proposal pages into the frozen document and real
// draft PDF. Build with `build-brief-price.mjs <out> built-up-proposal`
// (A049-BUILT-UP-PROPOSAL-2020 compiler hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const PROJECT = "local-built-up-proposal-job";
const LINE = "local-built-up-proposal-line";
const MONDAY = "2026-11-02";
const programmePath = `/dashboard/projects/schedule?projectId=${PROJECT}`;
const proposalPath = `/dashboard/projects/proposal?projectId=${PROJECT}`;
const LABOUR = { component_type: "labour", description: "Paver labour", quantity: 16, unit: "hr", unit_rate: 30, manhours_per_unit: 1, sort_order: 0 };
const MATERIAL = { component_type: "material", description: "Block pavers", quantity: 10, unit: "m²", unit_rate: 27, manhours_per_unit: 0, sort_order: 1 };
const scope = {
    pricing: "REAL_COMPONENT EstimateClient + lazy AdvancedEstimate + BuildUpPanel (resource maths, Apply gates, running total)",
    costsActions: "MOCK module; acknowledged rows/rate written to an in-memory store from submitted args only",
    programme: "REAL_COMPONENT SimpleProgrammeClient over MOCK_SAVE",
    proposal: "REAL_COMPONENT ReviewSendClient, REAL frozen snapshot/document builders, REAL jsPDF, decoded with installed unpdf",
    clientProjection: "Existing policy: unit_rate and components omitted from the client document; not changed",
    routing: "MOCK router and link interception",
    authDatabaseResourceLibraryPublicationHosted: "NOT_RUN",
    draftHashing: "REAL_NODE_WEBCRYPTO over explicit insecure-about:blank bridge",
};

const state = (page: Page): Promise<LocalBuiltUpProposalFixture & { actionCalls: { name: string; args: unknown[] }[] }> =>
    page.evaluate(() => ({ ...JSON.parse(JSON.stringify(window.__builtUpProposalLocal)), actionCalls: window.__builtUpProposalActions.actionCalls }));

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
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local built-up price to draft PDF - MOCK acknowledgements</title></head><body><p>LOCAL FIXTURE: resource, rate and programme saves are MOCK acknowledgements in memory. Snapshot, document and PDF use the real builders. No account, server, database, resource library or publication.</p><div id="app"></div></body></html>');
    await page.exposeFunction("__localBuiltUpProposalSha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localBuiltUpProposalSha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localBuiltUpProposalSha256;
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

async function addResource(page: Page, type: string, values: { name: string; quantity: string; unit: string; rate: string; hours: string }) {
    await page.getByRole("button", { name: `+ ${type}`, exact: true }).click();
    await expect(page.getByRole("region", { name: "Unsaved resource draft" })).toBeVisible();
    await page.getByLabel("New resource name", { exact: true }).fill(values.name);
    await page.getByLabel("New resource total quantity", { exact: true }).fill(values.quantity);
    await page.getByLabel("New resource unit", { exact: true }).selectOption(values.unit);
    await page.getByLabel("New resource rate", { exact: true }).fill(values.rate);
    await page.getByLabel("New resource hours", { exact: true }).fill(values.hours);
    await page.getByRole("button", { name: "Save new resource", exact: true }).click();
    await expect(page.getByRole("region", { name: "Unsaved resource draft" })).toHaveCount(0);
}

test("a price built up from two entered resources reaches the frozen proposal and real draft PDF unchanged", async ({ page }, info) => {
    await page.evaluate(() => { window.__builtUpProposalActions.script = { addComponent: ["ack", "ack"], applyRate: ["ack"] }; });
    const contractSum = page.locator("[data-contract-sum]");
    const priceLines = page.getByRole("region", { name: "Price lines", exact: true });

    // Baseline: one saved simple line, 10 m² at £50.00.
    await expect(priceLines.getByText("Lay block paving", { exact: true })).toBeVisible();
    await expect(contractSum).toHaveText("£500.00");

    // Optional detailed build-up through the actual controls.
    await page.locator("button[aria-controls='advanced-estimating']").click();
    await page.locator(`[data-resource-disclosure='${LINE}']`).click();
    const panelHeading = page.getByRole("heading", { name: "Resource build-up", exact: true });
    await expect(panelHeading).toBeVisible();
    const panel = page.locator("div").filter({ has: panelHeading }).last();
    await addResource(page, "labour", { name: "Paver labour", quantity: "16", unit: "hr", rate: "30", hours: "1" });
    await addResource(page, "material", { name: "Block pavers", quantity: "10", unit: "m²", rate: "27", hours: "0" });
    // (16 x £30 + 10 x £27) / 10 m² = £75.00 per m², derived by the panel.
    await expect(panel).toContainText("Built-up rate: £75.00/unit");
    await expect(panel).toContainText("Current line rate: £50.00/m²");
    await page.getByLabel("Confirm total resources for this priced quantity", { exact: true }).check();
    await page.getByRole("button", { name: "Apply resource rate", exact: true }).click();
    await expect(page.getByText("Rate applied to the line price.")).toBeVisible();
    await expect(panel).toContainText("Current line rate: £75.00/m²");
    await expect(contractSum).toHaveText("£750.00");

    // The acknowledged saved state came only from the submitted arguments.
    const applied = await state(page);
    expect(applied.actionCalls).toEqual([
        { name: "addComponentAction", args: [LINE, LABOUR] },
        { name: "addComponentAction", args: [LINE, MATERIAL] },
        { name: "updateLineBuiltUpRateAction", args: [LINE, 75, 10] },
    ]);
    const storedLine = applied.estimates[0]!.estimate_lines[0]!;
    expect(storedLine).toMatchObject({ id: LINE, quantity: 10, unit: "m²", unit_rate: 75, line_total: 750, pricing_mode: "simple" });
    expect(storedLine.estimate_line_components).toEqual([
        { ...LABOUR, estimate_line_id: LINE, id: expect.any(String) },
        { ...MATERIAL, estimate_line_id: LINE, id: expect.any(String) },
    ]);
    expect(applied.estimates[0]!.total_cost).toBe(750);

    // Simple pricing returns with the applied price, then the actual Next: Programme link.
    await page.locator("button[aria-controls='advanced-estimating']").click();
    await expect(priceLines.getByText("Lay block paving", { exact: true })).toBeVisible();
    await expect(contractSum).toHaveText("£750.00");
    await page.getByRole("link", { name: /Next: Programme/ }).click();

    await page.getByLabel("Start on site", { exact: true }).fill(MONDAY);
    await page.getByRole("button", { name: "Break the job into stages", exact: true }).click();
    const stage = page.locator("[data-programme-stage]").nth(0);
    await stage.getByLabel("How long", { exact: true }).fill("5");
    await stage.getByLabel("Days or weeks for stage 1", { exact: true }).selectOption("days");
    await stage.getByLabel("Stage 1", { exact: true }).fill("Paving");
    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();

    // The actual frozen client document: quantity and amount, no unit rate or resources (existing policy).
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    const documentView = page.locator("[data-proposal-document]");
    await expect(documentView).toBeVisible();
    await expect(page.locator("[data-key-facts]")).toContainText("£900.00");
    const priceSection = page.locator("[data-doc-section='price']");
    await expect(priceSection).toContainText("Lay block paving");
    await expect(priceSection).toContainText("10 m²");
    await expect(priceSection).toContainText("£750.00");
    const shown = await documentView.innerText();
    for (const hidden of ["£500.00", "£600.00", "£75.00", "Paver labour", "Block pavers", "£480.00", "£270.00"]) expect(shown).not.toContain(hidden);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/_Proposal_Draft\.pdf$/);
    const pdf = await readPdfBytes(download);
    await download.saveAs(path.join(output, "built-up-proposal-draft.pdf"));
    const text = await pdfWords(pdf);
    expect(text).toContain("Lay block paving");
    expect(text).toMatch(/\b10 m/);
    expect(text).toContain("750.00");
    expect(text).toContain("900.00");
    for (const hidden of ["500.00", "600.00", "75.00", "Paver labour", "Block pavers", "480.00", "270.00"]) expect(text).not.toContain(hidden);
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");

    const finished = await state(page);
    expect(finished.view).toBe("proposal");
    expect(finished.navigation).toEqual([programmePath, proposalPath]);
    expect(finished.proposalEstimate).toEqual(applied.estimates[0]);
    expect(finished.estimates).toEqual(applied.estimates);
    expect(finished.actionCalls).toHaveLength(3);
    expect(finished.programmeSaves).toHaveLength(1);
    expect(finished.projectRow.start_date).toBe(MONDAY);
    expect(finished.simpleServerCalls).toEqual([]);
    expect(finished.proposalDraftSaves).toBe(0);
    expect(finished.publicationsAttempted).toBe(0);
    expect(finished.unexpected).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "built-up-proposal.png"), fullPage: true });
});
