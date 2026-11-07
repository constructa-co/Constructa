import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(output, "source-manifest.json"), "utf8")) as {
    sourceHashes: Record<string, string>;
    scope: string;
};

let requests: string[] = [];
let pageErrors: string[] = [];

const WCAG_AA = 4.5;
const THEMES = ["system-c", "dark"] as const;

const scope = {
    components: "REAL ThemeProvider, SidebarNav, MarketingHeader, PhaseOneHome, MarketingFooter",
    styles: "Compiled Tailwind globals + tailwind.config + actual CSS modules (phase-one.module.css)",
    transport: "Offline CSP, route abort, synthetic router/path/search, form submit refused",
    notClaimed: "Hosted journey, Auth/DB, physical device certification, universal WCAG sign-off, gradient-backed hero copy",
    manifestScope: manifest.scope,
    cssBytes: css.length,
    bundleSha256: createHash("sha256").update(bundle).digest("hex"),
    cssSha256: createHash("sha256").update(css).digest("hex"),
};

type MeasureResult =
    | { state: "solid"; fontSizePx: number; fontWeight: string; color: string; background: string; ratio: number; opacity: number }
    | { state: "bounded"; reason: string; fontSizePx: number; color: string; backgroundImage?: string };

async function measureReadableText(locator: Locator): Promise<MeasureResult> {
    return locator.evaluate(element => {
        const parse = (color: string) => {
            const hex = color.match(/^#([0-9a-f]{6})$/i);
            if (hex) {
                const n = parseInt(hex[1], 16);
                return [n >> 16, (n >> 8) & 255, n & 255];
            }
            const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
            if (!rgb) return null;
            const alpha = rgb[4] !== undefined ? Number(rgb[4]) : 1;
            if (alpha <= 0.01) return null;
            return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
        };
        const composite = (fg: number[], bg: number[], fgAlpha: number) =>
            fg.map((c, i) => Math.round(fgAlpha * c + (1 - fgAlpha) * bg[i]));

        let node: Element | null = element;
        let fg = parse(getComputedStyle(element).color);
        const opacity = Number.parseFloat(getComputedStyle(element).opacity) || 1;
        const fontSizePx = Number.parseFloat(getComputedStyle(element).fontSize);
        const fontWeight = getComputedStyle(element).fontWeight;
        if (!fg) return { state: "bounded", reason: "unparsed foreground", fontSizePx, color: getComputedStyle(element).color };

        while (node) {
            const style = getComputedStyle(node);
            if (style.backgroundImage && style.backgroundImage !== "none") {
                return {
                    state: "bounded",
                    reason: "non-uniform background (gradient/image)",
                    fontSizePx,
                    color: getComputedStyle(element).color,
                    backgroundImage: style.backgroundImage,
                };
            }
            const bg = parse(style.backgroundColor);
            if (bg) {
                const blended = opacity < 1 ? composite(fg, bg, opacity) : fg;
                const lum = (rgb: number[]) => {
                    const channel = (value: number) => {
                        const c = value / 255;
                        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
                    };
                    return channel(rgb[0]) * 0.2126 + channel(rgb[1]) * 0.7152 + channel(rgb[2]) * 0.0722;
                };
                const ratio = (() => {
                    const a = lum(blended);
                    const b = lum(bg);
                    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
                })();
                return {
                    state: "solid",
                    fontSizePx,
                    fontWeight,
                    color: getComputedStyle(element).color,
                    background: style.backgroundColor,
                    ratio,
                    opacity,
                };
            }
            node = node.parentElement;
        }
        return { state: "bounded", reason: "no opaque ancestor background", fontSizePx, color: getComputedStyle(element).color };
    });
}

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local A111 readability</title></head><body><div id="app"></div></body></html>',
    );
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("a111-scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
});

async function mount(
    page: Page,
    theme: (typeof THEMES)[number],
    pathname = "/dashboard",
    searchParams: Record<string, string> = {},
    layout: "desktop" | "phone" = "desktop",
    region: "both" | "sidebar" | "marketing" = "both",
) {
    await page.evaluate(
        ({ themeValue, pathValue, params, regionValue }) => {
            window.__a111ReadabilityOptions = { theme: themeValue, pathname: pathValue, searchParams: params, region: regionValue };
        },
        { themeValue: theme, pathValue: pathname, params: searchParams, regionValue: region },
    );
    await page.addScriptTag({ content: bundle });
    if (region === "both" || region === "sidebar") {
        if (layout === "desktop") await expect(page.locator("aside").first()).toBeVisible();
        else await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    }
    if (region === "both" || region === "marketing") {
        await expect(page.getByRole("heading", { name: /Good work\./i })).toBeVisible();
    }
}

