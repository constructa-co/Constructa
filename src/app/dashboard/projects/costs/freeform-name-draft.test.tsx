import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { EstimateLine, EstimateLineComponent, RateBuildup } from "./types";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: false, tasks: [] as Promise<unknown>[], cleanups: [] as (() => void)[], add: vi.fn(), update: vi.fn(), remove: vi.fn(), apply: vi.fn(), library: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = replay.cursor++;
        if (!(i in replay.slots)) replay.slots[i] = typeof initial === "function" ? initial() : initial;
        return [replay.slots[i], (value: unknown) => { replay.slots[i] = typeof value === "function" ? value(replay.slots[i]) : value; }];
    },
    useRef: (initial: unknown) => {
        const i = replay.cursor++;
        if (!(i in replay.slots)) replay.slots[i] = { current: initial };
        return replay.slots[i];
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
        const i = replay.cursor++;
        const previous = replay.slots[i] as unknown[] | undefined;
        if (!previous || deps.some((v, index) => !Object.is(v, previous[index]))) {
            replay.slots[i] = deps;
            const cleanup = effect();
            if (cleanup) replay.cleanups.push(cleanup);
        }
    },
    useTransition: () => [replay.pending, (callback: () => unknown) => {
        const task = callback();
        if (task instanceof Promise) replay.tasks.push(task);
    }],
}));
vi.mock("./actions", () => ({ addComponentAction: replay.add, updateComponentAction: replay.update, deleteComponentAction: replay.remove, updateLineBuiltUpRateAction: replay.apply, saveRateBuildupAction: replay.library }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import BuildUpPanel from "./build-up-panel";

const source: RateBuildup = { id: "saved", name: "Saved cupboard resources", unit: "m2", trade_section: "Carpentry", built_up_rate: 25, total_manhours_per_unit: 8, components: [
    { type: "material", description: "Boards", quantity: 20, unit: "nr", unit_rate: 2, manhours_per_unit: 0 },
    { type: "labour", description: "Fitter", quantity: 2, unit: "day", unit_rate: 100, manhours_per_unit: 8 },
] };
const baseLine: EstimateLine = { id: "line", estimate_id: "estimate", description: "New cupboards", quantity: 50, unit: "m2", unit_rate: 7, line_total: 350, trade_section: "Carpentry", line_type: "general", pricing_mode: "buildup", estimate_line_components: [saved({ id: "sub", component_type: "subcontract", description: "Specialist package", quantity: 2.125, unit_rate: 123.4567, line_total: 262.3454875, manhours_per_unit: 0.375, total_manhours: 0.796875 })] };
const changed = vi.fn(), applied = vi.fn(), state = vi.fn(), parentGuard = vi.fn(), draftState = vi.fn();
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view(patch: Partial<Parameters<typeof BuildUpPanel>[0]> = {}) {
    replay.cursor = 0;
    return BuildUpPanel({ line, orgId: "org", labourRates: [], rateBuildups: [source], materialLibrary: [], preferredTrades: [], onComponentsChanged: changed, onRateApplied: applied, onSaveStateChanged: state, canApplyRate: parentGuard, onDraftChanged: draftState, ...patch });
}
function control(tree: unknown, label: string) {
    const node = nodes(tree).find(e => e.props["aria-label"] === label);
    expect(node, label).toBeDefined(); return node!.props;
}
function saved(data: Record<string, unknown>): EstimateLineComponent {
    return { id: "new-row", estimate_line_id: "line", component_type: "material", description: "Boards", quantity: 20, unit: "nr", unit_rate: 2, line_total: 40, manhours_per_unit: 0, total_manhours: 0, sort_order: 0, ...data };
}
beforeEach(() => {
    replay.slots = []; replay.cursor = 0; replay.pending = false; replay.tasks = []; replay.cleanups = [];
    for (const fn of [replay.add, replay.update, replay.remove, replay.apply, replay.library, changed, applied, state, parentGuard, draftState]) fn.mockReset();
    parentGuard.mockReturnValue(true);
    replay.add.mockImplementation(async (_id, data) => saved(data));
});

let line = baseLine;
let row = line.estimate_line_components[0];
let nameLabel = "consultancy";
const input = (tree = view()) => nodes(tree).find(node => node.type === "input" && String(node.props["aria-label"]).startsWith("Resource description:"))!.props;
const saveName = (tree = view()) => control(tree, `Save ${nameLabel} name: Specialist package`);
const cancelName = (tree = view()) => control(tree, `Cancel ${nameLabel} name: Specialist package`);
const editName = (value: string) => { (input().onChange as (event: unknown) => void)({ target: { value } }); return view(); };
const click = (props: Record<string, unknown>) => (props.onClick as () => void)();
beforeEach(() => {
    replay.update.mockImplementation(async (_id, updates) => ({ ...row, ...updates }));
    vi.stubGlobal("window", { prompt: vi.fn(() => "Test copy") });
});
afterEach(() => vi.unstubAllGlobals());

describe.each(["consultancy", "temp_works"] as const)("explicit saved %s name draft", type => {
    beforeEach(() => {
        row = { ...baseLine.estimate_line_components[0], component_type: type };
        line = { ...baseLine, estimate_line_components: [row] };
        nameLabel = type === "temp_works" ? "temporary works" : type;
    });
    it("keeps the saved name until typing,with no added blur/length/blank policy", () => {
        expect(input().value).toBe(row.description); expect(input().onBlur).toBeUndefined(); expect(input().maxLength).toBeUndefined();
        expect(nodes(view()).some(node => node.props["data-resource-name-draft"])).toBe(false);
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    });
    it("typing and Cancel make no writes or component/financial changes", () => {
        const before = JSON.stringify(line); const tree = editName("Draft specialist");
        expect(input(tree).value).toBe("Draft specialist"); expect(renderToStaticMarkup(tree)).toContain(`${type === "consultancy" ? "Consultancy" : "Temporary works"} name not saved`);
        expect(renderToStaticMarkup(tree)).toContain("Existing library copies are unchanged");
        expect(changed).not.toHaveBeenCalled(); expect(replay.update).not.toHaveBeenCalled(); expect(draftState).toHaveBeenLastCalledWith("line", true);
        click(cancelName(tree)); expect(input().value).toBe(row.description); expect(draftState).toHaveBeenLastCalledWith("line", false);
        expect(JSON.stringify(line)).toBe(before); expect(replay.update).not.toHaveBeenCalled();
    });
    it.each(["Reviewed package", "", " \n ", "<script>literal</script>", "x".repeat(1000)])("saves exact raw description under existing permissive text contract %s", async name => {
        const tree = editName(name); click(saveName(tree)); await Promise.all(replay.tasks);
        expect(replay.update).toHaveBeenCalledExactlyOnceWith("sub", { description: name });
        expect(changed).toHaveBeenLastCalledWith("line", [{ ...row, description: name }], row.quantity * row.unit_rate / line.quantity);
        expect(input().value).toBe(name); expect(draftState).toHaveBeenLastCalledWith("line", false);
        expect(replay.apply).not.toHaveBeenCalled(); expect(applied).not.toHaveBeenCalled();
    });
    it("does not write an unchanged confirmed name", () => {
        const tree = editName(row.description); click(saveName(tree)); expect(replay.update).not.toHaveBeenCalled();
        expect(nodes(view()).some(node => node.props["data-resource-name-draft"])).toBe(false); expect(draftState).toHaveBeenLastCalledWith("line", false);
    });
    it("waits for acknowledgement and fences duplicate Save,typing,Cancel and old other-write handlers", async () => {
        const old = view(), tree = editName("Submitted"), save = saveName(tree).onClick as () => void;
        let resolve!: (value: unknown) => void; replay.update.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        save(); save(); editName("Later"); click(cancelName());
        (control(old, "Resource rate: Specialist package").onChange as (event: unknown) => void)({ target: { value: "500" } });
        (control(old, "Total resource quantity: Specialist package").onChange as (event: unknown) => void)({ target: { value: "10" } });
        click(control(old, "Remove resource: Specialist package")); click(control(old, "Apply resource rate"));
        (control(old, "Build-up to review").onChange as (event: unknown) => void)({ target: { value: "saved" } });
        expect(replay.update).toHaveBeenCalledOnce(); expect(replay.remove).not.toHaveBeenCalled(); expect(replay.add).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
        expect(input().value).toBe("Submitted"); expect(input().disabled).toBe(true); expect(cancelName().disabled).toBe(true); expect(changed).not.toHaveBeenCalled();
        resolve({ ...row, description: "Submitted" }); await Promise.all(replay.tasks);
        expect(input().value).toBe("Submitted"); expect(changed).toHaveBeenCalledOnce();
        expect(state).toHaveBeenLastCalledWith("line", "confirmed");
    });
    it.each(["throw", "missing", "wrongId", "wrongLine", "wrongType", "differentName"])("retains an unconfirmed %s draft without blind retry or Cancel loss", async mode => {
        const tree = editName("Keep draft"), save = saveName(tree).onClick as () => void;
        if (mode === "throw") replay.update.mockRejectedValueOnce(Error("Lost acknowledgement"));
        else replay.update.mockResolvedValueOnce(mode === "missing" ? null : { ...row, description: "Keep draft",
            ...(mode === "wrongId" ? { id: "other" } : mode === "wrongLine" ? { estimate_line_id: "other" } : mode === "wrongType" ? { component_type: type === "consultancy" ? "temp_works" : "consultancy" } : { description: "Different" }) });
        save(); await Promise.all(replay.tasks); save(); click(cancelName());
        expect(replay.update).toHaveBeenCalledOnce(); expect(input().value).toBe("Keep draft");
        expect(changed).not.toHaveBeenCalled(); expect(draftState).not.toHaveBeenCalledWith("line", false);
        expect(cancelName().disabled).toBe(true); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it.each([{ quantity: 100 }, { id: "another-line" }, { unit: "nr" }, { estimate_line_components: [{ ...row, description: "Changed source" }] }])("retains text and refuses stale line/resource contexts %j", patch => {
        const tree = editName("Draft"), oldSave = saveName(tree).onClick as () => void;
        const changedLine = { ...line, ...patch }; view({ line: changedLine }); oldSave();
        expect(replay.update).not.toHaveBeenCalled(); expect(input(view({ line: changedLine })).value).toBe("Draft");
    });
    it("refuses old entry handlers after context changes or unmount", () => {
        const old = input().onChange as (event: unknown) => void;
        view({ line: { ...line, quantity: 100 } }); old({ target: { value: "Wrong context" } }); expect(draftState).not.toHaveBeenCalled();
        for (const cleanup of replay.cleanups) cleanup(); old({ target: { value: "After unmount" } });
        expect(replay.update).not.toHaveBeenCalled(); expect(draftState).not.toHaveBeenCalled();
    });
    it("does not publish a late in-flight response after unmount", async () => {
        const tree = editName("Submitted"); let resolve!: (value: unknown) => void;
        replay.update.mockReturnValueOnce(new Promise(done => { resolve = done; })); click(saveName(tree));
        for (const cleanup of replay.cleanups) cleanup(); resolve({ ...row, description: "Submitted" }); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(draftState).not.toHaveBeenCalledWith("line", false);
    });
    it.each([{ priceSavePending: true }, { saveBlocked: true }, { librarySaveState: "saving" as const }])("does not open a draft behind existing save fences %j", patch => {
        const tree = view(patch); (input(tree).onChange as (event: unknown) => void)({ target: { value: "Blocked" } });
        expect(replay.update).not.toHaveBeenCalled(); expect(draftState).not.toHaveBeenCalled();
    });
    it("keeps numeric edits/Apply/library paused until Cancel closes the name draft", () => {
        const old = view(), tree = editName("Draft");
        expect(control(tree, "Resource rate: Specialist package").disabled).toBe(true);
        expect(control(tree, "Apply resource rate").disabled).toBe(true);
        expect(control(tree, "Build-up to review").disabled).toBe(true);
        click(cancelName(tree));
        (control(old, "Resource rate: Specialist package").onChange as (event: unknown) => void)({ target: { value: "321" } });
        expect(control(view(), "Save resource rate: Specialist package")).toBeDefined();
        expect(replay.update).not.toHaveBeenCalled();
    });
    it("escapes raw name drafts and keeps action buttons non-submitting", () => {
        const tree = editName("<script>literal</script>"); const html = renderToStaticMarkup(tree);
        expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
        expect(saveName(tree).type).toBe("button"); expect(cancelName(tree).type).toBe("button");
    });
});
