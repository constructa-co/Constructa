import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, mode: vi.fn(), other: vi.fn(), replace: vi.fn(), estimates: [] as Estimate[] }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const slot = replay.cursor++;
        if (!(slot in replay.slots)) replay.slots[slot] = typeof initial === "function" ? initial() : initial;
        return [replay.slots[slot], (value: unknown) => { replay.slots[slot] = typeof value === "function" ? value(replay.slots[slot]) : value; }];
    },
    useRef: (initial: unknown) => {
        const slot = replay.cursor++;
        if (!(slot in replay.slots)) replay.slots[slot] = { current: initial };
        return replay.slots[slot];
    },
    useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
    useTransition: () => [false, (callback: () => unknown) => callback()],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ createEstimateAction: replay.other, updateEstimateMarginsAction: replay.other, updateEstimateNameAction: replay.other, addLineItemAction: replay.other, updateLineItemAction: replay.other, deleteLineItemAction: replay.other, setActiveEstimateAction: replay.other, deleteEstimateAction: replay.other, setPricingModeAction: replay.mode, saveDiscountAction: replay.other }));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.other }));
vi.mock("@/app/dashboard/foundations/vision-takeoff", () => ({ default: () => null }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import AdvancedEstimate from "./advanced-estimate";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view() {
    replay.cursor = 0;
    return AdvancedEstimate({ estimates: replay.estimates, setEstimates: update => { replay.estimates = update(replay.estimates); replay.replace(); }, activeTab: "estimate", setActiveTab: vi.fn(), costLibrary: [], projectId: "project", orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] });
}
function disclosure() {
    const element = nodes(view()).find(e => e.props["data-resource-disclosure"] === "line");
    expect(element).toBeDefined(); return element!.props;
}
beforeEach(() => {
    replay.slots = []; replay.cursor = 0; replay.mode.mockReset().mockResolvedValue(undefined); replay.other.mockReset(); replay.replace.mockReset();
    replay.estimates = [{ id: "estimate", project_id: "project", version_name: "Estimate v1", overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 10, is_active: true, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Example work", quantity: 1, unit: "item", unit_rate: 10, line_total: 10, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] }];
});
describe("resource panel opening", () => {
    it("retains a manual resource draft across closure/line-edit/mode attempts until explicit resolution", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onDraftChanged)!;
        const callback = panel.props.onDraftChanged as (id: string, open: boolean) => void;
        const close = disclosure().onClick as () => void;
        const oldTree = view();
        const removeEstimate = nodes(oldTree).find(e => e.props["aria-label"] === "Delete this estimate")!.props.onClick as () => void;
        const newEstimate = nodes(oldTree).find(e => e.type === "button" && JSON.stringify(e.props.children).includes("Add an alternative"))!.props.onClick as () => void;
        const mode = nodes(oldTree).find(e => e.props.title === "Build up from first principles")!.props.onClick as () => void;
        callback("line", true); close();
        removeEstimate(); newEstimate(); mode();
        expect(disclosure()["aria-expanded"]).toBe(true); expect(disclosure().disabled).toBe(true);
        (lineEditor().props.onUpdate as (id: string, patch: unknown) => void)("line", { quantity: 100 });
        expect(replay.other).not.toHaveBeenCalled();
        expect(replay.mode).not.toHaveBeenCalled();
        callback("line", false); close();
        expect(disclosure()["aria-expanded"]).toBe(false);
    });
    it("fences panel closure until a library save finishes, using a separate parent ledger key", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onLibrarySaveStateChanged)!;
        const close = disclosure().onClick as () => void;
        const status = panel.props.onLibrarySaveStateChanged as (id: string, state: string) => void;
        status("line", "saving"); close();
        expect(disclosure()["aria-expanded"]).toBe(true); expect(disclosure().disabled).toBe(true);
        status("line", "uncertain");
        expect(disclosure().disabled).toBe(false);
        close(); expect(disclosure()["aria-expanded"]).toBe(false);
        expect(replay.other).not.toHaveBeenCalled(); expect(replay.mode).not.toHaveBeenCalled();
    });

    it("retains uncertain save state when resources are closed and reopened", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onSaveStateChanged && e.props.line)!;
        (panel.props.onSaveStateChanged as (id: string, state: string) => void)("line", "uncertain");
        (disclosure().onClick as () => void)();
        (disclosure().onClick as () => void)();
        const reopened = nodes(view()).find(e => e.props.onSaveStateChanged && e.props.line)!;
        expect(reopened.props.saveBlocked).toBe(true);
        expect(replay.mode).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
    });

    it("cannot close the resource panel while its saves are pending", () => {
        (disclosure().onClick as () => void)();
        const tree = view();
        const panel = nodes(tree).find(e => e.props.onSaveStateChanged && e.props.line)!;
        const close = nodes(tree).find(e => e.props["data-resource-disclosure"] === "line")!;
        (panel.props.onSaveStateChanged as (id: string, state: string) => void)("line", "saving");
        (close.props.onClick as () => void)();
        expect(disclosure()["aria-expanded"]).toBe(true);
        expect(disclosure().disabled).toBe(true);
        (panel.props.onSaveStateChanged as (id: string, state: string) => void)("line", "confirmed");
        expect(disclosure().disabled).toBe(false);
    });

    it("updates resources without replacing the current line price with an unconfirmed calculation", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onComponentsChanged && e.props.line);
        expect(panel).toBeDefined();
        (panel!.props.onComponentsChanged as (id: string, rows: unknown[], rate: number) => void)("line", [], 99);
        expect(replay.estimates[0].estimate_lines[0].unit_rate).toBe(10);
        expect(replay.estimates[0].estimate_lines[0].line_total).toBe(10);
        expect(replay.estimates[0].total_cost).toBe(10);
        expect(replay.other).not.toHaveBeenCalled(); expect(replay.mode).not.toHaveBeenCalled();
    });

    it("updates line and estimate totals only through the acknowledged-rate callback", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onComponentsChanged && e.props.line);
        expect(panel?.props.onRateApplied).toBeTypeOf("function");
        (panel!.props.onRateApplied as (id: string, rate: number, quantity: number, total: number) => void)("line", 30, 1, 30);
        expect(replay.estimates[0].estimate_lines[0].unit_rate).toBe(30);
        expect(replay.estimates[0].estimate_lines[0].line_total).toBe(30);
        expect(replay.estimates[0].total_cost).toBe(30);
        expect(replay.estimates[0].estimate_lines[0].pricing_mode).toBe("simple");
        expect(replay.other).not.toHaveBeenCalled(); expect(replay.mode).not.toHaveBeenCalled();
    });

    it("does not overwrite a newer parent quantity with a late rate acknowledgement", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onComponentsChanged && e.props.line)!;
        replay.estimates[0].estimate_lines[0] = { ...replay.estimates[0].estimate_lines[0], quantity: 2, unit_rate: 12, line_total: 24 };
        replay.estimates[0].total_cost = 24;
        (panel.props.onRateApplied as (id: string, rate: number, quantity: number, total: number) => void)("line", 30, 1, 30);
        expect(replay.estimates[0].estimate_lines[0]).toMatchObject({ quantity: 2, unit_rate: 12, line_total: 24 });
        expect(replay.estimates[0].total_cost).toBe(24);
        expect(replay.other).not.toHaveBeenCalled();
    });

    it("uses the acknowledged stored total without recomputing a different price", () => {
        (disclosure().onClick as () => void)();
        const panel = nodes(view()).find(e => e.props.onComponentsChanged && e.props.line)!;
        replay.estimates[0].estimate_lines[0].quantity = 3;
        (panel.props.onRateApplied as (id: string, rate: number, quantity: number, total: number) => void)("line", 10.12, 3, 30.37);
        expect(replay.estimates[0].estimate_lines[0]).toMatchObject({ unit_rate: 10.12, line_total: 30.37 });
        expect(replay.estimates[0].total_cost).toBe(30.37);
    });

    it("opens and closes the real parent disclosure without changing mode, estimate or actions", () => {
        const before = JSON.stringify(replay.estimates);
        expect(disclosure()["aria-expanded"]).toBe(false);
        (disclosure().onClick as () => void)();
        expect(disclosure()["aria-expanded"]).toBe(true);
        expect(JSON.stringify(replay.estimates)).toBe(before);
        (disclosure().onClick as () => void)();
        expect(disclosure()["aria-expanded"]).toBe(false);
        expect(replay.mode).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled(); expect(replay.replace).not.toHaveBeenCalled();
    });
    it("retains the existing pricing-mode action behind an explicit separate choice", () => {
        const initial = nodes(view()).find(e => e.props.title === "Build up from first principles");
        if (!initial) (disclosure().onClick as () => void)();
        const mode = nodes(view()).find(e => e.props.title === "Build up from first principles");
        expect(mode).toBeDefined();
        (mode!.props.onClick as () => void)();
        expect(replay.mode).toHaveBeenCalledExactlyOnceWith("line", "buildup");
        expect(replay.estimates[0].estimate_lines[0].pricing_mode).toBe("buildup");
    });
});

