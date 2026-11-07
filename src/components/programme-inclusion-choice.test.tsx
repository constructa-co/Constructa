import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { workspaceStyles } from "@/lib/workspace-styles";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useState: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = initial;
        return [hooks.slots[i], (value: unknown) => { hooks.slots[i] = value; }]; },
    useRef: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = { current: initial }; return hooks.slots[i]; },
}));
import Choice from "./programme-inclusion-choice";
type Props = Parameters<typeof Choice>[0];
type Node = ReactElement<Record<string, unknown>>;
const nodes = (value: unknown): Node[] => {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const n = value as Node; return [n, ...nodes(n.props.children)];
};
function render(props: Partial<Props> = {}) {
    hooks.cursor = 0;
    const all: Props = { included: true, disabled: false, canChange: () => true,
        save: vi.fn().mockResolvedValue({ success: true, programmePhases: [] }),
        onConfirmed: vi.fn(), onPending: vi.fn(), s: workspaceStyles(true), ...props };
    return { node: Choice(all), props: all };
}
const click = (node: Node) => (nodes(node).find(n => n.type === "button")!.props.onClick as () => void)();
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; });

it("makes no request on opening and explains the deliberate choice", () => {
    const { node, props } = render();
    expect(renderToStaticMarkup(node)).toContain("Omit programme from proposal");
    expect(props.save).not.toHaveBeenCalled();
});
it("refuses unsaved work and disabled/locked controls without sending", () => {
    const { node, props } = render({ canChange: () => false }); click(node);
    expect(props.save).not.toHaveBeenCalled(); expect(renderToStaticMarkup(render(props).node)).toContain("Save your programme edits");
    hooks.slots = [];
    const locked = render({ disabled: true }); click(locked.node); expect(locked.props.save).not.toHaveBeenCalled();
});
it("fences duplicate clicks and changes the displayed project only after confirmation", async () => {
    let release!: (value: unknown) => void;
    const save = vi.fn().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const first = render({ save }); click(first.node); click(first.node);
    expect(save).toHaveBeenCalledExactlyOnceWith(false); expect(first.props.onConfirmed).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render(first.props).node)).toContain("Saving choice...");
    release({ success: true, programmePhases: [{ programmeIntent: "omit", intent_version: 1 }] });
    await vi.waitFor(() => expect(first.props.onConfirmed).toHaveBeenCalledWith([{ programmeIntent: "omit", intent_version: 1 }]));
    expect(first.props.onPending).toHaveBeenLastCalledWith(false);
});
it("keeps the current screen on failure and allows an explicit retry", async () => {
    const save = vi.fn().mockResolvedValueOnce({ success: false, error: "Choice not confirmed" }).mockResolvedValueOnce({ success: true, programmePhases: [] });
    const first = render({ included: false, save }); click(first.node);
    await vi.waitFor(() => expect(first.props.onPending).toHaveBeenLastCalledWith(false));
    expect(first.props.onConfirmed).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render(first.props).node)).toContain("Choice not confirmed");
    click(render(first.props).node); await vi.waitFor(() => expect(first.props.onConfirmed).toHaveBeenCalledWith([]));
    expect(save).toHaveBeenLastCalledWith(true);
});
it("retains newer unsaved work rather than unmounting it after a late confirmation", async () => {
    let dirty = false, release!: (value: unknown) => void;
    const first = render({ canChange: () => !dirty, save: vi.fn().mockImplementation(() => new Promise(resolve => { release = resolve; })) });
    click(first.node); dirty = true; release({ success: true, programmePhases: [] });
    await vi.waitFor(() => expect(first.props.onPending).toHaveBeenLastCalledWith(false));
    expect(first.props.onConfirmed).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render(first.props).node)).toContain("newer unsaved edits were retained");
});
