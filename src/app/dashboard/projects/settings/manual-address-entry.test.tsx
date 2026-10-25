import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ManualAddressEntry from "@/components/manual-address-entry";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    si: 0,
    ri: 0,
    pending: false,
    tasks: [] as Promise<void>[],
    layouts: [] as Array<() => void>,
    effects: [] as Array<() => void | (() => void)>,
    details: vi.fn(),
    status: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.si++;
        if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [
            hooks.states[index],
            (value: unknown) => {
                hooks.states[index] = typeof value === "function" ? (value as (prev: unknown) => unknown)(hooks.states[index]) : value;
            },
        ];
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

type Props = {
    children?: ReactNode;
    id?: string;
    disabled?: boolean;
    defaultValue?: string;
    "aria-label"?: string;
    ref?: (form: HTMLFormElement) => void;
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
    onChange?: ((event: { currentTarget: HTMLFormElement }) => void) | ((event: { target: { value: string } }) => void);
    onClick?: () => void;
    idPrefix?: string;
    onApply?: (preview: string) => void;
};
type Node = ReactElement<Props>;
type Form = HTMLFormElement & { data: FormData; elements: { namedItem: (name: string) => HTMLTextAreaElement | null } };
const NativeFormData = FormData;

const fieldValues: Record<string, string> = { client_address: "", site_address: "" };

let project: { id: string; name: string; status?: string; is_archived?: boolean; client_address?: string; site_address?: string };
let details: Form;
let status: Form;

function mountTree(value: ReactNode): ReactNode {
    if (Array.isArray(value)) return value.map(mountTree);
    if (!value || typeof value !== "object" || !("props" in value)) return value;
    const node = value as ReactElement<{ children?: ReactNode }>;
    if (node.type === ManualAddressEntry) {
        return mountTree(ManualAddressEntry(node.props as ComponentProps<typeof ManualAddressEntry>));
    }
    return { ...node, props: { ...node.props, children: mountTree(node.props.children) } };
}

function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as ReactElement<{ children?: ReactNode }>;
    if (node.type === ManualAddressEntry) {
        return nodes(ManualAddressEntry(node.props as ComponentProps<typeof ManualAddressEntry>));
    }
    return [node as Node, ...nodes(node.props.children)];
}

function render() {
    hooks.si = 0;
    hooks.ri = 0;
    hooks.layouts = [];
    hooks.effects = [];
    const tree = ClientProjectSettings({ project });
    hooks.layouts.forEach(effect => effect());
    return tree;
}

function formNode(intent: "details" | "status") {
    return nodes(render()).find(node => node.type === "form" && node.props["aria-label"] === (intent === "details" ? "Job details" : "Project status"))!;
}

function editManual(id: string, value: string) {
    const onChange = nodes(render()).find(n => n.props.id === id)!.props.onChange as (event: { target: { value: string } }) => void;
    onChange({ target: { value } });
}

function warns() {
    render();
    return hooks.warn.mock.calls.at(-1)?.[0];
}

function staticHtml() {
    return renderToStaticMarkup(mountTree(render()) as ReactElement);
}

function makeDetailsForm(): Form {
    const data = new NativeFormData();
    for (const [key, value] of Object.entries({
        projectId: "job",
        name: "Saved job",
        project_type: "  Bespoke work  ",
        scope: "Exact\n  scope",
        potential_value: "0.125",
        client_address: fieldValues.client_address,
        site_address: fieldValues.site_address,
    })) data.set(key, value);
    return {
        data,
        elements: {
            namedItem: (name: string) => {
                if (name !== "client_address" && name !== "site_address") return null;
                const el = Object.assign(Object.create(HTMLTextAreaElement.prototype), { name }) as HTMLTextAreaElement;
                Object.defineProperty(el, "value", {
                    get: () => fieldValues[name] ?? "",
                    set: (v: string) => {
                        fieldValues[name] = v;
                        data.set(name, v);
                    },
                    configurable: true,
                });
                return el;
            },
        },
    } as Form;
}

