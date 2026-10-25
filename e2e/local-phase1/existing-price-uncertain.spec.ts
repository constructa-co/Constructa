import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalExistingPriceUncertainFixture } from "./existing-price-uncertain-entry";

// PRICING-UNCERTAIN-2345: an EXISTING line's quantity edit inside Advanced
// estimating whose acknowledgement is ambiguous ("uncertain"). The real
// component keeps the exact draft and the acknowledged old money/rows, blocks
// automatic resubmission and the guarded controls, and asks for an established
// reload reconciliation. Build with `build-brief-price.mjs <out>
// existing-price-uncertain` (PRICING-UNCERTAIN-2345 compiler hunks).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const LINE_EDIT = "line-paving";
const LINE_OTHER = "line-gutter";
const QTY_BEFORE = "10";
const QTY_DRAFT = "12";
const GROUP_GW = "£500.00";
const GROUP_ROOF = "£240.00";
const CONTRACT = "£740.00";
const UPDATE_CALL = { name: "updateLineItemAction", args: [LINE_EDIT, { quantity: 12 }] };

const scope = {
    pricing: "REAL EstimateClient/lazy AdvancedEstimate quantity-draft save, uncertainty fence and guarded controls; two synthetic saved simple lines",
    updateLineItemAction: "MOCK: records calls; answers only from the spec's script; 'uncertain' writes nothing (ambiguous save), 'ack' writes the submitted quantity and recomputed totals into the in-memory MOCK store",
    otherActions: "MOCK: recorded as unexpected writes and refused",
    simplePriceServer: "MOCK: refuses; expected unused",
    authDatabaseHosted: "NOT_RUN",
};

type Snapshot = Pick<LocalExistingPriceUncertainFixture, "estimates" | "updateAttempts" | "updateAcknowledgements" | "simpleServerCalls" | "unexpectedWrites"> & { actionCalls: { name: string; args: unknown[] }[] };
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => ({
    estimates: structuredClone(window.__existingPriceUncertainLocal.estimates),
    updateAttempts: window.__existingPriceUncertainLocal.updateAttempts,
    updateAcknowledgements: window.__existingPriceUncertainLocal.updateAcknowledgements,
    simpleServerCalls: window.__existingPriceUncertainLocal.simpleServerCalls,
    unexpectedWrites: window.__existingPriceUncertainLocal.unexpectedWrites,
    actionCalls: window.__existingPriceUncertainActions.actionCalls,
}));
const settle = (page: Page) => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const groupTotal = (page: Page, name: string) => group(page, name).locator("span").first();
const draftBox = (page: Page, lineId: string) => page.locator(`[data-quantity-draft='${lineId}']`);

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local existing-line uncertain price edit fixture</title></head><body><p>LOCAL FIXTURE: the existing-line quantity save answers with an ambiguous MOCK acknowledgement in memory only. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await snapshot(page), requests, pageErrors }), contentType: "application/json" });
});

