import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { computeProgrammePlan } from "@/lib/programme-plan";
import type { PlannerPhase } from "@/lib/planner-phases";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, write: vi.fn(), read: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => undefined,
    useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => ({ current: initial }), useTransition: () => [false, (fn: () => void) => fn()],
    useState: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
        return [hooks.slots[i], (next: unknown) => { hooks.slots[i] = typeof next === "function" ? next(hooks.slots[i]) : next; }]; },
}));
vi.mock("./actions", () => ({ updatePhasesAction: hooks.write, saveProgrammePhasesAction: hooks.write, getEstimatePhasesAction: hooks.read }));
vi.mock("./programme-ai-update", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import ClientSchedulePage from "./client-page";

type Element = ReactElement<Record<string, unknown>>;
const phase = (name: string, startOffset: number, days = 5): PlannerPhase => ({ name, startOffset, calculatedDays: days, manualDays: days, manhours: 40 });
const example = () => [phase("Demo", 0), phase("Install", 7), phase("Finishing works", 14)];
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function setup(phases = example(), start = "2026-10-19", days = 5, workingPattern?: unknown) {
    vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => String(days) });
    const props = { project: { id: "job", name: "Kitchen", start_date: start, programme_phases: phases,
        ...(workingPattern === undefined ? {} : { programme_working_pattern: workingPattern }) }, projectId: "job", estimate: null };
    const parent = () => { hooks.cursor = 0; return ClientSchedulePage(props); };
    const toggle = nodes(parent()).find(n => n.type === "button" && typeof n.props.children === "string" && n.props.children.includes("Live Tracking"))!;
    (toggle.props.onClick as () => void)();
    const panel = () => nodes(parent()).find(n => typeof n.type === "function" && n.props.onPhasesChange)!;
    const tree = () => { const p = panel(); return (p.type as (props: unknown) => Element)(p.props); };
    return { parent, panel, tree, html: () => renderToStaticMarkup(tree()) };
}
beforeEach(() => {
    hooks.slots = []; hooks.cursor = 0; hooks.write.mockReset(); hooks.read.mockReset();
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-24T10:00:00+04:00"));
});
afterEach(() => { expect(hooks.write).not.toHaveBeenCalled(); expect(hooks.read).not.toHaveBeenCalled(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("five-day Live Tracking date parity", () => {
    it("shows the same first/last working dates as the main chart and proposal, not the next Monday", () => {
        const phases = example(), before = JSON.stringify(phases), app = setup(phases), html = app.html();
        expect(html).toContain("19 Oct \u2192 23 Oct"); expect(html).toContain("26 Oct \u2192 30 Oct"); expect(html).toContain("2 Nov \u2192 6 Nov");
        expect(html).not.toContain("9 Nov"); expect(renderToStaticMarkup(app.parent())).toContain("6 Nov 26");
        expect(computeProgrammePlan("2026-10-19", phases)?.end_date).toBe("2026-11-06");
        expect(JSON.stringify(phases)).toBe(before);
    });
    it("uses those same end dates for the delayed count and row status", () => {
        const html = setup([phase("Demo", 0)]).html();
        expect(html).toContain("Delayed</p>"); expect(html).toContain("text-red-400\">1</p>");
        expect(html).toContain("Delayed</span>");
    });
    it("does not call a stage delayed on its planned finish day or after it is complete", () => {
        vi.setSystemTime(new Date("2026-10-23T10:00:00+04:00"));
        const app = setup([phase("Demo", 0)]);
        expect(app.html()).not.toContain("Delayed</span>");
        vi.setSystemTime(new Date("2026-10-24T10:00:00+04:00"));
        (app.panel().props.onPhasesChange as (phases: PlannerPhase[]) => void)([{ ...phase("Demo", 0), pct_complete: 100 }]);
        expect(app.html()).toContain("Complete</span>"); expect(app.html()).not.toContain("Delayed</span>");
    });
    it("honours a partial working week, a midweek offset, overlaps and year boundary without changing phases", () => {
        expect(setup([phase("Short", 2, 3)]).html()).toContain("21 Oct \u2192 23 Oct");
        hooks.slots = [];
        expect(setup([phase("First", 0, 3), phase("Overlap", 1, 5)]).html()).toContain("20 Oct \u2192 26 Oct");
        hooks.slots = [];
        expect(setup(example(), "2026-12-28").html()).toContain("11 Jan \u2192 15 Jan");
    });
    it.each([4, 6, 7])("does not let the removed %i-day browser override change saved-default Live Tracking dates", days => {
        const html = setup([phase("Work", 0)], "2026-10-19", days).html();
        expect(html).toContain("19 Oct \u2192 23 Oct");
        expect(html).not.toContain("19 Oct \u2192 2 Nov");
    });
    it.each([{ weekdays: [1, 2, 3, 4, 5, 6], finish: "26 Oct" }, { weekdays: [0, 1, 2, 3, 4, 5, 6], finish: "25 Oct" }])("shares saved weekend dates through $finish without changing operational handlers", ({ weekdays, finish }) => {
        const pattern = { version: 1, weekdays }, phases = [phase("Work", 0, 7)];
        const app = setup(phases, "2026-10-19", weekdays.length, pattern);
        expect(app.html()).toContain(`19 Oct \u2192 ${finish}`);
        expect(computeProgrammePlan("2026-10-19", phases, pattern)?.end_date).toBe(`2026-10-${finish.slice(0, 2)}`);
    });
    it("does not mix a partial valid plan with legacy fallback when a stage has no duration", () => {
        const html = setup([phase("Valid", 0), phase("Missing duration", 7, 0)]).html();
        expect(html).toContain("Missing duration"); expect(html).toContain("19 Oct \u2192 26 Oct");
        expect(html).not.toContain("19 Oct \u2192 23 Oct");
    });
    it("keeps percent/actual-date handlers and every other phase field unchanged", () => {
        const initial = [{ ...phase("Demo", 0), color: "emerald", dependsOn: [1], pct_complete: 0 }], app = setup(initial);
        const range = nodes(app.tree()).find(n => n.type === "input" && n.props.type === "range")!;
        (range.props.onChange as (event: unknown) => void)({ target: { value: "50" } });
        expect(app.panel().props.phases).toEqual([{ ...initial[0], pct_complete: 50 }]);
        const date = nodes(app.tree()).find(n => n.type === "input" && n.props.type === "date")!;
        (date.props.onChange as (event: unknown) => void)({ target: { value: "2026-10-20" } });
        expect(app.panel().props.phases).toEqual([{ ...initial[0], pct_complete: 50, actual_start_date: "2026-10-20" }]);
        expect(initial[0].pct_complete).toBe(0);
    });
});
