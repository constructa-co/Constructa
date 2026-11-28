/**
 * D127 before/after layout captures (local only, offline).
 *
 * Mounts the actual estimating and detailed programme components from bundles
 * built by `d127-build-fixture-bundles.mjs` (synthetic TEST DATA, MOCK-refused
 * actions) at 375 and 1440, saves full-page PNGs and a receipt per shot.
 * No server, account, database, provider, save or network.
 *
 *   D127_BUNDLE_ROOT=/abs/bundles D127_OUT=/abs/out/before \
 *     node node_modules/@playwright/test/cli.js test --config=docs/temp-files/d127-playwright.config.mjs
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BUNDLE_ROOT = process.env.D127_BUNDLE_ROOT!;
const OUT = process.env.D127_OUT!;
if (!BUNDLE_ROOT || !OUT) throw new Error("Set D127_BUNDLE_ROOT and D127_OUT.");

const VIEWPORTS = [
    { tag: "375", width: 375, height: 812 },
    { tag: "1440", width: 1440, height: 900 },
] as const;

/** Root body classes match the live app shell: src/app/layout.tsx */
const FIXTURE_HTML = (title: string) =>
    `<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"><title>${title}</title></head><body class="bg-black text-white antialiased"><div id="app"></div></body></html>`;

const SCREENS = [
    {
        id: "estimate",
        title: "D127 estimate",
        ready: async (page: Page) => {
            await expect(page.locator("[data-price-total]")).toBeVisible();
            // Show the existing activity breakdown so section subtotals render.
            await page.getByRole("button", { name: "Show activity breakdown" }).click();
            await expect(page.locator("[data-activity-subtotal]")).toHaveCount(8);
        },
        calls: () => (window as unknown as { __d127EstimateLocal: { simpleServerCalls: string[] } }).__d127EstimateLocal.simpleServerCalls.length,
    },
    {
        id: "programme",
        title: "D127 programme",
        ready: async (page: Page) => {
            const wide = page.viewportSize()!.width >= 1024;
            if (wide) await expect(page.locator("[data-planner-duration]")).toHaveCount(48);
            else await expect(page.locator("[data-planner-phone-phase]")).toHaveCount(48);
        },
        calls: () => (window as unknown as { __d127ProgrammeLocal: { plannerCalls: unknown[] } }).__d127ProgrammeLocal.plannerCalls.length,
    },
] as const;

mkdirSync(OUT, { recursive: true });

for (const screen of SCREENS) {
    for (const vp of VIEWPORTS) {
        test(`${screen.id} at ${vp.tag}`, async ({ page }) => {
            const requests: string[] = [];
            const errors: string[] = [];
            page.on("request", (request) => { if (!request.url().startsWith("data:") && request.url() !== "about:blank") requests.push(request.url()); });
            page.on("pageerror", (error) => errors.push(error.message));
            const dir = path.join(BUNDLE_ROOT, screen.id);
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.setContent(FIXTURE_HTML(screen.title));
            await page.addStyleTag({ content: readFileSync(path.join(dir, "components.css"), "utf8") });
            await page.addScriptTag({ content: readFileSync(path.join(dir, "components.js"), "utf8") });
            await screen.ready(page);
            await page.evaluate(() => document.fonts.ready);
            const facts = await page.evaluate(() => {
                const nestedVerticalScroll = Array.from(document.querySelectorAll<HTMLElement>("body *"))
                    .filter((el) => {
                        const style = getComputedStyle(el);
                        return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0;
                    })
                    .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${Array.from(el.attributes).filter((a) => a.name.startsWith("data-")).map((a) => a.name).join(",")}] ${el.scrollHeight}>${el.clientHeight}`);
                return {
                    pageScrollWidth: document.documentElement.scrollWidth,
                    viewportWidth: window.innerWidth,
                    pageHeight: document.documentElement.scrollHeight,
                    nestedVerticalScroll,
                };
            });
            const actionCalls = await page.evaluate(screen.calls);
            const png = path.join(OUT, `${screen.id}_${vp.tag}.png`);
            await page.screenshot({ path: png, fullPage: true });
            // Close-ups for review, of the same mounted page.
            if (screen.id === "estimate") {
                await page.locator("[data-price-total]").screenshot({ path: path.join(OUT, `estimate-total_${vp.tag}.png`) });
                await page.locator("[data-activity-subtotal]").first().screenshot({ path: path.join(OUT, `estimate-subtotal_${vp.tag}.png`) });
            } else if (vp.width < 1024) {
                const list = await page.locator("[data-planner-phone-phase-list]").boundingBox();
                if (list) await page.screenshot({ path: path.join(OUT, `programme-phone-list_${vp.tag}.png`), fullPage: true, clip: { x: 0, y: list.y, width: vp.width, height: Math.min(900, list.height) } });
            } else {
                await page.screenshot({ path: path.join(OUT, `programme-viewport_${vp.tag}.png`) });
            }
            writeFileSync(path.join(OUT, `${screen.id}_${vp.tag}.json`), JSON.stringify({ screen: screen.id, viewport: vp, ...facts, actionCalls, requests, errors }, null, 2) + "\n");
            expect(errors).toEqual([]);
            expect(requests).toEqual([]);
            expect(actionCalls).toBe(0);
        });
    }
}
