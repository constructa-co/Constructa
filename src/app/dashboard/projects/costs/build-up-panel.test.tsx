import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { EstimateLine, EstimateLineComponent } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: false, tasks: [] as Promise<unknown>[], thrown: [] as unknown[], update: vi.fn(), add: vi.fn(), remove: vi.fn(), apply: vi.fn(), library: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useEffect: () => undefined,
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
    const stored = new Map(components.map(component => [component.id, { ...component }]));
    replay.update.mockImplementation(async (id, patch) => {
        const saved = { ...stored.get(id)!, ...patch };
        saved.line_total = saved.quantity * saved.unit_rate;
        saved.total_manhours = saved.quantity * saved.manhours_per_unit;
        stored.set(id, saved);
        return saved;
    });
    replay.apply.mockImplementation(async (_id, rate, quantity) => ({ unitRate: rate, quantity, lineTotal: rate * quantity }));
});

function applyControl() {
    // Existing Apply scenarios now include the explicit, non-saving review step.
    const review = basisReview();
    if (!review.checked && !review.disabled) confirmBasis();
    const node = nodes(view()).find(e => e.type === "button" && (e.props["aria-label"] === "Apply resource rate" || JSON.stringify(e.props.children).includes("Apply rate")));
    expect(node).toBeDefined(); return node!.props;
}
function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{ unitRate: number; quantity: number; lineTotal: number }>((ok, fail) => { resolve = () => ok({ unitRate: 25, quantity: 10, lineTotal: 250 }); reject = fail; });
    return { promise, resolve, reject };
}
function resourceRequest() {
    let resolve!: (row: EstimateLineComponent) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<EstimateLineComponent>((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
function libraryControl(tree = view()) {
    return nodes(tree).find(e => e.type === "button" && (e.props["aria-label"] === "Save build-up copy to rate library" || JSON.stringify(e.props.children).includes("Save to rate library")))!.props;
}
function basisReview(parent = line) {
    return control(view(parent), "Confirm total resources for this priced quantity");
}
function rawApply(parent = line) {
    return control(view(parent), "Apply resource rate");
}
function confirmBasis(parent = line) {
    (basisReview(parent).onChange as (event: unknown) => void)({ target: { checked: true } });
}
describe("priced quantity resource review", () => {
    it("opens unreviewed without changing resources or prices", () => {
        const tree = view();
        expect(basisReview().checked).toBe(false); expect(rawApply().disabled).toBe(true);
        expect(renderToStaticMarkup(tree)).toContain("Review total resources before Apply");
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    });
    it("reviewing is view-only; only explicit Apply changes the line price", async () => {
        (rawApply().onClick as () => void)(); expect(replay.apply).not.toHaveBeenCalled();
        confirmBasis(); expect(basisReview().checked).toBe(true);
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        (rawApply().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.apply).toHaveBeenCalledExactlyOnceWith("line", 25, 10);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25, 10, 250);
    });
    it("requires a fresh review after quantity changes without rescaling total resources", async () => {
        confirmBasis(); const resized = { ...line, quantity: 20, line_total: 500 };
        expect(basisReview(resized).checked).toBe(false); expect(rawApply(resized).disabled).toBe(true);
        (rawApply(resized).onClick as () => void)(); expect(replay.apply).not.toHaveBeenCalled();
        expect(control(view(resized), "Total resource quantity: Boards").value).toBe(20);
        expect(control(view(resized), "Total resource quantity: Fitter").value).toBe(2);
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        confirmBasis(resized); (rawApply(resized).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.apply).toHaveBeenCalledExactlyOnceWith("line", 12.5, 20);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 12.5, 20, 250);
    });
    it("invalidates review when the priced unit changes, with no conversion or save", () => {
        confirmBasis(); expect(basisReview({ ...line, unit: "nr" }).checked).toBe(false);
        expect(rawApply({ ...line, unit: "nr" }).disabled).toBe(true);
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
    });
    it("invalidates review immediately for edited resources, including an Apply handler from the earlier render", async () => {
        confirmBasis(); const click = rawApply().onClick as () => void;
        (control(view(), "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "30" } });
        click(); expect(replay.apply).not.toHaveBeenCalled(); await Promise.all(replay.tasks);
        expect(basisReview().checked).toBe(false); expect(rawApply().disabled).toBe(true);
    });
    it("lets the contractor withdraw review without a database request", () => {
        confirmBasis(); (basisReview().onChange as (e: unknown) => void)({ target: { checked: false } });
        expect(rawApply().disabled).toBe(true); expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
    });
    it("does not restore a review from another open panel or assume saved legacy rows were reviewed", () => {
        confirmBasis(); replay.slots = []; replay.cursor = 0;
        expect(basisReview({ ...line, quantity: 20 }).checked).toBe(false);
        expect(rawApply({ ...line, quantity: 20 }).disabled).toBe(true);
        expect(replay.apply).not.toHaveBeenCalled();
    });
    it("review cannot override the existing pending save fence", () => {
        replay.pending = true;
        expect(basisReview().disabled).toBe(true); confirmBasis();
        expect(basisReview().checked).toBe(false); (rawApply().onClick as () => void)();
        expect(replay.apply).not.toHaveBeenCalled();
    });
    it("keeps the same review when only the per-unit view is toggled, with no save or conversion", () => {
        confirmBasis(); enterPerUnit();
        expect(basisReview().checked).toBe(true); expect(rawApply().disabled).toBe(false);
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    });
    it("preserves the existing zero-quantity rule rather than inventing a positive-only policy", async () => {
        const zero = { ...line, quantity: 0, line_total: 0 };
        confirmBasis(zero); (rawApply(zero).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.apply).toHaveBeenCalledExactlyOnceWith("line", 0, 0);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 0, 0, 0);
    });
});
describe("resource library copy feedback", () => {
    beforeEach(() => { vi.stubGlobal("window", { prompt: vi.fn().mockReturnValue("Cupboards") }); });
    afterEach(() => { vi.unstubAllGlobals(); });
    it("does not save on viewing and treats prompt cancellation or whitespace as no request", () => {
        view(); expect(replay.library).not.toHaveBeenCalled();
        vi.mocked(window.prompt).mockReturnValueOnce(null).mockReturnValueOnce("   ");
        (libraryControl().onClick as () => void)(); (libraryControl().onClick as () => void)();
        expect(replay.library).not.toHaveBeenCalled();
    });
    it("fences duplicate clicks immediately and confirms only after the stored copy returns", async () => {
        let resolve!: (value: { id: string; name: string }) => void;
        replay.library.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const click = libraryControl().onClick as () => void;
        click(); click(); expect(replay.library).toHaveBeenCalledOnce();
        expect(renderToStaticMarkup(view())).toContain("Saving build-up copy");
        resolve({ id: "copy", name: "Cupboards" }); await Promise.all(replay.tasks);
        expect(renderToStaticMarkup(view())).toContain("Build-up copy saved to rate library");
        expect(changed).not.toHaveBeenCalled(); expect(applied).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
    });
    it("catches rejection, labels uncertainty and does not blindly retry an insert", async () => {
        replay.library.mockRejectedValueOnce(new Error("Response lost"));
        (libraryControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.thrown).toEqual([]);
        expect(renderToStaticMarkup(view())).toMatch(/Library save not confirmed[\s\S]*may already have saved/);
        expect(libraryControl().disabled).toBe(true);
        (libraryControl().onClick as () => void)(); expect(replay.library).toHaveBeenCalledOnce();
    });
    it("does not claim success if a missing confirmation slips through", async () => {
        replay.library.mockResolvedValueOnce(undefined);
        (libraryControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(renderToStaticMarkup(view())).toContain("Library save not confirmed");
    });
    it("preserves an uncertain library acknowledgement on panel remount without blocking resource pricing", () => {
        replay.cursor = 0;
        const tree = BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, librarySaveState: "uncertain" });
        expect(renderToStaticMarkup(tree)).toContain("Library save not confirmed");
        expect(libraryControl(tree).disabled).toBe(true);
        expect(nodes(tree).find(e => e.type === "fieldset")!.props.disabled).toBe(false);
    });
    it("reports library pending and uncertain state separately from resource save acknowledgement", async () => {
        const status = vi.fn(); replay.library.mockRejectedValueOnce(new Error("Response lost"));
        replay.cursor = 0;
        const tree = BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, onLibrarySaveStateChanged: status });
        (libraryControl(tree).onClick as () => void)();
        expect(status).toHaveBeenCalledWith("line", "saving"); await Promise.all(replay.tasks);
        expect(status).toHaveBeenLastCalledWith("line", "uncertain"); expect(changed).not.toHaveBeenCalled();
    });
    it("submits total-for-line resources without converting quantities to per-unit recipes", async () => {
        replay.library.mockResolvedValueOnce({ id: "copy", name: "Cupboards" });
        (libraryControl(enterPerUnit()).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.library).toHaveBeenCalledExactlyOnceWith("org", "Cupboards", "m2", "Carpentry", components.map(c => ({ type: c.component_type, description: c.description, quantity: c.quantity, unit: c.unit, unit_rate: c.unit_rate, manhours_per_unit: c.manhours_per_unit })), 25, 8);
        expect(replay.update).not.toHaveBeenCalled(); expect(applied).not.toHaveBeenCalled();
    });
    it("pauses resource writes and Apply immediately while saving a library copy", async () => {
        let resolve!: (value: { id: string; name: string }) => void;
        replay.library.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const tree = view(); const edit = control(tree, "Resource rate: Boards").onChange as (e: unknown) => void;
        (libraryControl(tree).onClick as () => void)();
        edit({ target: { value: "99" } }); (applyControl().onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
        expect(nodes(view()).find(e => e.type === "fieldset")!.props.disabled).toBe(true);
        resolve({ id: "copy", name: "Cupboards" }); await Promise.all(replay.tasks);
        expect(nodes(view()).find(e => e.type === "fieldset")!.props.disabled).toBe(false);
    });
    it("does not label later edits as part of the confirmed saved copy", async () => {
        replay.library.mockResolvedValueOnce({ id: "copy", name: "Cupboards" });
        (libraryControl().onClick as () => void)(); await Promise.all(replay.tasks);
        (control(view(), "Resource rate: Boards").onChange as (e: unknown) => void)({ target: { value: "3" } });
        expect(replay.update).not.toHaveBeenCalled();
        (control(view(), "Save resource rate: Boards").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(renderToStaticMarkup(view())).toContain("newer changes are not saved to the library");
        expect(replay.library).toHaveBeenCalledOnce();
    });
});
describe("resource rate acknowledgement", () => {
    it("checks the parent pending fence at click time, not only the rendered disabled flag", () => {
        confirmBasis();
        replay.cursor = 0;
        const canApply = vi.fn().mockReturnValue(false);
        const tree = BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, canApplyRate: canApply });
        const apply = nodes(tree).find(e => e.props["aria-label"] === "Apply resource rate")!;
        (apply.props.onClick as () => void)();
        expect(canApply).toHaveBeenCalledOnce(); expect(replay.apply).not.toHaveBeenCalled();
    });

    it("notifies its parent while Apply is in flight and releases the fence after failure", async () => {
        confirmBasis();
        replay.cursor = 0; const changedState = vi.fn();
        const request = deferred(); replay.apply.mockReturnValueOnce(request.promise);
        const tree = BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, onApplyPendingChanged: changedState });
        (nodes(tree).find(e => e.props["aria-label"] === "Apply resource rate")!.props.onClick as () => void)();
        expect(changedState).toHaveBeenCalledExactlyOnceWith("line", true);
        request.reject(new Error("Response lost")); await Promise.all(replay.tasks);
        expect(changedState).toHaveBeenLastCalledWith("line", false);
        expect(applied).not.toHaveBeenCalled();
    });
    it("does not edit resources or Apply against a pending parent quantity save", () => {
        replay.cursor = 0;
        const tree = BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, priceSavePending: true });
        expect(nodes(tree).find(e => e.type === "fieldset")!.props.disabled).toBe(true);
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "99" } });
        const apply = nodes(tree).find(e => e.props["aria-label"] === "Apply resource rate")!;
        expect(apply.props.disabled).toBe(true); (apply.props.onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
        expect(changed).not.toHaveBeenCalled();
    });
    it("retains confirmed quantity edits while explicitly saving another row's rate", async () => {
        const tree = view();
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "12" } });
        expect(replay.update).not.toHaveBeenCalled();
        (control(view(), "Save resource quantity: Boards").onClick as () => void)();
        (control(tree, "Resource rate: Fixings").onChange as (e: unknown) => void)({ target: { value: "2" } });
        expect(control(view(), "Resource rate: Fixings").value).toBe(1);
        await Promise.all(replay.tasks);
        (control(view(), "Resource rate: Fixings").onChange as (e: unknown) => void)({ target: { value: "2" } });
        expect(replay.update).toHaveBeenCalledTimes(1);
        (control(view(), "Save resource rate: Fixings").onClick as () => void)();
        await Promise.all(replay.tasks);
        expect(control(view(), "Total resource quantity: Boards").value).toBe(12);
        expect(changed.mock.lastCall?.[1]).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "boards", quantity: 12 }),
            expect.objectContaining({ id: "fixings", unit_rate: 2 }),
        ]));
        await Promise.all(replay.tasks);
    });

    it("sends resource saves in order and fences Apply immediately before a rerender", async () => {
        const first = resourceRequest(); replay.update.mockReturnValueOnce(first.promise);
        const tree = view(); const apply = applyControl().onClick as () => void;
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "12" } });
        (control(view(), "Save resource quantity: Boards").onClick as () => void)();
        (control(tree, "Total resource quantity: Fixings").onChange as (e: unknown) => void)({ target: { value: "14" } });
        expect(control(view(), "Total resource quantity: Fixings").value).toBe(10);
        expect(replay.update).toHaveBeenCalledTimes(1);
        apply(); expect(replay.apply).not.toHaveBeenCalled();
        first.resolve({ ...components[0], quantity: 12, line_total: 24 }); await Promise.all(replay.tasks);
        (control(view(), "Total resource quantity: Fixings").onChange as (e: unknown) => void)({ target: { value: "14" } });
        (control(view(), "Save resource quantity: Fixings").onClick as () => void)();
        await Promise.all(replay.tasks);
        expect(replay.update).toHaveBeenNthCalledWith(2, "fixings", { quantity: 14 });
    });

    it("retains an uncertain quantity draft and refuses other-row writes", async () => {
        const first = resourceRequest(); replay.update.mockReturnValueOnce(first.promise);
        const tree = view();
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "12" } });
        (control(view(), "Save resource quantity: Boards").onClick as () => void)();
        (control(tree, "Total resource quantity: Fixings").onChange as (e: unknown) => void)({ target: { value: "14" } });
        first.reject(new Error("Response lost")); await Promise.all(replay.tasks);
        expect(control(view(), "Total resource quantity: Boards").value).toBe("12");
        expect(control(view(), "Total resource quantity: Fixings").value).toBe(10);
        expect(replay.update).toHaveBeenCalledTimes(1);
        expect(renderToStaticMarkup(view())).toContain("Resource save not confirmed");
        expect(applyControl().disabled).toBe(true);
        (applyControl().onClick as () => void)(); expect(replay.apply).not.toHaveBeenCalled();
    });

    it("fences rate edits until the older quantity save confirms, then preserves both values", async () => {
        const first = resourceRequest(); replay.update.mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce({ ...components[0], quantity: 12, unit_rate: 3, line_total: 36 });
        const tree = view();
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "12" } });
        (control(view(), "Save resource quantity: Boards").onClick as () => void)();
        (control(tree, "Resource rate: Boards").onChange as (e: unknown) => void)({ target: { value: "3" } });
        expect(control(view(), "Resource rate: Boards").value).toBe(2);
        first.resolve({ ...components[0], quantity: 12, line_total: 24 });
        await Promise.all(replay.tasks);
        (control(view(), "Resource rate: Boards").onChange as (e: unknown) => void)({ target: { value: "3" } });
        expect(replay.update).toHaveBeenCalledTimes(1);
        (control(view(), "Save resource rate: Boards").onClick as () => void)();
        await Promise.all(replay.tasks);
        expect(control(view(), "Total resource quantity: Boards").value).toBe(12);
        expect(control(view(), "Resource rate: Boards").value).toBe(3);
        expect(changed.mock.lastCall?.[1]).toContainEqual(expect.objectContaining({ id: "boards", line_total: 36 }));
        expect(renderToStaticMarkup(view())).toContain("Resource saves confirmed");
    });

    it("uses stored resource quantities and generated totals after a confirmed edit", async () => {
        replay.update.mockResolvedValueOnce({ ...components[0], quantity: 12.1234, unit_rate: 2.12, line_total: 25.70 });
        (control(view(), "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "12.123456" } });
        (control(view(), "Save resource quantity: Boards").onClick as () => void)();
        await Promise.all(replay.tasks);
        expect(control(view(), "Total resource quantity: Boards").value).toBe(12.1234);
        expect(changed.mock.lastCall?.[1]).toContainEqual(expect.objectContaining({ id: "boards", line_total: 25.70 }));
    });

    it("fences deletion while a numeric draft saves, then removes the acknowledged row explicitly", async () => {
        const first = resourceRequest(); replay.update.mockReturnValueOnce(first.promise);
        replay.remove.mockResolvedValueOnce(undefined);
        const tree = view();
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "12" } });
        (control(view(), "Save resource quantity: Boards").onClick as () => void)();
        (control(tree, "Remove resource: Boards").onClick as () => void)();
        expect(replay.remove).not.toHaveBeenCalled();
        first.resolve({ ...components[0], quantity: 12, line_total: 24 }); await Promise.all(replay.tasks);
        (control(view(), "Remove resource: Boards").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.remove).toHaveBeenCalledExactlyOnceWith("boards");
        expect(nodes(view()).some(e => e.props["data-resource-row"] === "boards")).toBe(false);
    });

    it("keeps a failed removal uncertain and blocks Apply instead of claiming rollback", async () => {
        replay.remove.mockRejectedValueOnce(new Error("Response lost"));
        (control(view(), "Remove resource: Boards").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(renderToStaticMarkup(view())).toContain("Resource save not confirmed");
        expect(applyControl().disabled).toBe(true);
        expect(replay.thrown).toEqual([]);
    });

    it("blocks a reopened panel when its parent retains an uncertain resource save", () => {
        replay.cursor = 0;
        const tree = BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, saveBlocked: true });
        expect(renderToStaticMarkup(tree)).toContain("Resource save not confirmed");
        (control(tree, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "99" } });
        expect(replay.update).not.toHaveBeenCalled();
        const apply = nodes(tree).find(e => e.props["aria-label"] === "Apply resource rate")!;
        expect(apply.props.disabled).toBe(true);
        (apply.props.onClick as () => void)(); expect(replay.apply).not.toHaveBeenCalled();
    });

    it("waits for the existing action before reporting an applied price", async () => {
        const request = deferred(); replay.apply.mockReturnValueOnce(request.promise);
        (applyControl().onClick as () => void)();
        expect(replay.apply).toHaveBeenCalledExactlyOnceWith("line", 25, 10);
        expect(applied).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        expect(applyControl().disabled).toBe(true);
        request.resolve(); await Promise.all(replay.tasks);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25, 10, 250);
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
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25, 10, 250);
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

    it("acknowledges the submitted snapshot and fences quantity edits until Apply completes", async () => {
        const request = deferred(); replay.apply.mockReturnValueOnce(request.promise);
        (applyControl().onClick as () => void)();
        const quantity = control(view(), "Total resource quantity: Boards");
        (quantity.onChange as (e: unknown) => void)({ target: { value: "30" } });
        expect(applied).not.toHaveBeenCalled();
        expect(control(view(), "Total resource quantity: Boards").value).toBe(20);
        request.resolve(); await Promise.all(replay.tasks);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 25, 10, 250);
        (control(view(), "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "30" } });
        (control(view(), "Save resource quantity: Boards").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(renderToStaticMarkup(view())).toContain("Resource changes need applying");
        (applyControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.apply).toHaveBeenLastCalledWith("line", 27, 10);
        expect(applied).toHaveBeenLastCalledWith("line", 27, 10, 270);
    });

    it("forwards the stored rate and total from Apply rather than its local preview", async () => {
        replay.apply.mockResolvedValueOnce({ unitRate: 24.99, quantity: 10, lineTotal: 249.87 });
        (applyControl().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(applied).toHaveBeenCalledExactlyOnceWith("line", 24.99, 10, 249.87);
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

    it("keeps total-quantity maths while requiring explicit confirmation", async () => {
        const input = control(view(), "Total resource quantity: Boards");
        (input.onChange as (e: unknown) => void)({ target: { value: "12" } });
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        (control(view(), "Save resource quantity: Boards").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.update).toHaveBeenCalledExactlyOnceWith("boards", { quantity: 12 });
        expect(changed).toHaveBeenLastCalledWith("line", expect.any(Array), 23.4);
    });

    it("retains attempted edits but blocks Apply after an uncertain per-unit save", async () => {
        replay.update.mockRejectedValueOnce(new Error("Not saved"));
        const input = control(enterPerUnit(), "Quantity per 1 m2: Boards");
        (input.onBlur as (e: unknown) => void)({ target: { value: "3" } });
        await Promise.all(replay.tasks);
        expect(control(view(), "Quantity per 1 m2: Boards").defaultValue).toBe(3);
        expect(renderToStaticMarkup(view())).toContain("Resource save not confirmed");
        expect(applyControl().disabled).toBe(true);
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
