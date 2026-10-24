import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalA003PaletteFixture } from "./a003-palette-entry";

// A003: computed colours of the actual estimating controls, in light and dark,
// from the actual compiled Tailwind stylesheet plus the actual CSS modules.
// Build with `build-brief-price.mjs <out> a003-palette` (A003-PALETTE-2225 hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
// Existing tokens: workspace-styles/LineForm sage pair, estimating.module.css
// resource accent and root backgrounds, Tailwind v3 default blues.
const SAGE = rgb("#c9efcf"), SAGE_INK = rgb("#182c1b");
const RESOURCE_ACCENT = rgb("#b5e5bf"), RESOURCE_INK = rgb("#14251a");
const ROOT_BACKGROUND = { "system-c": rgb("#f5f7f2"), dark: rgb("#111812") };
// Existing module rule .resourcePanel .resourceTable td:first-child span
// overrides the retained resource utility colours in both themes.
const RESOURCE_BADGE_BG = rgb("#263a2c"), RESOURCE_BADGE_INK = rgb("#d2e6d4");
const BRAND_BLUES = [rgb("#3b82f6"), rgb("#2563eb"), rgb("#1d4ed8")]; // blue-500/600/700
const THEMES = ["system-c", "dark"] as const;
const scope = {
    components: "REAL ThemeProvider, EstimateClient, LineForm, lazy AdvancedEstimate, BuildUpPanel",
    styles: "Actual compiled Tailwind (globals.css + tailwind.config.js, installed v3) before the actual CSS modules",
    transport: "MOCK: simple-price server refuses; resource add acknowledged from submitted args; Apply refused",
    notClaimed: "Served full page, contrast/assistive certification, mobile device, hosted, Auth/DB",
};

type Paint = { bg: string; color: string; border: string };
const paint = (locator: Locator): Promise<Paint> => locator.evaluate(element => {
    const style = getComputedStyle(element);
    return { bg: style.backgroundColor, color: style.color, border: style.borderTopColor };
});
const isBrandBlue = (value: string) => BRAND_BLUES.includes(value);
const calls = (page: Page) => page.evaluate(() => ({ actions: window.__a003PaletteActions.actionCalls, simple: window.__a003PaletteLocal.simpleServerCalls }));

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local A003 palette - computed styles</title></head><body><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await calls(page), requests, pageErrors }), contentType: "application/json" });
});

async function open(page: Page, theme: (typeof THEMES)[number]) {
    await page.evaluate(value => { window.__a003PaletteOptions = { theme: value }; }, theme);
    await page.addScriptTag({ content: bundle });
    const root = page.locator("div[data-theme]").first();
    await expect(root).toHaveAttribute("data-theme", theme === "dark" ? "dark" : "light");
    expect((await paint(root)).bg).toBe(ROOT_BACKGROUND[theme]);
    return root;
}

