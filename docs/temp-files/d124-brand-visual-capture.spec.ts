import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import {
    CAPTURE_NOTES_PATH,
    preparePublicRouteForCapture,
    writeCaptureNotes,
    type CaptureDiagnostic,
} from "./d124-public-capture";

const OUT = path.join(process.cwd(), "docs/evidence/d124-brand-review/png");
const BASE = process.env.D124_BASE_URL ?? "http://127.0.0.1:3010";
const SHA = process.env.D124_SHA ?? "5a65d1b45cea73ea068a9fcf77dc1dc87410aaca";
const BUNDLE_ROOT = process.env.D124_BUNDLE_ROOT ?? "/tmp/constructa-d124-fixture-bundles";

const PUBLIC_ROUTES = [
    { id: "landing", path: "/" },
    { id: "product", path: "/product" },
    { id: "pricing", path: "/pricing" },
    { id: "login", path: "/login" },
] as const;

const SYNTH_COMPONENT_ROUTES = [
    {
        id: "dashboard",
        bundle: "dashboard",
        title: "D124 SYNTH HomeClient",
        init: () => {
            window.__d124BrandHomeOptions = { theme: "dark" };
        },
        ready: (page) => page.locator("[data-d124-synth-banner]").waitFor({ state: "visible" }),
    },
    {
        id: "estimate",
        bundle: "estimate",
        title: "D124 SYNTH EstimateClient",
        init: () => {
            window.__a003PaletteOptions = { theme: "dark" };
        },
        ready: (page) => page.getByRole("link", { name: /Next: Programme/ }).waitFor({ state: "visible" }),
    },
    {
        id: "programme",
        bundle: "programme",
        title: "D124 SYNTH ClientSchedulePage",
        init: () => {
            window.__detailedGeometryOptions = { plan: "short" };
        },
        ready: (page) => page.locator('input[value^="TEST DATA"]').first().waitFor({ state: "visible", timeout: 90_000 }),
    },
    {
        id: "proposal",
        bundle: "proposal",
        title: "D124 SYNTH ReviewSendClient",
        init: () => {
            window.__documentViewOptions = { theme: "dark" };
        },
        ready: (page) => page.getByRole("button", { name: "2. Review document", exact: true }).waitFor({ state: "visible" }),
    },
] as const;

const VIEWPORTS = [
    { tag: "375", width: 375, height: 812 },
    { tag: "1440", width: 1440, height: 900 },
] as const;

const FIXTURE_HTML = (title: string) =>
    `<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"><title>${title}</title></head><body><div id="app"></div></body></html>`;

mkdirSync(OUT, { recursive: true });

const publicCaptureNotes: CaptureDiagnostic[] = [];

async function captureSynthComponent(
    page: import("@playwright/test").Page,
    route: (typeof SYNTH_COMPONENT_ROUTES)[number],
    vp: (typeof VIEWPORTS)[number],
) {
    const bundleDir = path.join(BUNDLE_ROOT, route.bundle);
    const js = readFileSync(path.join(bundleDir, "components.js"), "utf8");
    const css = readFileSync(path.join(bundleDir, "components.css"), "utf8");
    const pngPath = path.join(OUT, `${route.id}_${vp.tag}.png`);

    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.setContent(FIXTURE_HTML(route.title));
    await page.addStyleTag({ content: css });
    await page.evaluate(route.init);
    await page.addScriptTag({ content: js });
    await route.ready(page);
    await page.screenshot({ path: pngPath, fullPage: true });
}

for (const vp of VIEWPORTS) {
    test.describe(`D124 public routes @ ${vp.tag}px (SHA ${SHA.slice(0, 8)})`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        for (const route of PUBLIC_ROUTES) {
            test(`${route.id} — ${route.path}`, async ({ page }) => {
                await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
                await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
                const diag = await preparePublicRouteForCapture(page, route.id);
                diag.viewport = vp.tag;
                publicCaptureNotes.push(diag);
                await page.screenshot({
                    path: path.join(OUT, `${route.id}_${vp.tag}.png`),
                    fullPage: true,
                });
            });
        }
    });

    test.describe(`D124 SYNTH components @ ${vp.tag}px`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        for (const route of SYNTH_COMPONENT_ROUTES) {
            test(`${route.id} — component fixture`, async ({ page, context }) => {
                await context.setOffline(true);
                await context.route("**/*", r => r.abort());
                try {
                    await captureSynthComponent(page, route, vp);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    await page.setContent(FIXTURE_HTML(`${route.id} SYNTHETIC_RENDER_ERROR`));
                    await page.evaluate(
                        ([id, detail]) => {
                            document.body.innerHTML = `<pre data-synthetic="render-error" style="background:#0d0d0d;color:#f87171;padding:24px;font:14px monospace;white-space:pre-wrap">SYNTHETIC_RENDER_ERROR — ${id} (not coverage)\n${detail}</pre>`;
                        },
                        [route.id, msg],
                    );
                    await page.screenshot({
                        path: path.join(OUT, `${route.id}_${vp.tag}.png`),
                        fullPage: true,
                    });
                    throw error;
                }
            });
        }
    });
}

test.afterAll(() => {
    if (publicCaptureNotes.length > 0) {
        writeCaptureNotes(CAPTURE_NOTES_PATH, publicCaptureNotes, {
            sourceSha: SHA,
            capturedAt: new Date().toISOString().slice(0, 10),
        });
    }
});