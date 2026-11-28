import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

const OUT = path.join(process.cwd(), "temp-files/d124-brand-review");
const BASE = process.env.D124_BASE_URL ?? "http://127.0.0.1:3010";
const SHA = process.env.D124_SHA ?? "5a65d1b45cea73ea068a9fcf77dc1dc87410aaca";

const ROUTES: { id: string; path: string; authSensitive?: boolean }[] = [
    { id: "landing", path: "/" },
    { id: "product", path: "/product" },
    { id: "pricing", path: "/pricing" },
    { id: "login", path: "/login" },
    { id: "dashboard", path: "/dashboard/home", authSensitive: true },
    { id: "estimate", path: "/dashboard/projects/costs", authSensitive: true },
    { id: "programme", path: "/dashboard/projects/schedule", authSensitive: true },
    { id: "proposal", path: "/dashboard/projects/proposal", authSensitive: true },
];

const VIEWPORTS = [
    { tag: "375", width: 375, height: 812 },
    { tag: "1440", width: 1440, height: 900 },
] as const;

mkdirSync(OUT, { recursive: true });

for (const vp of VIEWPORTS) {
    test.describe(`D124 brand visual @ ${vp.tag}px (SHA ${SHA.slice(0, 8)})`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        for (const route of ROUTES) {
            test(`${route.id} — ${route.path}`, async ({ page }) => {
                const started = route.path;
                await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 60_000 });
                const finalUrl = page.url();
                const pathname = new URL(finalUrl).pathname;

                if (route.authSensitive && !pathname.startsWith(route.path.split("?")[0])) {
                    const note = path.join(OUT, `${route.id}_${vp.tag}_AUTH_BLOCKED.txt`);
                    await page.evaluate(
                        ([label, detail]) => {
                            const el = document.createElement("div");
                            el.setAttribute("data-synthetic", "auth-blocked");
                            el.style.cssText =
                                "position:fixed;inset:0;z-index:99999;background:#0d0d0d;color:#c9efcf;padding:24px;font:600 14px Avenir,sans-serif;";
                            el.textContent = label + " " + detail;
                            document.body.prepend(el);
                        },
                        [
                            "SYNTHETIC D124 — AUTH_BLOCKED (not coverage):",
                            `requested ${started} → final ${pathname}`,
                        ],
                    );
                }

                await page.screenshot({
                    path: path.join(OUT, `${route.id}_${vp.tag}.png`),
                    fullPage: true,
                });
            });
        }
    });
}