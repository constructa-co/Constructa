import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, server: vi.fn(), dispatch: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
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
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.server, updateSimplePriceLineAction: current.server, deleteSimplePriceLineAction: current.server, savePriceAdjustmentsAction: current.server, loadAdvancedEstimatingDataAction: current.server }));
import EstimateClient from "./estimate-client";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function visibleText(value: unknown): string {
    if (Array.isArray(value)) return value.map(visibleText).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (value && typeof value === "object" && "props" in value) return visibleText((value as Element).props.children);
    return "";
}
function view(scope = "Prepare walls.\n\nPaint walls.\n\nSite, access and assumptions:\nPrivate access notes.") {
    current.cursor = 0;
    return EstimateClient({ estimates: [], project: { id: "job", name: "Example room", client_name: "", brief_scope: scope } });
}
function button(scope?: string) {
    const element = nodes(view(scope)).find(e => e.props["data-brief-price-draft"]);
    expect(element).toBeDefined(); return element!;
}
beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Existing work", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.slots = []; current.cursor = 0; current.server.mockReset();
    current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
});
describe("reviewed brief-to-draft entry", () => {
    it("opens only a source-derived empty-price draft, not saved lines or a simulated AI reply", () => {
        const before = JSON.stringify(current.state!.estimates), control = button();
        expect(control.props.disabled).toBe(false);
        (control.props.onClick as () => void)();
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Prepare walls. Paint walls." });
        expect(current.state!.ops[NEW_LINE_KEY].kind).toBe("add");
        expect(JSON.stringify(current.state!.estimates)).toBe(before);
        expect(current.server).not.toHaveBeenCalled();
        expect(visibleText(view())).not.toContain("Private access notes.");
    });
    it("rechecks open work at click time so a repeated stale click cannot overwrite typing", () => {
        const click = button().props.onClick as () => void;
        click();
        current.state = estimatingReducer(current.state!, { type: "op/change", key: NEW_LINE_KEY, patch: { description: "My later typing" } });
        click();
        expect(current.state!.ops[NEW_LINE_KEY].draft.description).toBe("My later typing");
        expect(current.dispatch).toHaveBeenCalledTimes(1);
        expect(button().props.disabled).toBe(true);
        expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["open-line", "adjustments", "advanced", "client-boq"])("does not bypass %s work/control boundaries", boundary => {
        if (boundary === "open-line") current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "edit", lineId: "line", draft: EMPTY_PRICE_LINE_DRAFT });
        if (boundary === "adjustments") current.state!.adjustments.status = "saving";
        if (boundary === "advanced") current.state!.advancedOpen = true;
        if (boundary === "client-boq") current.state!.estimates[0].is_client_boq = true;
        const before = JSON.stringify(current.state), control = button();
        expect(control.props.disabled).toBe(true);
        (control.props.onClick as () => void)();
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.server).not.toHaveBeenCalled();
    });
    it("refuses an old render after a saved price changes even though the brief has not changed", () => {
        const click = button().props.onClick as () => void;
        current.state!.estimates[0].estimate_lines[0].unit_rate = 999;
        click();
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.server).not.toHaveBeenCalled();
        expect(visibleText(view())).toContain("changed after this was prepared");
    });
    it("handles a first estimate without creating server records or assigning a price", () => {
        current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
        (button("Whole room renovation").props.onClick as () => void)();
        expect(current.state!.estimates).toEqual([]);
        expect(current.state!.ops[NEW_LINE_KEY].draft).toMatchObject({ description: "Whole room renovation", amount: "", quantity: "", rate: "" });
        expect(current.server).not.toHaveBeenCalled();
    });
    it("refuses oversized descriptions without silent truncation, leaving normal manual entry available", () => {
        const control = button("x".repeat(501));
        expect(control.props.disabled).toBe(true);
        (control.props.onClick as () => void)();
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(visibleText(view("x".repeat(501)))).toContain("nothing has been truncated");
        expect(nodes(view("x".repeat(501))).some(e => e.type === "button" && String(e.props.children).includes("Add a price line"))).toBe(true);
    });
});
