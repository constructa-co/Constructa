import { expect, test, type Download, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";
import type { LocalReportedCalendarFixture } from "./reported-calendar-entry";

// A058: Rob's reported example. Demo, Install and Finishing works, one week each,
// entered on the actual simple editor, saved (MOCK), then read back by the
// actual detailed planner and the actual proposal / draft PDF.
// Build with `build-brief-price.mjs <out> reported-calendar` (A058-REPORTED-CALENDAR-2045 hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const SUNDAY = "2026-10-18";
const MONDAY = "2026-10-19";
const PROJECT = "local-reported-calendar-job";
const STAGES = ["Demo", "Install", "Finishing works"];
const scope = {
    simpleProgramme: "REAL_COMPONENT SimpleProgrammeClient (validation, stage editor, save controller) over MOCK_SAVE of real buildProgrammePhases output",
    detailedPlanner: "REAL_COMPONENT lazy ClientSchedulePage over the same saved row; its own actions recorded and refused; 5-day week is explicit stand-in input",
    proposal: "REAL_COMPONENT ReviewSendClient, REAL frozen snapshot/document builders, REAL jsPDF, decoded with installed unpdf",
    routingRefresh: "MOCK router; refresh/revalidation re-renders with the saved row",
    existingEvidenceNotRepeated: "planner-dates.test.tsx (hand-built phases, SSR) and programme-styled native overview CSS",
    authDatabasePublicationHosted: "NOT_RUN",
};

const state = (page: Page): Promise<LocalReportedCalendarFixture> => page.evaluate(() => JSON.parse(JSON.stringify(window.__reportedCalendarLocal)));
const settle = (page: Page, ms: number) => page.evaluate(wait => new Promise(resolve => setTimeout(resolve, wait)), ms);

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
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local reported calendar example - MOCK programme save</title></head><body><p>LOCAL FIXTURE: the programme save is a MOCK acknowledgement in memory. Planner, snapshot, document and PDF use the real code. No account, server, database or publication.</p><div id="app"></div></body></html>');
    await page.exposeFunction("__localReportedCalendarSha256", async (algorithm: string, bytes: number[]) => {
        if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
        return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
    });
    await page.evaluate(() => {
        if (crypto.subtle) return;
        const bridge = (window as unknown as { __localReportedCalendarSha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localReportedCalendarSha256;
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

test("the reported three one-week stages finish on 6 November in the simple editor, detailed planner, frozen proposal and draft PDF", async ({ page }, info) => {
    // The job's saved start is Sunday 18 Oct, shown exactly as saved.
    const start = page.getByLabel("Start on site", { exact: true });
    await expect(start).toHaveValue(SUNDAY);

    await page.getByRole("button", { name: "Break the job into stages", exact: true }).click();
    for (const [index, name] of STAGES.entries()) {
        if (index > 0) await page.getByRole("button", { name: "Add a stage", exact: true }).click();
        const stage = page.locator("[data-programme-stage]").nth(index);
        await stage.getByLabel(`Stage ${index + 1}`, { exact: true }).fill(name);
        await stage.getByLabel("How long", { exact: true }).fill("1");
        await stage.getByLabel(`Days or weeks for ${name}`, { exact: true }).selectOption("weeks");
    }

    // Saving with the Sunday is refused by the existing weekday rule; nothing is saved or moved.
    const save = page.locator("[data-programme-preview]").getByRole("button", { name: /Save programme|Try again/ });
    await save.click();
    await expect(page.locator("#programme-start-error")).toHaveText("Choose a weekday. The programme counts Monday to Friday.");
    await expect(start).toHaveValue(SUNDAY);
    expect((await state(page)).programmeSaves).toEqual([]);

    // The contractor deliberately chooses Monday 19 Oct, then saves.
    await start.fill(MONDAY);
    await save.click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    const saved = await state(page);
    expect(saved.programmeSaves).toEqual([{
        startDate: MONDAY,
        stages: STAGES.map(name => ({ name, workingDays: 5, unit: "weeks", source: null })),
    }]);
    expect(saved.projectRow.start_date).toBe(MONDAY);
    expect((saved.projectRow.programme_phases as Array<Record<string, unknown>>).map(phase => [phase.name, phase.startOffset, phase.manualDays]))
        .toEqual([["Demo", 0, 5], ["Install", 7, 5], ["Finishing works", 14, 5]]);

    // The actual detailed planner reads the same saved row.
    await page.locator("button[aria-controls='detailed-planner']").click();
    const planner = page.locator("#detailed-planner");
    await expect(planner).toContainText("15 working days / 19 calendar days");
    await expect(planner).toContainText("6 Nov 26");
    await expect(planner).toContainText("3 weeks");
    for (const range of ["19 Oct – 23 Oct", "26 Oct – 30 Oct", "2 Nov – 6 Nov"]) await expect(planner).toContainText(range);
    await expect(planner).toContainText("Mon–Fri");
    await expect(planner).not.toContainText("9 Nov 26");
    await expect(planner).not.toContainText("4 calendar weeks");
    await expect(planner.locator("input[type='date']").first()).toHaveValue(MONDAY);
    // Opening the planner saves nothing and reads nothing (its 500 ms autosave window passes).
    await settle(page, 800);
    const opened = await state(page);
    expect(opened.plannerCalls).toEqual([]);
    expect(opened.programmeSaves).toHaveLength(1);
    expect(opened.projectRow).toEqual(saved.projectRow);

    await page.locator("button[aria-controls='detailed-planner']").click();
    await expect(planner).toHaveCount(0);
    await page.getByRole("button", { name: "Next: Proposal", exact: true }).click();

    // The actual frozen proposal document.
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    const documentView = page.locator("[data-proposal-document]");
    await expect(documentView).toBeVisible();
    const facts = page.locator("[data-key-facts]");
    await expect(facts).toContainText("19 Oct 2026");
    await expect(facts).toContainText("6 Nov 2026");
    await expect(facts).toContainText("3 weeks");
    await expect(facts).not.toContainText("9 Nov 2026");
    const programme = page.locator("[data-doc-section='programme']");
    for (const name of STAGES) await expect(programme).toContainText(name);
    await expect(programme).toContainText("Monday 19 October 2026");
    await expect(programme).toContainText("Friday 6 November 2026");
    const shown = await documentView.innerText();
    for (const absent of [/\b9 Nov/, /\b18 Oct/, /4 calendar weeks/]) expect(shown).not.toMatch(absent);

    // The real draft PDF.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download this draft as a PDF", exact: true }).click();
    const download = await downloadPromise;
    const pdf = await readPdfBytes(download);
    await download.saveAs(path.join(output, "reported-calendar-draft.pdf"));
    const text = await pdfWords(pdf);
    for (const present of [...STAGES, "6 Nov", "19 Oct", "3 weeks"]) expect(text).toContain(present);
    for (const absent of [/\b9 Nov/, /\b18 Oct/, /4 calendar weeks/]) expect(text).not.toMatch(absent);
    await expect(page.locator("[data-presend-pdf-result]")).toContainText("Nothing has been sent.");

    const finished = await state(page);
    expect(finished.view).toBe("proposal");
    expect(finished.navigation).toEqual([`/dashboard/projects/proposal?projectId=${PROJECT}`]);
    expect(finished.proposalContext).toEqual({ startDate: MONDAY, phases: saved.projectRow.programme_phases });
    expect(finished.programmeSaves).toHaveLength(1);
    expect(finished.plannerCalls).toEqual([]);
    expect(finished.proposalDraftSaves).toBe(0);
    expect(finished.publicationsAttempted).toBe(0);
    expect(finished.unexpected).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "reported-calendar-proposal.png"), fullPage: true });
});
