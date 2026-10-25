import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MouseEvent } from "react";
import type { PlannerPhase } from "@/lib/planner-phases";

const hooks = vi.hoisted(() => ({
    refs: [] as Array<{ current: unknown }>,
    effects: [] as Array<() => void | (() => void)>,
    callbacks: [] as Array<(event: MouseEvent, index: number, type: "move" | "resize") => void>,
    updates: [] as unknown[],
    write: vi.fn(),
    read: vi.fn(),
}));
vi.mock("react", async importOriginal => {
    const original = await importOriginal<typeof import("react")>();
    return {
        ...original,
        useRef: (initial: unknown) => {
            const ref = original.useRef(initial);
            hooks.refs.push(ref);
            return ref;
        },
        useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
        useCallback: (callback: typeof hooks.callbacks[number]) => {
            hooks.callbacks.push(callback);
            return callback;
        },
        useState: (initial: unknown) => {
            const [value] = original.useState(initial);
            return [value, (next: unknown) => hooks.updates.push(typeof next === "function" ? next(value) : next)];
        },
    };
});
vi.mock("./actions", () => ({
    updatePhasesAction: hooks.write,
    saveProgrammePhasesAction: hooks.write,
    getEstimatePhasesAction: hooks.read,
}));
vi.mock("./programme-ai-update", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ClientSchedulePage from "./client-page";

const phase = (offset: number, days = 5): PlannerPhase => ({
    name: `Activity ${offset}`, calculatedDays: days, manualDays: days, manhours: 0, startOffset: offset,
});
const stages = [phase(0), phase(7), phase(14)];

function render(phases = stages) {
    return renderToStaticMarkup(<ClientSchedulePage
        project={{ id: "axis-check", name: "Example", start_date: "2026-10-19", programme_phases: phases }}
        projectId="axis-check" estimate={null}
    />);
}
function barStyles(html: string) {
    return [...html.matchAll(/class="absolute flex items-center[^"]*" style="([^"]+)"/g)].map(match => {
        const style = match[1];
        return { left: Number(/(?:^|;)left:([\d.]+)%/.exec(style)?.[1]), width: Number(/(?:^|;)width:([\d.]+)%/.exec(style)?.[1]) };
    });
}
const cleanups: Array<() => void> = [];
beforeEach(() => {
    hooks.refs = []; hooks.effects = []; hooks.callbacks = []; hooks.updates = [];
    hooks.write.mockClear(); hooks.read.mockClear();
    vi.useFakeTimers();
});
afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
    expect(hooks.write).not.toHaveBeenCalled();
    expect(hooks.read).not.toHaveBeenCalled();
    vi.useRealTimers(); vi.unstubAllGlobals();
});

