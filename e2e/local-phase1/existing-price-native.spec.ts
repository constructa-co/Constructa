import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalExistingPriceNativeFixture } from "./existing-price-native-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const ESTIMATE = "local-existing-price-estimate";
const LINE_EDIT = "line-roof-tiles";
const LINE_REMOVE = "line-gutter-run";
const LINE_EDIT_DESC = "TEST DATA - Roof tiles";
const LINE_REMOVE_DESC = "TEST DATA - Gutter run";
const CONTRACT_BEFORE = "£180.00";
const CONTRACT_AFTER_EDIT = "£320.00";
const CONTRACT_AFTER_REMOVE = "£240.00";
const GROUP_GW_BEFORE = "£100.00";
const GROUP_GW_AFTER = "£240.00";
const GROUP_ROOFING = "£80.00";

const scope = {
    pricing: "REAL_EstimateClient/controller/reducer; two synthetic saved simple lines",
    updateLine: "MOCK updateLine: script refuse then ack; store from submitted quantity/rate only",
    deleteLine: "MOCK deleteLine: script refuse then ack; removes supported simple line only",
    saveLine: "REFUSED_BY_FIXTURE (not used for existing-line edit)",
    advancedBuiltUpBoQPrelims: "EXCLUDED_OR_GATED_BY_SOURCE; not exercised",
    authDatabaseHosted: "NOT_RUN",
};

type Snapshot = Pick<
    LocalExistingPriceNativeFixture,
    "estimates" | "updateAttempts" | "deleteAttempts" | "updateAcknowledgements" | "deleteAcknowledgements" | "saveLineCalls" | "unexpectedWrites"
>;

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => {
    const f = window.__existingPriceNativeLocal;
    return {
        estimates: structuredClone(f.estimates),
        updateAttempts: f.updateAttempts,
        deleteAttempts: f.deleteAttempts,
        updateAcknowledgements: f.updateAcknowledgements,
        deleteAcknowledgements: f.deleteAcknowledgements,
        saveLineCalls: f.saveLineCalls,
        unexpectedWrites: f.unexpectedWrites,
    };
});

const inlineEditor = (page: Page, lineId: string) => page.locator(`[data-price-line="${lineId}"]:has(form[id$="-inline-form"])`);

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local existing simple-line price edit fixture</title></head><body><p>LOCAL FIXTURE: existing-line quantity/rate edits and removes use MOCK updateLine/deleteLine acknowledgements in memory only. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await snapshot(page), requests, pageErrors }), contentType: "application/json" });
});

