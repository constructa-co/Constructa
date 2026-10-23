import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, actions: vi.fn(), select: vi.fn(), estimates: [] as unknown[], activeId: "a" }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = replay.cursor++;
        if (!(i in replay.slots)) replay.slots[i] = typeof initial === "function" ? initial() : initial;
        return [replay.slots[i], (value: unknown) => { replay.slots[i] = typeof value === "function" ? value(replay.slots[i]) : value; }];
    },
    useRef: (initial: unknown) => {
        const i = replay.cursor++;
        if (!(i in replay.slots)) replay.slots[i] = { current: initial };
        return replay.slots[i];
    },
    useId: () => "palette-test", useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
    useTransition: () => [false, (callback: () => unknown) => { void callback(); }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ createEstimateAction: replay.actions, updateEstimateMarginsAction: replay.actions, updateEstimateNameAction: replay.actions, addLineItemAction: replay.actions, updateLineItemAction: replay.actions, deleteLineItemAction: replay.actions, setActiveEstimateAction: replay.actions, deleteEstimateAction: replay.actions, setPricingModeAction: replay.actions, saveDiscountAction: replay.actions }));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.actions }));
vi.mock("@/app/dashboard/foundations/vision-takeoff", () => ({ default: () => null }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));
vi.mock("sonner", () => ({ toast: { error: replay.actions, success: replay.actions } }));
import AdvancedEstimate from "./advanced-estimate";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
function view() {
    replay.cursor = 0;
    return nodes(AdvancedEstimate({ estimates: replay.estimates as Estimate[], setEstimates: update => { replay.estimates = update(replay.estimates as Estimate[]); }, activeTab: replay.activeId, setActiveTab: replay.select, costLibrary: [], projectId: "job", orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] }));
}
/** A row is its own component: render it with its own hook slots. */
function row(tree: Element[], id: string) {
    const element = tree.find(e => (e.props.line as EstimateLine | undefined)?.id === id && typeof e.type === "function")!;
    expect(element, `row ${id}`).toBeDefined();
    replay.cursor = 10_000 + Number(id.replace(/\D/g, "")) * 1_000;
    return nodes((element.type as (props: unknown) => unknown)(element.props));
}
const classes = (e: Element | undefined) => String(e?.props.className ?? "").split(/\s+/);
const button = (tree: Element[], label: string) => tree.find(e => e.type === "button" && text(e.props.children).includes(label));
const field = (tree: Element[], label: string) => tree.find(e => e.type === "input" && e.props["aria-label"] === label);

const line = (id: string, pricing_mode: "simple" | "buildup"): EstimateLine => ({ id, estimate_id: "a", description: `Line ${id}`, quantity: 2, unit: "m2", unit_rate: 40, line_total: 80, trade_section: "Groundworks", line_type: "general", pricing_mode, estimate_line_components: [] });
const estimate = (lines: EstimateLine[]): Estimate => ({ id: "a", project_id: "job", version_name: "Saved a", overhead_pct: 5, profit_pct: 10, risk_pct: 2, prelims_pct: 3, discount_pct: 0, discount_reason: "", total_cost: 100, is_active: true, estimate_lines: lines });

const ACCENT = ["bg-[var(--price-accent)]", "text-[var(--price-accent-text)]"];
const OLD_PRIMARY = ["bg-blue-600", "text-white", "hover:bg-blue-500"];
const SAGE_FOCUS = ["focus:ring-1", "focus:ring-emerald-500/50", "focus:outline-none"];