for (const theme of THEMES) {
    test(`${theme}: sidebar section label meets contrast on solid #0d0d0d (collapsed + expanded)`, async ({ page }) => {
        await mount(page, theme, "/dashboard", {}, "desktop", "sidebar");
        const sectionButton = page.getByRole("button", { name: "Company Profile" });
        await expect(sectionButton).toHaveAttribute("aria-expanded", "false");
        let measure = await measureReadableText(sectionButton.locator("span").first());
        expect(measure.state).toBe("solid");
        if (measure.state === "solid") {
            expect(measure.fontSizePx).toBeGreaterThanOrEqual(11.5);
            expect(measure.ratio).toBeGreaterThanOrEqual(WCAG_AA);
        }
        await sectionButton.click();
        await expect(sectionButton).toHaveAttribute("aria-expanded", "true");
        measure = await measureReadableText(sectionButton.locator("span").first());
        expect(measure.state).toBe("solid");
        if (measure.state === "solid") expect(measure.ratio).toBeGreaterThanOrEqual(WCAG_AA);
        await test.info().attach(`${theme}-sidebar-section`, { body: JSON.stringify(measure), contentType: "application/json" });
    });

    test(`${theme}: sidebar idle nav label meets contrast`, async ({ page }) => {
        await mount(page, theme, "/dashboard/projects/brief", { projectId: "local-a111-job" }, "desktop", "sidebar");
        await page.getByRole("button", { name: "Work Winning" }).click();
        const pipeline = page.getByRole("link", { name: "Pipeline" });
        await expect(pipeline).toBeVisible();
        const measure = await measureReadableText(pipeline);
        expect(measure.state).toBe("solid");
        if (measure.state === "solid") expect(measure.ratio).toBeGreaterThanOrEqual(WCAG_AA);
    });
}

test("phone 390: drawer section label contrast with menu open", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(page, "system-c", "/dashboard", {}, "phone", "sidebar");
    await page.locator('button[aria-controls="phone-menu"]').click();
    await expect(page.locator("#phone-menu")).toBeVisible();
    const drawer = page.locator("#phone-menu");
    const label = drawer.getByText("Active Project", { exact: true });
    await expect(label).toBeVisible();
    const measure = await measureReadableText(label);
    expect(measure.state).toBe("solid");
    if (measure.state === "solid") {
        expect(measure.fontSizePx).toBeGreaterThanOrEqual(11.5);
        expect(measure.ratio).toBeGreaterThanOrEqual(WCAG_AA);
    }
});

test("marketing: paper supporting text on solid paper background", async ({ page }) => {
    await mount(page, "system-c", "/dashboard", {}, "desktop", "marketing");
    const intro = page.getByText("Kitchen refurbishment", { exact: false });
    const measure = await measureReadableText(intro);
    expect(measure.state).toBe("solid");
    if (measure.state === "solid") {
        expect(measure.fontSizePx).toBeGreaterThanOrEqual(12);
        expect(measure.ratio).toBeGreaterThanOrEqual(WCAG_AA);
    }
});

test("marketing: journey supporting small text on solid journey panel", async ({ page }) => {
    await mount(page, "system-c", "/dashboard", {}, "desktop", "marketing");
    const detail = page.getByText("Company details, your story and case studies.", { exact: true });
    const measure = await measureReadableText(detail);
    expect(measure.state).toBe("solid");
    if (measure.state === "solid") {
        expect(measure.fontSizePx).toBeGreaterThanOrEqual(13);
        expect(measure.ratio).toBeGreaterThanOrEqual(WCAG_AA);
    }
});

test("marketing: hero review note substrate is gradient-bounded (not falsely certified)", async ({ page }) => {
    await mount(page, "system-c", "/dashboard", {}, "desktop", "marketing");
    const note = page.getByText("Phase one review · Built for domestic and commercial contractors", { exact: true });
    const measure = await measureReadableText(note);
    expect(measure.state).toBe("bounded");
    await test.info().attach("hero-review-note", { body: JSON.stringify(measure), contentType: "application/json" });
});

test("marketing: focus-visible records accent outline on text link", async ({ page }) => {
    await mount(page, "system-c", "/dashboard", {}, "desktop", "marketing");
    const link = page.getByRole("link", { name: /See how it connects/i });
    await link.focus();
    const outline = await link.evaluate(el => getComputedStyle(el).outlineColor);
    expect(outline).not.toBe("rgba(0, 0, 0, 0)");
});
