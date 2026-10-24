import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalDetailedGeometryFixture } from "./detailed-geometry-entry";

// A059: the actual detailed planner's week grid and bars, measured against its
// own grid lane under the actual compiled Tailwind stylesheet, on the current
// five-day basis. Build with `build-brief-price.mjs <out> detailed-geometry`
// (A059-DETAILED-GEOMETRY-0035 compiler hunk). Expected facts are worked out
// by hand on the same Mon-Fri calendar and written as literals; the policy
// (minimum four-week axis, whole-week display rounding, grouping) is unchanged.
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    component: "REAL ClientSchedulePage mounted over synthetic saved five-day phases",
    styles: "Actual compiled Tailwind (globals.css + tailwind.config.js, installed v3), as the A003 leg",
    transport: "Planner actions recorded and REFUSED; 5-day localStorage stand-in",
    notClaimed: "Non-five-day weeks, legacy timelines, drag behaviour, phone layout, served page, hosted, Auth/DB, save",
};
// Tailwind v3 default palette for the first three PHASE_COLORS.
const FILLS = ["rgb(59, 130, 246)", "rgb(16, 185, 129)", "rgb(249, 115, 22)"];
const ROW_H = 52, BAR_H = 30, BAR_PAD = 11; // client-page.tsx constants
const NEAR = 0.6; // px: percentage geometry resolves to sub-pixel layout units

type Box = { left: number; top: number; width: number; height: number };
interface Measured {
    lane: Box;
    gridLines: Array<{ week: number; left: number; borderLeft: string; position: string }>;
    headers: Array<{ start: number; span: number; left: number; width: number; label: string; date: string; range: string }>;
    rows: Box[];
    bars: Array<{ wrapper: Box; fill: Box; tick: Box; move: Box; resize: Box; position: string; background: string; radius: string; label: string }>;
}

const measure = (page: Page): Promise<Measured> => page.evaluate(() => {
    const box = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
    const all = (selector: string) => Array.from(document.querySelectorAll(selector));
    const lane = document.querySelector('[data-planner-grid-week="1"]')!.parentElement!;
    return {
        lane: box(lane),
        gridLines: all("[data-planner-grid-week]").map(line => ({
            week: Number(line.getAttribute("data-planner-grid-week")), left: box(line).left,
            borderLeft: getComputedStyle(line).borderLeftWidth, position: getComputedStyle(line).position,
        })),
        headers: all("[data-planner-week-start]").map(cell => ({
            start: Number(cell.getAttribute("data-planner-week-start")), span: Number(cell.getAttribute("data-planner-week-span")),
            left: box(cell).left, width: box(cell).width,
            label: cell.children[0]!.textContent!, date: cell.children[1]!.textContent!, range: cell.getAttribute("aria-label")!,
        })),
        // Each left-panel row holds one stage-name input.
        rows: all("input:not([type])").filter(input => (input as HTMLInputElement).value.startsWith("TEST DATA - "))
            .map(input => box(input.closest('div[style*="height"]')!)),
        bars: all("[data-planner-duration]").map(fill => {
            const wrapper = fill.parentElement!;
            const index = fill.getAttribute("data-planner-duration");
            const part = (name: string) => box(wrapper.querySelector(`[data-planner-${name}="${index}"]`)!);
            const style = getComputedStyle(fill);
            return {
                wrapper: box(wrapper), fill: box(fill), tick: part("start-marker"), move: part("move-target"), resize: part("resize-target"),
                position: getComputedStyle(wrapper).position, background: style.backgroundColor, radius: style.borderTopLeftRadius,
                label: fill.textContent!.trim(),
            };
        }),
    };
});

async function open(page: Page, plan: LocalDetailedGeometryFixture["plan"]) {
    await page.evaluate(value => { window.__detailedGeometryOptions = { plan: value }; }, plan);
    await page.addScriptTag({ content: bundle });
    await expect(page.locator("[data-planner-duration]")).toHaveCount(plan === "short" ? 3 : 2);
}

