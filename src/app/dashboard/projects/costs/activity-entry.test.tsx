import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, add: vi.fn(), other: vi.fn(), error: vi.fn(), estimates: [] as Estimate[] }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const slot = replay.cursor++;
        if (!(slot in replay.slots)) replay.slots[slot] = typeof initial === "function" ? initial() : initial;
        return [replay.slots[slot], (value: unknown) => { replay.slots[slot] = typeof value === "function" ? value(replay.slots[slot]) : value; }];
    },
    useRef: (initial: unknown) => {
        const slot = replay.cursor++;
        if (!(slot in replay.slots)) replay.slots[slot] = { current: initial };
        return replay.slots[slot];
    },
    useId: () => "activity-entry-test",
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void) => { effect(); },
    useTransition: () => [false, (callback: () => unknown) => callback()],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ createEstimateAction: replay.other, updateEstimateMarginsAction: replay.other, updateEstimateNameAction: replay.other, addLineItemAction: replay.add, updateLineItemAction: replay.other, deleteLineItemAction: replay.other, setActiveEstimateAction: replay.other, deleteEstimateAction: replay.other, setPricingModeAction: replay.other, saveDiscountAction: replay.other }));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.other }));
vi.mock("@/app/dashboard/foundations/vision-takeoff", () => ({ default: () => null }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));
vi.mock("sonner", () => ({ toast: { error: replay.error } }));
import * as workspace from "./advanced-estimate";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view() {
    replay.cursor = 0;
    return workspace.default({ estimates: replay.estimates, setEstimates: update => { replay.estimates = update(replay.estimates); }, activeTab: "estimate", setActiveTab: vi.fn(), costLibrary: [], projectId: "project", orgId: "org", rateBuildups: [], labourRates: [], preferredTrades: [] });
}
function entry() {
    const element = nodes(view()).find(e => typeof e.props.onAddActivity === "function");
    expect(element).toBeDefined();
    return element!;
}
function form(props: Record<string, unknown> = { activeSections: [], commonNames: ["Demolition", "Plumbing"], onAddActivity: replay.add }) {
    replay.cursor = 0;
    return nodes((workspace as unknown as { EstimateActivityEntry: (props: Record<string, unknown>) => unknown }).EstimateActivityEntry(props));
}
function input(elements: Element[]) { return elements.find(e => e.type === "input")!.props; }
function submit(elements: Element[]) { return elements.find(e => e.type === "form")!.props.onSubmit as (event: { preventDefault: () => void }) => void; }

