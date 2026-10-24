import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalActivityGroupingFixture } from "./activity-grouping-entry";

// A051: an EXISTING line's activity changed inside Advanced estimating, and the
// actual grouping that follows. Build with `build-brief-price.mjs <out>
// activity-grouping` (A051-ACTIVITY-GROUPING-2035 compiler hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const ESTIMATE = "local-activity-grouping-estimate";
const SAVE_ARGS = [{ lineId: "line-paving", estimateId: ESTIMATE, expectedSection: "Groundworks", section: "Paving" }];
const scope = {
    pricing: "REAL_COMPONENT EstimateClient + lazy AdvancedEstimate (activity control, gates, grouping, section totals)",
    activitySave: "MOCK savePriceLineActivityAction: records calls; answers only from the spec's script; ack writes only trade_section",
    unsupportedLines: "Built-up and Preliminaries lines: no activity control, by existing source gates",
    authDatabaseHosted: "NOT_RUN",
};

type Snapshot = Pick<LocalActivityGroupingFixture, "estimates" | "simpleServerCalls"> & { actionCalls: { name: string; args: unknown[] }[] };
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => ({
    estimates: structuredClone(window.__activityGroupingLocal.estimates),
    simpleServerCalls: window.__activityGroupingLocal.simpleServerCalls,
    actionCalls: window.__activityGroupingActions.actionCalls,
}));
const settle = (page: Page) => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const groupTotal = (page: Page, name: string) => group(page, name).locator("span").first();
const change = (page: Page, lineId: string) => page.locator(`[data-line-activity='${lineId}']`);

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local existing-line activity grouping - MOCK acknowledgements</title></head><body><p>LOCAL FIXTURE: activity saves are MOCK acknowledgements or refusals in memory. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await snapshot(page), requests, pageErrors }), contentType: "application/json" });
});

/** Opens Advanced estimating and checks the starting groups and which lines offer the control. */
async function openAdvanced(page: Page) {
    const contractSum = await page.locator("[data-contract-sum]").innerText();
    await page.locator("button[aria-controls='advanced-estimating']").click();
    await expect(change(page, "line-paving")).toBeVisible();
    await expect(groupTotal(page, "Groundworks")).toHaveText("£740.00");
    await expect(groupTotal(page, "External Works")).toHaveText("£300.00");
    await expect(groupTotal(page, "Preliminaries")).toHaveText("£200.00");
    await expect(group(page, "Paving")).toHaveCount(0);
    await expect(group(page, "Groundworks").locator("[data-line-activity]")).toHaveCount(2);
    await expect(change(page, "line-paving")).toHaveText("Activity: Groundworks · Change");
    // Built-up and Preliminaries lines are not assigned by this control.
    await expect(change(page, "line-kerbs")).toHaveCount(0);
    await expect(change(page, "line-welfare")).toHaveCount(0);
    return { contractSum, before: await snapshot(page) };
}

async function draftPaving(page: Page) {
    await change(page, "line-paving").click();
    const editor = page.locator("[data-line-activity-editor='line-paving']");
    const input = editor.getByLabel("Work activity for this line", { exact: true });
    await expect(input).toHaveValue("Groundworks");
    await expect(change(page, "line-excavate")).toBeDisabled();
    await input.fill("Paving");
    return { editor, input, save: editor.getByRole("button", { name: "Save activity", exact: true }), cancel: editor.getByRole("button", { name: "Cancel", exact: true }) };
}

