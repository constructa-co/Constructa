import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { BoqBoundaryFixture } from "./boq-activity-boundary-entry";

// A051 2215 native boundary: the ACTUAL EstimateClient mounted with an actual
// client-BoQ estimate. The server/unit gates for unsupported client-BoQ
// activity assignment already have coverage; this is the missing native
// rendered boundary only: activity edit controls are ABSENT by design, the
// BoQ structure/groups/prices are retained exactly, and an ordinary estimate
// stays separately editable. Nothing hidden is bypassed; price writes are
// explicit mock refusals.
const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];
const scope = {
    estimateClient: "REAL_COMPONENT",
    priceLineRow: "REAL_COMPONENT",
    priceWorkList: "REAL_COMPONENT_BOUNDED_HELP",
    savedLineReuse: "REAL_COMPONENT",
    priceActivityView: "REAL_COMPONENT",
    clientBoQRows: "SYNTHETIC_DATA_REAL_RENDERING",
    priceWrites: "MOCK_REFUSAL_ONLY",
    serverActions: "EXCLUDED",
    advancedEstimating: "EXCLUDED_NOT_OPENED",
    nextLink: "MOCKED_FIXTURE",
    theme: "MOCKED_FIXTURE",
    sessionStorage: "EXPLICIT_MEMORY_FIXTURE",
    auth: "NOT_RUN", database: "NOT_RUN", backend: "NOT_RUN", provider: "NOT_RUN", hostedJourney: "NOT_RUN",
};

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local client-BoQ boundary fixture</title></head><body><p>LOCAL FIXTURE: client-BoQ rows are synthetic data rendered by the actual EstimateClient. Price writes are refused. No account, server or network.</p><div id="app"></div></body></html>');
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("heading", { name: "Price lines", exact: true })).toBeVisible();
});

test("actual client-BoQ rows keep structure, groups and prices with no activity edit controls, while the ordinary estimate stays editable", async ({ page }, info) => {
    // The active viewed estimate is the client BoQ; the gate help is surfaced
    // natively, not bypassed.
    await expect(page.locator("[data-current-estimate]")).toContainText("Client BoQ v1");
    await expect(page.getByText("Use the existing client BoQ workflow for this estimate.").first()).toBeVisible();

    // Rows render with their BoQ group, derived quantity x rate, exact price
    // and the Client BoQ marker — and point at Advanced estimating.
    const rows = [
        ["boq-line-1", "Strip existing roof coverings", "Roofing", "40 m2 × £18.50", "£740.00"],
        ["boq-line-2", "Supply and lay new felt roofing system", "Roofing", "40 m2 × £32.25", "£1,290.00"],
        ["boq-line-3", "Replace guttering and downpipes", "Rainwater goods", "10 m × £26.00", "£260.00"],
    ] as const;
    for (const [id, description, group, derivation, price] of rows) {
        const row = page.locator(`[data-price-line="${id}"]`).first();
        await expect(row).toContainText(description);
        await expect(row).toContainText(group);
        await expect(row).toContainText(derivation);
        await expect(row).toContainText(price);
        await expect(row).toContainText("Client BoQ");
        await expect(row).toContainText("Change this line in Advanced estimating.");
        // No simple-workspace edit or removal on a client-BoQ row.
        await expect(row.getByRole("button", { name: `Change ${description}` })).toHaveCount(0);
        await expect(row.getByRole("button", { name: `Remove ${description}` })).toHaveCount(0);
    }
    // Activity assignment controls are absent by design for the whole
    // client-BoQ estimate — nothing hidden to bypass.
    await expect(page.locator("[data-line-activity], [data-line-activity-editor]")).toHaveCount(0);

    // The retained BoQ structure groups by section with exact subtotals.
    await page.getByRole("button", { name: "Show activity breakdown", exact: true }).click();
    await expect(page.locator('[data-activity-heading="Roofing"]')).toBeVisible();
    await expect(page.locator('[data-activity-heading="Rainwater goods"]')).toBeVisible();
    await expect(page.locator('[data-activity-subtotal="Roofing"]')).toContainText("£2,030.00");
    await expect(page.locator('[data-activity-subtotal="Rainwater goods"]')).toContainText("£260.00");

    // The ordinary estimate remains separately editable in the same workspace.
    await page.locator("[data-estimate-versions] summary").click();
    await page.locator("#estimate-version").selectOption("est-simple");
    const ordinary = page.locator('[data-price-line="simple-line-1"]').first();
    await expect(ordinary).toContainText("General builder attendance");
    await expect(ordinary).not.toContainText("Client BoQ");
    await ordinary.getByRole("button", { name: "Change General builder attendance" }).click();
    await expect(page.locator('[data-price-line="simple-line-1"]:has(form)')).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator('[data-price-line="simple-line-1"]:has(form)')).toHaveCount(0);

    // Boundary held: no price write was attempted, no request left the page.
    const state: Pick<BoqBoundaryFixture, "priceWrites"> = await page.evaluate(() => ({ priceWrites: window.__boqBoundaryLocal.priceWrites }));
    expect(state.priceWrites).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});
