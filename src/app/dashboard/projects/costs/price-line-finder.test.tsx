import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, currentSummary, draftFromLine, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

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
function view() { current.cursor = 0; return EstimateClient({ estimates: [], project: { id: "job", name: "Room", client_name: "", brief_scope: "Prepare walls" } }); }
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.update.mockReset(); current.other.mockReset(); current.dispatch.mockReset();
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 400, estimate_lines: [line("one"), line("two")] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.dispatch.mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.update.mockImplementation(async (_estimateId, id, input) => ({ ok: true, line: { id, ...input, line_total: input.quantity * input.unit_rate } }));
});


function groupToggle() { return nodes(view()).find(n => n.props["data-price-activity-view"])!; }
function toggleGroups() { (groupToggle().props.onClick as () => void)(); }
function priceRows() { return nodes(view()).filter(n => typeof n.type === "function" && n.props.line); }
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
function subRows() { return nodes(view()).filter(n => n.props["data-activity-subtotal"]); }

function openFinder() { (nodes(view()).find(n => n.props["data-price-find-toggle"])!.props.onClick as () => void)(); }
function query(value: string) { (nodes(view()).find(n => n.props.id === "price-line-find-query")!.props.onChange as (event: unknown) => void)({ target: { value } }); }
function button(label: string) { return nodes(view()).find(n => n.type === "button" && n.props.children === label)!; }
function targets() {
    const rows = current.state!.estimates.find(e => e.id === current.state!.activeEstimateId)!.estimate_lines.map(line => ({
        getAttribute: () => line.id, focus: vi.fn(), scrollIntoView: vi.fn(),
    }));
    const selector = vi.fn().mockReturnValue(rows);
    const table = nodes(view()).find(n => n.type === "table")!;
    (table.props.ref as { current: unknown }).current = { querySelectorAll: selector };
    return { rows, selector };
}
describe("price finder in the actual main pricing workspace", () => {
    it("closes the visible finder when the final price line disappears", () => {
        openFinder(); query("walls"); const oldNext = button("Next match").props.onClick as () => void;
        const dom = targets(); current.state!.estimates[0].estimate_lines = [];
        oldNext(); expect(nodes(view()).some(n => n.props.id === "price-line-find-query")).toBe(false);
        expect(dom.rows.every(r => r.focus.mock.calls.length === 0)).toBe(true);
        expect(current.other).not.toHaveBeenCalled();
    });
    it("starts closed and only reveals optional local controls", () => {
        expect(nodes(view()).some(n => n.props.id === "price-line-find-query")).toBe(false);
        const before = JSON.stringify(current.state); openFinder();
        expect(button("Next match").props.disabled).toBe(true);
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
    it("highlights description/activity matches without filtering rows, changing keys or moving focus on typing", () => {
        const before = JSON.stringify(current.state), keys = priceRows().map(r => r.key);
        openFinder(); const dom = targets(); query("decoration");
        expect(priceRows().map(r => r.key)).toEqual(keys);
        expect(priceRows().every(r => r.props.finderMatch === true)).toBe(true);
        expect(text(view())).toContain("2 matching lines");
        expect(dom.rows.every(r => r.focus.mock.calls.length === 0 && r.scrollIntoView.mock.calls.length === 0)).toBe(true);
        query("Walls one"); expect(priceRows().map(r => r.props.finderMatch)).toEqual([true, false]);
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
    });
    it("moves only on explicit navigation, wraps and uses a scoped fixed selector", () => {
        openFinder(); query("walls"); const dom = targets();
        (button("Next match").props.onClick as () => void)();
        expect(dom.rows[0].focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(dom.rows[0].scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "auto" });
        expect(priceRows().map(r => r.props.finderCurrent)).toEqual([true, false]);
        (button("Previous match").props.onClick as () => void)();
        expect(priceRows().map(r => r.props.finderCurrent)).toEqual([false, true]);
        expect(text(view())).toContain("current 2 of 2");
        expect(dom.selector).toHaveBeenCalledWith("[data-price-line]");
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
    it("does not interpolate hostile line IDs into DOM selectors", () => {
        current.state!.estimates[0].estimate_lines[0].id = 'one"]<script>';
        openFinder(); query("Walls one"); const dom = targets();
        (button("Next match").props.onClick as () => void)();
        expect(dom.selector).toHaveBeenCalledExactlyOnceWith("[data-price-line]");
        expect(dom.rows[0].focus).toHaveBeenCalledOnce();
        expect(priceRows()[0].props.finderCurrent).toBe(true);
    });
    it("keeps every line and full activity/contract totals when there are no matches", () => {
        const before = currentSummary(current.state!); toggleGroups();
        const subtotals = text(subRows()), keys = priceRows().map(r => r.key);
        openFinder(); query("not in this estimate"); const dom = targets();
        (button("Next match").props.onClick as () => void)();
        expect(button("Next match").props.disabled).toBe(true);
        expect(text(view())).toContain("No matching price lines");
        expect(priceRows().map(r => r.key)).toEqual(keys); expect(text(subRows())).toBe(subtotals);
        expect(currentSummary(current.state!)).toEqual(before); expect(dom.selector).not.toHaveBeenCalled();
    });
    it("retains an unsaved draft and its original explicit Save callback across finding", async () => {
        current.dispatch({ type: "op/open", key: "one", kind: "edit", lineId: "one", draft: { ...draftFromLine(line("one")), description: "Revised unsaved work", rate: "30" } });
        const save = priceRows()[0].props.onSave as () => void, before = JSON.stringify(current.state!.ops);
        openFinder(); query("Revised unsaved"); expect(text(view())).toContain("No matching price lines");
        query("Walls two"); targets(); (button("Next match").props.onClick as () => void)();
        expect(JSON.stringify(current.state!.ops)).toBe(before); expect(current.update).not.toHaveBeenCalled();
        save(); await Promise.resolve(); await Promise.resolve();
        expect(current.update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "Revised unsaved work", quantity: 10, unit: "m2", unit_rate: 30 });
    });
    it.each(["failed", "saving"] as const)("never clears or confirms a %s price draft", status => {
        current.dispatch({ type: "op/open", key: "one", kind: "edit", lineId: "one", draft: draftFromLine(line("one")) });
        current.state!.ops.one.status = status; current.state!.ops.one.error = "Keep this response state";
        const before = JSON.stringify(current.state!.ops); openFinder(); query("walls"); targets();
        (button("Next match").props.onClick as () => void)(); (button("Clear finder").props.onClick as () => void)(); openFinder();
        expect(JSON.stringify(current.state!.ops)).toBe(before); expect(current.update).not.toHaveBeenCalled();
    });
    it("retains a new draft and delete confirmation while navigating", () => {
        current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new-id", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "New draft", amount: "999" } });
        current.dispatch({ type: "op/open", key: "one", kind: "delete", lineId: "one", draft: draftFromLine(line("one")) });
        const before = JSON.stringify(current.state); openFinder(); query("walls"); targets();
        (button("Previous match").props.onClick as () => void)();
        expect(JSON.stringify(current.state)).toBe(before);
        expect(nodes(view()).find(n => n.props["data-inline-add"])!.key).toBe("new-id");
        expect(current.other).not.toHaveBeenCalled();
    });
    it("uses fresh query and membership even for an older navigation handler", () => {
        openFinder(); query("walls"); const oldNext = button("Next match").props.onClick as () => void, dom = targets();
        query("nothing"); oldNext(); expect(dom.selector).not.toHaveBeenCalled();
        query("walls"); current.state!.estimates[0].estimate_lines.shift(); oldNext();
        expect(dom.rows[0].focus).not.toHaveBeenCalled(); expect(dom.rows[1].focus).toHaveBeenCalledOnce();
    });
    it("refuses old navigation after an estimate switch,Advanced opening or table unmount", () => {
        openFinder(); query("walls"); const oldNext = button("Next match").props.onClick as () => void, dom = targets();
        current.state!.advancedOpen = true; oldNext(); expect(dom.selector).not.toHaveBeenCalled();
        current.state!.advancedOpen = false;
        current.state!.activeEstimateId = "another"; oldNext(); expect(dom.selector).not.toHaveBeenCalled();
        current.state!.activeEstimateId = "estimate";
        (nodes(view()).find(n => n.type === "table")!.props.ref as { current: unknown }).current = null;
        oldNext(); expect(dom.rows.every(r => r.focus.mock.calls.length === 0)).toBe(true);
    });
    it.each(["dark", "light"])("renders scoped match/current markers,labels and safe text in %s theme", theme => {
        current.theme = theme; current.state!.estimates[0].estimate_lines[0].description = "<script>literal work</script>";
        openFinder(); query("<script>"); targets(); (button("Next match").props.onClick as () => void)();
        const html = renderToStaticMarkup(view());
        expect(html).toContain('data-price-find-match="true"'); expect(html).toContain('data-price-find-current="true"');
        expect(html).toContain('tabindex="-1"'); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
        expect(html).toContain('type="search"'); expect(html).toContain('aria-live="polite"');
        expect(html).toContain("All rows stay visible"); expect(html).not.toContain("autofocus");
    });
    it("keeps readonly client BoQ rows findable without changing their locks", () => {
        current.state!.estimates[0].is_client_boq = true; openFinder(); query("decoration"); targets();
        (button("Next match").props.onClick as () => void)();
        expect(priceRows().every(r => r.props.editable === false)).toBe(true);
        expect(priceRows().map(r => r.props.finderMatch)).toEqual([true, true]);
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
});
