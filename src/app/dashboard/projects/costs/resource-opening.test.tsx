import { beforeEach, describe, expect, it, vi } from "vitest";
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
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: (callback: unknown) => callback,
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
        (panel!.props.onRateApplied as (id: string, rate: number) => void)("line", 30);
        expect(replay.estimates[0].estimate_lines[0].unit_rate).toBe(30);
        expect(replay.estimates[0].estimate_lines[0].line_total).toBe(30);
        expect(replay.estimates[0].total_cost).toBe(30);
        expect(replay.estimates[0].estimate_lines[0].pricing_mode).toBe("simple");
        expect(replay.other).not.toHaveBeenCalled(); expect(replay.mode).not.toHaveBeenCalled();
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