describe("detailed planner calendar-axis geometry", () => {
    it.each(["move", "resize"] as const)(
        "restores a saved Wednesday one-day stage after %s drag away then back to the starting mouse X",
        type => {
            const saved = [phase(2, 1)];
            const before = JSON.stringify(saved);
            render(saved);
            const listeners = new Map<string, (event: { clientX: number }) => void>();
            vi.stubGlobal("document", {
                addEventListener: (name: string, callback: (event: { clientX: number }) => void) => listeners.set(name, callback),
                removeEventListener: (name: string) => listeners.delete(name),
            });
            for (const effect of hooks.effects) {
                const cleanup = effect();
                if (cleanup) cleanups.push(cleanup);
            }
            hooks.refs[0].current = { getBoundingClientRect: () => ({ width: 280 }) };
            const originX = 100;
            hooks.callbacks[0]({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: originX } as unknown as MouseEvent, 0, type);
            listeners.get("mousemove")!({ clientX: 140 });
            const phaseUpdates = hooks.updates.filter((value): value is PlannerPhase[] => Array.isArray(value));
            const midway = phaseUpdates.at(-1)!;
            if (type === "move") {
                expect(midway[0].startOffset).not.toBe(2);
            } else {
                expect(midway[0].manualDays).not.toBe(1);
            }
            listeners.get("mousemove")!({ clientX: originX });
            listeners.get("mouseup")!({ clientX: originX });
            const finalUpdate = hooks.updates.filter((value): value is PlannerPhase[] => Array.isArray(value)).at(-1);
            expect(finalUpdate).toEqual(saved);
            expect(phaseUpdates.some(value => JSON.stringify(value) !== before)).toBe(true);
            expect(saved).toEqual([phase(2, 1)]);
            expect(JSON.stringify(saved)).toBe(before);
        },
    );

    it.each(["move", "resize"] as const)("leaves a saved Wednesday one-day stage unchanged on zero horizontal %s movement", type => {
        const saved = [phase(2, 1)];
        render(saved);
        const listeners = new Map<string, (event: { clientX: number }) => void>();
        vi.stubGlobal("document", {
            addEventListener: (name: string, callback: (event: { clientX: number }) => void) => listeners.set(name, callback),
            removeEventListener: (name: string) => listeners.delete(name),
        });
        for (const effect of hooks.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
        hooks.refs[0].current = { getBoundingClientRect: () => ({ width: 280 }) };
        hooks.callbacks[0]({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 100 } as unknown as MouseEvent, 0, type);
        listeners.get("mousemove")!({ clientX: 100 });
        listeners.get("mouseup")!({ clientX: 100 });
        const phaseUpdates = hooks.updates.filter((value): value is PlannerPhase[] => Array.isArray(value));
        expect(phaseUpdates.every(value => JSON.stringify(value) === JSON.stringify(saved))).toBe(true);
        expect(saved).toEqual([phase(2, 1)]);
    });

    it("places three weeks in the first three of the four displayed week columns", () => {
        const before = JSON.stringify(stages);
        const html = render();
        expect(barStyles(html)).toEqual([{ left: 0, width: 5 / 28 * 100 }, { left: 25, width: 5 / 28 * 100 }, { left: 50, width: 5 / 28 * 100 }]);
        expect(html).toContain('style="width:25%"');
        expect(JSON.stringify(stages)).toBe(before);
        // Grid slots stay weekly; the finish is the proposal's inclusive working-day date.
        expect(html).toContain("6 Nov 26");
    });

    it("keeps a single week inside the first quarter, not stretched across the chart", () => {
        expect(barStyles(render([phase(0)]))).toEqual([{ left: 0, width: 5 / 28 * 100 }]);
    });

    it("uses the same scale when the plan extends beyond the minimum four weeks", () => {
        const bars = barStyles(render([phase(0), phase(35)]));
        expect(bars[0].width).toBeCloseTo(5 / 42 * 100);
        expect(bars[1].left).toBeCloseTo(500 / 6);
        expect(bars[1].left + bars[1].width).toBeCloseTo(40 / 42 * 100);
    });

    it("keeps long-plan headers on their actual scale across the whole axis", () => {
        const html = render([phase(0), phase(413)]);
        expect([...html.matchAll(/data-planner-week-start=/g)]).toHaveLength(12);
        expect(html).toContain(`style="width:${5 / 60 * 100}%"`);
        expect(barStyles(html)[1].left).toBeCloseTo(413 / 420 * 100);
    });

    it("puts dependency endpoints on the inclusive dated finish and next saved start", () => {
        const html = render([phase(0), { ...phase(7), dependsOn: [0] }, phase(14)]);
        expect(html).toContain(`d="M ${5 / 28 * 1000} 26 C ${(5 / 28 * 1000 + 250) / 2} 26 ${(5 / 28 * 1000 + 250) / 2} 78 250 78"`);
    });

    it.each(["move", "resize"] as const)("uses the displayed axis for controlled %s input", type => {
        render();
        const listeners = new Map<string, (event: { clientX: number }) => void>();
        vi.stubGlobal("document", {
            addEventListener: (name: string, callback: (event: { clientX: number }) => void) => listeners.set(name, callback),
            removeEventListener: (name: string) => listeners.delete(name),
        });
        for (const effect of hooks.effects) {
            const cleanup = effect();
            if (cleanup) cleanups.push(cleanup);
        }
        hooks.refs[0].current = { getBoundingClientRect: () => ({ width: 280 }) };
        hooks.callbacks[0]({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 0 } as unknown as MouseEvent, 1, type);
        listeners.get("mousemove")!({ clientX: 40 });
        const updated = hooks.updates.findLast((value): value is PlannerPhase[] => Array.isArray(value));
        expect(updated?.[1]).toMatchObject(type === "move" ? { startOffset: 14 } : { manualDays: 10 });
    });
});

describe("bounded whole-axis calendar week labels", () => {
    function headers(html: string) {
        return [...html.matchAll(/<div data-planner-week-start="(\d+)" data-planner-week-span="(\d+)"[^>]*style="width:([\d.]+)%"/g)]
            .map(match => ({ start: Number(match[1]), span: Number(match[2]), width: Number(match[3]) }));
    }
    function grid(html: string) {
        return [...html.matchAll(/data-planner-grid-week="(\d+)"[^>]*style="left:([\d.]+)%"/g)]
            .map(match => ({ start: Number(match[1]), left: Number(match[2]) }));
    }
    it.each([4, 6, 12, 13, 52, 53, 60, 200, 400])("covers all %i calendar weeks with bounded contiguous labels and matching grid", weeks => {
        const phases = [phase(0), phase((weeks - 1) * 7)], before = JSON.stringify(phases);
        const html = render(phases), labels = headers(html), lines = grid(html);
        expect(labels.length).toBeGreaterThan(0); expect(labels.length).toBeLessThanOrEqual(12);
        expect(labels[0].start).toBe(1);
        expect(labels.at(-1)!.start + labels.at(-1)!.span - 1).toBe(weeks);
        expect(labels.reduce((n, label) => n + label.span, 0)).toBe(weeks);
        expect(labels.reduce((n, label) => n + label.width, 0)).toBeCloseTo(100);
        expect(lines).toHaveLength(labels.length);
        labels.forEach((label, index) => {
            expect(label.width).toBeCloseTo(label.span / weeks * 100);
            expect(lines[index].start).toBe(label.start);
            expect(lines[index].left).toBeCloseTo((label.start - 1) / weeks * 100);
            if (index > 0) expect(label.start).toBe(labels[index - 1].start + labels[index - 1].span);
        });
        expect(JSON.stringify(phases)).toBe(before);
        // Only the label density changes, not the existing bar/axis scale.
        expect(barStyles(html)[1].left).toBeCloseTo((weeks - 1) / weeks * 100);
    });
    it("keeps short programme week labels and their Monday dates", () => {
        const html = render();
        expect(headers(html)).toEqual([1, 2, 3, 4].map(start => ({ start, span: 1, width: 25 })));
        expect(html).toContain('title="W1: 2026-10-19 to 2026-10-25"');
        expect(html).toContain('title="W4: 2026-11-09 to 2026-11-15"');
        expect(html).not.toContain("Grid columns group");
    });
    it("shows exact week/date range labels through the end,including a shorter last column", () => {
        const html = render([phase(0), phase(52 * 7)]), labels = headers(html);
        expect(labels).toHaveLength(11);
        expect(labels.at(-1)).toEqual({ start: 51, span: 3, width: 3 / 53 * 100 });
        expect(html).toContain('title="W1-W5: 2026-10-19 to 2026-11-22"');
        expect(html).toContain('aria-label="W51-W53: 2027-10-04 to 2027-10-24"');
        expect(html).toContain("Grid columns group up to 5 calendar weeks");
        expect(html).toContain("Weekly move and resize snapping is unchanged");
    });
    it.each([4, 5, 6, 7])("retains the %i-day calendar's actual axis and bounded final grid", days => {
        vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => String(days) });
        const phases = [phase(0), phase(3650, 3650)];
        const html = render(phases), labels = headers(html);
        const span = days === 7 ? 3650 : Math.ceil(3650 / days) * 7;
        const weeks = Math.ceil((3650 + span) / 7);
        expect(labels.length).toBeLessThanOrEqual(12);
        expect(labels.at(-1)!.start + labels.at(-1)!.span - 1).toBe(weeks);
        expect(barStyles(html)[1].left).toBeCloseTo(3650 / (weeks * 7) * 100);
    });
    it("retains incomplete-plan fallback bars while extending labels across their existing scale", () => {
        const html = render([phase(0, 0), phase(413)]);
        expect(barStyles(html)[0]).toEqual({ left: 0, width: 0 });
        expect(barStyles(html)[1]).toEqual({ left: 413 / 420 * 100, width: 7 / 420 * 100 });
        expect(headers(html).at(-1)!.start + headers(html).at(-1)!.span - 1).toBe(60);
    });
});

