import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalBriefNavigationFixture } from "./brief-navigation-entry";

// A004 1845 boundary: the ACTUAL BriefClient dirty guard (brief-client.tsx
// lines 128-155: cancelable BEFORE_PROJECT_NAVIGATION + anchor + beforeunload)
// wired to the actual SidebarNav / ProjectNavBar / requestProjectNavigation.
// These cases are IN ADDITION to the original three scaffold cases in
// navigation.spec.ts, which are preserved untouched. Saves are explicit mock
// acknowledgements/refusals only; no Auth/DB/hosted/Send/Won/acceptance.
const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];
const scope = {
    briefClient: "REAL_COMPONENT_REAL_DIRTY_GUARD",
    sidebarNav: "REAL_COMPONENT",
    projectNavBar: "REAL_COMPONENT",
    phoneMenuFocus: "REAL_COMPONENT",
    requestProjectNavigation: "REAL_EVENT_CONTRACT",
    save: "MOCK_ACKNOWLEDGE_OR_REFUSE",
    nextLinkRouterPathQuery: "MOCKED_FIXTURE",
    theme: "MOCKED_FIXTURE",
    storage: "EXPLICIT_MEMORY_FIXTURE",
    auth: "NOT_RUN", database: "NOT_RUN", backend: "NOT_RUN", provider: "NOT_RUN", hostedJourney: "NOT_RUN",
    aiTransport: "EXCLUDED", serverActions: "EXCLUDED",
};

type FixtureState = Pick<LocalBriefNavigationFixture, "navigation" | "currentProjectId" | "saves" | "nextSave"> & {
    storedProjectId: string | null;
};

async function fixtureState(page: import("@playwright/test").Page): Promise<FixtureState> {
    return page.evaluate(() => {
        const fixture = window.__briefNavigationLocal;
        return {
            navigation: fixture.navigation,
            currentProjectId: fixture.currentProjectId,
            saves: fixture.saves,
            nextSave: fixture.nextSave,
            storedProjectId: localStorage.getItem("constructa_selected_project_id"),
        };
    });
}

const saveStatus = (page: import("@playwright/test").Page) => page.locator("[data-save-status]");

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local brief navigation fixture - synthetic jobs</title></head><body><p>LOCAL FIXTURE: saves are simulated acknowledgements/refusals; Next routing, theme and storage are simulated. No account, server or network.</p><div id="app"></div></body></html>');
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("heading", { name: "Job brief", exact: true })).toBeVisible();
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "empty");
});

test("actual unsaved Brief draft: Cancel on a project switch retains the exact job and draft, with no save and no navigation", async ({ page }, info) => {
    const crumb = page.getByRole("navigation", { name: "Job context" });
    await page.locator("#brief-work").fill("Strip the old roof and refelt the garage roof.");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "unsaved");
    await expect(saveStatus(page)).toHaveText("Unsaved");

    await page.getByRole("button", { name: "Synthetic job one", exact: true }).click();
    // Playwright auto-dismisses the real window.confirm: Cancel/stay.
    await page.getByRole("button", { name: /Other synthetic job/ }).click();

    const state = await fixtureState(page);
    expect(state.navigation).toEqual([]);
    expect(state.saves).toEqual([]);
    expect(state.currentProjectId).toBe("job-1");
    expect(state.storedProjectId).toBe("job-1");
    await expect(page.locator("#brief-work")).toHaveValue("Strip the old roof and refelt the garage roof.");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "unsaved");
    await expect(page.getByRole("button", { name: "Synthetic job one", exact: true })).toBeVisible();
    await expect(crumb).toContainText("Synthetic job one");
    await expect(crumb.locator('[aria-current="page"]')).toHaveText("Job brief");
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});