test("an uncertain existing-line quantity save retains the exact draft and acknowledged old money, blocks guarded controls and is not retried", async ({ page }) => {
    await page.evaluate(() => { window.__existingPriceUncertainActions.script = { update: ["uncertain"] }; });

    await page.locator("button[aria-controls='advanced-estimating']").click();
    await expect(group(page, "Groundworks").locator("[data-quantity-draft]")).toHaveCount(0);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT);
    await expect(groupTotal(page, "Groundworks")).toHaveText(GROUP_GW);
    await expect(groupTotal(page, "Roofing")).toHaveText(GROUP_ROOF);
    const before = await snapshot(page);

    // Deliberate quantity edit on the existing line, then an ambiguous save acknowledgement.
    await group(page, "Groundworks").getByLabel("Quantity", { exact: true }).fill(QTY_DRAFT);
    const draft = draftBox(page, LINE_EDIT);
    await expect(draft).toBeVisible();
    await draft.getByRole("button", { name: "Save quantity", exact: true }).click();

    // The intentional uncertain fence: exact draft retained but disabled, acknowledged old money/rows untouched.
    await expect(draft.getByLabel("Quantity", { exact: true })).toHaveValue(QTY_DRAFT);
    await expect(draft.getByLabel("Quantity", { exact: true })).toBeDisabled();
    await expect(draft).toContainText(`Saved: ${QTY_BEFORE}`);
    await expect(draft.getByRole("button", { name: "Save quantity", exact: true })).toBeDisabled();
    await expect(draft.getByRole("button", { name: "Cancel quantity", exact: true })).toBeDisabled();
    await expect(draft.getByRole("status")).toContainText("may already have saved");
    await expect(draft.getByRole("status")).toContainText("Reload to reconcile");
    await expect(group(page, "Groundworks").getByRole("alert")).toContainText("Line save not confirmed. Some changes may already have saved. Reload the estimate to reconcile this line before editing or applying resources.");
    await expect(page.locator("[data-line-save-warning]")).toContainText("Some line changes are not confirmed.");
    await expect(page.locator("[data-line-save-warning]")).toContainText("Reload to reconcile the saved prices");
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT);
    await expect(groupTotal(page, "Groundworks")).toHaveText(GROUP_GW);
    await expect(groupTotal(page, "Roofing")).toHaveText(GROUP_ROOF);
    await expect(group(page, "Groundworks")).toContainText(GROUP_GW);
    await expect(group(page, "Roofing").locator("[data-quantity-draft]")).toHaveCount(0);

    // No automatic resubmission: exactly one attempted write, no acknowledgement, store untouched.
    await settle(page);
    const fenced = await snapshot(page);
    expect(fenced.actionCalls).toEqual([UPDATE_CALL]);
    expect(fenced.updateAttempts).toEqual([{ lineId: LINE_EDIT, updates: { quantity: 12 } }]);
    expect(fenced.updateAcknowledgements).toBe(0);
    expect(fenced.estimates).toEqual(before.estimates);
    expect(fenced.simpleServerCalls).toEqual([]);
    expect(fenced.unexpectedWrites).toEqual([]);

    // Guarded controls stay fenced: the uncertain line cannot be removed, and the
    // other line's writes are refused without starting any new work.
    await expect(group(page, "Groundworks").getByRole("button", { name: "Remove line", exact: true })).toBeDisabled();
    await expect(group(page, "Roofing").getByLabel("Quantity", { exact: true })).toBeDisabled();
    await expect(group(page, "Roofing").getByLabel("Quantity", { exact: true })).toHaveValue("8");
    await expect(draftBox(page, LINE_OTHER)).toHaveCount(0);
    await expect(group(page, "Roofing").getByRole("button", { name: "Save quantity", exact: true })).toHaveCount(0);
    await group(page, "Roofing").getByRole("button", { name: "Remove line", exact: true }).click();
    await expect(group(page, "Roofing").getByLabel("Quantity", { exact: true })).toBeVisible();
    await expect(groupTotal(page, "Roofing")).toHaveText(GROUP_ROOF);

    // Still no retry and no new write after probing the guarded controls.
    await settle(page);
    const probed = await snapshot(page);
    expect(probed.actionCalls).toEqual([UPDATE_CALL]);
    expect(probed.estimates).toEqual(before.estimates);
    expect(probed.simpleServerCalls).toEqual([]);
    expect(probed.unexpectedWrites).toEqual([]);

    await page.screenshot({ path: path.join(output, "existing-price-uncertain-fenced.png"), fullPage: true });
});

// A054 Partial — append this single test to e2e/local-phase1/existing-price-uncertain.spec.ts.
// Reuses that spec's boot, helpers (snapshot, settle, group, groupTotal, draftBox), constants,
// playwright.local-existing-price-uncertain.config.ts, existing-price-uncertain-entry.tsx, and
// `build-brief-price.mjs <out> existing-price-uncertain`. Do not copy boot or the fenced-control matrix.
// NOT_RUN here; coordinator compiles and grades. Playwright keyboard on the native summary only —
// not an OS keyboard, physical phone, served theme, hosted, or legal-release claim.

