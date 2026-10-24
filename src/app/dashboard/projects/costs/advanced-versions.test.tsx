import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, actions: vi.fn(), create: vi.fn(), rename: vi.fn(), active: vi.fn(), remove: vi.fn(), select: vi.fn(), tasks: [] as Promise<unknown>[], estimates: [] as Estimate[], activeId: "a" }));
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
    useId: () => "versions-test", useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
    useTransition: () => [false, (callback: () => unknown) => { replay.tasks.push(Promise.resolve(callback())); }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ createEstimateAction: replay.create, updateEstimateMarginsAction: replay.actions, updateEstimateNameAction: replay.rename, addLineItemAction: replay.actions, updateLineItemAction: replay.actions, deleteLineItemAction: replay.actions, setActiveEstimateAction: replay.active, deleteEstimateAction: replay.remove, setPricingModeAction: replay.actions, saveDiscountAction: replay.actions }));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.actions }));
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
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
function view() {
    replay.cursor = 0;
    return AdvancedEstimate({ estimates: replay.estimates, setEstimates: update => { replay.estimates = update(replay.estimates); }, activeTab: replay.activeId, setActiveTab: replay.select, costLibrary: [], projectId: "job", orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] });
}
function manager() { const details = nodes(view()).find(e => e.type === "details" && e.props["data-advanced-estimate-versions"]); expect(details).toBeDefined(); return details!; }
const estimate = (id: string, active: boolean): Estimate => ({ id, project_id: "job", version_name: `Saved ${id}`, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 100, is_active: active, estimate_lines: [] });
beforeEach(() => {
    vi.useFakeTimers(); replay.slots = []; replay.cursor = 0; replay.tasks = []; replay.activeId = "a";
    for (const action of [replay.actions, replay.create, replay.rename, replay.active, replay.remove, replay.select]) action.mockReset();
    replay.create.mockResolvedValue({ id: "c", project_id: "job", version_name: "Estimate v3" });
    replay.rename.mockResolvedValue(undefined); replay.active.mockResolvedValue(undefined); replay.remove.mockResolvedValue(undefined);
    replay.select.mockImplementation(id => { replay.activeId = id; });
    replay.estimates = [estimate("a", true), estimate("b", false)];
    vi.stubGlobal("confirm", vi.fn(() => false));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("advanced secondary version controls", () => {
    it("groups selection, creation, naming and proposal/delete controls under one closed native disclosure", () => {
        replay.activeId = "b";
        const details = manager();
        expect(details.props.open).not.toBe(true);
        expect(text(nodes(details).find(e => e.type === "summary"))).toContain("Estimate versions");
        expect(text(details)).toContain("Add an alternative");
        expect(nodes(details).some(e => e.props["aria-label"] === "Estimate Name")).toBe(true);
        expect(nodes(details).some(e => e.props["aria-label"] === "Delete this estimate")).toBe(true);
        expect(text(details)).toContain("Use in Proposal");
        expect(nodes(details).some(e => e.props["aria-label"] === "Profit %")).toBe(false);
    });
    it("retains current proposal-use status outside the closed management controls", () => {
        replay.activeId = "b";
        const marker = nodes(view()).find(e => e.props["data-advanced-current-estimate"]);
        expect(text(marker)).toContain("Saved b"); expect(text(marker)).toContain("not used in the proposal");
        expect(nodes(manager()).some(e => e.props["data-advanced-current-estimate"])).toBe(false);
    });
    it("mounting and native disclosure open/close have no mutation or selection callback", () => {
        const before = JSON.stringify(replay.estimates);
        expect(manager().props.onToggle).toBeUndefined(); expect(manager().props.onClick).toBeUndefined();
        view(); expect(JSON.stringify(replay.estimates)).toBe(before);
        for (const action of [replay.actions, replay.create, replay.rename, replay.active, replay.remove, replay.select]) expect(action).not.toHaveBeenCalled();
    });
    it("keeps every existing tab and its same selection callback", () => {
        const buttons = nodes(manager()).filter(e => e.type === "button" && ["a", "b"].includes(String(e.key)));
        expect(buttons.map(e => e.key)).toEqual(["a", "b"]);
        (buttons[1].props.onClick as () => void)();
        expect(replay.select).toHaveBeenCalledExactlyOnceWith("b");
        expect(replay.estimates.map(e => e.id)).toEqual(["a", "b"]);
        expect(replay.active).not.toHaveBeenCalled();
    });
    it("keys the existing uncontrolled name input by estimate so a switch cannot relabel another version", () => {
        const first = nodes(manager()).find(e => e.props["aria-label"] === "Estimate Name")!;
        replay.activeId = "b";
        const second = nodes(manager()).find(e => e.props["aria-label"] === "Estimate Name")!;
        expect(first.key).toBe("a"); expect(second.key).toBe("b");
        expect(first.props.defaultValue).toBe("Saved a"); expect(second.props.defaultValue).toBe("Saved b");
        expect(nodes(manager()).some(e => e.type === "label" && e.props.htmlFor === second.props.id)).toBe(true);
    });
    it("retains the existing explicit alternative creation action, name convention and defaults", async () => {
        const button = nodes(manager()).find(e => e.type === "button" && text(e).includes("Add an alternative"))!;
        (button.props.onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.create).toHaveBeenCalledExactlyOnceWith("job", "Estimate v3");
        expect(replay.estimates.map(e => e.id)).toEqual(["a", "b", "c"]);
        expect(replay.estimates[2]).toMatchObject({ is_active: false, overhead_pct: 10, profit_pct: 15, risk_pct: 0, prelims_pct: 10, estimate_lines: [] });
        expect(replay.select).toHaveBeenCalledWith("c");
    });
    it("retains the name blur handler and its exact target without another creation or active switch", async () => {
        const input = nodes(manager()).find(e => e.props["aria-label"] === "Estimate Name")!;
        (input.props.onBlur as (event: unknown) => void)({ target: { value: "Contractor's option" } }); await Promise.resolve();
        expect(replay.rename).toHaveBeenCalledExactlyOnceWith("a", "Contractor's option");
        expect(replay.estimates[0].version_name).toBe("Contractor's option"); expect(replay.estimates[1].version_name).toBe("Saved b");
        expect(replay.create).not.toHaveBeenCalled(); expect(replay.active).not.toHaveBeenCalled();
    });
    it("keeps the existing explicit proposal-selection action without auto-selecting it from a tab", async () => {
        replay.activeId = "b";
        const button = nodes(manager()).find(e => e.type === "button" && text(e).trim() === "Use in Proposal")!;
        (button.props.onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.active).toHaveBeenCalledExactlyOnceWith("b", "job");
        expect(replay.estimates.map(e => e.is_active)).toEqual([false, true]);
    });
    it("preserves the existing cancellation-before-delete boundary", () => {
        const button = nodes(manager()).find(e => e.props["aria-label"] === "Delete this estimate")!;
        (button.props.onClick as () => void)();
        expect(confirm).toHaveBeenCalledWith("Delete this estimate and all its line items?");
        expect(replay.remove).not.toHaveBeenCalled(); expect(replay.estimates).toHaveLength(2);
    });
    it("offers first detailed-price creation without asking for a version name", () => {
        replay.estimates = []; replay.activeId = "";
        const elements = nodes(view());
        expect(elements.some(e => e.props["data-advanced-estimate-versions"])).toBe(false);
        expect(elements.some(e => e.props["aria-label"] === "Estimate Name")).toBe(false);
        expect(elements.some(e => e.type === "button" && text(e).includes("Start detailed pricing"))).toBe(true);
        expect(replay.create).not.toHaveBeenCalled();
    });
});
