import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";
import { currentSummary, draftFromLine, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

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
const project = { id: "job", name: "Room", client_name: "", brief_scope: "Prepare walls" };
function view() { current.cursor = 0; return EstimateClient({ estimates: [], project }); }
function details() { (nodes(view()).find(node => node.props["aria-controls"] === "price-line-table")!.props.onClick as () => void)(); }
function open(id = "one") {
    const saved = current.state!.estimates[0].estimate_lines.find(item => item.id === id)!;
    current.dispatch({ type: "op/open", key: id, kind: "edit", lineId: id, draft: draftFromLine(saved) });
}
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.update.mockReset(); current.other.mockReset(); current.dispatch.mockReset();
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 400, estimate_lines: [line("one"), line("two")] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.dispatch.mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.update.mockImplementation(async (_estimateId, id, input) => ({ ok: true, line: { id, ...input, line_total: input.quantity * input.unit_rate } }));
});


function anyEditor(id = "one") {
    const row = nodes(view()).find(node => typeof node.type === "function" && (node.props.line as EstimateLine | undefined)?.id === id)!;
    const output = (row.type as (props: unknown) => Element)(row.props);
    const editor = nodes(output).find(node => node.props["data-inline-editor"] === id || node.props["data-inline-amount-editor"] === id)!;
    expect(editor).toBeDefined(); return (editor.type as (props: unknown) => Element)(editor.props);
}
function nextButton(id = "one") {
    const node = nodes(anyEditor(id)).find(node => node.type === "button" && node.props.children === "Save and change next");
    expect(node).toBeDefined(); return node!.props;
}
const useNext = (props = nextButton()) => (props.onClick as () => Promise<void>)();

describe("explicit saved-line continuation in the real inline table", () => {
    it.each(["rate", "amount"])("previews the actual next row and advances %s only after one confirmed update", async mode => {
        if (mode === "amount") Object.assign(current.state!.estimates[0].estimate_lines[0], { quantity: 1, unit: "item", unit_rate: 200 });
        open(); if (mode === "rate") details();
        expect(nextButton().type).toBe("button"); expect(nextButton().disabled).toBe(false);
        const tree = anyEditor(), html = renderToStaticMarkup(<table><tbody>{tree}</tbody></table>);
        expect(html).toContain("Next editable saved line: Walls two"); expect(current.update).not.toHaveBeenCalled();
        const input = nodes(tree).find(node => node.props.id === "line-one-" + (mode === "rate" ? "quantity" : "amount"))!;
        (input.props.onChange as (event: unknown) => void)({ target: { value: mode === "rate" ? "3" : "250" } });
        await useNext();
        expect(current.update).toHaveBeenCalledOnce(); expect(current.other).not.toHaveBeenCalled();
        expect(current.state!.ops.one).toBeUndefined(); expect(current.state!.ops.two).toMatchObject({ kind: "edit", lineId: "two", draft: { description: "Walls two", quantity: "10", rate: "20", unit: "m2" } });
        const description = nodes(anyEditor("two")).find(node => node.props.id === "line-two-description")!;
        expect(description.props.autoFocus).toBe(true);
        expect(currentSummary(current.state!).contractSum).toBe(mode === "rate" ? 260 : 450);
        expect(current.state!.estimates[0].estimate_lines.map(row => row.id)).toEqual(["one", "two"]);
    });
    it("never wraps,creates a new line or offers next on the last saved row", () => {
        open("two"); details();
        expect(nodes(anyEditor("two")).some(node => node.type === "button" && node.props.children === "Save and change next")).toBe(false);
        expect(current.other).not.toHaveBeenCalled(); expect(current.update).not.toHaveBeenCalled();
    });
    it("labels and disables an already open next draft,including direct old callback refusal", async () => {
        open(); details(); const old = nextButton(); open("two");
        expect(nextButton().disabled).toBe(true);
        expect(renderToStaticMarkup(<table><tbody>{anyEditor()}</tbody></table>)).toContain("already has open work");
        await useNext(old); expect(current.update).not.toHaveBeenCalled(); expect(current.state!.ops.two.draft.rate).toBe("20");
    });
    it("retains failed acknowledgement/current draft and never opens next", async () => {
        open(); details(); current.update.mockResolvedValueOnce({ ok: false, error: "Unconfirmed" });
        await useNext(); expect(current.state!.ops.one.status).toBe("failed"); expect(current.state!.ops.two).toBeUndefined();
        expect(currentSummary(current.state!).contractSum).toBe(400);
    });
    it("retains stored-total warnings in the current draft rather than advancing", async () => {
        open(); details(); current.update.mockResolvedValueOnce({ ok: true, warning: "Stored total not confirmed", line: { id: "one", description: "Walls one", quantity: 10, unit: "m2", unit_rate: 20, line_total: 200 } });
        await useNext(); expect(current.state!.ops.one.status).toBe("failed"); expect(current.state!.ops.one.error).toContain("Stored total not confirmed");
        expect(current.state!.ops.two).toBeUndefined(); expect(currentSummary(current.state!).contractSum).toBe(400);
    });
    it("preserves ordinary Save as a separate action without advancing", async () => {
        open(); details(); const form = nodes(anyEditor()).find(node => node.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() }); await Promise.resolve(); await Promise.resolve();
        expect(current.update).toHaveBeenCalledOnce(); expect(current.state!.ops.two).toBeUndefined();
    });
    it("refuses a stale preview callback after newer typing without saving either row", async () => {
        open(); details(); const old = nextButton();
        current.dispatch({ type: "op/change", key: "one", patch: { quantity: "99" } });
        await useNext(old); expect(current.update).not.toHaveBeenCalled(); expect(current.state!.ops.one.draft.quantity).toBe("99");
    });
    it("does not focus or save from rendering,typing or a failed attempt", async () => {
        open(); details();
        expect(nodes(anyEditor()).find(node => node.props.id === "line-one-description")!.props.autoFocus).toBe(false);
        current.update.mockResolvedValueOnce({ ok: false, error: "Not confirmed" }); await useNext();
        expect(nodes(anyEditor()).find(node => node.props.id === "line-one-description")!.props.autoFocus).toBe(false);
        expect(current.state!.ops.two).toBeUndefined();
    });
});
