import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";
import { reviewPricingSuggestion, type PendingPricingReview, type PricingReviewContext } from "@/lib/pricing-review";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, server: vi.fn(), dispatch: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
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
function excerpt(scope?: string) {
    const element = nodes(view(scope)).find(e => e.props["data-brief-excerpt"]);
    expect(element, "the real pricing parent should offer manual excerpt review").toBeDefined(); return element!;
}
function selectedSource(element: Element, wording: string) {
    const context = element.props.context as PricingReviewContext;
    const start = context.work.indexOf(wording);
    const result = reviewPricingSuggestion(context, { message: "", suggestions: [{ source: "briefWork", start, end: start + wording.length }] });
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    return result.value;
}
function openSource(element: Element, source: PendingPricingReview) {
    return (element.props.onOpen as (pending: PendingPricingReview) => { ok: boolean; error?: string })(source);
}
beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Existing work", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.slots = []; current.cursor = 0; current.server.mockReset();
    current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
});
describe("reviewed brief-to-draft entry", () => {
    it("keeps payment and scope-note drafts independently guarded on the real pricing parent", () => {
        const pricing = () => {
            current.cursor = 0;
            return EstimateClient({ estimates: [], project: { id: "job", name: "Example", client_name: "", brief_scope: "Paint walls.", payment_schedule: null,
                scope_notes: { exclusions_text: "Saved exclusion", clarifications_text: null, contract_exclusions: null, contract_clarifications: null } } });
        };
        const children = nodes(pricing());
        const notes = children.find(node => node.props.onWorkChange && node.props.source)!, payments = children.find(node => node.props.onWorkChange && "schedule" in node.props)!;
        expect(notes.props.projectId).toBe("job"); expect(notes.props.source).toMatchObject({ exclusions_text: "Saved exclusion" });
        const chooser = children.find(node => node.props["data-brief-excerpt"])!, pending = selectedSource(chooser, "Paint walls.");
        (notes.props.onWorkChange as (open: boolean) => void)(true);
        expect(openSource(chooser, pending).ok).toBe(false);
        (payments.props.onWorkChange as (open: boolean) => void)(true);
        (notes.props.onWorkChange as (open: boolean) => void)(false);
        expect(nodes(pricing()).find(node => node.props["data-brief-excerpt"])!.props.blocked).toBe(true);
        (payments.props.onWorkChange as (open: boolean) => void)(false);
        expect(nodes(pricing()).find(node => node.props["data-brief-excerpt"])!.props.blocked).toBe(false);
        expect(current.server).not.toHaveBeenCalled();
    });
    it("mounts project payment stages in pricing and includes open payment drafts in existing guards", () => {
        const pricing = () => {
            current.cursor = 0;
            return EstimateClient({ estimates: [], project: { id: "job", name: "Example", client_name: "", brief_scope: "Paint walls.", payment_schedule: null, payment_lock_reason: null } });
        };
        const children = nodes(pricing());
        const payments = children.find(n => n.props.onWorkChange && "schedule" in n.props)!;
        expect(payments).toBeDefined(); expect(payments.props.schedule).toBeNull(); expect(payments.props.projectId).toBe("job");
        const chooser = children.find(n => n.props["data-brief-excerpt"])!, pending = selectedSource(chooser, "Paint walls.");
        (payments.props.onWorkChange as (open: boolean) => void)(true);
        expect(openSource(chooser, pending).ok).toBe(false);
        expect(nodes(pricing()).find(n => n.props["data-brief-excerpt"])!.props.blocked).toBe(true);
        (payments.props.onWorkChange as (open: boolean) => void)(false);
        expect(nodes(pricing()).find(n => n.props["data-brief-excerpt"])!.props.blocked).toBe(false);
        expect(current.server).not.toHaveBeenCalled();
    });
    it("cancels a selected-work draft without altering the saved estimate", () => {
        const chooser = excerpt(), before = JSON.stringify(current.state!.estimates);
        openSource(chooser, selectedSource(chooser, "Paint walls."));
        const row = nodes(view()).find(n => n.props["data-inline-add"])!;
        expect(row).toBeDefined(); (row.props.onCancel as () => void)();
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(JSON.stringify(current.state!.estimates)).toBe(before); expect(current.server).not.toHaveBeenCalled();
    });
    it("saves selected work only after a contractor enters a price and uses the existing explicit Save", async () => {
        const chooser = excerpt(); openSource(chooser, selectedSource(chooser, "Paint walls."));
        expect(current.server).not.toHaveBeenCalled();
        let row = nodes(view()).find(n => n.props["data-inline-add"])!;
        (row.props.onChange as (patch: unknown) => void)({ amount: "100" });
        expect(current.server).not.toHaveBeenCalled();
        current.server.mockImplementationOnce(async request => ({ ok: true, estimateId: "estimate", line: { id: request.lineId, estimate_id: "estimate", ...request.line, line_total: request.line.quantity * request.line.unit_rate } }));
        row = nodes(view()).find(n => n.props["data-inline-add"])!;
        (row.props.onSave as () => void)(); await Promise.resolve(); await Promise.resolve();
        expect(current.server).toHaveBeenCalledOnce();
        expect(current.server.mock.calls[0][0].line).toEqual({ description: "Paint walls.", quantity: 1, unit: "item", unit_rate: 100 });
        expect(current.state!.estimates[0].estimate_lines).toContainEqual(expect.objectContaining({ description: "Paint walls.", line_total: 100 }));
        expect(current.state!.estimates[0].total_cost).toBe(877);
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
    });

    it("rechecks the resource/library ledger for both brief entry paths after Advanced closes", async () => {
        const wholeClick = button().props.onClick as () => void, chooser = excerpt(), pending = selectedSource(chooser, "Paint walls.");
        current.server.mockResolvedValueOnce({ ok: true, data: { costLibrary: [], orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] } });
        (nodes(view()).find(n => n.props["aria-controls"] === "advanced-estimating")!.props.onClick as () => void)();
        await Promise.resolve(); await Promise.resolve();
        const advanced = nodes(view()).find(n => n.props.onResourceSaveStateChanged)!;
        expect(advanced).toBeDefined();
        (advanced.props.onResourceSaveStateChanged as (id: string, state: string) => void)("library:line", "uncertain");
        (nodes(view()).find(n => n.props["aria-controls"] === "advanced-estimating")!.props.onClick as () => void)();
        current.server.mockClear(); current.dispatch.mockClear();
        wholeClick(); expect(openSource(chooser, pending).ok).toBe(false);
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined(); expect(current.dispatch).not.toHaveBeenCalled(); expect(current.server).not.toHaveBeenCalled();
    });

    it("offers a source-reviewed excerpt when the whole brief exceeds the line limit, without copying notes or prices", () => {
        const scope = "Prepare walls. ".repeat(50) + "Paint the ceiling, excluding the beams.\n\nSite, access and assumptions:\nPrivate access notes.";
        expect(button(scope).props.disabled).toBe(true);
        const chooser = excerpt(scope), before = JSON.stringify(current.state!.estimates);
        expect((chooser.props.context as PricingReviewContext).work).not.toContain("Private access notes");
        expect(openSource(chooser, selectedSource(chooser, "Paint the ceiling, excluding the beams.")).ok).toBe(true);
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Paint the ceiling, excluding the beams." });
        expect(JSON.stringify(current.state!.estimates)).toBe(before); expect(current.server).not.toHaveBeenCalled();
    });
    it("does not overwrite typing on a repeated source click before a rerender", () => {
        const chooser = excerpt(), pending = selectedSource(chooser, "Paint walls.");
        openSource(chooser, pending);
        current.state = estimatingReducer(current.state!, { type: "op/change", key: NEW_LINE_KEY, patch: { description: "My revised activity" } });
        expect(openSource(chooser, pending).ok).toBe(false);
        expect(current.state!.ops[NEW_LINE_KEY].draft.description).toBe("My revised activity");
        expect(current.dispatch).toHaveBeenCalledTimes(1); expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["open-line", "adjustments", "advanced", "client-boq"])("keeps the existing %s boundary for selected work", boundary => {
        if (boundary === "open-line") current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "edit", lineId: "line", draft: EMPTY_PRICE_LINE_DRAFT });
        if (boundary === "adjustments") current.state!.adjustments.status = "saving";
        if (boundary === "advanced") current.state!.advancedOpen = true;
        if (boundary === "client-boq") current.state!.estimates[0].is_client_boq = true;
        const chooser = excerpt(), before = JSON.stringify(current.state);
        expect(chooser.props.blocked).toBe(true);
        expect(openSource(chooser, selectedSource(chooser, "Paint walls.")).ok).toBe(false);
        expect(JSON.stringify(current.state)).toBe(before); expect(current.server).not.toHaveBeenCalled();
    });
    it("refuses an excerpt prepared before the selected estimate changed", () => {
        const chooser = excerpt(), pending = selectedSource(chooser, "Paint walls.");
        current.state!.estimates[0].estimate_lines[0].unit_rate = 999;
        expect(openSource(chooser, pending)).toMatchObject({ ok: false, error: expect.stringMatching(/changed/) });
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.server).not.toHaveBeenCalled();
    });
    it("opens one unpriced excerpt before a first estimate exists without creating server records", () => {
        current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
        const chooser = excerpt(); openSource(chooser, selectedSource(chooser, "Paint walls."));
        expect(current.state!.estimates).toEqual([]);
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Paint walls." });
        expect(current.server).not.toHaveBeenCalled();
    });
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
