/**
 * Connected form → parse/build → resolve create boundary for manual addresses.
 * Does not mock ./actions; uses the same stand-in chain as first-job-entry.tsx.
 */
import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildBlankProjectGraph,
    parseBlankProjectInput,
    resolveBlankProjectCreation,
    type BlankProjectGraph,
    type CreateBlankProjectResult,
} from "@/lib/blank-project";
import JobAddressField from "@/components/job-address-field";
import ManualAddressEntry from "@/components/manual-address-entry";
import PostcodeAddressPicker from "@/components/postcode-address-picker";

const REQUEST_ID = "3f0c1f4e-7c1b-4a55-9a43-0d0a6c0f7b11";

const hooks = vi.hoisted(() => ({
    states: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    stateIndex: 0,
    refIndex: 0,
    guard: vi.fn(),
    push: vi.fn(),
    attempts: [] as Array<Record<string, string>>,
    rpcCalls: [] as Array<{ graph: BlankProjectGraph; outcome: "created" | "refused" }>,
    nextCreate: "refused" as "refused" | "success",
    committed: new Map<string, string>(),
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

/** Same parse → build → resolve chain as createBlankProjectAction / first-job-entry; RPC only mocked. */
async function createProjectStandIn(formData: FormData): Promise<CreateBlankProjectResult> {
    const raw: Record<string, string> = {};
    formData.forEach((value, key) => { raw[key] = String(value); });
    hooks.attempts.push(raw);

    const parsed = parseBlankProjectInput(raw);
    if (!parsed.ok) {
        return { success: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
    }

    const graph = buildBlankProjectGraph(parsed.input);
    const refuse = hooks.nextCreate === "refused";
    hooks.nextCreate = "success";
    hooks.rpcCalls.push({ graph: structuredClone(graph), outcome: refuse ? "refused" : "created" });

    if (refuse) {
        return resolveBlankProjectCreation(null, { message: "Local stand-in: creation not acknowledged." });
    }

    if (!hooks.committed.has(graph.requestId)) {
        hooks.committed.set(graph.requestId, `project-${hooks.committed.size + 1}`);
    }
    return resolveBlankProjectCreation(
        [{ project_id: hooks.committed.get(graph.requestId)! }],
        null,
    );
}

function mountForm() {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    return NewProjectForm({ isFirstProject: true, createProject: createProjectStandIn });
}

function render() {
    return mountForm();
}

function openMore() {
    nodes(render()).find(n => n.type === "button" && n.props["aria-controls"] === "new-project-more")!.props.onClick!();
}

function edit(id: string, value: string) {
    nodes(render()).find(n => n.props.id === id)!.props.onChange!({ target: { value } });
}

function submitCreate() {
    nodes(render()).find(n => n.type === "form")!.props.onSubmit!({ preventDefault: vi.fn() } as unknown as FormEvent);
}

beforeEach(() => {
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    vi.stubGlobal("crypto", { randomUUID: () => REQUEST_ID });
    hooks.states = [];
    hooks.refs = [];
    hooks.attempts = [];
    hooks.rpcCalls = [];
    hooks.nextCreate = "refused";
    hooks.committed.clear();
    hooks.guard.mockClear();
    hooks.push.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("new project manual create integration (form + parse/build + mocked RPC)", () => {
    it("keeps unusual site free text separate from client manual apply, refuses unapplied parts, then retries create with the same request id after a lost ACK", async () => {
        const unusualSite = "Plot π rear\n(courtyard access only)";
        const clientBilling = "Accounts dept — same as 2019 job";
        const structuredClient = "Flat 2, Billing House\nAB1 2CD";

        openMore();
        edit("new-project-name", "Manual journey job");
        edit("new-project-client", "Client Co");
        edit("new-project-siteAddress", unusualSite);
        edit("new-project-clientAddress", clientBilling);
        edit("new-project-site-manual-line1", "Would overwrite site if applied");
        edit("new-project-client-manual-line1", "Flat 2, Billing House");
        edit("new-project-client-manual-postcode", "AB1 2CD");

        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(0));
        expect(hooks.rpcCalls).toHaveLength(0);

        nodes(render()).find(n => n.props.id === "new-project-client-manual-use")!.props.onClick!();
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe(unusualSite);
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe(structuredClient);

        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(0));

        edit("new-project-site-manual-line1", "");
        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(1));
        expect(hooks.rpcCalls).toHaveLength(1);
        expect(hooks.rpcCalls[0].outcome).toBe("refused");
        expect(hooks.attempts[0].requestId).toBe(REQUEST_ID);
        expect(hooks.attempts[0].siteAddress).toBe(unusualSite);
        expect(hooks.attempts[0].clientAddress).toBe(structuredClient);
        expect(hooks.rpcCalls[0].graph.project.site_address).toBe(unusualSite);
        expect(hooks.rpcCalls[0].graph.project.client_address).toBe(structuredClient);
        expect(hooks.rpcCalls[0].graph.project.client_address).not.toBe(unusualSite);
        expect(hooks.push).not.toHaveBeenCalled();

        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(2));
        expect(hooks.attempts[1].requestId).toBe(REQUEST_ID);
        expect(hooks.attempts[1].siteAddress).toBe(unusualSite);
        expect(hooks.attempts[1].clientAddress).toBe(structuredClient);
        expect(hooks.rpcCalls[1].outcome).toBe("created");
        expect(hooks.committed.get(REQUEST_ID)).toBe("project-1");
        expect(hooks.push).toHaveBeenCalledWith(`/dashboard/projects/brief?projectId=${encodeURIComponent("project-1")}`);
        expect(Object.keys(hooks.attempts[0])).not.toContain("line1");
        expect(Object.keys(hooks.attempts[0])).not.toContain("postcode");
    });

    it("surfaces BLANK_PROJECT_CREATE_ERROR on refused RPC without navigation, then accepts returned ACK on deliberate retry", async () => {
        hooks.nextCreate = "refused";
        openMore();
        edit("new-project-name", "Retry job");
        edit("new-project-client", "Client");
        edit("new-project-siteAddress", "Site only\nline two");

        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(1));
        expect(hooks.rpcCalls[0].outcome).toBe("refused");
        expect(hooks.push).not.toHaveBeenCalled();

        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(2));
        expect(hooks.attempts[0].requestId).toBe(hooks.attempts[1].requestId);
        expect(hooks.rpcCalls[1].outcome).toBe("created");
        expect(hooks.push).toHaveBeenCalledOnce();
    });
});
