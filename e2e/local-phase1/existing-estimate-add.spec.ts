import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalExistingEstimateAddFixture } from "./existing-estimate-add-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const ESTIMATE = "local-existing-estimate-add-estimate";
const RETAINED_A = "line-retained-excavation";
const RETAINED_B = "line-retained-fascia";
const NEW_DESC = "TEST DATA - Added downpipe run";
const NEW_ACTIVITY = "Rainwater";
const NEW_QTY = "2";
const NEW_UNIT = "nr";
const NEW_RATE = "25";
const CONTRACT_BEFORE = "£180.00";
const CONTRACT_AFTER = "£230.00";
const GROUP_GW = "£100.00";
const GROUP_ROOFING = "£80.00";
const GROUP_RAIN_AFTER = "£50.00";

const scope = {
    pricing: "REAL_EstimateClient/controller; two retained saved lines then new add draft",
    saveLine: "MOCK saveLine onto existing estimateId; refuse then ack append from submitted args only",
    updateDelete: "REFUSED_BY_FIXTURE",
    emptyFirstLine: "NOT_THIS_LEG (see unseeded-journey)",
    editRemove: "NOT_THIS_LEG (see existing-price-native)",
    authDatabaseHosted: "NOT_RUN",
};

type Snapshot = Pick<
    LocalExistingEstimateAddFixture,
    "estimates" | "priceSaveAttempts" | "priceSaveAcknowledgements" | "unexpectedWrites"
>;

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => {
    const f = window.__existingEstimateAddLocal;
    return {
        estimates: structuredClone(f.estimates),
        priceSaveAttempts: f.priceSaveAttempts,
        priceSaveAcknowledgements: f.priceSaveAcknowledgements,
        unexpectedWrites: f.unexpectedWrites,
    };
});

const fillNewLineDraft = async (page: Page) => {
    await page.getByRole("button", { name: "Add a price line", exact: true }).click();
    const showQty = page.getByRole("button", { name: "Show quantities and rates", exact: true });
    if (await showQty.isVisible()) await showQty.click();
    const qtyMode = page.getByRole("button", { name: "Quantity and rate", exact: true });
    if (await qtyMode.isVisible()) await qtyMode.click();
    await page.getByLabel("New work description").fill(NEW_DESC);
    await page.locator("[data-new-price-activity] summary").click();
    await page.getByLabel("Activity for this new line").fill(NEW_ACTIVITY);
    await page.getByLabel("New priced quantity").fill(NEW_QTY);
    await page.getByLabel("New priced unit").selectOption(NEW_UNIT);
    await page.getByLabel("New unit rate in pounds").fill(NEW_RATE);
};

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local add to existing estimate fixture</title></head><body><p>LOCAL FIXTURE: new line saveLine MOCK onto an estimate that already has saved lines. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await snapshot(page), requests, pageErrors }), contentType: "application/json" });
});

test("refused then acknowledged saveLine appends a third line; retained lines and totals use actual maths", async ({ page }) => {
    await page.evaluate(() => {
        window.__existingEstimateAddLocal.script = { saveLine: ["refuse", "ack"] };
    });

    await expect(page.locator(`[data-price-line="${RETAINED_A}"]`)).toBeVisible();
    await expect(page.locator(`[data-price-line="${RETAINED_B}"]`)).toBeVisible();
    await expect(page.locator("[data-empty-estimate]")).toHaveCount(0);
    await page.getByRole("button", { name: "Show activity breakdown", exact: true }).click();
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_BEFORE);
    await expect(page.locator('[data-activity-subtotal="Groundworks"]')).toContainText(GROUP_GW);
    await expect(page.locator('[data-activity-subtotal="Roofing"]')).toContainText(GROUP_ROOFING);
    const before = await snapshot(page);
    expect(before.estimates[0].estimate_lines).toHaveLength(2);

    await fillNewLineDraft(page);
    await page.getByRole("button", { name: "Save line", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("price save not acknowledged");
    await expect(page.locator("[data-new-price-line]")).toBeVisible();
    await expect(page.locator(`[data-price-line="${RETAINED_A}"]`)).toBeVisible();
    await expect(page.locator(`[data-price-line="${RETAINED_B}"]`)).toBeVisible();
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_BEFORE);

    await expect(page.getByLabel("New work description")).toHaveValue(NEW_DESC);
    await expect(page.getByLabel("New priced quantity")).toHaveValue(NEW_QTY);
    await expect(page.getByLabel("New priced unit")).toHaveValue(NEW_UNIT);
    await expect(page.getByLabel("New unit rate in pounds")).toHaveValue(NEW_RATE);
    await expect(page.getByLabel("Activity for this new line")).toHaveValue(NEW_ACTIVITY);
    const refused = await snapshot(page);
    expect(refused.priceSaveAttempts).toHaveLength(1);
    expect(refused.priceSaveAcknowledgements).toBe(0);
    expect(refused.estimates).toEqual(before.estimates);
    expect(refused.priceSaveAttempts[0]).toMatchObject({
        projectId: "local-existing-estimate-add-job",
        estimateId: ESTIMATE,
        line: { description: NEW_DESC, quantity: 2, unit: NEW_UNIT, unit_rate: 25 },
        activity: NEW_ACTIVITY,
    });

    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator("[data-new-price-line]")).toHaveCount(0);
    await expect(page.locator("[data-price-line]")).toHaveCount(3);
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER);
    await expect(page.locator('[data-activity-subtotal="Rainwater"]')).toContainText(GROUP_RAIN_AFTER);
    await expect(page.locator('[data-activity-subtotal="Groundworks"]')).toContainText(GROUP_GW);
    await expect(page.locator('[data-activity-subtotal="Roofing"]')).toContainText(GROUP_ROOFING);

    const finished = await snapshot(page);
    expect(finished.priceSaveAttempts).toHaveLength(2);
    expect(finished.priceSaveAcknowledgements).toBe(1);
    expect(finished.estimates[0].estimate_lines).toHaveLength(3);
    const retained = finished.estimates[0].estimate_lines.filter(l => l.id === RETAINED_A || l.id === RETAINED_B);
    expect(retained).toHaveLength(2);
    expect(retained).toEqual(before.estimates[0].estimate_lines);
    const added = finished.estimates[0].estimate_lines.find(l => l.description === NEW_DESC);
    expect(added).toMatchObject({
        quantity: 2,
        unit: NEW_UNIT,
        unit_rate: 25,
        line_total: 50,
        trade_section: NEW_ACTIVITY,
    });
    expect(finished.unexpectedWrites).toEqual([]);

    await page.screenshot({ path: path.join(output, "existing-estimate-add-acknowledged.png"), fullPage: true });
});
