import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, server: vi.fn(), dispatch: vi.fn(), guard: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
    useEffect: () => undefined,
    useMemo: (calculate: () => unknown) => calculate(),
    useState: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = initial;
        return [current.slots[index], (value: unknown) => { current.slots[index] = value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: current.guard }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.server, updateSimplePriceLineAction: current.server, deleteSimplePriceLineAction: current.server, savePriceAdjustmentsAction: current.server, loadAdvancedEstimatingDataAction: current.server }));
import EstimateClient from "./estimate-client";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view(scope = "Prepare walls.\n\nPaint walls.\n\nSite, access and assumptions:\nPrivate access notes.") {
    current.cursor = 0;
    return EstimateClient({ estimates: [], project: { id: "job", name: "Example room", client_name: "", brief_scope: scope } });
}
beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Existing work", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.slots = []; current.cursor = 0; current.server.mockReset(); current.guard.mockReset();
    current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
});

function chooser() { return nodes(view()).find(n => n.props["data-price-work-list"])!; }
function open(element = chooser(), source = "Fit doors\nPaint walls", start = 0, end = 9) {
    const context = element.props.context as { revision: string };
    return (element.props.onOpen as (source: string, range: { start: number; end: number }, revision: string) => { ok: boolean; error?: string })(source, { start, end }, context.revision);
}
function work(open: boolean) { (chooser().props.onWorkChange as (open: boolean) => void)(open); }
function row() { return nodes(view()).find(n => n.props["data-inline-add"])!; }