test("cancel, a refused save and a deliberate acknowledged retry regroup only the edited existing line", async ({ page }) => {
    await page.evaluate(() => { window.__activityGroupingActions.script = { activity: ["refuse", "ack"] }; });
    const { contractSum, before } = await openAdvanced(page);

    // Cancel keeps the old grouping and saves nothing.
    const first = await draftPaving(page);
    await first.cancel.click();
    await expect(first.editor).toHaveCount(0);
    await expect(group(page, "Groundworks").locator("[data-line-activity='line-paving']")).toBeVisible();
    await expect(group(page, "Paving")).toHaveCount(0);
    expect((await snapshot(page)).actionCalls).toEqual([]);

    // A refused save keeps the exact text and the old grouping, and waits for a deliberate retry.
    const draft = await draftPaving(page);
    await draft.save.click();
    await expect(draft.editor.getByRole("alert")).toHaveText("Local fixture: activity not acknowledged.");
    await expect(draft.input).toHaveValue("Paving");
    await expect(draft.save).toBeEnabled();
    await expect(group(page, "Groundworks").locator("[data-line-activity-editor='line-paving']")).toBeVisible();
    await expect(group(page, "Paving")).toHaveCount(0);
    await expect(groupTotal(page, "Groundworks")).toHaveText("£740.00");
    await settle(page);
    expect((await snapshot(page)).actionCalls).toEqual([{ name: "savePriceLineActivityAction", args: SAVE_ARGS }]);

    // Only after the acknowledgement does the line move to its new group.
    await draft.save.click();
    await expect(draft.editor).toHaveCount(0);
    await expect(group(page, "Paving").locator("[data-line-activity='line-paving']")).toHaveText("Activity: Paving · Change");
    await expect(groupTotal(page, "Paving")).toHaveText("£500.00");
    await expect(groupTotal(page, "Groundworks")).toHaveText("£240.00");
    await expect(group(page, "Groundworks").locator("[data-line-activity]")).toHaveCount(1);
    await expect(groupTotal(page, "External Works")).toHaveText("£300.00");
    await expect(groupTotal(page, "Preliminaries")).toHaveText("£200.00");
    await expect(page.locator("[data-contract-sum]")).toHaveText(contractSum);

    const after = await snapshot(page);
    expect(after.actionCalls).toEqual([
        { name: "savePriceLineActivityAction", args: SAVE_ARGS },
        { name: "savePriceLineActivityAction", args: SAVE_ARGS },
    ]);
    // Only the edited line's activity changed; quantity, unit, rate, total and resources did not.
    const expected = structuredClone(before.estimates);
    expected[0]!.estimate_lines = expected[0]!.estimate_lines.map(row => row.id === "line-paving" ? { ...row, trade_section: "Paving" } : row);
    expect(after.estimates).toEqual(expected);
    expect(after.simpleServerCalls).toEqual([]);
    await page.screenshot({ path: path.join(output, "activity-grouping-acknowledged.png"), fullPage: true });
});

test("an uncertain activity save stays fenced with the exact text and old grouping, and is not retried", async ({ page }) => {
    await page.evaluate(() => { window.__activityGroupingActions.script = { activity: ["uncertain"] }; });
    const { contractSum, before } = await openAdvanced(page);
    const draft = await draftPaving(page);
    await draft.save.click();

    await expect(draft.editor.getByRole("alert")).toHaveText("The activity may have saved. Your exact text is retained. Reload to reconcile it before retrying.");
    await expect(draft.input).toHaveValue("Paving");
    await expect(draft.input).toBeDisabled();
    await expect(draft.save).toBeDisabled();
    await expect(draft.cancel).toBeDisabled();
    await expect(change(page, "line-excavate")).toBeDisabled();
    await expect(group(page, "Groundworks").locator("[data-line-activity-editor='line-paving']")).toBeVisible();
    await expect(group(page, "Paving")).toHaveCount(0);
    await expect(groupTotal(page, "Groundworks")).toHaveText("£740.00");
    await expect(page.locator("[data-contract-sum]")).toHaveText(contractSum);
    await settle(page);
    const after = await snapshot(page);
    expect(after.actionCalls).toEqual([{ name: "savePriceLineActivityAction", args: SAVE_ARGS }]);
    expect(after.estimates).toEqual(before.estimates);
    expect(after.simpleServerCalls).toEqual([]);
    await page.screenshot({ path: path.join(output, "activity-grouping-uncertain.png"), fullPage: true });
});
