import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { CostLibraryItem, Estimate } from "./types";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
const replay = vi.hoisted(() => ({
    slots: {} as Record<string, Slot[]>, surface: "parent", cursor: 0, effects: [] as Array<() => void>,
    save: vi.fn(), other: vi.fn(), error: vi.fn(), activity: vi.fn(),
}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    const slot = () => (replay.slots[replay.surface] ??= [])[replay.cursor++] ??= {};
    return { ...actual,
        useState: (initial: unknown) => { const s = slot(); if (!("value" in s)) s.value = typeof initial === "function" ? initial() : initial; return [s.value, (next: unknown) => { s.value = typeof next === "function" ? next(s.value) : next; }]; },
        useRef: (initial: unknown) => { const s = slot(); if (!("value" in s)) s.value = { current: initial }; return s.value; },
        useCallback: (callback: unknown) => callback,
        useId: () => "catalogue-review",
        useTransition: () => [false, (callback: () => unknown) => callback()],
        useEffect: (effect: Effect, deps?: unknown[]) => {
            const s = slot(); const same = deps && s.deps && deps.length === s.deps.length && deps.every((x, i) => Object.is(x, s.deps![i]));
            if (!same) replay.effects.push(() => { s.cleanup?.(); s.cleanup = effect() || undefined; });
            s.deps = deps;
        },
    };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: replay.other }) }));
vi.mock("./actions", () => ({ createEstimateAction: replay.other, updateEstimateMarginsAction: replay.other, updateEstimateNameAction: replay.other, addLineItemAction: replay.other, updateLineItemAction: replay.save, deleteLineItemAction: replay.other, setActiveEstimateAction: replay.other, deleteEstimateAction: replay.other, setPricingModeAction: replay.other, saveDiscountAction: replay.other }));
vi.mock("./activity-actions", () => ({ savePriceLineActivityAction: replay.activity }));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.other }));
vi.mock("@/app/dashboard/foundations/vision-takeoff", () => ({ default: () => null }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));
vi.mock("sonner", () => ({ toast: { error: replay.error } }));
import AdvancedEstimate from "./advanced-estimate";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
let estimates: Estimate[];
let library: CostLibraryItem[];
let projectId: string;
let activeTab: string;
let ledger: Record<string, "draft" | "saving" | "uncertain">;
let tree: unknown;
let rowTree: unknown;
function renderSurface(name: string, render: () => unknown) {
    replay.surface = name; replay.cursor = 0; replay.effects = [];
    const value = render(); for (const effect of replay.effects) effect(); return value;
}
function rowElement() { return nodes(tree).find(n => typeof n.props.onLibrarySelect === "function")!; }
function render() {
    tree = renderSurface("parent", () => AdvancedEstimate({ estimates, setEstimates: update => { estimates = update(estimates); }, activeTab, setActiveTab: id => { activeTab = id; }, costLibrary: library, projectId, orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [], resourceSaveStates: ledger,
        onResourceSaveStateChanged: (id, state) => { ledger = { ...ledger }; if (state === "confirmed") delete ledger[id]; else ledger[id] = state; },
        onLineSaveStateChanged: (id, state) => { ledger = { ...ledger }; if (state === "confirmed") delete ledger[`line:${id}`]; else ledger[`line:${id}`] = state; },
    }));
    const row = rowElement();
    rowTree = row ? renderSurface("row", () => (row.type as (props: Record<string, unknown>) => unknown)(row.props)) : null;
}
async function settle() { for (let i = 0; i < 10; i++) { await Promise.resolve(); render(); } }
function select() { (rowElement().props.onLibrarySelect as (id: string, item: string, section: string) => void)("line", "catalogue", "Kitchen"); render(); }
function button(label: string) { return nodes(tree).find(n => n.type === "button" && n.props.children === label)!; }
function click(label: string) { (button(label).props.onClick as () => void)(); render(); }
function review() { return nodes(tree).find(n => n.props["data-catalogue-review"] === "line"); }
function unmount() { for (const slots of Object.values(replay.slots)) for (const s of slots) s.cleanup?.(); }
function pending() {
    let resolve!: (value: unknown) => void; let reject!: (error: Error) => void;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function acknowledgement() { return { success: true, line: { id: "line", description: library[0].description, unit: library[0].unit, unit_rate: library[0].base_rate, cost_library_item_id: "catalogue", quantity: 3, line_total: 30.37 } }; }

beforeEach(() => {
    vi.useFakeTimers(); replay.slots = {}; replay.effects = []; replay.save.mockReset(); replay.other.mockReset(); replay.error.mockReset();
    projectId = "project"; activeTab = "estimate"; ledger = {};
    library = [{ id: "catalogue", code: "K1", description: "Catalogue cupboards", unit: "m2", base_rate: 10.1234, category: "Kitchen" }];
    estimates = [{ id: "estimate", project_id: "project", version_name: "Estimate", overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 12, is_active: true,
        estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Current cupboards", quantity: 3, unit: "item", unit_rate: 4, line_total: 12, trade_section: "Kitchen", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] }];
    replay.save.mockImplementation(async () => acknowledgement()); render();
});
afterEach(() => { unmount(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("reviewed catalogue choice in the actual Advanced row and parent", () => {
    it("selection and Cancel show exact source/quantity without writes, price or row changes", async () => {
        const before = JSON.stringify(estimates); select();
        expect(text(review())).toContain("10.1234"); expect(text(review())).toContain("Retained line quantity:  3");
        expect(ledger).toEqual({ "catalogue:line": "draft" });
        click("Cancel catalogue review"); await vi.advanceTimersByTimeAsync(500);
        expect(JSON.stringify(estimates)).toBe(before); expect(ledger).toEqual({});
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
    });
    it("explicit Save sends exactly one unchanged action payload and publishes stored total only after acknowledgement", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        select(); click("Save catalogue choice"); click("Save catalogue choice");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { description: "Catalogue cupboards", unit: "m2", unit_rate: 10.1234, cost_library_item_id: "catalogue" });
        expect(estimates[0].total_cost).toBe(12); expect(estimates[0].estimate_lines[0].description).toBe("Current cupboards");
        request.resolve(acknowledgement()); await settle();
        expect(estimates[0].total_cost).toBe(30.37); expect(estimates[0].estimate_lines[0]).toMatchObject({ id: "line", quantity: 3, unit: "m2", unit_rate: 10.1234, trade_section: "Kitchen", pricing_mode: "simple", estimate_line_components: [] });
        expect(review()).toBeUndefined(); expect(ledger).toEqual({});
    });
    it("catalogue click cancels the actual delayed free-text blur; Cancel cannot leak the search into a write", async () => {
        const input = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!;
        (input.props.onChange as (e: unknown) => void)({ target: { value: "Catalogue" } }); render();
        const typed = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!;
        (typed.props.onBlur as () => void)();
        const item = nodes(rowTree).find(n => n.type === "button" && text(n).includes("K1"))!;
        (item.props.onClick as () => void)(); render();
        click("Cancel catalogue review"); await vi.advanceTimersByTimeAsync(500); render();
        expect(replay.save).not.toHaveBeenCalled(); expect(estimates[0].estimate_lines[0].description).toBe("Current cupboards");
    });
    it("requires explicit ordinary free-text Save outside catalogue review", async () => {
        const input = nodes(rowTree).find(n => n.props["aria-label"] === "Description")!;
        (input.props.onChange as (e: unknown) => void)({ target: { value: "Contractor wording" } }); render();
        expect(nodes(rowTree).find(n => n.props["aria-label"] === "Description")!.props.onBlur).toBeUndefined();
        expect(replay.save).not.toHaveBeenCalled(); descriptionClick("Save description");
        await vi.advanceTimersByTimeAsync(200);
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { description: "Contractor wording" });
    });
    it("an old blur handler replayed after Cancel cannot write the previous catalogue search", async () => {
        const input = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!;
        (input.props.onChange as (e: unknown) => void)({ target: { value: "Catalogue" } }); render();
        const oldBlur = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!.props.onBlur as () => void;
        (nodes(rowTree).find(n => n.type === "button" && text(n).includes("K1"))!.props.onClick as () => void)(); render();
        click("Cancel catalogue review"); oldBlur(); await vi.advanceTimersByTimeAsync(500); render();
        expect(replay.save).not.toHaveBeenCalled(); expect(estimates[0].estimate_lines[0].description).toBe("Current cupboards");
    });
    it("keyboard focus into a catalogue option cancels the pending free-text blur before explicit selection", async () => {
        const input = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!;
        (input.props.onChange as (e: unknown) => void)({ target: { value: "Catalogue" } }); render();
        (nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!.props.onBlur as () => void)();
        const option = nodes(rowTree).find(n => n.type === "button" && text(n).includes("K1"))!;
        (option.props.onFocus as () => void)(); await vi.advanceTimersByTimeAsync(500);
        expect(replay.save).not.toHaveBeenCalled();
        (option.props.onClick as () => void)(); render(); click("Cancel catalogue review");
        await vi.advanceTimersByTimeAsync(500); expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["source", "quantity", "activity", "project", "resource"])("changed %s refuses the reviewed Save without writing", kind => {
        select(); const save = button("Save catalogue choice").props.onClick as () => void;
        if (kind === "source") library = [{ ...library[0], base_rate: 99 }];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 6 };
        if (kind === "activity") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], trade_section: "New activity" };
        if (kind === "project") projectId = "other";
        if (kind === "resource") ledger = { ...ledger, "resource:line": "saving" };
        render(); save(); render(); expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["refusal", "rejection", "wrong id", "wrong quantity", "wrong source", "missing total", "warning"])("%s retains the consumed review and prevents blind retry", async kind => {
        const ack = acknowledgement();
        if (kind === "refusal") replay.save.mockResolvedValue({ success: false, error: "Owner/edit-lock refusal" });
        else if (kind === "rejection") replay.save.mockRejectedValue(new Error("lost response"));
        else {
            if (kind === "wrong id") ack.line.id = "other";
            if (kind === "wrong quantity") ack.line.quantity = 6;
            if (kind === "wrong source") ack.line.cost_library_item_id = "other";
            if (kind === "missing total") ack.line.line_total = NaN;
            replay.save.mockResolvedValue(kind === "warning" ? { ...ack, warning: "Stored total refresh failed" } : ack);
        }
        select(); click("Save catalogue choice"); await settle();
        expect(text(review())).toContain("may already have saved");
        click("Save catalogue choice"); click("Cancel catalogue review"); await settle();
        expect(replay.save).toHaveBeenCalledTimes(1); expect(review()).toBeDefined();
        expect(ledger["line:line"]).toBe("uncertain");
        expect(estimates[0].total_cost).toBe(kind === "warning" ? 30.37 : 12);
    });
    it("late acknowledgement cannot overwrite a changed current row", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        select(); click("Save catalogue choice");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], description: "Newer current work" }; render();
        request.resolve(acknowledgement()); await settle();
        expect(estimates[0].estimate_lines[0].description).toBe("Newer current work"); expect(estimates[0].total_cost).toBe(12);
        expect(text(review())).toContain("may already have saved");
    });
    it("unmount after Save cannot publish a late acknowledgement", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        select(); click("Save catalogue choice"); unmount(); request.resolve(acknowledgement());
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(estimates[0].total_cost).toBe(12); expect(replay.error).not.toHaveBeenCalled();
    });
    it("old Save/Cancel handlers after unmount cannot write or erase the retained draft ledger", async () => {
        select(); const save = button("Save catalogue choice").props.onClick as () => void;
        const cancel = button("Cancel catalogue review").props.onClick as () => void;
        unmount(); save(); cancel();
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({ "catalogue:line": "draft" });
    });
    it("review reserves the existing draft ledger against delete, mode changes and resource Apply", () => {
        select();
        (rowElement().props.onDelete as (id: string) => void)("line");
        (rowElement().props.onUpdate as (id: string, patch: unknown) => void)("line", { quantity: 8 });
        expect(rowElement().props.saveBlocked).toBe(true); expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
    });
    it.each(["boq", "buildup", "preliminaries"])("does not invent a catalogue replacement policy for %s", kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "buildup") estimates[0].estimate_lines[0].pricing_mode = "buildup";
        if (kind === "preliminaries") estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        render(); select(); expect(review()).toBeUndefined(); expect(replay.save).not.toHaveBeenCalled();
    });
});

function quantityInput() { return nodes(rowTree).find(n => n.props["aria-label"] === "Quantity")!; }
function quantityEdit(raw: string) { (quantityInput().props.onChange as (e: unknown) => void)({ target: { value: raw } }); render(); }
function quantityButton(label: string) { return nodes(rowTree).find(n => n.type === "button" && n.props.children === label)!; }
function quantityClick(label: string) { (quantityButton(label).props.onClick as () => void)(); render(); }
function quantityAck(quantity = 5.123, total = 20.49) { return { success: true, line: { id: "line", quantity, unit_rate: 4, line_total: total } }; }

