import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";
import { estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, dispatch: vi.fn(), update: vi.fn(), other: vi.fn(), theme: "dark" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => undefined,
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
    useMemo: (calculate: () => unknown) => calculate(),
    useState: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = typeof initial === "function" ? initial() : initial;
        return [current.slots[index], (value: unknown) => { current.slots[index] = typeof value === "function" ? value(current.slots[index]) : value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.other, updateSimplePriceLineAction: current.update, deleteSimplePriceLineAction: current.other, savePriceAdjustmentsAction: current.other, loadAdvancedEstimatingDataAction: current.other }));
import EstimateClient from "./estimate-client";

type Element = ReactElement<Record<string, unknown>>;
const line = (id: string): EstimateLine => ({ id, estimate_id: "estimate", description: `Walls ${id}`, quantity: 10, unit: "m2", unit_rate: 20, line_total: 200, trade_section: "Decoration", pricing_mode: "simple", line_type: "general", estimate_line_components: [] });
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view() { current.cursor = 0; return EstimateClient({ estimates: [], project: { id: "job", name: "Room", client_name: "", brief_scope: "Prepare walls", proposal_introduction: "Opening" } }); }
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.update.mockReset(); current.other.mockReset(); current.dispatch.mockReset();
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 400, estimate_lines: [line("one"), line("two")] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.dispatch.mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.update.mockImplementation(async (_estimateId, id, input) => ({ ok: true, line: { id, ...input, line_total: input.quantity * input.unit_rate } }));
});

it("keeps the stale estimate-version handler fenced after the opening draft closes while a full-scope draft is still open", () => {
    const scopedView = () => { current.cursor = 0; return EstimateClient({ estimates: [], project: { id: "job", name: "Room", client_name: "", brief_scope: "Prepare walls", proposal_introduction: "Opening", full_scope: { scope_text: "Scope", brief_scope: "Prepare walls" } } }); };
    current.state!.estimates.push({ ...current.state!.estimates[0], id: "second", version_name: "Alternative" });
    const before = JSON.stringify(current.state);
    const staleVersion = nodes(scopedView()).find(n => n.props.id === "estimate-version")!;
    const openingEditor = nodes(scopedView()).find(n => n.props.source === "Opening" && n.props.onWorkChange)!;
    const scopeEditor = nodes(scopedView()).find(n => (n.props.source as { scope_text?: string } | undefined)?.scope_text === "Scope" && n.props.onWorkChange)!;
    (openingEditor.props.onWorkChange as (open: boolean) => void)(true);
    (scopeEditor.props.onWorkChange as (open: boolean) => void)(true);
    (openingEditor.props.onWorkChange as (open: boolean) => void)(false);
    expect(nodes(scopedView()).find(n => n.props.id === "estimate-version")!.props.disabled).toBe(true);
    (staleVersion.props.onChange as (event: unknown) => void)({ target: { value: "second" } });
    expect(current.state!.activeEstimateId).toBe("estimate");
    expect(JSON.stringify(current.state)).toBe(before);
    (scopeEditor.props.onWorkChange as (open: boolean) => void)(false);
    expect(nodes(scopedView()).find(n => n.props.id === "estimate-version")!.props.disabled).toBe(false);
    expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
});



function opening() { return nodes(view()).find(n => n.props.source === "Opening" && n.props.onWorkChange)!; }
describe("opening editor in actual pricing parent", () => {
    it("receives real project wording/lock context and does not alter estimate totals", () => {
        const before = JSON.stringify(current.state);
        expect(opening().props.projectId).toBe("job");
        expect(opening().props.lockReason).toBeNull();
        (opening().props.onWorkChange as (open: boolean) => void)(true);
        expect(JSON.stringify(current.state)).toBe(before); expect(current.other).not.toHaveBeenCalled();
    });
    it("uses an independent dirty flag to fence versions and brief draft entry until confirmed/Cancel", () => {
        current.state!.estimates.push({ ...current.state!.estimates[0], id: "second", version_name: "Alternative" });
        const oldVersion = nodes(view()).find(n => n.props.id === "estimate-version")!;
        (opening().props.onWorkChange as (open: boolean) => void)(true);
        expect(nodes(view()).find(n => n.props.id === "estimate-version")!.props.disabled).toBe(true);
        (oldVersion.props.onChange as (event: unknown) => void)({ target: { value: "second" } });
        expect(current.state!.activeEstimateId).toBe("estimate");
        const assistant = nodes(view()).find(n => n.props.session)!;
        expect(assistant.props.blocked).toBe(true);
        expect(nodes(view()).find(n => n.props["data-inline-add"])).toBeUndefined();
        (opening().props.onWorkChange as (open: boolean) => void)(false);
        expect(nodes(view()).find(n => n.props.id === "estimate-version")!.props.disabled).toBe(false);
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
});
