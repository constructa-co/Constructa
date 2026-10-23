import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalCompanyFixture } from "./company-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];
const scope = {
    companySetup: "REAL_COMPONENT_MOCK_SAVE",
    readiness: "REAL_COMPONENT_MOCK_NEXT_ROUTING",
    auth: "NOT_RUN", database: "NOT_RUN", email: "NOT_RUN",
    firstJob: "NOT_RUN", brief: "NOT_RUN", estimating: "NOT_RUN", programme: "NOT_RUN",
    termsAndPdf: "NOT_RUN", clientResponse: "NOT_RUN", won: "NOT_RUN",
};

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local company fixture - simulated saves</title></head><body><p>LOCAL FIXTURE: saves and routing are simulated. No account or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test("company setup reaches actual readiness without an account, server or network", async ({ page }, info) => {
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Tell us what kind of work");
    expect(await page.evaluate(() => window.__phase1Local.calls)).toEqual([]);
    await page.getByLabel("What kind of work do you do?", { exact: true }).fill("Roof repairs and small extensions");
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByLabel("Business or trading name")).toBeVisible();
    await page.getByLabel("Business or trading name").fill("Example Local Builder");
    await page.getByLabel("Your name", { exact: false }).fill("Test Operator");
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Example Local Builder", exact: true })).toBeVisible();
    const state: Pick<LocalCompanyFixture, "profile" | "calls" | "navigation"> = await page.evaluate(() => ({
        profile: window.__phase1Local.profile, calls: window.__phase1Local.calls, navigation: window.__phase1Local.navigation,
    }));
    expect(state.calls).toHaveLength(2);
    expect(state.profile).toMatchObject({ business_type: "Roof repairs and small extensions", company_name: "Example Local Builder", full_name: "Test Operator" });
    expect(state.navigation).toEqual(["refresh", "/dashboard/settings/profile/readiness"]);
    await expect(page.locator('[data-welcome-step="proposal"]')).toHaveAttribute("href", "/dashboard/projects/new");
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "company-ready.png"), fullPage: true });
});

test("a refused simulated company save retains the answer before deliberate retry", async ({ page }, info) => {
    await page.getByLabel("What kind of work do you do?", { exact: true }).fill("Custom local work");
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await page.getByLabel("Business or trading name").fill("  Exact unsaved company  ");
    await page.evaluate(() => { window.__phase1Local.nextSave = "refused"; });
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Local fixture: save not acknowledged.");
    await expect(page.getByLabel("Business or trading name")).toHaveValue("  Exact unsaved company  ");
    expect(await page.evaluate(() => window.__phase1Local.profile.company_name)).toBeUndefined();
    expect(await page.evaluate(() => window.__phase1Local.navigation)).toEqual([]);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Exact unsaved company", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__phase1Local.calls.length)).toBe(3);
    expect(requests).toEqual([]); expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});
