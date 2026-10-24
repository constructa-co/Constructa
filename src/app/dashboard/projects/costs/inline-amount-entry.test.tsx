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
const line = (id: string): EstimateLine => ({ id, estimate_id: "estimate", description: `Walls ${id}`, quantity: 1, unit: "item", unit_rate: 200, line_total: 200, trade_section: "Decoration", pricing_mode: "simple", line_type: "general", estimate_line_components: [] });
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
    const editor = nodes(output).find(node => typeof node.type === "function" && node.props["data-inline-amount-editor"] === id);
    expect(editor, "saved amount edit should use the real inline amount editor").toBeDefined();
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


function savedRow(id = "one") {
    const component = nodes(view()).find(node => typeof node.type === "function" && (node.props.line as EstimateLine | undefined)?.id === id)!;
    return (component.type as (props: unknown) => Element)(component.props);
}
function button(label: string, id = "one") { return nodes(inline(id)).find(node => node.type === "button" && node.props.children === label)!.props; }
function click(props: Record<string, unknown>) { return (props.onClick as () => void)(); }
function fullForm(id = "one") {
    const form = nodes(savedRow(id)).find(node => node.props.idPrefix === "line-" + id)!;
    expect(form, "explicit full form").toBeDefined(); return form;
}
function openFromUI(id = "one") {
    const control = nodes(savedRow(id)).find(node => node.props["aria-label"] === "Change Walls " + id)!;
    click(control.props);
}

