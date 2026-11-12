import { expect, test, type Download, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import type { LocalTermsFlowFixture } from "./terms-flow-entry";

// A076: an unsent draft asks the client to confirm receipt; it never says
// receipt was confirmed. Uses the existing terms-flow bundle and entry
// unchanged (`build-brief-price.mjs <out> terms-flow`): actual ReviewSendClient,
// frozen preview snapshot, ProposalDocument, real jsPDF download, decoded with
// the installed unpdf. The response mode is chosen with the client's own radios.
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    responseChoice: "REAL_COMPONENT radios (ReviewSendClient response/choose)",
    proposalDocument: "REAL_BUILDERS (buildPreviewSnapshot -> buildProposalDocument -> ProposalDocumentView)",
    proposalPdf: "REAL_BUILDER (downloadProposalPdf -> renderProposalBrochure, jsPDF), decoded with installed unpdf",
    draftSavePublishSend: "Fixture counters only; none expected. Client response, receipt, status and Won have no path in this fixture",
    authDatabaseEmailHosted: "NOT_RUN",
    draftHashing: "REAL_NODE_WEBCRYPTO over explicit insecure-about:blank bridge, not native secure-origin WebCrypto",
};

const ACKNOWLEDGEMENT = {
    heading: "Confirm you have received this proposal",
    notice: "It is not acceptance of the proposal and does not create a contract.",
    action: "Confirm receipt",
    signature: "Client: confirm receipt",
};
const INTENT = { heading: "Tell us you intend to go ahead", signature: "Client: intention to proceed (not binding)" };

const fixtureState = (page: Page): Promise<Pick<LocalTermsFlowFixture, "saves" | "proposalDraftSaves" | "publicationsAttempted"> & { terms: unknown }> =>
    page.evaluate(() => ({
        saves: window.__termsFlowLocal.saves,
        proposalDraftSaves: window.__termsFlowLocal.proposalDraftSaves,
        publicationsAttempted: window.__termsFlowLocal.publicationsAttempted,
        terms: window.__termsFlowLocal.project.tc_overrides,
    }));

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
    requests = [];
    pageErrors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", (route) => route.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local draft receipt wording - unsent draft PDF</title></head><body><p>LOCAL FIXTURE: unsent draft only. The frozen snapshot, document and PDF are built by the real code. No account, server, database, response or send.</p><div id="app"></div></body></html>',
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

test("an explicitly chosen acknowledgement draft asks for receipt in the document and downloaded PDF without claiming it, saving or sending", async ({ page }, info) => {
    const acknowledgement = page.locator("[data-response-option='acknowledgement'] input[type='radio']");
    const intent = page.locator("[data-response-option='non_binding_intent'] input[type='radio']");
    const prepare = page.getByRole("button", { name: "1. Prepare proposal", exact: true });
    const review = page.getByRole("button", { name: "2. Review document", exact: true });
    const response = page.locator("[data-proposal-document] [data-doc-section='response']");

    // The preview follows the contractor's explicit choice, in both directions.
    await intent.check();
    await expect(intent).toBeChecked();
    await review.click();
    await expect(response).toContainText(INTENT.heading);
    await prepare.click();
    await acknowledgement.check();
    await expect(acknowledgement).toBeChecked();
    await expect(intent).not.toBeChecked();
    await review.click();

    await expect(response).toBeVisible();
    await expect(response.locator("#doc-response")).toHaveText(ACKNOWLEDGEMENT.heading);
    await expect(response).toContainText(ACKNOWLEDGEMENT.notice);
    await expect(response).toContainText(ACKNOWLEDGEMENT.action);
    await expect(response).not.toContainText(INTENT.heading);
    expect(await page.locator("[data-proposal-document]").innerText()).not.toMatch(/receipt confirmed/i);
    await expect(page.locator("[data-proposal-document] [data-draft-banner]")).toContainText("This has not been sent to the client.");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Garage_conversion_Proposal_Draft.pdf");
    const pdf = await readPdfBytes(download);
    await download.saveAs(path.join(output, "draft-receipt-acknowledgement.pdf"));

    const text = await pdfWords(pdf);
    expect(text).toContain(ACKNOWLEDGEMENT.signature);
    expect(text).not.toMatch(/receipt confirmed/i);
    expect(text).not.toContain(INTENT.signature);
    expect(text).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");

    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Draft PDF downloaded.");
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");
    // The draft keeps the chosen mode, and nothing was saved, published or sent.
    await expect(acknowledgement).toBeChecked();
    expect(await fixtureState(page)).toEqual({ saves: [], proposalDraftSaves: 0, publicationsAttempted: 0, terms: null });
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "draft-receipt-acknowledgement.png"), fullPage: true });
});
