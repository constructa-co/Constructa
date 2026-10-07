import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));

import { createBlankProjectAction } from "./actions";
import { BLANK_PROJECT_CREATE_ERROR } from "@/lib/blank-project";

const REQUEST_ID = "3f0c1f4e-7c1b-4a55-9a43-0d0a6c0f7b11";

interface RpcArgs {
    p_request_id: string;
    p_project: Record<string, unknown>;
    p_estimates: unknown[];
}

function formData(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    const values = { requestId: REQUEST_ID, name: "14 Oak Road", client: "Alex Client", ...overrides };
    Object.entries(values).forEach(([key, value]) => fd.set(key, value));
    return fd;
}

/** Stands in for create_phase1_project_graph: one project per request id. */
function idempotentRpc() {
    const committed = new Map<string, string>();
    return vi.fn(async (_name: string, args: { p_request_id: string }) => {
        if (!committed.has(args.p_request_id)) {
            committed.set(args.p_request_id, `project-${committed.size + 1}`);
        }
        return { data: [{ project_id: committed.get(args.p_request_id), estimate_ids: [] }], error: null };
    });
}

describe("createBlankProjectAction", () => {
    beforeEach(() => {
        mocks.requireAuth.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("calls the atomic creation RPC with a blank graph", async () => {
        const rpc = idempotentRpc();
        mocks.requireAuth.mockResolvedValue({ supabase: { rpc } });

        const result = await createBlankProjectAction(formData());

        expect(result).toEqual({ success: true, projectId: "project-1" });
        expect(rpc).toHaveBeenCalledTimes(1);
        const [name, args] = rpc.mock.calls[0] as unknown as [string, RpcArgs];
        expect(name).toBe("create_phase1_project_graph");
        expect(args.p_request_id).toBe(REQUEST_ID);
        expect(args.p_estimates).toEqual([]);
        expect(args.p_project).toMatchObject({ name: "14 Oak Road", client_name: "Alex Client", status: "Lead" });
        expect(Object.keys(args.p_project)).not.toEqual(
            expect.arrayContaining(["brief_scope", "scope_text", "programme_phases", "template_id"]),
        );
    });

    it("ignores a template id sent by an old client", async () => {
        const rpc = idempotentRpc();
        mocks.requireAuth.mockResolvedValue({ supabase: { rpc } });

        await createBlankProjectAction(formData({ typeId: "extension_1", templateId: "abc" }));

        const [, args] = rpc.mock.calls[0] as unknown as [string, RpcArgs];
        expect(args.p_estimates).toEqual([]);
        expect(JSON.stringify(args)).not.toContain("extension_1");
    });

    it("returns the same project when the same request is retried", async () => {
        const rpc = idempotentRpc();
        mocks.requireAuth.mockResolvedValue({ supabase: { rpc } });

        const first = await createBlankProjectAction(formData());
        const retry = await createBlankProjectAction(formData());

        expect(retry).toEqual(first);
        expect(rpc.mock.calls.map(([, args]) => args.p_request_id)).toEqual([REQUEST_ID, REQUEST_ID]);
    });

    it("reuses the request id when a failed create is retried", async () => {
        const working = idempotentRpc();
        const rpc = vi.fn()
            .mockResolvedValueOnce({ data: null, error: { code: "08006", message: "connection lost" } })
            .mockImplementation(working);
        mocks.requireAuth.mockResolvedValue({ supabase: { rpc } });

        expect(await createBlankProjectAction(formData())).toEqual({ success: false, error: BLANK_PROJECT_CREATE_ERROR });
        expect(await createBlankProjectAction(formData())).toEqual({ success: true, projectId: "project-1" });
        expect(rpc.mock.calls.map(([, args]) => args.p_request_id)).toEqual([REQUEST_ID, REQUEST_ID]);
    });

    it("returns field errors without touching the database when answers are missing", async () => {
        const result = await createBlankProjectAction(formData({ name: " ", client: "" }));

        expect(result).toEqual({
            success: false,
            error: "Give the job a name.",
            fieldErrors: { name: "Give the job a name.", client: "Add the client's name." },
        });
        expect(mocks.requireAuth).not.toHaveBeenCalled();
    });

    it("returns a retryable message instead of throwing when the session or network fails", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));

        expect(await createBlankProjectAction(formData())).toEqual({
            success: false,
            error: BLANK_PROJECT_CREATE_ERROR,
        });
    });
});
