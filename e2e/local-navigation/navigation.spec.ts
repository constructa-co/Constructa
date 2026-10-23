import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalNavigationFixture } from "./entry";

// A004 Real Navigation Interaction — offline browser cases over the real
// SidebarNav / ProjectNavBar / PhoneMenuFocus components and the real
// requestProjectNavigation event contract. Next router/path/query/theme and
// storage are explicit fixture mocks; jobs and the dirty editor are synthetic.
const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];
const scope = {
    sidebarNav: "REAL_COMPONENT",
    projectNavBar: "REAL_COMPONENT",
    phoneMenuFocus: "REAL_COMPONENT",
    requestProjectNavigation: "REAL_EVENT_CONTRACT",
    nextLinkRouterPathQuery: "MOCKED_FIXTURE",
    theme: "MOCKED_FIXTURE",
    storage: "EXPLICIT_MEMORY_FIXTURE",
    auth: "NOT_RUN", database: "NOT_RUN", backend: "NOT_RUN", provider: "NOT_RUN", hostedJourney: "NOT_RUN",
};

type FixtureState = Pick<LocalNavigationFixture, "navigation" | "currentProjectId" | "dirty" | "drafts"> & {
    storedProjectId: string | null;
};

async function fixtureState(page: import("@playwright/test").Page): Promise<FixtureState> {
    return page.evaluate(() => {
        const fixture = window.__navigationLocal;
        return {
            navigation: fixture.navigation,
            currentProjectId: fixture.currentProjectId,
            dirty: fixture.dirty,
            drafts: fixture.drafts,
            storedProjectId: localStorage.getItem("constructa_selected_project_id"),
        };
    });
}

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local navigation fixture - synthetic jobs</title></head><body><p>LOCAL FIXTURE: Next routing, theme and storage are simulated. No account, server or network.</p><div id="app"></div></body></html>');
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.locator("aside")).toBeVisible();
});

