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
    it("places three weeks in the first three of the four displayed week columns", () => {
        const before = JSON.stringify(stages);
        const html = render();
        expect(barStyles(html)).toEqual([{ left: 0, width: 25 }, { left: 25, width: 25 }, { left: 50, width: 25 }]);
        expect(html).toContain('style="width:25%"');
        expect(JSON.stringify(stages)).toBe(before);
        // Grid slots stay weekly; the finish is the proposal's inclusive working-day date.
        expect(html).toContain("6 Nov 26");
    });

    it("keeps a single week inside the first quarter, not stretched across the chart", () => {
        expect(barStyles(render([phase(0)]))).toEqual([{ left: 0, width: 25 }]);
    });

    it("uses the same scale when the plan extends beyond the minimum four weeks", () => {
        const bars = barStyles(render([phase(0), phase(35)]));
        expect(bars[0].width).toBeCloseTo(100 / 6);
        expect(bars[1].left).toBeCloseTo(500 / 6);
        expect(bars[1].left + bars[1].width).toBeCloseTo(100);
    });

    it("keeps long-plan headers on their actual scale while retaining the 52-header limit", () => {
        const html = render([phase(0), phase(413)]);
        expect([...html.matchAll(/>W\d+<\/div>/g)]).toHaveLength(52);
        expect(html).toContain(`style="width:${100 / 60}%"`);
        expect(barStyles(html)[1].left).toBeCloseTo(413 / 420 * 100);
    });

    it("puts dependency endpoints on the same week boundaries as the bars", () => {
        const html = render([phase(0), { ...phase(7), dependsOn: [0] }, phase(14)]);
        expect(html).toContain('d="M 250 26 C 250 26 250 78 250 78"');
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
