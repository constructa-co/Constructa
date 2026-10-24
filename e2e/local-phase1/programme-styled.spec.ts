import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const scope = {
    component: "Actual ProgrammeOverview with the actual bundled programme.module.css",
    plans: "Existing computeProgrammePlan/computeRelativeProgramme over the synthetic A060 SSR inputs; bars from existing programmeStageBar",
    style: "CSS-module computed style and geometry in native Edge; Tailwind/preflight, page background, contrast and pixel sampling NOT_RUN",
    notRun: "Full Next app, Auth/DB, saves, PDF, mobile device, assistive technology, hosted or release acceptance",
};

type Kind = "three-weeks" | "wednesday" | "relative";
const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
// The --overview-* values in src/components/programme.module.css.
const COLOURS = {
    light: { surface: "#f0f3ed", rule: "#d5ded2", bar: "#315c49", barInk: "#ffffff", ink: "#18221a", muted: "#566257" },
    dark: { surface: "#1d2a22", rule: "#3b4b3c", bar: "#83b89a", barInk: "#10291b", ink: "#f2f7ef", muted: "#b8c5b5" },
};
const THEMES = [false, true];
const themeName = (dark: boolean) => (dark ? "dark" : "light");

test.beforeEach(async ({ page, context }) => {
    requests = []; errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Styled programme overview - offline synthetic plan</title></head><body><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    const loaded = await page.evaluate(() => Boolean(window.__programmeStyledLocal));
    if (loaded) expect(await page.evaluate(() => window.__programmeStyledLocal.unchanged())).toBe(true);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function openOverview(page: Page, kind: Kind, dark: boolean, viewport: { width: number; height: number }) {
    await page.setViewportSize(viewport);
    await page.evaluate(value => { window.__programmeStyledOptions = value; }, { kind, dark });
    // Repeated synthetic plans share this page; keep compiler bindings local.
    await page.addScriptTag({ content: `(() => {\n${bundle}\n})()` });
    const overview = page.locator("[data-programme-overview]");
    await expect(overview).toBeVisible();
    return overview;
}

const style = (locator: Locator, property: string) => locator.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

/** Each actual bar against its track and the existing programmeStageBar values. */
async function barGeometry(page: Page) {
    return page.evaluate(() => {
        const { bars } = window.__programmeStyledLocal;
        return [...document.querySelectorAll<HTMLElement>("[data-overview-stage]")].map((row, index) => {
            const track = row.querySelector<HTMLElement>(":scope > div[aria-hidden='true']")!;
            const bar = track.querySelector<HTMLElement>(":scope > div")!;
            const t = track.getBoundingClientRect(), b = bar.getBoundingClientRect();
            return {
                expectedLeft: t.left + (bars[index].leftPct / 100) * track.clientWidth,
                expectedWidth: (bars[index].widthPct / 100) * track.clientWidth,
                left: b.left, width: b.width, height: b.height, trackHeight: t.height,
                trackTop: t.top, trackBottom: t.bottom, trackLeft: t.left, trackRight: t.right,
                barText: bar.textContent,
            };
        });
    });
}

async function expectBarsMatch(page: Page, dark: boolean) {
    const colours = COLOURS[themeName(dark)];
    const geometry = await barGeometry(page);
    expect(geometry.length).toBe(await page.evaluate(() => window.__programmeStyledLocal.plan.stages.length));
    for (const bar of geometry) {
        expect(Math.abs(bar.left - bar.expectedLeft)).toBeLessThanOrEqual(1);
        expect(Math.abs(bar.width - bar.expectedWidth)).toBeLessThanOrEqual(1);
        // inset-block: 4px inside the 38px track.
        expect(bar.trackHeight).toBe(38);
        expect(bar.height).toBe(30);
    }
    const firstBar = page.locator("[data-overview-stage='0'] > div[aria-hidden='true'] > div");
    expect(await style(firstBar, "background-color")).toBe(rgb(colours.bar));
    expect(await style(firstBar, "color")).toBe(rgb(colours.barInk));
    expect(await style(page.locator("[data-overview-stage='0'] > div[aria-hidden='true']"), "background-color")).toBe(rgb(colours.surface));
    return geometry;
}

/** Nothing in the component is clipped or pushed past the viewport. */
async function expectNoOverflow(page: Page, overview: Locator, width: number) {
    const fits = await overview.evaluate((root, viewportWidth) => {
        const box = root.getBoundingClientRect();
        const texts = [...root.querySelectorAll<HTMLElement>("dt, dd, [data-programme-calendar-span], li > div:first-child strong, li > div:first-child > span, p")];
        return {
            root: root.scrollWidth <= root.clientWidth && box.left >= 0 && box.right <= viewportWidth,
            page: document.documentElement.scrollWidth <= viewportWidth,
            texts: texts.filter(el => el.scrollWidth > el.clientWidth || el.getBoundingClientRect().right > box.right + 0.5).map(el => el.textContent),
        };
    }, width);
    expect(fits).toEqual({ root: true, page: true, texts: [] });
}

test("the compiled bundle uses the checkout's actual overview component, CSS module and plan builders", async () => {
    const manifest = JSON.parse(readFileSync(path.join(output, "source-manifest.json"), "utf8")) as { sourceHashes: Record<string, string>; scope: string };
    for (const file of ["src/components/programme-overview.tsx", "src/components/programme.module.css", "src/lib/programme-plan.ts", "src/lib/relative-programme.ts"]) {
        const absolute = path.join(process.cwd(), file);
        expect(manifest.sourceHashes[absolute], file).toBe(createHash("sha256").update(readFileSync(absolute, "utf8")).digest("hex"));
    }
    expect(manifest.scope).toContain("Actual ProgrammeOverview with actual programme CSS module");
});

for (const dark of THEMES) {
    test(`${themeName(dark)} desktop: three working weeks show a 19-day calendar span over a continuous lane aligned with the bars`, async ({ page }) => {
        const colours = COLOURS[themeName(dark)];
        const overview = await openOverview(page, "three-weeks", dark, { width: 1280, height: 900 });
        expect(await page.evaluate(() => [window.__programmeStyledLocal.plan.calendar_days, window.__programmeStyledLocal.plan.working_days])).toEqual([19, 15]);
        const span = page.locator("[data-programme-calendar-span]");
        await expect(span).toBeVisible();
        await expect(span).toContainText("Calendar span: 19 calendar days");
        await expect(span).toContainText("15 working days.");
        expect(await style(span, "color")).toBe(rgb(colours.muted));
        expect(await style(span, "font-size")).toBe("13px");
        expect(await style(overview, "color")).toBe(rgb(colours.ink));

        // Desktop lane: a gradient whose surface starts exactly where the tracks start.
        const rows = page.getByRole("list", { name: "Programme activities" });
        await expect(rows).toHaveAttribute("data-calendar-axis", "true");
        const backdrop = await style(rows, "background-image");
        expect(backdrop).toContain("linear-gradient");
        expect(backdrop).toContain(rgb(colours.surface));
        const geometry = await expectBarsMatch(page, dark);
        const lane = await rows.evaluate(el => {
            const box = el.getBoundingClientRect();
            return { left: box.left, width: box.width, top: box.top, bottom: box.bottom };
        });
        for (const track of geometry) {
            expect(Math.abs(track.trackLeft - lane.left - ((lane.width - 24) / 3 + 24))).toBeLessThanOrEqual(1);
            expect(Math.abs(track.trackRight - (lane.left + lane.width))).toBeLessThanOrEqual(1);
        }
        // The spacing between tracks lies inside the lane, so the surface runs through it.
        for (let i = 1; i < geometry.length; i++) {
            expect(geometry[i].trackTop - geometry[i - 1].trackBottom).toBeGreaterThan(0);
            expect(geometry[i - 1].trackBottom).toBeGreaterThan(lane.top);
            expect(geometry[i].trackTop).toBeLessThan(lane.bottom);
        }
        await expectNoOverflow(page, overview, 1280);
        await page.screenshot({ path: path.join(output, `programme-styled-desktop-${themeName(dark)}.png`) });
    });

    test(`${themeName(dark)} 390px: dated spans stay readable over a solid lane with bars at their computed geometry`, async ({ page }) => {
        const colours = COLOURS[themeName(dark)];
        for (const [kind, calendar, working, stages] of [["three-weeks", 19, 15, 3], ["wednesday", 7, 5, 1]] as const) {
            await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Styled programme overview - offline synthetic plan</title></head><body><div id="app"></div></body></html>');
            await page.addStyleTag({ content: css });
            const overview = await openOverview(page, kind, dark, { width: 390, height: 844 });
            const span = page.locator("[data-programme-calendar-span]");
            await expect(span).toContainText(`Calendar span: ${calendar} calendar days`);
            await expect(span).toContainText(`${working} working days.`);
            await expect(page.locator("[data-overview-stage]")).toHaveCount(stages);

            // Narrow rules: the lane becomes a solid surface and each row stacks.
            const rows = page.getByRole("list", { name: "Programme activities" });
            expect(await style(rows, "background-image")).toBe("none");
            expect(await style(rows, "background-color")).toBe(rgb(colours.surface));
            expect(await style(page.locator("[data-overview-stage='0']"), "grid-template-columns").then(value => value.trim().split(/\s+/).length)).toBe(1);
            expect(await page.locator("[data-programme-overview] > div[aria-hidden='true'] > span").evaluate(el => getComputedStyle(el).display)).toBe("none");
            const geometry = await expectBarsMatch(page, dark);
            const label = await page.locator("[data-overview-stage='0'] > div:first-child").boundingBox();
            expect(label!.y + label!.height).toBeLessThanOrEqual(geometry[0].trackTop + 0.5);
            if (kind === "wednesday") {
                expect(Math.abs(geometry[0].left - geometry[0].trackLeft)).toBeLessThanOrEqual(1);
                expect(Math.abs(geometry[0].width - (geometry[0].trackRight - geometry[0].trackLeft))).toBeLessThanOrEqual(1);
            }
            await expectNoOverflow(page, overview, 390);
            expect(await page.evaluate(() => window.__programmeStyledLocal.unchanged())).toBe(true);
            await page.screenshot({ path: path.join(output, `programme-styled-390-${kind}-${themeName(dark)}.png`), fullPage: true });
        }
    });

    test(`${themeName(dark)} 390px: an undated plan has no calendar annotation or lane backdrop and keeps its working-day bars`, async ({ page }) => {
        const overview = await openOverview(page, "relative", dark, { width: 390, height: 844 });
        await expect(page.locator("[data-programme-calendar-span]")).toHaveCount(0);
        await expect(overview).not.toContainText("Calendar span:");
        await expect(overview).not.toContainText("weekend");
        await expect(overview).toContainText("Start date not agreed");
        await expect(overview).toContainText("Day 1 to Day 3");
        await expect(overview).toContainText("Day 4 to Day 8");
        const rows = page.getByRole("list", { name: "Programme activities" });
        await expect(rows).not.toHaveAttribute("data-calendar-axis", /.*/);
        expect(await style(rows, "background-image")).toBe("none");
        expect(await style(rows, "background-color")).toBe("rgba(0, 0, 0, 0)");
        expect(await page.evaluate(() => window.__programmeStyledLocal.bars)).toEqual([{ leftPct: 0, widthPct: 37.5 }, { leftPct: 37.5, widthPct: 62.5 }]);
        await expectBarsMatch(page, dark);
        await expectNoOverflow(page, overview, 390);
        await page.screenshot({ path: path.join(output, `programme-styled-390-relative-${themeName(dark)}.png`), fullPage: true });
    });
}
