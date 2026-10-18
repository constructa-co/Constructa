import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { PlannerPhase } from "@/lib/planner-phases";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: unknown[]; effect?: Effect; cleanup?: () => void };
const lifecycle = vi.hoisted(() => ({
    slots: [] as Slot[], cursor: 0, pending: [] as Slot[], dirty: false,
    write: vi.fn(), read: vi.fn(), error: vi.fn(),
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
    updatePhasesAction: lifecycle.write, saveProgrammePhasesAction: lifecycle.write, getEstimatePhasesAction: lifecycle.read,
}));
vi.mock("./programme-ai-update", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: lifecycle.error } }));

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
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => null });
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
