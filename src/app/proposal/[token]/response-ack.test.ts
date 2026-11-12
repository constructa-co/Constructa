import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { representativeInput } from "@/lib/__fixtures__/proposal";

// A114: the real public response action against the repo's RPC fixture.
// Every service is a mock; the row shapes follow the actual
// respond_to_proposal_publication RETURNS TABLE in
// supabase/migrations/20260930150000_proposal_publication_foundation.sql.
const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), sendProposalResponseReceipt: vi.fn(), getUserById: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/email", () => ({ sendProposalResponseReceipt: mocks.sendProposalResponseReceipt }));

import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { respondToProposalAction } from "./actions";

const TOKEN = "ab".repeat(32);
const NOT_RECORDED = "Your response could not be recorded. Please try again, or contact the contractor.";
const snapshot = buildProposalPublicationSnapshot({ ...representativeInput(), responseKind: "acknowledgement" });
const row = (patch: Record<string, unknown> = {}) => ({
    publication_id: "pub-1", project_id: "project-1", owner_user_id: "owner-1", publication_status: "acknowledged",
    snapshot, responded_at: "2026-10-06T10:00:00.000Z", publication_snapshot_hash: "cd".repeat(32), ...patch,
});
type RpcResult = { data: unknown; error: { code: string; message: string } | null };

function arrange(respond: RpcResult | (() => never), receipt: (args: Record<string, unknown>) => RpcResult | never = () => ({ data: null, error: null })) {
    const admin = fakeSupabase({});
    admin.onRpc((name, args) => {
        if (name === "respond_to_proposal_publication") return typeof respond === "function" ? respond() : respond;
        return receipt(args);
    });
    mocks.getUserById.mockResolvedValue({ data: { user: { email: "contractor@example.test" } } });
    mocks.createAdminClient.mockReturnValue({ ...admin.client, auth: { admin: { getUserById: mocks.getUserById } } });
    mocks.sendProposalResponseReceipt.mockResolvedValue({ data: { id: "receipt-1" }, error: null });
    return admin;
}
const receipts = (admin: ReturnType<typeof arrange>) => admin.rpcCalls.filter(call => call.name === "record_proposal_receipt_delivery");
const logs: unknown[][] = [];

beforeEach(() => {
    vi.clearAllMocks(); logs.length = 0;
    vi.spyOn(console, "error").mockImplementation((...args) => { logs.push(args); });
});
afterEach(() => vi.restoreAllMocks());

describe("A114 response ingress: uncertain transport is not reported as nothing recorded", () => {
    it("treats a lost reply (supabase-js returns code \"\" for a network failure) as unconfirmed, sending no receipt", async () => {
        const admin = arrange({ data: null, error: { code: "", message: "FetchError: socket hang up" } });
        const result = await respondToProposalAction(TOKEN, "Alex Client", "alex@example.test");
        expect(result).toMatchObject({ success: false, unconfirmed: true });
        expect(result.error).toMatch(/could not be confirmed/i);
        expect(result.error).not.toMatch(/could not be recorded|socket|FetchError/i);
        expect(mocks.sendProposalResponseReceipt).not.toHaveBeenCalled();
        expect(receipts(admin)).toEqual([]);
    });

    it("resolves (does not throw) as unconfirmed when the RPC call itself throws", async () => {
        arrange(() => { throw new Error("private transport failure"); });
        const result = await respondToProposalAction(TOKEN, "Alex Client", "");
        expect(result).toMatchObject({ success: false, unconfirmed: true });
        expect(JSON.stringify(result)).not.toContain("private transport");
    });

    it("reports nothing recorded when the server cannot even reach the database", async () => {
        mocks.createAdminClient.mockImplementation(() => { throw new Error("missing service configuration"); });
        await expect(respondToProposalAction(TOKEN, "Alex Client", "")).resolves.toEqual({ success: false, error: NOT_RECORDED });
    });

    it.each([["a PostgREST refusal", "PGRST202"], ["a database refusal", "XX000"]])("keeps %s as definitely not recorded", async (_label, code) => {
        arrange({ data: null, error: { code, message: "db" } });
        await expect(respondToProposalAction(TOKEN, "Alex Client", "")).resolves.toEqual({ success: false, error: NOT_RECORDED });
    });
});

