import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, dispatch: vi.fn(), action: vi.fn(), setItem: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(), useEffect: () => undefined, useMemo: (calculate: () => unknown) => calculate(),
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (value: unknown) => { current.slots[i] = typeof value === "function" ? value(current.slots[i]) : value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.action, updateSimplePriceLineAction: current.action, deleteSimplePriceLineAction: current.action, savePriceAdjustmentsAction: current.action, loadAdvancedEstimatingDataAction: current.action }));
import EstimateClient from "./estimate-client";

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
const project = { id: "job", name: "Kitchen job", client_name: "QA", brief_scope: "Fit cupboards" };
const estimate = (id: string, active: boolean): Estimate => ({ id, project_id: "job", version_name: id === "a" ? "Original price" : "Alternative <price>", is_active: active, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 100, estimate_lines: [] });
function view() { current.cursor = 0; return EstimateClient({ estimates: [], project }); }
function disclosure() { const element = nodes(view()).find(e => e.type === "details" && e.props["data-estimate-versions"]); expect(element).toBeDefined(); return element!; }
function selector() { return nodes(view()).find(e => e.type === "select" && e.props.id === "estimate-version")!; }
beforeEach(() => {
    current.state = initialEstimatingState([estimate("a", true), estimate("b", false)], { pendingEstimateId: "pending" });
    current.slots = []; current.cursor = 0; current.action.mockReset(); current.setItem.mockReset();
    current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    vi.stubGlobal("window", { sessionStorage: { setItem: current.setItem } });
});
afterEach(() => vi.unstubAllGlobals());

describe("simple price version placement and draft boundary", () => {
    it.each([0, 1])("keeps the first-price journey free of version controls with %s saved estimates", count => {
        current.state = initialEstimatingState(count ? [estimate("a", true)] : [], { pendingEstimateId: "pending" });
        expect(nodes(view()).some(e => e.props["data-estimate-versions"])).toBe(false);
        expect(nodes(view()).some(e => e.type === "select" && e.props.id === "estimate-version")).toBe(false);
        expect(current.action).not.toHaveBeenCalled(); expect(current.dispatch).not.toHaveBeenCalled();
    });
    it("puts the existing selector behind a closed optional native disclosure after totals", () => {
        const root = nodes(view()); const details = disclosure();
        expect(details.props.open).not.toBe(true);
        expect(text(nodes(details).find(e => e.type === "summary"))).toContain("Estimate versions");
        expect(nodes(details).some(e => e.props.id === "estimate-version")).toBe(true);
        const children = (view().props.children as unknown[]).filter(Boolean);
        expect(children.findIndex(e => nodes(e).some(n => n.props["data-estimate-versions"]))).toBeGreaterThan(children.findIndex(e => nodes(e).some(n => typeof n.props.onSave === "function" && n.props.summary)));
        expect(root.some(e => e.type === "label" && e.props.htmlFor === "estimate-version")).toBe(true);
    });
    it("keeps the current version and its proposal-use warning outside the closed disclosure", () => {
        current.state = estimatingReducer(current.state!, { type: "estimate/select", estimateId: "b" });
        const currentVersion = nodes(view()).find(e => e.props["data-current-estimate"]);
        expect(currentVersion).toBeDefined();
        expect(text(currentVersion)).toContain("Alternative <price>");
        expect(text(currentVersion)).toContain("not used in the proposal");
        expect(nodes(disclosure()).some(e => e.props["data-current-estimate"])).toBe(false);
    });
    it("opening/closing the disclosure adds no stateful toggle or write callback", () => {
        const snapshot = JSON.stringify(current.state);
        expect(disclosure().props.onToggle).toBeUndefined();
        expect(disclosure().props.onClick).toBeUndefined();
        expect(JSON.stringify(current.state)).toBe(snapshot);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.action).not.toHaveBeenCalled(); expect(current.setItem).not.toHaveBeenCalled();
    });
    it("keeps every version and uses the existing select/reducer/session key without any server action", () => {
        const select = selector();
        expect(nodes(select).filter(e => e.type === "option").map(e => e.props.value)).toEqual(["a", "b"]);
        (select.props.onChange as (event: unknown) => void)({ target: { value: "b" } });
        expect(current.state!.activeEstimateId).toBe("b");
        expect(current.state!.estimates.map(e => e.id)).toEqual(["a", "b"]);
        expect(current.setItem).toHaveBeenCalledExactlyOnceWith("constructa_tab_job", "b");
        expect(current.action).not.toHaveBeenCalled();
    });
    it.each(["line", "adjustment", "saving", "failed"])("does not discard %s work when switching versions, including a stale callback", kind => {
        const change = selector().props.onChange as (event: unknown) => void;
        if (kind === "line") current.state = estimatingReducer(current.state!, { type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "My draft", amount: "1234" } });
        else {
            current.state = estimatingReducer(current.state!, { type: "adjustments/change", patch: { profit: "12" } });
            if (kind === "saving") current.state!.adjustments.status = "saving";
            if (kind === "failed") current.state!.adjustments.status = "failed";
        }
        const snapshot = JSON.stringify(current.state);
        expect(selector().props.disabled).toBe(true);
        expect(text(disclosure())).toContain("Save or cancel");
        change({ target: { value: "b" } });
        expect(JSON.stringify(current.state)).toBe(snapshot);
        expect(current.setItem).not.toHaveBeenCalled(); expect(current.action).not.toHaveBeenCalled();
    });
    it.each(["a", "unknown", ""])("ignores a no-op or invalid selection %j rather than clearing existing state/cache", id => {
        (selector().props.onChange as (event: unknown) => void)({ target: { value: id } });
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.setItem).not.toHaveBeenCalled();
    });
});