beforeEach(() => {
    replay.slots = []; replay.cursor = 0; replay.activeId = "a"; replay.actions.mockReset(); replay.select.mockReset();
    replay.estimates = [estimate([line("l1", "simple"), line("l2", "buildup"), { ...line("l3", "simple"), trade_section: "Preliminaries" }])];
    vi.stubGlobal("confirm", vi.fn(() => false));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Advanced estimating ordinary controls use the pricing palette", () => {
    it("empty: Start detailed pricing uses the existing price accent variables, not the old blue class", () => {
        replay.estimates = [];
        const start = button(view(), "Start detailed pricing")!;
        for (const cls of ACCENT) expect(classes(start)).toContain(cls);
        for (const cls of OLD_PRIMARY) expect(classes(start)).not.toContain(cls);
        expect(start.props.type).toBe("button"); expect(typeof start.props.onClick).toBe("function");
    });

    it("current estimate: Add an alternative uses the price accent and keeps its guard and handler", () => {
        const add = button(view(), "Add an alternative")!;
        for (const cls of ACCENT) expect(classes(add)).toContain(cls);
        for (const cls of OLD_PRIMARY) expect(classes(add)).not.toContain(cls);
        expect(classes(add)).toEqual(expect.arrayContaining(["px-4", "py-2", "rounded-lg", "text-sm", "font-medium", "transition-colors", "flex", "items-center", "gap-1.5"]));
        expect(add.props.disabled).toBe(false); expect(typeof add.props.onClick).toBe("function");
    });

    it("Version name and the four margin fields use the sage focus ring, nothing else changed", () => {
        const tree = view();
        for (const label of ["Estimate Name", "Prelims %", "Overhead %", "Risk %", "Profit %"]) {
            const input = field(tree, label)!;
            expect(input, label).toBeDefined();
            for (const cls of SAGE_FOCUS) expect(classes(input), label).toContain(cls);
            expect(classes(input).join(" "), label).not.toMatch(/blue/);
            expect(classes(input), label).toEqual(expect.arrayContaining(["w-full", "h-10", "border-slate-700", "bg-slate-900/50", "text-slate-100"]));
        }
        expect(field(tree, "Profit %")!.props.value).toBe(10);
    });

    it("Add line item reads in the sage/emerald accent, keeping its layout and receipt guard", () => {
        const add = button(view(), "Add line item")!;
        expect(classes(add)).toEqual(expect.arrayContaining(["text-emerald-400", "hover:bg-emerald-500/10", "w-full", "px-5", "py-2.5", "text-left", "text-sm"]));
        expect(classes(add).join(" ")).not.toMatch(/blue/);
        expect(add.props.disabled).toBe(false);
    });

    it("ordinary line search and numeric fields use the sage focus ring; draft editors are untouched", () => {
        const tree = view();
        const ringed = (rowTree: Element[]) => rowTree.filter(e => e.type === "input" && /focus:ring-/.test(String(e.props.className)));
        const simple = row(tree, "l1");
        // Simple line: catalogue search and the rate field carry the ring.
        expect(ringed(simple).map(e => e.props["aria-label"])).toEqual(["Search catalogue", "Rate (£)"]);
        // Its draft description and quantity editors have no ring, before or after.
        for (const label of ["Description", "Quantity"]) expect(String(field(simple, label)!.props.className)).not.toMatch(/focus:ring|blue/);
        // Built-up line: the legacy quantity field. Preliminaries line: the legacy rate field.
        expect(ringed(row(tree, "l2")).map(e => e.props["aria-label"])).toContain("Quantity");
        expect(ringed(row(tree, "l3")).map(e => e.props["aria-label"])).toContain("Rate (£)");
        for (const input of [...ringed(simple), ...ringed(row(tree, "l2")), ...ringed(row(tree, "l3"))]) {
            for (const cls of SAGE_FOCUS) expect(classes(input), String(input.props["aria-label"])).toContain(cls);
            expect(String(input.props.className)).not.toMatch(/blue/);
        }
    });

    it("keeps purposeful colours: the built-up rate marker stays blue", () => {
        const built = row(view(), "l2");
        const marker = built.find(e => e.type === "span" && text(e.props.children) === "built up")!;
        expect(classes(marker)).toContain("text-blue-500");
        const rate = built.find(e => e.type === "div" && nodes(e.props.children).includes(marker) && /text-blue-400/.test(String(e.props.className)))!;
        expect(classes(rate)).toEqual(expect.arrayContaining(["text-blue-400", "bg-blue-500/10"]));
    });

    it("keeps purposeful colours: resource open/closed, active star and the other semantic literals are unchanged", () => {
        const tree = view();
        const toggle = tree.find(e => e.type === "button" && String(e.props["aria-label"]).startsWith("View resources: Line l1"))!;
        expect(classes(toggle)).toEqual(expect.arrayContaining(["bg-slate-700", "text-slate-400", "border-slate-600", "hover:border-blue-500", "hover:text-slate-200"]));
        const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/projects/costs/advanced-estimate.tsx"), "utf8");
        expect(source).toContain('"bg-emerald-200 text-emerald-950 border-emerald-200"');
        expect(source).toContain('<Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />');
        expect(source).toContain("border-emerald-700/50 rounded-lg bg-emerald-500/10 text-emerald-400");
        // Only these literals changed: no old ordinary blue remains, and the
        // purposeful blue is exactly the resource hover and the built-up rate.
        expect(source).not.toMatch(/bg-blue-600|focus:ring-blue-500\/50|text-blue-400 hover:bg-blue-500\/10/);
        expect(source.match(/focus:ring-emerald-500\/50/g)).toHaveLength(12);
        expect(source.match(/blue-/g)).toHaveLength(4);
    });

    it("rendering and reading the classes writes nothing and selects nothing", () => {
        const before = JSON.stringify(replay.estimates);
        view(); row(view(), "l1"); row(view(), "l2"); row(view(), "l3");
        replay.estimates = []; view();
        expect(replay.actions).not.toHaveBeenCalled(); expect(replay.select).not.toHaveBeenCalled();
        expect(before).toBe(JSON.stringify([estimate([line("l1", "simple"), line("l2", "buildup"), { ...line("l3", "simple"), trade_section: "Preliminaries" }])]));
    });
});
