import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { PlannerPhase } from "@/lib/planner-phases";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, write: vi.fn(), read: vi.fn(), setItem: vi.fn() }));
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
type TrackedPhase = PlannerPhase & { pct_complete?: number };
const phase = (name: string, startOffset: number, pct?: number): TrackedPhase => ({ name, startOffset, calculatedDays: 5, manualDays: 5, manhours: 40, ...(pct === undefined ? {} : { pct_complete: pct }) });
const example = (): TrackedPhase[] => [phase("Strip out", 0, 50), phase("First fix", 7), phase("Finishes", 14, 100)];
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
const text = (value: unknown): string => Array.isArray(value) ? value.map(text).join("")
    : typeof value === "string" || typeof value === "number" ? String(value)
        : value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
const classes = (node: Element | undefined) => String(node?.props.className ?? "").split(/\s+/).filter(Boolean);
const button = (tree: Element[], label: string) => tree.find(n => n.type === "button" && text(n.props.children).trim() === label);

function setup(phases: TrackedPhase[] = example(), days = "5") {
    vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => days, setItem: hooks.setItem });
    const props = { project: { id: "job", name: "Kitchen", start_date: "2026-11-02", programme_phases: phases }, projectId: "job", estimate: null };
    const parent = () => { hooks.cursor = 0; return nodes(ClientSchedulePage(props)); };
    const tracking = () => {
        const toggle = parent().find(n => n.type === "button" && text(n.props.children).includes("Live Tracking"))!;
        (toggle.props.onClick as () => void)();
        const panel = parent().find(n => typeof n.type === "function" && n.props.onPhasesChange)!;
        return nodes((panel.type as (props: unknown) => Element)(panel.props));
    };
    return { parent, tracking, html: () => renderToStaticMarkup(ClientSchedulePage(props)) };
}

const SAGE = ["bg-[#a5e8b8]", "text-[#10291b]"];
const OLD = ["bg-blue-600", "text-white", "hover:bg-blue-500", "bg-blue-600/20", "text-blue-400", "hover:bg-blue-600/30", "border-blue-500/30"];

beforeEach(() => {
    hooks.slots = []; hooks.cursor = 0; hooks.write.mockReset(); hooks.read.mockReset(); hooks.setItem.mockReset();
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-24T10:00:00+04:00"));
});
afterEach(() => {
    expect(hooks.write).not.toHaveBeenCalled(); expect(hooks.read).not.toHaveBeenCalled(); expect(hooks.setItem).not.toHaveBeenCalled();
    vi.useRealTimers(); vi.unstubAllGlobals();
});

