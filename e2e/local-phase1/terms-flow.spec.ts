import { expect, test, type Download, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import { STANDARD_PROPOSAL_TERMS } from "../../src/lib/proposal-terms";
import type { LocalTermsFlowFixture } from "./terms-flow-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    proposalReviewEditor: "REAL_COMPONENT (ReviewSendClient terms section + CurrentTermsReview)",
    frozenSnapshot: "REAL_BUILDERS (buildPreviewSnapshot -> buildProposalPublicationSnapshot)",
    proposalDocument: "REAL_BUILDER (buildProposalDocument)",
    proposalPdf: "REAL_BUILDER (downloadProposalPdf -> renderProposalBrochure, jsPDF)",
    draftSave: "MOCK_RECORD_AND_APPLY tc_overrides",
    publishSendDelivery: "REFUSED_BY_FIXTURE",
    serverActions: "NOT_RUN",
    auth: "NOT_RUN",
    database: "NOT_RUN",
    email: "NOT_RUN",
    programmeEditor: "NOT_RUN",
    won: "NOT_RUN",
    draftHashing: "REAL_NODE_WEBCRYPTO over explicit insecure-about:blank bridge, not native secure-origin WebCrypto",
};

const snapshot = (page: Page): Promise<Pick<LocalTermsFlowFixture, "saves" | "proposalDraftSaves">> =>
    page.evaluate(() => ({
        saves: window.__termsFlowLocal.saves,
        proposalDraftSaves: window.__termsFlowLocal.proposalDraftSaves,
    }));

function expectInOrder(text: string, parts: string[], where: string) {
    let from = 0;
    for (const part of parts) {
        const at = text.indexOf(part, from);
        expect(at, `${where}: "${part}" appears in order`).toBeGreaterThan(-1);
        from = at + part.length;
    }
}

/** Reads a Playwright download fully, for checking the real PDF bytes. */
async function readPdfBytes(download: Download): Promise<Buffer> {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const pdf = Buffer.concat(chunks);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
    return pdf;
}

/** The words in a real draft PDF, read back with the installed unpdf decoder. */
async function pdfWords(pdf: Buffer): Promise<string> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const proxy = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(proxy, { mergePages: true });
    return text.replace(/\s+/g, " ").trim();
}

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", (route) => route.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local standard terms to PDF fixture - simulated saves</title></head><body><p>LOCAL FIXTURE: draft saves are simulated. The frozen snapshot, document and PDF are built by the real code. No account, server or database.</p><div id="app"></div></body></html>',
    );
    await page.exposeFunction("__localTermsFlowSha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localTermsFlowSha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localTermsFlowSha256;
        Object.defineProperty(crypto, "subtle", {
            value: {
                digest: async (algorithm: string, data: BufferSource) => {
                    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                    return new Uint8Array(await bridge(algorithm, Array.from(bytes))).buffer;
                },
            },
        });
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test("the twelve standard terms flow from defaults through the actual editor, a confirmed mock save, the frozen document and the real draft PDF text", async ({ page }, info) => {
    expect(STANDARD_PROPOSAL_TERMS).toHaveLength(12);

    const summary = page.locator("#review-terms");
    await expect(summary).toContainText("12 terms are shown to the client");
    await expect(summary).toContainText("Jurisdiction");
    await expect(summary).toContainText("Confidentiality");

    const readTermsSummary = page.locator("[data-current-terms] > summary");
    await expect(readTermsSummary).toHaveText("Read the terms in full (12)");
    await readTermsSummary.click();
    const currentTerms = page.locator("[data-current-terms]");
    for (const [index, clause] of STANDARD_PROPOSAL_TERMS.entries()) {
        const item = currentTerms.locator("[data-current-term]").nth(index);
        await expect(item.locator("h3")).toHaveText(`${index + 1}. ${clause.title}`);
        await expect(item.locator("p")).toHaveText(clause.body);
    }

    await page.getByRole("button", { name: "Change the terms", exact: true }).click();
    await expect(page.locator("#review-terms-editor")).toBeVisible();
    for (const [index, clause] of STANDARD_PROPOSAL_TERMS.entries()) {
        await expect(page.locator(`#term-${index}-title`)).toHaveValue(clause.title);
        await expect(page.locator(`#term-${index}-body`)).toHaveValue(clause.body);
    }
    await expect(page.locator("#term-8-title")).toHaveValue("Health, Safety & CDM");
    await expect(page.locator("#term-10-title")).toHaveValue("Practical Completion");

    await page.locator("[data-save-draft]").click();
    await expect(page.locator("[data-save-draft]")).toHaveText("Saved");
    const afterSave = await snapshot(page);
    expect(afterSave.proposalDraftSaves).toBe(1);
    expect(afterSave.saves).toHaveLength(1);
    expect(afterSave.saves[0]!.terms).toBeNull();

    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();

    const termsSection = page.locator("[data-doc-section='terms']");
    await expect(termsSection).toBeVisible();
    for (const [index, clause] of STANDARD_PROPOSAL_TERMS.entries()) {
        const item = termsSection.locator("ol[data-doc-terms] > li").nth(index);
        await expect(item.locator("h3")).toHaveText(`${index + 1}. ${clause.title}`);
        await expect(item.locator("p")).toHaveText(clause.body);
    }

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Garage_conversion_Proposal_Draft.pdf");
    const pdf = await readPdfBytes(download);
    await download.saveAs(path.join(output, "terms-flow-standard-twelve.pdf"));

    const text = await pdfWords(pdf);
    const titleMarkers = STANDARD_PROPOSAL_TERMS.map((clause) => clause.title);
    const bodyMarkers = STANDARD_PROPOSAL_TERMS.map((clause) => clause.body.replace(/\s+/g, " ").trim());
    expectInOrder(text, titleMarkers, "draft PDF clause titles");
    expectInOrder(text, bodyMarkers, "draft PDF clause bodies");

    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Draft PDF downloaded.");
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "terms-flow-standard-twelve.png"), fullPage: true });
});

test("a refused draft save keeps the editor wording until the deliberate retry reaches the frozen document", async ({ page }, info) => {
    await page.getByRole("button", { name: "Change the terms", exact: true }).click();
    await expect(page.locator("#term-0-title")).toHaveValue(STANDARD_PROPOSAL_TERMS[0]!.title);

    await page.evaluate(() => {
        window.__termsFlowLocal.nextSave = "refused";
    });
    await page.locator("[data-save-draft]").click();
    await expect(page.getByText("Local fixture: draft save not acknowledged.")).toBeVisible();
    const refused = await snapshot(page);
    expect(refused.saves).toHaveLength(1);
    expect(refused.saves[0]!.terms).toBeNull();

    await page.locator("[data-review-save-error]").getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("[data-save-draft]")).toHaveText("Saved");

    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await expect(page.locator("[data-doc-section='terms'] ol[data-doc-terms] > li")).toHaveCount(12);
    await expect(page.locator("[data-doc-section='terms']")).toContainText("Materials & Ownership");

    const retried = await snapshot(page);
    expect(retried.saves).toHaveLength(2);
    expect(retried.proposalDraftSaves).toBe(2);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});
