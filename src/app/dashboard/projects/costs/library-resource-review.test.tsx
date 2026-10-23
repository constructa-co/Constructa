import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { EstimateLine, EstimateLineComponent, RateBuildup } from "./types";
import type { ComponentType } from "@/types/domain";
import { estimateSuggestedPhases } from "@/lib/planner-phases";

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
const line: EstimateLine = { id: "line", estimate_id: "estimate", description: "New cupboards", quantity: 50, unit: "m2", unit_rate: 7, line_total: 350, trade_section: "Carpentry", line_type: "general", pricing_mode: "buildup", estimate_line_components: [] };
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
function choose(patch: Partial<Parameters<typeof BuildUpPanel>[0]> = {}) {
    (control(view(patch), "Build-up to review").onChange as (e: unknown) => void)({ target: { value: "saved" } });
    return view(patch);
}
function add(tree: unknown, index = 1, description = "Boards") {
    return control(tree, `Add reviewed resource ${index}: ${description}`);
}
function cancel(tree: unknown) {
    return nodes(tree).find(e => e.type === "button" && e.props.children === "Cancel library review")!.props;
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
describe("reviewed rate-library resource entry", () => {
    it("selection and Cancel never write or change prices", () => {
        const before = JSON.stringify({ source, line });
        const tree = choose();
        expect(renderToStaticMarkup(tree)).toContain("not a per-unit recipe");
        expect(renderToStaticMarkup(tree)).toContain("Total quantity: 20 nr");
        expect(renderToStaticMarkup(tree)).toContain("Resource rate: 2 per nr");
        (cancel(tree).onClick as () => void)();
        expect(nodes(view()).some(e => e.props["data-library-resource-review"])).toBe(false);
        for (const fn of [replay.add, replay.update, replay.remove, replay.apply, replay.library, changed, applied]) expect(fn).not.toHaveBeenCalled();
        expect(JSON.stringify({ source, line })).toBe(before);
    });
    it("adds only the chosen row with exact stored totals, then closes the consumed review", async () => {
        (add(choose()).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", { component_type: "material", description: "Boards", quantity: 20, unit: "nr", unit_rate: 2, manhours_per_unit: 0, sort_order: 0 });
        expect(changed).toHaveBeenLastCalledWith("line", [expect.objectContaining({ quantity: 20, line_total: 40 })], 0.8);
        expect(state).toHaveBeenNthCalledWith(1, "line", "saving"); expect(state).toHaveBeenLastCalledWith("line", "confirmed");
        expect(nodes(view()).some(e => e.props["data-library-resource-review"])).toBe(false);
        expect(replay.apply).not.toHaveBeenCalled(); expect(applied).not.toHaveBeenCalled();
    });
    it("allows a separately reviewed second resource without readding the first", async () => {
        (add(choose()).onClick as () => void)(); await Promise.all(replay.tasks);
        (add(choose(), 2, "Fitter").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledTimes(2);
        expect(replay.add).toHaveBeenLastCalledWith("line", expect.objectContaining({ component_type: "labour", quantity: 2, unit_rate: 100, manhours_per_unit: 8, sort_order: 1 }));
        expect(replay.apply).not.toHaveBeenCalled();
    });
    it("fences duplicate clicks immediately and cannot replay an old handler after confirmation", async () => {
        let resolve!: (row: EstimateLineComponent) => void;
        replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const click = add(choose()).onClick as () => void;
        click(); click(); expect(replay.add).toHaveBeenCalledOnce();
        expect(add(view()).disabled).toBe(true);
        resolve(saved({})); await Promise.all(replay.tasks); click();
        expect(replay.add).toHaveBeenCalledOnce();
    });
    it("an old Add handler cannot use a different newly selected source", () => {
        const click = add(choose()).onClick as () => void;
        const second = { ...source, id: "second" };
        const tree = view({ rateBuildups: [source, second] });
        (control(tree, "Build-up to review").onChange as (e: unknown) => void)({ target: { value: "second" } });
        click(); expect(replay.add).not.toHaveBeenCalled();
    });
    it.each(["quantity", "unit", "id", "estimate_id"] as const)("refuses a stale review when line %s changes", field => {
        const click = add(choose()).onClick as () => void;
        view({ line: { ...line, [field]: field === "quantity" ? 100 : "changed" } });
        click(); expect(replay.add).not.toHaveBeenCalled();
    });
    it("refuses altered or removed library sources without writes", () => {
        const click = add(choose()).onClick as () => void;
        view({ rateBuildups: [{ ...source, components: [{ ...source.components[0], quantity: 999 }] }] });
        click(); view({ rateBuildups: [] }); click();
        expect(replay.add).not.toHaveBeenCalled();
    });
    it.each([{ saveBlocked: true }, { priceSavePending: true }, { librarySaveState: "saving" as const }])("respects parent pending/uncertainty gates %j", patch => {
        const click = add(choose()).onClick as () => void;
        view(patch); click(); expect(replay.add).not.toHaveBeenCalled();
    });
    it("uses the fresh parent quantity-save gate before any rerender", () => {
        const click = add(choose()).onClick as () => void;
        parentGuard.mockReturnValue(false); click(); expect(replay.add).not.toHaveBeenCalled();
    });
    it("blocks stale reviews immediately after a local resource change", async () => {
        const click = add(choose()).onClick as () => void;
        const button = nodes(view()).find(e => e.type === "button" && JSON.stringify(e.props.children).includes("material"))!;
        (button.props.onClick as () => void)(); await Promise.all(replay.tasks);
        click(); expect(replay.add).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(view())).toContain("Not saved");
    });
    it.each([null, "reject", "wrong-line"])("retains uncertainty and never retries missing/failed acknowledgement %s", async mode => {
        if (mode === "reject") replay.add.mockRejectedValueOnce(new Error("lost response"));
        else replay.add.mockResolvedValueOnce(mode === "wrong-line" ? saved({ estimate_line_id: "other" }) : null);
        const click = add(choose()).onClick as () => void;
        click(); await Promise.all(replay.tasks); click();
        expect(replay.add).toHaveBeenCalledOnce(); expect(changed).not.toHaveBeenCalled();
        expect(state).toHaveBeenLastCalledWith("line", "uncertain");
        expect(renderToStaticMarkup(view())).toContain("Resource save not confirmed");
    });
    it("a late acknowledgement cannot apply to a different priced quantity", async () => {
        let resolve!: (row: EstimateLineComponent) => void;
        replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        (add(choose()).onClick as () => void)(); view({ line: { ...line, quantity: 100 } });
        resolve(saved({})); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it("rejects old handlers after unmount, including late acknowledgement", async () => {
        const click = add(choose()).onClick as () => void;
        for (const cleanup of replay.cleanups) cleanup();
        click(); expect(replay.add).not.toHaveBeenCalled();
        replay.slots = []; replay.cleanups = [];
        let resolve!: (row: EstimateLineComponent) => void;
        replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        (add(choose()).onClick as () => void)();
        for (const cleanup of replay.cleanups) cleanup();
        resolve(saved({})); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled();
        expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it("does not guess numeric values for invalid library rows", () => {
        const bad = { ...source, components: [{ ...source.components[0], unit_rate: Number.NaN }] };
        const tree = choose({ rateBuildups: [bad] }); expect(add(tree).disabled).toBe(true);
        (add(tree).onClick as () => void)(); expect(replay.add).not.toHaveBeenCalled();
    });
    it("retains real zero values without positive defaults or per-unit conversion", async () => {
        const zero = { ...source, components: [{ ...source.components[0], quantity: 0, unit_rate: 0, manhours_per_unit: 0 }] };
        (add(choose({ rateBuildups: [zero] })).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", expect.objectContaining({ quantity: 0, unit_rate: 0, manhours_per_unit: 0 }));
        expect(replay.apply).not.toHaveBeenCalled();
    });
});

function openManual(type = "material") {
    const button = nodes(view()).find(e => e.type === "button" && Array.isArray(e.props.children) && e.props.children[1] === type.replace("_", " "))!;
    expect(button).toBeDefined(); (button.props.onClick as () => void)();
    return view();
}
const manualFields = { description: "New resource name", quantity: "New resource total quantity", unit: "New resource unit", rate: "New resource rate", hours: "New resource hours" };
function fillManual(values: Partial<Record<keyof typeof manualFields, string>> = {}) {
    const fields = { description: "Boards", quantity: "20", unit: "nr", rate: "2", hours: "0", ...values };
    for (const [key, value] of Object.entries(fields)) (control(view(), manualFields[key as keyof typeof manualFields]).onChange as (e: unknown) => void)({ target: { value } });
    return view();
}
describe("explicit manual resource drafts", () => {
    it.each(["material", "labour", "plant", "consumable", "temp_works", "subcontract", "consultancy"])("opens %s with no guessed numbers or writes; Cancel only closes the draft", type => {
        const tree = openManual(type);
        for (const label of Object.values(manualFields)) expect(control(tree, label).value).toBe("");
        expect(control(tree, "Save new resource").disabled).toBe(true);
        expect(draftState).toHaveBeenLastCalledWith("line", true);
        (control(tree, "Cancel new resource").onClick as () => void)();
        expect(draftState).toHaveBeenLastCalledWith("line", false);
        expect(nodes(view()).some(e => e.props["aria-label"] === "Unsaved resource draft")).toBe(false);
        for (const fn of [replay.add, replay.update, replay.remove, replay.apply, replay.library, changed]) expect(fn).not.toHaveBeenCalled();
    });
    it("typing and blur do not write; explicit Save inserts one complete row", async () => {
        openManual(); const tree = fillManual();
        expect(replay.add).not.toHaveBeenCalled();
        expect(control(tree, "New resource rate").onBlur).toBeUndefined();
        expect(renderToStaticMarkup(tree)).toContain("Draft resource total: £40.00");
        (control(tree, "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", { component_type: "material", description: "Boards", quantity: 20, unit: "nr", unit_rate: 2, manhours_per_unit: 0, sort_order: 0 });
        expect(draftState).toHaveBeenLastCalledWith("line", false);
        expect(changed).toHaveBeenLastCalledWith("line", [expect.objectContaining({ description: "Boards" })], 0.8);
        expect(replay.apply).not.toHaveBeenCalled(); expect(applied).not.toHaveBeenCalled();
    });
    it.each(["", "-1", "Infinity", "bad"])("refuses invalid or missing numeric values %s without fallback", invalid => {
        openManual(); const tree = fillManual({ quantity: invalid });
        expect(control(tree, "Save new resource").disabled).toBe(true);
        (control(tree, "Save new resource").onClick as () => void)(); expect(replay.add).not.toHaveBeenCalled();
    });
    it("accepts explicit zero without substituting old quantity or labour hours defaults", async () => {
        openManual("labour"); const tree = fillManual({ quantity: "0", rate: "0", hours: "0" });
        (control(tree, "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", expect.objectContaining({ component_type: "labour", quantity: 0, unit_rate: 0, manhours_per_unit: 0 }));
    });
    it("uses server-stored precision,description and acknowledgement rather than the draft preview", async () => {
        openManual(); const tree = fillManual({ quantity: "2.123456", rate: "2.129" });
        replay.add.mockResolvedValueOnce(saved({ description: "Stored boards", quantity: 2.1235, unit_rate: 2.13, line_total: 4.52 }));
        (control(tree, "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledWith("line", expect.objectContaining({ quantity: 2.123456, unit_rate: 2.129 }));
        expect(changed.mock.lastCall?.[1]).toEqual([expect.objectContaining({ description: "Stored boards", quantity: 2.1235, unit_rate: 2.13, line_total: 4.52 })]);
    });
    it("fences duplicate Save and Cancel during an in-flight request", async () => {
        let resolve!: (row: EstimateLineComponent) => void;
        replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        openManual(); const tree = fillManual(); const click = control(tree, "Save new resource").onClick as () => void;
        click(); click(); (control(tree, "Cancel new resource").onClick as () => void)();
        expect(replay.add).toHaveBeenCalledOnce(); expect(control(view(), "Cancel new resource").disabled).toBe(true);
        expect(draftState).not.toHaveBeenCalledWith("line", false);
        resolve(saved({})); await Promise.all(replay.tasks); click(); expect(replay.add).toHaveBeenCalledOnce();
    });
    it.each([null, "reject"])("retains draft and uncertainty instead of blindly retrying an unconfirmed insert %s", async mode => {
        if (mode === "reject") replay.add.mockRejectedValueOnce(new Error("lost response")); else replay.add.mockResolvedValueOnce(null);
        openManual(); const tree = fillManual(); const click = control(tree, "Save new resource").onClick as () => void;
        click(); await Promise.all(replay.tasks); click();
        expect(replay.add).toHaveBeenCalledOnce(); expect(control(view(), "New resource name").value).toBe("Boards");
        expect(state).toHaveBeenLastCalledWith("line", "uncertain"); expect(changed).not.toHaveBeenCalled();
        expect(draftState).not.toHaveBeenCalledWith("line", false);
    });
    it("blocks existing resource edits,library loading and Apply while a draft is open", async () => {
        const row = saved({ id: "existing" });
        const patch = { line: { ...line, estimate_line_components: [row] } };
        view(patch);
        const old = view(patch);
        const oldEdit = control(old, "Total resource quantity: Boards").onChange as (e: unknown) => void;
        const button = nodes(old).find(e => e.type === "button" && Array.isArray(e.props.children) && e.props.children[1] === "material")!;
        (button.props.onClick as () => void)();
        oldEdit({ target: { value: "100" } });
        (control(old, "Build-up to review").onChange as (e: unknown) => void)({ target: { value: "saved" } });
        (control(old, "Apply resource rate").onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled(); expect(replay.add).not.toHaveBeenCalled();
        expect(control(view(patch), "Build-up to review").disabled).toBe(true);
    });
    it("refuses a stale line context and keeps typed values", () => {
        openManual(); const tree = fillManual(); const click = control(tree, "Save new resource").onClick as () => void;
        view({ line: { ...line, quantity: 100 } }); click();
        expect(replay.add).not.toHaveBeenCalled(); expect(control(view({ line: { ...line, quantity: 100 } }), "New resource name").value).toBe("Boards");
    });
    it("checks the current parent save gate and does not publish a late response after unmount", async () => {
        openManual(); const tree = fillManual(); const click = control(tree, "Save new resource").onClick as () => void;
        parentGuard.mockReturnValue(false); click(); expect(replay.add).not.toHaveBeenCalled(); parentGuard.mockReturnValue(true);
        let resolve!: (row: EstimateLineComponent) => void; replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        click(); for (const cleanup of replay.cleanups) cleanup(); resolve(saved({})); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
});

describe("reviewed manual per-priced-unit resource quantity", () => {
    function basis(value = "per-unit", tree = view()) {
        (control(tree, "New resource quantity basis").onChange as (e: unknown) => void)({ target: { value } });
        return view();
    }
    function draft(quantity = "2", type = "material") {
        openManual(type); fillManual({ quantity }); return basis();
    }
    it.each(["material", "labour", "plant", "consumable", "temp_works", "subcontract", "consultancy"])("saves one %s total only after explicit Save,without rate/hour inference", async type => {
        const tree = draft("0.15", type);
        expect(control(tree, "New resource per-unit quantity").value).toBe("0.15");
        expect(renderToStaticMarkup(tree)).toContain("Total for 50 m2: 7.5 nr");
        expect(replay.add).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
        (control(tree, "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", { component_type: type, description: "Boards", quantity: 7.5, unit: "nr", unit_rate: 2, manhours_per_unit: 0, sort_order: 0 });
        expect(changed.mock.lastCall?.[1]).toEqual([expect.objectContaining({ quantity: 7.5, unit_rate: 2, manhours_per_unit: 0 })]);
        for (const fn of [replay.apply, replay.update, replay.library, applied]) expect(fn).not.toHaveBeenCalled();
    });
    it("basis choice keeps typed fields and Cancel makes no write", () => {
        const tree = draft("2"), before = JSON.stringify(line);
        expect(control(tree, "New resource name").value).toBe("Boards");
        expect(control(tree, "New resource rate").value).toBe("2");
        expect(control(basis("total"), "New resource total quantity").value).toBe("2");
        expect(control(basis(), "New resource per-unit quantity").value).toBe("2");
        (control(view(), "Cancel new resource").onClick as () => void)();
        expect(replay.add).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled(); expect(JSON.stringify(line)).toBe(before);
    });
    it.each(["", "-1", "Infinity", "1e309", "0x10", "0.000001", "0.000002", "2000000"])("refuses invalid/non-storable conversion %j without rounding or requests", raw => {
        const tree = draft(raw);
        expect(control(tree, "Save new resource").disabled).toBe(true);
        (control(tree, "Save new resource").onClick as () => void)(); expect(replay.add).not.toHaveBeenCalled();
        expect(control(view(), "New resource per-unit quantity").value).toBe(raw);
    });
    it.each(["0", "0.00001"])("retains explicit zero or exactly storable four-decimal total from %s", async raw => {
        const tree = draft(raw); (control(tree, "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", expect.objectContaining({ quantity: Number(raw) * 50 }));
    });
    it.each([0, -1, Infinity, NaN])("refuses per-unit basis for invalid priced quantity %s", quantity => {
        const patch = { line: { ...line, quantity } };
        const add = nodes(view(patch)).find(e => e.type === "button" && Array.isArray(e.props.children) && e.props.children[1] === "material")!;
        (add.props.onClick as () => void)();
        (control(view(patch), "New resource quantity basis").onChange as (e: unknown) => void)({ target: { value: "per-unit" } });
        expect(control(view(patch), "New resource quantity basis").value).toBe("total");
        expect(replay.add).not.toHaveBeenCalled();
    });
    it("old Save cannot submit a newly selected basis or newer typed draft", () => {
        openManual(); const old = fillManual(); const click = control(old, "Save new resource").onClick as () => void;
        basis(); click(); expect(replay.add).not.toHaveBeenCalled();
        const newer = control(view(), "Save new resource").onClick as () => void;
        (control(view(), "New resource per-unit quantity").onChange as (e: unknown) => void)({ target: { value: "3" } });
        newer(); expect(replay.add).not.toHaveBeenCalled();
    });
    it.each([{ saveBlocked: true }, { priceSavePending: true }, { librarySaveState: "saving" as const }])("retains per-unit draft behind parent pending/uncertainty %j", patch => {
        const tree = draft(), click = control(tree, "Save new resource").onClick as () => void;
        view(patch); click(); expect(replay.add).not.toHaveBeenCalled();
        expect(control(view(patch), "New resource per-unit quantity").value).toBe("2");
    });
    it.each(["quantity", "unit", "id", "estimate_id"] as const)("retains and refuses a changed priced-line %s basis", field => {
        const tree = draft(), click = control(tree, "Save new resource").onClick as () => void;
        const patch = { line: { ...line, [field]: field === "quantity" ? 100 : "changed" } };
        view(patch); click();
        expect(replay.add).not.toHaveBeenCalled();
        expect(control(view(patch), "New resource per-unit quantity").value).toBe("2");
        expect(renderToStaticMarkup(view(patch))).toContain("Total for 50 m2: 100 nr");
        expect(renderToStaticMarkup(view(patch))).toContain("The line changed");
    });
    it("checks parent gate,pending,duplicate and late-context acknowledgement before publishing", async () => {
        const tree = draft(), click = control(tree, "Save new resource").onClick as () => void;
        parentGuard.mockReturnValue(false); click(); expect(replay.add).not.toHaveBeenCalled(); parentGuard.mockReturnValue(true);
        let resolve!: (row: EstimateLineComponent) => void; replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        click(); click(); expect(replay.add).toHaveBeenCalledOnce();
        expect(control(view(), "Cancel new resource").disabled).toBe(true);
        view({ line: { ...line, quantity: 100 } }); resolve(saved({ quantity: 100 })); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it.each([{ quantity: 99.9999 }, { component_type: "labour" }, { unit: "day" }, { estimate_line_id: "other" }])("retains uncertain conversion on wrong acknowledgement %j", async patch => {
        replay.add.mockResolvedValueOnce(saved({ quantity: 100, ...patch }));
        const tree = draft(), click = control(tree, "Save new resource").onClick as () => void;
        click(); await Promise.all(replay.tasks); click();
        expect(replay.add).toHaveBeenCalledOnce(); expect(changed).not.toHaveBeenCalled();
        expect(control(view(), "Cancel new resource").disabled).toBe(true);
        (control(view(), "Cancel new resource").onClick as () => void)();
        expect(control(view(), "New resource per-unit quantity").value).toBe("2");
        expect(draftState).not.toHaveBeenCalledWith("line", false);
    });
    it("does not publish an acknowledgement after unmount", async () => {
        let resolve!: (row: EstimateLineComponent) => void; replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const tree = draft(); (control(tree, "Save new resource").onClick as () => void)();
        for (const cleanup of replay.cleanups) cleanup(); resolve(saved({ quantity: 100 })); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
});

describe("explicit resource Save and add another", () => {
    function saveNext(tree = view()) { return control(tree, "Save resource and add another"); }
    function acknowledgeParent() {
        const rows = changed.mock.lastCall![1] as EstimateLineComponent[];
        const patch = { line: { ...line, estimate_line_components: rows } };
        return { patch, tree: view(patch) };
    }
    it.each(["material", "labour", "plant", "consumable", "temp_works", "subcontract", "consultancy"])("confirms one %s then opens only a fresh blank same-type draft after exact parent refresh", async type => {
        openManual(type); const tree = fillManual();
        expect(renderToStaticMarkup(tree)).toContain(`Save resource and add another ${type === "temp_works" ? "temporary works" : type}`);
        (saveNext(tree).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", expect.objectContaining({ component_type: type, description: "Boards", quantity: 20, unit_rate: 2, manhours_per_unit: 0 }));
        expect(control(view(), "New resource name").value).toBe("Boards");
        expect(saveNext().disabled).toBe(true);
        expect(renderToStaticMarkup(view())).toContain("continuation not ready");
        const { tree: fresh } = acknowledgeParent();
        for (const label of Object.values(manualFields)) expect(control(fresh, label).value).toBe("");
        expect(control(fresh, "New resource quantity basis").value).toBe("total");
        expect(renderToStaticMarkup(fresh)).toContain(`New ${type.replace("_", " ")} resource`);
        expect(draftState).not.toHaveBeenCalledWith("line", false);
        expect(replay.add).toHaveBeenCalledOnce(); expect(replay.apply).not.toHaveBeenCalled(); expect(replay.library).not.toHaveBeenCalled();
    });
    it("does not copy a per-unit basis or quantities into the following draft", async () => {
        openManual("consultancy"); fillManual({ quantity: "0.15" });
        (control(view(), "New resource quantity basis").onChange as (e: unknown) => void)({ target: { value: "per-unit" } });
        (saveNext().onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledWith("line", expect.objectContaining({ component_type: "consultancy", quantity: 7.5 }));
        const { tree } = acknowledgeParent();
        expect(control(tree, "New resource quantity basis").value).toBe("total");
        expect(control(tree, "New resource total quantity").value).toBe("");
    });
    it("a second resource requires fresh input and its own explicit save;ordinary Save still closes", async () => {
        replay.add.mockImplementation(async (_id, data) => saved({ ...data, id: `saved-${replay.add.mock.calls.length}` }));
        openManual(); (saveNext(fillManual()).onClick as () => void)(); await Promise.all(replay.tasks);
        const { patch } = acknowledgeParent();
        for (const [key, value] of Object.entries({ description: "Fixings", quantity: "5", unit: "nr", rate: "1", hours: "0" })) {
            (control(view(patch), manualFields[key as keyof typeof manualFields]).onChange as (e: unknown) => void)({ target: { value } });
        }
        expect(replay.add).toHaveBeenCalledOnce();
        (control(view(patch), "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledTimes(2);
        expect(replay.add).toHaveBeenLastCalledWith("line", expect.objectContaining({ description: "Fixings", quantity: 5, unit_rate: 1, sort_order: 1 }));
        expect(draftState).toHaveBeenLastCalledWith("line", false);
        expect(nodes(view(patch)).some(e => e.props["aria-label"] === "Unsaved resource draft")).toBe(false);
        expect(replay.apply).not.toHaveBeenCalled();
    });
    it("old Save/Cancel handlers cannot replay or erase the next draft after confirmation", async () => {
        openManual(); const tree = fillManual(), click = saveNext(tree).onClick as () => void, cancel = control(tree, "Cancel new resource").onClick as () => void;
        click(); click(); expect(replay.add).toHaveBeenCalledOnce(); await Promise.all(replay.tasks);
        const { patch } = acknowledgeParent(); click(); cancel();
        expect(replay.add).toHaveBeenCalledOnce();
        expect(control(view(patch), "New resource name").value).toBe("");
        expect(draftState).not.toHaveBeenCalledWith("line", false);
        (control(view(patch), "Cancel new resource").onClick as () => void)();
        expect(draftState).toHaveBeenLastCalledWith("line", false);
    });
    it.each([null, "reject", "wrong-line", "wrong-type"])("retains typed work without continuation for unconfirmed %s", async mode => {
        if (mode === "reject") replay.add.mockRejectedValueOnce(new Error("response lost"));
        else replay.add.mockResolvedValueOnce(mode === null ? null : saved(mode === "wrong-line" ? { estimate_line_id: "other" } : { component_type: "labour" }));
        openManual(); const tree = fillManual(), click = saveNext(tree).onClick as () => void;
        click(); await Promise.all(replay.tasks); click();
        expect(replay.add).toHaveBeenCalledOnce(); expect(changed).not.toHaveBeenCalled();
        expect(control(view(), "New resource name").value).toBe("Boards");
        expect(draftState).not.toHaveBeenCalledWith("line", false); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it.each(["quantity", "unit", "id", "estimate_id"] as const)("does not advance when source %s changes before acknowledgement", async field => {
        let resolve!: (row: EstimateLineComponent) => void; replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        openManual(); (saveNext(fillManual()).onClick as () => void)();
        const patch = { line: { ...line, [field]: field === "quantity" ? 100 : "changed" } };
        view(patch); resolve(saved({})); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(control(view(patch), "New resource name").value).toBe("Boards");
        expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it("refuses unrelated parent rows or blocked parent state after a confirmed save", async () => {
        openManual(); (saveNext(fillManual()).onClick as () => void)(); await Promise.all(replay.tasks);
        const unrelated = { line: { ...line, estimate_line_components: [saved({ quantity: 999 })] } };
        expect(control(view(unrelated), "New resource name").value).toBe("Boards"); expect(saveNext(view(unrelated)).disabled).toBe(true);
        const { patch } = acknowledgeParent();
        expect(control(view({ ...patch, priceSavePending: true }), "New resource name").value).toBe("Boards");
        expect(replay.add).toHaveBeenCalledOnce(); expect(replay.apply).not.toHaveBeenCalled();
    });
    it("checks the fresh parent gate before write and again before continuation publication", async () => {
        openManual(); const tree = fillManual(), click = saveNext(tree).onClick as () => void;
        parentGuard.mockReturnValue(false); click(); expect(replay.add).not.toHaveBeenCalled(); parentGuard.mockReturnValue(true);
        let resolve!: (row: EstimateLineComponent) => void; replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        click(); parentGuard.mockReturnValue(false); resolve(saved({})); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(control(view(), "New resource name").value).toBe("Boards");
        expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it("does not publish or continue after unmount", async () => {
        let resolve!: (row: EstimateLineComponent) => void; replay.add.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        openManual(); (saveNext(fillManual()).onClick as () => void)();
        for (const cleanup of replay.cleanups) cleanup(); resolve(saved({})); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it("refuses an acknowledgement reusing an existing resource id", async () => {
        const row = saved({ id: "existing" });
        const patch = { line: { ...line, estimate_line_components: [row] } };
        const button = nodes(view(patch)).find(e => e.type === "button" && Array.isArray(e.props.children) && e.props.children[1] === "material")!;
        (button.props.onClick as () => void)();
        for (const [key, value] of Object.entries({ description: "Other boards", quantity: "2", unit: "nr", rate: "1", hours: "0" })) {
            (control(view(patch), manualFields[key as keyof typeof manualFields]).onChange as (e: unknown) => void)({ target: { value } });
        }
        replay.add.mockResolvedValueOnce(saved({ id: "existing" }));
        (saveNext(view(patch)).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
        expect(control(view(patch), "New resource name").value).toBe("Other boards");
    });
});

describe.each([
    { field: "quantity" as const, input: "Total resource quantity: Boards", label: "quantity", original: 20 },
    { field: "manhours_per_unit" as const, input: "Hours per resource unit: Boards", label: "hours", original: 8 },
])("saved resource $label draft", ({ field, input, label, original }) => {
    const row = saved({ id: "numeric-row", component_type: "labour", manhours_per_unit: 8, total_manhours: 160 });
    const parent = { ...line, estimate_line_components: [row] };
    const numberView = (patch: Partial<Parameters<typeof BuildUpPanel>[0]> = {}) => view({ line: parent, ...patch });
    const number = (tree = numberView()) => control(tree, input);
    const saveNumber = (tree = numberView()) => control(tree, `Save resource ${label}: Boards`);
    const cancelNumber = (tree = numberView()) => control(tree, `Cancel resource ${label}: Boards`);
    const edit = (value: string) => { (number().onChange as (e: unknown) => void)({ target: { value } }); return numberView(); };
    beforeEach(() => { replay.update.mockImplementation(async (_id, patch) => {
        const stored = { ...row, ...patch };
        return { ...stored, line_total: stored.quantity * stored.unit_rate, total_manhours: stored.quantity * stored.manhours_per_unit };
    }); });
    it.each(["", "-", "1e", "bad", "Infinity", "0x10"])("retains raw %s without a zero write or blur save", raw => {
        const tree = edit(raw);
        expect(number(tree).value).toBe(raw); expect(number(tree).onBlur).toBeUndefined();
        expect(saveNumber(tree).disabled).toBe(true); (saveNumber(tree).onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(tree)).toContain("Totals and labour hours still use the saved values");
        (cancelNumber(tree).onClick as () => void)(); expect(number().value).toBe(original);
        expect(draftState.mock.calls).toEqual([["line", true], ["line", false]]);
    });
    it.each(["0", "-2", "1e2", "2.123456"])("explicitly saves only the finite field %s without rounding or rescaling", async raw => {
        const tree = edit(raw); expect(replay.update).not.toHaveBeenCalled();
        (saveNumber(tree).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.update).toHaveBeenCalledExactlyOnceWith(row.id, { [field]: Number(raw) });
        const stored = { ...row, [field]: Number(raw) };
        expect(changed.mock.lastCall?.[1]).toEqual([{ ...stored, line_total: stored.quantity * stored.unit_rate, total_manhours: stored.quantity * stored.manhours_per_unit }]);
        expect(number().value).toBe(Number(raw)); expect(replay.apply).not.toHaveBeenCalled();
    });
    it("takes stored precision from acknowledgement rather than retaining an optimistic value", async () => {
        const stored = { ...row, [field]: 2.1235, line_total: 4.25, total_manhours: 42.47 };
        replay.update.mockResolvedValueOnce(stored); const tree = edit("2.123456");
        (saveNumber(tree).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(number().value).toBe(2.1235); expect(changed.mock.lastCall?.[1]).toEqual([stored]);
    });
    it("closes an unchanged confirmed number without a write", () => {
        const tree = edit(`${original}.000`); (saveNumber(tree).onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(number().value).toBe(original);
    });
    it("fences duplicate Save,pending Cancel and stale cross-field handlers", async () => {
        let resolve!: (row: EstimateLineComponent) => void;
        replay.update.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const old = numberView(); const tree = edit("3"), click = saveNumber(tree).onClick as () => void;
        (control(old, "Resource rate: Boards").onChange as (e: unknown) => void)({ target: { value: "99" } });
        (control(old, "Apply resource rate").onClick as () => void)();
        expect(control(numberView(), "Resource rate: Boards").value).toBe(2);
        click(); click(); (cancelNumber(tree).onClick as () => void)();
        expect(replay.update).toHaveBeenCalledOnce(); expect(cancelNumber().disabled).toBe(true);
        resolve({ ...row, [field]: 3 }); await Promise.all(replay.tasks); click();
        expect(replay.update).toHaveBeenCalledOnce(); expect(replay.apply).not.toHaveBeenCalled();
    });
    it.each([null, "reject", "other-row"])("retains raw text and uncertainty for %s acknowledgement", async mode => {
        if (mode === "reject") replay.update.mockRejectedValueOnce(new Error("Response lost"));
        else replay.update.mockResolvedValueOnce(mode === "other-row" ? { ...row, id: "other" } : null);
        const tree = edit("3"), click = saveNumber(tree).onClick as () => void;
        click(); await Promise.all(replay.tasks); click();
        expect(replay.update).toHaveBeenCalledOnce(); expect(number().value).toBe("3"); expect(changed).not.toHaveBeenCalled();
        expect(state).toHaveBeenLastCalledWith("line", "uncertain"); expect(draftState).not.toHaveBeenCalledWith("line", false);
    });
    it("retains a changed-context draft and refuses a fresh parent lock", () => {
        const tree = edit("3"), click = saveNumber(tree).onClick as () => void;
        parentGuard.mockReturnValue(false); click(); expect(replay.update).not.toHaveBeenCalled(); parentGuard.mockReturnValue(true);
        const changedParent = { ...parent, quantity: 100 }; numberView({ line: changedParent }); click();
        expect(replay.update).not.toHaveBeenCalled(); expect(number(numberView({ line: changedParent })).value).toBe("3");
    });
    it("does not publish a late acknowledgement after unmount", async () => {
        let resolve!: (row: EstimateLineComponent) => void; replay.update.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const tree = edit("3"); (saveNumber(tree).onClick as () => void)(); for (const cleanup of replay.cleanups) cleanup();
        resolve({ ...row, [field]: 3 }); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
    it("refuses a finite input whose derived resource total overflows", () => {
        const tree = edit("1e308"); expect(saveNumber(tree).disabled).toBe(true);
        (saveNumber(tree).onClick as () => void)(); expect(replay.update).not.toHaveBeenCalled();
    });
});

describe("explicit consultancy resources", () => {
    const kind: ComponentType = "consultancy";
    const consultant: EstimateLineComponent = { ...saved({}), component_type: kind, description: "Engineer review", quantity: 2, unit: "hr", unit_rate: 150, line_total: 300, manhours_per_unit: 4, total_manhours: 8 };
    it("copies consultancy through the actual panel library-save boundary without changing its type or hours", async () => {
        vi.stubGlobal("window", { prompt: vi.fn().mockReturnValue("Engineering") });
        try {
            replay.library.mockResolvedValueOnce({ id: "copy", name: "Engineering" });
            const tree = view({ line: { ...line, estimate_line_components: [consultant] } });
            (control(tree, "Save build-up copy to rate library").onClick as () => void)(); await Promise.all(replay.tasks);
            expect(replay.library).toHaveBeenCalledExactlyOnceWith("org", "Engineering", "m2", "Carpentry", [{ type: kind, description: "Engineer review", quantity: 2, unit: "hr", unit_rate: 150, manhours_per_unit: 4 }], 6, 0);
            expect(replay.apply).not.toHaveBeenCalled(); expect(replay.update).not.toHaveBeenCalled();
        } finally { vi.unstubAllGlobals(); }
    });
    it("saves contractor-entered consultancy without labour/rate/hour defaults or Apply", async () => {
        openManual(kind);
        const tree = fillManual({ description: consultant.description, quantity: "2", unit: "hr", rate: "150", hours: "4" });
        expect(renderToStaticMarkup(tree)).toContain("Consultancy is costed separately from labour");
        replay.add.mockResolvedValueOnce(consultant);
        (control(tree, "Save new resource").onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", { component_type: kind, description: "Engineer review", quantity: 2, unit: "hr", unit_rate: 150, manhours_per_unit: 4, sort_order: 0 });
        expect(changed).toHaveBeenLastCalledWith("line", [consultant], 6);
        expect(replay.apply).not.toHaveBeenCalled(); expect(replay.library).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(view())).toContain("consultancy");
        expect(control(view(), "Resource description: Engineer review").value).toBe("Engineer review");
    });
    it("reviews and adds a consultancy library resource without reclassification or rescaling", async () => {
        const consultancySource: RateBuildup = { ...source, components: [{ type: kind, description: consultant.description, quantity: 2, unit: "hr", unit_rate: 150, manhours_per_unit: 4 }] };
        const patch = { rateBuildups: [consultancySource] };
        const tree = choose(patch);
        expect(replay.add).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(tree)).toContain("not counted in labour-only totals");
        replay.add.mockResolvedValueOnce(consultant);
        (add(tree, 1, consultant.description).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.add).toHaveBeenCalledExactlyOnceWith("line", { component_type: kind, description: "Engineer review", quantity: 2, unit: "hr", unit_rate: 150, manhours_per_unit: 4, sort_order: 0 });
        expect(replay.apply).not.toHaveBeenCalled();
    });
    it("retains consultancy labels,stored prices and hours on reopen without treating them as labour", () => {
        const labour: EstimateLineComponent = { ...consultant, id: "labour", component_type: "labour", description: "Fitter", quantity: 1, unit_rate: 100, line_total: 100, manhours_per_unit: 3, total_manhours: 3 };
        const parent = { ...line, estimate_line_components: [consultant, labour] };
        const before = JSON.stringify(parent);
        const tree = view({ line: parent });
        expect(renderToStaticMarkup(tree)).not.toContain("11.0h");
        // The existing panel shows three labour hours,not the consultancy's eight.
        const header = nodes(tree).find(e => e.type === "div" && JSON.stringify(e.props.children).includes("Total manhours:"));
        expect(header).toBeDefined();
        expect(renderToStaticMarkup(tree)).toContain("3.0h");
        expect(control(tree, "Resource description: Engineer review").value).toBe("Engineer review");
        expect(JSON.stringify(parent)).toBe(before); expect(replay.add).not.toHaveBeenCalled(); expect(replay.update).not.toHaveBeenCalled();
    });
    it("retains the existing programme suggestion calculation and never rewrites a schedule on resource save", () => {
        // This asserts existing legacy effort behavior,not a newly approved labour policy.
        const plan = estimateSuggestedPhases({ estimate_lines: [{ quantity: 1, trade_section: "Design", estimate_line_components: [consultant] }] }, 5);
        expect(plan).toEqual([{ name: "Design", calculatedDays: 1, manualDays: null, manhours: 8, startOffset: 0 }]);
        expect(replay.add).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
    });
});

describe("saved resource rate drafts", () => {
    const row = saved({ id: "priced-row" });
    const parent = { ...line, estimate_line_components: [row] };
    const rateView = (patch: Partial<Parameters<typeof BuildUpPanel>[0]> = {}) => view({ line: parent, ...patch });
    const rate = (tree = rateView()) => control(tree, "Resource rate: Boards");
    const saveRate = (tree = rateView()) => control(tree, "Save resource rate: Boards");
    const cancelRate = (tree = rateView()) => control(tree, "Cancel resource rate: Boards");
    const typeRate = (value: string) => { (rate().onChange as (e: unknown) => void)({ target: { value } }); return rateView(); };
    beforeEach(() => { replay.update.mockImplementation(async (_id, patch) => saved({ id: row.id, ...patch, line_total: row.quantity * patch.unit_rate })); });
    it.each(["", "-", "1e", "bad", "Infinity", "0x10"])("keeps raw invalid/intermediate rate %s without zero writes", raw => {
        const tree = typeRate(raw);
        expect(rate(tree).value).toBe(raw); expect(rate(tree).onBlur).toBeUndefined();
        expect(saveRate(tree).disabled).toBe(true); (saveRate(tree).onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(tree)).toContain("Resource totals still use the saved rate");
        (cancelRate(tree).onClick as () => void)(); expect(rate().value).toBe(2);
        expect(draftState.mock.calls).toEqual([["line", true], ["line", false]]);
    });
    it("saves only the explicit finite rate and uses the acknowledged stored row", async () => {
        const tree = typeRate("2.129");
        expect(replay.update).not.toHaveBeenCalled();
        replay.update.mockResolvedValueOnce({ ...row, unit_rate: 2.13, line_total: 42.6 });
        (saveRate(tree).onClick as () => void)(); await Promise.all(replay.tasks);
        expect(replay.update).toHaveBeenCalledExactlyOnceWith(row.id, { unit_rate: 2.129 });
        expect(rate().value).toBe(2.13); expect(changed.mock.lastCall?.[1]).toEqual([{ ...row, unit_rate: 2.13, line_total: 42.6 }]);
        expect(replay.apply).not.toHaveBeenCalled(); expect(draftState).toHaveBeenLastCalledWith("line", false);
    });
    it.each(["0", "-2", "1e2"])("preserves a deliberately entered existing-contract finite rate %s", async raw => {
        const tree = typeRate(raw); (saveRate(tree).onClick as () => void)();
        expect(replay.update).toHaveBeenCalledExactlyOnceWith(row.id, { unit_rate: Number(raw) });
        await Promise.all(replay.tasks);
    });
    it("closes an explicitly confirmed unchanged numeric value without a write", () => {
        const tree = typeRate("2.000"); (saveRate(tree).onClick as () => void)();
        expect(replay.update).not.toHaveBeenCalled(); expect(rate().value).toBe(2); expect(draftState).toHaveBeenLastCalledWith("line", false);
    });
    it("fences double Save and Cancel while pending,then refuses an old Save handler", async () => {
        let resolve!: (value: EstimateLineComponent) => void;
        replay.update.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const tree = typeRate("3"), click = saveRate(tree).onClick as () => void;
        click(); click(); (cancelRate(tree).onClick as () => void)();
        expect(replay.update).toHaveBeenCalledOnce(); expect(cancelRate().disabled).toBe(true);
        resolve({ ...row, unit_rate: 3, line_total: 60 }); await Promise.all(replay.tasks); click();
        expect(replay.update).toHaveBeenCalledOnce();
    });
    it.each([null, "reject", "other-row"])("retains typed rate and uncertainty for unconfirmed update %s", async mode => {
        if (mode === "reject") replay.update.mockRejectedValueOnce(new Error("Response lost"));
        else replay.update.mockResolvedValueOnce(mode === "other-row" ? { ...row, id: "other" } : null);
        const tree = typeRate("3"), click = saveRate(tree).onClick as () => void;
        click(); await Promise.all(replay.tasks); click();
        expect(replay.update).toHaveBeenCalledOnce(); expect(rate().value).toBe("3"); expect(changed).not.toHaveBeenCalled();
        expect(state).toHaveBeenLastCalledWith("line", "uncertain"); expect(draftState).not.toHaveBeenCalledWith("line", false);
    });
    it("invalidates Apply immediately and pauses quantity/description/unit/library writes", () => {
        const old = rateView();
        (rate(old).onChange as (e: unknown) => void)({ target: { value: "3" } });
        (control(old, "Total resource quantity: Boards").onChange as (e: unknown) => void)({ target: { value: "99" } });
        (control(old, "Apply resource rate").onClick as () => void)();
        (control(old, "Build-up to review").onChange as (e: unknown) => void)({ target: { value: "saved" } });
        expect(replay.update).not.toHaveBeenCalled(); expect(replay.apply).not.toHaveBeenCalled(); expect(replay.add).not.toHaveBeenCalled();
        expect(control(rateView(), "Total resource quantity: Boards").disabled).toBe(true);
        expect(control(rateView(), "Resource unit: Boards").disabled).toBe(true);
    });
    it("retains a stale rate draft and refuses a changed priced quantity or parent pending gate", () => {
        const tree = typeRate("3"), click = saveRate(tree).onClick as () => void;
        parentGuard.mockReturnValue(false); click(); expect(replay.update).not.toHaveBeenCalled(); parentGuard.mockReturnValue(true);
        rateView({ line: { ...parent, quantity: 100 } }); click(); expect(replay.update).not.toHaveBeenCalled();
        expect(rate(rateView({ line: { ...parent, quantity: 100 } })).value).toBe("3");
    });
    it("does not publish a late rate acknowledgement after unmount", async () => {
        let resolve!: (value: EstimateLineComponent) => void; replay.update.mockReturnValueOnce(new Promise(ok => { resolve = ok; }));
        const tree = typeRate("3"); (saveRate(tree).onClick as () => void)(); for (const cleanup of replay.cleanups) cleanup();
        resolve({ ...row, unit_rate: 3, line_total: 60 }); await Promise.all(replay.tasks);
        expect(changed).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith("line", "uncertain");
    });
});
