import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { CostLibraryItem, Estimate } from "./types";
import { initialEstimatingState, previewRunningTotal, type AdvancedRunningTotalDraft } from "@/lib/simple-estimate";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
const replay = vi.hoisted(() => ({
    slots: {} as Record<string, Slot[]>, surface: "parent", cursor: 0, effects: [] as Array<() => void>,
    save: vi.fn(), other: vi.fn(), error: vi.fn(), drafts: [] as Array<unknown>,
}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    const slot = () => (replay.slots[replay.surface] ??= [])[replay.cursor++] ??= {};
    return { ...actual,
        useState: (initial: unknown) => { const s = slot(); if (!("value" in s)) s.value = typeof initial === "function" ? initial() : initial; return [s.value, (next: unknown) => { s.value = typeof next === "function" ? next(s.value) : next; }]; },
        useRef: (initial: unknown) => { const s = slot(); if (!("value" in s)) s.value = { current: initial }; return s.value; },
        useCallback: (callback: unknown) => callback,
        useId: () => "advanced-running-total",
        useTransition: () => [false, (callback: () => unknown) => callback()],
        useEffect: (effect: Effect, deps?: unknown[]) => {
            const s = slot(); const same = deps && s.deps && deps.length === s.deps.length && deps.every((x, i) => Object.is(x, s.deps![i]));
            if (!same) replay.effects.push(() => { s.cleanup?.(); s.cleanup = effect() || undefined; });
            s.deps = deps;
        },
    };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: replay.other }) }));
vi.mock("./actions", () => ({ createEstimateAction: replay.other, updateEstimateMarginsAction: replay.other, updateEstimateNameAction: replay.other, addLineItemAction: replay.other, updateLineItemAction: replay.save, deleteLineItemAction: replay.other, setActiveEstimateAction: replay.other, deleteEstimateAction: replay.other, setPricingModeAction: replay.other, saveDiscountAction: replay.other }));
vi.mock("./activity-actions", () => ({ savePriceLineActivityAction: replay.other }));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.other }));
vi.mock("@/app/dashboard/foundations/vision-takeoff", () => ({ default: () => null }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));
vi.mock("sonner", () => ({ toast: { error: replay.error } }));
import AdvancedEstimate from "./advanced-estimate";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function renderSurface(name: string, render: () => unknown) {
    replay.surface = name; replay.cursor = 0; replay.effects = [];
    const value = render(); for (const effect of replay.effects) effect(); return value;
}
function rowElement(tree: unknown) { return nodes(tree).find(n => typeof n.props.onQuantityChange === "function")!; }
function unmount() { for (const slots of Object.values(replay.slots)) for (const s of slots) s.cleanup?.(); }

let estimates: Estimate[];
let library: CostLibraryItem[];
let projectId: string;
let activeTab: string;
let tree: unknown;
let rowTree: unknown;
let onRunningTotalDraftChange: (draft: AdvancedRunningTotalDraft | null) => void;

function render() {
    tree = renderSurface("parent", () => AdvancedEstimate({
        estimates, setEstimates: update => { estimates = update(estimates); }, activeTab, setActiveTab: id => { activeTab = id; },
        costLibrary: library, projectId, orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [],
        onRunningTotalDraftChange,
    }));
    const row = rowElement(tree);
    rowTree = row ? renderSurface("row", () => (row.type as (props: Record<string, unknown>) => unknown)(row.props)) : null;
}
function quantityInput() { return nodes(rowTree).find(n => n.props["aria-label"] === "Quantity")!; }
function quantityEdit(raw: string) { (quantityInput().props.onChange as (event: { target: { value: string } }) => void)({ target: { value: raw } }); render(); }

beforeEach(() => {
    replay.slots = {}; replay.effects = []; replay.save.mockReset(); replay.drafts = [];
    onRunningTotalDraftChange = (draft) => { replay.drafts.push(draft); };
    projectId = "project"; activeTab = "estimate";
    library = [{ id: "catalogue", code: "GW1", description: "Excavation", unit: "m3", base_rate: 10, category: "Groundworks" }];
    estimates = [{ id: "estimate", project_id: "project", version_name: "Estimate", overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 40, is_active: true,
        estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Dig", quantity: 4, unit: "m3", unit_rate: 10, line_total: 40, trade_section: "Groundworks", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] }];
    render();
});
afterEach(() => { unmount(); });

describe("Advanced quantity draft running-total seam", () => {
    it("reports a bounded preview draft after typing a valid quantity and withholds after save starts", async () => {
        quantityEdit("12");
        const contextToken = JSON.stringify([projectId, "org", activeTab, estimates[0], library]);
        const latest = replay.drafts.at(-1);
        expect(latest).toMatchObject({ estimateId: "estimate", contextToken, lineTotals: { line: 120 } });
        const state = initialEstimatingState(estimates, { pendingEstimateId: "pending" });
        expect(previewRunningTotal({ ...state, advancedOpen: true }, { advanced: latest as AdvancedRunningTotalDraft, catalogueContextToken: contextToken })?.contractSum).toBe(120);

        quantityEdit("12");
        const save = nodes(rowTree).find(n => n.props.children === "Save quantity")!;
        (save.props.onClick as () => void)(); render();
        expect(replay.drafts.at(-1)).toBeNull();
        expect(replay.save).toHaveBeenCalled();
    });
});