describe("explicit ordinary Advanced quantity draft", () => {
    beforeEach(() => { replay.save.mockImplementation(async () => quantityAck()); });

    it.each(["", " ", "-", ".", "1e", "1x", "0x10", "Infinity", "NaN", "1e309"])("raw %j and blur/Cancel never write or turn into zero", async raw => {
        const before = JSON.stringify(estimates); quantityEdit(raw);
        expect(quantityInput().props.value).toBe(raw); expect(quantityInput().props.onBlur).toBeUndefined();
        expect(quantityInput().props["aria-invalid"]).toBe(true);
        quantityClick("Save quantity"); await settle();
        expect(replay.save).not.toHaveBeenCalled(); expect(JSON.stringify(estimates)).toBe(before);
        quantityClick("Cancel quantity"); await vi.advanceTimersByTimeAsync(500);
        expect(quantityInput().props.value).toBe("3"); expect(ledger).toEqual({}); expect(replay.save).not.toHaveBeenCalled();
    });
    it("one explicit quantity-only Save retains confirmed totals until stored precision is acknowledged", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        const resources = JSON.stringify(estimates[0].estimate_lines[0].estimate_line_components);
        quantityEdit("5.123456"); quantityClick("Save quantity"); quantityClick("Save quantity");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { quantity: 5.123456 });
        expect(estimates[0].estimate_lines[0].quantity).toBe(3); expect(estimates[0].total_cost).toBe(12);
        request.resolve(quantityAck()); await settle();
        expect(estimates[0].estimate_lines[0]).toMatchObject({ quantity: 5.123, unit_rate: 4, line_total: 20.49, unit: "item", description: "Current cupboards", trade_section: "Kitchen" });
        expect(estimates[0].total_cost).toBe(20.49); expect(quantityInput().props.value).toBe("5.123"); expect(ledger).toEqual({});
        expect(JSON.stringify(estimates[0].estimate_lines[0].estimate_line_components)).toBe(resources);
    });
    it.each(["0", "-2.5", "+2.5", ".5", "2e2"])("preserves supported finite signed/zero/exponent input %s", async raw => {
        const quantity = Number(raw); replay.save.mockResolvedValue(quantityAck(quantity, quantity * 4));
        quantityEdit(raw); quantityClick("Save quantity"); await settle();
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { quantity });
        expect(estimates[0].estimate_lines[0].quantity).toBe(quantity);
    });
    it("an unchanged numeric value closes without an update", async () => {
        quantityEdit("3.000"); quantityClick("Save quantity"); await settle();
        expect(ledger).toEqual({}); expect(replay.save).not.toHaveBeenCalled();
    });
    it("finite input whose total overflows is refused without guessing a smaller value", async () => {
        quantityEdit("1e308"); quantityClick("Save quantity"); await settle();
        expect(quantityInput().props["aria-invalid"]).toBe(true); expect(replay.save).not.toHaveBeenCalled();
    });
    it("typing reserves the shared parent ledger and fences row/catalogue/delete writes", () => {
        quantityEdit("5");
        expect(ledger).toEqual({ "quantity:line": "draft" });
        select(); expect(review()).toBeUndefined();
        (rowElement().props.onDelete as (id: string) => void)("line");
        (rowElement().props.onUpdate as (id: string, patch: unknown) => void)("line", { unit_rate: 99 });
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
        expect(estimates[0].total_cost).toBe(12);
    });
    it("catalogue or resource draft work refuses an old quantity handler", () => {
        const edit = quantityInput().props.onChange as (e: unknown) => void;
        select(); edit({ target: { value: "5" } }); render();
        expect(ledger).toEqual({ "catalogue:line": "draft" }); expect(replay.save).not.toHaveBeenCalled();
        click("Cancel catalogue review"); ledger = { "draft:line": "draft" }; render();
        edit({ target: { value: "6" } }); render(); expect(ledger).toEqual({ "draft:line": "draft" });
    });
    it("an old resource draft-close callback cannot release quantity locks or the parent ledger", () => {
        (nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!.props.onClick as () => void)(); render();
        const oldClose = nodes(tree).find(n => n.props.onDraftChanged)!.props.onDraftChanged as (id: string, open: boolean) => void;
        quantityEdit("5"); oldClose("line", false); render();
        (rowElement().props.onUpdate as (id: string, patch: unknown) => void)("line", { unit_rate: 99 });
        (rowElement().props.onDelete as (id: string) => void)("line"); select();
        expect(rowElement().props.saveBlocked).toBe(true); expect(ledger).toEqual({ "quantity:line": "draft" });
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled(); expect(quantityInput().props.value).toBe("5");
    });
    it.each(["quantity", "rate", "activity", "project", "resource"])("changed %s retains the draft and refuses an old Save", async kind => {
        quantityEdit("5"); const save = quantityButton("Save quantity").props.onClick as () => void;
        const line = estimates[0].estimate_lines[0];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...line, quantity: 8 };
        if (kind === "rate") estimates[0].estimate_lines[0] = { ...line, unit_rate: 99 };
        if (kind === "activity") estimates[0].estimate_lines[0] = { ...line, trade_section: "Other work" };
        if (kind === "project") projectId = "other";
        if (kind === "resource") ledger = { ...ledger, "resource:line": "saving" };
        render(); save(); await settle();
        expect(replay.save).not.toHaveBeenCalled(); expect(quantityInput().props.value).toBe("5");
    });
    it("old Save/Cancel/input handlers cannot replace or erase a newer quantity draft", async () => {
        quantityEdit("5"); const save = quantityButton("Save quantity").props.onClick as () => void;
        const cancel = quantityButton("Cancel quantity").props.onClick as () => void;
        const edit = quantityInput().props.onChange as (e: unknown) => void;
        quantityEdit("6"); save(); cancel(); edit({ target: { value: "7" } }); await settle();
        expect(quantityInput().props.value).toBe("6"); expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["refusal", "rejection", "wrong id", "wrong rate", "invalid quantity", "invalid total", "warning"])("%s retains uncertain text and refuses Cancel/blind retry", async kind => {
        const ack = quantityAck();
        if (kind === "refusal") replay.save.mockResolvedValue({ success: false, error: "Locked" });
        else if (kind === "rejection") replay.save.mockRejectedValue(new Error("lost response"));
        else {
            if (kind === "wrong id") ack.line.id = "other";
            if (kind === "wrong rate") ack.line.unit_rate = 99;
            if (kind === "invalid quantity") ack.line.quantity = NaN;
            if (kind === "invalid total") ack.line.line_total = Infinity;
            replay.save.mockResolvedValue(kind === "warning" ? { ...ack, warning: "Aggregate refresh failed" } : ack);
        }
        quantityEdit("5.123456"); quantityClick("Save quantity"); await settle();
        expect(text(rowTree)).toContain("may already have saved");
        expect(text(tree)).toContain("Line save not confirmed - reload to reconcile");
        quantityClick("Cancel quantity"); quantityClick("Save quantity"); await settle();
        expect(quantityInput().props.value).toBe("5.123456"); expect(replay.save).toHaveBeenCalledTimes(1);
        expect(ledger["line:line"]).toBe("uncertain"); expect(estimates[0].total_cost).toBe(kind === "warning" ? 20.49 : 12);
    });
    it("a late result preserves newer source values rather than publishing over them", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        quantityEdit("5.123456"); quantityClick("Save quantity");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 9, line_total: 36 }; estimates[0].total_cost = 36; render();
        request.resolve(quantityAck()); await settle();
        expect(estimates[0].estimate_lines[0].quantity).toBe(9); expect(estimates[0].total_cost).toBe(36);
        expect(quantityInput().props.value).toBe("5.123456");
    });
    it("unmount suppresses stale handlers and late publication", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        quantityEdit("5"); const save = quantityButton("Save quantity").props.onClick as () => void;
        const cancel = quantityButton("Cancel quantity").props.onClick as () => void;
        quantityClick("Save quantity"); unmount(); save(); cancel(); request.resolve(quantityAck());
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates[0].total_cost).toBe(12); expect(replay.error).not.toHaveBeenCalled();
    });
    it("an unsaved description is not overwritten by starting quantity work", () => {
        const description = nodes(rowTree).find(n => n.props["aria-label"] === "Description")!;
        const oldQuantity = quantityInput().props.onChange as (e: unknown) => void;
        (description.props.onChange as (e: unknown) => void)({ target: { value: "Unsaved wording" } }); render();
        oldQuantity({ target: { value: "8" } }); render();
        expect(quantityInput().props.disabled).toBe(true); expect(ledger).toEqual({ "description:line": "draft" });
        expect(nodes(rowTree).find(n => n.props["aria-label"] === "Description")!.props.value).toBe("Unsaved wording");
    });
    it.each(["boq", "buildup", "preliminaries"])("preserves the existing special %s quantity path", kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "buildup") estimates[0].estimate_lines[0].pricing_mode = "buildup";
        if (kind === "preliminaries") estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        render(); expect(quantityInput().props.type).toBe("number"); expect(quantityInput().props.onBlur).toBeTypeOf("function");
    });
    it.each(["boq", "buildup", "preliminaries"])("keeps existing raw work visible/cancellable if its source becomes %s", async kind => {
        quantityEdit("5");
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "buildup") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], pricing_mode: "buildup" };
        if (kind === "preliminaries") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], trade_section: "Preliminaries" };
        render(); expect(quantityInput().props.value).toBe("5");
        quantityClick("Save quantity"); await settle(); expect(replay.save).not.toHaveBeenCalled();
        quantityClick("Cancel quantity"); render(); expect(ledger).toEqual({}); expect(quantityInput().props.type).toBe("number");
    });
});

let activityTree: unknown;
function renderActivity() {
    render();
    const element = nodes(rowTree).find(n => n.props["helpText"] !== undefined);
    activityTree = element ? renderSurface("activity", () => (element.type as (props: Record<string, unknown>) => unknown)(element.props)) : null;
}
function activityButton(label: string) { return nodes(activityTree).find(n => n.type === "button" && text(n).includes(label))!; }
function activityClick(label: string) { (activityButton(label).props.onClick as () => void)(); renderActivity(); }
function activityType(value: string) {
    (nodes(activityTree).find(n => n.type === "input")!.props.onChange as (e: unknown) => void)({ currentTarget: { value } }); renderActivity();
}
async function settleActivity() { for (let i = 0; i < 10; i++) { await Promise.resolve(); renderActivity(); } }
function activityAck(section = "Fit out") { return { ok: true, lineId: "line", estimateId: "estimate", section }; }

describe("reviewed activity assignment in actual Advanced estimating", () => {
    beforeEach(() => { replay.activity.mockReset(); replay.activity.mockResolvedValue(activityAck()); renderActivity(); });
    it("old input/Save/Cancel handlers cannot overwrite, save or discard a reopened draft", () => {
        activityClick("Change"); activityType("Old wording");
        const oldInput = nodes(activityTree).find(n => n.type === "input")!.props.onChange as (e: unknown) => void;
        const oldSave = activityButton("Save activity").props.onClick as () => void;
        const oldCancel = activityButton("Cancel").props.onClick as () => void;
        activityClick("Cancel"); activityClick("Change"); activityType("New wording");
        oldInput({ currentTarget: { value: "Replayed" } }); oldSave(); oldCancel(); renderActivity();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("New wording");
        expect(replay.activity).not.toHaveBeenCalled(); expect(ledger["activity:line"]).toBe("draft");
    });
    it("the saved estimate's row order, IDs, other activities and full total survive assignment to an existing activity", async () => {
        const line = estimates[0].estimate_lines[0];
        estimates[0].estimate_lines.push({ ...line, id: "second", trade_section: "Fit out", line_total: 20 });
        estimates[0].total_cost = 32; renderActivity();
        activityClick("Change");
        expect(nodes(activityTree).filter(n => n.type === "option").map(n => n.props.value)).toEqual(["Kitchen", "Fit out"]);
        activityType("Fit out"); activityClick("Save activity"); await settleActivity();
        expect(estimates[0].estimate_lines.map(row => row.id)).toEqual(["line", "second"]);
        expect(estimates[0].estimate_lines.map(row => row.trade_section)).toEqual(["Fit out", "Fit out"]);
        expect(estimates[0].total_cost).toBe(32);
    });
    it("opens closed by default, uses current activities only, and typing/Cancel never write", () => {
        const before = JSON.stringify(estimates);
        expect(nodes(activityTree).some(n => n.type === "input")).toBe(false);
        activityClick("Change"); activityType("Fit out");
        expect(nodes(activityTree).filter(n => n.type === "option").map(n => n.props.value)).toEqual(["Kitchen"]);
        expect(text(activityTree)).toContain("Client BoQ, built-up and Preliminaries lines are not assigned");
        activityClick("Cancel"); expect(JSON.stringify(estimates)).toBe(before); expect(ledger).toEqual({});
        expect(replay.activity).not.toHaveBeenCalled(); expect(replay.save).not.toHaveBeenCalled();
    });
    it("saves one trimmed activity after explicit choice, retaining every financial/resource field and source array order", async () => {
        const request = pending(); replay.activity.mockReturnValue(request.promise);
        const before = JSON.parse(JSON.stringify(estimates)) as Estimate[];
        activityClick("Change"); activityType("  Fit out  "); activityClick("Save activity"); activityClick("Saving activity");
        expect(replay.activity).toHaveBeenCalledExactlyOnceWith({ lineId: "line", estimateId: "estimate", expectedSection: "Kitchen", section: "Fit out" });
        expect(estimates).toEqual(before);
        request.resolve(activityAck()); await settleActivity();
        before[0].estimate_lines[0].trade_section = "Fit out";
        expect(estimates).toEqual(before); expect(ledger).toEqual({}); expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["", " ", "a".repeat(101)])("refuses blank/overlong %j without truncation or a write", async raw => {
        activityClick("Change"); activityType(raw); activityClick("Save activity"); await settleActivity();
        expect(replay.activity).not.toHaveBeenCalled(); expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe(raw);
    });
    it.each(["project", "estimate", "quantity", "activity", "mode", "boq", "resources", "ledger"])("changed %s source refuses Save and retains Cancel", async kind => {
        activityClick("Change"); activityType("Fit out");
        if (kind === "project") projectId = "other";
        if (kind === "estimate") activeTab = "missing";
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 7 };
        if (kind === "activity") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], trade_section: "Other" };
        if (kind === "mode") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], pricing_mode: "buildup" };
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "resources") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], estimate_line_components: [{ id: "resource" } as never] };
        if (kind === "ledger") ledger = { ...ledger, "opening:project": "draft" };
        if (kind === "estimate" || kind === "project") {
            renderActivity(); expect(replay.activity).not.toHaveBeenCalled(); expect(ledger["activity:line"]).toBe("draft");
            expect(retainedText().props.value).toBe("Fit out"); expect(retainedText().props.readOnly).toBe(true);
            cancelRetained(); expect(ledger["activity:line"]).toBeUndefined(); return;
        }
        renderActivity(); activityClick("Save activity"); await settleActivity();
        expect(replay.activity).not.toHaveBeenCalled(); expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("Fit out");
        activityClick("Cancel"); expect(ledger["activity:line"]).toBeUndefined();
    });
    it.each(["refused", "rejected", "wrong id", "wrong estimate", "wrong section", "uncertain"])("%s acknowledgement cannot publish a guessed activity", async kind => {
        if (kind === "refused") replay.activity.mockResolvedValue({ ok: false, error: "Owner/edit-lock refusal" });
        if (kind === "rejected") replay.activity.mockRejectedValue(new Error("lost response"));
        if (kind === "wrong id") replay.activity.mockResolvedValue({ ...activityAck(), lineId: "other" });
        if (kind === "wrong estimate") replay.activity.mockResolvedValue({ ...activityAck(), estimateId: "other" });
        if (kind === "wrong section") replay.activity.mockResolvedValue(activityAck("Guessed"));
        if (kind === "uncertain") replay.activity.mockResolvedValue({ ok: false, uncertain: true, error: "May have saved" });
        activityClick("Change"); activityType("Fit out"); activityClick("Save activity"); await settleActivity();
        expect(estimates[0].estimate_lines[0].trade_section).toBe("Kitchen");
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("Fit out");
        if (kind === "refused") { activityClick("Cancel"); expect(ledger).toEqual({}); }
        else { activityClick("Save activity"); activityClick("Cancel"); expect(replay.activity).toHaveBeenCalledTimes(1); expect(ledger["activity:line"]).toBe("uncertain"); }
    });
    it("late success retains newer fields and does not mark them saved", async () => {
        const request = pending(); replay.activity.mockReturnValue(request.promise);
        activityClick("Change"); activityType("Fit out"); activityClick("Save activity");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], description: "Newer work" }; renderActivity();
        request.resolve(activityAck()); await settleActivity();
        expect(estimates[0].estimate_lines[0]).toMatchObject({ description: "Newer work", trade_section: "Kitchen" });
        expect(ledger["activity:line"]).toBe("uncertain");
    });
    it("holds the same keyed row in its reviewed group across external activity changes until Cancel", async () => {
        activityClick("Change"); activityType("Retained wording");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], trade_section: "External activity" };
        renderActivity();
        expect(nodes(tree).filter(n => n.props.role === "group").map(n => n.props["aria-label"])).toContain("Kitchen");
        expect(text(tree)).toContain("This review stays in its original group");
        expect(nodes(activityTree).filter(n => n.type === "option").map(n => n.props.value)).toEqual(["External activity"]);
        activityClick("Save activity"); await settleActivity(); expect(replay.activity).not.toHaveBeenCalled();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("Retained wording");
        activityClick("Cancel");
        expect(nodes(tree).filter(n => n.props.role === "group").map(n => n.props["aria-label"])).toContain("External activity");
        expect(estimates[0].estimate_lines[0].trade_section).toBe("External activity");
    });
    it("unmount suppresses late publication and old Save/Cancel handlers", async () => {
        const request = pending(); replay.activity.mockReturnValue(request.promise);
        activityClick("Change"); activityType("Fit out"); activityClick("Save activity"); unmount();
        request.resolve(activityAck()); for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(estimates[0].estimate_lines[0].trade_section).toBe("Kitchen"); expect(ledger["activity:line"]).toBe("saving");
    });
    it("independent review survives an old resource-close callback and blocks row writes/Apply/delete/navigation", () => {
        const disclosure = nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!;
        (disclosure.props.onClick as () => void)(); renderActivity();
        const resource = nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!;
        activityClick("Change");
        (resource.props.onDraftChanged as (id: string, open: boolean) => void)("line", false); renderActivity();
        (rowElement().props.onUpdate as (id: string, p: unknown) => void)("line", { unit_rate: 99 });
        (rowElement().props.onDelete as (id: string) => void)("line");
        expect((resource.props.canApplyRate as () => boolean)()).toBe(false);
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
        expect(ledger["activity:line"]).toBe("draft");
    });
    it("refuses to open over unsaved description text and cancels old blur replay for a clean review", async () => {
        const input = nodes(rowTree).find(n => n.props["aria-label"] === "Description")!;
        (input.props.onChange as (e: unknown) => void)({ target: { value: "Unsaved words" } }); renderActivity();
        activityClick("Change"); expect(ledger).toEqual({ "description:line": "draft" });
        (nodes(rowTree).find(n => n.props["aria-label"] === "Description")!.props.onChange as (e: unknown) => void)({ target: { value: "Current cupboards" } }); renderActivity();
        descriptionClick("Save description"); renderActivity();
        const oldBlur = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!.props.onBlur as () => void;
        oldBlur(); activityClick("Change"); activityClick("Cancel"); oldBlur(); await vi.advanceTimersByTimeAsync(500);
        expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["boq", "buildup", "preliminaries"])("offers no assignment control for initial %s rows", kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "buildup") estimates[0].estimate_lines[0].pricing_mode = "buildup";
        if (kind === "preliminaries") estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        renderActivity(); expect(activityTree).toBeNull(); expect(replay.activity).not.toHaveBeenCalled();
    });
});

