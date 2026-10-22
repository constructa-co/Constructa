import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

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


function activity() {
    const row = nodes(view()).find(n => n.props.activityControl);
    expect(row).toBeDefined(); return row!.props.activityControl as Element;
}
function begin(element = activity()) { return (element.props.onBegin as () => boolean)(); }
function status(value: string, element = activity()) { (element.props.onWork as (status: string) => void)(value); }
function saved(section = "Kitchen work", expected: string | null = "General", element = activity()) {
    return (element.props.onSaved as (result: unknown, expected: string | null) => boolean)({ ok: true, lineId: "line", estimateId: "estimate", section }, expected);
}
describe("activity assignment through the actual pricing parent", () => {
    it("offers saved simple lines and existing names without writing or generating a new line", () => {
        const element = activity(); expect(element.props.section).toBe("General");
        expect(element.props.choices).toEqual(["General"]); expect(current.server).not.toHaveBeenCalled();
        const before = JSON.stringify(current.state!.estimates);
        expect(begin(element)).toBe(true); expect(JSON.stringify(current.state!.estimates)).toBe(before);
        expect(current.guard).toHaveBeenLastCalledWith(false, expect.any(String));
        view(); expect(current.guard).toHaveBeenLastCalledWith(true, expect.any(String));
        status("confirmed"); view(); expect(current.guard).toHaveBeenLastCalledWith(false, expect.any(String));
    });
    it("changes only the returned section, preserving newer prices/resources and saved order/IDs", () => {
        const before = JSON.stringify(current.state!.estimates);
        begin(); status("saving"); expect(JSON.stringify(current.state!.estimates)).toBe(before);
        current.state!.estimates[0].estimate_lines[0].unit_rate = 300;
        current.state!.estimates[0].estimate_lines[0].line_total = 900;
        current.state!.estimates[0].total_cost = 900;
        expect(saved("__proto__")).toBe(true);
        expect(current.state!.estimates[0]).toMatchObject({ id: "estimate", total_cost: 900, estimate_lines: [{ id: "line", trade_section: "__proto__", unit_rate: 300, line_total: 900 }] });
        expect(current.server).not.toHaveBeenCalled(); status("confirmed");
    });
    it.each(["section", "estimate", "mode"])("refuses a late acknowledgement against a newer %s", reason => {
        const old = activity(); begin(old); status("saving", old);
        if (reason === "section") current.state!.estimates[0].estimate_lines[0].trade_section = "Other work";
        if (reason === "estimate") current.state!.activeEstimateId = "other";
        if (reason === "mode") current.state!.estimates[0].estimate_lines[0].pricing_mode = "buildup";
        expect(saved("Kitchen work", "General", old)).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
    it("fences old price-edit/Add/Advanced/version/brief/work-list callbacks and retains uncertainty visibly", () => {
        current.state!.estimates.push({ ...current.state!.estimates[0], id: "alternative", is_active: false, estimate_lines: [] });
        const old = nodes(view()), row = old.find(n => n.props.activityControl)!;
        const advanced = old.find(n => n.props["aria-controls"] === "advanced-estimating")!;
        const version = old.find(n => n.props.id === "estimate-version")!;
        const brief = old.find(n => n.props["data-brief-price-draft"])!;
        const list = old.find(n => n.props["data-price-work-list"])!;
        expect(begin(row.props.activityControl as Element)).toBe(true);
        (row.props.onEdit as () => void)(); (row.props.onDelete as () => void)();
        (advanced.props.onClick as () => void)();
        (version.props.onChange as (event: unknown) => void)({ target: { value: "alternative" } });
        (brief.props.onClick as () => void)();
        const context = list.props.context as { revision: string };
        expect((list.props.onOpen as (s: string, r: unknown, rev: string) => { ok: boolean })("Paint", { start: 0, end: 5 }, context.revision).ok).toBe(false);
        expect(current.state!.ops).toEqual({}); expect(current.state!.advancedOpen).toBe(false); expect(current.state!.activeEstimateId).toBe("estimate");
        status("uncertain"); expect(nodes(view()).some(n => n.props["data-activity-save-warning"])).toBe(true);
        expect(nodes(view()).find(n => n.props.activityControl)!.props.priceBlocked).toBe(true);
        expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["open-line", "adjustments", "resource", "client-boq", "buildup"])("rechecks %s before beginning another activity draft", async reason => {
        const old = activity();
        if (reason === "open-line") current.state = estimatingReducer(current.state!, { type: "op/open", key: "new", kind: "add", lineId: "new-line", draft: EMPTY_PRICE_LINE_DRAFT });
        if (reason === "adjustments") current.state!.adjustments.status = "saving";
        if (reason === "client-boq") current.state!.estimates[0].is_client_boq = true;
        if (reason === "buildup") current.state!.estimates[0].estimate_lines[0].pricing_mode = "buildup";
        if (reason === "resource") {
            current.server.mockResolvedValueOnce({ ok: true, data: { costLibrary: [], orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] } });
            (nodes(view()).find(n => n.props["aria-controls"] === "advanced-estimating")!.props.onClick as () => void)();
            await Promise.resolve(); await Promise.resolve();
            const advanced = nodes(view()).find(n => n.props.onResourceSaveStateChanged)!;
            (advanced.props.onResourceSaveStateChanged as (id: string, status: string) => void)("library:line", "uncertain");
            (nodes(view()).find(n => n.props["aria-controls"] === "advanced-estimating")!.props.onClick as () => void)();
            current.server.mockClear();
        }
        expect(begin(old)).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
    it("does not mount the assignment editor for client BoQ or rate-build-up lines", () => {
        current.state!.estimates[0].is_client_boq = true;
        expect(nodes(view()).some(n => n.props.activityControl)).toBe(false);
        current.state!.estimates[0].is_client_boq = false; current.state!.estimates[0].estimate_lines[0].pricing_mode = "buildup";
        expect(nodes(view()).some(n => n.props.activityControl)).toBe(false);
    });
    it("keeps financially significant Preliminaries changes in Advanced, including stale callbacks", () => {
        const old = activity();
        expect(saved("Preliminaries", "General", old)).toBe(false);
        current.state!.estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        expect(begin(old)).toBe(false); expect(nodes(view()).some(n => n.props.activityControl)).toBe(false);
        expect(saved("Kitchen", "Preliminaries", old)).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
});

