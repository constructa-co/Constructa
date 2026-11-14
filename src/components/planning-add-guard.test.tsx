import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

// The add forms' state and the panel's guard are driven by hand, as the other
// parent tests do, so a second press can be made before any render has recorded
// the first. Refs keep their identity between renders, as React's do.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, refs: [] as Array<{ current: unknown }>, refCursor: 0 }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useId: () => "planning-test",
    useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
    useRef: (initial: unknown) => {
        const i = hooks.refCursor++;
        if (!hooks.refs[i]) hooks.refs[i] = { current: initial };
        return hooks.refs[i];
    },
    useState: (initial: unknown) => {
        const i = hooks.cursor++;
        if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
        return [hooks.slots[i], (next: unknown) => { hooks.slots[i] = typeof next === "function" ? next(hooks.slots[i]) : next; }];
    },
}));
import PlanningConversationPanel from "./planning-conversation-panel";
import { createPlanningConversation, type PlanningConversation, type PlanningGenerator } from "@/lib/planning-conversation";
import type { AddPlanningItemResult, PlanningProgrammeItem } from "@/lib/planning-programme-item";
import { workspaceStyles } from "@/lib/workspace-styles";

type Element = ReactElement<Record<string, unknown>>;
type OnAdd = (item: PlanningProgrammeItem) => Promise<AddPlanningItemResult>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
const project = { id: "job", name: "Job", start_date: "2026-11-02", programme_phases: [{ name: "Groundworks", manualDays: 10, startOffset: 0 }] };
const reply = {
    message: "Order early.", questions: [],
    suggestions: [
        { topic: "procurement" as const, title: "Order windows", stage: "Groundworks", timing: null },
        { topic: "procurement" as const, title: "Order doors", stage: "Groundworks", timing: null },
    ],
};

async function replied() {
    const session = createPlanningConversation(() => ({ project, hasOpenWork: false }), vi.fn<PlanningGenerator>().mockResolvedValue(reply));
    session.setMessage("What should I order first?");
    await session.send();
    return session;
}

/** Each suggestion's add form, rendered in order so their hooks take successive slots (the panel holds no state of its own). */
function forms(session: PlanningConversation, onAdd: OnAdd) {
    hooks.cursor = 0; hooks.refCursor = 0;
    const tree = PlanningConversationPanel({ session, blocked: false, onAdd, s: workspaceStyles(true) });
    return nodes(tree).filter(n => typeof n.type === "function" && n.props.suggestion).map(n => (n.type as (props: unknown) => Element)(n.props));
}
const button = (tree: Element, label: string) => nodes(tree).find(n => n.type === "button" && String(n.props.children).includes(label))!;
const press = (tree: Element, label: string) => (button(tree, label).props.onClick as () => void)();
const type = (tree: Element, suffix: string, value: string) =>
    (nodes(tree).find(n => String(n.props.id).endsWith(suffix))!.props.onChange as (event: unknown) => void)({ target: { value } });

/** Opens both suggestions' forms and gives each a length. */
function openBoth(session: PlanningConversation, onAdd: OnAdd) {
    press(forms(session, onAdd)[0], "Add to programme");
    press(forms(session, onAdd)[1], "Add to programme");
    type(forms(session, onAdd)[0], "-1-0-duration", "2");
    type(forms(session, onAdd)[1], "-1-1-duration", "2");
}

beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.refs = []; hooks.refCursor = 0; });

describe("adding a suggestion: one add at a time, decided before any render", () => {
    it("sends one add for two presses in the same tick, and none from another suggestion while it is sent", async () => {
        const session = await replied();
        let release!: (result: AddPlanningItemResult) => void;
        const onAdd = vi.fn<OnAdd>()
            .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
            .mockResolvedValue({ ok: true, name: "Order doors" });
        openBoth(session, onAdd);

        const [windows, doors] = forms(session, onAdd);
        // Neither press can see the other's busy state: no render happens between them.
        press(windows, "Add and save"); press(windows, "Add and save");
        press(doors, "Add and save");
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd).toHaveBeenCalledWith({ name: "Order windows", duration: "2", unit: "weeks" });

        release({ ok: true, name: "Order windows" });
        await vi.waitFor(() => expect(renderToStaticMarkup(forms(session, onAdd)[0])).toContain("Added to your programme"));
        // Released once the first add finished, so the other suggestion can now be sent.
        press(doors, "Add and save");
        expect(onAdd).toHaveBeenCalledTimes(2);
    });

    it("releases the guard when an add is refused or throws, so the contractor can try again", async () => {
        const session = await replied();
        const onAdd = vi.fn<OnAdd>()
            .mockResolvedValueOnce({ ok: false, error: "Not saved" })
            .mockRejectedValueOnce(new Error("network"))
            .mockResolvedValue({ ok: true, name: "Order windows" });
        openBoth(session, onAdd);

        press(forms(session, onAdd)[0], "Add and save");
        await vi.waitFor(() => expect(renderToStaticMarkup(forms(session, onAdd)[0])).toContain("Not saved"));
        press(forms(session, onAdd)[0], "Add and save");
        await vi.waitFor(() => expect(renderToStaticMarkup(forms(session, onAdd)[0])).toContain("Nothing has been changed"));
        press(forms(session, onAdd)[0], "Add and save");
        await vi.waitFor(() => expect(renderToStaticMarkup(forms(session, onAdd)[0])).toContain("Added to your programme"));
        expect(onAdd).toHaveBeenCalledTimes(3);
    });
});
