import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NavigationPaletteFixture } from "./navigation-palette-entry";

// C10 A003: computed active navigation colours on REAL SidebarNav, ProjectNavBar
// and phone menu — same Tailwind v3 pipeline as responsive-hierarchy (not
// visibility-only c09 cases). Build: compile.mjs <out> navigation-palette
const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
const SAGE = rgb("#c9efcf");
const CHARCOAL = rgb("#111827"); // Tailwind gray-900 active sidebar row
const WHITE = rgb("#ffffff");
const SLATE_400 = rgb("#94a3b8");
const SLATE_100 = rgb("#f1f5f9");
const EMERALD_800 = rgb("#065f46");
const THEMES = ["system-c", "dark"] as const;
const scope = {
    components: "REAL SidebarNav, ProjectNavBar, PhoneMenuFocus",
    stylesheet: "ACTUAL_globals.css+tailwind.config.js via installed tailwindcss v3",
    transport: "MOCK Next link/router/path/query/theme; memory localStorage",
    notClaimed: "Full DashboardLayout, hosted journey, assistive certification, physical device",
};

type Paint = { bg: string; color: string };
const paint = (locator: Locator): Promise<Paint> => locator.evaluate(element => {
    const style = getComputedStyle(element);
    return { bg: style.backgroundColor, color: style.color };
});

test.beforeEach(async ({ context }) => {
    requests = [];
    pageErrors = [];
    expect(css).toContain(".md\\:hidden");
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
});

async function mount(page: Page, theme: (typeof THEMES)[number]) {
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local navigation palette - computed active colours</title></head><body><div id="app"></div></body></html>',
    );
    await page.evaluate(value => { window.__navigationPaletteOptions = { theme: value }; }, theme);
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("navigation", { name: "Job context" })).toBeVisible();
}

for (const theme of THEMES) {
    test(`${theme}: desktop active sidebar and breadcrumb use sage/charcoal/ink, not brand blue`, async ({ page }) => {
        await mount(page, theme);
        const active = page.locator("aside [aria-current='page']");
        await expect(active).toHaveText("Job brief");
        await expect.poll(() => paint(active)).toMatchObject({ bg: CHARCOAL, color: WHITE });
        await expect.poll(() => paint(active.locator("svg").first())).toMatchObject({ color: SAGE });

        const inactive = page.locator("aside").getByRole("link", { name: "Estimate", exact: true });
        await expect.poll(() => paint(inactive.locator("svg").first())).toMatchObject({ color: SLATE_400 });
        expect((await paint(inactive)).bg).not.toBe(CHARCOAL);

        const crumb = page.getByRole("navigation", { name: "Job context" });
        const pipeline = crumb.getByRole("link", { name: "Pipeline", exact: true });
        const current = crumb.locator("[aria-current='page']");
        if (theme === "dark") {
            await expect.poll(() => paint(pipeline)).toMatchObject({ color: SAGE });
            await expect.poll(() => paint(current)).toMatchObject({ color: SLATE_100 });
        } else {
            await expect.poll(() => paint(pipeline)).toMatchObject({ color: EMERALD_800 });
            await expect.poll(() => paint(current)).toMatchObject({ color: CHARCOAL });
        }

        await asideClickMovesSelection(page, theme);
    });
}

test.describe("390px phone menu selection colours", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    for (const theme of THEMES) {
        test(`${theme}: open menu active row uses sage icon on charcoal background`, async ({ page }) => {
            await mount(page, theme);
            await page.getByRole("button", { name: "Open menu", exact: true }).click();
            const active = page.locator("#phone-menu [aria-current='page']");
            await expect(active).toHaveText("Job brief");
            await expect.poll(() => paint(active)).toMatchObject({ bg: CHARCOAL, color: WHITE });
            await expect.poll(() => paint(active.locator("svg").first())).toMatchObject({ color: SAGE });
            const inactive = page.locator("#phone-menu").getByRole("link", { name: "Estimate", exact: true });
            await expect.poll(() => paint(inactive.locator("svg").first())).toMatchObject({ color: SLATE_400 });
        });
    }
});

async function asideClickMovesSelection(page: Page, theme: (typeof THEMES)[number]) {
    const aside = page.locator("aside");
    await aside.getByRole("link", { name: "Programme", exact: true }).click();
    const active = aside.locator("[aria-current='page']");
    await expect(active).toHaveText("Programme");
    await expect.poll(() => paint(active)).toMatchObject({ bg: CHARCOAL, color: WHITE });
    await expect.poll(() => paint(active.locator("svg").first())).toMatchObject({ color: SAGE });
    const state = await page.evaluate(() => {
        const fixture = window.__navigationPaletteLocal as NavigationPaletteFixture;
        return { navigation: fixture.navigation, theme: fixture.theme };
    });
    expect(state.navigation.at(-1)).toBe("/dashboard/projects/schedule?projectId=job-1");
    expect(state.theme).toBe(theme);
}
