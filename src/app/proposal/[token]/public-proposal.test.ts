import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { representativeInput, stressInput } from "@/lib/__fixtures__/proposal";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), sendProposalResponseReceipt: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/email", () => ({ sendProposalResponseReceipt: mocks.sendProposalResponseReceipt }));

import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { buildProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { responseWording, type RecordedResponseKind } from "@/lib/proposal-response";
import { respondToProposalAction } from "./actions";
import ResponseClient from "./response-client";

const TOKEN = "ab".repeat(32);
const snapshotFor = (kind: "acknowledgement" | "non_binding_intent") =>
    buildProposalPublicationSnapshot({ ...representativeInput(), responseKind: kind });

function arrange(snapshot: ProposalPublicationSnapshot | null, error: { code: string; message: string } | null = null) {
    const admin = fakeSupabase({});
    admin.onRpc((name) => name === "respond_to_proposal_publication"
        ? {
            data: snapshot ? [{
                publication_id: "pub-1",
                owner_user_id: "owner-1",
                publication_status: "acknowledged",
                snapshot,
                responded_at: "2026-10-06T10:00:00.000Z",
                publication_snapshot_hash: "cd".repeat(32),
            }] : null,
            error,
        }
        : { data: null, error: null });
    mocks.createAdminClient.mockReturnValue({
        ...admin.client,
        auth: { admin: { getUserById: async () => ({ data: { user: { email: "contractor@example.test" } } }) } },
    });
    mocks.sendProposalResponseReceipt.mockResolvedValue({ data: { id: "receipt-1" }, error: null });
    return admin;
}

beforeEach(() => vi.clearAllMocks());

describe("respondToProposalAction", () => {
    it.each(["acknowledgement", "non_binding_intent"] as const)("records only the non-binding response for a %s proposal", async (kind) => {
        const admin = arrange(snapshotFor(kind));
        await expect(respondToProposalAction(TOKEN, " Alex Client ", "alex@example.test")).resolves.toEqual({
            success: true,
            status: "acknowledged",
            respondedAt: "2026-10-06T10:00:00.000Z",
        });
        const call = admin.rpcCalls.find((entry) => entry.name === "respond_to_proposal_publication")!;
        expect(call.args).toMatchObject({ p_response: "acknowledged", p_name: "Alex Client", p_email: "alex@example.test", p_note: null });
        expect(call.args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(call.args.p_token_hash).not.toBe(TOKEN);
    });

    it("words both receipts from what the publication asked for", async () => {
        arrange(snapshotFor("non_binding_intent"));
        await respondToProposalAction(TOKEN, "Alex Client", "alex@example.test");
        expect(mocks.sendProposalResponseReceipt).toHaveBeenCalledTimes(2);
        for (const [args] of mocks.sendProposalResponseReceipt.mock.calls) {
            expect(args).toMatchObject({ response: "acknowledged", responseKind: "non_binding_intent", refCode: "22222222-V1", publicationVersion: 1 });
        }
        expect(mocks.sendProposalResponseReceipt.mock.calls.map(([args]) => args.recipientEmail).sort()).toEqual(["alex@example.test", "contractor@example.test"]);
    });

    it("has no way to record acceptance: there is no response argument", () => {
        expect(respondToProposalAction.length).toBe(3);
    });

    it("keeps a recorded response recorded when a receipt email fails", async () => {
        const admin = arrange(snapshotFor("acknowledgement"));
        mocks.sendProposalResponseReceipt.mockRejectedValue(new Error("provider down"));
        await expect(respondToProposalAction(TOKEN, "Alex Client", "alex@example.test")).resolves.toMatchObject({ success: true, status: "acknowledged" });
        const recorded = admin.rpcCalls.filter((entry) => entry.name === "record_proposal_receipt_delivery");
        expect(recorded).toHaveLength(2);
        recorded.forEach((entry) => expect(entry.args.p_succeeded).toBe(false));
    });

    it("sends no client receipt when the client gave no email", async () => {
        arrange(snapshotFor("acknowledgement"));
        await respondToProposalAction(TOKEN, "Alex Client", "");
        expect(mocks.sendProposalResponseReceipt.mock.calls.map(([args]) => args.recipientKind)).toEqual(["owner"]);
    });

    it.each([
        ["23514", "This proposal can no longer receive a response. Please contact the contractor."],
        ["P0002", "Proposal not found."],
        ["XX000", "Your response could not be recorded. Please try again, or contact the contractor."],
    ])("reports a refusal (%s) truthfully and sends no receipt", async (code, message) => {
        arrange(null, { code, message: "db" });
        await expect(respondToProposalAction(TOKEN, "Alex Client", "")).resolves.toEqual({ success: false, error: message });
        expect(mocks.sendProposalResponseReceipt).not.toHaveBeenCalled();
    });

    it.each([
        ["a malformed token", "short", "Alex Client", ""],
        ["a one-letter name", TOKEN, "A", ""],
        ["a header-injection name", TOKEN, "Alex\r\nBcc: x@example.test", ""],
        ["a bad email", TOKEN, "Alex Client", "not-an-email"],
    ])("rejects %s before reaching the database", async (_label, token, name, email) => {
        const admin = arrange(snapshotFor("acknowledgement"));
        const result = await respondToProposalAction(token, name, email);
        expect(result.success).toBe(false);
        expect(admin.rpcCalls).toEqual([]);
    });
});

function responseMarkup(kind: RecordedResponseKind, patch: Record<string, unknown> = {}) {
    const wording = responseWording(kind);
    return renderToStaticMarkup(createElement(ResponseClient, {
        token: TOKEN,
        kind,
        heading: wording.heading,
        notice: wording.notice,
        actionLabel: wording.actionLabel,
        recordedHeading: wording.recordedHeading,
        recordedNoun: wording.recordedNoun,
        companyName: "Example Building Ltd",
        reference: "22222222-V1",
        defaultName: "Alex Client",
        status: "viewed",
        respondedAt: null,
        respondedBy: null,
        isExpired: false,
        isRevoked: false,
        respond: vi.fn(),
        ...patch,
    }));
}

describe("public response control", () => {
    it.each(["acknowledgement", "non_binding_intent"] as const)("offers one action for %s, with the statement of what it means above it", (kind) => {
        const html = responseMarkup(kind).replace(/&#x27;/g, "'");
        const wording = responseWording(kind);
        expect(html).toContain(wording.heading);
        expect(html).toContain(wording.notice);
        expect(html.match(/<button/g)).toHaveLength(1);
        expect(html).toContain(`>${wording.actionLabel}</button>`);
        expect(html.indexOf(wording.notice)).toBeLessThan(html.indexOf("<button"));
    });

    it("never offers acceptance or a decline button", () => {
        for (const kind of ["acknowledgement", "non_binding_intent"] as const) {
            const html = responseMarkup(kind);
            expect(html).not.toMatch(/Accept (This )?Proposal/i);
            expect(html).not.toMatch(/binding agreement/i);
            expect(html).not.toMatch(/>\s*Decline/i);
        }
    });

    it("gives every control a target of at least 44px and text that will not zoom a phone", () => {
        const html = responseMarkup("non_binding_intent");
        const controls = html.match(/<(input|button)[^>]*>/g) ?? [];
        expect(controls).toHaveLength(3);
        // h-12 is 48px and min-h-14 is 56px; text-base is 16px.
        controls.forEach((control) => {
            expect(control).toMatch(/\b(h-12|min-h-14)\b/);
            expect(control).toMatch(/\btext-base\b/);
        });
        expect(html.match(/<label[^>]*for="response-(name|email)"/g)).toHaveLength(2);
    });

    it("shows a recorded response as what it was, with the statement repeated", () => {
        const html = responseMarkup("non_binding_intent", { status: "acknowledged", respondedAt: "2026-10-06T10:00:00.000Z", respondedBy: "Alex Client" }).replace(/&#x27;/g, "'");
        expect(html).toContain("Intention to proceed recorded");
        expect(html).toContain("Your non-binding intention to proceed was recorded on 6 October 2026");
        expect(html).toContain(responseWording("non_binding_intent").notice);
        expect(html).not.toContain("<button");
    });

    it("shows a proposal accepted before this change as accepted, and does not reword it", () => {
        const html = responseMarkup("binding_acceptance", { status: "accepted", respondedAt: "2026-09-01T10:00:00.000Z", respondedBy: "Alex Client" });
        expect(html).toContain("Proposal accepted");
        expect(html).toContain("Your acceptance was recorded on 1 September 2026");
        expect(html).not.toContain("Receipt confirmed");
        expect(html).not.toContain("not acceptance");
    });

    it("offers no online response on an earlier proposal that asked for acceptance and is still open", () => {
        const html = responseMarkup("binding_acceptance");
        expect(html).not.toContain("<button");
        expect(html).not.toContain("<input");
        expect(html).toContain("cannot be responded to online");
    });

    it("closes an expired or replaced proposal", () => {
        expect(responseMarkup("acknowledgement", { isExpired: true })).toContain("This proposal has expired");
        expect(responseMarkup("acknowledgement", { isRevoked: true })).toContain("This proposal has been replaced");
        expect(responseMarkup("acknowledgement", { isRevoked: true })).not.toContain("<button");
    });
});

describe("public proposal on a phone", () => {
    const render = (snapshot: ProposalPublicationSnapshot) =>
        renderToStaticMarkup(createElement(ProposalDocumentView, { doc: buildProposalDocument(snapshot) }));

    it.each([["a typical proposal", representativeInput()], ["a very long proposal", stressInput()]])(
        "lays out %s in one column with nothing that scrolls sideways", (_label, input) => {
            const html = render(buildProposalPublicationSnapshot(input));
            // No tables, no fixed or minimum pixel widths, no sideways scrollers.
            expect(html).not.toContain("<table");
            expect(html).not.toMatch(/overflow-x-(auto|scroll)/);
            expect(html).not.toMatch(/\bmin-w-\[\d/);
            expect(html).not.toMatch(/\bw-\[\d+px\]/);
            // Long words and links wrap instead of pushing the page wide.
            expect(html).toContain("[overflow-wrap:anywhere]");
            // Every multi-column grid starts as a single column or a two-up that fits 390px.
            const grids = html.match(/class="[^"]*\bgrid\b[^"]*"/g) ?? [];
            expect(grids.length).toBeGreaterThan(0);
            grids.forEach((grid) => expect(grid).toMatch(/\bgrid-cols-(1|2)\b/));
            // Images are sized by their container.
            (html.match(/<img[^>]*>/g) ?? []).forEach((img) => expect(img).toMatch(/\b(w-full|max-w-\[60%\])\b/));
        },
    );

    it("is always the light document, whatever theme the app is in", () => {
        const html = render(snapshotFor("acknowledgement"));
        expect(html).toContain("bg-white");
        expect(html).not.toMatch(/bg-slate-9\d\d|text-slate-100|bg-\[#0d0d0d\]/);
    });
});
