import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// C16 A021: computed rendered layout for actual ImportClient/CompanyImportFrame
// (canonical constructa source + CSS module bridge). Not C14 static unit tests.
// Build: node e2e/local-phase1/build-brief-price.mjs <abs-out> import-render
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    components: "REAL ImportClient, CompanyImportFrame, company-import.module.css (canonical constructa)",
    transport: "REFUSED preview/apply server actions; no crawl/network/upload",
    stylesheet: "ACTUAL CSS module via local-phase1 compiler bridge",
    vitestC14: "NOT_DUPLICATED — static heading/CSS string tests remain separate",
    c15A017: "NOT_DUPLICATED — pipeline filter work satisfied by Codex 46db92f",
};

async function box(locator: Locator) {
    const rect = await locator.boundingBox();
    expect(rect).not.toBeNull();
    return rect!;
}

function layoutPair(page: Page) {
    const guide = page.getByRole("complementary", { name: "How website import works" });
    const layout = guide.locator("xpath=parent::*");
    const editor = guide.locator("xpath=preceding-sibling::*[1]");
    return { guide, layout, editor };
}

test.beforeEach(async ({ context }) => {
    requests = [];
    pageErrors = [];
    expect(css).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    await context.setOffline(true);
    await context.route("**/*", (route) => route.abort());
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    const calls = await page.evaluate(() => window.__importRenderLocal?.calls ?? []);
    expect(calls).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors, calls }), contentType: "application/json" });
});

async function mount(page: Page) {
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Import render balance - offline canonical import</title></head><body><div id="app"></div></body></html>',
    );
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("heading", { level: 1, name: "Your company, brought into focus." })).toBeVisible();
    await expect(page.getByLabel("Your website address")).toBeVisible();
    await expect(page.getByText("Review before you save")).toBeVisible();
    await expect(page.locator("#import-permission")).not.toBeChecked();
}

test("desktop: computed equal-width columns for editor and guide with heading and URL visible", async ({ page }) => {
    test.info().annotations.push({ type: "viewport", description: "1280x900 — host width keeps company-import container above 900px breakpoint" });
    await mount(page);
    const { guide, layout, editor } = layoutPair(page);
    await expect(editor).toBeVisible();
    await expect(guide).toBeVisible();

    const grid = await layout.evaluate((element) => {
        const style = getComputedStyle(element);
        return { display: style.display, template: style.gridTemplateColumns };
    });
    expect(grid.display).toBe("grid");
    expect(grid.template.split(/\s+/)).toHaveLength(2);

    const editorRect = await box(editor);
    const guideRect = await box(guide);
    expect(Math.abs(editorRect.width - guideRect.width)).toBeLessThan(12);
    expect(Math.abs(editorRect.y - guideRect.y)).toBeLessThan(2);
    expect(editorRect.x).toBeLessThan(guideRect.x);
    expect(editorRect.x + editorRect.width).toBeLessThanOrEqual(guideRect.x + 2);
});

test.describe("390px phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("phone: single-column stack without horizontal overlap; guidance and manual entry copy retained", async ({ page }) => {
        await mount(page);
        const { guide, layout, editor } = layoutPair(page);
        const grid = await layout.evaluate((element) => getComputedStyle(element).gridTemplateColumns);
        expect(grid.split(/\s+/)).toHaveLength(1);

        const editorRect = await box(editor);
        const guideRect = await box(guide);
        expect(guideRect.y).toBeGreaterThanOrEqual(editorRect.y + editorRect.height - 4);
        expect(Math.abs(editorRect.width - guideRect.width)).toBeLessThan(24);
        expect(editorRect.width).toBeGreaterThan(300);
        expect(guideRect.x + guideRect.width).toBeLessThanOrEqual(390);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        await expect(page.getByRole("link", { name: "Enter details by hand" })).toBeVisible();
        await expect(page.getByText("Nothing is ticked for you")).toBeVisible();
    });
});