test("refused then acknowledged existing-line edit updates group and running totals; refused then acknowledged remove drops the other line", async ({ page }) => {
    await page.evaluate(() => {
        window.__existingPriceNativeLocal.script = { update: ["refuse", "ack"], delete: ["refuse", "ack"] };
    });

    await expect(page.locator("[data-price-line]")).toHaveCount(2);
    await page.getByRole("button", { name: "Show activity breakdown", exact: true }).click();
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_BEFORE);
    await expect(page.locator('[data-activity-subtotal="Groundworks"]')).toContainText(GROUP_GW_BEFORE);
    await expect(page.locator('[data-activity-subtotal="Roofing"]')).toContainText(GROUP_ROOFING);
    const before = await snapshot(page);

    await page.getByRole("button", { name: "Show quantities and rates", exact: true }).click();
    await page.getByRole("button", { name: `Change ${LINE_EDIT_DESC}`, exact: true }).click();
    const editor = inlineEditor(page, LINE_EDIT);
    await expect(editor).toBeVisible();
    await editor.getByLabel(/Quantity for/, { exact: false }).fill("4");
    await editor.getByLabel(/Rate in pounds for/, { exact: false }).fill("60");
    await editor.getByRole("button", { name: "Save line", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("price update not acknowledged");
    await expect(editor.getByLabel(/Quantity for/, { exact: false })).toHaveValue("4");
    await expect(editor.getByLabel(/Rate in pounds for/, { exact: false })).toHaveValue("60");
    await expect(editor).toContainText("Saved £100.00");
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_BEFORE);
    await expect(page.locator('[data-activity-subtotal="Groundworks"]')).toContainText(GROUP_GW_BEFORE);

    const refusedUpdate = await snapshot(page);
    expect(refusedUpdate.updateAttempts).toHaveLength(1);
    expect(refusedUpdate.updateAttempts[0]).toMatchObject({
        estimateId: ESTIMATE,
        lineId: LINE_EDIT,
        line: { description: LINE_EDIT_DESC, quantity: 4, unit: "nr", unit_rate: 60 },
    });
    expect(refusedUpdate.updateAcknowledgements).toBe(0);
    expect(refusedUpdate.estimates).toEqual(before.estimates);
    expect(refusedUpdate.saveLineCalls).toBe(0);

    await editor.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(editor).toHaveCount(0);
    const savedRow = page.locator(`[data-price-line="${LINE_EDIT}"]`);
    await expect(savedRow.locator('[data-label="Quantity"]')).toHaveText("4");
    await expect(savedRow.locator('[data-label="Unit"]')).toHaveText("nr");
    await expect(savedRow.locator('[data-label="Rate"]')).toHaveText("£60.00");
    await expect(savedRow.locator('[data-label="Price"]')).toHaveText("£240.00");
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER_EDIT);
    await expect(page.locator('[data-activity-subtotal="Groundworks"]')).toContainText(GROUP_GW_AFTER);
    await expect(page.locator('[data-activity-subtotal="Roofing"]')).toContainText(GROUP_ROOFING);

    const acknowledgedUpdate = await snapshot(page);
    expect(acknowledgedUpdate.updateAttempts).toHaveLength(2);
    expect(acknowledgedUpdate.updateAcknowledgements).toBe(1);
    expect(acknowledgedUpdate.estimates[0].estimate_lines.find(l => l.id === LINE_EDIT)).toMatchObject({
        quantity: 4,
        unit_rate: 60,
        line_total: 240,
    });

    await page.getByRole("button", { name: `Remove ${LINE_REMOVE_DESC}`, exact: true }).click();
    await page.getByRole("button", { name: "Remove line", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("line delete not acknowledged");
    await expect(page.locator(`[data-price-line="${LINE_REMOVE}"]`)).toHaveCount(1);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER_EDIT);

    const refusedDelete = await snapshot(page);
    expect(refusedDelete.deleteAttempts).toHaveLength(1);
    expect(refusedDelete.deleteAttempts[0]).toEqual({ estimateId: ESTIMATE, lineId: LINE_REMOVE });
    expect(refusedDelete.deleteAcknowledgements).toBe(0);
    expect(refusedDelete.estimates[0].estimate_lines).toHaveLength(2);

    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator(`[data-price-line="${LINE_REMOVE}"]`)).toHaveCount(0);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER_REMOVE);
    await expect(page.locator('[data-activity-subtotal="Roofing"]')).toHaveCount(0);
    await expect(page.locator('[data-activity-subtotal="Groundworks"]')).toContainText(GROUP_GW_AFTER);

    const finished = await snapshot(page);
    expect(finished.deleteAttempts).toHaveLength(2);
    expect(finished.deleteAcknowledgements).toBe(1);
    expect(finished.estimates[0].estimate_lines).toHaveLength(1);
    expect(finished.estimates[0].estimate_lines[0].id).toBe(LINE_EDIT);
    expect(finished.unexpectedWrites).toEqual([]);
    expect(finished.saveLineCalls).toBe(0);

    await page.screenshot({ path: path.join(output, "existing-price-native-acknowledged.png"), fullPage: true });
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    test(`running total folds without changing a retained price draft or its deliberate save at ${viewport.width}px`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        await page.evaluate(() => { window.__existingPriceNativeLocal.script.update = ["refuse", "ack"]; });
        const dock = page.locator("[data-running-total]");
        const disclosure = dock.locator("[data-running-total-disclosure]");
        const toggle = disclosure.locator("summary");
        const values = disclosure.locator("[data-running-total-values]");
        const amount = values.locator("[data-in-view-contract-sum]");
        await expect(disclosure).toHaveAttribute("open", "");
        await expect(amount).toHaveText(CONTRACT_BEFORE);
        await expect(values).toContainText("May include changes not yet confirmed.");
        const expanded = await dock.boundingBox();
        expect(expanded).not.toBeNull();
        const before = await snapshot(page);

        await toggle.click();
        await expect(disclosure).not.toHaveAttribute("open", "");
        await expect(values).toBeHidden();
        const folded = await dock.boundingBox();
        expect(folded).not.toBeNull();
        expect(folded!.height).toBeLessThan(expanded!.height);

        await page.getByRole("button", { name: "Show quantities and rates", exact: true }).click();
        await page.getByRole("button", { name: `Change ${LINE_EDIT_DESC}`, exact: true }).click();
        const editor = inlineEditor(page, LINE_EDIT);
        const quantity = editor.getByLabel(/Quantity for/, { exact: false });
        const rate = editor.getByLabel(/Rate in pounds for/, { exact: false });
        await quantity.fill("4");
        await rate.fill("60");
        await expect(disclosure).not.toHaveAttribute("open", "");
        await expect(values).toBeHidden();
        const typed = await snapshot(page);
        expect(typed).toEqual(before);

        await toggle.focus();
        await page.keyboard.press("Space");
        await expect(disclosure).toHaveAttribute("open", "");
        await expect(amount).toHaveText(CONTRACT_BEFORE);
        await expect(quantity).toHaveValue("4");
        await expect(rate).toHaveValue("60");
        await toggle.click();
        await editor.getByRole("button", { name: "Save line", exact: true }).click();
        await expect(editor.getByRole("alert")).toContainText("price update not acknowledged");
        await expect(disclosure).not.toHaveAttribute("open", "");
        await expect(values).toBeHidden();
        await expect(quantity).toHaveValue("4");
        await expect(rate).toHaveValue("60");
        const refused = await snapshot(page);
        expect(refused.updateAttempts).toHaveLength(1);
        expect(refused.updateAcknowledgements).toBe(0);
        expect(refused.estimates).toEqual(before.estimates);

        await toggle.focus();
        await page.keyboard.press("Enter");
        await expect(disclosure).toHaveAttribute("open", "");
        await expect(amount).toHaveText(CONTRACT_BEFORE);
        await editor.getByRole("button", { name: "Try again", exact: true }).click();
        await expect(editor).toHaveCount(0);
        await expect(amount).toHaveText(CONTRACT_AFTER_EDIT);
        await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER_EDIT);
        await expect(values).toContainText("May include changes not yet confirmed.");
        const finished = await snapshot(page);
        expect(finished.updateAttempts).toHaveLength(2);
        expect(finished.updateAttempts[1]).toEqual(finished.updateAttempts[0]);
        expect(finished.updateAcknowledgements).toBe(1);
        expect(finished.deleteAttempts).toEqual([]);
        expect(finished.saveLineCalls).toBe(0);
        expect(finished.unexpectedWrites).toEqual([]);
        await info.attach("running-total-fold", { body: JSON.stringify({ viewport, expanded, folded,
            scope: "Actual CSS-module/EstimateClient; native disclosure and keyboard; MOCK save, not OS keyboard/served Tailwind/AuthDB/hosted" }), contentType: "application/json" });
        await page.screenshot({ path: path.join(output, `running-total-fold-${viewport.width}.png`), fullPage: true });
    });
}