function retainedActivity() { return nodes(tree).find(n => n.props["data-retained-activity"] === "line"); }
function retainedText() { return nodes(retainedActivity()).find(n => n.type === "textarea")!; }
function cancelRetained() {
    const button = nodes(retainedActivity()).find(n => n.type === "button")!;
    (button.props.onClick as () => void)(); renderActivity();
}
describe("parent-owned Advanced activity text through missing membership", () => {
    beforeEach(() => { replay.activity.mockReset(); replay.activity.mockResolvedValue(activityAck()); renderActivity(); });
    it.each(["row", "estimate", "active estimate", "project"])("removal of %s retains exact raw text read-only without writes, recreation or automatic retry", async kind => {
        activityClick("Change"); activityType("  Exact typed\nactivity  ");
        const original = structuredClone(estimates);
        if (kind === "row") estimates = [{ ...estimates[0], estimate_lines: [], total_cost: 0 }];
        if (kind === "estimate") estimates = [];
        if (kind === "active estimate") activeTab = "missing";
        if (kind === "project") projectId = "different";
        const afterRemoval = JSON.stringify(estimates); renderActivity();
        replay.slots.activity = []; // Actual child state is gone; the Advanced parent remains mounted.
        expect(retainedText().props.value).toBe("  Exact typed\nactivity  "); expect(retainedText().props.readOnly).toBe(true);
        expect(ledger["activity:line"]).toBe("draft");
        await vi.advanceTimersByTimeAsync(1000); expect(JSON.stringify(estimates)).toBe(afterRemoval);
        expect(replay.activity).not.toHaveBeenCalled(); expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
        estimates = original; activeTab = "estimate"; projectId = "project"; renderActivity();
        expect(retainedActivity()).toBeUndefined();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("  Exact typed\nactivity  ");
        expect(replay.activity).not.toHaveBeenCalled();
        activityClick("Cancel"); expect(ledger).toEqual({});
    });
    it("deliberate Cancel after removal clears only the draft and does not restore the removed row", () => {
        activityClick("Change"); activityType("Unsaved text");
        estimates = [{ ...estimates[0], estimate_lines: [], total_cost: 0 }]; renderActivity();
        cancelRetained();
        expect(retainedActivity()).toBeUndefined(); expect(estimates[0].estimate_lines).toEqual([]); expect(estimates[0].total_cost).toBe(0);
        expect(ledger).toEqual({}); expect(replay.activity).not.toHaveBeenCalled();
    });
    it.each(["confirmed", "refused", "rejected"])("%s response after removal retains uncertainty through reappearance and cannot be retried/cancelled blindly", async kind => {
        const request = pending(); replay.activity.mockReturnValue(request.promise);
        const original = structuredClone(estimates);
        activityClick("Change"); activityType("  Pending exact text  "); activityClick("Save activity");
        const oldSave = activityButton("Saving activity").props.onClick as () => void;
        estimates = []; renderActivity(); replay.slots.activity = [];
        expect(retainedText().props.value).toBe("  Pending exact text  "); expect(text(retainedActivity())).toContain("awaiting acknowledgement");
        cancelRetained(); oldSave(); expect(ledger["activity:line"]).toBe("saving");
        if (kind === "rejected") request.reject(new Error("lost acknowledgement"));
        else request.resolve(kind === "confirmed" ? activityAck("Pending exact text") : { ok: false, error: "Owner/edit-lock refusal" });
        await settleActivity();
        expect(retainedText().props.value).toBe("  Pending exact text  "); expect(ledger["activity:line"]).toBe("uncertain");
        cancelRetained(); expect(retainedActivity()).toBeDefined();
        estimates = original; renderActivity();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("  Pending exact text  ");
        expect(nodes(activityTree).find(n => n.type === "input")!.props.disabled).toBe(true);
        activityClick("Save activity"); activityClick("Cancel");
        expect(replay.activity).toHaveBeenCalledTimes(1); expect(estimates[0].estimate_lines[0].trade_section).toBe("Kitchen");
    });
    it("a reappearing changed row cannot receive the retained draft or overwrite its current fields", async () => {
        activityClick("Change"); activityType("Retained text");
        const original = structuredClone(estimates); estimates = []; renderActivity(); replay.slots.activity = [];
        estimates = original; estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 9, unit_rate: 8, line_total: 72, trade_section: "External" };
        estimates[0].total_cost = 72; renderActivity();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("Retained text");
        activityClick("Save activity"); await settleActivity(); expect(replay.activity).not.toHaveBeenCalled();
        expect(estimates[0].estimate_lines[0]).toMatchObject({ quantity: 9, unit_rate: 8, line_total: 72, trade_section: "External" });
        activityClick("Cancel"); expect(estimates[0].total_cost).toBe(72);
    });
    it("old raw/Save/Cancel handlers cannot affect a newer parent draft, even after child remount", () => {
        activityClick("Change"); activityType("First");
        const oldInput = nodes(activityTree).find(n => n.type === "input")!.props.onChange as (e: unknown) => void;
        const oldSave = activityButton("Save activity").props.onClick as () => void;
        const oldCancel = activityButton("Cancel").props.onClick as () => void;
        activityType("Newest"); const original = structuredClone(estimates); estimates = []; renderActivity(); replay.slots.activity = [];
        estimates = original; renderActivity(); oldInput({ currentTarget: { value: "Replayed" } }); oldSave(); oldCancel(); renderActivity();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe("Newest");
        expect(replay.activity).not.toHaveBeenCalled(); expect(ledger["activity:line"]).toBe("draft");
    });
    it("an idle old Save after removal cannot recreate a row or lose text when membership returns", async () => {
        activityClick("Change"); activityType(" Exact idle text ");
        const save = activityButton("Save activity").props.onClick as () => void;
        const original = structuredClone(estimates); estimates = []; renderActivity(); replay.slots.activity = [];
        save(); await settleActivity();
        expect(estimates).toEqual([]); expect(retainedText().props.value).toBe(" Exact idle text "); expect(replay.activity).not.toHaveBeenCalled();
        estimates = original; renderActivity();
        expect(nodes(activityTree).find(n => n.type === "input")!.props.value).toBe(" Exact idle text ");
        expect(replay.activity).not.toHaveBeenCalled(); activityClick("Cancel"); expect(ledger).toEqual({});
    });
});

function rateInput() { return nodes(rowTree).find(n => n.props["aria-label"] === "Rate (£)")!; }
function rateEdit(raw: string) { (rateInput().props.onChange as (e: unknown) => void)({ target: { value: raw } }); render(); }
function rateButton(label: string) { return nodes(rowTree).find(n => n.type === "button" && n.props.children === label)!; }
function rateClick(label: string) { (rateButton(label).props.onClick as () => void)(); render(); }
function rateAck(rate = 12.3457, total = 37.04) { return { success: true, line: { id: "line", quantity: 3, unit_rate: rate, line_total: total } }; }
function retainedRate() { return nodes(tree).find(n => n.props["data-retained-rate"] === "line"); }
function retainedRateInput() { return nodes(retainedRate()).find(n => n.props["aria-label"] === "Retained rate text")!; }

