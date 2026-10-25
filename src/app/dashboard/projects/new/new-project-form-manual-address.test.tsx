import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANUAL_ADDRESS_MAX_LENGTH } from "@/lib/manual-address";
import ManualAddressEntry from "@/components/manual-address-entry";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    stateIndex: 0,
    refIndex: 0,
    guard: vi.fn(),
    push: vi.fn(),
    create: vi.fn(),
}));

vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.stateIndex++;
        if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
        return [
            hooks.states[index],
            (value: unknown) => {
                hooks.states[index] = typeof value === "function" ? value(hooks.states[index]) : value;
            },
        ];
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

type Node = ReactElement<{
    children?: ReactNode;
    id?: string;
    disabled?: boolean;
    value?: string;
    hidden?: boolean;
    "aria-controls"?: string;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: FormEvent) => void;
}>;

function mountTree(value: ReactNode): ReactNode {
    if (Array.isArray(value)) return value.map(mountTree);
    if (!value || typeof value !== "object" || !("props" in value)) return value;
    const node = value as ReactElement<{ children?: ReactNode }>;
    if (node.type === ManualAddressEntry) {
        return mountTree(ManualAddressEntry(node.props as ComponentProps<typeof ManualAddressEntry>));
    }
    return { ...node, props: { ...node.props, children: mountTree(node.props.children) } };
}

/** Walk the parent tree and mount real ManualAddressEntry children (not inert element stubs). */
function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as ReactElement<{ children?: ReactNode }>;
    if (node.type === ManualAddressEntry) {
        return nodes(ManualAddressEntry(node.props as ComponentProps<typeof ManualAddressEntry>));
    }
    return [node as Node, ...nodes(node.props.children)];
}

function mountFormTree() {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    return NewProjectForm({ isFirstProject: true });
}

function render() {
    return mountFormTree();
}

function moreToggle() {
    nodes(render()).find(n => n.type === "button" && n.props["aria-controls"] === "new-project-more")!.props.onClick!();
}

function openMore() {
    moreToggle();
}

function edit(id: string, value: string) {
    nodes(render()).find(n => n.props.id === id)!.props.onChange!({ target: { value } });
}

function warns() {
    render();
    return hooks.guard.mock.calls.at(-1)?.[0];
}

function staticHtml() {
    return renderToStaticMarkup(mountTree(mountFormTree()) as ReactElement);
}

beforeEach(() => {
    hooks.states = [];
    hooks.refs = [];
    hooks.guard.mockClear();
});

describe("new project manual structured addresses", () => {
    it("leaves existing free text byte-exact until Use applies a structured preview", () => {
        openMore();
        edit("new-project-siteAddress", "Existing site\nunchanged");
        edit("new-project-site-manual-line1", "Would-be site");
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("Existing site\nunchanged");
        nodes(render()).find(n => n.props.id === "new-project-site-manual-use")!.props.onClick!();
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("Would-be site");
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe("");
    });

    it("isolates site and client structured entry", () => {
        openMore();
        edit("new-project-site-manual-line1", "Site only");
        nodes(render()).find(n => n.props.id === "new-project-site-manual-use")!.props.onClick!();
        edit("new-project-client-manual-line1", "Client only");
        nodes(render()).find(n => n.props.id === "new-project-client-manual-use")!.props.onClick!();
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("Site only");
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe("Client only");
    });

    it("includes unapplied structured drafts in the unsaved guard without extra FormData keys", async () => {
        openMore();
        expect(warns()).toBe(false);
        edit("new-project-client-manual-postcode", "AB1 2CD");
        expect(warns()).toBe(true);
        edit("new-project-name", "Job");
        edit("new-project-client", "Client");
        hooks.create.mockResolvedValue({ success: true, projectId: "job-1" });
        nodes(render()).find(n => n.type === "form")!.props.onSubmit!({ preventDefault: vi.fn() } as unknown as FormEvent);
        await vi.waitFor(() => expect(hooks.create).toHaveBeenCalled());
        const keys = Array.from(hooks.create.mock.calls[0][0].keys());
        expect(keys).not.toContain("line1");
        expect(keys).not.toContain("postcode");
        expect(hooks.create.mock.calls[0][0].get("siteAddress")).toBe("");
        expect(hooks.create.mock.calls[0][0].get("clientAddress")).toBe("");
    });

    it("refuses Use over 500 characters in the joined preview", () => {
        openMore();
        edit("new-project-site-manual-line1", "a".repeat(MANUAL_ADDRESS_MAX_LENGTH + 3));
        const use = nodes(render()).find(n => n.props.id === "new-project-site-manual-use")!;
        expect(use.props.disabled).toBe(true);
        expect(staticHtml()).toContain("over 500 characters");
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("");
    });

    it("keeps unapplied structured drafts when Add more details is collapsed and reopened", () => {
        openMore();
        edit("new-project-site-manual-line1", "Survives outer collapse");
        expect(nodes(render()).find(n => n.props.id === "new-project-site-manual-line1")!.props.value).toBe("Survives outer collapse");
        expect(warns()).toBe(true);
        moreToggle();
        expect(nodes(render()).find(n => n.props.id === "new-project-more")!.props.hidden).toBe(true);
        moreToggle();
        expect(nodes(render()).find(n => n.props.id === "new-project-more")!.props.hidden).not.toBe(true);
        expect(nodes(render()).find(n => n.props.id === "new-project-site-manual-line1")!.props.value).toBe("Survives outer collapse");
        expect(warns()).toBe(true);
    });
});