describe("reviewed work list in the real estimating parent", () => {
    it("opens only one unpriced draft, blocks stale repeated clicks, and Cancel writes nothing", () => {
        const old = chooser(), saved = JSON.stringify(current.state!.estimates);
        work(true); expect(open(old).ok).toBe(true);
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Fit doors" });
        current.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch: { description: "Later typing" } });
        expect(open(old).ok).toBe(false);
        expect(current.state!.ops[NEW_LINE_KEY].draft.description).toBe("Later typing");
        (row().props.onCancel as () => void)();
        expect(JSON.stringify(current.state!.estimates)).toBe(saved); expect(current.server).not.toHaveBeenCalled();
        expect(open(chooser(), "Fit doors\nPaint walls", 10, 21).ok).toBe(true);
        expect(current.state!.ops[NEW_LINE_KEY].draft.description).toBe("Paint walls");
    });
    it("saves exactly the selected line with the existing price/Save controller, then opens another only explicitly", async () => {
        work(true); open();
        (row().props.onChange as (patch: unknown) => void)({ amount: "100" });
        expect(current.server).not.toHaveBeenCalled();
        current.server.mockImplementationOnce(async request => ({ ok: true, estimateId: "estimate", line: { id: request.lineId, estimate_id: "estimate", ...request.line, line_total: 100 } }));
        (row().props.onSave as () => void)(); await Promise.resolve(); await Promise.resolve();
        expect(current.server).toHaveBeenCalledOnce();
        expect(current.server.mock.calls[0][0].line).toEqual({ description: "Fit doors", quantity: 1, unit: "item", unit_rate: 100 });
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(current.state!.estimates[0].total_cost).toBe(877);
        expect(open(chooser(), "Fit doors\nPaint walls", 10, 21).ok).toBe(true);
        expect(current.server).toHaveBeenCalledOnce();
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Paint walls" });
    });
    it("retains the same draft/id after failed Save and refuses another list item", async () => {
        work(true); open(); const id = current.state!.ops[NEW_LINE_KEY].lineId;
        (row().props.onChange as (patch: unknown) => void)({ amount: "100" });
        current.server.mockResolvedValueOnce({ ok: false, error: "Connection failed" });
        (row().props.onSave as () => void)(); await Promise.resolve(); await Promise.resolve();
        expect(current.state!.ops[NEW_LINE_KEY]).toMatchObject({ lineId: id, status: "failed", draft: { description: "Fit doors", amount: "100" } });
        expect(open().ok).toBe(false); expect(current.server).toHaveBeenCalledOnce();
    });
    it("keeps existing Save-and-add-next blank, never auto-inserting another queued item", async () => {
        work(true); open(); (row().props.onChange as (patch: unknown) => void)({ amount: "100" });
        current.server.mockImplementationOnce(async request => ({ ok: true, estimateId: "estimate", line: { id: request.lineId, estimate_id: "estimate", ...request.line, line_total: 100 } }));
        await (row().props.onSaveNext as () => Promise<boolean>)();
        expect(current.state!.ops[NEW_LINE_KEY].draft.description).toBe("");
        expect(open().ok).toBe(false); expect(current.server).toHaveBeenCalledOnce();
    });
    it.each(["open-line", "adjustments", "advanced", "client-boq"])("rechecks %s even using an old list handler", boundary => {
        const old = chooser();
        if (boundary === "open-line") current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "edit", lineId: "line", draft: EMPTY_PRICE_LINE_DRAFT });
        if (boundary === "adjustments") current.state!.adjustments.status = "saving";
        if (boundary === "advanced") current.state!.advancedOpen = true;
        if (boundary === "client-boq") current.state!.estimates[0].is_client_boq = true;
        expect(open(old).ok).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
    it("refuses stale saved prices, project and version revisions", () => {
        const old = chooser();
        current.state!.estimates[0].estimate_lines[0].unit_rate = 999;
        expect(open(old)).toMatchObject({ ok: false, error: expect.stringMatching(/changed/) });
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined(); expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["x".repeat(501), "Bad\u0000work"])("refuses invalid selected wording in the parent too", source => {
        expect(open(chooser(), source, 0, source.length).ok).toBe(false);
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined(); expect(current.server).not.toHaveBeenCalled();
    });
    it("keeps typed list text in the parent dirty/version/brief fences until explicit Clear", () => {
        current.state!.estimates.push({ ...current.state!.estimates[0], id: "alternative", is_active: false, estimate_lines: [] });
        const version = nodes(view()).find(n => n.props.id === "estimate-version")!;
        const oldBrief = nodes(view()).find(n => n.props["data-brief-price-draft"])!.props.onClick as () => void;
        work(true); oldBrief();
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(nodes(view()).find(n => n.props["data-brief-excerpt"])!.props.blocked).toBe(true);
        expect(nodes(view()).find(n => n.props.session)!.props.blocked).toBe(true);
        expect(current.guard).toHaveBeenLastCalledWith(true, expect.any(String));
        (version.props.onChange as (event: unknown) => void)({ target: { value: "alternative" } });
        expect(current.state!.activeEstimateId).toBe("estimate");
        work(false);
        expect(nodes(view()).find(n => n.props["data-brief-excerpt"])!.props.blocked).toBe(false);
        expect(current.guard).toHaveBeenLastCalledWith(false, expect.any(String));
        vi.stubGlobal("window", { sessionStorage: { setItem: vi.fn() } });
        try {
            (version.props.onChange as (event: unknown) => void)({ target: { value: "alternative" } });
            expect(current.state!.activeEstimateId).toBe("alternative");
        } finally { vi.unstubAllGlobals(); }
        expect(current.server).not.toHaveBeenCalled();
    });
    it("opens before a first estimate exists without creating any records", () => {
        current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
        expect(open().ok).toBe(true); expect(current.state!.estimates).toEqual([]);
        expect(current.server).not.toHaveBeenCalled();
    });
    it("rechecks payment, notes and resource ledgers, not just the new-line reducer", async () => {
        const pricing = () => {
            current.cursor = 0;
            return EstimateClient({ estimates: [], project: { id: "job", name: "Example", client_name: "", brief_scope: "Work", payment_schedule: null,
                scope_notes: { exclusions_text: null, clarifications_text: null, contract_exclusions: null, contract_clarifications: null } } });
        };
        const elements = nodes(pricing()), list = elements.find(n => n.props["data-price-work-list"])!;
        const notes = elements.find(n => n.props.source && n.props.onWorkChange)!, payments = elements.find(n => "schedule" in n.props && n.props.onWorkChange)!;
        (notes.props.onWorkChange as (open: boolean) => void)(true);
        expect(open(list).ok).toBe(false);
        (notes.props.onWorkChange as (open: boolean) => void)(false);
        (payments.props.onWorkChange as (open: boolean) => void)(true);
        expect(open(list).ok).toBe(false);
        (payments.props.onWorkChange as (open: boolean) => void)(false);
        current.server.mockResolvedValueOnce({ ok: true, data: { costLibrary: [], orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] } });
        (nodes(pricing()).find(n => n.props["aria-controls"] === "advanced-estimating")!.props.onClick as () => void)();
        await Promise.resolve(); await Promise.resolve();
        const advanced = nodes(pricing()).find(n => n.props.onResourceSaveStateChanged)!;
        (advanced.props.onResourceSaveStateChanged as (id: string, status: string) => void)("library:line", "uncertain");
        (nodes(pricing()).find(n => n.props["aria-controls"] === "advanced-estimating")!.props.onClick as () => void)();
        expect(open(list).ok).toBe(false);
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
    });
});