describe("explicit ordinary Advanced rate draft", () => {
    beforeEach(() => { replay.save.mockImplementation(async () => rateAck()); });
    it("keeps a saved zero quantity as the counterpart rather than replacing it with one", async () => {
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 0, line_total: 0 }; estimates[0].total_cost = 0; render();
        replay.save.mockResolvedValue({ ...rateAck(12, 0), line: { ...rateAck(12, 0).line, quantity: 0 } });
        rateEdit("12"); rateClick("Save rate"); await settle();
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { unit_rate: 12 });
        expect(estimates[0].estimate_lines[0]).toMatchObject({ quantity: 0, unit_rate: 12, line_total: 0 }); expect(estimates[0].total_cost).toBe(0);
    });
    it("refuses both current and replayed rate input callbacks over a different unsaved description draft", () => {
        const oldRateInput = rateInput().props.onChange as (e: unknown) => void;
        (nodes(rowTree).find(n => n.props["aria-label"] === "Description")!.props.onChange as (e: unknown) => void)({ target: { value: "Unsaved words" } }); render();
        rateEdit("12"); oldRateInput({ target: { value: "13" } }); render();
        expect(rateButton("Save rate")).toBeUndefined(); expect(ledger).toEqual({ "description:line": "draft" }); expect(replay.save).not.toHaveBeenCalled();
        expect(nodes(rowTree).find(n => n.props["aria-label"] === "Description")!.props.value).toBe("Unsaved words");
    });
    it.each(["", " ", "-", ".", "1e", "1x", "0x10", "Infinity", "NaN", "1e309"])("raw %j,blur and Cancel make no writes or zero substitution", async raw => {
        const before = JSON.stringify(estimates); rateEdit(raw);
        expect(rateInput().props.value).toBe(raw); expect(rateInput().props.onBlur).toBeUndefined(); expect(rateInput().props["aria-invalid"]).toBe(true);
        rateClick("Save rate"); await settle(); expect(replay.save).not.toHaveBeenCalled();
        rateClick("Cancel rate"); await vi.advanceTimersByTimeAsync(500); render();
        expect(JSON.stringify(estimates)).toBe(before); expect(rateInput().props.value).toBe("4"); expect(ledger).toEqual({});
    });
    it("one explicit rate-only Save keeps confirmed totals until stored returned precision is acknowledged", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        const before = structuredClone(estimates); rateEdit("12.345678"); rateClick("Save rate"); rateClick("Save rate");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { unit_rate: 12.345678 }); expect(estimates).toEqual(before);
        request.resolve(rateAck()); await settle();
        before[0].estimate_lines[0].unit_rate = 12.3457; before[0].estimate_lines[0].line_total = 37.04; before[0].total_cost = 37.04;
        expect(estimates).toEqual(before); expect(rateInput().props.value).toBe("12.3457"); expect(ledger).toEqual({});
    });
    it.each(["0", "-2.5", "+1.5", "1e2"])("preserves existing finite signed/scientific rate %j", async raw => {
        const value = Number(raw); replay.save.mockResolvedValue(rateAck(value, value * 3));
        rateEdit(raw); rateClick("Save rate"); await settle();
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { unit_rate: value });
        expect(estimates[0].estimate_lines[0].unit_rate).toBe(value); expect(estimates[0].estimate_lines[0].quantity).toBe(3);
    });
    it("unchanged-rate Save closes without a write", () => {
        rateEdit("4.0000"); rateClick("Save rate"); expect(ledger).toEqual({}); expect(replay.save).not.toHaveBeenCalled();
    });
    it("refuses nonfinite multiplication without changing or rescaling resources", () => {
        estimates[0].estimate_lines[0].quantity = 1e308; render(); rateEdit("1e308"); rateClick("Save rate");
        expect(replay.save).not.toHaveBeenCalled(); expect(rateInput().props["aria-invalid"]).toBe(true);
        expect(estimates[0].estimate_lines[0].estimate_line_components).toEqual([]); expect(estimates[0].total_cost).toBe(12);
    });
    it.each(["quantity", "unit", "description", "mode", "boq", "preliminaries", "resource", "ledger"])("changed %s source refuses the old Save without a write", async kind => {
        rateEdit("12"); const save = rateButton("Save rate").props.onClick as () => void;
        const line = estimates[0].estimate_lines[0];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...line, quantity: 7 };
        if (kind === "unit") estimates[0].estimate_lines[0] = { ...line, unit: "m2" };
        if (kind === "description") estimates[0].estimate_lines[0] = { ...line, description: "New source" };
        if (kind === "mode") estimates[0].estimate_lines[0] = { ...line, pricing_mode: "buildup" };
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "preliminaries") estimates[0].estimate_lines[0] = { ...line, trade_section: "Preliminaries" };
        if (kind === "resource") estimates[0].estimate_lines[0] = { ...line, estimate_line_components: [{ id: "new" } as never] };
        if (kind === "ledger") ledger = { ...ledger, "opening:project": "draft" };
        render(); save(); await settle(); expect(replay.save).not.toHaveBeenCalled(); expect(rateInput().props.value).toBe("12");
        rateClick("Cancel rate"); expect(ledger["rate:line"]).toBeUndefined();
    });
    it.each(["refused", "rejected", "wrong id", "changed quantity", "missing rate", "missing total", "warning"])("%s acknowledgement retains exact text/old totals and fences retry/Cancel", async kind => {
        const ack = rateAck();
        if (kind === "refused") replay.save.mockResolvedValue({ success: false, error: "Owner/edit-lock refusal" });
        else if (kind === "rejected") replay.save.mockRejectedValue(new Error("lost response"));
        else {
            if (kind === "wrong id") ack.line.id = "other";
            if (kind === "changed quantity") ack.line.quantity = 7;
            if (kind === "missing rate") ack.line.unit_rate = NaN;
            if (kind === "missing total") ack.line.line_total = NaN;
            replay.save.mockResolvedValue(kind === "warning" ? { ...ack, warning: "Aggregate refresh not confirmed" } : ack);
        }
        rateEdit(" 12.345678 "); rateClick("Save rate"); await settle(); rateClick("Save rate"); rateClick("Cancel rate");
        expect(replay.save).toHaveBeenCalledTimes(1); expect(rateInput().props.value).toBe(" 12.345678 ");
        expect(estimates[0].total_cost).toBe(12); expect(estimates[0].estimate_lines[0].unit_rate).toBe(4);
        expect(ledger["rate:line"]).toBe("draft"); expect(ledger["line:line"]).toBe("uncertain");
    });
    it("older raw/Save/Cancel handlers cannot overwrite,save or close a newer draft", () => {
        rateEdit("8"); const oldInput = rateInput().props.onChange as (e: unknown) => void;
        const oldSave = rateButton("Save rate").props.onClick as () => void, oldCancel = rateButton("Cancel rate").props.onClick as () => void;
        rateEdit("9"); oldInput({ target: { value: "Replayed" } }); oldSave(); oldCancel(); render();
        expect(rateInput().props.value).toBe("9"); expect(ledger["rate:line"]).toBe("draft"); expect(replay.save).not.toHaveBeenCalled();
    });
    it("a late acknowledgement cannot relabel newer source values or totals saved", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); rateEdit("12"); rateClick("Save rate");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 7, line_total: 28 }; estimates[0].total_cost = 28; render();
        request.resolve(rateAck(12, 36)); await settle();
        expect(estimates[0].estimate_lines[0]).toMatchObject({ quantity: 7, unit_rate: 4, line_total: 28 });
        expect(estimates[0].total_cost).toBe(28); expect(rateInput().props.value).toBe("12"); expect(ledger["line:line"]).toBe("uncertain");
    });
    it.each(["row", "estimate", "active estimate", "project"])("missing %s retains read-only exact rate text through reappearance without a write", kind => {
        rateEdit(" 12.34000 "); const original = structuredClone(estimates);
        if (kind === "row") estimates = [{ ...estimates[0], estimate_lines: [], total_cost: 0 }];
        if (kind === "estimate") estimates = [];
        if (kind === "active estimate") activeTab = "missing";
        if (kind === "project") projectId = "other";
        render(); replay.slots.row = [];
        expect(retainedRateInput().props.value).toBe(" 12.34000 "); expect(retainedRateInput().props.readOnly).toBe(true);
        expect(replay.save).not.toHaveBeenCalled();
        estimates = original; activeTab = "estimate"; projectId = "project"; render();
        expect(rateInput().props.value).toBe(" 12.34000 "); expect(replay.save).not.toHaveBeenCalled(); rateClick("Cancel rate"); expect(ledger).toEqual({});
    });
    it("missing-row pending acknowledgement retains uncertainty and cannot Cancel or retry after reappearance", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); const original = structuredClone(estimates);
        rateEdit(" 12 "); rateClick("Save rate"); estimates = []; render();
        (nodes(retainedRate()).find(n => n.type === "button")!.props.onClick as () => void)();
        request.resolve(rateAck(12, 36)); await settle(); expect(retainedRateInput().props.value).toBe(" 12 ");
        expect(ledger["line:line"]).toBe("uncertain"); estimates = original; render(); rateClick("Cancel rate"); rateClick("Save rate");
        expect(rateInput().props.value).toBe(" 12 "); expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates[0].total_cost).toBe(12);
    });
    it("the independent rate lock survives old resource-close and fences quantity/activity/catalogue/Apply/line writes", () => {
        (nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!.props.onClick as () => void)(); render();
        const resource = nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!;
        rateEdit("12"); (resource.props.onDraftChanged as (id: string, open: boolean) => void)("line", false); render();
        (rowElement().props.onUpdate as (id: string, p: unknown) => void)("line", { quantity: 7 });
        (rowElement().props.onDelete as (id: string) => void)("line");
        quantityEdit("8"); select(); renderActivity(); activityClick("Change");
        expect((resource.props.canApplyRate as () => boolean)()).toBe(false); expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
        expect(rateInput().props.value).toBe("12"); expect(ledger["rate:line"]).toBe("draft"); expect(review()).toBeUndefined();
    });
    it.each(["quantity", "activity", "catalogue"])("does not open over an existing %s draft", kind => {
        if (kind === "quantity") quantityEdit("8");
        if (kind === "activity") { renderActivity(); activityClick("Change"); activityType("Retained activity"); }
        if (kind === "catalogue") select();
        const before = JSON.stringify(ledger); rateEdit("12"); expect(JSON.stringify(ledger)).toBe(before); expect(rateButton("Save rate")).toBeUndefined();
        expect(replay.save).not.toHaveBeenCalled();
    });
    it("unmount suppresses late publication and old Save/Cancel callbacks", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); rateEdit("12");
        const oldSave = rateButton("Save rate").props.onClick as () => void, oldCancel = rateButton("Cancel rate").props.onClick as () => void;
        rateClick("Save rate"); unmount(); oldSave(); oldCancel(); request.resolve(rateAck(12, 36));
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(estimates[0].total_cost).toBe(12); expect(replay.save).toHaveBeenCalledTimes(1); expect(ledger["rate:line"]).toBe("draft");
    });
    it.each(["boq", "preliminaries"])("keeps initial special %s rate's existing numeric blur path unchanged", kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        else estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        render(); expect(rateInput().props.type).toBe("number"); expect(rateInput().props.onBlur).toBeTypeOf("function");
    });
    it("keeps initial built-up rate display unchanged", () => {
        estimates[0].estimate_lines[0].pricing_mode = "buildup"; render(); expect(rateInput()).toBeUndefined(); expect(text(rowTree)).toContain("built up");
    });
});

function unitInput() { return nodes(rowTree).find(n => n.props["aria-label"] === "Unit")!; }
function unitEdit(unit: string) { (unitInput().props.onChange as (e: unknown) => void)({ target: { value: unit } }); render(); }
function unitButton(label: string) { return nodes(rowTree).find(n => n.type === "button" && n.props.children === label)!; }
function unitClick(label: string) { (unitButton(label).props.onClick as () => void)(); render(); }
function unitAck(unit = "m2") { return { success: true, line: { id: "line", unit } }; }
function retainedUnit() { return nodes(tree).find(n => n.props["data-retained-unit"] === "line"); }

describe("reviewed ordinary Advanced unit choice", () => {
    beforeEach(() => { replay.save.mockImplementation(async () => unitAck()); });
    it.each(["item", "legacy box", "", "  m2  "])("shows exact saved unit %j and selection/Cancel never writes or changes finances", async unit => {
        estimates[0].estimate_lines[0].unit = unit; render();
        expect(unitInput().props.value).toBe(unit);
        expect(nodes(unitInput()).some(n => n.type === "option" && n.props.value === unit)).toBe(true);
        const before = structuredClone(estimates); unitEdit("m2");
        expect(unitInput().props.value).toBe("m2"); expect(unitInput().props.onBlur).toBeUndefined();
        expect(text(rowTree)).toContain("No quantity, rate or resource conversion occurs");
        expect(estimates).toEqual(before); expect(ledger).toEqual({ "unit:line": "draft" });
        unitClick("Cancel unit"); await vi.advanceTimersByTimeAsync(500);
        expect(estimates).toEqual(before); expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({});
    });
    it("one explicit unit-only Save publishes only the exact acknowledged unit and preserves all totals/precision/resources", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 3.123456, unit_rate: 4.56789, line_total: 14.27, estimate_line_components: [{ id: "resource", quantity: 8.1234 } as never] };
        estimates[0].total_cost = 14.27; render(); const before = structuredClone(estimates);
        unitEdit("m2"); unitClick("Save unit"); unitClick("Save unit"); unitClick("Cancel unit");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { unit: "m2" }); expect(estimates).toEqual(before);
        request.resolve(unitAck()); await settle(); before[0].estimate_lines[0].unit = "m2";
        expect(estimates).toEqual(before); expect(ledger).toEqual({}); expect(unitButton("Save unit")).toBeUndefined();
    });
    it("returning deliberately to the exact saved legacy unit closes without writing or normalizing", () => {
        estimates[0].estimate_lines[0].unit = "  old box  "; render(); unitEdit("m2"); unitEdit("  old box  "); unitClick("Save unit");
        expect(replay.save).not.toHaveBeenCalled(); expect(estimates[0].estimate_lines[0].unit).toBe("  old box  "); expect(ledger).toEqual({});
    });
    it.each(["unsupported", "M2", " m2 ", ""])("refuses a tampered unsupported selection %j rather than inventing units", unit => {
        unitEdit(unit); expect(unitButton("Save unit")).toBeUndefined(); expect(ledger).toEqual({}); expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["quantity", "rate", "unit", "resource", "description", "activity", "mode", "boq", "project", "ledger"])("changed %s source refuses stale Save and retains the choice", async kind => {
        unitEdit("m2"); const oldSave = unitButton("Save unit").props.onClick as () => void;
        const line = estimates[0].estimate_lines[0];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...line, quantity: 9 };
        if (kind === "rate") estimates[0].estimate_lines[0] = { ...line, unit_rate: 9 };
        if (kind === "unit") estimates[0].estimate_lines[0] = { ...line, unit: "day" };
        if (kind === "resource") estimates[0].estimate_lines[0] = { ...line, estimate_line_components: [{ id: "new" } as never] };
        if (kind === "description") estimates[0].estimate_lines[0] = { ...line, description: "Changed source" };
        if (kind === "activity") estimates[0].estimate_lines[0] = { ...line, trade_section: "Preliminaries" };
        if (kind === "mode") estimates[0].estimate_lines[0] = { ...line, pricing_mode: "buildup" };
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "project") projectId = "other";
        if (kind === "ledger") ledger = { ...ledger, "opening:project": "draft" };
        render(); oldSave(); await settle(); expect(replay.save).not.toHaveBeenCalled();
        if (kind === "project") expect(nodes(retainedUnit()).find(n => n.type === "input")!.props.value).toBe("m2");
        else { expect(unitInput().props.value).toBe("m2"); unitClick("Cancel unit"); }
        expect(estimates[0].total_cost).toBe(12);
    });
    it.each(["refusal", "rejection", "wrong id", "wrong unit", "missing unit", "warning", "unknown"])("%s acknowledgement retains consumed choice/old totals and fences retry/Cancel", async kind => {
        if (kind === "refusal") replay.save.mockResolvedValue({ success: false, error: "Owner/edit-lock refusal" });
        else if (kind === "rejection") replay.save.mockRejectedValue(new Error("lost response"));
        else if (kind === "unknown") replay.save.mockResolvedValue(undefined);
        else {
            const ack = unitAck(); if (kind === "wrong id") ack.line.id = "other";
            if (kind === "wrong unit") ack.line.unit = "kg";
            if (kind === "missing unit") replay.save.mockResolvedValue({ success: true, line: { id: "line" } });
            else replay.save.mockResolvedValue(kind === "warning" ? { ...ack, warning: "Aggregate refresh unconfirmed" } : ack);
        }
        const before = structuredClone(estimates); unitEdit("m2"); unitClick("Save unit"); await settle();
        expect(text(rowTree)).toContain("may already have saved"); unitClick("Save unit"); unitClick("Cancel unit");
        expect(replay.save).toHaveBeenCalledTimes(1); expect(unitInput().props.value).toBe("m2"); expect(estimates).toEqual(before);
        expect(ledger["unit:line"]).toBe("draft"); expect(ledger["line:line"]).toBe("uncertain");
    });
    it("old selection/Save/Cancel callbacks cannot overwrite a newer reviewed choice", () => {
        unitEdit("m2"); const oldInput = unitInput().props.onChange as (e: unknown) => void;
        const oldSave = unitButton("Save unit").props.onClick as () => void, oldCancel = unitButton("Cancel unit").props.onClick as () => void;
        unitEdit("kg"); oldInput({ target: { value: "day" } }); oldSave(); oldCancel(); render();
        expect(unitInput().props.value).toBe("kg"); expect(replay.save).not.toHaveBeenCalled(); expect(ledger["unit:line"]).toBe("draft");
    });
    it("late confirmation cannot overwrite changed source quantities/resources or totals", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); unitEdit("m2"); unitClick("Save unit");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 7, line_total: 28 }; estimates[0].total_cost = 28; render();
        request.resolve(unitAck()); await settle();
        expect(estimates[0].estimate_lines[0]).toMatchObject({ unit: "item", quantity: 7, line_total: 28 });
        expect(estimates[0].total_cost).toBe(28); expect(unitInput().props.value).toBe("m2"); expect(ledger["line:line"]).toBe("uncertain");
    });
    it.each(["row", "estimate", "active estimate", "project"])("missing %s keeps the exact read-only choice through remount with no recreated row/write", kind => {
        unitEdit("kg"); const original = structuredClone(estimates);
        if (kind === "row") estimates = [{ ...estimates[0], estimate_lines: [] }];
        if (kind === "estimate") estimates = [];
        if (kind === "active estimate") activeTab = "missing";
        if (kind === "project") projectId = "other";
        render(); replay.slots.row = [];
        const retained = nodes(retainedUnit()).find(n => n.type === "input")!;
        expect(retained.props.value).toBe("kg"); expect(retained.props.readOnly).toBe(true);
        expect(replay.save).not.toHaveBeenCalled(); estimates = original; activeTab = "estimate"; projectId = "project"; render();
        expect(unitInput().props.value).toBe("kg"); expect(replay.save).not.toHaveBeenCalled(); unitClick("Cancel unit"); expect(ledger).toEqual({});
    });
    it("pending missing-row acknowledgement stays uncertain after membership returns without retry or discard", async () => {
        const original = structuredClone(estimates), request = pending(); replay.save.mockReturnValue(request.promise);
        unitEdit("m2"); unitClick("Save unit"); estimates = []; render();
        (nodes(retainedUnit()).find(n => n.type === "button")!.props.onClick as () => void)();
        request.resolve(unitAck()); await settle(); expect(ledger["line:line"]).toBe("uncertain");
        estimates = original; render(); unitClick("Cancel unit"); unitClick("Save unit");
        expect(unitInput().props.value).toBe("m2"); expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates[0].estimate_lines[0].unit).toBe("item");
    });
    it.each(["quantity", "rate", "activity", "catalogue", "resource"])("does not overwrite an existing %s draft", kind => {
        if (kind === "quantity") quantityEdit("8");
        if (kind === "rate") rateEdit("8");
        if (kind === "activity") { renderActivity(); activityClick("Change"); activityType("Exact existing text"); }
        if (kind === "catalogue") select();
        if (kind === "resource") { ledger = { "resource:line": "draft" }; render(); }
        const before = JSON.stringify(ledger); unitEdit("m2"); expect(JSON.stringify(ledger)).toBe(before);
        expect(unitButton("Save unit")).toBeUndefined(); expect(replay.save).not.toHaveBeenCalled();
    });
    it("independent unit lock survives an old resource-close callback and fences other fields/Apply/delete", () => {
        (nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!.props.onClick as () => void)(); render();
        const resource = nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!;
        unitEdit("m2"); (resource.props.onDraftChanged as (id: string, open: boolean) => void)("line", false); render();
        (rowElement().props.onUpdate as (id: string, fields: unknown) => void)("line", { unit_rate: 99 });
        (rowElement().props.onDelete as (id: string) => void)("line"); quantityEdit("9"); rateEdit("10"); select(); renderActivity(); activityClick("Change");
        expect((resource.props.canApplyRate as () => boolean)()).toBe(false); expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
        expect(unitInput().props.value).toBe("m2"); expect(ledger["unit:line"]).toBe("draft"); expect(review()).toBeUndefined();
    });
    it("refuses current and replayed unit selection over an unsaved free-text description", () => {
        const old = unitInput().props.onChange as (e: unknown) => void;
        (nodes(rowTree).find(n => n.props["aria-label"] === "Description")!.props.onChange as (e: unknown) => void)({ target: { value: "Unsaved words" } }); render();
        unitEdit("m2"); old({ target: { value: "kg" } }); render();
        expect(unitButton("Save unit")).toBeUndefined(); expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({ "description:line": "draft" });
    });
    it("unmount suppresses late acknowledgement and replayed handlers", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); unitEdit("m2");
        const save = unitButton("Save unit").props.onClick as () => void, cancel = unitButton("Cancel unit").props.onClick as () => void;
        unitClick("Save unit"); unmount(); save(); cancel(); request.resolve(unitAck());
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates[0].estimate_lines[0].unit).toBe("item");
    });
    it.each(["boq", "preliminaries", "buildup"])("keeps the existing initial special %s unit path unchanged", kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "preliminaries") estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        if (kind === "buildup") estimates[0].estimate_lines[0].pricing_mode = "buildup";
        render(); expect(unitInput().props.defaultValue).toBe("item");
        unitEdit("m2"); expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { unit: "m2" }); expect(unitButton("Save unit")).toBeUndefined();
    });
});

