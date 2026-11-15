import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { MarketingPalettePage } from "./marketing-palette-entry";

// A001 D28: computed marketing primary palette on real phase-one surfaces.
// Build: `node e2e/local-phase1/build-brief-price.mjs <out> marketing-palette`
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");

const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
const SAGE = rgb("#c9efcf");
const SAGE_INK = rgb("#182c1b");
const MARKETING_BASE = rgb("#101211");
const BRAND_BLUES = [rgb("#3b82f6"), rgb("#2563eb"), rgb("#1d4ed8")];

const PAGES: MarketingPalettePage[] = [
    "home",
    "features",
    "pricing",
    "about",
    "contact",
    "apply",
    "guides",
    "guide-article",
];

let requests: string[] = [];
let pageErrors: string[] = [];

type Paint = { bg: string; color: string };
const paint = (locator: Locator): Promise<Paint> =>
    locator.evaluate(element => {
        const style = getComputedStyle(element);
        return { bg: style.backgroundColor, color: style.color };
    });

test.beforeEach(async ({ context }) => {
    requests = [];
    pageErrors = [];
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
});

test.afterEach(async ({}, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("marketing-palette-scope", {
        body: JSON.stringify({
            policy: "phase-one cohort CSS variables (--accent #c9efcf, --accent-ink #182c1b)",
            transport: "offline CSP, aborted network",
        }),
        contentType: "application/json",
    });
});

async function mount(page: Page, marketingPage: MarketingPalettePage) {
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; form-action \'none\'"><title>Marketing palette</title></head><body><div id="app"></div></body></html>',
    );
    await page.evaluate(value => {
        window.__marketingPaletteOptions = { page: value };
    }, marketingPage);
    if (css) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.locator("[data-marketing-palette-page]")).toHaveAttribute(
        "data-marketing-palette-page",
        marketingPage,
    );
}

for (const marketingPage of PAGES) {
    test(`${marketingPage}: header Apply CTA uses marketing sage, not brand blue`, async ({ page }) => {
        await mount(page, marketingPage);
        const apply = page.getByRole("link", { name: /Apply to the founding cohort/i }).first();
        await expect(apply).toBeVisible();
        const colours = await paint(apply);
        expect(colours.bg).toBe(SAGE);
        expect(colours.color).toBe(SAGE_INK);
        expect(BRAND_BLUES).not.toContain(colours.bg);
    });
}

test("home: hero primary CTA uses marketing sage", async ({ page }) => {
    await mount(page, "home");
    const heroPrimary = page
        .locator("#marketing-content")
        .getByRole("link", { name: "Apply to the founding cohort", exact: true });
    await expect.poll(() => paint(heroPrimary)).toMatchObject({ bg: SAGE, color: SAGE_INK });
});

test("customers: documents white utility CTA exception (not phase-one module primary)", async ({ page }) => {
    await mount(page, "customers");
    const cta = page.getByRole("link", { name: /Get in touch/i }).first();
    await expect(cta).toBeVisible();
    const colours = await paint(cta);
    expect(colours.bg).toBe(rgb("#ffffff"));
    expect(colours.color).toBe(rgb("#000000"));
    expect(colours.bg).not.toBe(SAGE);
});

test("home: phase-one root uses marketing charcoal base token", async ({ page }) => {
    await mount(page, "home");
    const root = page.locator("#marketing-content").locator("xpath=ancestor::div[1]");
    const bg = await root.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe(MARKETING_BASE);
});