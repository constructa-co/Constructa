import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProgrammeDraft, initialProgrammeState, programmeReducer, type ProgrammeState } from "@/lib/simple-programme";
import { OMIT_PROGRAMME } from "@/lib/programme-inclusion";

const hooks = vi.hoisted(() => ({ state: null as ProgrammeState | null, slots: [] as unknown[], cursor: 0, save: vi.fn(), dispatch: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useMemo: (fn: () => unknown) => fn(), useEffect: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }), useTransition: () => [false, (fn: () => void) => fn()],
    useState: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
        return [hooks.slots[i], (next: unknown) => { hooks.slots[i] = typeof next === "function" ? next(hooks.slots[i]) : next; }]; },
}));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: vi.fn() }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [hooks.state, { getState: () => hooks.state, dispatch: hooks.dispatch }] }));
vi.mock("./simple-actions", () => ({ saveSimpleProgrammeAction: hooks.save }));
import SimpleProgrammeClient from "./simple-programme-client";
type Element = ReactElement<Record<string, unknown>>;
const project = { id: "job", name: "Kitchen", start_date: "2026-10-19", programme_phases: [] as unknown[] };
const estimate = { id: "estimate", project_id: "job", estimate_lines: [{ id: "line", estimate_id: "estimate", trade_section: "Fit kitchen" }] };
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function parent(overrides: Partial<Parameters<typeof SimpleProgrammeClient>[0]> = {}) {
    hooks.cursor = 0; return SimpleProgrammeClient({ project, lockReason: null, estimate, save: hooks.save, ...overrides });
}
function editor(source = estimate) {
    const entry = nodes(parent({ estimate: source })).find(n => typeof n.type === "function" && n.props.initial)!;
    return (entry.type as (props: unknown) => Element)(entry.props);
}
const choice = (tree = editor()) => nodes(tree).find(n => typeof n.type === "function" && n.props.copy)!;
beforeEach(() => {
    hooks.state = programmeReducer(initialProgrammeState(emptyProgrammeDraft(project.start_date), false), { type: "stages/enable", keys: ["one"] });
    hooks.slots = []; hooks.cursor = 0; hooks.save.mockReset(); hooks.dispatch.mockReset();
    hooks.save.mockResolvedValue({ success: true }); hooks.dispatch.mockImplementation(action => { hooks.state = programmeReducer(hooks.state!, action); });
});
describe("actual simple programme estimate-to-stage entry", () => {
    it("offers the job's real names on an empty existing stage and only changes its draft name", () => {
        const before = hooks.state!.saved, control = choice(); expect(control.props.names).toEqual(["Fit kitchen"]);
        expect((control.props.copy as (name: string) => boolean)("Fit kitchen")).toBe(true);
        expect(hooks.state!.draft.stages).toEqual([{ key: "one", name: "Fit kitchen", duration: "", unit: "weeks", source: null }]);
        expect(hooks.state!.saved).toBe(before); expect(hooks.save).not.toHaveBeenCalled(); expect(choice()).toBeUndefined();
    });
    it("does not offer copying for foreign estimate, whole-job bar, existing typed name, locked or omitted programme", () => {
        expect(choice(editor({ ...estimate, project_id: "other" }))).toBeUndefined();
        hooks.dispatch({ type: "stages/disable" }); expect(choice()).toBeUndefined();
        hooks.dispatch({ type: "stages/enable", keys: ["one"] }); hooks.dispatch({ type: "stage/change", key: "one", patch: { name: "My own stage" } });
        expect(choice()).toBeUndefined();
        expect(renderToStaticMarkup(parent({ lockReason: "Locked" }))).not.toContain("Reuse a saved estimate activity");
        const omitted = parent({ project: { ...project, programme_phases: [OMIT_PROGRAMME] } });
        expect(nodes(omitted).some(n => typeof n.type === "function" && n.props.initial)).toBe(false);
        expect(renderToStaticMarkup(omitted)).toContain("Programme deliberately omitted");
        expect(hooks.save).not.toHaveBeenCalled();
    });
    it("retains newer name/duration and fences immediate duplicate or pending/failed callbacks", () => {
        const oldCopy = choice().props.copy as (name: string) => boolean;
        hooks.dispatch({ type: "stage/change", key: "one", patch: { duration: "2" } }); expect(oldCopy("Fit kitchen")).toBe(false);
        const fresh = choice().props.copy as (name: string) => boolean; expect(fresh("Fit kitchen")).toBe(true); expect(fresh("Fit kitchen")).toBe(false);
        hooks.dispatch({ type: "stage/change", key: "one", patch: { name: "" } }); hooks.dispatch({ type: "save/started" });
        expect(choice().props.disabled).toBe(true); expect((choice().props.copy as (n: string) => boolean)("Fit kitchen")).toBe(false);
        hooks.dispatch({ type: "save/failed", error: "Unknown" }); expect(choice().props.disabled).toBe(true); expect(hooks.state!.draft.stages[0].duration).toBe("2");
    });
    it("rekeys source review when selected estimate/activity membership changes without resetting programme drafts", () => {
        const original = choice(), before = hooks.state;
        const other = choice(editor({ ...estimate, id: "second", estimate_lines: [{ id: "new", estimate_id: "second", trade_section: "My actual work" }] }));
        expect(other.key).not.toBe(original.key); expect(other.props.names).toEqual(["My actual work"]); expect(hooks.state).toBe(before);
        expect(nodes(parent()).find(n => typeof n.type === "function" && n.props.initial)!.key).toBe(project.id);
    });
    it("requires contractor duration and normal Save, and retains copied wording after a failed save", async () => {
        (choice().props.copy as (name: string) => boolean)("Fit kitchen");
        hooks.dispatch({ type: "stage/change", key: "one", patch: { duration: "2", unit: "days" } });
        hooks.save.mockResolvedValueOnce({ success: false, error: "Not confirmed" });
        (nodes(editor()).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("failed"));
        expect(hooks.save).toHaveBeenCalledExactlyOnceWith({ startDate: "2026-10-19", stages: [{ name: "Fit kitchen", workingDays: 2, unit: "days", source: null }] });
        expect(hooks.state!.draft.stages[0].name).toBe("Fit kitchen"); expect(hooks.state!.hasSaved).toBe(false);
    });
});
