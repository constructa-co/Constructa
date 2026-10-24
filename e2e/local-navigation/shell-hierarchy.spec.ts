import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
// C12 A004: REAL DashboardShell geometry (desktop md:ml-64 + phone pt-14) with
// REAL ProjectNavBar job header — not c09 visibility-only or C10 palette cases.
// Build: compile.mjs <out> shell-hierarchy
const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const SIDEBAR_WIDTH_PX = 256; // Tailwind w-64 / md:ml-64
const PHONE_BAR_HEIGHT_PX = 56; // h-14

const scope = {
    dashboardShell: "REAL_COMPONENT_REAL_STYLES",
    projectNavBar: "REAL_COMPONENT_REAL_STYLES_PAGE_HEADER",
    sidebarNav: "REAL_VIA_DASHBOARD_SHELL",
    phoneMenuFocus: "REAL_VIA_DASHBOARD_SHELL",
    stylesheet: "ACTUAL_globals.css+tailwind.config.js via installed tailwindcss v3",
    nextLinkRouterPathQuery: "MOCKED_FIXTURE",
    theme: "MOCKED_FIXTURE",
    storage: "EXPLICIT_MEMORY_FIXTURE",
    notClaimed: "Full DashboardLayout server fetch, hosted journey, assistive certification, physical device",
    auth: "NOT_RUN",
    database: "NOT_RUN",
    backend: "NOT_RUN",
    provider: "NOT_RUN",
};

async function box(locator: Locator) {
    const rect = await locator.boundingBox();
    expect(rect).not.toBeNull();
    return rect!;
}

async function mount(page: Page) {
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local shell hierarchy - DashboardShell geometry</title></head><body><div id="app"></div></body></html>',
    );
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("navigation", { name: "Job context" })).toBeVisible();
}

function shellMain(page: Page) {
    return page.locator("div.h-screen.overflow-hidden > main").first();
}

test.beforeEach(async ({ context }) => {
    requests = [];
    pageErrors = [];
    expect(css).toContain(".md\\:ml-64");
    expect(css).toContain(".pt-14");
    await context.setOffline(true);
    await context.route("**/*", (route) => route.abort());
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
});

test("desktop DashboardShell clears fixed sidebar with md:ml-64 and keeps job header in shell main", async ({ page }) => {
    await mount(page);
    const aside = page.locator("aside");
    const phoneBar = page.locator("header");
    const crumb = page.getByRole("navigation", { name: "Job context" });
    const main = shellMain(page);
    const body = page.getByRole("region", { name: "Fixture page body" });

    await expect(aside).toBeVisible();
    await expect(phoneBar).toBeHidden();

    const asideRect = await box(aside);
    const mainRect = await box(main);
    expect(asideRect.width).toBeGreaterThan(SIDEBAR_WIDTH_PX - 4);
    expect(asideRect.width).toBeLessThan(SIDEBAR_WIDTH_PX + 4);
    expect(mainRect.x).toBeGreaterThanOrEqual(SIDEBAR_WIDTH_PX - 2);
    expect(mainRect.x).toBeLessThan(SIDEBAR_WIDTH_PX + 6);
    expect(mainRect.width).toBeLessThanOrEqual(page.viewportSize()!.width - SIDEBAR_WIDTH_PX + 8);

    await expect(crumb).toContainText("Synthetic job one");
    await expect(crumb.locator('[aria-current="page"]')).toHaveText("Job brief");
    await expect(body).toBeVisible();
    await expect(page.locator('[data-page="/dashboard/projects/brief"]')).toContainText("Synthetic job one");

    const bodyRect = await box(body);
    expect(bodyRect.y).toBeGreaterThanOrEqual(mainRect.y);
});

test.describe("390px phone shell offset", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("phone top bar and pt-14 shell main keep job header; Escape closes menu without breaking layout", async ({ page }) => {
        await mount(page);
        const aside = page.locator("aside");
        const phoneBar = page.locator("header").first();
        const crumb = page.getByRole("navigation", { name: "Job context" });
        const main = shellMain(page);
        const body = page.getByRole("region", { name: "Fixture page body" });

        await expect(aside).toBeHidden();
        await expect(phoneBar).toBeVisible();
        await expect(phoneBar).toContainText("Job brief");
        await expect(phoneBar).toContainText("Synthetic job one");

        const barRect = await box(phoneBar);
        const mainRect = await box(main);
        expect(barRect.height).toBeGreaterThan(PHONE_BAR_HEIGHT_PX - 4);
        expect(barRect.height).toBeLessThan(PHONE_BAR_HEIGHT_PX + 4);
        expect(mainRect.x).toBeLessThan(8);
        expect(mainRect.width).toBeGreaterThan(360);

        const crumbRect = await box(crumb);
        expect(crumbRect.y).toBeGreaterThanOrEqual(barRect.y + barRect.height - 2);
        await expect(crumb.locator('[aria-current="page"]')).toHaveText("Job brief");
        await expect(body).toContainText("Synthetic job one");

        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        const dialog = page.locator("#phone-menu");
        await expect(dialog).toBeVisible();
        await expect(aside).toBeHidden();
        await expect(crumb).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(crumb).toBeVisible();
        await expect(body).toBeVisible();

        const state = await page.evaluate(() => {
            const fixture = window.__shellHierarchyLocal;
            return { currentProjectId: fixture.currentProjectId, navigation: fixture.navigation };
        });
        expect(state.currentProjectId).toBe("job-1");
        expect(state.navigation).toEqual([]);
    });
});