function lineEditor() { return nodes(view()).find(e => e.props.onUpdate && (e.props.line as { id?: string })?.id === "line")!; }
function resourcePanel() { return nodes(view()).find(e => e.props.onComponentsChanged && e.props.line)!; }
function lineRequest() {
    let resolve!: (value: { success: boolean; line?: Record<string, unknown>; error?: string }) => void;
    const promise = new Promise<{ success: boolean; line?: Record<string, unknown>; error?: string }>(ok => { resolve = ok; });
    return { promise, resolve };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

describe("parent quantity and rate confirmation", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not send an old captured rate with a quantity edit", async () => {
        const update = lineEditor().props.onUpdate as (id: string, patch: unknown) => void;
        replay.estimates[0].estimate_lines[0] = { ...replay.estimates[0].estimate_lines[0], unit_rate: 30, line_total: 30 };
        replay.other.mockResolvedValueOnce({ success: true, line: { id: "line", quantity: 2, unit_rate: 30, line_total: 60 } });
        update("line", { quantity: 2 }); await settle();
        expect(replay.other).toHaveBeenCalledExactlyOnceWith("line", { quantity: 2 });
        expect(replay.estimates[0].estimate_lines[0]).toMatchObject({ quantity: 2, unit_rate: 30, line_total: 60 });
        expect(replay.estimates[0].total_cost).toBe(60);
    });

    it("orders quantity/rate writes and retains newer field drafts until their acknowledgement", async () => {
        const first = lineRequest(); const second = lineRequest();
        replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const update = lineEditor().props.onUpdate as (id: string, patch: unknown) => void;
        update("line", { quantity: 2 }); update("line", { unit_rate: 12 });
        expect(replay.other).toHaveBeenCalledTimes(1);
        first.resolve({ success: true, line: { id: "line", quantity: 2, unit_rate: 10, line_total: 20 } }); await settle();
        expect(replay.estimates[0].estimate_lines[0]).toMatchObject({ quantity: 2, unit_rate: 12, line_total: 24 });
        expect(replay.other).toHaveBeenNthCalledWith(2, "line", { unit_rate: 12 });
        second.resolve({ success: true, line: { id: "line", quantity: 2, unit_rate: 12, line_total: 24 } }); await settle();
        expect(replay.estimates[0].total_cost).toBe(24);
    });

    it("uses stored numeric readback even when a newer description was queued", async () => {
        const first = lineRequest(); const second = lineRequest();
        replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const update = lineEditor().props.onUpdate as (id: string, patch: unknown) => void;
        update("line", { quantity: 2.123456 }); update("line", { description: "Renamed work" });
        first.resolve({ success: true, line: { id: "line", quantity: 2.123, unit_rate: 10, line_total: 21.23 } }); await settle();
        second.resolve({ success: true, line: { id: "line", description: "Renamed work" } }); await settle();
        expect(replay.estimates[0].estimate_lines[0]).toMatchObject({ description: "Renamed work", quantity: 2.123, unit_rate: 10, line_total: 21.23 });
        expect(replay.estimates[0].total_cost).toBe(21.23);
    });

    it("pauses resource editing/Apply while the priced line is pending, without rescaling resources", async () => {
        (disclosure().onClick as () => void)();
        const request = lineRequest(); replay.other.mockReturnValueOnce(request.promise);
        const before = JSON.stringify(replay.estimates[0].estimate_lines[0].estimate_line_components);
        (lineEditor().props.onUpdate as (id: string, patch: unknown) => void)("line", { quantity: 2 });
        expect(resourcePanel().props.priceSavePending).toBe(true);
        expect((resourcePanel().props.canApplyRate as () => boolean)()).toBe(false);
        request.resolve({ success: true, line: { id: "line", quantity: 2, unit_rate: 10, line_total: 20 } }); await settle();
        expect(resourcePanel().props.priceSavePending).toBe(false);
        expect((resourcePanel().props.canApplyRate as () => boolean)()).toBe(true);
        expect(JSON.stringify(replay.estimates[0].estimate_lines[0].estimate_line_components)).toBe(before);
    });

    it("prevents a stale quantity callback from racing an in-flight resource Apply", () => {
        (disclosure().onClick as () => void)();
        const update = lineEditor().props.onUpdate as (id: string, patch: unknown) => void;
        const applied = resourcePanel().props.onApplyPendingChanged as (id: string, pending: boolean) => void;
        applied("line", true);
        update("line", { quantity: 2 });
        expect(replay.other).not.toHaveBeenCalled();
        expect(replay.estimates[0].estimate_lines[0].quantity).toBe(1);
        expect(lineEditor().props.saveBlocked).toBe(true);
        applied("line", false);
        expect(lineEditor().props.saveBlocked).toBe(false);
    });

    it("retains uncertain drafts, stops later writes and blocks resource Apply", async () => {
        (disclosure().onClick as () => void)();
        const request = lineRequest(); replay.other.mockReturnValueOnce(request.promise);
        const update = lineEditor().props.onUpdate as (id: string, patch: unknown) => void;
        update("line", { quantity: 2 }); update("line", { unit_rate: 12 });
        request.resolve({ success: false, error: "Not confirmed; may already have saved" }); await settle();
        expect(replay.other).toHaveBeenCalledTimes(1);
        expect(lineEditor().props.saveBlocked).toBe(true);
        expect(resourcePanel().props.saveBlocked).toBe(true);
        expect(replay.estimates[0].estimate_lines[0]).toMatchObject({ quantity: 2, unit_rate: 12 });
        update("line", { quantity: 3 }); expect(replay.other).toHaveBeenCalledTimes(1);
    });
});