describe("detailed planner short-span visibility without false duration", () => {
    it("does not inflate a calendar-week bar to 1.5 percent on a long plan", () => {
        const phases = [phase(0), phase(1393)], before = JSON.stringify(phases);
        const html = render(phases), bars = barStyles(html);
        expect(bars[0]).toEqual({ left: 0, width: 5 / 1400 * 100 });
        expect(bars[1]).toEqual({ left: 99.5, width: 5 / 1400 * 100 });
        expect(JSON.stringify(phases)).toBe(before);
    });
    it("keeps the 24px move hit target separate from the coloured duration", () => {
        const html = render([phase(0), phase(1393)]);
        const duration = [...html.matchAll(/data-planner-duration="\d+"[^>]+/g)];
        expect(duration).toHaveLength(2);
        expect(duration.every(match => !match[0].includes("min-width") && !match[0].includes("pl-2"))).toBe(true);
        expect(html).toContain('data-planner-move-target="0"');
        expect(html).toContain('style="min-width:24px"');
        expect(html).toContain('data-planner-start-marker="0"');
        expect(html).toContain('data-planner-resize-target="0"');
        expect(html).toContain("ticks and grips are controls, not extra days");
    });
    it.each([4, 5, 6, 7])("uses dated five-day spans and preserves other %i-day calendar fallbacks", days => {
        vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => String(days) });
        const phases = [phase(0, 1), phase(1001, 7)];
        const html = render(phases), bars = barStyles(html);
        const existingSpan = days === 5 || days === 7 ? 1 : 7;
        const axis = days === 4 || days === 5 || days === 6 ? 1015 : 1008;
        expect(bars[0].width).toBeCloseTo(existingSpan / axis * 100);
        expect(bars[1].left).toBeCloseTo(1001 / axis * 100);
    });
    it("keeps completion within the real duration container", () => {
        const html = render([{ ...phase(0), pct_complete: 40 }, phase(1393)]);
        expect(barStyles(html)[0].width).toBe(5 / 1400 * 100);
        expect(html).toContain('data-planner-duration="0"');
        expect(html).toContain('style="width:40%"');
        expect(html).toContain("40%");
    });
    it.each(["move", "resize"] as const)("retains captured-axis %s calculations with a short span", type => {
        render([phase(0), phase(1393)]);
        const listeners = new Map<string, (event: { clientX: number }) => void>();
        vi.stubGlobal("document", {
            addEventListener: (name: string, callback: (event: { clientX: number }) => void) => listeners.set(name, callback),
            removeEventListener: (name: string) => listeners.delete(name),
        });
        for (const effect of hooks.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
        hooks.refs[0].current = { getBoundingClientRect: () => ({ width: 1400 }) };
        hooks.callbacks[0]({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 0 } as unknown as MouseEvent, 0, type);
        listeners.get("mousemove")!({ clientX: 7 });
        const updated = hooks.updates.findLast((value): value is PlannerPhase[] => Array.isArray(value));
        expect(updated?.[0]).toMatchObject(type === "move" ? { startOffset: 7 } : { manualDays: 10 });
        expect(updated?.[1]).toEqual(phase(1393));
    });
});

