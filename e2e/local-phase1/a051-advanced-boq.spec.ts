import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { A051AdvancedBoqFixture } from "./a051-advanced-boq-entry";

// A051 0310 native boundary: the ACTUAL client-BoQ estimate mounted in the
// REAL EstimateClient and opened into the lazy Advanced estimating workspace.
// The 3c212ba case proved the simple-workspace boundary without mounting
// Advanced; the 08e activity fixture mounted Advanced only for an ordinary
// estimate. This closes ONLY the missing Advanced client-BoQ boundary:
// unsupported activity-assignment controls are absent by the component's own
// gates, the exact BoQ references/descriptions/sections/quantities/rates/
// totals and groups are preserved, and nothing writes, imports, saves or
// leaves the page. Nothing is hidden by fixture markup; no gate is bypassed.
// Build with `build-brief-price.mjs <out> a051-advanced-boq`.
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    estimateClient: "REAL_COMPONENT",
    advancedEstimate: "REAL_COMPONENT_LAZY_MOUNTED",
    clientBoQRows: "SYNTHETIC_DATA_REAL_RENDERING",
    activityAssignmentControls: "ABSENT_BY_COMPONENT_GATES",
    serverActions: "MOCK_RECORD_ONLY_NEVER_CALLED",
    priceWrites: "MOCK_REFUSAL_ONLY_NEVER_CALLED",
    boqImport: "EXCLUDED_BY_COMPILER_CAPABILITY_OFF",
    nextLink: "MOCKED_FIXTURE",
    theme: "MOCKED_FIXTURE",
    sessionStorage: "EXPLICIT_MEMORY_FIXTURE",
    auth: "NOT_RUN", database: "NOT_RUN", backend: "NOT_RUN", provider: "NOT_RUN", hostedJourney: "NOT_RUN",
};

type Snapshot = Pick<A051AdvancedBoqFixture, "estimates" | "priceWrites"> & { actionCalls: { name: string; args: unknown[] }[] };
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => ({
    estimates: structuredClone(window.__a051AdvancedBoqLocal.estimates),
    priceWrites: window.__a051AdvancedBoqLocal.priceWrites,
    actionCalls: window.__a051AdvancedBoqActions.actionCalls,
}));
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const row = (page: Page, section: string, ref: string) =>
    group(page, section).locator("div.grid", { hasText: ref });

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local Advanced client-BoQ boundary fixture</title></head><body><p>LOCAL FIXTURE: the actual client-BoQ estimate rendered inside the actual Advanced estimating workspace. No edit, import, save, account, server or network.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await snapshot(page), requests, pageErrors }), contentType: "application/json" });
});

test("actual Advanced client-BoQ workspace preserves exact references, descriptions, sections, quantities, rates, totals and groups with no activity-assignment controls and zero writes", async ({ page }) => {
    const before = await snapshot(page);
    await page.locator("button[aria-controls='advanced-estimating']").click();

    // Advanced mounts for the client-BoQ estimate and names it, filename and all.
    await expect(page.locator("#advanced-estimating")).toBeVisible();
    await expect(page.getByText("Client BoQ", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("client-boq.pdf", { exact: true })).toBeVisible();
    await expect(page.locator("[data-contract-sum]")).toHaveText("£2,290.00");

    // Sections keep their exact BoQ groups and totals.
    await expect(group(page, "Roofing").locator("h3")).toHaveText("Roofing");
    await expect(group(page, "Roofing").locator("span").first()).toHaveText("£2,030.00");
    await expect(group(page, "Rainwater goods").locator("h3")).toHaveText("Rainwater goods");
    await expect(group(page, "Rainwater goods").locator("span").first()).toHaveText("£260.00");

    // Each BoQ line keeps its reference, description, section, quantity, unit,
    // rate and exact derived total.
    const rows = [
        { section: "Roofing", ref: "A1", description: "Strip existing roof coverings", quantity: "40", unit: "m2", rate: "18.5", total: "£740.00" },
        { section: "Roofing", ref: "A2", description: "Supply and lay new felt roofing system", quantity: "40", unit: "m2", rate: "32.25", total: "£1,290.00" },
        { section: "Rainwater goods", ref: "B1", description: "Replace guttering and downpipes", quantity: "10", unit: "m", rate: "26", total: "£260.00" },
    ] as const;
    for (const { section, ref, description, quantity, unit, rate, total } of rows) {
        const line = row(page, section, ref);
        await expect(line.getByText(ref, { exact: true })).toBeVisible();
        await expect(line.getByLabel("Description", { exact: true })).toHaveValue(description);
        await expect(line.getByLabel("Quantity", { exact: true })).toHaveValue(quantity);
        await expect(line.getByLabel("Unit", { exact: true })).toHaveValue(unit);
        await expect(line.getByLabel("Rate (£)", { exact: true })).toHaveValue(rate);
        await expect(line.getByText(total, { exact: true })).toBeVisible();
    }

    // Unsupported activity-assignment controls are absent by the component's
    // own gates — nothing is hidden by fixture markup, nothing to bypass. The
    // ordinary-estimate resources toggle and line-type control are equally absent.
    await expect(page.locator("[data-line-activity], [data-line-activity-editor]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Activity:/ })).toHaveCount(0);
    await expect(page.locator("[data-resource-disclosure]")).toHaveCount(0);

    // Boundary held: no action write, no price write, the persisted BoQ store is
    // untouched, and no request left the page.
    const after = await snapshot(page);
    expect(after.actionCalls).toEqual([]);
    expect(after.priceWrites).toEqual([]);
    expect(after.estimates).toEqual(before.estimates);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);

    await page.screenshot({ path: path.join(output, "a051-advanced-boq-boundary.png"), fullPage: true });
});