function descriptionInput() { return nodes(rowTree).find(n => n.props["aria-label"] === "Description")!; }
function descriptionEdit(raw: string) { (descriptionInput().props.onChange as (e: unknown) => void)({ target: { value: raw } }); render(); }
function descriptionButton(label: string) { return nodes(rowTree).find(n => n.type === "button" && n.props.children === label)!; }
function descriptionClick(label: string) { (descriptionButton(label).props.onClick as () => void)(); render(); }
function descriptionAck(description = "Reviewed wording") { return { success: true, line: { id: "line", description } }; }
function retainedDescription() { return nodes(tree).find(n => n.props["data-retained-description"] === "line"); }
describe("explicit ordinary Advanced description draft", () => {
    beforeEach(() => { replay.save.mockImplementation(async () => descriptionAck()); });
    it("closing optional catalogue search hides its options without saving search text or wording", () => {
        const search = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!;
        (search.props.onChange as (e: unknown) => void)({ target: { value: "Catalogue" } }); render();
        expect(nodes(rowTree).some(n => n.type === "button" && text(n).includes("K1"))).toBe(true);
        const disclosure = nodes(rowTree).find(n => n.type === "details" && typeof n.props.onToggle === "function")!;
        (disclosure.props.onToggle as (e: unknown) => void)({ currentTarget: { open: false } }); render();
        expect(nodes(rowTree).some(n => n.type === "button" && text(n).includes("K1"))).toBe(false);
        expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({});
        expect(descriptionInput().props.value).toBe("Current cupboards");
    });
    it.each(["", "  ", "  Exact contractor wording  ", "x".repeat(20001)])("keeps raw %j without trimming or new length/blank policy;typing/blur/Cancel do not write", async raw => {
        const before = structuredClone(estimates); descriptionEdit(raw);
        expect(descriptionInput().props.value).toBe(raw); expect(descriptionInput().props.onBlur).toBeUndefined();
        expect(ledger).toEqual({ "description:line": "draft" }); expect(estimates).toEqual(before);
        descriptionClick("Cancel description"); await vi.advanceTimersByTimeAsync(500);
        expect(estimates).toEqual(before); expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({});
    });
    it.each(["", "  Exact wording  "])("explicit Save acknowledges exact description %j only,without touching line finances/resources/order", async raw => {
        const request = pending(); replay.save.mockReturnValue(request.promise); const before = structuredClone(estimates);
        descriptionEdit(raw); descriptionClick("Save description"); descriptionClick("Save description"); descriptionClick("Cancel description");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { description: raw }); expect(estimates).toEqual(before);
        request.resolve(descriptionAck(raw)); await settle(); before[0].estimate_lines[0].description = raw;
        expect(estimates).toEqual(before); expect(ledger).toEqual({});
    });
    it("unchanged wording Save closes without any write", () => {
        descriptionEdit("Current cupboards"); descriptionClick("Save description");
        expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({});
    });
    it("catalogue search stays separate,never writes wording,and opens the existing exact-source review", async () => {
        const search = nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!;
        (search.props.onChange as (e: unknown) => void)({ target: { value: "Catalogue" } }); render();
        (nodes(rowTree).find(n => n.props["aria-label"] === "Search catalogue")!.props.onBlur as () => void)();
        await vi.advanceTimersByTimeAsync(500); render();
        expect(replay.save).not.toHaveBeenCalled(); expect(descriptionInput().props.value).toBe("Current cupboards"); expect(ledger).toEqual({});
        (search.props.onFocus as () => void)(); render();
        (nodes(rowTree).find(n => n.type === "button" && text(n).includes("K1"))!.props.onClick as () => void)(); render();
        expect(review()).toBeDefined(); click("Cancel catalogue review"); expect(replay.save).not.toHaveBeenCalled();
    });
    it.each(["quantity", "rate", "unit", "resources", "activity", "mode", "boq", "project", "ledger"])("changed %s source refuses stale Save without losing wording", async kind => {
        descriptionEdit("  Exact draft  "); const save = descriptionButton("Save description").props.onClick as () => void;
        const line = estimates[0].estimate_lines[0];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...line, quantity: 9 };
        if (kind === "rate") estimates[0].estimate_lines[0] = { ...line, unit_rate: 9 };
        if (kind === "unit") estimates[0].estimate_lines[0] = { ...line, unit: "kg" };
        if (kind === "resources") estimates[0].estimate_lines[0] = { ...line, estimate_line_components: [{ id: "new" } as never] };
        if (kind === "activity") estimates[0].estimate_lines[0] = { ...line, trade_section: "Preliminaries" };
        if (kind === "mode") estimates[0].estimate_lines[0] = { ...line, pricing_mode: "buildup" };
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "project") projectId = "other";
        if (kind === "ledger") ledger = { ...ledger, "opening:project": "draft" };
        render(); save(); await settle(); expect(replay.save).not.toHaveBeenCalled();
        if (kind === "project") expect(nodes(retainedDescription()).find(n => n.type === "textarea")!.props.value).toBe("  Exact draft  ");
        else { expect(descriptionInput().props.value).toBe("  Exact draft  "); descriptionClick("Cancel description"); }
    });
    it.each(["refusal", "rejection", "warning", "wrong id", "changed text", "missing text", "unknown"])("%s response retains exact consumed wording and prevents blind retry/discard", async kind => {
        if (kind === "refusal") replay.save.mockResolvedValue({ success: false, error: "Owner/edit-lock refusal" });
        else if (kind === "rejection") replay.save.mockRejectedValue(new Error("Lost response"));
        else if (kind === "unknown") replay.save.mockResolvedValue(undefined);
        else if (kind === "missing text") replay.save.mockResolvedValue({ success: true, line: { id: "line" } });
        else {
            const ack = descriptionAck(" Exact ");
            if (kind === "wrong id") ack.line.id = "other";
            if (kind === "changed text") ack.line.description = "Exact";
            replay.save.mockResolvedValue(kind === "warning" ? { ...ack, warning: "Aggregate refresh failed" } : ack);
        }
        const before = structuredClone(estimates); descriptionEdit(" Exact "); descriptionClick("Save description"); await settle();
        descriptionClick("Cancel description"); descriptionClick("Save description");
        expect(descriptionInput().props.value).toBe(" Exact "); expect(estimates).toEqual(before); expect(replay.save).toHaveBeenCalledTimes(1);
        expect(ledger["line:line"]).toBe("uncertain"); expect(text(rowTree)).toContain("may already have saved");
    });
    it("old raw/Save/Cancel callbacks cannot affect newer wording", () => {
        descriptionEdit("First"); const raw = descriptionInput().props.onChange as (e: unknown) => void;
        const save = descriptionButton("Save description").props.onClick as () => void, cancel = descriptionButton("Cancel description").props.onClick as () => void;
        descriptionEdit("Newer"); raw({ target: { value: "Replay" } }); save(); cancel(); render();
        expect(descriptionInput().props.value).toBe("Newer"); expect(replay.save).not.toHaveBeenCalled();
    });
    it("late confirmation cannot overwrite a newer saved row", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); descriptionEdit("Reviewed wording"); descriptionClick("Save description");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], description: "External new wording", quantity: 9, line_total: 36 }; estimates[0].total_cost = 36; render();
        request.resolve(descriptionAck()); await settle();
        expect(descriptionInput().props.value).toBe("Reviewed wording"); expect(estimates[0].estimate_lines[0].description).toBe("External new wording");
        expect(estimates[0].total_cost).toBe(36); expect(ledger["line:line"]).toBe("uncertain");
    });
    it.each(["row", "estimate", "active estimate", "project"])("retains exact wording across missing %s and row remount without recreating or saving", kind => {
        descriptionEdit("  Exact\nwording  "); const original = structuredClone(estimates);
        if (kind === "row") estimates = [{ ...estimates[0], estimate_lines: [] }];
        if (kind === "estimate") estimates = [];
        if (kind === "active estimate") activeTab = "missing";
        if (kind === "project") projectId = "other";
        render(); replay.slots.row = [];
        const input = nodes(retainedDescription()).find(n => n.type === "textarea")!;
        expect(input.props.value).toBe("  Exact\nwording  "); expect(input.props.readOnly).toBe(true); expect(replay.save).not.toHaveBeenCalled();
        estimates = original; projectId = "project"; activeTab = "estimate"; render();
        expect(descriptionInput().props.value).toBe("  Exact\nwording  "); descriptionClick("Cancel description"); expect(ledger).toEqual({});
    });
    it("pending acknowledgement after missing membership stays uncertain on reappearance", async () => {
        const original = structuredClone(estimates),request = pending(); replay.save.mockReturnValue(request.promise);
        descriptionEdit("Reviewed wording"); descriptionClick("Save description"); estimates = []; render();
        (nodes(retainedDescription()).find(n => n.type === "button")!.props.onClick as () => void)();
        request.resolve(descriptionAck()); await settle(); expect(ledger["line:line"]).toBe("uncertain");
        estimates = original; render(); descriptionClick("Cancel description"); descriptionClick("Save description");
        expect(descriptionInput().props.value).toBe("Reviewed wording"); expect(replay.save).toHaveBeenCalledTimes(1);
    });
    it.each(["quantity", "rate", "unit", "activity", "catalogue"])("does not overwrite an existing %s draft", kind => {
        if (kind === "quantity") quantityEdit("9");
        if (kind === "rate") rateEdit("9");
        if (kind === "unit") unitEdit("m2");
        if (kind === "activity") { renderActivity(); activityClick("Change"); activityType("Keep me"); }
        if (kind === "catalogue") select();
        const before = JSON.stringify(ledger); descriptionEdit("Other wording"); expect(JSON.stringify(ledger)).toBe(before);
        expect(descriptionButton("Save description")).toBeUndefined(); expect(replay.save).not.toHaveBeenCalled();
    });
    it("independent description identity fences other writes after an old resource-close callback", () => {
        (nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!.props.onClick as () => void)(); render();
        const resource = nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!;
        descriptionEdit("Retain me"); (resource.props.onDraftChanged as (id: string, open: boolean) => void)("line", false); render();
        quantityEdit("9"); rateEdit("9"); unitEdit("m2"); select(); renderActivity(); activityClick("Change");
        (rowElement().props.onUpdate as (id: string, fields: unknown) => void)("line", { quantity: 8 });
        (rowElement().props.onDelete as (id: string) => void)("line");
        expect((resource.props.canApplyRate as () => boolean)()).toBe(false); expect(descriptionInput().props.value).toBe("Retain me");
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled(); expect(review()).toBeUndefined();
    });
    it("unmount suppresses late publication and replayed callbacks", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); descriptionEdit("Reviewed wording");
        const save = descriptionButton("Save description").props.onClick as () => void,cancel = descriptionButton("Cancel description").props.onClick as () => void;
        descriptionClick("Save description"); unmount(); save(); cancel(); request.resolve(descriptionAck());
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates[0].estimate_lines[0].description).toBe("Current cupboards");
    });
    it.each(["boq", "preliminaries", "buildup"])("preserves initial special %s delayed free-text blur path", async kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "preliminaries") estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        if (kind === "buildup") estimates[0].estimate_lines[0].pricing_mode = "buildup";
        render(); descriptionEdit("Special wording"); (descriptionInput().props.onBlur as () => void)();
        await vi.advanceTimersByTimeAsync(200); expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { description: "Special wording" });
    });
});

