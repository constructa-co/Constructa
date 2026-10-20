import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, dispatch: vi.fn(), action: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => undefined,
    useMemo: (calculate: () => unknown) => calculate(), useState: (initial: unknown) => [initial, vi.fn()] }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
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
    const tree = EstimateClient({ estimates: [], project: { id: "job", name: "Room", client_name: "", brief_scope: "Prepare walls" } });
    const component = nodes(tree).find(node => node.props.idPrefix === "new-line")!;
    return { component, form: (component.type as (props: unknown) => Element)(component.props) };
}
beforeEach(() => {
    current.action.mockReset(); current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
    current.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "first", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Prepare walls", amount: "100" } });
    current.dispatch.mockClear();
});
describe("real add-line continuation controls", () => {
    it("offers separate explicit Save and add next without any render-time save", () => {
        const { component, form } = view();
        expect(component.key).toBe("first");
        const button = nodes(form).find(node => node.type === "button" && node.props.children === "Save and add next");
        expect(button?.props.type).toBe("button");
        expect(button?.props.onClick).toBeTypeOf("function");
        expect(nodes(form).find(node => node.props.id === "new-line-description")?.props.autoFocus).toBe(true);
        expect(current.action).not.toHaveBeenCalled();
        expect(current.dispatch).not.toHaveBeenCalled();
    });
    it("wires the real parent button to one existing save action and a fresh blank draft", async () => {
        current.action.mockImplementation(async request => ({ ok: true, estimateId: "pending", createdEstimate: {
            id: "pending", project_id: "job", version_name: "Estimate", is_active: true, total_cost: 0,
            overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", estimate_lines: [],
        }, line: { id: request.lineId, estimate_id: "pending", ...request.line, line_total: 100 } }));
        const button = nodes(view().form).find(node => node.type === "button" && node.props.children === "Save and add next")!;
        await (button.props.onClick as () => Promise<void>)();
        expect(current.action).toHaveBeenCalledTimes(1);
        expect(current.state!.estimates[0].estimate_lines).toHaveLength(1);
        expect(current.state!.ops.new.draft.description).toBe("");
        expect(current.state!.ops.new.draft.amount).toBe("");
        expect(current.state!.ops.new.lineId).not.toBe("first");
    });
    it.each(["saving", "failed"])("disables continuation only while saving; status=%s", status => {
        current.state!.ops.new.status = status as "saving" | "failed";
        const button = nodes(view().form).find(node => node.type === "button" && node.props.children === "Save and add next");
        expect(button?.props.disabled).toBe(status === "saving");
    });
    it.each(["ctrlKey", "metaKey"])("supports explicit %s+Enter in pricing fields without ordinary form submit", modifier => {
        const { component } = view();
        const next = vi.fn();
        const form = (component.type as (props: unknown) => Element)({ ...component.props, onSaveNext: next });
        const event = { key: "Enter", [modifier]: true, target: { id: "new-line-amount" }, nativeEvent: { isComposing: false }, preventDefault: vi.fn(), defaultPrevented: false };
        expect(form.props.onKeyDown).toBeTypeOf("function");
        (form.props.onKeyDown as (event: unknown) => void)(event);
        expect(next).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(current.action).not.toHaveBeenCalled();
    });
    it.each([
        { key: "Enter", ctrlKey: false }, { key: "Enter", ctrlKey: true, repeat: true },
        { key: "Enter", ctrlKey: true, nativeEvent: { isComposing: true } },
        { key: "Enter", ctrlKey: true, target: { id: "new-line-length" } },
        { key: "Enter", ctrlKey: true, defaultPrevented: true },
        { key: "Enter", ctrlKey: true, target: { id: "cancel" } },
    ])("does not hijack ordinary Enter, IME, held keys, area measurements or other controls: %j", patch => {
        const { component } = view(); const next = vi.fn();
        const form = (component.type as (props: unknown) => Element)({ ...component.props, onSaveNext: next });
        expect(form.props.onKeyDown).toBeTypeOf("function");
        (form.props.onKeyDown as (event: unknown) => void)(Object.assign({ key: "Enter", ctrlKey: true, target: { id: "new-line-amount" }, nativeEvent: { isComposing: false }, preventDefault: vi.fn() }, patch));
        expect(next).not.toHaveBeenCalled();
    });
    it("does not expose continuation or autofocus for an edit form", () => {
        const { component } = view();
        const form = (component.type as (props: unknown) => Element)({ ...component.props, op: { ...current.state!.ops.new, kind: "edit" }, onSaveNext: undefined });
        expect(nodes(form).find(node => node.type === "button" && node.props.children === "Save and add next")).toBeUndefined();
        expect(nodes(form).find(node => node.props.id === "new-line-description")?.props.autoFocus).toBe(false);
    });
});
