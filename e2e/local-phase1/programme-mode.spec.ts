import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalProgrammeModeFixture } from "./programme-mode-entry";

// A056: a saved programme opens as the simple mini-Gantt; the detailed planner
// is a deliberate optional step that the existing unsaved-change guard refuses
// until the simple programme is saved. Build with `build-brief-price.mjs <out>
// programme-mode` (A056-PROGRAMME-MODE-2215 compiler hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const MONDAY = "2026-10-19";
const scope = {
    simple: "REAL_COMPONENT SimpleProgrammeClient (mini-Gantt, editor, save controller, unsaved-change refusal, planner toggle) over MOCK_SAVE of real buildProgrammePhases output",
    detailed: "REAL_COMPONENT lazy ClientSchedulePage opened by the actual toggle over the same saved row; its own actions recorded and refused",
    closeContract: "Existing router.refresh on close; MOCK refresh re-renders from the saved row",
    existingEvidenceNotRepeated: "reported-calendar (fc1916c) first-save path and planner dates; programme-styled overview CSS",
    authDatabaseHosted: "NOT_RUN",
};

const state = (page: Page): Promise<LocalProgrammeModeFixture> => page.evaluate(() => JSON.parse(JSON.stringify(window.__programmeModeLocal)));
const settle = (page: Page, ms: number) => page.evaluate(wait => new Promise(resolve => setTimeout(resolve, wait)), ms);
const toggle = (page: Page) => page.locator("button[aria-controls='detailed-planner']");
const miniGantt = (page: Page) => page.locator("[data-programme-preview] [data-programme-overview]");
const stageRows = (page: Page) => miniGantt(page).locator("[data-overview-stage]");

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local programme mode - MOCK save</title></head><body><p>LOCAL FIXTURE: the programme save is a MOCK acknowledgement in memory. The simple editor and detailed planner are the real components. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test("a saved programme opens as the mini-Gantt, refuses the planner while unsaved, and opens and closes it over the same saved phases", async ({ page }, info) => {
    const initial = await state(page);
    expect((initial.projectRow.programme_phases as Array<Record<string, unknown>>).map(phase => [phase.name, phase.startOffset, phase.manualDays]))
        .toEqual([["Demo", 0, 5], ["Install", 7, 5], ["Finishing works", 14, 5]]);

    // 1. Default: the simple mini-Gantt, saved; the planner is closed and not mounted.
    await expect(miniGantt(page)).toBeVisible();
    await expect(stageRows(page)).toHaveCount(3);
    for (const [index, name] of ["Demo", "Install", "Finishing works"].entries()) await expect(stageRows(page).nth(index)).toContainText(name);
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#detailed-planner")).toHaveCount(0);

    // 2. An unsaved simple edit: the existing guard refuses the planner and keeps the edit.
    const stageThree = page.locator("[data-programme-stage]").nth(2).getByLabel("Stage 3", { exact: true });
    await stageThree.fill("Finishing");
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
    await toggle(page).click();
    await expect(page.locator("[data-planner-refused]")).toHaveText("Save your programme first. Opening the planner now would lose the changes above that are not saved yet.");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#detailed-planner")).toHaveCount(0);
    await expect(stageThree).toHaveValue("Finishing");
    const refused = await state(page);
    expect(refused.programmeSaves).toEqual([]);
    expect(refused.plannerCalls).toEqual([]);

    // 3. The contractor saves deliberately; the refusal clears.
    await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    await expect(page.locator("[data-planner-refused]")).toHaveCount(0);
    const saved = await state(page);
    expect(saved.programmeSaves).toEqual([{
        startDate: MONDAY,
        stages: [
            { name: "Demo", workingDays: 5, unit: "weeks", source: 0 },
            { name: "Install", workingDays: 5, unit: "weeks", source: 1 },
            { name: "Finishing", workingDays: 5, unit: "weeks", source: 2 },
        ],
    }]);
    expect((saved.projectRow.programme_phases as Array<Record<string, unknown>>).map(phase => [phase.name, phase.startOffset, phase.manualDays]))
        .toEqual([["Demo", 0, 5], ["Install", 7, 5], ["Finishing", 14, 5]]);

    // 4. The actual toggle opens the actual planner over the same saved row; nothing is written.
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    const planner = page.locator("#detailed-planner");
    await expect(planner).toContainText("15 working days / 19 calendar days");
    await expect(planner).toContainText("6 Nov 26");
    for (const range of ["19 Oct – 23 Oct", "26 Oct – 30 Oct", "2 Nov – 6 Nov"]) await expect(planner).toContainText(range);
    await expect(planner.locator("input[type='date']").first()).toHaveValue(MONDAY);
    await expect(page.locator("[data-programme-preview]")).toHaveCount(0);
    await settle(page, 800);
    const opened = await state(page);
    expect(opened.plannerCalls).toEqual([]);
    expect(opened.programmeSaves).toHaveLength(1);
    expect(opened.projectRow).toEqual(saved.projectRow);

    // 5. Closing uses the existing refresh and returns to the same mini-Gantt.
    await toggle(page).click();
    await expect(page.locator("#detailed-planner")).toHaveCount(0);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(stageRows(page)).toHaveCount(3);
    await expect(stageRows(page).nth(2)).toContainText("Finishing");
    await expect(page.locator("[data-save-status='saved']")).toBeVisible();
    const closed = await state(page);
    expect(closed.refreshes).toBe(1);
    expect(closed.programmeSaves).toHaveLength(1);
    expect(closed.plannerCalls).toEqual([]);
    expect(closed.projectRow).toEqual(saved.projectRow);
    expect(closed.unexpected).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "programme-mode-closed.png"), fullPage: true });
});
