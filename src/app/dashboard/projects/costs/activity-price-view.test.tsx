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
describe("optional activity breakdown in the actual price table", () => {
    it("starts in the unchanged simple view; toggling makes no dispatch/server write and keeps saved row keys/order", () => {
        const before = JSON.stringify(current.state), keys = priceRows().map(row => row.key);
        expect(groupToggle().props["aria-pressed"]).toBe(false); expect(subRows()).toEqual([]);
        current.dispatch.mockClear(); toggleGroups();
        expect(groupToggle().props["aria-pressed"]).toBe(true);
        expect(priceRows().map(row => row.key)).toEqual(keys); expect(priceRows().map(row => (row.props.line as EstimateLine).id)).toEqual(["one", "two"]);
        expect(subRows()).toHaveLength(1); expect(text(subRows())).toContain("£400.00");
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
        toggleGroups(); expect(subRows()).toEqual([]); expect(priceRows().map(row => row.key)).toEqual(keys);
    });
    it("keeps separated activities in source order and shows one subtotal after the last member", () => {
        const lines = current.state!.estimates[0].estimate_lines;
        lines[0].trade_section = "Kitchen"; lines[1].trade_section = "Roof"; lines.push({ ...line("three"), trade_section: "Kitchen", line_total: 50 });
        toggleGroups();
        expect(priceRows().map(row => (row.props.line as EstimateLine).id)).toEqual(["one", "two", "three"]);
        const headings = nodes(view()).filter(n => n.props["data-activity-heading"]);
        expect(headings.map(row => row.props["data-activity-heading"])).toEqual(["Kitchen", "Roof", "Kitchen"]);
        expect(text(headings[2])).toContain("continued");
        expect(subRows().map(row => row.props["data-activity-subtotal"])).toEqual(["Roof", "Kitchen"]);
        expect(text(subRows()[1])).toContain("£250.00"); expect(text(subRows()[1])).toContain("across 2 blocks");
        expect(text(view())).toContain("excluding open drafts");
    });
    it("preserves typed saved-line drafts and executes the original Save callback against the same ID after toggling", async () => {
        const saved = current.state!.estimates[0].estimate_lines[0];
        current.dispatch({ type: "op/open", key: "one", kind: "edit", lineId: "one", draft: draftFromLine(saved) });
        current.dispatch({ type: "op/change", key: "one", patch: { description: "My revised work", quantity: "12", rate: "25" } });
        const oldSave = priceRows()[0].props.onSave as () => void, draft = JSON.stringify(current.state!.ops.one.draft), totals = currentSummary(current.state!);
        current.dispatch.mockClear(); toggleGroups(); toggleGroups(); toggleGroups();
        expect(JSON.stringify(current.state!.ops.one.draft)).toBe(draft); expect(currentSummary(current.state!)).toEqual(totals);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(text(subRows())).toContain("£400.00");
        oldSave(); await Promise.resolve(); await Promise.resolve();
        expect(current.update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "My revised work", quantity: 12, unit: "m2", unit_rate: 25 });
        expect(current.state!.ops.one).toBeUndefined(); expect(text(subRows())).toContain("£500.00");
    });
    it("does not replace or count a new draft, including a full-form measurement draft", () => {
        current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new-line", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Unsaved work", amount: "999" } });
        const before = JSON.stringify(current.state), initial = nodes(view()).find(n => n.props["data-inline-add"])!;
        (initial.props.onFullForm as () => void)();
        toggleGroups(); expect(JSON.stringify(current.state)).toBe(before);
        expect(text(subRows())).toContain("£400.00"); expect(text(subRows())).not.toContain("999");
        const form = nodes(view()).find(n => n.props.idPrefix === "new-line")!;
        expect(form).toBeDefined(); expect(form.key).toBe("new-line"); expect(form.props.op).toBe(current.state!.ops[NEW_LINE_KEY]);
        toggleGroups(); expect(nodes(view()).find(n => n.props.idPrefix === "new-line")!.key).toBe("new-line");
        expect(current.other).not.toHaveBeenCalled();
    });
    it("retains failed draft errors and old Cancel after switching views", () => {
        current.dispatch({ type: "op/open", key: "one", kind: "edit", lineId: "one", draft: { ...draftFromLine(line("one")), description: "Keep this draft" } });
        current.dispatch({ type: "op/failed", key: "one", error: "No saved reply" });
        const cancel = priceRows()[0].props.onCancel as () => void, saved = JSON.stringify(current.state!.estimates);
        toggleGroups(); expect(current.state!.ops.one).toMatchObject({ status: "failed", error: "No saved reply", draft: { description: "Keep this draft" } });
        cancel(); expect(current.state!.ops.one).toBeUndefined(); expect(JSON.stringify(current.state!.estimates)).toBe(saved); expect(current.update).not.toHaveBeenCalled();
    });
    it("keeps pending saves fenced while grouping changes only presentation", async () => {
        let finish!: (value: unknown) => void;
        current.update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        current.dispatch({ type: "op/open", key: "one", kind: "edit", lineId: "one", draft: { ...draftFromLine(line("one")), rate: "30" } });
        (priceRows()[0].props.onSave as () => void)();
        expect(current.state!.ops.one.status).toBe("saving"); toggleGroups();
        expect(current.state!.ops.one.status).toBe("saving"); expect(text(subRows())).toContain("£400.00");
        finish({ ok: true, line: { ...line("one"), unit_rate: 30, line_total: 300 } }); await Promise.resolve(); await Promise.resolve();
        expect(current.update).toHaveBeenCalledOnce(); expect(current.state!.ops.one).toBeUndefined(); expect(text(subRows())).toContain("£500.00");
    });
    it("does not alter canonical Preliminaries/compound adjustments or turn subtotals into the contract sum", () => {
        const estimate = current.state!.estimates[0];
        estimate.prelims_pct = 10; estimate.overhead_pct = 12; estimate.profit_pct = 8;
        estimate.estimate_lines.push({ ...line("prelims"), trade_section: "Preliminaries", line_total: 25 });
        const before = currentSummary(current.state!); toggleGroups();
        expect(text(subRows())).toContain("£400.00"); expect(text(subRows())).toContain("£25.00");
        expect(text(subRows())).toContain("Before adjustments and VAT");
        expect(currentSummary(current.state!)).toEqual(before); expect(before.contractSum).not.toBe(425); expect(before.prelimsFromLines).toBe(true);
    });
    it.each(["dark", "light"])("renders valid full-width decoration cells for both detail views in %s theme", theme => {
        current.theme = theme; toggleGroups();
        expect(nodes(view()).filter(n => n.props["data-activity-heading"] || n.props["data-activity-subtotal"]).every(row => nodes(row).find(n => n.type === "td")!.props.colSpan === 3)).toBe(true);
        (nodes(view()).find(n => n.props["aria-controls"] === "price-line-table" && !n.props["data-price-activity-view"])!.props.onClick as () => void)();
        expect(nodes(view()).filter(n => n.props["data-activity-heading"] || n.props["data-activity-subtotal"]).every(row => nodes(row).find(n => n.type === "td")!.props.colSpan === 6)).toBe(true);
        const html = renderToStaticMarkup(view());
        expect(html).toContain('aria-describedby="price-activity-help"'); expect(html).toContain("line-price subtotal");
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
    it("keeps activity uncertainty labelled and does not treat the grouped view as confirmation", () => {
        const activity = priceRows()[0].props.activityControl as Element;
        (activity.props.onWork as (status: string) => void)("uncertain");
        toggleGroups(); expect(text(subRows())).toContain("Not confirmed");
        expect(nodes(view()).some(n => n.props["data-activity-save-warning"])).toBe(true); expect(current.other).not.toHaveBeenCalled();
    });
    it("preserves readonly client BoQ lines and escapes hostile activity text", () => {
        current.state!.estimates[0].is_client_boq = true; current.state!.estimates[0].estimate_lines[0].trade_section = "<script>bad()</script>";
        toggleGroups(); expect(priceRows().every(row => row.props.editable === false)).toBe(true);
        const html = renderToStaticMarkup(view()); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
});

