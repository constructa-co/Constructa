import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalBriefPriceFixture } from "./brief-price-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    brief: "REAL_COMPONENT over MOCK_SAVE",
    estimate: "REAL_COMPONENT over MOCK_ROUTING; price persistence REFUSED_BY_FIXTURE",
    sessionStorage: "EPHEMERAL_IN_MEMORY_STAND_IN",
    serverActions: "NOT_RUN",
    auth: "NOT_RUN",
    database: "NOT_RUN",
    firstJob: "NOT_RUN",
    programme: "NOT_RUN",
    termsAndPdf: "NOT_RUN",
    clientResponse: "NOT_RUN",
    won: "NOT_RUN",
    advancedEstimating: "NOT_RUN",
    videoWalkthrough: "NOT_RUN",
};

const JOB_ID = "local-brief-price-job";
const PRICING_PATH = `/dashboard/projects/costs?projectId=${JOB_ID}`;
const WORK = "Strip and renew the rear roof slope, renew the gutters and repoint the chimney stack.";
const ACTIVITIES = ["Strip existing coverings and battens", "Re-felt, batten and re-tile the slope"];
const CUSTOM_ACTIVITY = "Scaffold loading bay for tile deliveries";
const PENDING_ACTIVITY = "Cart away all arisings from site";

interface FixtureSnapshot {
    saves: LocalBriefPriceFixture["saves"];
    navigation: string[];
    priceWrites: string[];
    potentialValue: number | null;
}

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => ({
    saves: window.__briefPriceLocal.saves,
    navigation: window.__briefPriceLocal.navigation,
    priceWrites: window.__briefPriceLocal.priceWrites,
    potentialValue: window.__briefPriceLocal.project.potential_value,
}));

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local brief to price fixture - simulated saves</title></head><body><p>LOCAL FIXTURE: brief saves, routing and pricing persistence are simulated. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test("a saved brief reaches same-job pricing, and activity typing never writes a price", async ({ page }, info) => {
    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const entry = page.getByLabel("Activity to add");
    await entry.fill(ACTIVITIES[0]);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await entry.fill(ACTIVITIES[1]);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${ACTIVITIES[0]}`, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove ${ACTIVITIES[1]}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();
    await expect(page.getByText("Offline roof repair for Synthetic client", { exact: true })).toBeVisible();

    const saved = await snapshot(page);
    expect(saved.saves).toHaveLength(1);
    expect(saved.saves[0].projectId).toBe(JOB_ID);
    expect(saved.saves[0].payload.brief_completed).toBe(true);
    expect(saved.saves[0].payload.brief_scope).toBe(WORK);
    expect(saved.saves[0].payload.brief_trade_sections).toEqual(ACTIVITIES);
    expect("potential_value" in saved.saves[0].payload).toBe(false);
    expect(saved.potentialValue).toBe(1234.5678);
    expect(saved.navigation).toEqual([PRICING_PATH]);
    await expect(page.locator("[aria-labelledby='pricing-context-title']")).toContainText(WORK);

    await page.getByRole("button", { name: "Add the first price line", exact: true }).click();
    expect((await snapshot(page)).priceWrites).toEqual([]);

    await page.locator("[data-new-price-activity] summary").click();
    const options = await page.locator("#new-line-activity-names option")
        .evaluateAll(opts => opts.map(option => option.getAttribute("value")));
    expect(options).toEqual(ACTIVITIES);

    const activityInput = page.getByLabel("Activity for this new line");
    await activityInput.fill(ACTIVITIES[0]);
    await expect(activityInput).toHaveValue(ACTIVITIES[0]);
    await activityInput.fill(CUSTOM_ACTIVITY);
    await expect(activityInput).toHaveValue(CUSTOM_ACTIVITY);

    const afterTyping = await snapshot(page);
    expect(afterTyping.priceWrites).toEqual([]);
    expect(await page.locator("[data-price-line]").count()).toBe(0);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "brief-price.png"), fullPage: true });
});

test("a refused brief save keeps the draft until the deliberate retry reaches pricing", async ({ page }, info) => {
    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Activity to add").fill(ACTIVITIES[0]);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.evaluate(() => { window.__briefPriceLocal.nextSave = "refused"; });
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();

    await expect(page.getByRole("alert")).toContainText("Local fixture: Brief save not acknowledged.");
    const refused = await snapshot(page);
    expect(refused.saves).toHaveLength(1);
    expect(refused.navigation).toEqual([]);
    expect(refused.potentialValue).toBe(1234.5678);

    await page.getByRole("button", { name: /The job/ }).click();
    await expect(page.getByLabel("Describe the job in your own words")).toHaveValue(WORK);
    await page.getByRole("button", { name: /Activities/ }).click();
    await expect(page.getByRole("button", { name: `Remove ${ACTIVITIES[0]}`, exact: true })).toBeVisible();

    // The existing save-failure control re-saves only; pricing still needs the deliberate Build click.
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__briefPriceLocal.saves.length)).toBe(2);
    await page.getByRole("button", { name: /Site and assumptions/ }).click();
    await page.getByRole("button", { name: "Build the price", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();

    const retried = await snapshot(page);
    expect(retried.saves).toHaveLength(2);
    expect(retried.saves[1].projectId).toBe(JOB_ID);
    expect(retried.saves[1].payload.brief_completed).toBe(true);
    expect(retried.saves[1].payload.brief_scope).toBe(WORK);
    expect(retried.saves[1].payload.brief_trade_sections).toEqual([ACTIVITIES[0]]);
    expect(retried.potentialValue).toBe(1234.5678);
    expect(retried.navigation).toEqual([PRICING_PATH]);
    expect(retried.priceWrites).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});

test("an unadded activity entry blocks Build until it is deliberately added", async ({ page }, info) => {
    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Activity to add").fill(PENDING_ACTIVITY);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "An activity entry is still waiting to be added" })).toBeVisible();

    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Add the activity to your brief or clear the entry before saving. Your text is still here.");
    // The existing guard itself returns to the Activities stage with the exact text kept.
    await expect(page.getByLabel("Activity to add")).toHaveValue(PENDING_ACTIVITY);
    const blocked = await snapshot(page);
    expect(blocked.saves).toEqual([]);
    expect(blocked.navigation).toEqual([]);

    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await expect(page.getByLabel("Activity to add")).toHaveValue("");
    await expect(page.getByRole("button", { name: `Remove ${PENDING_ACTIVITY}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Site and assumptions/ }).click();
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();

    const built = await snapshot(page);
    expect(built.saves).toHaveLength(1);
    expect(built.saves[0].projectId).toBe(JOB_ID);
    expect(built.saves[0].payload.brief_completed).toBe(true);
    expect(built.saves[0].payload.brief_trade_sections).toEqual([PENDING_ACTIVITY]);
    expect(built.navigation).toEqual([PRICING_PATH]);
    expect(built.priceWrites).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify(scope), contentType: "application/json" });
});