describe("detailed planner ordinary controls use the programme sage/ink", () => {
    it("Save to Proposal keeps its computed sage/ink as literal classes, with its guard and label", () => {
        const save = setup().parent().find(n => n.type === "button" && n.props["aria-label"] === "Save programme to proposal")!;
        for (const cls of SAGE) expect(classes(save)).toContain(cls);
        for (const cls of OLD) expect(classes(save)).not.toContain(cls);
        expect(classes(save)).toEqual(expect.arrayContaining(["px-4", "py-2", "rounded-lg", "text-sm", "font-semibold", "disabled:opacity-50", "transition-colors"]));
        expect(save.props.disabled).toBe(false); expect(text(save.props.children).trim()).toBe("Save to Proposal");
    });

    it("shows the saved working-week pattern without legacy blue day-count toggles", () => {
        const tree = setup(example(), "5").parent();
        expect(tree.some(n => n.type === "span" && String(n.props["data-planner-saved-working-days"] ?? "") !== "")).toBe(true);
        expect([4, 5, 6, 7].every(n => !button(tree, `${n}d`))).toBe(true);
        const html = setup(example(), "5").html();
        expect(html).not.toMatch(/bg-blue-600|focus:border-blue-500/);
    });

    it("header icon is decorative emerald, not blue", () => {
        const tree = setup().parent();
        const icon = tree.find(n => n.type === "svg" && classes(n).includes("h-5"))!;
        expect(classes(icon)).toContain("text-emerald-400");
        const tile = tree.find(n => n.type === "div" && nodes(n.props.children).includes(icon) && classes(n).includes("h-10"))!;
        expect(classes(tile)).toEqual(expect.arrayContaining(["bg-emerald-500/10", "border-emerald-500/20"]));
    });

    it("empty programme: Add phase manually keeps the solid sage/ink and gets an emerald border", () => {
        const add = button(setup([]).parent(), "+ Add phase manually")!;
        expect(classes(add)).toEqual(expect.arrayContaining([...SAGE, "border", "border-emerald-500/30", "mt-2", "px-4", "py-2", "rounded-lg", "text-sm", "font-medium"]));
        for (const cls of OLD) expect(classes(add)).not.toContain(cls);
    });

    it("start date, manual duration and dependency fields use the neutral emerald focus border", () => {
        const tree = setup().parent();
        const start = tree.find(n => n.type === "input" && n.props.type === "date")!;
        expect(classes(start)).toContain("focus:border-emerald-500/60");
        const manual = tree.filter(n => n.type === "input" && n.props.type === "number");
        const dependency = tree.filter(n => n.type === "select");
        expect(manual).toHaveLength(3); expect(dependency).toHaveLength(3);
        for (const field of [...manual, ...dependency]) {
            expect(classes(field)).toEqual(expect.arrayContaining(["focus:outline-none", "focus:border-emerald-500/50", "border-slate-700"]));
            expect(classes(field).join(" ")).not.toMatch(/blue/);
        }
    });

    it("keeps every phase colour on the chart", () => {
        const phases = Array.from({ length: 10 }, (_, i) => phase(`Stage ${i + 1}`, i * 7));
        const html = setup(phases).html();
        for (const colour of ["blue", "emerald", "orange", "purple", "red", "teal", "indigo", "pink", "yellow", "cyan"]) expect(html).toContain(`bg-${colour}-500`);
    });

    it("tracking: actual date fields get the neutral emerald focus; progress, status and stats colours are unchanged", () => {
        const panel = setup().tracking();
        const dates = panel.filter(n => n.type === "input" && n.props.type === "date");
        expect(dates).toHaveLength(6);
        for (const date of dates) {
            expect(classes(date)).toContain("focus:border-emerald-500/50");
            expect(classes(date).join(" ")).not.toMatch(/blue/);
        }
        const sliders = panel.filter(n => n.type === "input" && n.props.type === "range");
        expect(sliders).toHaveLength(3);
        for (const slider of sliders) expect(classes(slider)).toContain("accent-blue-500");
        const status = (label: string) => panel.find(n => n.type === "span" && text(n.props.children).trim() === label);
        expect(classes(status("In Progress"))).toEqual(expect.arrayContaining(["bg-blue-500/10", "border-blue-500/20", "text-blue-400"]));
        expect(classes(status("Complete"))).toEqual(expect.arrayContaining(["bg-emerald-500/10", "text-emerald-400"]));
        expect(classes(status("Not Started"))).toEqual(expect.arrayContaining(["bg-slate-700/30", "text-slate-500"]));
        const overall = panel.find(n => n.type === "p" && /%$/.test(text(n.props.children)) && classes(n).includes("text-xl"))!;
        expect(classes(overall)).toContain("text-blue-400");
        expect(panel.some(n => classes(n).includes("rounded-full") && classes(n).includes("bg-blue-500"))).toBe(true);
    });

    it("source: only the named ordinary literals changed; meaningful blues remain", () => {
        const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/projects/schedule/client-page.tsx"), "utf8");
        expect(source.split("\n").length).toBeGreaterThan(1200);
        expect(source).not.toMatch(/bg-blue-600|focus:border-blue-500|hover:bg-blue-500|text-blue-400" fill/);
        expect(source.match(/blue-/g)).toHaveLength(9);
        expect(source).toContain('{ key: "blue",    bg: "bg-blue-500" },');
        expect(source).toContain('className="w-24 h-1.5 accent-blue-500"');
        expect(source).toContain('? "bg-blue-500/10 border-blue-500/20 text-blue-400"');
        expect(source).toContain('const colorDef = ["bg-blue-500","bg-emerald-500"');
    });
});
