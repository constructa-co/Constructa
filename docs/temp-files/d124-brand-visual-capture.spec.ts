import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
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
        ready: (page: Page) => page.locator("[data-d124-synth-banner]").waitFor({ state: "visible" }),
    },
    {
        id: "estimate",
        bundle: "estimate",
        title: "D124 SYNTH EstimateClient",
        init: () => {
            window.__a003PaletteOptions = { theme: "dark" };
        },
        ready: (page: Page) => page.getByRole("link", { name: /Next: Programme/ }).waitFor({ state: "visible" }),
    },
    {
        id: "programme",
        bundle: "programme",
        title: "D124 SYNTH ClientSchedulePage",
        init: () => {
            window.__detailedGeometryOptions = { plan: "short" };
        },
        ready: (page: Page) => page.locator('input[value^="TEST DATA"]').first().waitFor({ state: "visible", timeout: 90_000 }),
    },
    {
        id: "proposal",
        bundle: "proposal",
        title: "D124 SYNTH ReviewSendClient",
        init: () => {
            window.__documentViewOptions = { theme: "dark" };
        },
        ready: (page: Page) => page.locator("[data-d124-synth-banner]").waitFor({ state: "visible" }),
    },
] as const;

const VIEWPORTS = [
    { tag: "375", width: 375, height: 812 },
    { tag: "1440", width: 1440, height: 900 },
] as const;

/** Root body classes match live app shell: src/app/layout.tsx */
const LAYOUT_BODY_CLASS = "bg-black text-white antialiased";

const FIXTURE_HTML = (title: string) =>
    `<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"><title>${title}</title></head><body class="${LAYOUT_BODY_CLASS}"><div id="app"></div></body></html>`;

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

    if (route.id === "proposal" || route.id === "programme") {
        const provenance = await page.evaluate(
            ([id, layoutBodyClass]) => {
                const body = document.body;
                const bs = getComputedStyle(body);
                const app = document.getElementById("app");
                const appChild = app?.firstElementChild as HTMLElement | null;
                const acs = appChild ? getComputedStyle(appChild) : null;
                const planner = document.querySelector("[data-planner-grid-week]") as HTMLElement | null;
                const ps = planner ? getComputedStyle(planner) : null;
                const sampleLink = document.querySelector("a") as HTMLAnchorElement | null;
                const ls = sampleLink ? getComputedStyle(sampleLink) : null;
                const primaryBtn = document.querySelector("button") as HTMLButtonElement | null;
                const pbs = primaryBtn ? getComputedStyle(primaryBtn) : null;
                const sampleRadio = document.querySelector('input[type="radio"]') as HTMLInputElement | null;
                const rs = sampleRadio ? getComputedStyle(sampleRadio) : null;
                const themeContext =
                    id === "proposal"
                        ? {
                              provider: "ThemeProvider",
                              requested: (window as Window & { __documentViewOptions?: { theme?: string } })
                                  .__documentViewOptions?.theme,
                              effective: (window as Window & { __documentViewOptions?: { theme?: string } })
                                  .__documentViewOptions?.theme === "system-c"
                                  ? "system-c"
                                  : "dark",
                          }
                        : id === "programme"
                          ? {
                                provider: "none",
                                requested: null,
                                effective: "detailed-geometry (ClientSchedulePage only; no ThemeProvider)",
                            }
                          : null;
                return {
                    routeId: id,
                    fixtureRootContext: {
                        source: "src/app/layout.tsx",
                        bodyClassAttribute: layoutBodyClass,
                        bodyClassList: Array.from(body.classList),
                    },
                    theme: themeContext,
                    body: {
                        fontFamily: bs.fontFamily,
                        backgroundColor: bs.backgroundColor,
                        color: bs.color,
                        webkitFontSmoothing: bs.getPropertyValue("-webkit-font-smoothing"),
                    },
                    appShell: appChild
                        ? { backgroundColor: acs!.backgroundColor, color: acs!.color, fontFamily: acs!.fontFamily }
                        : null,
                    plannerLane: planner
                        ? { backgroundColor: ps!.backgroundColor, color: ps!.color }
                        : null,
                    sampleLink: sampleLink
                        ? { color: ls!.color, textDecoration: ls!.textDecorationLine }
                        : null,
                    sampleButton: primaryBtn
                        ? { backgroundColor: pbs!.backgroundColor, color: pbs!.color, fontFamily: pbs!.fontFamily }
                        : null,
                    nativeRadio: sampleRadio
                        ? {
                              accentColor: rs!.accentColor || rs!.getPropertyValue("accent-color"),
                              className: sampleRadio.className,
                          }
                        : null,
                    stylesheetHints: {
                        styleTags: document.querySelectorAll("style").length,
                        hasSynthBanner: !!document.querySelector("[data-d124-synth-banner]"),
                        tailwindCompiled: document.querySelectorAll("style").length > 0,
                    },
                };
            },
            [route.id, LAYOUT_BODY_CLASS] as const,
        );
        const provPath = path.join(
            process.cwd(),
            "docs/evidence/d124-brand-review/fixture-bundles",
            route.id,
            `capture-provenance-${vp.tag}.json`,
        );
        const sourceManifest = JSON.parse(readFileSync(path.join(bundleDir, "source-manifest.json"), "utf8")) as {
            sourceHashes?: Record<string, string>;
        };
        const reviewSendHash =
            Object.entries(sourceManifest.sourceHashes ?? {}).find(([k]) =>
                k.endsWith("review-send-client.tsx"),
            )?.[1] ?? null;
        writeFileSync(
            provPath,
            JSON.stringify(
                {
                    viewport: vp.tag,
                    capturedAt: new Date().toISOString(),
                    sourceSha: SHA,
                    bundleEntryHash: { "review-send-client.tsx": reviewSendHash },
                    ...provenance,
                },
                null,
                2,
            ),
        );
    }
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