describe("five-day duration geometry follows the complete displayed date plan", () => {
    it.each([
        { offset: 0, days: 1, start: 0, span: 1 },
        { offset: 2, days: 2, start: 2, span: 2 },
        { offset: 4, days: 2, start: 4, span: 4 },
        { offset: 5, days: 1, start: 7, span: 1 },
        { offset: 6, days: 5, start: 7, span: 5 },
        { offset: 7, days: 5, start: 7, span: 5 },
    ])("draws offset $offset / $days working days without changing saved phases", ({ offset, days, start, span }) => {
        const phases = [phase(offset, days)], before = JSON.stringify(phases);
        const html = render(phases);
        expect(barStyles(html)).toEqual([{ left: start / 28 * 100, width: span / 28 * 100 }]);
        expect(JSON.stringify(phases)).toBe(before);
        expect(html).toContain('style="min-width:24px"');
    });
    it("keeps the reported three-week finish on 6 November and excludes the following weekend from the fill", () => {
        const html = render();
        expect(html).toContain("6 Nov 26");
        const bars = barStyles(html);
        expect(bars[2].left + bars[2].width).toBeCloseTo(19 / 28 * 100);
        expect(html).not.toContain("9 Nov 26");
    });
    it("retains a gap before the first activity instead of moving it to the axis origin", () => {
        const html = render([phase(14, 1), phase(21, 2)]);
        expect(barStyles(html)).toEqual([{ left: 50, width: 1 / 28 * 100 }, { left: 75, width: 2 / 28 * 100 }]);
    });
    it("spans a year boundary using the existing working-day dates", () => {
        const html = render([phase(73, 3)]);
        // Thursday 31 Dec through Monday 4 Jan, including the intervening weekend.
        expect(barStyles(html)[0]).toEqual({ left: 73 / 84 * 100, width: 5 / 84 * 100 });
        expect(html).toContain("4 Jan 27");
    });
    it("uses rolled-forward dated starts and inclusive finishes for the same connector as the bars", () => {
        const html = render([phase(4, 2), { ...phase(5, 1), dependsOn: [0] }]);
        const path = /<path d="([^"]+)"[^>]*marker-end="url\(#dep-arrow\)"/.exec(html)![1];
        const coords = path.match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi)!.map(Number);
        expect(coords[0]).toBeCloseTo(8 / 28 * 1000);
        expect(coords[6]).toBeCloseTo(7 / 28 * 1000);
        expect(barStyles(html)).toEqual([{ left: 4 / 28 * 100, width: 4 / 28 * 100 }, { left: 25, width: 1 / 28 * 100 }]);
    });
    it("keeps the whole legacy geometry when one stage cannot form a complete dated plan", () => {
        const html = render([phase(0, 1), phase(7, 0)]);
        expect(barStyles(html)).toEqual([{ left: 0, width: 25 }, { left: 25, width: 0 }]);
    });
    it("keeps legacy own-date geometry when a dated stage lies outside the existing weekly axis", () => {
        const phases = [{ ...phase(0, 1), start_date: "2027-10-19" }];
        const before = JSON.stringify(phases);
        expect(barStyles(render(phases))).toEqual([{ left: 0, width: 25 }]);
        expect(JSON.stringify(phases)).toBe(before);
    });
});

