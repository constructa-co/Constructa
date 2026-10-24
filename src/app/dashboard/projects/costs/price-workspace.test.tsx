import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, dispatch: vi.fn(), action: vi.fn(), theme: "dark" }));
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
        if (!(index in current.slots)) current.slots[index] = typeof initial === "function" ? initial() : initial;
        return [current.slots[index], (value: unknown) => { current.slots[index] = typeof value === "function" ? value(current.slots[index]) : value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.action, updateSimplePriceLineAction: current.action, deleteSimplePriceLineAction: current.action, savePriceAdjustmentsAction: current.action, loadAdvancedEstimatingDataAction: current.action }));
import EstimateClient from "./estimate-client";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view() {
    current.cursor = 0;
    return EstimateClient({ estimates: [], project: { id: "job", name: "Kitchen job", client_name: "Example client", brief_scope: "Prepare walls.\n\nSite, access and assumptions:\nProtect the occupied room." } });
}
function html() { return renderToStaticMarkup(view()); }
function toggle() {
    const button = nodes(view()).find(e => e.type === "button" && e.props["aria-controls"] === "price-line-table");
    expect(button).toBeDefined();
    (button!.props.onClick as () => void)();
}
function table(markup = html()) { return markup.match(/<table[^>]*id="price-line-table"[\s\S]*?<\/table>/)?.[0] ?? ""; }
function openFullLineForm() {
    const row = nodes(view()).find(node => typeof node.type === "function" && (node.props.line as { id?: string } | undefined)?.id === "line")!;
    const output = (row.type as (props: unknown) => Element)(row.props);
    const editor = nodes(output).find(node => node.props["data-inline-amount-editor"] === "line")!;
    const controls = nodes((editor.type as (props: unknown) => Element)(editor.props));
    (controls.find(node => node.type === "button" && node.props.children === "Full line form")!.props.onClick as () => void)();
}
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.dispatch.mockReset(); current.action.mockReset(); current.theme = "dark";
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 0, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Fit cupboards", quantity: 1, unit: "item", unit_rate: 1100, line_total: 1100, trade_section: "Kitchen fitting", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
});

describe("simple-first estimating table", () => {
    it("uses a real aligned table without forcing quantity/rate columns on a one-price estimate", () => {
        const markup = table();
        expect(markup).toContain("<caption");
        expect(markup.match(/<th scope="col"/g)).toHaveLength(3);
        expect(markup).toContain("Fit cupboards");
        expect(markup).toContain("Kitchen fitting");
        expect(markup).toContain('aria-label="Change Fit cupboards"');
        expect(markup).toContain('aria-label="Remove Fit cupboards"');
        expect(markup).toContain("£1,100.00");
        expect(markup).not.toContain('data-label="Quantity"');
    });

    it("reveals quantity/rate columns locally without dispatching edits, loading providers or changing totals", () => {
        const state = JSON.stringify(current.state);
        toggle();
        expect(table().match(/<th scope="col"/g)).toHaveLength(6);
        expect(html()).toContain('aria-pressed="true"');
        expect(table()).toContain('colSpan="3"');
        expect(table()).toContain("One price");
        toggle();
        expect(table().match(/<th scope="col"/g)).toHaveLength(3);
        expect(JSON.stringify(current.state)).toBe(state);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.action).not.toHaveBeenCalled();
        expect(html()).toContain("£1,320.00");
    });

    it("shows saved quantity/unit/rate separately when requested without recomputing the stored amount", () => {
        const line = current.state!.estimates[0].estimate_lines[0];
        Object.assign(line, { quantity: 2.5, unit: "crate", unit_rate: 20, line_total: 49.99 });
        toggle();
        const markup = table();
        expect(markup).toMatch(/data-label="Quantity"[^>]*>2.5</);
        expect(markup).toMatch(/data-label="Unit"[^>]*>crate</);
        expect(markup).toMatch(/data-label="Rate"[^>]*>£20.00</);
        expect(markup).toContain("£49.99");
        expect(line.line_total).toBe(49.99);
    });

    it.each([false, true])("keeps the unchanged edit form inside one spanning cell; detail=%s", detail => {
        current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "edit", lineId: "line", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "New description", amount: "1200" } });
        if (detail) toggle();
        openFullLineForm();
        const markup = table();
        expect(markup).toContain(`colSpan="${detail ? 6 : 3}"`);
        expect(markup).toContain('aria-label="Change this line"');
        expect(markup).toContain('id="line-line-description"');
        expect(markup).toContain('value="New description"');
        expect(markup).toContain("Save line");
        expect(current.state.ops.line.draft.amount).toBe("1200");
        expect(html().match(/data-in-view-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£1,100.00");
    });

    it("retains delete confirmation and retry controls in a separate full-width row", () => {
        current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "delete", lineId: "line", draft: EMPTY_PRICE_LINE_DRAFT });
        const markup = table();
        expect(markup).toContain('colSpan="3"');
        expect(markup).toContain("Remove this line?");
        expect(markup).toContain("Keep it");
        expect(current.action).not.toHaveBeenCalled();
    });

    it.each(["buildup", "client-boq"])("preserves %s read-only controls and identifies the existing advanced path", mode => {
        if (mode === "buildup") current.state!.estimates[0].estimate_lines[0].pricing_mode = "buildup";
        else current.state!.estimates[0].is_client_boq = true;
        expect(table()).toContain("Change this line in Advanced estimating.");
        expect(table()).not.toContain('aria-label="Change Fit cupboards"');
        expect(table()).not.toContain('aria-label="Remove Fit cupboards"');
    });

    it("keeps first-price entry simple and does not show an empty worksheet", () => {
        current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
        expect(table()).toBe("");
        expect(html()).toContain("one figure for the whole job");
        expect(html()).toContain("Add the first price line");
        expect(current.action).not.toHaveBeenCalled();
    });

    it.each(["dark", "light"])("retains reviewed brief context, escaped contractor descriptions and no generated activities in %s theme", theme => {
        current.theme = theme;
        current.state!.estimates[0].estimate_lines[0].description = "<script>not markup</script>";
        const markup = html();
        expect(markup).toContain('data-theme="' + theme + '"');
        expect(markup).toContain("Prepare walls.");
        expect(markup).not.toContain("Protect the occupied room.");
        expect(table(markup)).toContain("&lt;script&gt;not markup&lt;/script&gt;");
        expect(table(markup)).not.toContain("<script>");
        expect(current.state!.estimates[0].estimate_lines).toHaveLength(1);
    });
});
