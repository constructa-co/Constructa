/**
 * Form → actual createBlankProjectAction → mocked Supabase RPC (not a duplicate parse/build chain).
 */
import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobAddressField from "@/components/job-address-field";
import ManualAddressEntry from "@/components/manual-address-entry";
import PostcodeAddressPicker from "@/components/postcode-address-picker";

const REQUEST_ID = "3f0c1f4e-7c1b-4a55-9a43-0d0a6c0f7b11";

interface RpcArgs {
    p_request_id: string;
    p_project: Record<string, unknown>;
    p_estimates: unknown[];
}

const authMocks = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: authMocks.requireAuth }));

const hooks = vi.hoisted(() => ({
    states: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    stateIndex: 0,
    refIndex: 0,
    guard: vi.fn(),
    push: vi.fn(),
    attempts: [] as Array<Record<string, string>>,
    actionResults: [] as Array<{ success: boolean; projectId?: string; error?: string }>,
    rpc: vi.fn(),
    rpcAttempt: 0,
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

import { createBlankProjectAction } from "./actions";
import NewProjectForm from "./new-project-form";

function installRefusedThenIdempotentRpc() {
    const committed = new Map<string, string>();
    hooks.rpcAttempt = 0;
    hooks.rpc.mockImplementation(async (_name: string, args: RpcArgs) => {
        hooks.rpcAttempt += 1;
        if (hooks.rpcAttempt === 1) {
            return { data: null, error: { code: "08006", message: "connection lost" } };
        }
        if (!committed.has(args.p_request_id)) {
            committed.set(args.p_request_id, `project-${committed.size + 1}`);
        }
        return {
            data: [{ project_id: committed.get(args.p_request_id), estimate_ids: [] }],
            error: null,
        };
    });
}

function rpcArgs(callIndex: number): RpcArgs {
    const [, args] = hooks.rpc.mock.calls[callIndex] as unknown as [string, RpcArgs];
    return args;
}

async function createProjectViaAction(formData: FormData) {
    const raw: Record<string, string> = {};
    formData.forEach((value, key) => { raw[key] = String(value); });
    hooks.attempts.push(raw);
    const result = await createBlankProjectAction(formData);
    hooks.actionResults.push(result);
    return result;
}

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

function mountForm() {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    return NewProjectForm({ isFirstProject: true, createProject: createProjectViaAction });
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

/** inFlightRef is the second useRef in NewProjectForm (after structuredAddressDraftRef). */
async function waitForCreateIdle() {
    await vi.waitFor(() => expect(hooks.refs[1]?.current).toBe(false));
}

beforeEach(() => {
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    vi.stubGlobal("crypto", { randomUUID: () => REQUEST_ID });
    hooks.states = [];
    hooks.refs = [];
    hooks.attempts = [];
    hooks.actionResults = [];
    hooks.rpc.mockReset();
    hooks.rpcAttempt = 0;
    hooks.guard.mockClear();
    hooks.push.mockReset();
    authMocks.requireAuth.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllGlobals());

describe("new project manual create via actual createBlankProjectAction", () => {
    it("refuses create while manual parts are pending, then calls RPC with separate site/client fields and retries after refused RPC ACK with the same request id", async () => {
        installRefusedThenIdempotentRpc();
        authMocks.requireAuth.mockResolvedValue({ supabase: { rpc: hooks.rpc } });

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
        expect(hooks.rpc).not.toHaveBeenCalled();

        nodes(render()).find(n => n.props.id === "new-project-client-manual-use")!.props.onClick!();
        expect(nodes(render()).find(n => n.props.id === "new-project-siteAddress")!.props.value).toBe(unusualSite);
        expect(nodes(render()).find(n => n.props.id === "new-project-clientAddress")!.props.value).toBe(structuredClient);

        submitCreate();
        await vi.waitFor(() => expect(hooks.attempts).toHaveLength(0));
        expect(hooks.rpc).not.toHaveBeenCalled();

        edit("new-project-site-manual-line1", "");
        submitCreate();
        await vi.waitFor(() => expect(hooks.actionResults).toHaveLength(1));
        expect(hooks.rpc).toHaveBeenCalledTimes(1);
        expect(hooks.attempts[0].requestId).toBe(REQUEST_ID);
        expect(hooks.attempts[0].siteAddress).toBe(unusualSite);
        expect(hooks.attempts[0].clientAddress).toBe(structuredClient);
        expect(rpcArgs(0).p_request_id).toBe(REQUEST_ID);
        expect(rpcArgs(0).p_project.site_address).toBe(unusualSite);
        expect(rpcArgs(0).p_project.client_address).toBe(structuredClient);
        expect(rpcArgs(0).p_project.client_address).not.toBe(unusualSite);
        expect(Object.keys(hooks.attempts[0])).not.toContain("line1");
        expect(Object.keys(hooks.attempts[0])).not.toContain("postcode");
        expect(hooks.push).not.toHaveBeenCalled();

        await waitForCreateIdle();
        submitCreate();
        await vi.waitFor(() => expect(hooks.actionResults).toHaveLength(2));
        expect(hooks.actionResults[0].success).toBe(false);
        expect(hooks.actionResults[1]).toEqual({ success: true, projectId: "project-1" });
        expect(hooks.attempts[1].requestId).toBe(REQUEST_ID);
        expect(hooks.rpc).toHaveBeenCalledTimes(2);
        expect(rpcArgs(1).p_request_id).toBe(REQUEST_ID);
        expect(rpcArgs(1).p_project.site_address).toBe(unusualSite);
        expect(rpcArgs(1).p_project.client_address).toBe(structuredClient);
        await vi.waitFor(() => {
            expect(hooks.push).toHaveBeenCalledWith(`/dashboard/projects/brief?projectId=${encodeURIComponent("project-1")}`);
        });
    });

    it("returns BLANK_PROJECT_CREATE_ERROR on refused RPC without navigation, then idempotent mock returns project-1 on deliberate retry with the same request id", async () => {
        installRefusedThenIdempotentRpc();
        authMocks.requireAuth.mockResolvedValue({ supabase: { rpc: hooks.rpc } });

        openMore();
        edit("new-project-name", "Retry job");
        edit("new-project-client", "Client");
        edit("new-project-siteAddress", "Site only\nline two");

        submitCreate();
        await vi.waitFor(() => expect(hooks.actionResults).toHaveLength(1));
        expect(hooks.actionResults[0]).toMatchObject({ success: false });
        expect(hooks.rpc).toHaveBeenCalledTimes(1);
        expect(hooks.push).not.toHaveBeenCalled();

        await waitForCreateIdle();
        submitCreate();
        await vi.waitFor(() => expect(hooks.actionResults).toHaveLength(2));
        expect(hooks.attempts[0].requestId).toBe(hooks.attempts[1].requestId);
        expect(hooks.rpc).toHaveBeenCalledTimes(2);
        expect(rpcArgs(0).p_request_id).toBe(REQUEST_ID);
        expect(rpcArgs(1).p_request_id).toBe(REQUEST_ID);
        expect(hooks.actionResults[1]).toEqual({ success: true, projectId: "project-1" });
        await vi.waitFor(() => expect(hooks.push).toHaveBeenCalledOnce());
    });
});
