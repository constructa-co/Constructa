import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalBuildUpFixture } from "./build-up-entry";

// A049: the optional detailed build-up inside the actual pricing page. Build with
// `build-brief-price.mjs <out> build-up` (A049-BUILD-UP-2000 compiler hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const LINE = "local-build-up-line";
const scope = {
    pricingParent: "REAL_COMPONENT EstimateClient (simple list, Advanced toggle, running total)",
    advanced: "REAL_COMPONENT AdvancedEstimate, loaded through a fixture lazy adapter for next/dynamic",
    buildUp: "REAL_COMPONENT BuildUpPanel resource drafts, component total, built-up rate and Apply gates",
    costsActions: "MOCK module: records calls; answers only from the spec's explicit acknowledgement/refusal script",
    advancedReferenceData: "SYNTHETIC empty cost library, rate build-ups and labour rates",
    simplePriceServer: "REFUSING, expected unused",
    authDatabaseResourceLibraryHosted: "NOT_RUN",
};

const calls = (page: Page): Promise<Pick<LocalBuildUpFixture, "actionCalls" | "simpleServerCalls">> =>
    page.evaluate(() => ({ actionCalls: window.__buildUpLocal.actionCalls, simpleServerCalls: window.__buildUpLocal.simpleServerCalls }));
const settle = (page: Page) => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", (route) => route.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local optional build-up - MOCK acknowledgements</title></head><body><p>LOCAL FIXTURE: resource and rate saves are MOCK acknowledgements or refusals. No account, server, database or resource library.</p><div id="app"></div></body></html>',
    );
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await calls(page), requests, pageErrors }), contentType: "application/json" });
});

async function openBuildUp(page: Page) {
    const contractSum = page.locator("[data-contract-sum]");
    // Simple pricing is the starting point and stays available.
    await expect(page.getByRole("region", { name: "Price lines", exact: true }).getByText("Lay block paving", { exact: true })).toBeVisible();
    await expect(contractSum).toHaveText("£500.00");
    await page.locator("button[aria-controls='advanced-estimating']").click();
    const disclosure = page.locator(`[data-resource-disclosure='${LINE}']`);
    await expect(disclosure).toBeVisible();
    await disclosure.click();
    await expect(page.getByRole("heading", { name: "Resource build-up", exact: true })).toBeVisible();
    return contractSum;
}

async function draftResource(page: Page, type: string, values: { name: string; quantity: string; unit: string; rate: string; hours: string }) {
    await page.getByRole("button", { name: `+ ${type}`, exact: true }).click();
    const draft = page.getByRole("region", { name: "Unsaved resource draft" });
    await expect(draft).toBeVisible();
    await page.getByLabel("New resource name", { exact: true }).fill(values.name);
    await page.getByLabel("New resource total quantity", { exact: true }).fill(values.quantity);
    await page.getByLabel("New resource unit", { exact: true }).selectOption(values.unit);
    await page.getByLabel("New resource rate", { exact: true }).fill(values.rate);
    await page.getByLabel("New resource hours", { exact: true }).fill(values.hours);
    return draft;
}