/** Every bar sits on its own row at its dated offset and calendar span, as fractions of the actual grid lane. */
function expectBars(m: Measured, axisDays: number, spans: Array<{ offset: number; days: number; label: string }>) {
    const x = (days: number) => m.lane.left + (days / axisDays) * m.lane.width;
    expect(m.bars).toHaveLength(spans.length);
    spans.forEach((span, index) => {
        const bar = m.bars[index]!;
        const name = `bar ${index}`;
        expect(bar.position, name).toBe("absolute");
        expect(bar.background, name).toBe(FILLS[index]);
        expect(bar.radius, name).toBe("6px");
        expect(bar.label, name).toBe(span.label);
        expect(Math.abs(bar.wrapper.left - x(span.offset)), name).toBeLessThan(NEAR);
        expect(Math.abs(bar.wrapper.width - (span.days / axisDays) * m.lane.width), name).toBeLessThan(NEAR);
        expect(Math.abs(bar.wrapper.top - (m.lane.top + index * ROW_H + BAR_PAD)), name).toBeLessThan(NEAR);
        expect(Math.abs(bar.wrapper.height - BAR_H), name).toBeLessThan(NEAR);
        // The duration fill is exactly the dated span: never widened by the move target or the grip.
        for (const side of ["left", "top", "width", "height"] as const) expect(Math.abs(bar.fill[side] - bar.wrapper[side]), `${name} fill ${side}`).toBeLessThan(NEAR);
        expect(Math.abs(bar.tick.left - bar.wrapper.left), `${name} tick`).toBeLessThan(NEAR);
        expect(Math.abs(bar.tick.width - 1), `${name} tick`).toBeLessThan(NEAR);
        expect(Math.abs(bar.move.width - Math.max(24, bar.wrapper.width)), `${name} move`).toBeLessThan(NEAR);
        expect(Math.abs(bar.resize.width - 12), `${name} grip`).toBeLessThan(NEAR);
        expect(Math.abs(bar.resize.left + bar.resize.width - (bar.wrapper.left + bar.wrapper.width)), `${name} grip`).toBeLessThan(NEAR);
        // The left-panel row for the same stage lines up with its bar's row.
        expect(Math.abs(m.rows[index]!.top - (m.lane.top + index * ROW_H)), `${name} row`).toBeLessThan(NEAR);
        expect(Math.abs(m.rows[index]!.height - ROW_H), `${name} row`).toBeLessThan(NEAR);
    });
}

/** Grid lines sit at their week's fraction of the lane, and each header column starts over its line. */
function expectGrid(m: Measured, totalWeeks: number, groups: Array<{ start: number; span: number; label: string; date: string; range: string }>) {
    expect(m.lane.width).toBeGreaterThan(400);
    expect(m.gridLines.map(line => line.week)).toEqual(groups.map(group => group.start));
    for (const line of m.gridLines) {
        expect(line.position).toBe("absolute");
        expect(line.borderLeft).toBe("1px");
        expect(Math.abs(line.left - (m.lane.left + ((line.week - 1) / totalWeeks) * m.lane.width)), `grid ${line.week}`).toBeLessThan(NEAR);
    }
    expect(m.headers.map(({ start, span, label, date, range }) => ({ start, span, label, date, range }))).toEqual(groups);
    m.headers.forEach((header, index) => {
        // The header row has no counterpart to the body's left-panel border, so its lane may be up to 1px wider.
        expect(Math.abs(header.left - m.gridLines[index]!.left), `header ${header.start}`).toBeLessThanOrEqual(1.5);
        expect(Math.abs(header.width - (header.span / totalWeeks) * m.lane.width), `header ${header.start}`).toBeLessThanOrEqual(1.5);
    });
}

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local A059 detailed planner geometry</title></head><body><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    const plannerCalls = await page.evaluate(() => window.__detailedGeometryLocal?.plannerCalls ?? null);
    expect(plannerCalls).toEqual([]);
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    const measured = await measure(page).catch(() => null);
    await info.attach("scope", { body: JSON.stringify({ ...scope, plannerCalls, measured, requests, pageErrors }), contentType: "application/json" });
});

