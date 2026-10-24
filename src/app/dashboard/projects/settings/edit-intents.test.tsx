import type { FormEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[], refs: [] as Array<{ current: unknown }>, si: 0, ri: 0,
    pending: false, tasks: [] as Promise<void>[], layouts: [] as Array<() => void>, effects: [] as Array<() => void | (() => void)>,
    details: vi.fn(), status: vi.fn(), warn: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.si++;
        if (!(index in hooks.states)) hooks.states[index] = initial;
        return [hooks.states[index], (value: unknown) => { hooks.states[index] = value; }];
    },
    useRef: (initial: unknown) => {
        const index = hooks.ri++;
        return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
    },
    useTransition: () => [hooks.pending, (task: () => Promise<void>) => {
        hooks.pending = true;
        hooks.tasks.push(task().finally(() => { hooks.pending = false; }));
    }],
    useLayoutEffect: (effect: () => void) => { hooks.layouts.push(effect); },
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
vi.mock("./actions", () => ({ updateProjectAction: hooks.details, updateProjectStatusAction: hooks.status }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: hooks.warn }));
import ClientProjectSettings from "./client-page";

type Props = { children?: ReactNode; "aria-label"?: string; disabled?: boolean; role?: string; ref?: (form: HTMLFormElement) => void; onSubmit?: (event: FormEvent<HTMLFormElement>) => void; onChange?: (event: { currentTarget: HTMLFormElement }) => void };
type Node = ReactElement<Props>;
type Form = HTMLFormElement & { data: FormData };
const NativeFormData = FormData;
let project: { id: string; name: string; status?: string; is_archived?: boolean };
let details: Form, status: Form;
function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function text(value: ReactNode): string {
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Node).props.children);
    return typeof value === "string" ? value : "";
}
function render() {
    hooks.si = 0; hooks.ri = 0; hooks.layouts = []; hooks.effects = [];
    const tree = ClientProjectSettings({ project });
    hooks.layouts.forEach(effect => effect());
    return tree;
}
function formNode(intent: "details" | "status") {
    return nodes(render()).find(node => node.type === "form" && node.props["aria-label"] === (intent === "details" ? "Job details" : "Project status"))!;
}
function change(intent: "details" | "status", key: string, value: string) {
    const form = intent === "details" ? details : status;
    form.data.set(key, value); formNode(intent).props.onChange!({ currentTarget: form });
}
function submit(intent: "details" | "status", captured = formNode(intent)) {
    const preventDefault = vi.fn();
    captured.props.onSubmit!({ preventDefault, currentTarget: intent === "details" ? details : status } as unknown as FormEvent<HTMLFormElement>);
    expect(preventDefault).toHaveBeenCalledOnce();
}
function pending(action: typeof hooks.details) {
    let finish!: (value: { success: boolean; lockReason?: string }) => void;
    action.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    return (value: { success: boolean; lockReason?: string }) => finish(value);
}
beforeEach(() => {
    hooks.states = []; hooks.refs = []; hooks.tasks = []; hooks.pending = false; vi.clearAllMocks();
    project = { id: "job", name: "Saved job", status: "Draft" };
    details = { data: new NativeFormData() } as Form; status = { data: new NativeFormData() } as Form;
    for (const [key, value] of Object.entries({ projectId: "job", name: "Saved job", project_type: "  Bespoke work  ", scope: "Exact\n  scope", potential_value: "0.125" })) details.data.set(key, value);
    status.data.set("projectId", "job"); status.data.set("status", "Draft");
    vi.stubGlobal("FormData", class extends NativeFormData {
        constructor(source?: Form) { super(); for (const [key, value] of source?.data ?? []) this.append(key, value); }
    });
    formNode("details").props.ref!(details); formNode("status").props.ref!(status);
});
afterEach(() => vi.unstubAllGlobals());