function lineTypeInput() { return nodes(rowTree).find(n => n.props["aria-label"] === "Line type")!; }
function lineTypeEdit(value: string) { (lineTypeInput().props.onChange as (e: unknown) => void)({ target: { value } }); render(); }
function lineTypeButton(label: string) { return nodes(rowTree).find(n => n.type === "button" && n.props.children === label)!; }
function lineTypeClick(label: string) { (lineTypeButton(label).props.onClick as () => void)(); render(); }
function lineTypeAck(line_type = "labour") { return { success: true, line: { id: "line", line_type } }; }
function retainedLineType() { return nodes(tree).find(n => n.props["data-retained-line-type"] === "line"); }
describe("reviewed ordinary Advanced line-type choice", () => {
    beforeEach(() => { replay.save.mockImplementation(async () => lineTypeAck()); });
    it.each(["general", "legacy specialist", "", "  labour  "])("shows exact saved type %j without normalization;selection/blur/Cancel never writes", async line_type => {
        estimates[0].estimate_lines[0].line_type = line_type; render();
        expect(lineTypeInput().props.value).toBe(line_type);
        expect(nodes(lineTypeInput()).some(n => n.type === "option" && n.props.value === line_type)).toBe(true);
        const before = structuredClone(estimates); lineTypeEdit("labour");
        expect(lineTypeInput().props.onBlur).toBeUndefined(); expect(estimates).toEqual(before);
        expect(ledger).toEqual({ "line-type:line": "draft" }); lineTypeClick("Cancel line type");
        await vi.advanceTimersByTimeAsync(500); expect(estimates).toEqual(before); expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({});
    });
    it.each([null, undefined, 7])("shows non-text legacy value %j without silently classifying it as General", line_type => {
        estimates[0].estimate_lines[0].line_type = line_type as never; render();
        expect(lineTypeInput().props.disabled).toBe(true); expect(text(rowTree)).toContain("stored type is not text");
        lineTypeEdit("labour"); expect(replay.save).not.toHaveBeenCalled(); expect(lineTypeButton("Save line type")).toBeUndefined();
        expect(estimates[0].estimate_lines[0].line_type).toBe(line_type);
    });
    it("uses one exact acknowledged type-only update while preserving every other line field/resource/total", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise);
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 3.123456, unit_rate: 4.123456, line_total: 12.88, estimate_line_components: [{ id: "material", component_type: "material", quantity: 8.1234 } as never] };
        estimates[0].total_cost = 12.88; render(); const before = structuredClone(estimates);
        lineTypeEdit("labour"); lineTypeClick("Save line type"); lineTypeClick("Save line type"); lineTypeClick("Cancel line type");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { line_type: "labour" }); expect(estimates).toEqual(before);
        request.resolve(lineTypeAck()); await settle(); before[0].estimate_lines[0].line_type = "labour";
        expect(estimates).toEqual(before); expect(ledger).toEqual({});
    });
    it.each(["general", "labour", "plant", "material", "subcontract", "consultancy"])("retains existing supported label %j without new taxonomy", async choice => {
        replay.save.mockResolvedValue(lineTypeAck(choice)); lineTypeEdit(choice); lineTypeClick("Save line type"); await settle();
        expect(estimates[0].estimate_lines[0].line_type).toBe(choice);
        if (choice === "general") expect(replay.save).not.toHaveBeenCalled();
        else expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { line_type: choice });
    });
    it("returning to the exact saved unknown label closes without writing or normalization", () => {
        estimates[0].estimate_lines[0].line_type = "  legacy  "; render(); lineTypeEdit("labour"); lineTypeEdit("  legacy  "); lineTypeClick("Save line type");
        expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({}); expect(estimates[0].estimate_lines[0].line_type).toBe("  legacy  ");
    });
    it.each(["new taxonomy", "Labour", " labour ", ""])("refuses unsupported/tampered choice %j", value => {
        lineTypeEdit(value); expect(lineTypeButton("Save line type")).toBeUndefined(); expect(replay.save).not.toHaveBeenCalled(); expect(ledger).toEqual({});
    });
    it.each(["quantity", "rate", "unit", "type", "resources", "activity", "mode", "boq", "project", "ledger"])("changed %s refuses the reviewed Save without losing choice", async kind => {
        lineTypeEdit("labour"); const save = lineTypeButton("Save line type").props.onClick as () => void;
        const line = estimates[0].estimate_lines[0];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...line, quantity: 9 };
        if (kind === "rate") estimates[0].estimate_lines[0] = { ...line, unit_rate: 9 };
        if (kind === "unit") estimates[0].estimate_lines[0] = { ...line, unit: "kg" };
        if (kind === "type") estimates[0].estimate_lines[0] = { ...line, line_type: "plant" };
        if (kind === "resources") estimates[0].estimate_lines[0] = { ...line, estimate_line_components: [{ id: "new" } as never] };
        if (kind === "activity") estimates[0].estimate_lines[0] = { ...line, trade_section: "Preliminaries" };
        if (kind === "mode") estimates[0].estimate_lines[0] = { ...line, pricing_mode: "buildup" };
        if (kind === "boq") estimates[0].is_client_boq = true;
        if (kind === "project") projectId = "other";
        if (kind === "ledger") ledger = { ...ledger, "opening:project": "draft" };
        render(); save(); await settle(); expect(replay.save).not.toHaveBeenCalled();
        if (kind === "project") expect(nodes(retainedLineType()).find(n => n.type === "input")!.props.value).toBe("labour");
        else { expect(lineTypeInput().props.value).toBe("labour"); lineTypeClick("Cancel line type"); }
    });
    it.each(["refusal", "rejection", "warning", "wrong id", "wrong type", "missing type", "unknown"])("%s acknowledgement keeps consumed choice/confirmed values and refuses retry/Cancel", async kind => {
        if (kind === "refusal") replay.save.mockResolvedValue({ success: false, error: "Owner/edit-lock refusal" });
        else if (kind === "rejection") replay.save.mockRejectedValue(new Error("Lost response"));
        else if (kind === "unknown") replay.save.mockResolvedValue(undefined);
        else if (kind === "missing type") replay.save.mockResolvedValue({ success: true, line: { id: "line" } });
        else {
            const ack = lineTypeAck(); if (kind === "wrong id") ack.line.id = "other";
            if (kind === "wrong type") ack.line.line_type = "plant";
            replay.save.mockResolvedValue(kind === "warning" ? { ...ack, warning: "Aggregate refresh failed" } : ack);
        }
        const before = structuredClone(estimates); lineTypeEdit("labour"); lineTypeClick("Save line type"); await settle();
        lineTypeClick("Save line type"); lineTypeClick("Cancel line type");
        expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates).toEqual(before); expect(lineTypeInput().props.value).toBe("labour");
        expect(ledger["line:line"]).toBe("uncertain"); expect(text(rowTree)).toContain("may already have saved");
    });
    it("older choice/Save/Cancel callbacks cannot affect newer review", () => {
        lineTypeEdit("labour"); const input = lineTypeInput().props.onChange as (e: unknown) => void;
        const save = lineTypeButton("Save line type").props.onClick as () => void,cancel = lineTypeButton("Cancel line type").props.onClick as () => void;
        lineTypeEdit("plant"); input({ target: { value: "material" } }); save(); cancel(); render();
        expect(lineTypeInput().props.value).toBe("plant"); expect(replay.save).not.toHaveBeenCalled();
    });
    it("late acknowledgement cannot overwrite a newer saved type/quantity/total", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); lineTypeEdit("labour"); lineTypeClick("Save line type");
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], line_type: "plant", quantity: 7, line_total: 28 }; estimates[0].total_cost = 28; render();
        request.resolve(lineTypeAck()); await settle();
        expect(estimates[0].estimate_lines[0]).toMatchObject({ line_type: "plant", quantity: 7, line_total: 28 });
        expect(estimates[0].total_cost).toBe(28); expect(lineTypeInput().props.value).toBe("labour"); expect(ledger["line:line"]).toBe("uncertain");
    });
    it.each(["row", "estimate", "active estimate", "project"])("missing %s keeps read-only choice through row remount without recreation/write", kind => {
        lineTypeEdit("consultancy"); const original = structuredClone(estimates);
        if (kind === "row") estimates = [{ ...estimates[0], estimate_lines: [] }];
        if (kind === "estimate") estimates = [];
        if (kind === "active estimate") activeTab = "missing";
        if (kind === "project") projectId = "other";
        render(); replay.slots.row = []; const input = nodes(retainedLineType()).find(n => n.type === "input")!;
        expect(input.props.value).toBe("consultancy"); expect(input.props.readOnly).toBe(true); expect(replay.save).not.toHaveBeenCalled();
        estimates = original; activeTab = "estimate"; projectId = "project"; render();
        expect(lineTypeInput().props.value).toBe("consultancy"); expect(replay.save).not.toHaveBeenCalled(); lineTypeClick("Cancel line type"); expect(ledger).toEqual({});
    });
    it("pending missing-membership response stays uncertain on return without discard/retry", async () => {
        const original = structuredClone(estimates),request = pending(); replay.save.mockReturnValue(request.promise);
        lineTypeEdit("labour"); lineTypeClick("Save line type"); estimates = []; render();
        (nodes(retainedLineType()).find(n => n.type === "button")!.props.onClick as () => void)();
        request.resolve(lineTypeAck()); await settle(); expect(ledger["line:line"]).toBe("uncertain");
        estimates = original; render(); lineTypeClick("Save line type"); lineTypeClick("Cancel line type");
        expect(lineTypeInput().props.value).toBe("labour"); expect(replay.save).toHaveBeenCalledTimes(1);
    });
    it.each(["quantity", "rate", "unit", "description", "activity", "catalogue"])("does not overwrite existing %s draft", kind => {
        if (kind === "quantity") quantityEdit("9");
        if (kind === "rate") rateEdit("9");
        if (kind === "unit") unitEdit("m2");
        if (kind === "description") descriptionEdit("Keep exact text");
        if (kind === "activity") { renderActivity(); activityClick("Change"); activityType("Keep activity"); }
        if (kind === "catalogue") select();
        const before = JSON.stringify(ledger); lineTypeEdit("labour"); expect(JSON.stringify(ledger)).toBe(before);
        expect(lineTypeButton("Save line type")).toBeUndefined(); expect(replay.save).not.toHaveBeenCalled();
    });
    it("independent type identity survives an old resource-close callback and fences other fields/Apply/delete", () => {
        (nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!.props.onClick as () => void)(); render();
        const resource = nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!;
        lineTypeEdit("labour"); (resource.props.onDraftChanged as (id: string, open: boolean) => void)("line", false); render();
        quantityEdit("9"); rateEdit("9"); unitEdit("m2"); descriptionEdit("Other"); select(); renderActivity(); activityClick("Change");
        (rowElement().props.onUpdate as (id: string, fields: unknown) => void)("line", { unit_rate: 9 });
        (rowElement().props.onDelete as (id: string) => void)("line");
        expect((resource.props.canApplyRate as () => boolean)()).toBe(false); expect(lineTypeInput().props.value).toBe("labour");
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled(); expect(review()).toBeUndefined();
    });
    it("unmount suppresses late publication and replayed handlers", async () => {
        const request = pending(); replay.save.mockReturnValue(request.promise); lineTypeEdit("labour");
        const save = lineTypeButton("Save line type").props.onClick as () => void,cancel = lineTypeButton("Cancel line type").props.onClick as () => void;
        lineTypeClick("Save line type"); unmount(); save(); cancel(); request.resolve(lineTypeAck());
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(replay.save).toHaveBeenCalledTimes(1); expect(estimates[0].estimate_lines[0].line_type).toBe("general");
    });
    it.each(["preliminaries", "buildup"])("keeps initial special %s immediate type selection unchanged", kind => {
        if (kind === "preliminaries") estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        if (kind === "buildup") estimates[0].estimate_lines[0].pricing_mode = "buildup";
        render(); lineTypeEdit("labour"); expect(replay.save).toHaveBeenCalledExactlyOnceWith("line", { line_type: "labour" });
        expect(lineTypeButton("Save line type")).toBeUndefined();
    });
    it("keeps initial client BoQ reference rather than offering type selection", () => {
        estimates[0].is_client_boq = true; render(); expect(lineTypeInput()).toBeUndefined();
    });
});

