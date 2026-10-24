import type { FormEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[], refs: [] as Array<{ current: unknown }>, stateIndex: 0, refIndex: 0,
    guard: vi.fn(), push: vi.fn(), create: vi.fn(), timeout: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.stateIndex++;
        if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
        return [hooks.states[index], (value: unknown) => {
            hooks.states[index] = typeof value === "function" ? value(hooks.states[index]) : value;
        }];
    },
    useRef: (initial: unknown) => {
        const index = hooks.refIndex++;
        return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: hooks.guard }));
vi.mock("./actions", () => ({ createBlankProjectAction: hooks.create }));

import NewProjectForm from "./new-project-form";
import { EMPTY_BLANK_PROJECT_FORM } from "@/lib/blank-project";

type Node = ReactElement<{
    children?: ReactNode; id?: string; value?: string;
    disabled?: boolean;
    onClick?: () => void; onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: FormEvent) => void;
}>;
function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function render() {
    hooks.stateIndex = 0; hooks.refIndex = 0;
    return NewProjectForm({ isFirstProject: true });
}
function edit(name: string, value: string) {
    nodes(render()).find(n => n.props.id === `new-project-${name}`)!.props.onChange!({ target: { value } });
}
function warns() { render(); return hooks.guard.mock.calls.at(-1)?.[0]; }
function submit() {
    nodes(render()).find(n => n.type === "form")!.props.onSubmit!({ preventDefault: vi.fn() } as unknown as FormEvent);
}

beforeEach(() => {
    hooks.states = []; hooks.refs = [];
    hooks.guard.mockClear(); hooks.push.mockReset(); hooks.create.mockReset(); hooks.timeout.mockReset();
    vi.stubGlobal("window", { setTimeout: hooks.timeout });
});
afterEach(() => vi.unstubAllGlobals());