for (const theme of THEMES) {
    test(`${theme}: the selected pricing mode and Next: Programme are sage, not brand blue`, async ({ page }) => {
        await open(page, theme);
        const next = page.getByRole("link", { name: /Next: Programme/ });
        await expect.poll(() => paint(next)).toMatchObject({ bg: SAGE, color: SAGE_INK });

        await page.getByRole("button", { name: "Add a price line", exact: true }).click();
        const fullForm = page.getByRole("button", { name: "Full line form", exact: true });
        if (await fullForm.count()) await fullForm.first().click();
        const onePrice = page.locator("form").getByRole("button", { name: "One price", exact: true });
        const rate = page.locator("form").getByRole("button", { name: "Quantity and rate", exact: true });
        await expect(onePrice).toHaveAttribute("aria-pressed", "true");
        await expect.poll(() => paint(onePrice)).toEqual({ bg: SAGE, color: SAGE_INK, border: SAGE });
        const unselected = await paint(rate);
        expect(unselected.bg).not.toBe(SAGE);
        expect(isBrandBlue(unselected.bg) || isBrandBlue(unselected.border) || isBrandBlue(unselected.color)).toBe(false);

        // The contractor's selection moves the sage state; nothing is saved.
        await rate.click();
        await expect(rate).toHaveAttribute("aria-pressed", "true");
        // Polled: the buttons use transition-colors, so the first frame can be mid-transition.
        await expect.poll(() => paint(rate)).toEqual({ bg: SAGE, color: SAGE_INK, border: SAGE });
        await expect.poll(async () => (await paint(onePrice)).bg).not.toBe(SAGE);
        expect(await calls(page)).toEqual({ actions: [], simple: [] });
        await page.screenshot({ path: path.join(output, `a003-palette-line-form-${theme}.png`), fullPage: true });
    });

    test(`${theme}: build-up selection and Apply keep the sage accent and the existing labour badge cascade`, async ({ page }) => {
        await open(page, theme);
        await page.evaluate(() => { window.__a003PaletteActions.script = { addComponent: ["ack"], applyRate: ["refuse"] }; });
        await page.locator("button[aria-controls='advanced-estimating']").click();
        await page.locator("[data-resource-disclosure='local-a003-palette-line']").click();
        await expect(page.getByRole("heading", { name: "Resource build-up", exact: true })).toBeVisible();

        const basis = page.getByRole("group", { name: "Resource quantity entry basis" });
        const total = basis.getByRole("button", { name: "Total for this line", exact: true });
        const perUnit = basis.getByRole("button", { name: "Enter resource quantities per priced unit", exact: true });
        await expect(total).toHaveAttribute("aria-pressed", "true");
        expect(await paint(total)).toMatchObject({ bg: RESOURCE_ACCENT, color: RESOURCE_INK });
        expect((await paint(perUnit)).bg).not.toBe(RESOURCE_ACCENT);
        expect(isBrandBlue((await paint(perUnit)).bg)).toBe(false);

        // A labour resource with custom hours, acknowledged by the MOCK.
        await page.getByRole("button", { name: "+ labour", exact: true }).click();
        await page.getByLabel("New resource name", { exact: true }).fill("Paver labour");
        await page.getByLabel("New resource total quantity", { exact: true }).fill("16");
        await page.getByLabel("New resource unit", { exact: true }).selectOption("hr");
        await page.getByLabel("New resource rate", { exact: true }).fill("30");
        await page.getByLabel("New resource hours", { exact: true }).fill("1.5");
        await page.getByRole("button", { name: "Save new resource", exact: true }).click();
        const badge = page.locator("[data-resource-row] td").first().locator("span").first();
        await expect(badge).toHaveText("labour");
        await expect(badge).toHaveClass(/bg-blue-100/);
        await expect(badge).toHaveClass(/text-blue-700/);
        await expect.poll(() => paint(badge)).toMatchObject({ bg: RESOURCE_BADGE_BG, color: RESOURCE_BADGE_INK });

        await page.getByLabel("Confirm total resources for this priced quantity", { exact: true }).check();
        const apply = page.getByRole("button", { name: "Apply resource rate", exact: true });
        await expect(apply).toBeEnabled();
        await expect.poll(() => paint(apply)).toMatchObject({ bg: RESOURCE_ACCENT, color: RESOURCE_INK });
        await apply.click();
        await expect(page.getByText("Rate not confirmed.")).toBeVisible();
        await expect(apply).toHaveText(/Retry Apply rate/);
        await expect.poll(() => paint(apply)).toMatchObject({ bg: RESOURCE_ACCENT, color: RESOURCE_INK });

        const recorded = await calls(page);
        expect(recorded.simple).toEqual([]);
        expect(recorded.actions.map(call => call.name)).toEqual(["addComponentAction", "updateLineBuiltUpRateAction"]);
        expect(recorded.actions[0]!.args[1]).toMatchObject({ component_type: "labour", quantity: 16, unit: "hr", unit_rate: 30, manhours_per_unit: 1.5 });
        await page.screenshot({ path: path.join(output, `a003-palette-build-up-${theme}.png`), fullPage: true });
    });
}
