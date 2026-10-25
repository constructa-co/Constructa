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


const INTRO =
    "Set out what the client needs, the work you will carry out and the site details that shape your price. Save your draft as you go, then build the price when the brief is ready.";
const PRESENTATION_SCOPE = {
    ...scope,
    stylesheet: "brief-chrome.module.css via local-phase1 compiler bridge only; Tailwind utilities/preflight NOT compiled",
    servedApp: "NOT_CLAIMED",
};

async function briefPresentationGeometry(page: Page) {
    const title = page.getByRole("heading", { level: 1, name: "Job brief", exact: true });
    const titleStyle = await title.evaluate((element) => {
        const style = getComputedStyle(element);
        return { fontSize: style.fontSize, fontFamily: style.fontFamily };
    });
    const steps = page.locator('[aria-label="Brief steps"] button');
    const count = await steps.count();
    expect(count).toBe(3);
    const boxes: Array<{ x: number; y: number; width: number; height: number; textAlign: string }> = [];
    for (let index = 0; index < count; index += 1) {
        const button = steps.nth(index);
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        const textAlign = await button.evaluate((element) => getComputedStyle(element).textAlign);
        boxes.push({ ...box!, textAlign });
        expect(box!.height).toBeGreaterThanOrEqual(56);
        expect(textAlign).toBe("left");
        const labelRects = await button.evaluate(element => Array.from(element.querySelectorAll("span")).flatMap(span => {
            const range = document.createRange(); range.selectNodeContents(span);
            return Array.from(range.getClientRects()).map(r => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom }));
        }));
        expect(labelRects.length).toBeGreaterThan(0);
        for (const rect of labelRects) {
            expect(rect.x).toBeGreaterThanOrEqual(box!.x - 1);
            expect(rect.y).toBeGreaterThanOrEqual(box!.y - 1);
            expect(rect.right).toBeLessThanOrEqual(box!.x + box!.width + 1);
            expect(rect.bottom).toBeLessThanOrEqual(box!.y + box!.height + 1);
        }
        await expect(button).toBeVisible();
    }
    for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
            expect(overlap).toBe(false);
        }
    }
    return { titleStyle, stepBoxes: boxes };
}

async function exerciseBriefStages(page: Page) {
    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "A business", exact: true }).click();
    await expect(page.getByRole("button", { name: "A business", exact: true })).toHaveAttribute("aria-pressed", "true");

    const stages = ["The job", "Activities", "Site and assumptions"] as const;
    for (const label of stages) {
        await page.getByRole("button", { name: new RegExp(label) }).click();
        await expect(page.locator('[aria-label="Brief steps"] [aria-current="step"]')).toHaveCount(1);
        await expect(page.getByRole("button", { name: new RegExp(label) })).toHaveAttribute("aria-current", "step");
    }

    await page.getByRole("button", { name: /The job/ }).click();
    await expect(page.getByLabel("Describe the job in your own words")).toHaveValue(WORK);
    await expect(page.getByRole("button", { name: "A business", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /Site and assumptions/ }).click();
    await expect(page.locator("[data-brief-site-context]")).toBeVisible();
    await expect(page.getByText("Carried from this job. No need to enter these details again.")).toBeVisible();
    const access = page.getByLabel("Access, restrictions and assumptions");
    await access.fill("Rear lane access only on weekdays.");
    await expect(access).toHaveValue("Rear lane access only on weekdays.");
    await expect(access).toBeEditable();

    const state = await snapshot(page);
    expect(state.saves).toEqual([]);
    expect(state.navigation).toEqual([]);
    expect(state.priceWrites).toEqual([]);
}

test("refined brief presentation on desktop", async ({ page }, info) => {
    test.info().annotations.push({ type: "viewport", description: "1280x900 default config" });
    await expect(page.getByText("Work Winning / Job brief", { exact: true })).toBeVisible();
    await expect(page.getByText(INTRO, { exact: true })).toBeVisible();
    const geometry = await briefPresentationGeometry(page);
    expect(parseFloat(geometry.titleStyle.fontSize)).toBeCloseTo(44, 0);
    expect(geometry.titleStyle.fontFamily.toLowerCase()).toContain("avenir");
    await exerciseBriefStages(page);
    expect(requests).toEqual([]); expect(pageErrors).toEqual([]);
    await info.attach("presentation-geometry-desktop", {
        body: JSON.stringify({ ...geometry, viewport: "1280x900" }),
        contentType: "application/json",
    });
    await info.attach("scope", { body: JSON.stringify(PRESENTATION_SCOPE), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, "brief-presentation-desktop.png"), fullPage: true });
});

