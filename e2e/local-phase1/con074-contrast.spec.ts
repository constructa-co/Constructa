import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const evidenceRoot = path.resolve("docs/evidence/con074-browser-contrast");
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(output, "source-manifest.json"), "utf8")) as {
    sourceHashes: Record<string, string>;
    scope: string;
};

let requests: string[] = [];
let pageErrors: string[] = [];

const gitHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const THEMES = ["system-c", "dark"] as const;

const scope = {
    action: "CON-074 browser contrast evidence",
    gitHead,
    components: "REAL ThemeProvider, DashboardClient (period + List pills), EstimateClient totalDock",
    styles: "Installed Tailwind v3 compile of globals.css + actual CSS modules",
    transport: "Offline CSP, abort-all routes, MOCK router + refused simple-price server",
    notClaimed: "Hosted app, Auth/DB, full-dashboard axe sign-off, mobile certification",
    manifestScope: manifest.scope,
    bundleSha256: createHash("sha256").update(bundle).digest("hex"),
    cssSha256: createHash("sha256").update(css).digest("hex"),
    sourceHashCount: Object.keys(manifest.sourceHashes).length,
};

type MeasureResult =
    | { state: "solid"; ratio: number; color: string; background: string }
    | { state: "bounded"; reason: string };

async function measureContrast(locator: Locator): Promise<MeasureResult> {
    return locator.evaluate(element => {
        const parse = (color: string) => {
            const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
            if (!rgb) return null;
            const alpha = rgb[4] !== undefined ? Number(rgb[4]) : 1;
            if (alpha <= 0.01) return null;
            return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
        };
        const lum = (rgb: number[]) => {
            const channel = (value: number) => {
                const c = value / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            return channel(rgb[0]) * 0.2126 + channel(rgb[1]) * 0.7152 + channel(rgb[2]) * 0.0722;
        };
        const fg = parse(getComputedStyle(element).color);
        if (!fg) return { state: "bounded", reason: "unparsed foreground" };
        let node: Element | null = element;
        while (node) {
            const bg = parse(getComputedStyle(node).backgroundColor);
            if (bg) {
                const ratio = (() => {
                    const a = lum(fg);
                    const b = lum(bg);
                    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
                })();
                return {
                    state: "solid",
                    ratio,
                    color: getComputedStyle(element).color,
                    background: getComputedStyle(node).backgroundColor,
                };
            }
            node = node.parentElement;
        }
        return { state: "bounded", reason: "no opaque background" };
    });
}

test.beforeAll(() => {
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(
        path.join(evidenceRoot, "provenance.json"),
        JSON.stringify(
            {
                gitHead,
                bundleSha256: scope.bundleSha256,
                cssSha256: scope.cssSha256,
                sourceHashes: Object.entries(manifest.sourceHashes).map(([path, sha256]) => ({ path, sha256 })),
                compilerScope: manifest.scope,
                capturedAt: new Date().toISOString(),
            },
            null,
            2,
        ),
    );
});

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>CON-074 contrast fixture</title></head><body><div id="app"></div></body></html>',
    );
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("con074-scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
});

async function mount(page: Page, theme: (typeof THEMES)[number]) {
    await page.evaluate(themeValue => { window.__con074ContrastOptions = { theme: themeValue, region: "both" }; }, theme);
    await page.addScriptTag({ content: bundle });
    await expect(page.locator("div[data-theme]").first()).toHaveAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

for (const theme of THEMES) {
    test(`${theme}: selected This Month and List pills meet AA (computed + axe)`, async ({ page }) => {
        await mount(page, theme);
        const thisMonth = page.getByRole("button", { name: "This Month", exact: true });
        const list = page.getByRole("button", { name: "List", exact: true });
        await expect(thisMonth).toHaveAttribute("aria-pressed", "true");
        await expect(thisMonth).toHaveAttribute("data-selected", "true");
        await expect(list).toHaveAttribute("aria-pressed", "true");
        await expect(list).toHaveAttribute("data-selected", "true");

        const monthMeasure = await measureContrast(thisMonth);
        const listMeasure = await measureContrast(list);
        expect(monthMeasure.state).toBe("solid");
        expect(listMeasure.state).toBe("solid");
        if (monthMeasure.state === "solid") expect(monthMeasure.ratio).toBeGreaterThanOrEqual(4.5);
        if (listMeasure.state === "solid") expect(listMeasure.ratio).toBeGreaterThanOrEqual(4.5);

        const axePipeline = await new AxeBuilder({ page })
            .include("[data-con074-region='pipeline']")
            .withRules(["color-contrast"])
            .analyze();
        const pipelineViolations = axePipeline.violations.map(v => ({ id: v.id, nodes: v.nodes.length, help: v.help }));
        expect(pipelineViolations).toEqual([]);

        const screenshotPath = path.join(evidenceRoot, `pipeline-pills-${theme}.png`);
        await page.locator("[data-con074-region='pipeline']").screenshot({ path: screenshotPath });
        writeFileSync(
            path.join(evidenceRoot, `pipeline-pills-${theme}.json`),
            JSON.stringify({ theme, monthMeasure, listMeasure, axeViolations: pipelineViolations }, null, 2),
        );
    });

    test(`${theme}: estimate total bar meets AA (computed + axe)`, async ({ page }) => {
        await mount(page, theme);
        const totalDock = page.locator("[data-running-total]");
        await expect(totalDock).toBeVisible();
        const summary = totalDock.locator("summary");
        const measure = await measureContrast(summary);
        expect(measure.state).toBe("solid");
        if (measure.state === "solid") expect(measure.ratio).toBeGreaterThanOrEqual(4.5);

        const axeEstimate = await new AxeBuilder({ page })
            .include("[data-con074-region='estimate']")
            .withRules(["color-contrast"])
            .analyze();
        const estimateViolations = axeEstimate.violations.map(v => ({ id: v.id, nodes: v.nodes.length, help: v.help }));
        expect(estimateViolations).toEqual([]);

        const screenshotPath = path.join(evidenceRoot, `estimate-total-bar-${theme}.png`);
        await totalDock.screenshot({ path: screenshotPath });
        writeFileSync(
            path.join(evidenceRoot, `estimate-total-bar-${theme}.json`),
            JSON.stringify({ theme, measure, axeViolations: estimateViolations }, null, 2),
        );
    });

    test(`${theme}: scoped WCAG2AA scan records no contrast violations on CON-074 targets`, async ({ page }) => {
        await mount(page, theme);
        const regions = ["[data-project-period]", "[data-project-views]", "[data-running-total]"] as const;
        const findings: Record<string, unknown>[] = [];
        for (const selector of regions) {
            await page.locator(selector).scrollIntoViewIfNeeded();
            const axe = await new AxeBuilder({ page }).include(selector).withRules(["color-contrast"]).analyze();
            findings.push({ selector, violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })) });
            expect(axe.violations, `color-contrast in ${selector}`).toEqual([]);
        }
        writeFileSync(path.join(evidenceRoot, `axe-wcag2aa-scoped-${theme}.json`), JSON.stringify({ theme, regions, findings }, null, 2));
        await page.screenshot({ path: path.join(evidenceRoot, `full-fixture-${theme}.png`), fullPage: true });
    });
}