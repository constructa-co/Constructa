import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import AreaQuantityAid, { AreaQuantityInputs } from "@/components/area-quantity-aid";
import type { AreaQuantityAidProps } from "@/components/area-quantity-aid";
import type { Estimate, EstimateLine } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, currentSummary, draftFromLine, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, dispatch: vi.fn(), update: vi.fn(), other: vi.fn(), theme: "dark", effects: [] as { effect: () => void | (() => void); deps: unknown[] }[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => void | (() => void), deps: unknown[]) => { current.effects.push({ effect, deps }); },
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
const project = { id: "job", name: "Room", client_name: "", brief_scope: "Prepare walls" };
function view(patch: Partial<typeof project> & { payment_lock_reason?: string } = {}) { current.cursor = 0; return EstimateClient({ estimates: [], project: Object.keys(patch).length ? { ...project, ...patch } : project }); }
function details() { (nodes(view()).find(node => node.props["aria-controls"] === "price-line-table")!.props.onClick as () => void)(); }
function open(id = "one") {
    const saved = current.state!.estimates[0].estimate_lines.find(item => item.id === id)!;
    current.dispatch({ type: "op/open", key: id, kind: "edit", lineId: id, draft: draftFromLine(saved) });
}
function inline(id = "one") {
    const row = nodes(view()).find(node => typeof node.type === "function" && (node.props.line as EstimateLine | undefined)?.id === id)!;
    const output = (row.type as (props: unknown) => Element)(row.props);
    const editor = nodes(output).find(node => typeof node.type === "function" && node.props["data-inline-editor"] === id);
    expect(editor, "expanded rate edit should use the real inline editor").toBeDefined();
    return (editor!.type as (props: unknown) => Element)(editor!.props);
}
async function submit(id = "one") { const form = nodes(inline(id)).find(node => node.type === "form")!; return (form.props.onSubmit as (event: unknown) => Promise<unknown>)({ preventDefault: vi.fn() }); }
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.effects = []; current.theme = "dark"; current.update.mockReset(); current.other.mockReset(); current.dispatch.mockReset();
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 400, estimate_lines: [line("one"), line("two")] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.dispatch.mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.update.mockImplementation(async (_estimateId, id, input) => ({ ok: true, line: { id, ...input, line_total: input.quantity * input.unit_rate } }));
});

function newRow() {
    const component = nodes(view()).find(node => node.props["data-inline-add"]);
    expect(component, "the new draft should be inside the actual price table").toBeDefined();
    return (component!.type as (props: unknown) => Element)(component!.props);
}
function newButton(label: string) { return nodes(newRow()).find(node => node.type === "button" && node.props.children === label)!; }


function aid(tree: unknown) {
    const node = nodes(tree).find(node => node.type === AreaQuantityAid);
    expect(node, "optional aid should be wired into the actual inline row").toBeDefined();
    return node!.props as unknown as AreaQuantityAidProps;
}
function begin(kind: "saved" | "new") {
    const ensureDetails = () => { if (!nodes(view()).find(node => node.props["aria-controls"] === "price-line-table")!.props["aria-pressed"]) details(); };
    if (kind === "saved") { open(); ensureDetails(); return inline(); }
    current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new-area", draft: {
        ...EMPTY_PRICE_LINE_DRAFT, description: "Fit panels", mode: "rate", unit: "m2", quantity: "10", rate: "20", activity: "Decoration",
    } });
    ensureDetails(); return newRow();
}
function row(kind: "saved" | "new") { return kind === "saved" ? inline() : newRow(); }
const keyFor = (kind: "saved" | "new") => kind === "saved" ? "one" : NEW_LINE_KEY;