test("within the minimum four-week axis, a one-working-day stage is one calendar day of the lane, on its weekday", async ({ page }) => {
    await open(page, "short");
    // Legacy whole-week end 23 days -> 4 weeks (the minimum) -> 28-day axis.
    // Dated stages: Mon 2 Nov (1 day), Mon 9-Tue 17 Nov (9 calendar days), Wed 18-Fri 20 Nov (3).
    await expect(page.getByText("15 working days / 19 calendar days", { exact: true })).toBeVisible();
    for (const dates of ["2 Nov – 2 Nov", "9 Nov – 17 Nov", "18 Nov – 20 Nov"]) await expect(page.getByText(dates, { exact: true })).toBeVisible();
    await expect(page.getByText(/Grid columns group up to/)).toHaveCount(0);

    const m = await measure(page);
    expectGrid(m, 4, [
        { start: 1, span: 1, label: "W1", date: "2 Nov", range: "W1: 2026-11-02 to 2026-11-08" },
        { start: 2, span: 1, label: "W2", date: "9 Nov", range: "W2: 2026-11-09 to 2026-11-15" },
        { start: 3, span: 1, label: "W3", date: "16 Nov", range: "W3: 2026-11-16 to 2026-11-22" },
        { start: 4, span: 1, label: "W4", date: "23 Nov", range: "W4: 2026-11-23 to 2026-11-29" },
    ]);
    expectBars(m, 28, [
        { offset: 0, days: 1, label: "1d" },
        { offset: 7, days: 9, label: "7d" },
        { offset: 16, days: 3, label: "3d" },
    ]);
    // The one-day bar is one seventh of the first week column, and the next stage starts exactly on the W2 line.
    expect(Math.abs(m.bars[0]!.fill.width * 7 - (m.gridLines[1]!.left - m.gridLines[0]!.left))).toBeLessThan(NEAR * 7);
    expect(Math.abs(m.bars[1]!.wrapper.left - m.gridLines[1]!.left)).toBeLessThan(NEAR);
});

test("on a grouped fifteen-week axis, a later one-day Wednesday stage is still one calendar day wide, narrower than its move target", async ({ page }) => {
    await open(page, "long");
    // Legacy whole-week end: 93 + 7 = 100 days -> 15 weeks -> 105-day axis, grouped two weeks per column.
    // Dated stages: Mon 2 Nov-Fri 22 Jan (60 working days, 82 calendar days), Wed 3 Feb (offset 93, 1 day).
    await expect(page.getByText("68 working days / 94 calendar days", { exact: true })).toBeVisible();
    for (const dates of ["2 Nov – 22 Jan", "3 Feb – 3 Feb"]) await expect(page.getByText(dates, { exact: true })).toBeVisible();
    await expect(page.getByText("Grid columns group up to 2 calendar weeks; the last column may be shorter. Weekly move and resize snapping is unchanged.", { exact: true })).toBeVisible();

    const m = await measure(page);
    expectGrid(m, 15, [
        { start: 1, span: 2, label: "W1-W2", date: "2 Nov", range: "W1-W2: 2026-11-02 to 2026-11-15" },
        { start: 3, span: 2, label: "W3-W4", date: "16 Nov", range: "W3-W4: 2026-11-16 to 2026-11-29" },
        { start: 5, span: 2, label: "W5-W6", date: "30 Nov", range: "W5-W6: 2026-11-30 to 2026-12-13" },
        { start: 7, span: 2, label: "W7-W8", date: "14 Dec", range: "W7-W8: 2026-12-14 to 2026-12-27" },
        { start: 9, span: 2, label: "W9-W10", date: "28 Dec", range: "W9-W10: 2026-12-28 to 2027-01-10" },
        { start: 11, span: 2, label: "W11-W12", date: "11 Jan", range: "W11-W12: 2027-01-11 to 2027-01-24" },
        { start: 13, span: 2, label: "W13-W14", date: "25 Jan", range: "W13-W14: 2027-01-25 to 2027-02-07" },
        { start: 15, span: 1, label: "W15", date: "8 Feb", range: "W15: 2027-02-08 to 2027-02-14" },
    ]);
    expectBars(m, 105, [
        { offset: 0, days: 82, label: "60d" },
        { offset: 93, days: 1, label: "1d" },
    ]);
    // Short bar: the fill is one 105th of the lane, below the 24px move target, and starts two days after the W14 week begins.
    const short = m.bars[1]!;
    expect(short.fill.width).toBeLessThan(24);
    expect(short.move.width).toBeGreaterThan(short.fill.width);
    const weekWidth = m.lane.width / 15;
    expect(Math.abs(short.wrapper.left - (m.gridLines[6]!.left + weekWidth + (2 / 7) * weekWidth))).toBeLessThan(NEAR);
});