function addEntry() { return nodes(tree).find(n => typeof n.props.onAddActivity === "function")!; }
function addActivity(section: string) { return (addEntry().props.onAddActivity as (section: string) => Promise<void>)(section); }
function addReceipt(section: string) { return nodes(tree).find(n => n.props["data-add-receipt"] === JSON.stringify(["estimate", section])); }
describe("acknowledged ordinary Advanced blank-line creation", () => {
    beforeEach(() => { replay.other.mockResolvedValue({ id: "new-line" }); });
    it("coincident sibling acknowledgements accept their own pending-ledger lag without a render between resolutions", async () => {
        const first = pending(),second = pending(); replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const a = addActivity("Preparation"),b = addActivity("Decoration"); render();
        first.resolve({ id: "first-row" }); await a;
        second.resolve({ id: "second-row" }); await b; render();
        expect(estimates[0].estimate_lines.map(row => row.id)).toEqual(["line", "first-row", "second-row"]);
        expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("confirmed"); expect(addReceipt("Decoration")!.props["data-add-phase"]).toBe("confirmed");
        expect(ledger).toEqual({});
    });
    it("explicit Add sends one unchanged insert and shows no row/success until acknowledgement", async () => {
        const request = pending(); replay.other.mockReturnValue(request.promise); const before = structuredClone(estimates);
        const first = addActivity("Preparation"); void addActivity("Preparation"); render();
        expect(replay.other).toHaveBeenCalledExactlyOnceWith("estimate", "Preparation", { description: "", quantity: 1, unit: "nr", unit_rate: 0, line_type: "general" });
        expect(estimates).toEqual(before); expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("saving");
        expect(ledger[ `add:${JSON.stringify(["estimate", "Preparation"])}` ]).toBe("saving");
        request.resolve({ id: "new-line" }); await first; render();
        expect(estimates[0].estimate_lines[1]).toEqual({ id: "new-line", estimate_id: "estimate", description: "", quantity: 1, unit: "nr", unit_rate: 0,
            line_total: 0, trade_section: "Preparation", line_type: "general", pricing_mode: "simple", estimate_line_components: [] });
        expect(estimates[0].estimate_lines[0]).toEqual(before[0].estimate_lines[0]); expect(estimates[0].total_cost).toBe(12);
        expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("confirmed"); expect(ledger).toEqual({});
        await addActivity("Preparation"); expect(replay.other).toHaveBeenCalledTimes(1);
    });
    it.each(["warning", "refused", "rejected", "missing id", "unknown", "duplicate id", "blank id"])("%s retains unconfirmed status and available identity without a guessed row or duplicate retry", async kind => {
        if (kind === "warning") replay.other.mockResolvedValue({ id: "remote-row", warning: "Aggregate refresh not confirmed" });
        if (kind === "refused") replay.other.mockResolvedValue({ error: "Project is locked" });
        if (kind === "rejected") replay.other.mockRejectedValue(new Error("Lost response"));
        if (kind === "missing id") replay.other.mockResolvedValue({});
        if (kind === "unknown") replay.other.mockResolvedValue(undefined);
        if (kind === "duplicate id") replay.other.mockResolvedValue({ id: "line" });
        if (kind === "blank id") replay.other.mockResolvedValue({ id: "  " });
        const before = structuredClone(estimates); const oldAdd = addEntry().props.onAddActivity as (name: string) => Promise<void>;
        await oldAdd("Preparation"); render(); await oldAdd("Preparation"); await addActivity("Preparation"); render();
        expect(replay.other).toHaveBeenCalledTimes(1); expect(estimates).toEqual(before);
        expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("unconfirmed");
        expect(text(addReceipt("Preparation"))).toContain("may already exist remotely");
        if (kind === "warning") expect(text(addReceipt("Preparation"))).toContain("remote-row");
        expect(ledger[ `add:${JSON.stringify(["estimate", "Preparation"])}` ]).toBe("uncertain");
    });
    it.each(["project", "active version", "estimate removed", "quantity", "description", "resource", "parent draft", "owner"])("late %s change retains current work and cannot publish into the changed source", async kind => {
        const request = pending(); replay.other.mockReturnValue(request.promise); const first = addActivity("Preparation");
        if (kind === "project") projectId = "other";
        if (kind === "active version") activeTab = "missing";
        if (kind === "estimate removed") estimates = [];
        if (kind === "quantity") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], quantity: 7 };
        if (kind === "description") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], description: "Newer wording" };
        if (kind === "resource") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], estimate_line_components: [{ id: "new" } as never] };
        if (kind === "parent draft") ledger = { ...ledger, "opening:project": "draft" };
        if (kind === "owner") estimates[0].project_id = "other";
        render(); const before = structuredClone(estimates); request.resolve({ id: "remote-row" }); await first; render();
        expect(estimates).toEqual(before); expect(text(addReceipt("Preparation"))).toContain("remote-row");
        expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("unconfirmed");
    });
    it("different sections remain concurrent and exact own appended rows do not invalidate each other", async () => {
        const first = pending(),second = pending(); replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const a = addActivity("Preparation"),b = addActivity("Decoration"); render(); expect(replay.other).toHaveBeenCalledTimes(2);
        first.resolve({ id: "first-row" }); await a; render(); expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("confirmed");
        expect(addReceipt("Decoration")!.props["data-add-phase"]).toBe("saving");
        second.resolve({ id: "second-row" }); await b; render();
        expect(estimates[0].estimate_lines.map(row => row.id)).toEqual(["line", "first-row", "second-row"]); expect(estimates[0].total_cost).toBe(12);
        expect(addReceipt("Decoration")!.props["data-add-phase"]).toBe("confirmed"); expect(ledger).toEqual({});
    });
    it("reverse acknowledgement order preserves append order and does not clear another add's pending state", async () => {
        const first = pending(),second = pending(); replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const a = addActivity("Preparation"),b = addActivity("Decoration"); render();
        second.resolve({ id: "second-row" }); await b; render(); expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("saving");
        first.resolve({ id: "first-row" }); await a; render();
        expect(estimates[0].estimate_lines.map(row => row.id)).toEqual(["line", "second-row", "first-row"]); expect(ledger).toEqual({});
    });
    it("an independently warned add remains unconfirmed when another section is confirmed", async () => {
        const first = pending(),second = pending(); replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const a = addActivity("Preparation"),b = addActivity("Decoration"); render();
        first.resolve({ id: "remote-unknown", warning: "Aggregate refresh failed" }); await a; render();
        second.resolve({ id: "second-row" }); await b; render();
        expect(estimates[0].estimate_lines.map(row => row.id)).toEqual(["line", "second-row"]);
        expect(addReceipt("Preparation")!.props["data-add-phase"]).toBe("unconfirmed"); expect(addReceipt("Decoration")!.props["data-add-phase"]).toBe("confirmed");
        expect(Object.values(ledger)).toEqual(["uncertain"]);
    });
    it("an edit to a sibling confirmed add cannot be hidden by own-refresh normalization", async () => {
        const first = pending(),second = pending(); replay.other.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const a = addActivity("Preparation"),b = addActivity("Decoration");
        first.resolve({ id: "first-row" }); await a; render();
        estimates[0].estimate_lines[1] = { ...estimates[0].estimate_lines[1], description: "New typed work" }; render();
        second.resolve({ id: "second-row" }); await b; render();
        expect(estimates[0].estimate_lines.map(row => row.id)).toEqual(["line", "first-row"]);
        expect(estimates[0].estimate_lines[1].description).toBe("New typed work"); expect(addReceipt("Decoration")!.props["data-add-phase"]).toBe("unconfirmed");
    });
    it.each(["quantity", "rate", "unit", "description", "type", "activity", "catalogue", "external"])("does not dispatch over an existing %s draft", async kind => {
        if (kind === "quantity") quantityEdit("9");
        if (kind === "rate") rateEdit("9");
        if (kind === "unit") unitEdit("m2");
        if (kind === "description") descriptionEdit("Keep me");
        if (kind === "type") lineTypeEdit("labour");
        if (kind === "activity") { renderActivity(); activityClick("Change"); activityType("Keep activity"); }
        if (kind === "catalogue") select();
        if (kind === "external") { ledger = { "scope:project": "draft" }; render(); }
        const before = structuredClone(estimates); await addActivity("Preparation");
        expect(replay.other).not.toHaveBeenCalled(); expect(estimates).toEqual(before);
    });
    it("an idle old Add handler cannot act after project changes or unmount", async () => {
        const old = addEntry().props.onAddActivity as (name: string) => Promise<void>; projectId = "other"; render(); await old("Preparation");
        unmount(); await old("Decoration"); expect(replay.other).not.toHaveBeenCalled();
    });
    it("unmount after insert dispatch suppresses late publication and no automatic retry/clear occurs", async () => {
        const request = pending(); replay.other.mockReturnValue(request.promise); const first = addActivity("Preparation");
        const before = structuredClone(estimates); unmount(); request.resolve({ id: "remote-row" }); await first;
        expect(estimates).toEqual(before); expect(Object.values(ledger)).toEqual(["saving"]); expect(replay.error).not.toHaveBeenCalled();
    });
    it("unfinished saved blank rows still prevent a further insert", async () => {
        estimates[0].estimate_lines[0].description = ""; render(); await addActivity("Kitchen");
        expect(replay.other).not.toHaveBeenCalled();
    });
});

describe("acknowledged ordinary Advanced Remove line", () => {
    function remove() { return rowElement().props.onDelete as (id: string) => Promise<void>; }
    function status() { return nodes(tree).find(n => n.props["aria-label"] === "Remove line acknowledgement"); }
    function sibling() {
        estimates[0].estimate_lines.push({ ...estimates[0].estimate_lines[0], id: "sibling", description: "Keep this work", line_total: 8, unit_rate: 8, quantity: 1 });
        estimates[0].total_cost = 20; render();
    }
    beforeEach(() => { replay.other.mockResolvedValue({ success: true }); });

    it("keeps row, resources, order and money until ONE clean acknowledgement then removes only that row", async () => {
        sibling(); const kept = JSON.stringify(estimates[0].estimate_lines[1]); const request = pending();
        replay.other.mockReturnValue(request.promise); const oldRemove = remove();
        const operation = oldRemove("line"); oldRemove("line"); render();
        expect(replay.other).toHaveBeenCalledExactlyOnceWith("line");
        expect(estimates[0].estimate_lines.map(l => l.id)).toEqual(["line", "sibling"]);
        expect(estimates[0].total_cost).toBe(20); expect(rowElement().props.savePending).toBe(true);
        expect(ledger).toEqual({ "delete:line": "saving" }); expect(text(status())).toContain("pending");
        request.resolve({ success: true }); await operation;
        // A captured click before a rerender cannot issue a second delete.
        await oldRemove("line"); await settle();
        expect(replay.other).toHaveBeenCalledTimes(1);
        expect(estimates[0].estimate_lines.map(l => l.id)).toEqual(["sibling"]);
        expect(JSON.stringify(estimates[0].estimate_lines[0])).toBe(kept);
        expect(estimates[0].total_cost).toBe(8); expect(ledger).toEqual({});
        expect(status()?.props["data-delete-phase"]).toBe("confirmed");
    });

    it.each(["refused", "warning", "unknown", "empty", "success with error", "rejected"])("%s retains exact source and blocks blind retry without Saved or refresh", async kind => {
        const before = JSON.stringify(estimates);
        if (kind === "rejected") replay.other.mockRejectedValue(new Error("response lost"));
        else replay.other.mockResolvedValue(kind === "refused" ? { success: false, error: "Owner/edit-lock refusal" } :
            kind === "warning" ? { success: true, warning: "Aggregate refresh failed" } :
            kind === "success with error" ? { success: true, error: "unknown write outcome" } : kind === "empty" ? {} : undefined);
        await remove()("line"); await settle(); await remove()("line"); await settle();
        expect(replay.other).toHaveBeenCalledTimes(1); expect(JSON.stringify(estimates)).toBe(before);
        expect(ledger).toEqual({ "delete:line": "uncertain" });
        expect(status()?.props["data-delete-phase"]).toBe("unconfirmed");
        expect(text(status())).toContain("may already be deleted remotely");
        expect(text(status())).toContain("Row identity:  line"); expect(text(status())).not.toContain("Saved");
        expect(rowElement().props.saveBlocked).toBe(true);
    });

    it.each(["row", "sibling", "total", "reorder", "project", "active version", "missing estimate", "resource ledger"])("late clean acknowledgement cannot overwrite newer %s work", async kind => {
        sibling(); const request = pending(); replay.other.mockReturnValue(request.promise);
        const operation = remove()("line"); render();
        if (kind === "row") estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], description: "Newer wording" };
        if (kind === "sibling") estimates[0].estimate_lines[1] = { ...estimates[0].estimate_lines[1], quantity: 7, line_total: 56 };
        if (kind === "total") estimates[0].total_cost = 99;
        if (kind === "reorder") estimates[0].estimate_lines.reverse();
        if (kind === "project") projectId = "other";
        if (kind === "active version") activeTab = "another";
        if (kind === "missing estimate") estimates = [];
        if (kind === "resource ledger") ledger = { ...ledger, "draft:sibling": "draft" };
        render(); const newer = JSON.stringify(estimates);
        request.resolve({ success: true }); await operation; await settle();
        expect(JSON.stringify(estimates)).toBe(newer);
        expect(status()?.props["data-delete-phase"]).toBe("unconfirmed");
        expect(ledger["delete:line"]).toBe("uncertain"); expect(replay.other).toHaveBeenCalledTimes(1);
    });

    it("checks latest parent-store state even when newer work has not rendered yet", async () => {
        const request = pending(); replay.other.mockReturnValue(request.promise);
        const operation = remove()("line");
        estimates = [{ ...estimates[0], version_name: "Unrendered newer estimate" }];
        const before = JSON.stringify(estimates); request.resolve({ success: true }); await operation; await settle();
        expect(JSON.stringify(estimates)).toBe(before); expect(status()?.props["data-delete-phase"]).toBe("unconfirmed");
    });

    it("stale Remove after project/source change refuses before the action", async () => {
        const stale = remove(); projectId = "other"; render(); await stale("line");
        expect(replay.other).not.toHaveBeenCalled(); expect(estimates[0].estimate_lines).toHaveLength(1);
    });

    it.each(["quantity", "rate", "unit", "description", "type", "catalogue", "parent draft", "parent saving", "parent uncertain"])("retains existing %s work and refuses Remove", async kind => {
        if (kind === "quantity") quantityEdit("1e");
        if (kind === "rate") (rowElement().props.onRateChange as (line: unknown, raw: string) => void)(estimates[0].estimate_lines[0], "1e");
        if (kind === "unit") (rowElement().props.onUnitChange as (line: unknown, raw: string) => void)(estimates[0].estimate_lines[0], "m2");
        if (kind === "description") (rowElement().props.onDescriptionChange as (line: unknown, raw: string) => void)(estimates[0].estimate_lines[0], "exact wording");
        if (kind === "type") (rowElement().props.onLineTypeChange as (line: unknown, raw: string) => void)(estimates[0].estimate_lines[0], "material");
        if (kind === "catalogue") select();
        if (kind.startsWith("parent")) ledger = { resource: kind.split(" ")[1] as "draft" | "saving" | "uncertain" };
        render(); const before = JSON.stringify(estimates); const savedLedger = JSON.stringify(ledger);
        await remove()("line"); await settle();
        expect(replay.other).not.toHaveBeenCalled(); expect(JSON.stringify(estimates)).toBe(before);
        expect(JSON.stringify(ledger)).toBe(savedLedger);
    });

    it("pending Remove fences captured row edits, add and version controls without discarding current work", async () => {
        const request = pending(); replay.other.mockReturnValue(request.promise);
        const row = rowElement(); const add = nodes(tree).find(n => n.type === "button" && text(n).includes("Add line item"));
        const before = JSON.stringify(estimates); const operation = remove()("line");
        (row.props.onUpdate as (id: string, changes: unknown) => void)("line", { quantity: 99 });
        (row.props.onQuantityChange as (line: unknown, raw: string) => void)(estimates[0].estimate_lines[0], "99");
        if (add) (add.props.onClick as () => void)();
        render(); expect(JSON.stringify(estimates)).toBe(before); expect(replay.save).not.toHaveBeenCalled();
        expect(replay.other).toHaveBeenCalledTimes(1);
        request.resolve({ success: false, error: "refused" }); await operation; await settle();
    });

    it("unmount retains parent reconciliation fence and never applies a late response", async () => {
        const request = pending(); replay.other.mockReturnValue(request.promise);
        const operation = remove()("line"); unmount(); const before = JSON.stringify(estimates);
        request.resolve({ success: true }); await operation;
        expect(JSON.stringify(estimates)).toBe(before); expect(ledger).toEqual({ "delete:line": "saving" });
        expect(replay.error).not.toHaveBeenCalled();
    });

    it.each(["saving", "uncertain"])("reopening Advanced retains a read-only parent delete fence for %s without retry or edits", async phase => {
        const request = pending(); replay.other.mockReturnValue(request.promise);
        const operation = remove()("line"); render();
        if (phase === "uncertain") { request.resolve({ success: false, error: "unknown delete outcome" }); await operation; render(); }
        const before = JSON.stringify(estimates); unmount(); replay.slots = {}; render();
        expect(rowElement().props.saveBlocked).toBe(true);
        expect(text(nodes(tree).find(n => n.props["aria-label"] === "Retained removal reconciliation"))).toContain("Row identity:  line");
        await remove()("line");
        (rowElement().props.onUpdate as (id: string, patch: unknown) => void)("line", { quantity: 99 });
        (rowElement().props.onQuantityChange as (line: unknown, raw: string) => void)(estimates[0].estimate_lines[0], "99");
        render();
        expect(replay.other).toHaveBeenCalledTimes(1); expect(replay.save).not.toHaveBeenCalled();
        expect(JSON.stringify(estimates)).toBe(before); expect(ledger["delete:line"]).toBe(phase);
        if (phase === "saving") { request.resolve({ success: true }); await operation; expect(JSON.stringify(estimates)).toBe(before); }
    });

});


