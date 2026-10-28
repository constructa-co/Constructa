import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MANUAL_ADDRESS_MAX_LENGTH } from "@/lib/manual-address";
import JobAddressField from "@/components/job-address-field";
import ManualAddressEntry from "@/components/manual-address-entry";
import PostcodeAddressPicker from "@/components/postcode-address-picker";

const MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE = "You have address parts that are not applied yet. Choose Use this address for each structured entry, or clear those parts, before creating the job.";

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
    useEffect: (fn: () => void | (() => void)) => {
        fn();
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
    if (node.type === JobAddressField) {
        return mountTree(JobAddressField(node.props as ComponentProps<typeof JobAddressField>));
    }
    if (node.type === PostcodeAddressPicker) {
        return mountTree(PostcodeAddressPicker(node.props as ComponentProps<typeof PostcodeAddressPicker>));
    }
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
    if (node.type === JobAddressField) {
        return nodes(JobAddressField(node.props as ComponentProps<typeof JobAddressField>));
    }
    if (node.type === PostcodeAddressPicker) {
        return nodes(PostcodeAddressPicker(node.props as ComponentProps<typeof PostcodeAddressPicker>));
    }
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
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    hooks.states = [];
    hooks.refs = [];
    hooks.guard.mockClear();
    hooks.create.mockReset();
    hooks.push.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

function submitCreate() {
    nodes(render()).find(n => n.type === "form")!.props.onSubmit!({ preventDefault: vi.fn() } as unknown as FormEvent);
}

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

    it("includes unapplied structured drafts in the unsaved guard and refuses create until Use", async () => {
        openMore();
        expect(warns()).toBe(false);
        edit("new-project-client-manual-postcode", "AB1 2CD");
        expect(warns()).toBe(true);
        edit("new-project-name", "Job");
        edit("new-project-client", "Client");
        edit("new-project-siteAddress", "Free text site");
        hooks.create.mockResolvedValue({ success: true, projectId: "job-1" });
        submitCreate();
        await vi.waitFor(() => expect(staticHtml()).toContain(MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE));
        expect(hooks.create).not.toHaveBeenCalled();
        expect(hooks.push).not.toHaveBeenCalled();
        expect(nodes(render()).find(n => n.props.id === "new-project-client-manual-postcode")!.props.value).toBe("AB1 2CD");
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("Free text site");
        submitCreate();
        expect(hooks.create).not.toHaveBeenCalled();
        nodes(render()).find(n => n.props.id === "new-project-client-manual-use")!.props.onClick!();
        submitCreate();
        await vi.waitFor(() => expect(hooks.create).toHaveBeenCalled());
        const keys = Array.from(hooks.create.mock.calls[0][0].keys());
        expect(keys).not.toContain("line1");
        expect(keys).not.toContain("postcode");
        expect(hooks.create.mock.calls[0][0].get("siteAddress")).toBe("Free text site");
        expect(hooks.create.mock.calls[0][0].get("clientAddress")).toBe("AB1 2CD");
    });

    it("refuses create when client postcode alone is pending with separate site and client free text, then Use and explicit Create", async () => {
        const unusualSite = "Plot π rear\n(courtyard access only)";
        const clientFreeText = "Accounts dept — same as 2019 job";
        const postcodeDraft = "  AB1 2CD  ";
        openMore();
        edit("new-project-name", "Job");
        edit("new-project-client", "Client");
        edit("new-project-siteAddress", unusualSite);
        edit("new-project-clientAddress", clientFreeText);
        edit("new-project-client-manual-postcode", postcodeDraft);
        hooks.create.mockResolvedValue({ success: true, projectId: "job-1" });
        submitCreate();
        await vi.waitFor(() => expect(staticHtml()).toContain(MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE));
        expect(hooks.create).not.toHaveBeenCalled();
        expect(hooks.push).not.toHaveBeenCalled();
        expect(nodes(render()).find(n => n.props.id === "new-project-client-manual-postcode")!.props.value).toBe(postcodeDraft);
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe(unusualSite);
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe(clientFreeText);
        nodes(render()).find(n => n.props.id === "new-project-client-manual-use")!.props.onClick!();
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe(unusualSite);
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe("AB1 2CD");
        submitCreate();
        await vi.waitFor(() => expect(hooks.create).toHaveBeenCalledOnce());
        const fd = hooks.create.mock.calls[0][0];
        expect(fd.get("siteAddress")).toBe(unusualSite);
        expect(fd.get("clientAddress")).toBe("AB1 2CD");
        expect(Array.from(fd.keys())).not.toContain("postcode");
        expect(Array.from(fd.keys())).not.toContain("line1");
    });

    it("refuses create when site parts are pending after Enter-equivalent submit, then allows deliberate create after Use", async () => {
        openMore();
        edit("new-project-name", "Job");
        edit("new-project-client", "Client");
        edit("new-project-site-manual-postcode", "AB1 2CD");
        hooks.create.mockResolvedValue({ success: true, projectId: "job-1" });
        submitCreate();
        await vi.waitFor(() => expect(staticHtml()).toMatch(/data-job-unapplied-address/));
        expect(hooks.create).not.toHaveBeenCalled();
        expect(nodes(render()).find(n => n.props.id === "new-project-site-manual-postcode")!.props.value).toBe("AB1 2CD");
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("");
        nodes(render()).find(n => n.props.id === "new-project-site-manual-use")!.props.onClick!();
        submitCreate();
        await vi.waitFor(() => expect(hooks.create).toHaveBeenCalledOnce());
        expect(hooks.create.mock.calls[0][0].get("siteAddress")).toBe("AB1 2CD");
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

    it("refuses create with unapplied site and client parts, then clearing those parts deliberately creates with the original free text exactly once", async () => {
        openMore();
        edit("new-project-name", "Job");
        edit("new-project-client", "Client");
        edit("new-project-siteAddress", "Existing site\nunchanged");
        edit("new-project-clientAddress", "Existing client, flat 2");
        edit("new-project-site-manual-line1", "Would-be site");
        edit("new-project-client-manual-postcode", "AB1 2CD");
        hooks.create.mockResolvedValue({ success: true, projectId: "job-1" });

        // Deliberate Create with unapplied structured parts on both sides: refused, zero action/navigation.
        submitCreate();
        await vi.waitFor(() => expect(staticHtml()).toContain(MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE));
        expect(hooks.create).not.toHaveBeenCalled();
        expect(hooks.push).not.toHaveBeenCalled();
        submitCreate();
        expect(hooks.create).not.toHaveBeenCalled();
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe("Existing site\nunchanged");
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe("Existing client, flat 2");

        // Clear every pending structured field deliberately (no Use): the refusal releases, free text stays byte-exact.
        edit("new-project-site-manual-line1", "");
        expect(staticHtml()).toContain(MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE);
        edit("new-project-client-manual-postcode", "");
        expect(staticHtml()).not.toContain(MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE);
        expect(nodes(render()).find(n => n.props.id === "new-project-site-manual-line1")!.props.value).toBe("");
        expect(nodes(render()).find(n => n.props.id === "new-project-client-manual-postcode")!.props.value).toBe("");

        // One explicit Create now submits the original free text exactly once; no structured keys leak in.
        submitCreate();
        await vi.waitFor(() => expect(hooks.create).toHaveBeenCalledOnce());
        const keys = Array.from(hooks.create.mock.calls[0][0].keys());
        expect(keys).not.toContain("line1");
        expect(keys).not.toContain("postcode");
        expect(hooks.create.mock.calls[0][0].get("siteAddress")).toBe("Existing site\nunchanged");
        expect(hooks.create.mock.calls[0][0].get("clientAddress")).toBe("Existing client, flat 2");
    });
});