describe("new job unsaved-entry boundary", () => {
    it("offers editable job wording with optional examples rather than requiring a dropdown choice", () => {
        nodes(render()).find(n => n.type === "button" && n.props.onClick)!.props.onClick!();
        const html = renderToStaticMarkup(render());
        expect(html).toMatch(/<input[^>]*id="new-project-projectType"[^>]*list="new-project-type-examples"/);
        expect(html).not.toMatch(/<select[^>]*id="new-project-projectType"/);
        expect(html).toContain('placeholder="Not sure yet"');
        expect(html.match(/<datalist id="new-project-type-examples">[\s\S]*?<\/datalist>/)![0].match(/<option\b/g)).toHaveLength(8);
        expect(hooks.create).not.toHaveBeenCalled();
    });

    it.each(["Kitchen worktop repairs", "Residential Extension", "  Specialist timber repairs  ", "", "Other"])("keeps raw custom type %j until the existing explicit create", async value => {
        nodes(render()).find(n => n.type === "button" && n.props.onClick)!.props.onClick!();
        edit("name", "Local job"); edit("client", "Synthetic client"); edit("projectType", value);
        expect(nodes(render()).find(n => n.props.id === "new-project-projectType")!.type).toBe("input");
        expect(nodes(render()).find(n => n.props.id === "new-project-projectType")!.props.value).toBe(value);
        expect(hooks.create).not.toHaveBeenCalled();
        hooks.create.mockResolvedValue({ success: false, error: "Unconfirmed" });
        submit();
        await vi.waitFor(() => expect(hooks.refs[0].current).toBe(false));
        expect(hooks.create).toHaveBeenCalledOnce();
        expect(hooks.create.mock.calls[0][0].get("projectType")).toBe(value);
        expect(nodes(render()).find(n => n.props.id === "new-project-projectType")!.props.value).toBe(value);
        expect(warns()).toBe(true);
    });

    it("keeps the existing custom-type validation failure local without truncating typed text", () => {
        nodes(render()).find(n => n.type === "button" && n.props.onClick)!.props.onClick!();
        edit("name", "Local job"); edit("client", "Synthetic client"); edit("projectType", "x".repeat(101));
        submit();
        expect(hooks.create).not.toHaveBeenCalled();
        expect(nodes(render()).find(n => n.props.id === "new-project-projectType")!.props.value).toBe("x".repeat(101));
        expect(renderToStaticMarkup(render())).toContain("That job type is too long.");
    });

    it("leaves a blank form clean", () => { expect(warns()).toBe(false); });

    it("offers no rough-value entry, keeping the existing blank creation default", async () => {
        nodes(render()).find(n => n.type === "button" && n.props.onClick)!.props.onClick!();
        expect(nodes(render()).find(n => n.props.id === "new-project-potentialValue")).toBeUndefined();
        expect(renderToStaticMarkup(render())).not.toContain("Rough value");
        edit("name", "Local job"); edit("client", "Synthetic client");
        hooks.create.mockResolvedValueOnce({ success: true, projectId: "default-job" });
        submit();
        await vi.waitFor(() => expect(hooks.push).toHaveBeenCalled());
        expect(hooks.create.mock.calls[0][0].get("potentialValue")).toBe("");
    });

    it.each(Object.keys(EMPTY_BLANK_PROJECT_FORM).filter(name => name !== "potentialValue"))("protects %s typing, including optional entries", name => {
        nodes(render()).find(n => n.type === "button" && n.props.onClick)!.props.onClick!();
        edit(name, "Local entry");
        expect(warns()).toBe(true);
        edit(name, "");
        expect(warns()).toBe(false);
    });

    it("keeps validation failures protected without sending a request", () => {
        edit("name", "Local job"); submit();
        expect(hooks.create).not.toHaveBeenCalled();
        expect(warns()).toBe(true);
    });

    it("protects pending and rejected requests, reusing the original request id on retry", async () => {
        edit("name", "Local job"); edit("client", "Synthetic client");
        let finish!: (result: { success: false; error: string }) => void;
        hooks.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        submit();
        expect(warns()).toBe(true);
        finish({ success: false, error: "Unconfirmed" });
        await vi.waitFor(() => expect(hooks.refs[0].current).toBe(false));
        expect(warns()).toBe(true);
        hooks.create.mockRejectedValueOnce(Error("Unknown reply")); submit();
        await vi.waitFor(() => expect(hooks.refs[0].current).toBe(false));
        expect(warns()).toBe(true);
        expect(hooks.create.mock.calls[1][0].get("requestId")).toBe(hooks.create.mock.calls[0][0].get("requestId"));
        expect(nodes(render()).find(n => n.props.id === "new-project-name")!.props.value).toBe("Local job");
        expect(hooks.push).not.toHaveBeenCalled();
    });

    it("explains the submitted snapshot while pending without locking or discarding later typing", async () => {
        expect(renderToStaticMarkup(render())).not.toContain("data-job-pending-help");
        nodes(render()).find(n => n.type === "button" && n.props.onClick)!.props.onClick!();
        edit("name", "Submitted local job"); edit("client", "Synthetic client");
        let finish!: (result: { success: false; error: string }) => void;
        hooks.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        submit();
        const html = renderToStaticMarkup(render());
        expect(html).toContain('role="status"');
        expect(html).toContain("Creating from the details you submitted.");
        expect(html).toContain("Changes typed while this is in progress are not included in that request.");
        for (const name of Object.keys(EMPTY_BLANK_PROJECT_FORM).filter(name => name !== "potentialValue")) {
            expect(nodes(render()).find(n => n.props.id === `new-project-${name}`)!.props.disabled).not.toBe(true);
        }
        edit("name", "Later local name"); edit("siteAddress", "Later synthetic site");
        const sent = hooks.create.mock.calls[0][0] as FormData;
        expect(sent.get("name")).toBe("Submitted local job");
        expect(sent.get("siteAddress")).toBe("");
        submit();
        expect(hooks.create).toHaveBeenCalledOnce();
        expect(warns()).toBe(true);
        finish({ success: false, error: "Unconfirmed" });
        await vi.waitFor(() => expect(hooks.refs[0].current).toBe(false));
        expect(renderToStaticMarkup(render())).not.toContain("data-job-pending-help");
        expect(nodes(render()).find(n => n.props.id === "new-project-name")!.props.value).toBe("Later local name");
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("Later synthetic site");
        expect(hooks.push).not.toHaveBeenCalled();
    });

    it("releases only after the existing action confirms creation, preserving the Brief handoff", async () => {
        edit("name", "Local job"); edit("client", "Synthetic client");
        hooks.create.mockResolvedValue({ success: true, projectId: "test-job" });
        submit();
        await vi.waitFor(() => expect(hooks.push).toHaveBeenCalledWith("/dashboard/projects/brief?projectId=test-job"));
        expect(warns()).toBe(false);
        expect(hooks.timeout).toHaveBeenCalledOnce();
        expect(Array.from(hooks.create.mock.calls[0][0].keys()).sort()).toEqual([...Object.keys(EMPTY_BLANK_PROJECT_FORM), "requestId"].sort());
    });

    it("explains the same-request retry after an unknown reply without changing what later typing sends", async () => {
        edit("name", "Original local job"); edit("client", "Synthetic client");
        hooks.create.mockRejectedValueOnce(Error("Reply lost"));
        submit();
        await vi.waitFor(() => expect(hooks.refs[0].current).toBe(false));
        const html = renderToStaticMarkup(render());
        expect(html).toContain("A missing reply does not prove whether a project was created.");
        expect(html).toContain("Try again uses the same request.");
        expect(html).toContain("changes you made here afterwards are not applied to it.");
        edit("name", "Later local edit");
        expect(nodes(render()).find(n => n.props.id === "new-project-name")!.props.value).toBe("Later local edit");
        hooks.create.mockResolvedValueOnce({ success: true, projectId: "already-created" });
        submit();
        await vi.waitFor(() => expect(hooks.push).toHaveBeenCalledWith("/dashboard/projects/brief?projectId=already-created"));
        expect(hooks.create.mock.calls[1][0].get("requestId")).toBe(hooks.create.mock.calls[0][0].get("requestId"));
        expect(hooks.create.mock.calls[0][0].get("name")).toBe("Original local job");
        expect(hooks.create.mock.calls[1][0].get("name")).toBe("Later local edit");
    });

    it("does not present the unknown-reply explanation for a different returned error", async () => {
        expect(renderToStaticMarkup(render())).not.toContain("Try again uses the same request.");
        edit("name", "Local job"); edit("client", "Synthetic client");
        hooks.create.mockResolvedValueOnce({ success: false, error: "This action is not available." });
        submit();
        await vi.waitFor(() => expect(hooks.refs[0].current).toBe(false));
        const html = renderToStaticMarkup(render());
        expect(html).toContain("This action is not available.");
        expect(html).not.toContain("Try again uses the same request.");
    });
});