beforeEach(() => {
    hooks.states = [];
    hooks.refs = [];
    hooks.tasks = [];
    hooks.pending = false;
    vi.clearAllMocks();
    project = { id: "job", name: "Saved job", status: "Draft", client_address: "Legacy client\nunchanged" };
    fieldValues.client_address = project.client_address ?? "";
    fieldValues.site_address = project.site_address ?? "";
    vi.stubGlobal("HTMLTextAreaElement", class {});
    details = makeDetailsForm();
    status = { data: new NativeFormData() } as Form;
    status.data.set("projectId", "job");
    status.data.set("status", "Draft");
    vi.stubGlobal("FormData", class extends NativeFormData {
        constructor(source?: Form) {
            super();
            if (source?.data) {
                for (const [key, value] of source.data) this.append(key, String(value));
            }
            if (source?.elements?.namedItem) {
                for (const name of ["client_address", "site_address"]) {
                    const el = source.elements.namedItem(name);
                    if (el && "value" in el) this.set(name, String(el.value));
                }
            }
        }
    });
    formNode("details").props.ref!(details);
    formNode("status").props.ref!(status);
});

afterEach(() => vi.unstubAllGlobals());

describe("settings job manual structured addresses", () => {
    it("mounts separate optional structured entry for client and site on the details form", () => {
        const html = staticHtml();
        expect(html).toContain('data-manual-address-entry="settings-client-manual"');
        expect(html).toContain('data-manual-address-entry="settings-site-manual"');
        expect(nodes(render()).filter(n => n.type === "form" && n.props["aria-label"] === "Job details")).toHaveLength(1);
    });

    it("leaves legacy free text byte-exact until Use applies only the intended textarea", () => {
        editManual("settings-site-manual-line1", "Would-be site");
        expect(fieldValues.client_address).toBe("Legacy client\nunchanged");
        expect(fieldValues.site_address).toBe("");
        nodes(render()).find(n => n.props.id === "settings-site-manual-use")!.props.onClick!();
        expect(fieldValues.site_address).toBe("Would-be site");
        expect(fieldValues.client_address).toBe("Legacy client\nunchanged");
    });

    it("includes unapplied structured drafts in the leave guard without extra FormData keys on save", async () => {
        expect(warns()).toBe(false);
        editManual("settings-client-manual-postcode", "AB1 2CD");
        expect(warns()).toBe(true);
        hooks.details.mockResolvedValueOnce({ success: true });
        const preventDefault = vi.fn();
        formNode("details").props.onSubmit!({ preventDefault, currentTarget: details } as unknown as FormEvent<HTMLFormElement>);
        await Promise.all(hooks.tasks);
        const submitted = hooks.details.mock.calls[0][0] as FormData;
        expect(Array.from(submitted.keys())).not.toContain("line1");
        expect(Array.from(submitted.keys())).not.toContain("postcode");
        expect(submitted.get("client_address")).toBe("Legacy client\nunchanged");
    });

    it("disables structured entry when the protected details form is locked", () => {
        project = { ...project, is_archived: true };
        const line = nodes(render()).find(n => n.props.id === "settings-client-manual-line1")!;
        expect(line.props.disabled).toBe(true);
        expect(nodes(render()).find(n => n.props.id === "settings-client-manual-use")!.props.disabled).toBe(true);
    });

    it.each(["lock", "pending", "project swap", "unmount"] as const)("refuses a captured local Use callback after %s before mutating the textarea", async boundary => {
        function rawNodes(value: ReactNode): Node[] {
            if (Array.isArray(value)) return value.flatMap(rawNodes);
            if (!value || typeof value !== "object" || !("props" in value)) return [];
            const node = value as Node;
            return [node, ...rawNodes(node.props.children)];
        }
        const apply = rawNodes(render()).find(node => node.type === ManualAddressEntry && node.props.idPrefix === "settings-site-manual")!.props.onApply!;
        let finish: ((value: { success: boolean }) => void) | undefined;
        if (boundary === "lock") { project = { ...project, is_archived: true }; render(); }
        if (boundary === "project swap") { project = { ...project, id: "other-job" }; render(); }
        if (boundary === "unmount") { const cleanup = hooks.effects[0](); cleanup?.(); }
        if (boundary === "pending") {
            hooks.details.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
            formNode("details").props.onSubmit!({ preventDefault: vi.fn(), currentTarget: details } as unknown as FormEvent<HTMLFormElement>);
        }
        apply("Must not replace the saved address");
        const after = { site: fieldValues.site_address, client: fieldValues.client_address };
        if (finish) { finish({ success: false }); await Promise.all(hooks.tasks); }
        expect(after).toEqual({ site: "", client: "Legacy client\nunchanged" });
        expect(hooks.status).not.toHaveBeenCalled();
        expect(hooks.details).toHaveBeenCalledTimes(boundary === "pending" ? 1 : 0);
    });
});
