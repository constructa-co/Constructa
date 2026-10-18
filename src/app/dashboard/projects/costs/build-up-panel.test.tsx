import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { EstimateLine, EstimateLineComponent } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: false, tasks: [] as Promise<unknown>[], thrown: [] as unknown[], update: vi.fn(), add: vi.fn(), remove: vi.fn(), apply: vi.fn(), library: vi.fn() }));
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
    useTransition: () => [replay.pending, (callback: () => unknown) => {
        const task = callback();
        if (task instanceof Promise) replay.tasks.push(task.catch(error => { replay.thrown.push(error); }));
    }],
}));
vi.mock("./actions", () => ({ addComponentAction: replay.add, updateComponentAction: replay.update, deleteComponentAction: replay.remove, updateLineBuiltUpRateAction: replay.apply, saveRateBuildupAction: replay.library }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import BuildUpPanel from "./build-up-panel";

const components: EstimateLineComponent[] = [
    { id: "boards", estimate_line_id: "line", component_type: "material", description: "Boards", quantity: 20, unit: "nr", unit_rate: 2, line_total: 40, manhours_per_unit: 0, total_manhours: 0, sort_order: 0 },
    { id: "fixings", estimate_line_id: "line", component_type: "material", description: "Fixings", quantity: 10, unit: "nr", unit_rate: 1, line_total: 10, manhours_per_unit: 0, total_manhours: 0, sort_order: 1 },
    { id: "fitter", estimate_line_id: "line", component_type: "labour", description: "Fitter", quantity: 2, unit: "day", unit_rate: 100, line_total: 200, manhours_per_unit: 8, total_manhours: 16, sort_order: 2 },
];
const line: EstimateLine = { id: "line", estimate_id: "estimate", description: "Fit cupboards", quantity: 10, unit: "m2", unit_rate: 25, line_total: 250, trade_section: "Carpentry", line_type: "general", pricing_mode: "buildup", estimate_line_components: components };
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view(parent = line) {
    replay.cursor = 0;
    return BuildUpPanel({ line: parent, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied });
}
const changed = vi.fn();
const applied = vi.fn();
function control(tree: unknown, label: string) {
    const node = nodes(tree).find(e => e.props["aria-label"] === label);
    expect(node, label).toBeDefined();
    return node!.props;
}
function enterPerUnit(parent = line) {
    const props = control(view(parent), "Enter resource quantities per priced unit");
    (props.onClick as () => void)();
    return view(parent);
}
beforeEach(() => {
    replay.slots = []; replay.cursor = 0; replay.pending = false; replay.tasks = []; replay.thrown = [];
    for (const mock of [replay.update, replay.add, replay.remove, replay.apply, replay.library, changed, applied]) mock.mockReset();
    replay.update.mockResolvedValue(undefined);
    replay.apply.mockResolvedValue(undefined);
});

function applyControl() {
    const node = nodes(view()).find(e => e.type === "button" && (e.props["aria-label"] === "Apply resource rate" || JSON.stringify(e.props.children).includes("Apply rate")));
    expect(node).toBeDefined(); return node!.props;
}
function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
describe("resource rate acknowledgement", () => {
    it("waits for the existing action before reporting an applied price", async () => {
        const request = deferred(); replay.apply.mockReturnValueOnce(request.promise);
        (applyControl().onClick as () => void)();
        expect(replay.apply).toHaveBeenCalledExactlyOnceWith("line", 25);
        expect(applied).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        expect(applyControl().disabled).toBe(true);
        request.resolve(); await Promise.all(replay.tasks);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25);
        expect(renderToStaticMarkup(view())).toContain("Rate applied to the line price");
    });

    it("catches an uncertain failure without claiming the rate was applied, and permits an explicit retry", async () => {
        replay.apply.mockRejectedValueOnce(new Error("Aggregate update failed"));
        (applyControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(applied).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        expect(replay.thrown).toEqual([]);
        const html = renderToStaticMarkup(view());
        expect(html).toContain("Rate not confirmed"); expect(html).toContain("may have been saved");
        expect(html).not.toContain("Rate applied to the line price");
        (applyControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.apply).toHaveBeenCalledTimes(2);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25);
    });

    it("prevents a duplicate Apply from the same render while the first request is pending", async () => {
        const request = deferred(); replay.apply.mockReturnValueOnce(request.promise);
        const click = applyControl().onClick as () => void;
        click(); click();
        expect(replay.apply).toHaveBeenCalledTimes(1);
        request.resolve(); await Promise.all(replay.tasks);
    });

    it("does not Apply while a resource operation is pending", () => {
        replay.pending = true;
        expect(applyControl().disabled).toBe(true);
        (applyControl().onClick as () => void)();
        expect(replay.apply).not.toHaveBeenCalled(); expect(applied).not.toHaveBeenCalled();
    });

    it("acknowledges the submitted snapshot, not resource edits made during the request", async () => {
        const request = deferred(); replay.apply.mockReturnValueOnce(request.promise);
        (applyControl().onClick as () => void)();
        const quantity = control(view(), "Total resource quantity: Boards");
        (quantity.onChange as (e: unknown) => void)({ target: { value: "30" } });
        expect(applied).not.toHaveBeenCalled();
        request.resolve(); await Promise.all(replay.tasks);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25);
        expect(renderToStaticMarkup(view())).toContain("Resource changes need applying");
        (applyControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.apply).toHaveBeenLastCalledWith("line", 27);
        expect(applied).toHaveBeenLastCalledWith("line", 27);
    });

    it("does not demand another price application just because a resource was renamed", async () => {
        (applyControl().onClick as () => void)(); await Promise.all(replay.tasks);
        const description = control(view(), "Material description: Boards");
        (description.onChange as (e: unknown) => void)({ target: { value: "Renamed boards" } });
        (description.onBlur as (e: unknown) => void)({ target: { value: "Renamed boards" } });
        await Promise.all(replay.tasks);
        expect(renderToStaticMarkup(view())).toContain("Rate applied to the line price");
        expect(renderToStaticMarkup(view())).not.toContain("Resource changes need applying");
        expect(replay.apply).toHaveBeenCalledTimes(1);
    });

    it("does not apply a price while a visible per-unit quantity is invalid", async () => {
        const input = control(enterPerUnit(), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: "bad" } });
        expect(applyControl().disabled).toBe(true);
        (applyControl().onClick as () => void)();
        expect(replay.apply).not.toHaveBeenCalled();
        const corrected = control(view(), "Quantity per 1 m2: Boards");
        (corrected.onBlur as (e: unknown) => void)({ target: { value: "3" } });
        await Promise.all(replay.tasks);
        expect(applyControl().disabled).toBe(false);
    });
});