describe("dependency connectors use actual displayed bar endpoints", () => {
    function connectors(html: string) {
        return [...html.matchAll(/<path d="([^"]+)"[^>]*marker-end="url\(#dep-arrow\)"[^>]*>/g)]
            .map(match => match[1].match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi)!.map(Number));
    }
    it("does not move chart-edge connections inward to 995 or 5", () => {
        const phases = [{ ...phase(0), dependsOn: [1] }, phase(21)], before = JSON.stringify(phases);
        const html = render(phases);
        const end = 26 / 28 * 1000;
        expect(connectors(html)).toEqual([[end, 78, end / 2, 78, end / 2, 26, 0, 26]]);
        expect(barStyles(html)).toEqual([{ left: 0, width: 5 / 28 * 100 }, { left: 75, width: 5 / 28 * 100 }]);
        expect(JSON.stringify(phases)).toBe(before);
    });
    it("retains a near-start connection below five SVG units on a long programme", () => {
        const phases = [phase(0), { ...phase(7), dependsOn: [0] }, phase(2793)];
        const html = render(phases), bars = barStyles(html), paths = connectors(html);
        expect(paths).toHaveLength(1);
        expect(paths[0][0]).toBeCloseTo((bars[0].left + bars[0].width) * 10);
        expect(paths[0][6]).toBeCloseTo(bars[1].left * 10);
        expect(paths[0][6]).toBe(2.5);
    });
    it("keeps near-end and reverse connections on their declared row endpoints", () => {
        const html = render([{ ...phase(0), dependsOn: [1] }, phase(2793)]);
        const end = 2798 / 2800 * 1000;
        expect(connectors(html)).toEqual([[end, 78, end / 2, 78, end / 2, 26, 0, 26]]);
    });
    it.each([4, 5, 6, 7])("shares the existing %i-day bar scale without changing its calendar", days => {
        vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => String(days) });
        const phases = [{ ...phase(0, 1), dependsOn: [1] }, phase(1001, 7)];
        const html = render(phases), bars = barStyles(html), paths = connectors(html);
        expect(paths).toHaveLength(1);
        expect(paths[0][0]).toBeCloseTo((bars[1].left + bars[1].width) * 10);
        expect(paths[0][6]).toBeCloseTo(bars[0].left * 10);
        expect(paths[0][1]).toBe(78); expect(paths[0][7]).toBe(26);
    });
    it("anchors the arrowhead tip,not its centre,to the successor endpoint", () => {
        const html = render([{ ...phase(0), dependsOn: [1] }, phase(21)]);
        expect(html).toMatch(/<marker id="dep-arrow"[^>]*refX="6"[^>]*refY="3.5"[^>]*orient="auto"/);
        expect(html).toContain('d="M 0 1 L 6 3.5 L 0 6 Z"');
        expect(html).toContain('class="absolute inset-0 pointer-events-none"');
        expect(html).toContain('viewBox="0 0 1000 104"');
        expect(html).toContain('preserveAspectRatio="none"');
    });
    it("retains existing self,negative and out-of-range dependency exclusions", () => {
        const html = render([{ ...phase(0), dependsOn: [-1, 0, 2] }, phase(21)]);
        expect(connectors(html)).toEqual([]);
        expect(barStyles(html)).toEqual([{ left: 0, width: 5 / 28 * 100 }, { left: 75, width: 5 / 28 * 100 }]);
    });
});