test("desktop keeps one job hierarchy and the same project id across brief, estimate, programme and proposal", async ({ page }, info) => {
    const aside = page.locator("aside");
    const crumb = page.getByRole("navigation", { name: "Job context" });
    await expect(crumb).toHaveCount(1);
    await expect(aside.getByRole("button", { name: "This job", exact: true })).toHaveCount(1);

    // The sole module menu: four workflow links, all carrying the same job id,
    // exactly one current location.
    const workflow = [
        ["Job brief", "brief"], ["Estimate", "costs"],
        ["Programme", "schedule"], ["Proposal", "proposal"],
    ] as const;
    await expect(aside.locator('a[href*="projectId=job-1"]')).toHaveCount(4);
    for (const [label, route] of workflow) {
        await expect(aside.getByRole("link", { name: label, exact: true }))
            .toHaveAttribute("href", `/dashboard/projects/${route}?projectId=job-1`);
    }
    await expect(aside.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(aside.locator('[aria-current="page"]')).toHaveText("Job brief");

    // Single context breadcrumb: Pipeline link, real job name, one current step.
    await expect(crumb.getByRole("link", { name: "Pipeline", exact: true })).toHaveAttribute("href", "/dashboard");
    await expect(crumb).toContainText("Synthetic job one");
    await expect(crumb.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(crumb.locator('[aria-current="page"]')).toHaveText("Job brief");

    for (const [label, route] of workflow) {
        await aside.getByRole("link", { name: label, exact: true }).click();
        await expect(aside.locator('[aria-current="page"]')).toHaveText(label);
        await expect(crumb.locator('[aria-current="page"]')).toHaveText(label);
        await expect(aside.locator('a[href*="projectId=job-1"]')).toHaveCount(4);
        const state = await fixtureState(page);
        expect(state.navigation.at(-1)).toBe(`/dashboard/projects/${route}?projectId=job-1`);
        expect(state.currentProjectId).toBe("job-1");
    }
    // Exactly one current location per surface, and no second module menu.
    await expect(page.locator('[aria-current="page"]')).toHaveCount(2);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});

test.describe("phone menu keyboard and same-job urls", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test("opens from the menu button, traps Tab, returns focus on Escape, and keeps the same job in urls", async ({ page }, info) => {
        const header = page.locator("header");
        await expect(header).toContainText("Job brief");
        await expect(header).toContainText("Synthetic job one");

        const opener = page.getByRole("button", { name: "Open menu", exact: true });
        await opener.click();
        const dialog = page.locator("#phone-menu");
        await expect(dialog).toBeVisible();
        const nav = dialog.locator("nav");
        const closeButton = nav.getByRole("button", { name: "Close menu", exact: true }).first();

        // Real PhoneMenuFocus moved focus to the first menu control.
        await expect(closeButton).toBeFocused();
        // Active-project select holds the same job…
        await page.keyboard.press("Tab");
        await expect(page.locator("#phone-active-project")).toBeFocused();
        await expect(page.locator("#phone-active-project")).toHaveValue("job-1");
        // …and every this-job link carries the same project id.
        await expect(nav.locator('a[href*="projectId=job-1"]')).toHaveCount(4);
        await expect(nav.getByRole("link", { name: "Job brief", exact: true }))
            .toHaveAttribute("href", "/dashboard/projects/brief?projectId=job-1");

        // Forward Tab walks into the item list; backward Tab from the first
        // control wraps to the last; forward Tab from the last wraps back.
        await page.keyboard.press("Tab");
        await expect(nav.getByRole("link", { name: "Pipeline", exact: true })).toBeFocused();
        await closeButton.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(nav.getByRole("button", { name: "Sign out", exact: true })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(closeButton).toBeFocused();

        // Escape closes the real menu and PhoneMenuFocus returns focus to the opener.
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(opener).toBeFocused();
        expect(requests).toEqual([]);
        expect(pageErrors).toEqual([]);
        await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    });
});

test("dirty project switch asks first: Cancel retains job and draft, explicit Leave switches", async ({ page }, info) => {
    const picker = page.getByRole("button", { name: "Synthetic job one", exact: true });
    const crumb = page.getByRole("navigation", { name: "Job context" });
    const otherJob = page.getByRole("button", { name: /Other synthetic job/ });

    await page.evaluate(() => window.__navigationLocal.setDirty(true));
    await expect(page.getByRole("region", { name: "Synthetic job editor" })).toBeVisible();
    await page.getByLabel("Synthetic draft").fill("retained price note");

    // Cancel (Playwright auto-dismisses the confirm): the real
    // requestProjectNavigation event is cancelled, so nothing changes.
    await picker.click();
    await otherJob.click();
    let state = await fixtureState(page);
    expect(state.navigation).toEqual([]);
    expect(state.currentProjectId).toBe("job-1");
    expect(state.storedProjectId).toBe("job-1");
    expect(state.drafts.brief).toBe("retained price note");
    await expect(picker).toHaveText(/Synthetic job one/);
    await expect(crumb).toContainText("Synthetic job one");
    await expect(page.getByLabel("Synthetic draft")).toHaveValue("retained price note");

    // Clearing the project is gated by the same event while dirty.
    await page.getByRole("button", { name: "Deselect project", exact: true }).click();
    state = await fixtureState(page);
    expect(state.navigation).toEqual([]);
    expect(state.currentProjectId).toBe("job-1");

    // Explicit Leave (dialog accepted): the switch commits through the real
    // router.push path and the unsaved draft is discarded by the fixture page.
    page.once("dialog", dialog => dialog.accept());
    await otherJob.click();
    state = await fixtureState(page);
    expect(state.navigation).toEqual(["/dashboard/projects/brief?projectId=job-2"]);
    expect(state.currentProjectId).toBe("job-2");
    expect(state.storedProjectId).toBe("job-2");
    expect(state.dirty).toBe(false);
    expect(state.drafts).toEqual({});
    await expect(page.getByRole("region", { name: "Synthetic job editor" })).toHaveCount(0);
    await expect(crumb).toContainText("Other synthetic job");
    await expect(page.locator("aside").locator('a[href*="projectId=job-2"]')).toHaveCount(4);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});
