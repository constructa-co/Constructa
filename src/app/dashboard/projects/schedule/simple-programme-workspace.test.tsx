import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { emptyProgrammeDraft, initialProgrammeState, programmeReducer, viewForProject, type ProgrammeState } from "@/lib/simple-programme";

const hooks = vi.hoisted(() => ({
    state: null as ProgrammeState | null, slots: [] as unknown[], cursor: 0, save: vi.fn(), dispatch: vi.fn(), theme: "dark",
    router: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useMemo: (read: () => unknown) => read(), useEffect: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }), useTransition: () => [false, (fn: () => void) => fn()],
    useState: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
        return [hooks.slots[i], (next: unknown) => { hooks.slots[i] = typeof next === "function" ? next(hooks.slots[i]) : next; }]; },
}));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: hooks.theme }) }));
vi.mock("next/navigation", () => ({ useRouter: () => hooks.router }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: vi.fn() }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [hooks.state, { getState: () => hooks.state, dispatch: hooks.dispatch }] }));
vi.mock("./simple-actions", () => ({ saveSimpleProgrammeAction: hooks.save }));
import SimpleProgrammeClient from "./simple-programme-client";

type Element = ReactElement<Record<string, unknown>>;
const project = { id: "11111111-1111-4111-8111-111111111111", name: "Replace kitchen", start_date: "2026-10-19", programme_phases: [] as unknown[] };
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function parent(overrides: Partial<Parameters<typeof SimpleProgrammeClient>[0]> = {}) {
    hooks.cursor = 0;
    return SimpleProgrammeClient({ project, lockReason: null, estimate: null, save: hooks.save, ...overrides });
}
function editor() {
    const entry = nodes(parent()).find(n => typeof n.type === "function" && n.props.initial);
    expect(entry).toBeDefined(); return (entry!.type as (props: unknown) => Element)(entry!.props);
}
function two() {
    const phases = [{ name: "Remove old kitchen", manualDays: 3, startOffset: 0 }, { name: "Fit new kitchen", manualDays: 5, startOffset: 3 }];
    let key = 0; const view = viewForProject({ ...project, programme_phases: phases }, () => `saved-${key++}`);
    expect(view.kind).toBe("simple"); if (view.kind === "simple") hooks.state = initialProgrammeState(view.draft, true);
}
beforeEach(() => {
    hooks.state = initialProgrammeState(emptyProgrammeDraft(project.start_date), false);
    hooks.slots = []; hooks.cursor = 0; hooks.theme = "dark";
    hooks.router.push.mockReset(); hooks.router.refresh.mockReset();
    hooks.save.mockReset(); hooks.dispatch.mockReset();
    hooks.dispatch.mockImplementation(action => { hooks.state = programmeReducer(hooks.state!, action); });
    hooks.save.mockResolvedValue({ success: true });
});

