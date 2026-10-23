import type { FormEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[], refs: [] as Array<{ current: unknown }>, stateIndex: 0, refIndex: 0,
    pending: false, tasks: [] as Promise<void>[], save: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.stateIndex++;
        if (!(index in hooks.states)) hooks.states[index] = initial;
        return [hooks.states[index], (value: unknown) => { hooks.states[index] = value; }];
    },
    useRef: (initial: unknown) => {
        const index = hooks.refIndex++;
        return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
    },
    useTransition: () => [hooks.pending, (task: () => Promise<void>) => {
        hooks.pending = true;
        hooks.tasks.push(task().finally(() => { hooks.pending = false; }));
    }],
    useEffect: vi.fn(),
    useLayoutEffect: vi.fn(),
}));
vi.mock("./actions", () => ({ updateProjectAction: hooks.save, updateProjectStatusAction: vi.fn() }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: vi.fn() }));

import ClientProjectSettings from "./client-page";

type Node = ReactElement<{ children?: ReactNode; role?: string; action?: unknown; ref?: (form: HTMLFormElement) => void; onSubmit?: (event: FormEvent<HTMLFormElement>) => void; onChange?: (event: { currentTarget: HTMLFormElement }) => void }>;
const NativeFormData = FormData;
let form: HTMLFormElement & { data: FormData };

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
    hooks.stateIndex = 0; hooks.refIndex = 0;
    return ClientProjectSettings({ project: { id: "job-b", name: "Example renovation" } });
}
function editor() { return nodes(render()).find(n => n.type === "form")!; }
function editName(name: string) {
    form.data.set("name", name);
    editor().props.onChange!({ currentTarget: form });
}
function submit() {
    const node = editor();
    expect(node.props.action).toBeUndefined();
    expect(node.props.onSubmit).toBeTypeOf("function");
    const preventDefault = vi.fn();
    node.props.onSubmit!({ preventDefault, currentTarget: form } as unknown as FormEvent<HTMLFormElement>);
    expect(preventDefault).toHaveBeenCalledOnce();
}

beforeEach(() => {
    hooks.states = []; hooks.refs = []; hooks.tasks = []; hooks.pending = false; hooks.save.mockReset();
    const data = new NativeFormData();
    for (const [key, value] of Object.entries({ projectId: "job-b", name: "Example renovation", project_type: "Domestic Renovation", start_date: "2026-10-19", potential_value: "", payment_terms: "21 days", client_name: "Example client", client_email: "", client_phone: "", client_address: "", site_address: "", scope: "" })) data.set(key, value);
    form = { data } as HTMLFormElement & { data: FormData };
    // Model only FormData's DOM constructor; field entries stay real FormData.
    vi.stubGlobal("FormData", class extends NativeFormData {
        constructor(source?: typeof form) {
            super();
            for (const [key, value] of source?.data ?? []) this.append(key, value);
        }
    });
    editor().props.ref!(form);
});
afterEach(() => vi.unstubAllGlobals());

describe("settings save feedback and reset boundary", () => {
    it.each(["Kitchen worktop repairs", "Domestic Renovation", "  Specialist timber repairs  ", "", "Other"])("submits custom type %j only through the existing settings Save", async value => {
        form.data.set("project_type", value);
        editor().props.onChange!({ currentTarget: form });
        expect(hooks.save).not.toHaveBeenCalled();
        hooks.save.mockResolvedValue({ success: false });
        submit(); await Promise.all(hooks.tasks);
        expect(hooks.save).toHaveBeenCalledOnce();
        expect(hooks.save.mock.calls[0][0].get("project_type")).toBe(value);
        expect(form.data.get("project_type")).toBe(value);
    });

    it("keeps a rejected submission local and reports an unconfirmed save", async () => {
        editName("Local settings failure check");
        const submitted = Array.from(form.data.entries());
        hooks.save.mockResolvedValue({ success: false });
        submit(); await Promise.all(hooks.tasks);
        expect(Array.from(hooks.save.mock.calls[0][0].entries())).toEqual(submitted);
        expect(Array.from(form.data.entries())).toEqual(submitted);
        expect(text(nodes(render()).find(n => n.props.role === "alert"))).toContain("Saving could not be confirmed");
        expect(hooks.pending).toBe(false);
    });

    it("catches an unknown reply without claiming nothing was written", async () => {
        editName("Unconfirmed local name");
        hooks.save.mockRejectedValue(Error("Connection interrupted"));
        submit(); await Promise.all(hooks.tasks);
        const message = text(nodes(render()).find(n => n.props.role === "alert"));
        expect(message).toContain("Saving could not be confirmed");
        expect(message).not.toContain("Nothing was saved");
        expect(form.data.get("name")).toBe("Unconfirmed local name");
    });

    it("confirms only the submitted snapshot, leaving newer edits unsaved", async () => {
        editName("Submitted local name");
        let finish!: (result: { success: boolean }) => void;
        hooks.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        submit();
        editName("Newer local name");
        finish({ success: true }); await Promise.all(hooks.tasks);
        expect(form.data.get("name")).toBe("Newer local name");
        expect(text(nodes(render()).find(n => n.props.role === "status"))).toContain("Newer edits are still unsaved");
    });

    it("can retry the current draft and report a confirmed matching snapshot", async () => {
        editName("Retry local name");
        hooks.save.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
        submit(); await Promise.all(hooks.tasks);
        submit(); await Promise.all(hooks.tasks);
        expect(hooks.save).toHaveBeenCalledTimes(2);
        expect(text(nodes(render()).find(n => n.props.role === "status"))).toBe("Saved");
        expect(nodes(render()).some(n => n.props.role === "alert")).toBe(false);
    });
});