describe("settings independent form drafts and lock acknowledgement", () => {
    it("renders one protected form and one independent status form without duplicate status controls", () => {
        const tree = nodes(render());
        expect(tree.filter(node => node.type === "form")).toHaveLength(2);
        expect(nodes(formNode("details")).some(node => node.props["aria-label"] === "Project status")).toBe(false);
        expect(tree.filter(node => node.type === "fieldset")).toHaveLength(1);
    });
    it("status save submits only its form and cannot confirm protected draft text", async () => {
        change("details", "scope", "Unsaved\n  exact scope"); change("status", "status", "Review");
        hooks.status.mockResolvedValueOnce({ success: true }); submit("status"); await Promise.all(hooks.tasks);
        expect(Array.from(hooks.status.mock.calls[0][0].entries())).toEqual([["projectId", "job"], ["status", "Review"]]);
        expect(hooks.details).not.toHaveBeenCalled(); expect(details.data.get("scope")).toBe("Unsaved\n  exact scope");
        expect(text(formNode("details"))).toContain("Unsaved changes"); expect(text(formNode("status"))).toContain("Status saved");
        render(); expect(hooks.warn.mock.lastCall?.[0]).toBe(true);
    });
    it("protected save cannot acknowledge an independently changed status", async () => {
        change("status", "status", "Lost"); hooks.details.mockResolvedValueOnce({ success: true });
        submit("details"); await Promise.all(hooks.tasks);
        expect(hooks.details.mock.calls[0][0].has("status")).toBe(false);
        expect(text(formNode("status"))).toContain("Unsaved status change"); expect(hooks.status).not.toHaveBeenCalled();
    });
    it("allows status saves on an initially locked job while fencing a captured protected submit", async () => {
        const old = formNode("details"); project = { ...project, status: "Won" };
        expect(nodes(render()).find(node => node.type === "fieldset")?.props.disabled).toBe(true);
        submit("details", old); expect(hooks.details).not.toHaveBeenCalled();
        hooks.status.mockResolvedValueOnce({ success: true }); submit("status"); await Promise.all(hooks.tasks);
        expect(hooks.status).toHaveBeenCalledOnce();
    });
    it("retains exact draft text and refuses stale callbacks when a refreshed lock arrives", () => {
        change("details", "scope", "  Pending\n\n  text  "); const old = formNode("details");
        project = { ...project, is_archived: true }; render(); submit("details", old);
        expect(details.data.get("scope")).toBe("  Pending\n\n  text  "); expect(hooks.details).not.toHaveBeenCalled();
        expect(text(render())).toContain("Your current text remains here"); expect(hooks.warn.mock.lastCall?.[0]).toBe(true);
    });
    it("does not claim protected text saved when a lock arrives during the request", async () => {
        change("details", "name", "Unconfirmed name"); const finish = pending(hooks.details); submit("details");
        project = { ...project, status: "active" }; render(); finish({ success: true }); await Promise.all(hooks.tasks);
        expect(text(formNode("details"))).toContain("Saving could not be confirmed");
        expect(text(formNode("details"))).not.toContain("Submitted changes saved"); expect(details.data.get("name")).toBe("Unconfirmed name");
    });
    it("applies a server lock refusal immediately and keeps status available", async () => {
        const old = formNode("details"); hooks.details.mockResolvedValueOnce({ success: false, lockReason: "This project is archived. Restore it before editing pre-contract information." });
        submit("details", old); await Promise.all(hooks.tasks); submit("details", old);
        expect(hooks.details).toHaveBeenCalledOnce(); expect(nodes(render()).find(node => node.type === "fieldset")?.props.disabled).toBe(true);
        hooks.status.mockResolvedValueOnce({ success: true }); submit("status"); await Promise.all(hooks.tasks); expect(hooks.status).toHaveBeenCalledOnce();
    });
    it("reserves pending intent synchronously against duplicate or interleaved captured submits", async () => {
        const oldDetails = formNode("details"), oldStatus = formNode("status"); const finish = pending(hooks.details);
        submit("details", oldDetails); submit("details", oldDetails); submit("status", oldStatus);
        expect(hooks.details).toHaveBeenCalledOnce(); expect(hooks.status).not.toHaveBeenCalled();
        finish({ success: true }); await Promise.all(hooks.tasks);
    });
    it("also fences protected submits during a status request", async () => {
        const finish = pending(hooks.status); submit("status"); submit("details");
        expect(hooks.details).not.toHaveBeenCalled(); finish({ success: true }); await Promise.all(hooks.tasks);
    });
    it("retains a newer status selection after the submitted status is acknowledged", async () => {
        change("status", "status", "Review"); const finish = pending(hooks.status); submit("status");
        change("status", "status", "Lost"); finish({ success: true }); await Promise.all(hooks.tasks);
        expect(status.data.get("status")).toBe("Lost"); expect(text(formNode("status"))).toContain("Newer selection is still unsaved");
    });
    it.each([false, "reject"])("does not acknowledge an unconfirmed status response %j", async response => {
        change("status", "status", "Won");
        if (response === "reject") hooks.status.mockRejectedValueOnce(Error("Unknown")); else hooks.status.mockResolvedValueOnce({ success: false });
        submit("status"); await Promise.all(hooks.tasks);
        expect(text(formNode("status"))).toContain("could not be confirmed"); expect(status.data.get("status")).toBe("Won");
        expect(hooks.status).toHaveBeenCalledOnce(); expect(hooks.warn.mock.lastCall?.[0]).toBe(true);
    });
    it("does not apply a late result or stale callback after unmount", async () => {
        const old = formNode("details"); const cleanup = hooks.effects[0](); const finish = pending(hooks.details);
        submit("details", old); const before = [...hooks.states]; cleanup?.(); finish({ success: true }); await Promise.all(hooks.tasks);
        expect(hooks.states).toEqual(before); submit("details", old); expect(hooks.details).toHaveBeenCalledOnce();
    });
});
