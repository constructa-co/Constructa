import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ResponsiveHierarchyFixture } from "./responsive-hierarchy-entry";

// A004 2125 responsive boundary: the REAL single navigation hierarchy and the
// REAL retained page header (ProjectNavBar) under the ACTUAL compiled Tailwind
// stylesheet — desktop vs 390px styled visibility, retained job identity, and
// one active destination per visible surface. These cases are IN ADDITION to
// the original three unstyled scaffold cases and the four actual-Brief dirty
// cases; they are not repeated here.
const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];
const scope = {
    sidebarNav: "REAL_COMPONENT_REAL_STYLES",
    projectNavBar: "REAL_COMPONENT_REAL_STYLES_PAGE_HEADER",
    phoneMenuFocus: "REAL_COMPONENT",
    requestProjectNavigation: "REAL_EVENT_CONTRACT",
    stylesheet: "ACTUAL_globals.css+tailwind.config.js_INSTALLED_tailwindcss_v3",
    nextLinkRouterPathQuery: "MOCKED_FIXTURE",
    theme: "MOCKED_FIXTURE",
    storage: "EXPLICIT_MEMORY_FIXTURE",
    auth: "NOT_RUN", database: "NOT_RUN", backend: "NOT_RUN", provider: "NOT_RUN", hostedJourney: "NOT_RUN",
};

async function fixtureState(page: import("@playwright/test").Page): Promise<Pick<ResponsiveHierarchyFixture, "navigation" | "currentProjectId">> {
    return page.evaluate(() => {
        const fixture = window.__responsiveHierarchyLocal;
        return { navigation: fixture.navigation, currentProjectId: fixture.currentProjectId };
    });
}

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    // Provenance guard: the injected stylesheet must be the real compiled
    // Tailwind output (responsive utility present), not an empty or surrogate CSS.
    expect(css).toContain(".md\\:hidden");
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local responsive hierarchy fixture - synthetic jobs</title></head><body><p>LOCAL FIXTURE: Next routing, theme and storage are simulated. Styles are the actual compiled app stylesheet. No account, server or network.</p><div id="app"></div></body></html>');
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    // Retained page header is mounted in both viewports.
    await expect(page.getByRole("navigation", { name: "Job context" })).toBeVisible();
});

test("desktop shows the styled sidebar hierarchy, hides the phone bar, and keeps one current destination", async ({ page }, info) => {
    const aside = page.locator("aside");
    const header = page.locator("header");
    const crumb = page.getByRole("navigation", { name: "Job context" });

    // Real Tailwind visibility: md:flex sidebar on, md:hidden phone bar off.
    await expect(aside).toBeVisible();
    await expect(header).toBeHidden();

    // Single module hierarchy: four same-job links, exactly one current.
    await expect(aside.locator('a[href*="projectId=job-1"]')).toHaveCount(4);
    await expect(aside.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(aside.locator('[aria-current="page"]')).toHaveText("Job brief");

    // Retained page header: Pipeline link, real job name, one current step.
    await expect(crumb.getByRole("link", { name: "Pipeline", exact: true })).toHaveAttribute("href", "/dashboard");
    await expect(crumb).toContainText("Synthetic job one");
    await expect(crumb.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(crumb.locator('[aria-current="page"]')).toHaveText("Job brief");

    // The fixture page body stays visible beneath the retained header.
    await expect(page.getByRole("main", { name: "Fixture page body" })).toBeVisible();
    await expect(page.locator('[data-page="/dashboard/projects/brief"]')).toContainText("Synthetic job one");
    await expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});

test.describe("390px phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test("phone hides the sidebar, shows the styled top bar, retains the same page header and job, and the styled menu overlays", async ({ page }, info) => {
        const aside = page.locator("aside");
        const header = page.locator("header");
        const crumb = page.getByRole("navigation", { name: "Job context" });

        // Real Tailwind visibility inverted below md.
        await expect(aside).toBeHidden();
        await expect(header).toBeVisible();
        await expect(header).toContainText("Job brief");
        await expect(header).toContainText("Synthetic job one");

        // The retained page header is NOT collapsed with the sidebar: same job,
        // same current step, still one current destination per surface.
        await expect(crumb).toBeVisible();
        await expect(crumb).toContainText("Synthetic job one");
        await expect(crumb.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(crumb.locator('[aria-current="page"]')).toHaveText("Job brief");
        await expect(page.locator('[data-page="/dashboard/projects/brief"]')).toContainText("Synthetic job one");
        const state = await fixtureState(page);
        expect(state.currentProjectId).toBe("job-1");

        // Styled menu: fixed overlay opens above the page, sidebar stays hidden,
        // and the menu holds exactly one current destination with the same job.
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        const dialog = page.locator("#phone-menu");
        await expect(dialog).toBeVisible();
        await expect(aside).toBeHidden();
        await expect(dialog.locator("nav")).toBeVisible();
        await expect(dialog.locator('a[href*="projectId=job-1"]')).toHaveCount(4);
        await expect(dialog.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(dialog.locator('[aria-current="page"]')).toHaveText("Job brief");
        // The retained page header remains visible behind the styled overlay.
        await expect(crumb).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        expect(requests).toEqual([]);
        expect(pageErrors).toEqual([]);
        await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
    });
});

test("clicking through the styled desktop hierarchy moves the single current destination and retains the header and job", async ({ page }, info) => {
    const aside = page.locator("aside");
    const crumb = page.getByRole("navigation", { name: "Job context" });
    for (const [label, route] of [["Programme", "schedule"], ["Proposal", "proposal"], ["Job brief", "brief"]] as const) {
        await aside.getByRole("link", { name: label, exact: true }).click();
        await expect(aside.locator('[aria-current="page"]')).toHaveText(label);
        await expect(crumb.locator('[aria-current="page"]')).toHaveText(label);
        await expect(crumb).toContainText("Synthetic job one");
        await expect(crumb).toBeVisible();
        await expect(aside.locator('a[href*="projectId=job-1"]')).toHaveCount(4);
        const state = await fixtureState(page);
        expect(state.navigation.at(-1)).toBe(`/dashboard/projects/${route}?projectId=job-1`);
        expect(state.currentProjectId).toBe("job-1");
    }
    await expect(page.locator('[aria-current="page"]')).toHaveCount(2);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests }), contentType: "application/json" });
});