test("actual unsaved Brief draft: deliberate Leave changes the route exactly once and never saves", async ({ page }, info) => {
    await page.locator("#brief-work").fill("Knock through the kitchen wall and fit a steel.");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "unsaved");

    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Synthetic job one", exact: true }).click();
    await page.getByRole("button", { name: /Other synthetic job/ }).click();

    const state = await fixtureState(page);
    expect(state.navigation).toEqual(["/dashboard/projects/brief?projectId=job-2"]);
    expect(state.saves).toEqual([]);
    expect(state.currentProjectId).toBe("job-2");
    expect(state.storedProjectId).toBe("job-2");
    // Leaving without saving remounts the real Brief for the other job: the
    // unsaved text is gone and nothing was persisted.
    await expect(page.getByText("Other synthetic job for Another client")).toBeVisible();
    await expect(page.locator("#brief-work")).toHaveValue("");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "empty");
    await expect(page.getByRole("navigation", { name: "Job context" })).toContainText("Other synthetic job");
    await expect(page.locator("aside").locator('a[href*="projectId=job-2"]')).toHaveCount(4);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});

test("failed Brief save keeps the honest dirty confirmation, then a deliberate retry saves", async ({ page }, info) => {
    await page.locator("#brief-work").fill("Rewire the downstairs lighting circuit.");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "unsaved");

    await page.evaluate(() => window.__briefNavigationLocal.setNextSave("refused"));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Local fixture: Brief save not acknowledged.");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "failed");
    await expect(page.locator("#brief-work")).toHaveValue("Rewire the downstairs lighting circuit.");

    // The failed state is still dirty: switching jobs must ask, and Cancel
    // keeps the exact draft and job.
    await page.getByRole("button", { name: "Synthetic job one", exact: true }).click();
    await page.getByRole("button", { name: /Other synthetic job/ }).click();
    let state = await fixtureState(page);
    expect(state.navigation).toEqual([]);
    expect(state.saves).toHaveLength(1);
    expect(state.currentProjectId).toBe("job-1");
    await expect(page.locator("#brief-work")).toHaveValue("Rewire the downstairs lighting circuit.");
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "failed");

    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(saveStatus(page)).toHaveAttribute("data-save-status", "saved");
    state = await fixtureState(page);
    expect(state.saves).toHaveLength(2);
    expect(state.saves[1].payload).toMatchObject({ brief_scope: "Rewire the downstairs lighting circuit." });
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});

test.describe("phone menu against the real Brief boundary", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test("phone project select is gated by the real dirty guard: Cancel retains draft, Leave switches once", async ({ page }, info) => {
        await page.locator("#brief-work").fill("Replace the rotten fascia and soffits.");
        await expect(saveStatus(page)).toHaveAttribute("data-save-status", "unsaved");

        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        const dialog = page.locator("#phone-menu");
        await expect(dialog).toBeVisible();

        // Cancel (auto-dismissed confirm): the controlled select snaps back to
        // the current job and the unsaved draft is untouched.
        await page.locator("#phone-active-project").selectOption("job-2");
        await expect(dialog).toBeVisible();
        await expect(page.locator("#phone-active-project")).toHaveValue("job-1");
        await expect(page.locator("#brief-work")).toHaveValue("Replace the rotten fascia and soffits.");
        let state = await fixtureState(page);
        expect(state.navigation).toEqual([]);
        expect(state.saves).toEqual([]);

        // Explicit Leave through the same real phone select.
        page.once("dialog", accepted => accepted.accept());
        await page.locator("#phone-active-project").selectOption("job-2");
        await expect(dialog).toHaveCount(0);
        state = await fixtureState(page);
        expect(state.navigation).toEqual(["/dashboard/projects/brief?projectId=job-2"]);
        expect(state.saves).toEqual([]);
        await expect(page.getByText("Other synthetic job for Another client")).toBeVisible();
        await expect(page.locator("#brief-work")).toHaveValue("");
        await expect(saveStatus(page)).toHaveAttribute("data-save-status", "empty");
        expect(requests).toEqual([]);
        expect(pageErrors).toEqual([]);
        await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    });
});
