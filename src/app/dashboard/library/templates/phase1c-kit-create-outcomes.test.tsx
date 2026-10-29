import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
    slots: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    cursor: 0,
    refCursor: 0,
    refresh: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = hook.cursor++;
        if (!(i in hook.slots)) hook.slots[i] = initial;
        return [
            hook.slots[i],
            (next: unknown) => {
                hook.slots[i] = typeof next === "function" ? (next as (v: unknown) => unknown)(hook.slots[i]) : next;
            },
        ];
    },
    useRef: (initial: unknown) => {
        const i = hook.refCursor++;
        if (!(i in hook.refs)) hook.refs[i] = { current: initial };
        return hook.refs[i];
    },
}));
vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({ from: () => ({ select: () => ({ order: async () => ({ data: [] }) }) }) }),
}));
vi.mock("@/components/ui/card", () => {
    const box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
    return { Card: box, CardHeader: box, CardTitle: box, CardDescription: box, CardContent: box };
});
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: { children?: ReactNode }) => createElement("button", props, children),
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children?: ReactNode; href: string }) => createElement("a", { href }, children) }));
vi.mock("lucide-react", () => ({ Plus: () => null, LayoutGrid: () => null, Trash2: () => null, ArrowRight: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: hook.refresh }) }));
vi.mock("../templates-actions", () => ({ createTemplateAction: vi.fn() }));

import TemplatesPage from "./page";
import { createTemplateAction } from "../templates-actions";

type Element = ReactElement<Record<string, unknown>>;

/** Renders function components (page, form, UI stubs) down to host elements. */
function expand(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== "object" || !("props" in value)) return value;
    const el = value as Element;
    if (typeof el.type === "function") return expand((el.type as (p: unknown) => unknown)(el.props));
    return { ...el, props: { ...el.props, children: expand(el.props.children) } };
}

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

let typed = "";

async function render() {
    hook.cursor = 0;
    hook.refCursor = 0;
    const all = nodes(expand(await TemplatesPage()));
    const form = all.find(e => e.type === "form")!;
    const inForm = nodes(form.props.children);
    return {
        form,
        input: inForm.find(e => e.type === "input" && e.props.name === "name")!,
        button: inForm.find(e => e.type === "button")!,
        message: inForm.find(e => e.type === "p" && (e.props.role === "alert" || e.props.role === "status")),
    };
}

async function type(value: string) {
    typed = value;
    const { input } = await render();
    (input.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { value } });
}

/** Submits the kit form the way the browser/React would: onSubmit handler, or the raw form action with the form's FormData. */
async function submit() {
    const { form } = await render();
    if (typeof form.props.onSubmit === "function") {
        return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault: () => {} });
    }
    // A raw form action: React 19 sends a thrown error to the route error boundary.
    const formData = new FormData();
    formData.set("name", typed);
    return (form.props.action as (f: FormData) => Promise<unknown>)(formData);
}

const sentNames = () => vi.mocked(createTemplateAction).mock.calls.map(([f]) => [...(f as FormData).entries()]);

beforeEach(() => {
    hook.slots = [];
    hook.refs = [];
    hook.refresh.mockReset();
    typed = "";
    vi.mocked(createTemplateAction).mockReset();
});

describe("Create New Kit outcomes", () => {
    it("a confirmed create sends the canonical form payload once and shows no error", async () => {
        vi.mocked(createTemplateAction).mockResolvedValue({ id: "t1", name: "Groundworks" });
        await type("Groundworks");
        await submit();
        expect(sentNames()).toEqual([[["name", "Groundworks"]]]);
        expect((await render()).message?.props.role).not.toBe("alert");
    });

    it("a thrown refusal is shown inline, keeps the typed name, settles pending and does not retry", async () => {
        vi.mocked(createTemplateAction).mockRejectedValue(new Error("permission denied for table templates"));
        await type("Groundworks");
        await expect(submit()).resolves.toBeUndefined();
        const { input, button, message } = await render();
        expect(message?.props.role).toBe("alert");
        expect(message?.props.children).toMatch(/couldn.t confirm the kit was created/i);
        expect(message?.props.children).toMatch(/may already have been saved/i);
        expect(message?.props.children).toContain("permission denied for table templates");
        expect(input.props.value).toBe("Groundworks");
        expect(button.props.disabled).toBe(false);
        expect(createTemplateAction).toHaveBeenCalledTimes(1);
        expect(hook.refresh).not.toHaveBeenCalled();
    });

    it("an error after the insert (revalidation) is reported as unconfirmed, not as nothing created", async () => {
        const written: string[] = [];
        vi.mocked(createTemplateAction).mockImplementation(async (f: FormData) => {
            written.push(String(f.get("name")));
            throw new Error("revalidation failed");
        });
        await type("Groundworks");
        await expect(submit()).resolves.toBeUndefined();
        const { input, message } = await render();
        expect(written).toEqual(["Groundworks"]);
        expect(message?.props.role).toBe("alert");
        expect(message?.props.children).toMatch(/couldn.t confirm/i);
        expect(message?.props.children).not.toMatch(/no kit was created|was not created|nothing was/i);
        expect(input.props.value).toBe("Groundworks");
        expect(createTemplateAction).toHaveBeenCalledTimes(1);
    });

    it("a second submit while pending is ignored, and a late success does not overwrite a newer edit", async () => {
        let finish!: (v: unknown) => void;
        vi.mocked(createTemplateAction).mockImplementation(() => new Promise(r => { finish = r; }) as never);
        await type("Groundworks");
        const first = submit();
        await vi.waitFor(() => expect(createTemplateAction).toHaveBeenCalledTimes(1));
        expect((await render()).button.props.disabled).toBe(true);
        await submit();
        expect(createTemplateAction).toHaveBeenCalledTimes(1);
        await type("Drainage");
        finish({ id: "t1", name: "Groundworks" });
        await first;
        const { input, button, message } = await render();
        expect(input.props.value).toBe("Drainage");
        expect(button.props.disabled).toBe(false);
        expect(message).toBeUndefined();
    });

    it("a create with no returned kit is not shown as success and keeps the name", async () => {
        vi.mocked(createTemplateAction).mockResolvedValue(null);
        await type("Groundworks");
        await submit();
        const { input, message } = await render();
        expect(message?.props.role).toBe("alert");
        expect(message?.props.children).toMatch(/couldn.t confirm/i);
        expect(input.props.value).toBe("Groundworks");
        expect(hook.refresh).not.toHaveBeenCalled();
    });

    it("a refresh failure after a confirmed create keeps the success and clears the name", async () => {
        vi.mocked(createTemplateAction).mockResolvedValue({ id: "t1", name: "Groundworks" });
        hook.refresh.mockImplementation(() => { throw new Error("refresh failed"); });
        await type("Groundworks");
        await submit();
        const { input, message } = await render();
        expect(hook.refresh).toHaveBeenCalledTimes(1);
        expect(message?.props.role).toBe("status");
        expect(message?.props.children).toMatch(/kit created/i);
        expect(input.props.value).toBe("");
    });
});
