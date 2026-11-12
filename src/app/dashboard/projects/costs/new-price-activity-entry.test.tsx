import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, dispatch: vi.fn(), save: vi.fn(), other: vi.fn(), theme: "dark" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => undefined,
    useRef: (initial: unknown) => { const i = current.cursor++; if (!(i in current.slots)) current.slots[i] = { current: initial }; return current.slots[i]; },
    useMemo: (fn: () => unknown) => fn(),
    useState: (initial: unknown) => { const i = current.cursor++; if (!(i in current.slots)) current.slots[i] = typeof initial === "function" ? initial() : initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? next(current.slots[i]) : next; }]; },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.save, updateSimplePriceLineAction: current.other, deleteSimplePriceLineAction: current.other, savePriceAdjustmentsAction: current.other, loadAdvancedEstimatingDataAction: current.other }));
import EstimateClient from "./estimate-client";
type Element = ReactElement<Record<string, unknown>>;
const line = (id: string, section: string): EstimateLine => ({ id, estimate_id: "estimate", description: id, quantity: 1, unit: "item", unit_rate: 50, line_total: 50, trade_section: section, pricing_mode: "simple", line_type: "general", estimate_line_components: [] });
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
let briefSections: unknown;
function view() { current.cursor = 0; return EstimateClient({ estimates: [], project: { id: "job", name: "Kitchen", client_name: "", brief_scope: "Fit kitchen", brief_trade_sections: briefSections } }); }
function entry() { return nodes(view()).find(n => typeof n.type === "function" && (n.props["data-inline-add"] || n.props.idPrefix === "new-line"))!; }
function editor() { const e = entry(); return (e.type as (props: unknown) => Element)(e.props); }
function activity() { return nodes(editor()).find(n => typeof n.type === "function" && n.props.id === "new-line-activity")!; }
function control() { const e = activity(); return (e.type as (props: unknown) => Element)(e.props); }
function change(name: string) { (nodes(control()).find(n => n.type === "input")!.props.onChange as (event: unknown) => void)({ target: { value: name } }); }
beforeEach(() => {
    briefSections = undefined;
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.save.mockReset(); current.other.mockReset(); current.dispatch.mockReset();
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 150,
        estimate_lines: [line("one", "Kitchen"), line("two", "Kitchen"), line("three", "Preliminaries")] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.dispatch.mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Fit cupboards", amount: "100" } });
    current.save.mockImplementation(async request => ({ ok: true, estimateId: "estimate", createdEstimate: null,
        line: { ...line(request.lineId, request.activity ?? "General"), ...request.line, line_total: request.line.quantity * request.line.unit_rate } }));
});
describe("activity while pricing a new line", () => {
    it("offers saved Brief names after existing estimate names without adding work or choosing a default", () => {
        briefSections = ["Strip out cupboards", "Kitchen", "Fit new cabinets"];
        const before = JSON.stringify(current.state);
        expect(activity().props.names).toEqual(["Kitchen", "Strip out cupboards", "Fit new cabinets"]);
        expect(activity().props.value).toBe("");
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.save).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });

    it("offers actual Brief names for an empty estimate without creating saved rows", () => {
        current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
        current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new", draft: { ...EMPTY_PRICE_LINE_DRAFT } });
        briefSections = ["Protect the existing kitchen", "Remove old cupboards"];
        expect(activity().props.names).toEqual(briefSections);
        expect(current.state.estimates).toEqual([]);
        expect(current.state.ops.new.draft).toEqual(EMPTY_PRICE_LINE_DRAFT);
        expect(current.save).not.toHaveBeenCalled();
    });

    it("updates optional suggestions on source refresh without replacing an open activity or price draft", () => {
        briefSections = ["Saved Brief activity"];
        change("My revised activity");
        const before = JSON.stringify(current.state);
        briefSections = ["Newer saved Brief activity"];
        expect(activity().props.names).toEqual(["Kitchen", "Newer saved Brief activity"]);
        expect(activity().props.value).toBe("My revised activity");
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.save).not.toHaveBeenCalled();
    });

    it("saves a deliberately chosen Brief activity in the existing single priced-line action", async () => {
        briefSections = ["Strip out cupboards"];
        change("Strip out cupboards");
        expect(current.save).not.toHaveBeenCalled();
        await (entry().props.onSaveNext as () => Promise<unknown>)();
        expect(current.save).toHaveBeenCalledOnce();
        expect(current.save.mock.calls[0][0]).toMatchObject({ activity: "Strip out cupboards", line: { description: "Fit cupboards", quantity: 1, unit_rate: 100 } });
        expect(current.state!.estimates[0].estimate_lines.at(-1)).toMatchObject({ trade_section: "Strip out cupboards", line_total: 100 });
        expect(current.state!.ops.new.draft.activity).toBeUndefined();
        expect(current.other).not.toHaveBeenCalled();
    });

    it("does not add Brief choices to the client BoQ path", () => {
        briefSections = ["Strip out cupboards"];
        current.state!.estimates[0].is_client_boq = true;
        expect(activity()).toBeUndefined();
        expect(current.save).not.toHaveBeenCalled();
    });

    it.each(["dark", "light"])("starts optional/closed with actual saved names and no typing/selection write in %s", theme => {
        current.theme = theme;
        expect(activity().props.names).toEqual(["Kitchen"]); expect(control().props.open).toBeUndefined();
        const input = nodes(control()).find(n => n.type === "input")!;
        expect(input.props.form).toBe("new-line-inline-form"); expect(input.props.maxLength).toBe(100);
        change("My own activity"); expect(current.state!.ops.new.draft.activity).toBe("My own activity");
        expect(current.save).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
        const preventDefault = vi.fn(); (nodes(control()).find(n => n.type === "input")!.props.onKeyDown as (event: unknown) => void)({ key: "Enter", preventDefault });
        expect(preventDefault).toHaveBeenCalledOnce(); expect(current.save).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(control())).toContain("Saved with this line only");
    });
    it("preserves activity across inline/full form/pricing-method switches and Cancel never saves", () => {
        change("Kitchen"); (entry().props.onFullForm as () => void)();
        expect(activity().props.value).toBe("Kitchen"); expect(entry().props.idPrefix).toBe("new-line");
        (entry().props.onChange as (patch: unknown) => void)({ mode: "rate", quantity: "2", rate: "50" });
        expect(activity().props.value).toBe("Kitchen");
        (entry().props.onCancel as () => void)(); expect(current.state!.ops.new).toBeUndefined(); expect(current.save).not.toHaveBeenCalled();
    });
    it("saves category and price once, then opens a blank next category without a second assignment write", async () => {
        change("Kitchen"); await (entry().props.onSaveNext as () => Promise<unknown>)();
        expect(current.save).toHaveBeenCalledOnce(); expect(current.save.mock.calls[0][0]).toMatchObject({ activity: "Kitchen", lineId: "new", line: { unit_rate: 100 } });
        expect(current.state!.estimates[0].estimate_lines.at(-1)).toMatchObject({ trade_section: "Kitchen", description: "Fit cupboards", line_total: 100 });
        expect(current.state!.ops.new.draft.activity).toBeUndefined(); expect(current.state!.ops.new.draft.description).toBe(""); expect(current.other).not.toHaveBeenCalled();
    });
    it("retains refused input and exposes its error inside the opened optional control", async () => {
        change("Preliminaries"); await (entry().props.onSaveNext as () => Promise<unknown>)();
        expect(current.save).not.toHaveBeenCalled(); expect(current.state!.ops.new.draft.activity).toBe("Preliminaries");
        expect(control().props.open).toBe(true); expect(renderToStaticMarkup(control())).toContain("affects price calculations");
    });
    it("keeps pending activity disabled and retains it on a returned failure", async () => {
        change("Kitchen"); let release!: (result: unknown) => void;
        current.save.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = (entry().props.onSaveNext as () => Promise<unknown>)();
        expect(nodes(control()).find(n => n.type === "input")!.props.disabled).toBe(true);
        change("Other"); expect(current.state!.ops.new.draft.activity).toBe("Kitchen");
        release({ ok: false, error: "Unconfirmed" }); await pending;
        expect(current.state!.ops.new.draft.activity).toBe("Kitchen"); expect(current.state!.ops.new.lineId).toBe("new");
    });
    it("does not add activity assignment controls to a client BoQ draft", () => {
        current.state!.estimates[0].is_client_boq = true; expect(activity()).toBeUndefined(); expect(current.save).not.toHaveBeenCalled();
    });
});