describe("acknowledged ordinary built-up Remove with retained resources", () => {
    function remove() { return rowElement().props.onDelete as (id: string) => Promise<void>; }
    function receipt() { return nodes(tree).find(n => n.props["aria-label"] === "Remove line acknowledgement"); }
    function openResources() {
        (nodes(tree).find(n => n.props["data-resource-disclosure"] === "line")!.props.onClick as () => void)();
        render(); return nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!;
    }
    beforeEach(() => {
        estimates[0].estimate_lines[0] = { ...estimates[0].estimate_lines[0], pricing_mode: "buildup",
            estimate_line_components: [
                { id: "resource-labour", estimate_line_id: "line", component_type: "labour", description: "Exact skilled labour", quantity: 0.5, unit: "hour", unit_rate: 12.3456, line_total: 6.1728, manhours_per_unit: 0.5, total_manhours: 1.5, sort_order: 0 },
                { id: "resource-material", estimate_line_id: "line", component_type: "material", description: "Exact supplier material", quantity: 2, unit: "item", unit_rate: 3.1234, line_total: 6.2468, manhours_per_unit: 0, total_manhours: 0, sort_order: 1 },
            ],
        };
        replay.other.mockResolvedValue({ success: true }); render();
    });

    it("retains built-up row/resources and money until one clean delete acknowledges,without recalculating resources or changing another line", async () => {
        const kept = { ...estimates[0].estimate_lines[0], id: "keep", description: "Other built-up work", line_total: 19.7654 };
        estimates[0].estimate_lines.push(kept); estimates[0].total_cost = 31.7654; render();
        const before = JSON.stringify(estimates); const request = pending(); replay.other.mockReturnValue(request.promise);
        const stale = remove(); const operation = stale("line"); stale("line"); render();
        expect(JSON.stringify(estimates)).toBe(before); expect(replay.other).toHaveBeenCalledExactlyOnceWith("line");
        expect(rowElement().props.savePending).toBe(true); expect(ledger).toEqual({ "delete:line": "saving" });
        request.resolve({ success: true }); await operation; await stale("line"); await settle();
        expect(estimates[0].estimate_lines).toEqual([kept]); expect(estimates[0].total_cost).toBe(19.7654);
        expect(ledger).toEqual({}); expect(receipt()?.props["data-delete-phase"]).toBe("confirmed");
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.activity).not.toHaveBeenCalled();
    });

    it.each(["refused", "warning", "unknown", "rejected"])("%s keeps the exact built-up source and disallows a blind retry or resource application", async kind => {
        const panel = openResources(); const before = JSON.stringify(estimates);
        if (kind === "rejected") replay.other.mockRejectedValue(new Error("lost acknowledgement"));
        else replay.other.mockResolvedValue(kind === "refused" ? { success: false, error: "Owner/edit-lock refusal" } : kind === "warning" ? { success: true, warning: "Stored total refresh failed" } : undefined);
        await remove()("line"); await settle(); await remove()("line");
        expect(JSON.stringify(estimates)).toBe(before); expect(replay.other).toHaveBeenCalledTimes(1);
        expect(ledger["delete:line"]).toBe("uncertain"); expect(text(receipt())).toContain("may already be deleted remotely");
        expect((panel.props.canApplyRate as () => boolean)()).toBe(false);
        expect(nodes(tree).find(n => typeof n.props.onDraftChanged === "function")!.props.saveBlocked).toBe(true);
    });

    it.each(["component quantity", "component order", "mode", "project", "membership"])("late acknowledgement never overwrites newer %s", async kind => {
        const request = pending(); replay.other.mockReturnValue(request.promise); const operation = remove()("line"); render();
        const line = estimates[0].estimate_lines[0];
        if (kind === "component quantity") line.estimate_line_components = [{ ...line.estimate_line_components[0], quantity: 99 }, line.estimate_line_components[1]];
        if (kind === "component order") line.estimate_line_components = [...line.estimate_line_components].reverse();
        if (kind === "mode") line.pricing_mode = "simple";
        if (kind === "project") projectId = "other";
        if (kind === "membership") estimates[0].estimate_lines = [];
        render(); const latest = JSON.stringify(estimates); request.resolve({ success: true }); await operation; await settle();
        expect(JSON.stringify(estimates)).toBe(latest); expect(ledger["delete:line"]).toBe("uncertain");
        expect(receipt()?.props["data-delete-phase"]).toBe("unconfirmed");
    });

    it.each(["draft", "apply", "save", "library", "uncertain save", "uncertain library"])("a current resource %s fences Remove before props refresh", async kind => {
        const panel = openResources(); const oldRemove = remove();
        if (kind === "draft") (panel.props.onDraftChanged as (id: string, open: boolean) => void)("line", true);
        if (kind === "apply") (panel.props.onApplyPendingChanged as (id: string, open: boolean) => void)("line", true);
        if (kind === "save" || kind === "uncertain save") (panel.props.onSaveStateChanged as (id: string, state: string) => void)("line", kind === "save" ? "saving" : "uncertain");
        if (kind === "library" || kind === "uncertain library") (panel.props.onLibrarySaveStateChanged as (id: string, state: string) => void)("line", kind === "library" ? "saving" : "uncertain");
        const before = JSON.stringify(estimates); await oldRemove("line");
        expect(replay.other).not.toHaveBeenCalled(); expect(JSON.stringify(estimates)).toBe(before);
    });

    it("a resource uncertainty arriving during Remove is visible before a props commit and prevents confirmed local removal", async () => {
        const panel = openResources(); const request = pending(); replay.other.mockReturnValue(request.promise);
        const operation = remove()("line");
        (panel.props.onSaveStateChanged as (id: string, state: string) => void)("line", "uncertain");
        const before = JSON.stringify(estimates); request.resolve({ success: true }); await operation; await settle();
        expect(JSON.stringify(estimates)).toBe(before); expect(ledger["delete:line"]).toBe("uncertain");
    });

    it("pending removal fences stale rate/components/mode callbacks,even after an old resource close", async () => {
        const panel = openResources(); const mode = nodes(tree).find(n => n.props.title === "Switch to simple rate")!;
        const request = pending(); replay.other.mockReturnValue(request.promise); const before = JSON.stringify(estimates);
        const operation = remove()("line");
        (panel.props.onDraftChanged as (id: string, open: boolean) => void)("line", false);
        (panel.props.onRateApplied as (id: string, rate: number, quantity: number, total: number) => void)("line", 99, 3, 297);
        (panel.props.onComponentsChanged as (id: string, components: unknown[]) => void)("line", []);
        (mode.props.onClick as () => void)();
        expect((panel.props.canApplyRate as () => boolean)()).toBe(false);
        expect(JSON.stringify(estimates)).toBe(before); expect(replay.other).toHaveBeenCalledTimes(1);
        request.resolve({ success: false, error: "refused" }); await operation; await settle();
    });

    it("uncertain built-up removal remains read-only after reopening and cannot issue another delete", async () => {
        replay.other.mockResolvedValue({ success: true, warning: "Aggregate refresh failed" });
        await remove()("line"); await settle(); const before = JSON.stringify(estimates);
        unmount(); replay.slots = {}; render(); await remove()("line");
        expect(rowElement().props.saveBlocked).toBe(true); expect(replay.other).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(estimates)).toBe(before); expect(text(tree)).toContain("Retained acknowledgement:  uncertain");
    });

    it.each(["boq", "preliminaries"])("acknowledged special-mode Remove retains initial built-up %s until confirmation", async kind => {
        if (kind === "boq") estimates[0].is_client_boq = true;
        else estimates[0].estimate_lines[0].trade_section = "Preliminaries";
        render(); const before = JSON.stringify(estimates); const request = pending(); replay.other.mockReturnValue(request.promise); const operation = remove()("line"); render();
        expect(JSON.stringify(estimates)).toBe(before); expect(receipt()?.props["data-delete-phase"]).toBe("saving");
        request.resolve({ success: true }); await operation; await settle(); expect(replay.other).toHaveBeenCalledExactlyOnceWith("line");
        expect(estimates[0].estimate_lines).toHaveLength(0); expect(receipt()?.props["data-delete-phase"]).toBe("confirmed");
    });
});

describe("acknowledged special-mode Remove with no snapshot rollback", () => {
    const kinds = ["BoQ simple", "BoQ built-up", "Preliminaries simple", "Preliminaries built-up", "legacy unknown mode"];
    function remove() { return rowElement().props.onDelete as (id: string) => Promise<void>; }
    function receipt() { return nodes(tree).find(n => n.props["aria-label"] === "Remove line acknowledgement"); }
    function setup(kind: string) {
        const line = estimates[0].estimate_lines[0];
        estimates[0].is_client_boq = kind.startsWith("BoQ");
        line.trade_section = kind.startsWith("Preliminaries") ? "Preliminaries" : "Kitchen";
        line.pricing_mode = (kind.includes("built-up") ? "buildup" : kind.includes("unknown") ? "legacy-special" : "simple") as typeof line.pricing_mode;
        line.quantity = 3.125; line.unit_rate = 4.2468; line.line_total = 13.271625;
        line.estimate_line_components = [{ id: "retained-resource", estimate_line_id: "line", component_type: "material", description: "  Exact resource  ", quantity: 0.125, unit: "item", unit_rate: 3.1234, line_total: 0.390425, manhours_per_unit: 0, total_manhours: 0, sort_order: 3 }];
        estimates[0].estimate_lines.push({ ...line, id: "keep", description: "Unrelated confirmed work", line_total: 19.7654 });
        estimates[0].total_cost = 33.037025; render();
    }

    it.each(kinds)("%s keeps exact confirmed source until one acknowledgement and removes only its reviewed row", async kind => {
        setup(kind); const before = JSON.stringify(estimates), kept = JSON.stringify(estimates[0].estimate_lines[1]);
        const request = pending(); replay.other.mockReturnValue(request.promise); const stale = remove();
        const operation = stale("line"); stale("line"); render();
        expect(JSON.stringify(estimates)).toBe(before); expect(ledger).toEqual({ "delete:line": "saving" });
        expect(replay.other).toHaveBeenCalledExactlyOnceWith("line");
        request.resolve({ success: true }); await operation; await stale("line"); await settle();
        expect(estimates[0].estimate_lines.map(l => l.id)).toEqual(["keep"]); expect(JSON.stringify(estimates[0].estimate_lines[0])).toBe(kept);
        expect(estimates[0].total_cost).toBe(19.7654); expect(estimates[0].is_client_boq).toBe(kind.startsWith("BoQ"));
        expect(ledger).toEqual({}); expect(receipt()?.props["data-delete-phase"]).toBe("confirmed");
        expect(replay.other).toHaveBeenCalledTimes(1); expect(replay.save).not.toHaveBeenCalled(); expect(replay.activity).not.toHaveBeenCalled();
    });

    it.each(kinds.flatMap(kind => ["refusal", "warning", "missing", "success with error", "rejection"].map(reply => ({ kind, reply }))))("$kind / $reply retains exact source and prohibits retry or refresh", async ({ kind, reply }) => {
        setup(kind); const before = JSON.stringify(estimates);
        if (reply === "rejection") replay.other.mockRejectedValue(Error("Lost response"));
        else replay.other.mockResolvedValue(reply === "refusal" ? { success: false, error: "Owner/edit-lock refusal" } : reply === "warning" ? { success: true, warning: "Stored total refresh failed" } : reply === "success with error" ? { success: true, error: "Unconfirmed" } : undefined);
        await remove()("line"); await settle(); await remove()("line");
        expect(JSON.stringify(estimates)).toBe(before); expect(replay.other).toHaveBeenCalledExactlyOnceWith("line");
        expect(ledger["delete:line"]).toBe("uncertain"); expect(receipt()?.props["data-delete-phase"]).toBe("unconfirmed");
        expect(text(receipt())).toContain("may already be deleted remotely"); expect(text(receipt())).toContain("Row identity:  line");
        expect(text(receipt())).not.toContain("Saved"); expect(rowElement().props.saveBlocked).toBe(true);
    });

    it.each(["refusal", "success"])("late %s cannot roll back newer BoQ sibling work in the synchronous parent store", async reply => {
        setup("BoQ simple"); const request = pending(); replay.other.mockReturnValue(request.promise); const operation = remove()("line");
        estimates = [{ ...estimates[0], total_cost: 91.25, estimate_lines: estimates[0].estimate_lines.map(l => l.id === "keep" ? { ...l, description: "Newer exact work", unit_rate: 13.75, quantity: 5, line_total: 68.75 } : l) }];
        const newer = JSON.stringify(estimates); request.resolve(reply === "refusal" ? { success: false, error: "Refused" } : { success: true }); await operation; await settle();
        expect(JSON.stringify(estimates)).toBe(newer); expect(ledger["delete:line"]).toBe("uncertain"); expect(replay.other).toHaveBeenCalledTimes(1);
    });

    it.each(["mode", "resource", "project", "version", "parent draft"])("late %s changes fence a Preliminaries acknowledgement", async kind => {
        setup("Preliminaries built-up"); const request = pending(); replay.other.mockReturnValue(request.promise); const operation = remove()("line"); render();
        if (kind === "mode") estimates[0].estimate_lines[0].pricing_mode = "simple";
        if (kind === "resource") estimates[0].estimate_lines[0].estimate_line_components[0].quantity = 99;
        if (kind === "project") projectId = "other";
        if (kind === "version") activeTab = "another";
        if (kind === "parent draft") ledger = { ...ledger, "draft:keep": "draft" };
        render(); const newer = JSON.stringify(estimates); request.resolve({ success: true }); await operation; await settle();
        expect(JSON.stringify(estimates)).toBe(newer); expect(ledger["delete:line"]).toBe("uncertain");
    });

    it.each(["draft", "saving", "uncertain"])("existing %s parent work blocks an initial special-mode request", async state => {
        setup("BoQ simple"); const stale = remove(); ledger = { "resource:keep": state as "draft" | "saving" | "uncertain" }; render(); const before = JSON.stringify(estimates);
        await stale("line"); expect(replay.other).not.toHaveBeenCalled(); expect(JSON.stringify(estimates)).toBe(before);
    });

    it.each(["saving", "uncertain"])("special-mode %s removal remains read-only after unmount/reopen", async phase => {
        setup("Preliminaries simple"); const request = pending(); replay.other.mockReturnValue(request.promise); const operation = remove()("line");
        if (phase === "uncertain") { request.resolve({ success: true, warning: "Aggregate refresh failed" }); await operation; }
        const before = JSON.stringify(estimates); unmount(); replay.slots = {}; render();
        await remove()("line"); expect(rowElement().props.saveBlocked).toBe(true); expect(ledger["delete:line"]).toBe(phase);
        expect(nodes(tree).some(n => n.props["aria-label"] === "Retained removal reconciliation")).toBe(true);
        if (phase === "saving") { request.resolve({ success: true }); await operation; }
        expect(JSON.stringify(estimates)).toBe(before); expect(replay.other).toHaveBeenCalledTimes(1);
    });
});

