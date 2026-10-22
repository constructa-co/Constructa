import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { PlannerPhase } from "@/lib/planner-phases";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: unknown[]; effect?: Effect; cleanup?: () => void };
const lifecycle = vi.hoisted(() => ({
    slots: [] as Slot[], cursor: 0, pending: [] as Slot[], dirty: false,
    write: vi.fn(), read: vi.fn(), error: vi.fn(), regenerateWrite: vi.fn(), success: vi.fn(),
}));

// Replay the real component's effect closures and cleanups, not copied save logic.
// This models Strict Mode's setup/cleanup/setup cycle; it is not a browser renderer.
vi.mock("react", async importOriginal => {
    const original = await importOriginal<typeof import("react")>();
    const same = (left?: unknown[], right?: unknown[]) => !!left && !!right && left.length === right.length && left.every((value, i) => Object.is(value, right[i]));
    function slot() {
        const index = lifecycle.cursor++;
        return lifecycle.slots[index] ??= {};
    }
    return {
        ...original,
        useState: (initial: unknown) => {
            const state = slot();
            if (!("value" in state)) state.value = typeof initial === "function" ? initial() : initial;
            return [state.value, (next: unknown) => {
                const value = typeof next === "function" ? next(state.value) : next;
                if (!Object.is(value, state.value)) { state.value = value; lifecycle.dirty = true; }
            }];
        },
        useRef: (initial: unknown) => {
            const ref = slot();
            if (!("value" in ref)) ref.value = { current: initial };
            return ref.value;
        },
        useMemo: (factory: () => unknown, deps: unknown[]) => {
            const memo = slot();
            if (!same(memo.deps, deps)) { memo.value = factory(); memo.deps = deps; }
            return memo.value;
        },
        useCallback: (callback: unknown, deps: unknown[]) => {
            const memo = slot();
            if (!same(memo.deps, deps)) { memo.value = callback; memo.deps = deps; }
            return memo.value;
        },
        useEffect: (effect: Effect, deps?: unknown[]) => {
            const entry = slot();
            if (!same(entry.deps, deps)) lifecycle.pending.push(entry);
            entry.deps = deps; entry.effect = effect;
        },
        useTransition: () => [false, (callback: () => unknown) => callback()],
    };
});
vi.mock("./actions", () => ({
    updatePhasesAction: lifecycle.write, saveProgrammePhasesAction: lifecycle.regenerateWrite, getEstimatePhasesAction: lifecycle.read,
}));
vi.mock("./programme-ai-update", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: lifecycle.success, error: lifecycle.error } }));

import ClientSchedulePage from "./client-page";

const stages: PlannerPhase[] = [{ name: "Demo", startOffset: 0, calculatedDays: 5, manualDays: 5, manhours: 0 }];
const estimate = { id: "example-estimate", version_name: "Example", estimate_lines: [{ trade_section: "Carpentry", quantity: 1, estimate_line_components: [{ component_type: "labour", total_manhours: 40 }] }] };
type Props = Parameters<typeof ClientSchedulePage>[0];
type Node = { type: unknown; props: Record<string, unknown> };

function elements(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(elements);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as ReactElement<Record<string, unknown>>;
    return [{ type: node.type, props: node.props }, ...elements(node.props.children)];
}