beforeEach(() => {
    vi.useFakeTimers();
    replay.slots = []; replay.cursor = 0; replay.add.mockReset().mockResolvedValue({ id: "confirmed-line" }); replay.other.mockReset(); replay.error.mockReset();
    replay.estimates = [{ id: "estimate", project_id: "project", version_name: "Estimate v1", overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 10, is_active: true, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Fit cupboards", quantity: 1, unit: "item", unit_rate: 10, line_total: 10, trade_section: "Kitchen fitting", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] }];
});

describe("job-led activity entry", () => {
    it("replaces the predefined section-button wall without changing existing groups or lines", () => {
        const before = JSON.stringify(replay.estimates);
        expect(nodes(view()).filter(e => e.type === "button" && String(e.props.children).includes("Structural Steel"))).toHaveLength(0);
        expect(entry().props.activeSections).toEqual(["Kitchen fitting"]);
        expect(entry().props.commonNames).toContain("Structural Steel");
        expect(entry().key).toBe("estimate");
        expect(JSON.stringify(replay.estimates)).toBe(before);
        expect(replay.add).not.toHaveBeenCalled(); expect(replay.other).not.toHaveBeenCalled();
    });

    it.each(["__proto__", "constructor", "toString"])("renders contractor activity %s without prototype collisions", name => {
        replay.estimates[0].estimate_lines[0].trade_section = name;
        expect(() => view()).not.toThrow();
        expect(entry().props.activeSections).toEqual([name]);
    });

    it("uses the existing confirmed add path and preserves its quantity/rate defaults", async () => {
        let resolve!: (value: { id: string }) => void;
        replay.add.mockReturnValue(new Promise(done => { resolve = done; }));
        const add = entry().props.onAddActivity as (name: string) => Promise<void>;
        const pending = add("Preparation and protection");
        await add("Preparation and protection");
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("estimate", "Preparation and protection", { description: "", quantity: 1, unit: "nr", unit_rate: 0, line_type: "general" });
        expect(replay.estimates[0].estimate_lines).toHaveLength(1);
        resolve({ id: "confirmed-line" }); await pending;
        expect(replay.estimates[0].estimate_lines[1]).toMatchObject({ id: "confirmed-line", trade_section: "Preparation and protection", quantity: 1, unit_rate: 0, line_total: 0 });
        expect(replay.estimates[0].estimate_lines[0].id).toBe("line");
        expect(replay.estimates[0].total_cost).toBe(10);
    });

    it("keeps an existing server rejection visible without adding an optimistic row", async () => {
        replay.add.mockResolvedValue({ error: "Project is locked" });
        await (entry().props.onAddActivity as (name: string) => Promise<void>)("Decoration");
        expect(replay.error).toHaveBeenCalledWith("Project is locked");
        expect(replay.estimates[0].estimate_lines).toHaveLength(1);
    });

    it("retains the existing unfinished-row guard", async () => {
        replay.estimates[0].estimate_lines[0].description = "";
        await (entry().props.onAddActivity as (name: string) => Promise<void>)("Kitchen fitting");
        expect(replay.add).not.toHaveBeenCalled();
    });

    it("labels custom input and keeps predefined names behind a closed native disclosure", () => {
        const elements = form();
        expect(elements.find(e => e.type === "label")?.props.htmlFor).toBe(input(elements).id);
        expect(input(elements)["aria-describedby"]).toBeTruthy();
        expect(elements.find(e => e.type === "details")?.props.open).not.toBe(true);
        expect(elements.find(e => e.type === "select")?.props["aria-label"]).toBe("Common activity name");
        expect(replay.add).not.toHaveBeenCalled();
    });

    it("does not save from typing, choosing a common name or focusing/blurring; only explicit submit adds", () => {
        (input(form()).onChange as (e: unknown) => void)({ target: { value: "  Preparation and protection  " } });
        expect(replay.add).not.toHaveBeenCalled();
        expect(input(form()).onBlur).toBeUndefined();
        submit(form())({ preventDefault: vi.fn() });
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("Preparation and protection");
        replay.add.mockClear();
        const select = form().find(e => e.type === "select")!;
        (select.props.onChange as (e: unknown) => void)({ target: { value: "Plumbing" } });
        expect(input(form()).value).toBe("Plumbing");
        expect(replay.add).not.toHaveBeenCalled();
    });

    it.each(["", "   ", " Kitchen fitting "])("refuses blank or already-present activity %j, including submit bypass", name => {
        const props = { activeSections: ["Kitchen fitting"], commonNames: ["Kitchen fitting", "Plumbing"], onAddActivity: replay.add };
        (input(form(props)).onChange as (e: unknown) => void)({ target: { value: name } });
        expect(form(props).find(e => e.type === "button" && e.props.type === "submit")!.props.disabled).toBe(true);
        submit(form(props))({ preventDefault: vi.fn() });
        expect(replay.add).not.toHaveBeenCalled();
    });
});

describe("activity add acknowledgement gates", () => {
    it.each(["Preparation", " Decoration "])("retains raw activity input but refuses submit while its add is pending/unconfirmed: %s", name => {
        const props = { activeSections: [], commonNames: [], onAddActivity: replay.add, blockedNames: [name.trim()] };
        (input(form(props)).onChange as (e: unknown) => void)({ target: { value: name } });
        const elements = form(props); expect(input(elements).value).toBe(name);
        expect(elements.find(e => e.type === "button" && e.props.type === "submit")!.props.disabled).toBe(true);
        submit(elements)({ preventDefault: vi.fn() }); expect(replay.add).not.toHaveBeenCalled();
    });
});