describe("inline saved one-price editing", () => {
    it.each(["dark", "light"])("keeps the simple three-cell amount draft labelled and separate from saved totals in %s", theme => {
        current.theme = theme; open();
        const tree = inline(), before = JSON.stringify(current.state);
        expect(nodes(tree).filter(node => node.type === "td")).toHaveLength(3);
        expect(nodes(tree).filter(node => node.type === "input")).toHaveLength(2);
        expect(field("amount").props.value).toBe("200"); expect(field("quantity")).toBeUndefined();
        const form = nodes(tree).find(node => node.type === "form")!;
        for (const name of ["description", "amount"]) {
            expect(field(name).props.form).toBe(form.props.id);
            expect(field(name).props["aria-label"]).toBeTypeOf("string");
            expect(field(name).props.onBlur).toBeUndefined();
        }
        const save = nodes(tree).find(node => node.type === "button" && node.props.type === "submit")!;
        expect(save.props.form).toBe(form.props.id);
        const html = renderToStaticMarkup(<table><tbody>{tree}</tbody></table>);
        expect(html).toContain("Draft"); expect(html).toContain("Saved £200.00");
        expect(html).not.toContain("Calculate an area");
        expect(JSON.stringify(current.state)).toBe(before); expect(current.update).not.toHaveBeenCalled();
    });
    it("keeps the expanded grid aligned with an explicit one-price three-column span", () => {
        open(); details(); const tree = inline(), cells = nodes(tree).filter(node => node.type === "td");
        expect(cells).toHaveLength(4); expect(cells[1].props.colSpan).toBe(3);
        expect(cells[1].props.children).toBe("One price");
        expect(field("quantity")).toBeUndefined(); expect(field("rate")).toBeUndefined();
    });
    it("changes only raw description/amount draft fields without implicit conversion or saved changes", () => {
        open(); const before = JSON.stringify(current.state!.estimates), prior = current.state!.ops.one;
        change("description", "Specialist finishing"); change("amount", "1,234.50");
        expect(current.state!.ops.one).toMatchObject({ lineId: "one", kind: "edit", draft: { ...prior.draft, description: "Specialist finishing", amount: "1,234.50" } });
        expect(JSON.stringify(current.state!.estimates)).toBe(before); expect(currentSummary(current.state!).contractSum).toBe(400);
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
    it("uses exactly one existing update after explicit Save,retaining source section/resources/identity", async () => {
        open(); change("amount", "1234.50"); change("description", "Specialist finishing"); await submit();
        expect(current.update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "Specialist finishing", quantity: 1, unit: "item", unit_rate: 1234.5 });
        expect(current.state!.estimates[0].estimate_lines[0]).toMatchObject({ id: "one", estimate_id: "estimate", trade_section: "Decoration", pricing_mode: "simple", line_type: "general", estimate_line_components: [] });
        expect(current.state!.ops.one).toBeUndefined(); expect(currentSummary(current.state!).contractSum).toBe(1434.5);
        expect(current.other).not.toHaveBeenCalled();
    });
    it.each(["", "0", "-1", "1.001", "1e2", "1000000001", "not a price"])("retains invalid raw amount %s and existing validation without a write", async value => {
        open(); change("amount", value); await submit();
        expect(field("amount").props.value).toBe(value); expect(field("amount").props["aria-invalid"]).toBe(true);
        expect(field("amount").props["aria-describedby"]).toBe("line-one-amount-error");
        expect(current.update).not.toHaveBeenCalled(); expect(currentSummary(current.state!).contractSum).toBe(400);
    });
    it("retains existing blank/overlong description rules", async () => {
        open(); change("description", " "); await submit();
        expect(field("description").props["aria-invalid"]).toBe(true); expect(field("description").props.maxLength).toBe(500);
        change("description", "x".repeat(501)); await submit();
        expect(current.state!.ops.one.draft.description).toHaveLength(501);
        expect(current.update).not.toHaveBeenCalled();
    });
    it("retains failed text and same-ID explicit retry without changing totals before acknowledgement", async () => {
        open(); change("amount", "250"); current.update.mockResolvedValueOnce({ ok: false, error: "Not confirmed" });
        await submit(); expect(current.state!.ops.one).toMatchObject({ lineId: "one", status: "failed", draft: { amount: "250" } });
        expect(renderToStaticMarkup(<table><tbody>{inline()}</tbody></table>)).toContain("Not confirmed");
        expect(currentSummary(current.state!).contractSum).toBe(400);
        await submit(); expect(current.update.mock.calls.map(call => call[1])).toEqual(["one", "one"]);
        expect(currentSummary(current.state!).contractSum).toBe(450);
    });
    it("fences duplicate submit,typing,Cancel and full-form view switches while saving", async () => {
        open(); change("amount", "250");
        let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
        current.update.mockImplementationOnce(async (_estimate, id, input) => { await wait; return { ok: true, line: { id, ...input, line_total: 250 } }; });
        const oldFull = button("Full line form"), pending = submit();
        for (const node of nodes(inline()).filter(node => ["input", "button"].includes(String(node.type)))) expect(node.props.disabled).toBe(true);
        change("amount", "999"); click(button("Cancel")); click(oldFull); await submit();
        expect(current.state!.ops.one).toMatchObject({ status: "saving", draft: { amount: "250" } });
        expect(current.update).toHaveBeenCalledOnce(); expect(currentSummary(current.state!).contractSum).toBe(400);
        release(); await pending; await Promise.resolve(); await Promise.resolve();
        expect(currentSummary(current.state!).contractSum).toBe(450);
    });
    it("Cancel discards only this draft while keeping another row and a new-line draft intact", () => {
        open(); open("two");
        current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "new-id", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "New work", amount: "300" } });
        const beforeOther = JSON.stringify([current.state!.ops.two, current.state!.ops.new]);
        change("amount", "900"); click(button("Cancel"));
        expect(current.state!.ops.one).toBeUndefined();
        expect(JSON.stringify([current.state!.ops.two, current.state!.ops.new])).toBe(beforeOther);
        expect(currentSummary(current.state!).contractSum).toBe(400); expect(current.update).not.toHaveBeenCalled();
    });
    it("retains an explicitly chosen full form against an old Change handler during Save", async () => {
        const oldChange = nodes(savedRow()).find(node => node.props["aria-label"] === "Change Walls one")!.props;
        openFromUI(); click(button("Full line form"));
        let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
        current.update.mockImplementationOnce(async (_estimate, id, input) => { await wait; return { ok: true, line: { id, ...input, line_total: 200 } }; });
        (fullForm().props.onSave as () => void)(); click(oldChange);
        expect(fullForm().props.op).toMatchObject({ status: "saving" });
        const back = nodes(savedRow()).find(node => node.type === "button" && node.props.children === "Back to table row")!;
        expect(back.props.disabled).toBe(true); click(back.props);
        expect(fullForm().props.op).toMatchObject({ status: "saving" });
        release(); await Promise.resolve(); await Promise.resolve();
    });
    it("opens Full form and returns inline without touching any draft or other row view", () => {
        open(); open("two"); change("amount", "250");
        const before = JSON.stringify(current.state);
        click(button("Full line form"));
        expect(fullForm().props.op).toBe(current.state!.ops.one);
        expect(inline("two")).toBeDefined();
        const back = nodes(savedRow()).find(node => node.type === "button" && node.props.children === "Back to table row")!;
        expect(back.props.type).toBe("button"); click(back.props);
        expect(field("amount").props.value).toBe("250"); expect(JSON.stringify(current.state)).toBe(before);
        expect(current.update).not.toHaveBeenCalled();
    });
    it("permits only an explicit full-form mode change,then returns to the existing inline rate path", () => {
        open(); click(button("Full line form"));
        const form = fullForm(); (form.props.onChange as (patch: unknown) => void)({ mode: "rate", quantity: "2", unit: "m2", rate: "30" });
        expect(fullForm().props.op).toBe(current.state!.ops.one);
        click(nodes(savedRow()).find(node => node.type === "button" && node.props.children === "Back to table row")!.props);
        const editor = nodes(savedRow()).find(node => node.props["data-inline-editor"] === "one");
        expect(editor).toBeDefined(); expect(current.state!.ops.one.draft).toMatchObject({ mode: "rate", amount: "200", quantity: "2", unit: "m2", rate: "30" });
        expect(current.update).not.toHaveBeenCalled();
    });
    it("a cancelled full form reopens as a simple inline amount row through actual Change", () => {
        openFromUI(); click(button("Full line form")); const form = fullForm();
        (form.props.onCancel as () => void)(); openFromUI();
        expect(field("amount").props.value).toBe("200"); expect(current.update).not.toHaveBeenCalled();
    });
    it.each(["boq", "buildup"])("does not offer the amount editor for a %s-controlled source", mode => {
        if (mode === "boq") current.state!.estimates[0].is_client_boq = true;
        else current.state!.estimates[0].estimate_lines[0].pricing_mode = "buildup";
        const html = renderToStaticMarkup(view());
        expect(html).not.toContain('aria-label="Change Walls one"'); expect(html).toContain("Advanced estimating");
        expect(current.update).not.toHaveBeenCalled();
    });
    it("does not reclassify existing Preliminaries while editing its amount", async () => {
        current.state!.estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        open(); change("amount", "300"); await submit();
        expect(current.state!.estimates[0].estimate_lines[0].trade_section).toBe("Preliminaries");
        expect(current.update).toHaveBeenCalledExactlyOnceWith("estimate", "one", { description: "Walls one", quantity: 1, unit: "item", unit_rate: 300 });
    });
    it("keeps two form IDs independent and escapes literal contractor wording", () => {
        open(); open("two"); change("description", "<script> =2*4");
        expect(field("amount").props.form).not.toBe(field("amount", "two").props.form);
        const html = renderToStaticMarkup(<table><tbody>{inline()}</tbody></table>);
        expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
        expect(current.update).not.toHaveBeenCalled(); expect(current.other).not.toHaveBeenCalled();
    });
});