describe("A114 response ingress: a returned row is checked against the RPC contract before it is confirmed", () => {
    it.each([
        ["no rows", []],
        ["two rows", [row(), row({ publication_id: "pub-2" })]],
        ["a missing publication id", [row({ publication_id: undefined })]],
        ["a missing response time", [row({ responded_at: undefined })]],
        ["an unreadable response time", [row({ responded_at: "not a date" })]],
        ["a missing status", [row({ publication_status: undefined })]],
        ["a status that was not requested", [row({ publication_status: "accepted" })]],
        ["a non-object row", ["pub-1"]],
    ])("does not confirm a reply with %s, and sends no receipt to anyone", async (_label, data) => {
        const admin = arrange({ data, error: null });
        const result = await respondToProposalAction(TOKEN, "Alex Client", "alex@example.test");
        expect(result).toMatchObject({ success: false, unconfirmed: true });
        expect(result).not.toHaveProperty("status");
        expect(mocks.getUserById).not.toHaveBeenCalled();
        expect(mocks.sendProposalResponseReceipt).not.toHaveBeenCalled();
        expect(receipts(admin)).toEqual([]);
    });

    it("confirms a valid response whose snapshot cannot be read, records why no receipt went, and never dereferences it", async () => {
        for (const bad of ["not an object", {}, { project: { id: "x" } }, { ...snapshot, publication: { ...snapshot.publication, version_number: "1" } }]) {
            vi.clearAllMocks();
            const admin = arrange({ data: [row({ snapshot: bad })], error: null });
            await expect(respondToProposalAction(TOKEN, "Alex Client", "alex@example.test"))
                .resolves.toEqual({ success: true, status: "acknowledged", respondedAt: "2026-10-06T10:00:00.000Z" });
            expect(mocks.sendProposalResponseReceipt).not.toHaveBeenCalled();
            expect(mocks.getUserById).not.toHaveBeenCalled();
            expect(receipts(admin).map(call => [call.args.p_publication_id, call.args.p_audience, call.args.p_succeeded])).toEqual([
                ["pub-1", "client", false], ["pub-1", "owner", false],
            ]);
        }
    });

    it("never looks up a contractor without a returned owner id, so no owner receipt is misrouted", async () => {
        for (const owner of [undefined, null, "", 7]) {
            vi.clearAllMocks();
            const admin = arrange({ data: [row({ owner_user_id: owner })], error: null });
            await expect(respondToProposalAction(TOKEN, "Alex Client", "alex@example.test")).resolves.toMatchObject({ success: true });
            expect(mocks.getUserById).not.toHaveBeenCalled();
            expect(mocks.sendProposalResponseReceipt.mock.calls.map(([args]) => args.recipientKind)).toEqual(["client"]);
            expect(receipts(admin).every(call => call.args.p_publication_id === "pub-1")).toBe(true);
        }
    });
});

describe("A114 response ingress: after the response is committed, receipts never turn it into a failure", () => {
    it.each([
        ["after a failed send", () => Promise.reject(new Error("provider down"))],
        ["after a successful send", () => Promise.resolve({ data: { id: "receipt-1" }, error: null })],
    ])("returns the confirmed response when receipt bookkeeping throws %s", async (_label, send) => {
        arrange({ data: [row()], error: null }, () => { throw new Error("bookkeeping transport failure"); });
        mocks.sendProposalResponseReceipt.mockImplementation(send);
        await expect(respondToProposalAction(TOKEN, "Alex Client", "alex@example.test"))
            .resolves.toEqual({ success: true, status: "acknowledged", respondedAt: "2026-10-06T10:00:00.000Z" });
    });

    it("returns the confirmed response when the contractor lookup throws, still sending the client copy", async () => {
        arrange({ data: [row()], error: null });
        mocks.getUserById.mockRejectedValue(new Error("auth unavailable"));
        await expect(respondToProposalAction(TOKEN, "Alex Client", "alex@example.test")).resolves.toMatchObject({ success: true, status: "acknowledged" });
        expect(mocks.sendProposalResponseReceipt.mock.calls.map(([args]) => args.recipientKind)).toEqual(["client"]);
    });

    it("keeps addresses, provider text and the access token out of the server log", async () => {
        arrange({ data: [row()], error: null }, () => ({ data: null, error: { code: "XX000", message: "db" } }));
        mocks.sendProposalResponseReceipt.mockRejectedValue(new Error("rejected recipient alex@example.test"));
        mocks.getUserById.mockRejectedValue(new Error("lookup failed for contractor@example.test"));
        await respondToProposalAction(TOKEN, "Alex Client", "alex@example.test");
        expect(logs.length).toBeGreaterThan(0);
        expect(JSON.stringify(logs, (_key, value) => value instanceof Error ? `${value.name}: ${value.message}` : value))
            .not.toMatch(/example\.test|rejected recipient|abab/);
    });

    it("answers a deliberate identical retry with the same confirmed record and the same receipt idempotency keys", async () => {
        arrange({ data: [row()], error: null });
        const first = await respondToProposalAction(TOKEN, "Alex Client", "alex@example.test");
        const second = await respondToProposalAction(TOKEN, "Alex Client", "alex@example.test");
        expect(second).toEqual(first);
        const keys = mocks.sendProposalResponseReceipt.mock.calls.map(([args]) => args.idempotencyKey);
        expect(keys).toEqual(["proposal-response-client/pub-1/acknowledged", "proposal-response-owner/pub-1/acknowledged",
            "proposal-response-client/pub-1/acknowledged", "proposal-response-owner/pub-1/acknowledged"]);
    });
});