test("native running-total fold under an uncertain Advanced quantity save hides the dock amount and exact note without a second write", async ({ page }) => {
    await page.evaluate(() => { window.__existingPriceUncertainActions.script = { update: ["uncertain"] }; });

    await page.locator("button[aria-controls='advanced-estimating']").click();
    const before = await snapshot(page);
    await group(page, "Groundworks").getByLabel("Quantity", { exact: true }).fill(QTY_DRAFT);
    const draft = draftBox(page, LINE_EDIT);
    await draft.getByRole("button", { name: "Save quantity", exact: true }).click();

    await expect(draft.getByLabel("Quantity", { exact: true })).toHaveValue(QTY_DRAFT);
    await expect(draft).toContainText(`Saved: ${QTY_BEFORE}`);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT);
    await expect(groupTotal(page, "Groundworks")).toHaveText(GROUP_GW);
    await expect(groupTotal(page, "Roofing")).toHaveText(GROUP_ROOF);
    const groupedWarning = group(page, "Groundworks").getByRole("alert");
    const pageWarning = page.locator("[data-line-save-warning]");
    await expect(groupedWarning).toContainText("Line save not confirmed. Some changes may already have saved. Reload the estimate to reconcile this line before editing or applying resources.");
    await expect(pageWarning).toContainText("Some line changes are not confirmed.");
    await expect(pageWarning).toContainText("Reload to reconcile the saved prices");
    await settle(page);
    const fenced = await snapshot(page);
    expect(fenced.estimates).toEqual(before.estimates);
    await expect(draft.getByLabel("Quantity", { exact: true })).toBeDisabled();
    expect(fenced.actionCalls).toEqual([UPDATE_CALL]);
    expect(fenced.updateAttempts).toEqual([{ lineId: LINE_EDIT, updates: { quantity: 12 } }]);
    expect(fenced.updateAcknowledgements).toBe(0);

    const dock = page.locator("[data-running-total]");
    const disclosure = dock.locator("[data-running-total-disclosure]");
    const toggle = disclosure.locator("summary");
    const values = disclosure.locator("[data-running-total-values]");
    const amount = values.locator("[data-in-view-contract-sum]");
    const note = values.locator("p");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(amount).toHaveText(CONTRACT);
    await expect(note).toHaveText("May include changes not yet confirmed.");
    await expect(dock.locator("[data-line-save-warning]")).toHaveCount(0);
    await expect(dock.getByRole("alert")).toHaveCount(0);

    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(amount).toBeHidden();
    await expect(note).toBeHidden();
    await expect(values).toBeHidden();
    await expect(draft.getByLabel("Quantity", { exact: true })).toHaveValue(QTY_DRAFT);
    await expect(draft).toContainText(`Saved: ${QTY_BEFORE}`);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT);
    await expect(groupTotal(page, "Groundworks")).toHaveText(GROUP_GW);
    await expect(groupTotal(page, "Roofing")).toHaveText(GROUP_ROOF);
    await expect(groupedWarning).toBeVisible();
    await expect(pageWarning).toBeVisible();
    await expect(toggle).toBeVisible();

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(amount).toHaveText(CONTRACT);
    await expect(note).toHaveText("May include changes not yet confirmed.");
    await expect(draft.getByLabel("Quantity", { exact: true })).toHaveValue(QTY_DRAFT);
    await expect(draft).toContainText(`Saved: ${QTY_BEFORE}`);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT);
    await expect(groupedWarning).toBeVisible();
    await expect(pageWarning).toBeVisible();
    await expect(dock.locator("[data-line-save-warning]")).toHaveCount(0);
    await expect(dock.getByRole("alert")).toHaveCount(0);

    await settle(page);
    const folded = await snapshot(page);
    expect(folded.actionCalls).toEqual([UPDATE_CALL]);
    expect(folded.updateAttempts).toEqual([{ lineId: LINE_EDIT, updates: { quantity: 12 } }]);
    expect(folded.updateAcknowledgements).toBe(0);
    expect(folded.estimates).toEqual(fenced.estimates);
    expect(folded.simpleServerCalls).toEqual([]);
    expect(folded.unexpectedWrites).toEqual([]);
});
