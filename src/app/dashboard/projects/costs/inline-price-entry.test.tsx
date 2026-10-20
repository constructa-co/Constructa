import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";
import { currentSummary, draftFromLine, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, dispatch: vi.fn(), update: vi.fn(), other: vi.fn(), theme: "dark" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => undefined,
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
function field(name: string, id = "one") { return nodes(inline(id)).find(node => node.props.id === `line-${id}-${name}`)!; }
function change(name: string, value: string, id = "one") { (field(name, id).props.onChange as (event: unknown) => void)({ target: { value } }); }
async function submit(id = "one") { const form = nodes(inline(id)).find(node => node.type === "form")!; return (form.props.onSubmit as (event: unknown) => Promise<unknown>)({ preventDefault: vi.fn() }); }
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.update.mockReset(); current.other.mockReset(); current.dispatch.mockReset();
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 400, estimate_lines: [line("one"), line("two")] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.dispatch.mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.update.mockImplementation(async (_estimateId, id, input) => ({ ok: true, line: { id, ...input, line_total: input.quantity * input.unit_rate } }));
});

describe("expanded estimating table inline rate editing", () => {
    it.each(["dark", "light"])("provides six aligned cells and labelled form-associated fields in %s theme without writes", theme => {
        current.theme = theme; open(); details();
        const snapshot = JSON.stringify(current.state);
        const tree = inline();
        expect(nodes(tree).filter(node => node.type === "td")).toHaveLength(6);
        const form = nodes(tree).find(node => node.type === "form")!;
        for (const name of ["description", "quantity", "unit", "rate"]) {
            const input = field(name);
            expect(input.props.form).toBe(form.props.id);
            expect(input.props["aria-label"]).toBeTypeOf("string");
        }
        const save = nodes(tree).find(node => node.type === "button" && node.props.type === "submit")!;
        expect(save.props.form).toBe(form.props.id);
        const markup = renderToStaticMarkup(<table><tbody>{tree}</tbody></table>);
        expect(markup).toContain("Save line");
        expect(markup).toContain("Draft"); expect(markup).toContain("Saved");
        expect(JSON.stringify(current.state)).toBe(snapshot);
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });

    it("patches only typed draft fields and displays a separate draft calculation, not optimistic totals", () => {
        open(); details(); const saved = JSON.stringify(current.state!.estimates);
        change("description", "Fit panels"); change("quantity", "2.5"); change("unit", "crate"); change("rate", "40");
        expect(current.state!.ops.one.draft).toMatchObject({ description: "Fit panels", quantity: "2.5", unit: "crate", rate: "40" });
        const markup = renderToStaticMarkup(<table><tbody>{inline()}</tbody></table>);
        expect(markup).toContain("£100.00"); expect(markup).toContain("£200.00");
        expect(currentSummary(current.state!).contractSum).toBe(400);
        expect(JSON.stringify(current.state!.estimates)).toBe(saved);
        expect(current.update).not.toHaveBeenCalled();
    });

    it("uses the existing explicit update controller and updates canonical totals after confirmation", async () => {
        open(); details(); change("quantity", "2.5"); change("rate", "40");
        await submit();
        expect(current.update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "Walls one", quantity: 2.5, unit: "m2", unit_rate: 40 });
        expect(current.state!.ops.one).toBeUndefined();
        expect(currentSummary(current.state!)).toMatchObject({ contractSum: 300, vat: 60, totalIncVat: 360 });
        expect(current.other).not.toHaveBeenCalled();
    });

    it("preserves invalid drafts and exposes field errors without an action call", async () => {
        open(); details(); change("quantity", "0"); change("rate", "not a number"); await submit();
        for (const name of ["quantity", "rate"]) {
            expect(field(name).props["aria-invalid"]).toBe(true);
            expect(field(name).props["aria-describedby"]).toBe(`line-one-${name}-error`);
        }
        expect(current.state!.ops.one.draft.quantity).toBe("0");
        expect(current.update).not.toHaveBeenCalled(); expect(currentSummary(current.state!).contractSum).toBe(400);
    });

    it("retains failed edits and allows explicit retry with the same identifiers", async () => {
        open(); details(); change("quantity", "12");
        current.update.mockResolvedValueOnce({ ok: false, error: "Could not confirm save" });
        await submit();
        expect(current.state!.ops.one.status).toBe("failed");
        expect(renderToStaticMarkup(<table><tbody>{inline()}</tbody></table>)).toContain("Could not confirm save");
        expect(currentSummary(current.state!).contractSum).toBe(400);
        await submit();
        expect(current.update).toHaveBeenCalledTimes(2);
        expect(currentSummary(current.state!).contractSum).toBe(440);
    });

    it("disables fields/actions during confirmation and fences duplicate submits", async () => {
        open(); details(); let release!: () => void;
        const wait = new Promise<void>(resolve => { release = resolve; });
        current.update.mockImplementation(async (_estimateId, id, input) => { await wait; return { ok: true, line: { id, ...input, line_total: 200 } }; });
        const pending = submit();
        for (const node of nodes(inline()).filter(node => ["input", "select", "button"].includes(String(node.type)))) expect(node.props.disabled).toBe(true);
        change("quantity", "999");
        (nodes(inline()).find(node => node.type === "button" && node.props.children === "Cancel")!.props.onClick as () => void)();
        expect(current.state!.ops.one.draft.quantity).toBe("10");
        expect(current.state!.ops.one.status).toBe("saving");
        await submit(); expect(current.update).toHaveBeenCalledTimes(1);
        expect(currentSummary(current.state!).contractSum).toBe(400);
        release(); await pending;
    });

    it("Cancel discards only that row's draft without writing or changing totals", () => {
        open(); open("two"); details(); change("rate", "50");
        const cancel = nodes(inline()).find(node => node.type === "button" && node.props.children === "Cancel")!;
        (cancel.props.onClick as () => void)();
        expect(current.state!.ops.one).toBeUndefined(); expect(current.state!.ops.two).toBeDefined();
        expect(currentSummary(current.state!).contractSum).toBe(400); expect(current.update).not.toHaveBeenCalled();
    });

    it("returns to the existing full form for measurement/method options without losing the draft", () => {
        open(); details(); change("quantity", "12.345"); const draft = JSON.stringify(current.state!.ops.one);
        const full = nodes(inline()).find(node => node.type === "button" && node.props.children === "Full line form")!;
        (full.props.onClick as () => void)();
        const markup = renderToStaticMarkup(view());
        expect(markup).toContain('aria-label="Change this line"'); expect(markup).toContain('value="12.345"');
        expect(markup).toContain("Calculate an area");
        expect(JSON.stringify(current.state!.ops.one)).toBe(draft); expect(current.update).not.toHaveBeenCalled();
        details(); expect(field("quantity").props.value).toBe("12.345");
    });

    it("keeps independent form identifiers and drafts for two open rows", async () => {
        open(); open("two"); details();
        expect(field("quantity").props.form).not.toBe(field("quantity", "two").props.form);
        change("quantity", "2"); change("rate", "30", "two");
        await submit();
        expect(current.state!.ops.two.draft.rate).toBe("30");
        expect(currentSummary(current.state!).contractSum).toBe(240);
    });

    it("preserves a custom unit and escapes contractor text without formula interpretation", () => {
        current.state!.estimates[0].estimate_lines[0].unit = "crate";
        open(); details(); change("description", "<img src=x onerror=alert(1)> =2*4");
        expect(field("unit").props.value).toBe("crate");
        const markup = renderToStaticMarkup(<table><tbody>{inline()}</tbody></table>);
        expect(markup).toContain('value="crate"'); expect(markup).toContain("&lt;img"); expect(markup).not.toContain("<img");
        expect(current.update).not.toHaveBeenCalled(); expect(currentSummary(current.state!).contractSum).toBe(400);
    });

    it.each(["0.0001", "1000001"])("keeps existing quantity limits for %s without rounding or saving", async quantity => {
        open(); details(); change("quantity", quantity); await submit();
        expect(current.state!.ops.one.draft.quantity).toBe(quantity);
        expect(field("quantity").props["aria-invalid"]).toBe(true);
        expect(current.update).not.toHaveBeenCalled();
    });

    it("keeps a post-save warning visible after confirmed inline edit", async () => {
        open(); details(); change("quantity", "12");
        current.update.mockResolvedValueOnce({ ok: true, warning: "Saved line; stored total refresh needs checking", line: { id: "one", description: "Walls one", quantity: 12, unit: "m2", unit_rate: 20, line_total: 240 } });
        await submit();
        expect(current.state!.ops.one).toBeUndefined();
        expect(current.state!.notice).toBe("Saved line; stored total refresh needs checking");
        expect(currentSummary(current.state!).contractSum).toBe(440);
    });
});