describe.each(["saved", "new"] as const)("inline %s area quantity aid", kind => {
    it("starts closed and changes only the active quantity after explicit Use", () => {
        const tree = begin(kind), props = aid(tree), before = JSON.stringify(current.state!.estimates);
        const original = current.state!.ops[keyFor(kind)];
        expect(props.unit).toBe("m2"); expect(props.disabled).toBe(false);
        const html = renderToStaticMarkup(<table><tbody>{tree}</tbody></table>);
        expect(html).toContain("Calculate an area: length x width");
        expect(html).not.toContain("Length (m)");
        expect(current.other).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
        props.onUse("0.02");
        expect(current.state!.ops[keyFor(kind)].draft).toEqual({ ...original.draft, quantity: "0.02" });
        expect(current.state!.ops[keyFor(kind)].lineId).toBe(original.lineId);
        expect(JSON.stringify(current.state!.estimates)).toBe(before);
        expect(currentSummary(current.state!).contractSum).toBe(400);
    });
    it.each(["0", "-1", "0.0001", "1000001", "NaN", "1e2"])("refuses invalid or noncanonical result %s without a write", quantity => {
        const props = aid(begin(kind)), before = JSON.stringify(current.state);
        props.onUse(quantity);
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.other).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
    });
    it("refuses an old callback after newer typing,while the current callback still works", () => {
        const old = aid(begin(kind)).onUse;
        current.dispatch({ type: "op/change", key: keyFor(kind), patch: { quantity: "15", rate: "25" } });
        old("0.02"); expect(current.state!.ops[keyFor(kind)].draft.quantity).toBe("15");
        aid(row(kind)).onUse("0.02");
        expect(current.state!.ops[keyFor(kind)].draft).toMatchObject({ quantity: "0.02", rate: "25" });
    });
    it("does not apply an old result after Cancel and a new draft at the same key", () => {
        const old = aid(begin(kind)).onUse;
        current.dispatch({ type: "op/cancel", key: keyFor(kind) });
        begin(kind); old("0.02");
        expect(current.state!.ops[keyFor(kind)].draft.quantity).toBe("10");
        expect(current.other).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
    });
    it.each(["saving", "advanced", "clientBoQ", "changedSource", "changedEstimate"])("refuses stale or blocked %s context", block => {
        const old = aid(begin(kind)).onUse, key = keyFor(kind);
        if (block === "saving") current.dispatch({ type: "op/saving", key });
        if (block === "advanced") current.state = { ...current.state!, advancedOpen: true };
        if (block === "clientBoQ") current.state!.estimates[0] = { ...current.state!.estimates[0], is_client_boq: true };
        if (block === "changedSource") current.state!.estimates[0] = { ...current.state!.estimates[0], version_name: "Newer source" };
        if (block === "changedEstimate") current.state = { ...current.state!, activeEstimateId: "other" };
        const before = JSON.stringify(current.state); old("0.02"); expect(JSON.stringify(current.state)).toBe(before);
        expect(current.other).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
    });
    it("keeps the aid key tied to draft identity/unit and does not convert other units", () => {
        const tree = begin(kind), first = nodes(tree).find(node => node.type === AreaQuantityAid)!;
        current.dispatch({ type: "op/change", key: keyFor(kind), patch: { unit: "hr" } });
        const next = nodes(row(kind)).find(node => node.type === AreaQuantityAid)!;
        expect(next.key).not.toBe(first.key);
        const before = JSON.stringify(current.state); (next.props.onUse as (quantity: string) => void)("6");
        expect(JSON.stringify(current.state)).toBe(before);
        expect(renderToStaticMarkup(<table><tbody>{row(kind)}</tbody></table>)).not.toContain("Calculate an area");
    });
    it("rejects old callbacks after project replacement,lock or unmount", () => {
        const old = aid(begin(kind)).onUse;
        view({ id: "other", payment_lock_reason: "Read only" });
        const effect = current.effects.findLast(item => item.deps[0] && typeof item.deps[0] === "object" && "id" in item.deps[0] && item.deps[0].id === "other")!;
        const cleanup = effect.effect();
        old("0.02"); expect(current.state!.ops[keyFor(kind)].draft.quantity).toBe("10");
        if (cleanup) cleanup();
        aid(row(kind)).onUse("0.02"); expect(current.state!.ops[keyFor(kind)].draft.quantity).toBe("10");
    });
    it("Cancel discards only the draft after an area result,without touching totals", () => {
        aid(begin(kind)).onUse("6");
        const cancel = nodes(row(kind)).find(node => node.type === "button" && node.props.children === "Cancel")!;
        (cancel.props.onClick as () => void)();
        expect(current.state!.ops[keyFor(kind)]).toBeUndefined();
        expect(currentSummary(current.state!).contractSum).toBe(400);
        expect(current.other).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
    });
});

describe("area result and existing save controller", () => {
    it("uses the exact helper in inline fields and saves only after explicit existing Save line", async () => {
        const props = aid(begin("saved")), start = current.slots.length;
        const inputs = () => { current.cursor = start; return nodes(AreaQuantityInputs(props)); };
        for (const [name, value] of [["length", "0.1"], ["width", "0.2"]]) {
            const input = inputs().find(node => node.props.id === props.idPrefix + "-" + name)!;
            (input.props.onChange as (event: unknown) => void)({ target: { value } });
        }
        expect(current.state!.ops.one.draft.quantity).toBe("10");
        (inputs().find(node => node.type === "button")!.props.onClick as () => void)();
        expect(current.state!.ops.one.draft.quantity).toBe("0.02"); expect(current.update).not.toHaveBeenCalled();
        await submit();
        expect(current.update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "Walls one", quantity: 0.02, unit: "m2", unit_rate: 20 });
        expect(currentSummary(current.state!).contractSum).toBe(200.4);
    });
    it("retains failed same-ID add drafts,and Save-and-add-next clears the area quantity", async () => {
        aid(begin("new")).onUse("6");
        current.other.mockResolvedValueOnce({ ok: false, error: "Not confirmed" });
        const save = () => newButton("Save and add next").props.onClick as () => Promise<unknown>;
        await save()(); expect(current.state!.ops.new).toMatchObject({ lineId: "new-area", status: "failed", draft: { quantity: "6" } });
        current.other.mockImplementationOnce(async request => ({ ok: true, estimateId: "estimate", line: { id: request.lineId, ...request.line, trade_section: "Decoration", line_total: request.line.quantity * request.line.unit_rate } }));
        await save()();
        expect(current.other.mock.calls.map(call => call[0].lineId)).toEqual(["new-area", "new-area"]);
        expect(current.state!.ops.new.draft).toMatchObject({ quantity: "", rate: "", description: "", unit: "m2" });
        expect(current.state!.ops.new.lineId).not.toBe("new-area");
    });
});