let current: ReturnType<typeof open> | null = null;
function open(phases = stages, startingEstimate: Props["estimate"] = null, replay = true, startDate = "2026-10-19") {
    const props: Props = { project: { id: "opening-check", name: "Example", start_date: startDate, programme_phases: phases }, projectId: "opening-check", estimate: startingEstimate };
    let tree: unknown;
    function render() {
        lifecycle.cursor = 0; lifecycle.pending = []; lifecycle.dirty = false;
        tree = ClientSchedulePage(props);
        for (const entry of lifecycle.pending) { entry.cleanup?.(); entry.cleanup = entry.effect?.() || undefined; }
    }
    function flush() {
        let renders = 0;
        while (lifecycle.dirty) { expect(++renders).toBeLessThan(10); render(); }
    }
    render();
    if (replay) {
        for (const entry of lifecycle.slots) entry.cleanup?.();
        for (const entry of lifecycle.slots) if (entry.effect) entry.cleanup = entry.effect() || undefined;
    }
    flush();
    const result = {
        flush,
        regenerate() {
            const button = elements(tree).find(node => node.type === "button" && node.props.children === "Regenerate from estimate");
            (button!.props.onClick as () => void)(); flush();
        },
        revise(next: Partial<Props>) { Object.assign(props, next); render(); flush(); },
        names: () => elements(tree).filter(node => node.type === "input" && !node.props.type).map(node => node.props.value),
        week(n: number) {
            const button = elements(tree).find(node => node.type === "button" && Array.isArray(node.props.children) && node.props.children[0] === n);
            expect(button).toBeDefined(); (button!.props.onClick as () => void)(); flush();
        },
        notices: () => elements(tree).filter(node => node.props.role === "status" && !("data-programme-save-state" in node.props)).map(node => node.props.children),
        saveStatus: () => elements(tree).find(node => "data-programme-save-state" in node.props)?.props,
        saveHandler: () => elements(tree).find(node => node.type === "button" && node.props.children === "Save to Proposal")!.props.onClick as () => void,
        startDateInput: () => elements(tree).find(node => node.type === "input" && node.props.type === "date")?.props.value,
        change(predicate: (node: Node) => boolean, value: string) {
            const input = elements(tree).find(predicate);
            expect(input).toBeDefined();
            (input!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
            flush();
        },
        save() {
            const button = elements(tree).find(node => node.type === "button" && node.props.children === "Save to Proposal");
            expect(button).toBeDefined();
            (button!.props.onClick as () => void)(); flush();
        },
        suggestion: () => elements(tree).some(node => "data-planner-suggestion" in node.props),
        unmount() { for (const entry of lifecycle.slots) { entry.cleanup?.(); entry.cleanup = undefined; } },
    };
    current = result;
    return result;
}
const nameInput = (name: string) => (node: Node) => node.type === "input" && node.props.value === name;

beforeEach(() => {
    lifecycle.slots = []; lifecycle.cursor = 0; lifecycle.pending = []; lifecycle.dirty = false;
    lifecycle.write.mockReset().mockResolvedValue({ success: true });
    lifecycle.read.mockReset().mockResolvedValue([]); lifecycle.error.mockClear();
    lifecycle.regenerateWrite.mockReset().mockResolvedValue(undefined); lifecycle.success.mockClear();
    vi.useFakeTimers();
    vi.stubGlobal("window", { confirm: vi.fn(() => true) });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { current?.unmount(); current = null; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("detailed planner initial-open no-write intent", () => {
    it("does not save a normal first opening or its unmount", async () => {
        const view = open(stages, null, false);
        await vi.advanceTimersByTimeAsync(1000); view.unmount();
        expect(lifecycle.write).not.toHaveBeenCalled(); expect(lifecycle.read).not.toHaveBeenCalled();
    });

    it("does not save unchanged saved phases during setup/cleanup/setup replay", async () => {
        const before = JSON.stringify(stages);
        const view = open();
        await vi.advanceTimersByTimeAsync(1000); view.unmount();
        expect(lifecycle.write).not.toHaveBeenCalled();
        expect(JSON.stringify(stages)).toBe(before);
    });

    it("does not flush an unchanged opening when unmounted before the debounce", async () => {
        const view = open(); view.unmount();
        await vi.advanceTimersByTimeAsync(1000);
        expect(lifecycle.write).not.toHaveBeenCalled();
    });

    it("keeps estimate suggestions unsaved and labelled after replay", async () => {
        const view = open([], estimate);
        await vi.advanceTimersByTimeAsync(1000); view.flush();
        expect(lifecycle.write).not.toHaveBeenCalled(); expect(view.suggestion()).toBe(true);
    });

    it("keeps asynchronously loaded suggestions unsaved after replay", async () => {
        lifecycle.read.mockResolvedValue([{ name: "Carpentry", calculatedDays: 5, manualDays: null, manhours: 40 }]);
        const view = open([]);
        await Promise.resolve(); view.flush();
        await vi.advanceTimersByTimeAsync(1000); view.unmount();
        expect(lifecycle.read).toHaveBeenCalledWith("opening-check");
        expect(lifecycle.write).not.toHaveBeenCalled(); expect(view.suggestion()).toBe(true);
    });

    it("retains the 500ms autosave for a real edit after replay", async () => {
        const view = open(); view.change(nameInput("Demo"), "Removal");
        await vi.advanceTimersByTimeAsync(499); expect(lifecycle.write).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", [{ ...stages[0], name: "Removal" }], "2026-10-19");
    });

    it("keeps a rapid later edit rather than saving the older snapshot", async () => {
        const view = open(); view.change(nameInput("Demo"), "First edit");
        await vi.advanceTimersByTimeAsync(200); view.change(nameInput("First edit"), "Latest edit");
        await vi.advanceTimersByTimeAsync(499); expect(lifecycle.write).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", [{ ...stages[0], name: "Latest edit" }], "2026-10-19");
    });

    it("still flushes a real pending edit once when leaving", async () => {
        const view = open(); view.change(nameInput("Demo"), "Removal"); view.unmount();
        await Promise.resolve();
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", [{ ...stages[0], name: "Removal" }], "2026-10-19");
        await vi.advanceTimersByTimeAsync(1000); expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it("saves the local calendar date for an explicit start-date edit", async () => {
        const view = open(); view.change(node => node.type === "input" && node.props.type === "date", "2026-10-26");
        await vi.advanceTimersByTimeAsync(500);
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", stages, "2026-10-26");
    });

    it("still saves a suggestion when the contractor explicitly asks to save", async () => {
        const view = open([], estimate); view.save(); await Promise.resolve();
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", [{ name: "Carpentry", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 }], "2026-10-19");
    });

    it("still autosaves when the contractor edits a suggestion", async () => {
        const view = open([], estimate); view.change(nameInput("Carpentry"), "Fit kitchen");
        await vi.advanceTimersByTimeAsync(500); view.flush();
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", [{ name: "Fit kitchen", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 }], "2026-10-19");
        expect(view.suggestion()).toBe(false);
    });

    it("retains failure reporting and an explicit retry", async () => {
        lifecycle.write.mockResolvedValueOnce({ success: false, error: "Controlled refusal" });
        const view = open(); view.change(nameInput("Demo"), "Removal");
        await vi.advanceTimersByTimeAsync(500); view.flush();
        expect(lifecycle.error).toHaveBeenCalledWith("Controlled refusal");
        view.save(); await Promise.resolve();
        expect(lifecycle.write).toHaveBeenCalledTimes(2);
        expect(lifecycle.write.mock.calls[1]).toEqual(lifecycle.write.mock.calls[0]);
    });

    it("shows the snapped local Monday without writing over the original saved Sunday", async () => {
        const view = open(stages, null, true, "2026-10-18");
        expect(view.startDateInput()).toBe("2026-10-19");
        await vi.advanceTimersByTimeAsync(1000); view.unmount();
        expect(lifecycle.write).not.toHaveBeenCalled();
    });

    it("keeps Monday snapping and the local date across a year boundary", async () => {
        const view = open(); view.change(node => node.type === "input" && node.props.type === "date", "2027-01-03");
        expect(view.startDateInput()).toBe("2027-01-04");
        await vi.advanceTimersByTimeAsync(500);
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", stages, "2027-01-04");
    });
});

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const regeneratedStages = [{ name: "Reviewed estimate section", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 }];
async function settle(view: ReturnType<typeof open>) {
    for (let i = 0; i < 12; i++) { await Promise.resolve(); view.flush(); }
}

describe("explicit detailed programme regeneration acknowledgement", () => {
    it("Cancel reads and writes nothing and retains all stages", async () => {
        vi.mocked(window.confirm).mockReturnValue(false);
        const view = open(); view.regenerate(); await settle(view);
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Your stage names, lengths and order will be lost"));
        expect(lifecycle.read).not.toHaveBeenCalled(); expect(lifecycle.regenerateWrite).not.toHaveBeenCalled();
        expect(view.names()).toContain("Demo"); expect(lifecycle.success).not.toHaveBeenCalled();
    });

    it("keeps current stages until the one existing void-return action resolves, without a second autosave", async () => {
        lifecycle.read.mockResolvedValue(regeneratedStages);
        const saved = deferred<void>(); lifecycle.regenerateWrite.mockReturnValue(saved.promise);
        const view = open(); view.regenerate(); await settle(view);
        expect(view.names()).toContain("Demo"); expect(lifecycle.success).not.toHaveBeenCalled();
        expect(lifecycle.regenerateWrite).toHaveBeenCalledExactlyOnceWith("opening-check", regeneratedStages);
        saved.resolve(); await settle(view);
        expect(view.names()).toContain("Reviewed estimate section"); expect(view.suggestion()).toBe(false);
        expect(lifecycle.success).toHaveBeenCalledExactlyOnceWith("Programme regenerated from estimate and saved");
        await vi.advanceTimersByTimeAsync(1000); view.unmount();
        expect(lifecycle.write).not.toHaveBeenCalled();
    });

    it.each(["owner/edit-lock refusal", "storage CAS refusal", "lost acknowledgement"])("%s retains old stages and refuses a blind regeneration retry", async message => {
        lifecycle.read.mockResolvedValue(regeneratedStages);
        lifecycle.regenerateWrite.mockRejectedValue(new Error(message));
        const view = open(); view.regenerate(); await settle(view);
        expect(view.names()).toContain("Demo"); expect(lifecycle.success).not.toHaveBeenCalled();
        expect(view.notices().join(" ")).toContain("may already have saved");
        expect(lifecycle.error).toHaveBeenCalledTimes(1);
        view.regenerate(); await settle(view); await vi.advanceTimersByTimeAsync(1000);
        expect(lifecycle.regenerateWrite).toHaveBeenCalledTimes(1); expect(lifecycle.read).toHaveBeenCalledTimes(1);
        expect(lifecycle.write).not.toHaveBeenCalled();
    });

    it("a read failure performs no replacement or write and can be deliberately retried", async () => {
        lifecycle.read.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(regeneratedStages);
        const view = open(); view.regenerate(); await settle(view);
        expect(view.names()).toContain("Demo"); expect(lifecycle.regenerateWrite).not.toHaveBeenCalled();
        expect(view.notices().join(" ")).toContain("Could not read");
        view.regenerate(); await settle(view);
        expect(lifecycle.regenerateWrite).toHaveBeenCalledTimes(1); expect(view.names()).toContain("Reviewed estimate section");
    });

    it("duplicate handlers cannot issue parallel reads or writes", async () => {
        const read = deferred<typeof regeneratedStages>(); lifecycle.read.mockReturnValue(read.promise);
        const view = open(); view.regenerate(); view.regenerate();
        expect(lifecycle.read).toHaveBeenCalledTimes(1);
        read.resolve(regeneratedStages); await settle(view);
        expect(lifecycle.regenerateWrite).toHaveBeenCalledTimes(1);
    });

    it("a newer name edit while reading prevents the replacement write", async () => {
        const read = deferred<typeof regeneratedStages>(); lifecycle.read.mockReturnValue(read.promise);
        const view = open(); view.regenerate(); view.change(nameInput("Demo"), "Newer work");
        read.resolve(regeneratedStages); await settle(view);
        expect(lifecycle.regenerateWrite).not.toHaveBeenCalled(); expect(view.names()).toContain("Newer work");
        expect(lifecycle.success).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);
        expect(lifecycle.write.mock.calls[0][1][0].name).toBe("Newer work");
    });

    it.each(["estimate", "project", "start", "week"])("changed %s context refuses a late source read", async kind => {
        const read = deferred<typeof regeneratedStages>(); lifecycle.read.mockReturnValue(read.promise);
        const view = open(); view.regenerate();
        if (kind === "estimate") view.revise({ estimate });
        if (kind === "project") view.revise({ projectId: "different-project" });
        if (kind === "start") view.change(node => node.type === "input" && node.props.type === "date", "2026-10-26");
        if (kind === "week") view.week(6);
        read.resolve(regeneratedStages); await settle(view);
        expect(lifecycle.regenerateWrite).not.toHaveBeenCalled(); expect(view.names()).toContain("Demo");
        expect(lifecycle.success).not.toHaveBeenCalled();
    });

    it("serializes behind an already in-flight autosave and avoids overwriting a newer subsequent edit", async () => {
        const oldSave = deferred<{ success: true }>(); lifecycle.write.mockReturnValueOnce(oldSave.promise);
        lifecycle.read.mockResolvedValue(regeneratedStages);
        const view = open(); view.change(nameInput("Demo"), "First edit");
        await vi.advanceTimersByTimeAsync(500); view.regenerate(); await settle(view);
        expect(lifecycle.regenerateWrite).not.toHaveBeenCalled();
        view.change(nameInput("First edit"), "Latest edit");
        oldSave.resolve({ success: true }); await settle(view);
        expect(lifecycle.regenerateWrite).not.toHaveBeenCalled(); expect(view.names()).toContain("Latest edit");
    });

    it("waits for an earlier autosave before the single confirmed regeneration write", async () => {
        const oldSave = deferred<{ success: true }>(); lifecycle.write.mockReturnValueOnce(oldSave.promise);
        lifecycle.read.mockResolvedValue(regeneratedStages);
        const view = open(); view.change(nameInput("Demo"), "Reviewed current stage");
        await vi.advanceTimersByTimeAsync(500); view.regenerate(); await settle(view);
        expect(lifecycle.regenerateWrite).not.toHaveBeenCalled();
        oldSave.resolve({ success: true }); await settle(view);
        expect(lifecycle.regenerateWrite).toHaveBeenCalledTimes(1);
        expect(view.names()).toContain("Reviewed estimate section");
        await vi.advanceTimersByTimeAsync(1000); expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it("a pending opening read cannot overwrite explicitly regenerated stages", async () => {
        const openingRead = deferred<typeof regeneratedStages>();
        lifecycle.read.mockReturnValueOnce(openingRead.promise).mockResolvedValue(regeneratedStages);
        const view = open([], null, false); view.regenerate(); await settle(view);
        expect(view.names()).toContain("Reviewed estimate section");
        openingRead.resolve([{ ...regeneratedStages[0], name: "Obsolete opening" }]); await settle(view);
        expect(view.names()).toContain("Reviewed estimate section"); expect(view.names()).not.toContain("Obsolete opening");
        await vi.advanceTimersByTimeAsync(1000); expect(lifecycle.write).not.toHaveBeenCalled();
    });

    it("a response for a departed project cannot publish or report success in the new project", async () => {
        const saved = deferred<void>(); lifecycle.regenerateWrite.mockReturnValue(saved.promise);
        lifecycle.read.mockResolvedValue(regeneratedStages);
        const view = open(); view.regenerate(); await settle(view);
        view.revise({ projectId: "different-project" });
        saved.resolve(); await settle(view);
        expect(view.names()).toContain("Demo"); expect(lifecycle.success).not.toHaveBeenCalled();
        expect(view.notices()).toEqual([]);
    });

    it("late successful regeneration never replaces newer edits; their existing autosave writes after it", async () => {
        const saved = deferred<void>(); lifecycle.regenerateWrite.mockReturnValue(saved.promise);
        lifecycle.read.mockResolvedValue(regeneratedStages);
        const view = open(); view.regenerate(); await settle(view);
        view.change(nameInput("Demo"), "Newer after request");
        await vi.advanceTimersByTimeAsync(500);
        expect(lifecycle.write).not.toHaveBeenCalled();
        saved.resolve(); await settle(view);
        expect(view.names()).toContain("Newer after request"); expect(lifecycle.success).not.toHaveBeenCalled();
        expect(view.notices().join(" ")).toContain("does not confirm they are saved");
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", [{ ...stages[0], name: "Newer after request" }], "2026-10-19");
    });

    it("late failed regeneration retains newer edits and uncertainty without retrying", async () => {
        const saved = deferred<void>(); lifecycle.regenerateWrite.mockReturnValue(saved.promise);
        lifecycle.read.mockResolvedValue(regeneratedStages);
        const view = open(); view.regenerate(); await settle(view);
        view.change(nameInput("Demo"), "Newer after request");
        saved.reject(new Error("lost response")); await settle(view);
        expect(view.names()).toContain("Newer after request"); expect(view.notices().join(" ")).toContain("may already have saved");
        view.regenerate(); await settle(view); expect(lifecycle.regenerateWrite).toHaveBeenCalledTimes(1);
    });

    it.each(["read", "save"])("unmount during %s suppresses late replacement, notices and success", async stage => {
        const read = deferred<typeof regeneratedStages>(); const saved = deferred<void>();
        lifecycle.read.mockReturnValue(read.promise); lifecycle.regenerateWrite.mockReturnValue(saved.promise);
        const view = open(); view.regenerate();
        if (stage === "save") { read.resolve(regeneratedStages); await settle(view); }
        view.unmount(); read.resolve(regeneratedStages); saved.resolve(); await settle(view);
        expect(lifecycle.success).not.toHaveBeenCalled(); expect(lifecycle.error).not.toHaveBeenCalled();
        expect(view.names()).toContain("Demo");
        expect(lifecycle.regenerateWrite).toHaveBeenCalledTimes(stage === "save" ? 1 : 0);
    });

    it("local fallback keeps its existing autosave, without claiming an acknowledged save", async () => {
        const view = open(stages, estimate); view.regenerate(); await settle(view);
        expect(view.names()).toContain("Carpentry"); expect(lifecycle.regenerateWrite).not.toHaveBeenCalled();
        expect(lifecycle.success).toHaveBeenCalledExactlyOnceWith("Estimate stages prepared; existing programme autosave will save them");
        expect(lifecycle.write).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(500);
        expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it("empty estimate keeps current stages without any write or success", async () => {
        const view = open(); view.regenerate(); await settle(view);
        expect(view.names()).toContain("Demo"); expect(lifecycle.success).not.toHaveBeenCalled();
        expect(lifecycle.error).toHaveBeenCalledWith(expect.stringContaining("No manhours found"));
        expect(lifecycle.regenerateWrite).not.toHaveBeenCalled(); expect(lifecycle.write).not.toHaveBeenCalled();
    });
});

describe("programme Save and autosave operation-scoped status", () => {
    it("labels explicit Save separately from autosave and writes once", async () => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValue(saved.promise);
        const view = open(); view.save();
        expect(view.saveStatus()).toMatchObject({ "data-programme-save-state": "saving", children: "Saving programme to proposal...", "aria-live": "polite" });
        saved.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ "data-programme-save-state": "saved", children: "Programme saved to proposal" });
        expect(lifecycle.success).toHaveBeenCalledExactlyOnceWith("Programme saved to proposal");
        await vi.advanceTimersByTimeAsync(1000); view.unmount();
        expect(lifecycle.write).toHaveBeenCalledExactlyOnceWith("opening-check", stages, "2026-10-19");
    });

    it("retains the 500ms debounce and labels only the acknowledged automatic save", async () => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValue(saved.promise);
        const view = open(); view.change(nameInput("Demo"), "Autosave edit");
        await vi.advanceTimersByTimeAsync(499); expect(lifecycle.write).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1); view.flush();
        expect(view.saveStatus()).toMatchObject({ children: "Auto-saving changes..." });
        saved.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Changes auto-saved" });
        expect(lifecycle.success).not.toHaveBeenCalled();
    });

    it.each(["manual", "auto"])("%s returned refusal keeps stages and does not claim failure of newer work", async kind => {
        lifecycle.write.mockResolvedValue({ success: false, error: "Controlled refusal" });
        const view = open();
        if (kind === "manual") view.save();
        else { view.change(nameInput("Demo"), "Refused draft"); await vi.advanceTimersByTimeAsync(500); }
        await settle(view);
        expect(view.saveStatus()).toMatchObject({ "data-programme-save-state": "error", children: "Save not confirmed. Current stages remain on screen." });
        expect(lifecycle.error).toHaveBeenCalledExactlyOnceWith("Controlled refusal"); expect(lifecycle.success).not.toHaveBeenCalled();
        expect(view.names()).toContain(kind === "manual" ? "Demo" : "Refused draft");
        await vi.advanceTimersByTimeAsync(5000); expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it.each(["manual", "auto"])("%s rejected response is caught, stays uncertain and does not retry itself", async kind => {
        lifecycle.write.mockRejectedValue(new Error("connection lost after write"));
        const view = open();
        if (kind === "manual") view.save();
        else { view.change(nameInput("Demo"), "Uncertain draft"); await vi.advanceTimersByTimeAsync(500); }
        await settle(view);
        expect(view.saveStatus()).toMatchObject({ "data-programme-save-state": "uncertain", children: expect.stringContaining("may already have completed") });
        expect(lifecycle.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("may already have completed"));
        expect(lifecycle.success).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(5000); expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it("a manual acknowledgement cannot call a newer unsent name edit saved", async () => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValueOnce(saved.promise);
        const view = open(); view.save(); view.change(nameInput("Demo"), "Newer unsent");
        saved.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ "data-programme-save-state": "changed" });
        expect(lifecycle.success).not.toHaveBeenCalled(); expect(view.names()).toContain("Newer unsent");
        await vi.advanceTimersByTimeAsync(500); await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Changes auto-saved" });
        expect(lifecycle.write).toHaveBeenCalledTimes(2);
    });

    it("a saved label disappears immediately on a new edit rather than waiting for the debounce", async () => {
        const view = open(); view.save(); await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Programme saved to proposal" });
        view.change(nameInput("Demo"), "Not yet sent");
        expect(view.saveStatus()).toMatchObject({ children: "Current changes are not yet confirmed saved." });
        expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it.each(["success", "refusal", "rejection"])("late %s from an older autosave cannot relabel a pending newer one", async outcome => {
        const older = deferred<{ success: boolean; error?: string }>();
        const newer = deferred<{ success: true }>();
        lifecycle.write.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
        const view = open(); view.change(nameInput("Demo"), "First"); await vi.advanceTimersByTimeAsync(500);
        view.change(nameInput("First"), "Second"); await vi.advanceTimersByTimeAsync(500); view.flush();
        if (outcome === "rejection") older.reject(new Error("old rejection"));
        else older.resolve(outcome === "success" ? { success: true } : { success: false, error: "old refusal" });
        await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Auto-saving changes..." });
        expect(lifecycle.error).not.toHaveBeenCalled(); expect(lifecycle.success).not.toHaveBeenCalled();
        newer.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Changes auto-saved" });
        expect(lifecycle.write).toHaveBeenCalledTimes(2); expect(lifecycle.write.mock.calls[1][1][0].name).toBe("Second");
    });

    it("a manual caller sharing the newer automatic queue receipt cannot mislabel it manual Save", async () => {
        const older = deferred<{ success: true }>(); lifecycle.write.mockReturnValueOnce(older.promise);
        const view = open(); view.save(); view.change(nameInput("Demo"), "Newest automatic");
        await vi.advanceTimersByTimeAsync(500); older.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Changes auto-saved" });
        expect(lifecycle.success).not.toHaveBeenCalled(); expect(lifecycle.write).toHaveBeenCalledTimes(2);
    });

    it("an older saved-label timeout cannot clear a newer saving operation", async () => {
        const newer = deferred<{ success: true }>(); lifecycle.write.mockResolvedValueOnce({ success: true }).mockReturnValueOnce(newer.promise);
        const view = open(); view.save(); await settle(view);
        await vi.advanceTimersByTimeAsync(1000); view.change(nameInput("Demo"), "Later edit");
        await vi.advanceTimersByTimeAsync(500); view.flush();
        expect(view.saveStatus()).toMatchObject({ children: "Auto-saving changes..." });
        await vi.advanceTimersByTimeAsync(1000); view.flush();
        expect(view.saveStatus()).toMatchObject({ children: "Auto-saving changes..." });
        newer.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ children: "Changes auto-saved" });
    });

    it("a changed start date is not confirmed saved by an older response", async () => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValueOnce(saved.promise);
        const view = open(); view.save(); view.change(node => node.type === "input" && node.props.type === "date", "2026-10-26");
        saved.resolve({ success: true }); await settle(view);
        expect(view.saveStatus()).toMatchObject({ "data-programme-save-state": "changed" });
        expect(lifecycle.success).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500); await settle(view);
        expect(lifecycle.write.mock.calls[1][2]).toBe("2026-10-26");
    });

    it("old Save handlers and duplicate clicks do not save stale or duplicate snapshots", async () => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValueOnce(saved.promise);
        const view = open(); const oldSave = view.saveHandler();
        view.change(nameInput("Demo"), "Current draft"); oldSave(); view.flush();
        expect(lifecycle.write).not.toHaveBeenCalled();
        view.save(); view.save(); expect(lifecycle.write).toHaveBeenCalledTimes(1);
        saved.resolve({ success: true }); await settle(view); await vi.advanceTimersByTimeAsync(1000);
        view.unmount(); expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it.each(["success", "rejection"])("unmount during manual %s suppresses late notices and preserves the existing one write", async outcome => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValue(saved.promise);
        const view = open(); view.save(); view.unmount();
        if (outcome === "success") saved.resolve({ success: true }); else saved.reject(new Error("late"));
        await settle(view);
        expect(lifecycle.success).not.toHaveBeenCalled(); expect(lifecycle.error).not.toHaveBeenCalled();
        expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });

    it("departing project refuses a late success and a stale handler", async () => {
        const saved = deferred<{ success: true }>(); lifecycle.write.mockReturnValue(saved.promise);
        const view = open(); const oldSave = view.saveHandler(); view.save();
        view.revise({ projectId: "other-project" }); saved.resolve({ success: true }); await settle(view);
        oldSave(); view.flush();
        expect(lifecycle.success).not.toHaveBeenCalled(); expect(lifecycle.error).not.toHaveBeenCalled();
        expect(lifecycle.write).toHaveBeenCalledTimes(1);
    });
});