describe("timeline-first simple programme workspace", () => {
    it("keeps weekend choice local until explicit save, retains refusal and requires calendar readback", async () => {
        hooks.state = initialProgrammeState({ ...emptyProgrammeDraft("2026-10-16"), duration: "2", unit: "days" }, true);
        const saturday = nodes(editor()).find(n => n.type === "input" && n.props.id === "programme-weekend-6")!;
        expect(saturday.props.checked).toBe(false);
        (saturday.props.onChange as (event: unknown) => void)({ target: { checked: true } });
        const pattern = { version: 1, weekdays: [1, 2, 3, 4, 5, 6] };
        expect(hooks.state!.draft.workingPattern).toEqual(pattern);
        expect(hooks.state!.saved.workingPattern).toBeUndefined();
        expect(hooks.save).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(editor())).toContain("17 October 2026");
        hooks.save.mockResolvedValueOnce({ success: false, error: "Calendar not confirmed" });
        (nodes(editor()).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("failed"));
        expect(hooks.state!.draft.workingPattern).toEqual(pattern);
        expect(renderToStaticMarkup(editor())).toContain("Try again");
        expect(hooks.save).toHaveBeenCalledTimes(1);
        hooks.save.mockResolvedValueOnce({ success: true, confirmedProject: {
            programme_working_pattern: pattern, start_date: "2026-10-16",
            programme_phases: [{ name: "Works on site", manualDays: 2, startOffset: 0 }],
        } });
        (nodes(editor()).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("idle"));
        expect(hooks.state!.saved.workingPattern).toEqual(pattern);
        expect(hooks.save.mock.calls[1][0]).toMatchObject({ workingPattern: pattern, expectedWorkingPattern: null });
    });

    it("reopens saved working days without using the old browser-only detailed calendar", () => {
        const selected = { ...project, start_date: "2026-10-16", programme_working_pattern: { version: 1, weekdays: [1, 2, 3, 4, 5, 6] },
            programme_phases: [{ name: "Works", manualDays: 2, startOffset: 0 }] };
        const view = viewForProject(selected, () => "key");
        if (view.kind !== "simple") throw Error("Expected simple saved programme");
        hooks.state = initialProgrammeState(view.draft, true);
        const entry = nodes(parent({ project: selected })).find(n => typeof n.type === "function" && n.props.initial)!;
        const tree = (entry.type as (props: unknown) => Element)(entry.props);
        expect(nodes(tree).find(n => n.props.id === "programme-weekend-6")!.props.checked).toBe(true);
        expect(renderToStaticMarkup(parent({ project: selected }))).not.toContain("data-calendar-planner-note");
        expect(renderToStaticMarkup(parent({ project: selected }))).toContain("Detailed programme planner");
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it("does not mount detailed editing over malformed stored calendar data", () => {
        const html = renderToStaticMarkup(parent({ project: { ...project, programme_working_pattern: { version: 1, weekdays: [] } } }));
        expect(html).toContain("invalid saved pattern");
        expect(html).not.toContain("Detailed programme planner");
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it("retains the saved pattern and CAS baseline when explicitly replacing a legacy timeline", () => {
        const pattern = { version: 1, weekdays: [1, 2, 3, 4, 5, 6] };
        const selected = { ...project, programme_working_pattern: pattern, gantt_phases: [{ name: "Existing job stage", duration_days: 3, start_date: "2026-10-16" }] };
        const start = nodes(parent({ project: selected })).find(n => typeof n.props.onStartSimple === "function")!;
        expect(start).toBeDefined();
        (start.props.onStartSimple as () => void)();
        const next = nodes(parent({ project: selected })).find(n => typeof n.type === "function" && n.props.initial)!;
        expect(next.props.initial).toMatchObject({ kind: "simple", hasSaved: false, draft: { workingPattern: pattern } });
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it.each([null, undefined])("keeps the implicit calendar baseline when starting from a legacy timeline (%s)", async workingPattern => {
        const selected = { ...project, programme_working_pattern: workingPattern,
            gantt_phases: [{ name: "Existing job stage", duration_days: 3, start_date: "2026-10-16" }] };
        const start = nodes(parent({ project: selected })).find(n => typeof n.props.onStartSimple === "function")!;
        (start.props.onStartSimple as () => void)();
        const entry = nodes(parent({ project: selected })).find(n => typeof n.type === "function" && n.props.initial)!;
        const initial = entry.props.initial as { draft: Parameters<typeof initialProgrammeState>[0] };
        expect(initial.draft.workingPattern).toBeUndefined();
        hooks.state = initialProgrammeState({ ...initial.draft, startDate: "2026-10-16", duration: "2", unit: "days" }, false);
        const tree = (entry.type as (props: unknown) => Element)(entry.props);
        (nodes(tree).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("idle"));
        expect(hooks.save).toHaveBeenCalledTimes(1);
        expect(hooks.save.mock.calls[0][0]).not.toHaveProperty("workingPattern");
        expect(hooks.save.mock.calls[0][0]).not.toHaveProperty("expectedWorkingPattern");
    });

    it("switches to relative days without saving or losing the entered date, then submits only explicit relative intent", async () => {
        two();
        const select = nodes(editor()).find(n => n.type === "select" && n.props.id === "programme-time-basis")!;
        (select.props.onChange as (event: unknown) => void)({ target: { value: "relative" } });
        expect(hooks.state!.draft.startDate).toBe(project.start_date);
        expect(hooks.save).not.toHaveBeenCalled();
        const html = renderToStaticMarkup(editor());
        expect(html).toContain("Day 4 to Day 8"); expect(html).not.toContain('id="programme-start"');
        const form = nodes(editor()).find(n => n.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("idle"));
        expect(hooks.save).toHaveBeenCalledExactlyOnceWith({ timeBasis: "relative", startDate: "", stages: [
            { name: "Remove old kitchen", workingDays: 3, unit: "days", source: 0 },
            { name: "Fit new kitchen", workingDays: 5, unit: "weeks", source: 1 },
        ] });
        (nodes(editor()).find(n => n.type === "select" && n.props.id === "programme-time-basis")!.props.onChange as (event: unknown) => void)({ target: { value: "dated" } });
        expect(hooks.state!.draft.startDate).toBe(project.start_date);
        expect(renderToStaticMarkup(editor())).toContain('id="programme-start"');
        expect(hooks.save).toHaveBeenCalledTimes(1);
    });

    it("does not open the legacy dated planner over a saved relative programme", () => {
        const html = renderToStaticMarkup(parent({ project: { ...project, programme_phases: [
            { name: "Fit door", manualDays: 1, timeBasis: "relative_working_days", workingDayOffset: 0 },
        ] } }));
        expect(html).toContain("data-relative-planner-note");
        expect(html).not.toContain("Detailed programme planner");
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it.each(["light", "dark"])("shows the preview before timing/activity fields in %s without writes", theme => {
        hooks.theme = theme;
        const html = renderToStaticMarkup(editor());
        expect(html.indexOf('data-programme-preview')).toBeGreaterThan(-1);
        expect(html.indexOf('data-programme-preview')).toBeLessThan(html.indexOf('id="programme-when-title"'));
        expect(html).toContain("Programme at a glance");
        expect(hooks.save).not.toHaveBeenCalled(); expect(hooks.dispatch).not.toHaveBeenCalled();
    });

    it("adds just one blank activity on explicit choice, without saving", () => {
        const button = nodes(editor()).find(n => n.type === "button" && renderToStaticMarkup(n).includes("Break the job into stages"))!;
        (button.props.onClick as () => void)();
        expect(hooks.state!.draft.stages).toHaveLength(1);
        expect(hooks.state!.draft.stages[0]).toMatchObject({ name: "", duration: "" });
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it("previews named two-stage edits but only submits through the existing explicit save", async () => {
        two();
        const before = JSON.stringify(hooks.state!.saved);
        const unit = nodes(editor()).find(n => n.type === "select" && n.props.id === "stage-saved-1-unit")!;
        (unit.props.onChange as (event: unknown) => void)({ target: { value: "days" } });
        const field = nodes(editor()).find(n => n.type === "input" && n.props.id === "stage-saved-1-duration")!;
        (field.props.onChange as (event: unknown) => void)({ target: { value: "2" } });
        expect(JSON.stringify(hooks.state!.saved)).toBe(before); expect(hooks.save).not.toHaveBeenCalled();
        const html = renderToStaticMarkup(editor());
        expect(html).toContain("data-programme-overview"); expect(html).toContain("Not saved yet");
        const form = nodes(editor()).find(n => n.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("idle"));
        expect(hooks.save).toHaveBeenCalledExactlyOnceWith({ startDate: "2026-10-19", stages: [
            { name: "Remove old kitchen", workingDays: 3, unit: "days", source: 0 },
            { name: "Fit new kitchen", workingDays: 2, unit: "days", source: 1 },
        ] });
    });

    it("retains two activities and shows a retry after an unconfirmed save", async () => {
        two(); hooks.save.mockResolvedValueOnce({ success: false, error: "Save not confirmed" });
        const form = nodes(editor()).find(n => n.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
        await vi.waitFor(() => expect(hooks.state!.save.status).toBe("failed"));
        expect(hooks.state!.draft.stages).toHaveLength(2);
        expect(renderToStaticMarkup(editor())).toContain("Save not confirmed");
        expect(renderToStaticMarkup(editor())).toContain("Try again");
    });

    it("keeps a locked programme read-only and detailed planning closed", () => {
        const html = renderToStaticMarkup(parent({ project: { ...project, programme_phases: [{ name: "Replace door", manualDays: 1, startOffset: 0 }] }, lockReason: "This project is locked." }));
        expect(html).toContain("This project is locked.");
        expect(html).toContain("data-programme-overview"); expect(html).toContain("Replace door");
        expect(html).not.toContain("Save programme"); expect(html).not.toContain("Detailed programme planner");
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it("fences repeated submits from either Save button while the existing action is pending", async () => {
        two(); let release!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        hooks.save.mockImplementation(async () => { await pending; return { success: true }; });
        const form = nodes(editor()).find(n => n.type === "form")!;
        const submit = form.props.onSubmit as (event: unknown) => void;
        submit({ preventDefault: vi.fn() }); submit({ preventDefault: vi.fn() });
        expect(hooks.save).toHaveBeenCalledTimes(1);
        const buttons = nodes(editor()).filter(n => n.type === "button" && n.props.type === "submit");
        expect(buttons).toHaveLength(2); expect(buttons.every(n => n.props.disabled)).toBe(true);
        release(); await vi.waitFor(() => expect(hooks.state!.save.status).toBe("idle"));
    });

    it("toggles the actual Sunday checkbox independently of Saturday: Sunday-only, both-on, and unchecking Saturday alone", () => {
        hooks.state = initialProgrammeState({ ...emptyProgrammeDraft("2026-10-16"), duration: "2", unit: "days" }, true);
        const dayBox = (day: number) => nodes(editor()).find(n => n.type === "input" && n.props.id === `programme-weekend-${day}`)!;
        // Default Monday-Friday: both weekend boxes are off and a Friday start
        // plus 2 working days lands on the Monday.
        expect(dayBox(0).props.checked).toBe(false);
        expect(dayBox(6).props.checked).toBe(false);
        expect(renderToStaticMarkup(editor())).toContain("19 October 2026");
        // Sunday-only is a different calendar from Saturday: day 1 is Friday
        // 16 October and day 2 is Sunday 18 October, not Saturday 17 October.
        (dayBox(0).props.onChange as (event: unknown) => void)({ target: { checked: true } });
        expect(hooks.state!.draft.workingPattern).toEqual({ version: 1, weekdays: [0, 1, 2, 3, 4, 5] });
        expect(dayBox(0).props.checked).toBe(true);
        expect(dayBox(6).props.checked).toBe(false);
        expect(renderToStaticMarkup(editor())).toContain("18 October 2026");
        expect(renderToStaticMarkup(editor())).not.toContain("17 October 2026");
        expect(hooks.save).not.toHaveBeenCalled();
        // Both weekend days on: the same Friday plus 2 working days now ends
        // on Saturday, a day earlier than the Sunday-only week.
        (dayBox(6).props.onChange as (event: unknown) => void)({ target: { checked: true } });
        expect(hooks.state!.draft.workingPattern).toEqual({ version: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] });
        expect(dayBox(0).props.checked).toBe(true);
        expect(dayBox(6).props.checked).toBe(true);
        expect(renderToStaticMarkup(editor())).toContain("17 October 2026");
        // Unchecking Saturday alone returns to the exact Sunday-only week,
        // with Sunday still on: it is not a weekday-count toggle.
        (dayBox(6).props.onChange as (event: unknown) => void)({ target: { checked: false } });
        expect(hooks.state!.draft.workingPattern).toEqual({ version: 1, weekdays: [0, 1, 2, 3, 4, 5] });
        expect(dayBox(0).props.checked).toBe(true);
        expect(dayBox(6).props.checked).toBe(false);
        expect(renderToStaticMarkup(editor())).toContain("18 October 2026");
        expect(hooks.save).not.toHaveBeenCalled();
    });

    it("refreshes the proposal route after Next: Proposal so saved working days are not stale", async () => {
        two();
        const next = nodes(editor()).find(n => n.type === "button"
            && String(Array.isArray(n.props.children) ? n.props.children[0] : n.props.children).startsWith("Next: Proposal"));
        expect(next).toBeDefined();
        await (next!.props.onClick as () => void)();
        expect(hooks.router.push).toHaveBeenCalledWith(
            "/dashboard/projects/proposal?projectId=11111111-1111-4111-8111-111111111111",
        );
        expect(hooks.router.refresh).toHaveBeenCalledTimes(1);
    });

    it("restores leave protection and allows Next retry without another save when navigation fails", async () => {
        two();
        hooks.router.push.mockImplementation(() => {
            throw new Error("navigation blocked");
        });
        const next = nodes(editor()).find(n => n.type === "button"
            && String(Array.isArray(n.props.children) ? n.props.children[0] : n.props.children).startsWith("Next: Proposal"));
        expect(next).toBeDefined();
        (next!.props.onClick as () => void)();
        await vi.waitFor(() => expect(renderToStaticMarkup(editor())).toContain("data-programme-leave-error"));
        await vi.waitFor(() => expect(hooks.save).not.toHaveBeenCalled());
        expect(hooks.slots[7]).toBe(false);
        const beforeEdit = renderToStaticMarkup(editor());
        expect(beforeEdit).toMatch(/If you have made newer edits/i);
        expect(beforeEdit).not.toMatch(/edits made since then/i);
        expect(beforeEdit).not.toMatch(/still saved here/i);
        const savesBeforeEdit = hooks.save.mock.calls.length;
        const stageDuration = nodes(editor()).find(n => n.props.id === "stage-saved-0-duration");
        expect(stageDuration).toBeDefined();
        (stageDuration!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "4" } });
        const afterEdit = renderToStaticMarkup(editor());
        expect(afterEdit).not.toMatch(/still saved here/i);
        expect(afterEdit).toMatch(/last save/i);
        expect(afterEdit).toMatch(/newer edits|not saved yet/i);
        expect(hooks.save.mock.calls.length).toBe(savesBeforeEdit);
        hooks.router.push.mockImplementation(() => undefined);
        (next!.props.onClick as () => void)();
        await vi.waitFor(() => expect(hooks.router.push).toHaveBeenCalledTimes(2));
        expect(hooks.save).toHaveBeenCalledTimes(savesBeforeEdit + 1);
        expect(hooks.router.refresh).toHaveBeenCalledTimes(1);
    });

    it("restores leave protection when refresh fails after a successful push, then retries in order without replaying the save", async () => {
        two();
        hooks.router.refresh.mockImplementation(() => {
            throw new Error("refresh failed");
        });
        const next = nodes(editor()).find(n => n.type === "button"
            && String(Array.isArray(n.props.children) ? n.props.children[0] : n.props.children).startsWith("Next: Proposal"));
        expect(next).toBeDefined();
        (next!.props.onClick as () => void)();
        await vi.waitFor(() => expect(renderToStaticMarkup(editor())).toContain("data-programme-leave-error"));
        // The push succeeded exactly once for the right project before the
        // refresh threw; nothing saved again and no automatic second navigation.
        expect(hooks.router.push).toHaveBeenCalledTimes(1);
        expect(hooks.router.push).toHaveBeenCalledWith(
            "/dashboard/projects/proposal?projectId=11111111-1111-4111-8111-111111111111",
        );
        expect(hooks.router.refresh).toHaveBeenCalledTimes(1);
        expect(hooks.router.push.mock.invocationCallOrder[0]).toBeLessThan(hooks.router.refresh.mock.invocationCallOrder[0]);
        await vi.waitFor(() => expect(hooks.save).not.toHaveBeenCalled());
        expect(hooks.slots[7]).toBe(false);
        // The failure copy stays honest once a newer unsaved copy exists.
        const stageDuration = nodes(editor()).find(n => n.props.id === "stage-saved-0-duration");
        expect(stageDuration).toBeDefined();
        (stageDuration!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "4" } });
        const afterEdit = renderToStaticMarkup(editor());
        expect(afterEdit).not.toMatch(/still saved here/i);
        expect(afterEdit).toMatch(/last save/i);
        expect(afterEdit).toMatch(/newer edits|not saved yet/i);
        expect(hooks.save).not.toHaveBeenCalled();
        // Clear the refresh failure and retry deliberately: one save of the
        // edited draft, then push, then refresh; no replay of the confirmed save.
        hooks.router.refresh.mockImplementation(() => undefined);
        const retry = nodes(editor()).find(n => n.type === "button" && renderToStaticMarkup(n).includes("Try again"))!;
        (retry.props.onClick as () => void)();
        await vi.waitFor(() => expect(hooks.save).toHaveBeenCalledTimes(1));
        expect(hooks.save).toHaveBeenCalledExactlyOnceWith({ startDate: "2026-10-19", stages: [
            { name: "Remove old kitchen", workingDays: 4, unit: "days", source: 0 },
            { name: "Fit new kitchen", workingDays: 5, unit: "weeks", source: 1 },
        ] });
        await vi.waitFor(() => expect(hooks.router.push).toHaveBeenCalledTimes(2));
        expect(hooks.router.refresh).toHaveBeenCalledTimes(2);
        expect(hooks.save.mock.invocationCallOrder[0]).toBeLessThan(hooks.router.push.mock.invocationCallOrder[1]);
        expect(hooks.router.push.mock.invocationCallOrder[1]).toBeLessThan(hooks.router.refresh.mock.invocationCallOrder[1]);
        await vi.waitFor(() => expect(renderToStaticMarkup(editor())).not.toContain("data-programme-leave-error"));
        expect(hooks.slots[7]).toBe(true);
        expect(hooks.save).toHaveBeenCalledTimes(1);
    });
});