test.describe("phone presentation", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("refined brief presentation on 390px phone", async ({ page }, info) => {
        await expect(page.getByText("Work Winning / Job brief", { exact: true })).toBeVisible();
        await expect(page.getByText(INTRO, { exact: true })).toBeVisible();
        const geometry = await briefPresentationGeometry(page);
        expect(parseFloat(geometry.titleStyle.fontSize)).toBeCloseTo(32, 0);
        expect(geometry.titleStyle.fontFamily.toLowerCase()).toContain("avenir");
        await exerciseBriefStages(page);
        expect(requests).toEqual([]); expect(pageErrors).toEqual([]);
        await info.attach("presentation-geometry-phone", {
            body: JSON.stringify({ ...geometry, viewport: "390x844" }),
            contentType: "application/json",
        });
        await info.attach("scope", { body: JSON.stringify(PRESENTATION_SCOPE), contentType: "application/json" });
        await page.screenshot({ path: path.join(output, "brief-presentation-phone.png"), fullPage: true });
    });
});

const MULTILINE_CONTRACTOR_ACTIVITY = "Strip existing coverings;\nRe-point chimney (north).\nRe-felt & batten slope.";
const SECOND_CONTRACTOR_ACTIVITY = "Install new gutters (10m run; both sides).";
const UNADDED_MULTILINE_ENTRY = "Cart away arisings;\nstill waiting to be added.";

test("multiline contractor activities: add, clear unadded text, legacy picker closed, ordered activities on build", async ({ page }, info) => {
    await page.getByLabel("Describe the job in your own words").fill(WORK);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    const legacyPicker = page.locator("details").filter({ hasText: "Choose from existing trade names" });
    await expect(legacyPicker).toHaveCount(1);
    await expect(legacyPicker).toHaveJSProperty("open", false);
    await expect(page.getByLabel("Find a trade")).toBeHidden();

    const entry = page.getByLabel("Activity to add");
    await entry.fill(MULTILINE_CONTRACTOR_ACTIVITY);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await expect(entry).toHaveValue("");
    await expect(page.getByRole("button", { name: `Remove ${MULTILINE_CONTRACTOR_ACTIVITY}`, exact: true })).toBeVisible();

    await entry.fill(SECOND_CONTRACTOR_ACTIVITY);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${SECOND_CONTRACTOR_ACTIVITY}`, exact: true })).toBeVisible();

    await entry.fill(UNADDED_MULTILINE_ENTRY);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "An activity entry is still waiting to be added" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "An activity entry is still waiting to be added" })).toContainText("Cart away arisings;");

    await page.getByRole("button", { name: /Activities/ }).click();
    await expect(entry).toHaveValue(UNADDED_MULTILINE_ENTRY);
    await page.getByRole("button", { name: "Clear entry", exact: true }).click();
    await expect(entry).toHaveValue("");
    await expect(page.getByRole("button", { name: "Add activity", exact: true })).toBeDisabled();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    expect((await snapshot(page)).saves).toEqual([]);
    expect((await snapshot(page)).navigation).toEqual([]);
    expect((await snapshot(page)).priceWrites).toEqual([]);
    await page.getByRole("button", { name: "Save and build the price", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();

    const saved = await snapshot(page);
    expect(saved.saves).toHaveLength(1);
    expect(saved.saves[0].projectId).toBe(JOB_ID);
    expect(saved.saves[0].payload.brief_scope).toBe(WORK);
    expect(saved.saves[0].payload.brief_trade_sections).toEqual([
        MULTILINE_CONTRACTOR_ACTIVITY,
        SECOND_CONTRACTOR_ACTIVITY,
    ]);
    expect(saved.saves[0].payload.brief_completed).toBe(true);
    expect(saved.navigation).toEqual([PRICING_PATH]);
    expect(saved.priceWrites).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);

    await info.attach("c28-a044-scope", {
        body: JSON.stringify({
            ...scope,
            note: "REAL BriefClient activity add/clear; multiline preserved; MOCK save on Build only",
            activities: saved.saves[0].payload.brief_trade_sections,
        }),
        contentType: "application/json",
    });
    await page.screenshot({ path: path.join(output, "brief-multiline-activities.png"), fullPage: true });
});