describe("existing line resource build-up", () => {
    it("opens multiple named resources without a write or a changed total", () => {
        const before = JSON.stringify(line);
        const html = renderToStaticMarkup(view());
        for (const text of ["Boards", "Fixings", "Fitter", "£250.00", "£25.00"]) expect(html).toContain(text);
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        expect(JSON.stringify(line)).toBe(before);
    });

    it("uses a semantic resource table with clear quantity, rate and total columns", () => {
        const html = renderToStaticMarkup(view());
        expect(html).toContain("<table"); expect(html).toContain("<caption");
        for (const text of ["Resource", "Total quantity", "Resource rate", "Resource total", "Hours / resource unit"]) expect(html).toContain(text);
        expect(html.match(/data-resource-row=/g)).toHaveLength(3);
    });

    it("keeps an empty resource panel honest about the unchanged current line rate", () => {
        const html = renderToStaticMarkup(view({ ...line, estimate_line_components: [] }));
        expect(html).toContain("No resource rows yet. Current line rate:");
        expect(html).toContain("£25.00");
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
    });

    it("switches quantity basis without editing saved components or applying a rate", () => {
        const html = renderToStaticMarkup(enterPerUnit());
        expect(html).toContain("Quantity per 1 m2");
        expect(html).toContain("recheck the build-up if the priced quantity changes");
        for (const mock of [replay.update, replay.apply, replay.add, replay.remove, replay.library, changed]) expect(mock).not.toHaveBeenCalled();
    });

    it("maps an intentional per-unit edit to the existing total-quantity action and roll-up", () => {
        const tree = enterPerUnit();
        const input = control(tree, "Quantity per 1 m2: Boards");
        expect(input.defaultValue).toBe(2);
        (input.onBlur as (e: unknown) => void)({ target: { value: "3" } });
        expect(replay.update).toHaveBeenCalledExactlyOnceWith("boards", { quantity: 30 });
        expect(changed).toHaveBeenLastCalledWith("line", expect.arrayContaining([expect.objectContaining({ id: "boards", quantity: 30, line_total: 60 })]), 27);
        expect(replay.apply).not.toHaveBeenCalled();
    });

    it("does not save on unchanged per-unit focus and blur, including repeating divisions", () => {
        const parent = { ...line, quantity: 3 };
        const input = control(enterPerUnit(parent), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: String(20 / 3) } });
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    });

    it.each(["", " ", "NaN", "Infinity", "1e309", "0x10"])("refuses invalid per-unit input %j without changing costs", raw => {
        const input = control(enterPerUnit(), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: raw } });
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(view())).toContain("Enter a finite resource quantity");
    });

    it("accepts an intentional zero without a default quantity fallback", () => {
        const input = control(enterPerUnit(), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: "0" } });
        expect(replay.update).toHaveBeenCalledExactlyOnceWith("boards", { quantity: 0 });
    });

    it("retains existing arithmetic without silently rounding decimal resource quantities", () => {
        const parent = { ...line, quantity: 3 };
        const input = control(enterPerUnit(parent), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: "0.1" } });
        expect(replay.update).toHaveBeenCalledExactlyOnceWith("boards", { quantity: 0.1 * 3 });
    });

    it("refuses a resource amount overflow even when its quantity is finite", () => {
        const parent = { ...line, quantity: 1e308 };
        const input = control(enterPerUnit(parent), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: "1" } });
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    });

    it("preserves the legacy total-quantity editing path", () => {
        const input = control(view(), "Total resource quantity: Boards");
        (input.onChange as (e: unknown) => void)({ target: { value: "12" } });
        expect(replay.update).toHaveBeenCalledExactlyOnceWith("boards", { quantity: 12 });
        expect(changed).toHaveBeenLastCalledWith("line", expect.any(Array), 23.4);
    });

    it("restores the old components and rate after an existing action rejects a per-unit edit", async () => {
        replay.update.mockRejectedValueOnce(new Error("Not saved"));
        const input = control(enterPerUnit(), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: "3" } });
        await Promise.resolve();
        expect(changed).toHaveBeenLastCalledWith("line", components, 25);
        expect(control(view(), "Quantity per 1 m2: Boards").defaultValue).toBe(2);
    });

    it("labels every resource input, unit and remove control", () => {
        const tree = view();
        for (const element of nodes(tree).filter(e => e.type === "input" || e.type === "select")) {
            expect(element.props["aria-label"]).toBeTruthy();
        }
        expect(control(tree, "Remove resource: Boards")).toBeDefined();
    });

    it.each([0, -1, Infinity, NaN])("keeps total entry when parent quantity %s cannot define a per-unit basis", quantity => {
        const tree = view({ ...line, quantity });
        expect(control(tree, "Enter resource quantities per priced unit").disabled).toBe(true);
        expect(replay.update).not.toHaveBeenCalled();
    });
});