test("two resources entered in the actual build-up derive the rate; a refused Apply keeps the price until a deliberate retry is acknowledged", async ({ page }) => {
    await page.evaluate(() => {
        window.__buildUpLocal.script = {
            addComponent: ["ack", "ack"],
            applyRate: [{ refuse: true }, { ack: { unitRate: 75, quantity: 10, lineTotal: 750 } }],
        };
    });
    const contractSum = await openBuildUp(page);
    const panel = page.locator("div").filter({ has: page.getByRole("heading", { name: "Resource build-up", exact: true }) }).last();

    await draftResource(page, "labour", { name: "Paver labour", quantity: "16", unit: "hr", rate: "30", hours: "1" });
    await page.getByRole("button", { name: "Save new resource", exact: true }).click();
    await expect(page.getByText("Resource saves confirmed. The line price changes only when you Apply rate.")).toBeVisible();
    await draftResource(page, "material", { name: "Block pavers", quantity: "10", unit: "m²", rate: "27", hours: "0" });
    await page.getByRole("button", { name: "Save new resource", exact: true }).click();
    await expect(page.getByRole("region", { name: "Unsaved resource draft" })).toHaveCount(0);

    // The panel's own maths: (16 x 30 + 10 x 27) / 10 m² = 75. The line price is unchanged until Apply.
    await expect(panel).toContainText("Components total: £750.00");
    await expect(panel).toContainText("Built-up rate: £75.00/unit");
    await expect(panel).toContainText("Current line rate: £50.00/m²");
    await expect(contractSum).toHaveText("£500.00");

    const apply = page.getByRole("button", { name: "Apply resource rate", exact: true });
    await expect(apply).toBeDisabled();
    await page.getByLabel("Confirm total resources for this priced quantity", { exact: true }).check();
    await expect(apply).toHaveText("Apply rate (£75.00/unit) →");
    await apply.click();
    await expect(page.getByText("Rate not confirmed.")).toBeVisible();
    await expect(apply).toHaveText("Retry Apply rate (£75.00/unit) →");
    await expect(panel).toContainText("Current line rate: £50.00/m²");
    await expect(page.getByText("Rate applied to the line price.")).toHaveCount(0);
    await expect(contractSum).toHaveText("£500.00");
    await settle(page);
    expect((await calls(page)).actionCalls.filter(call => call.name === "updateLineBuiltUpRateAction")).toHaveLength(1);

    await apply.click();
    await expect(page.getByText("Rate applied to the line price.")).toBeVisible();
    await expect(panel).toContainText("Current line rate: £75.00/m²");
    await expect(contractSum).toHaveText("£750.00");

    expect(await calls(page)).toEqual({
        actionCalls: [
            { name: "addComponentAction", args: [LINE, { component_type: "labour", description: "Paver labour", quantity: 16, unit: "hr", unit_rate: 30, manhours_per_unit: 1, sort_order: 0 }] },
            { name: "addComponentAction", args: [LINE, { component_type: "material", description: "Block pavers", quantity: 10, unit: "m²", unit_rate: 27, manhours_per_unit: 0, sort_order: 1 }] },
            { name: "updateLineBuiltUpRateAction", args: [LINE, 75, 10] },
            { name: "updateLineBuiltUpRateAction", args: [LINE, 75, 10] },
        ],
        simpleServerCalls: [],
    });

    // Close the optional tools: simple pricing is back with the acknowledged line price.
    await page.locator("button[aria-controls='advanced-estimating']").click();
    await expect(page.locator("#advanced-estimating")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Price lines", exact: true }).getByText("Lay block paving", { exact: true })).toBeVisible();
    await expect(contractSum).toHaveText("£750.00");
    await page.screenshot({ path: path.join(output, "build-up-applied.png"), fullPage: true });
});

test("a refused resource save keeps the exact draft and price, blocks Apply and is not retried automatically", async ({ page }) => {
    await page.evaluate(() => { window.__buildUpLocal.script = { addComponent: ["refuse"], applyRate: [] }; });
    const contractSum = await openBuildUp(page);
    await draftResource(page, "labour", { name: "Paver labour", quantity: "16", unit: "hr", rate: "30", hours: "1" });
    await page.getByRole("button", { name: "Save new resource", exact: true }).click();

    await expect(page.getByText("Resource save not confirmed.").first()).toBeVisible();
    await expect(page.getByText("Resource saves confirmed.", { exact: false })).toHaveCount(0);
    await expect(page.getByLabel("New resource name", { exact: true })).toHaveValue("Paver labour");
    await expect(page.getByLabel("New resource total quantity", { exact: true })).toHaveValue("16");
    await expect(page.getByLabel("New resource rate", { exact: true })).toHaveValue("30");
    await expect(page.getByRole("button", { name: "Save new resource", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Apply resource rate", exact: true })).toHaveCount(0);
    await expect(page.getByText("Components total: £0.00")).toBeVisible();
    await expect(page.getByText("Current line rate: £50.00/m²")).toBeVisible();
    await expect(contractSum).toHaveText("£500.00");
    await settle(page);
    expect(await calls(page)).toEqual({
        actionCalls: [{ name: "addComponentAction", args: [LINE, { component_type: "labour", description: "Paver labour", quantity: 16, unit: "hr", unit_rate: 30, manhours_per_unit: 1, sort_order: 0 }] }],
        simpleServerCalls: [],
    });
    await page.screenshot({ path: path.join(output, "build-up-resource-refused.png"), fullPage: true });
});
