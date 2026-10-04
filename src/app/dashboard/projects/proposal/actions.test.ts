import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { representativeInput } from "@/lib/__fixtures__/proposal";

const mocks = vi.hoisted(() => ({
    requireEditableProjectAccess: vi.fn(),
    requireProjectAccess: vi.fn(),
    createAdminClient: vi.fn(),
    sendProposalEmail: vi.fn(),
    generateText: vi.fn(),
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.requireEditableProjectAccess }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireProjectAccess: mocks.requireProjectAccess }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/email", () => ({ sendProposalEmail: mocks.sendProposalEmail }));
vi.mock("@/lib/ai", () => ({ generateText: mocks.generateText }));
vi.mock("@/lib/storage/public-image", () => ({ validatePublicImage: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { hashProposalAccessToken, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { AI_UNAVAILABLE_ERROR, DELIVERY_ERROR, DRAFT_SAVE_ERROR, PUBLISH_ERROR, type ProposalDraftPayload } from "@/lib/proposal-review";
import { responseWording } from "@/lib/proposal-response";
import {
    getProposalPublicationAction,
    publishProposalAction,
    retryProposalDeliveryAction,
    saveProposalDraftAction,
    suggestProposalWordingAction,
} from "./actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ESTIMATE_ID = "33333333-3333-4333-8333-333333333333";
const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";

const input = representativeInput();

function setup(projectPatch: Record<string, unknown> = {}, publications: Record<string, unknown>[] = []) {
    const db = fakeSupabase({
        projects: [{
            ...input.project,
            id: PROJECT_ID,
            user_id: USER_ID,
            status: "Estimating",
            validity_days: 30,
            tc_overrides: null,
            client_email: "alex@example.test",
            is_vat_reverse_charge: false,
            current_proposal_publication_id: null,
            ...projectPatch,
        }],
        estimates: [{ ...input.estimate, id: ESTIMATE_ID, project_id: PROJECT_ID, is_active: true }],
        profiles: [{ ...input.profile, id: USER_ID }],
        proposal_publications: publications,
        proposal_delivery_attempts: [],
    });
    db.onRpc((name, args) => name === "publish_proposal_publication"
        ? { data: [{ publication_id: args.p_publication_id, delivery_id: args.p_delivery_email ? DELIVERY_ID : null }], error: null }
        : { data: null, error: null });

    // The delivery ledger is server-only, as the database grants make it:
    // the service role holds it and the contractor's session is refused.
    const admin = fakeSupabase({ proposal_delivery_attempts: [] });
    db.fail("proposal_delivery_attempts", "select", "42501", Number.MAX_SAFE_INTEGER, "permission denied for table proposal_delivery_attempts");
    const access = { user: { id: USER_ID }, supabase: db.client };
    mocks.requireEditableProjectAccess.mockResolvedValue(access);
    mocks.requireProjectAccess.mockResolvedValue(access);
    mocks.createAdminClient.mockReturnValue(admin.client);
    mocks.sendProposalEmail.mockResolvedValue({ data: { id: "provider-1" }, error: null });
    return { db, admin };
}

const payload: ProposalDraftPayload = {
    introduction: "Hello.",
    scope: "Refit the bathroom.",
    exclusions: "Decorating",
    clarifications: "",
    closing: "",
    validityDays: 21,
    paymentSchedule: [{ id: "p1", stage: "Deposit", description: "On booking", percentage: 30 }],
    photos: [{ url: "https://images.example.test/a.jpg", caption: "Before" }],
    caseStudyIds: ["cs-1"],
    terms: null,
};

const publishedSnapshot = (db: ReturnType<typeof setup>["db"]) =>
    db.rpcCalls.find((call) => call.name === "publish_proposal_publication")!.args.p_snapshot as ProposalPublicationSnapshot;

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");
});

describe("saveProposalDraftAction", () => {
    it("saves the contractor's wording and choices in one owner-scoped update", async () => {
        const { db } = setup();
        await expect(saveProposalDraftAction(PROJECT_ID, payload)).resolves.toEqual({ success: true });
        expect(db.updates).toHaveLength(1);
        expect(db.updates[0].filters).toEqual({ id: PROJECT_ID, user_id: USER_ID });
        expect(db.updates[0].values).toEqual({
            proposal_introduction: "Hello.",
            scope_text: "Refit the bathroom.",
            exclusions_text: "Decorating",
            clarifications_text: null,
            closing_statement: null,
            validity_days: 21,
            site_photos: [{ url: "https://images.example.test/a.jpg", caption: "Before" }],
            selected_case_study_ids: ["cs-1"],
            tc_overrides: null,
            payment_schedule: [{ id: "p1", stage: "Deposit", description: "On booking", percentage: 30 }],
        });
    });

    it("leaves fixed-amount payment stages untouched when told to", async () => {
        const { db } = setup();
        await saveProposalDraftAction(PROJECT_ID, { ...payload, paymentSchedule: null });
        expect(db.updates[0].values).not.toHaveProperty("payment_schedule");
    });

    it("keeps nothing from a failed save, and the same payload succeeds on retry", async () => {
        const { db } = setup();
        db.fail("projects", "update", "57014");
        await expect(saveProposalDraftAction(PROJECT_ID, payload)).resolves.toEqual({ success: false, error: DRAFT_SAVE_ERROR });
        expect(db.tables.projects[0].scope_text).toBe(input.project.scope_text);
        await expect(saveProposalDraftAction(PROJECT_ID, payload)).resolves.toEqual({ success: true });
        expect(db.tables.projects[0].scope_text).toBe("Refit the bathroom.");
    });

    it("refuses a locked project with the reason, and another user's project without one", async () => {
        const { db } = setup();
        mocks.requireEditableProjectAccess.mockRejectedValueOnce(new Error("This project is archived. Restore it before editing pre-contract information."));
        await expect(saveProposalDraftAction(PROJECT_ID, payload)).resolves.toEqual({
            success: false,
            error: "This project is archived. Restore it before editing pre-contract information.",
        });
        mocks.requireEditableProjectAccess.mockRejectedValueOnce(new Error("Unauthorized project access."));
        await expect(saveProposalDraftAction(PROJECT_ID, payload)).resolves.toEqual({ success: false, error: "You can't change this proposal." });
        expect(db.updates).toEqual([]);
    });

    it.each([
        ["an unsafe photo link", { ...payload, photos: [{ url: "javascript:alert(1)", caption: "" }] }],
        ["payment stages over 100%", { ...payload, paymentSchedule: [{ id: "a", stage: "A", description: "", percentage: 60 }, { id: "b", stage: "B", description: "", percentage: 60 }] }],
        ["a validity of zero days", { ...payload, validityDays: 0 }],
        ["an oversized scope", { ...payload, scope: "x".repeat(20_001) }],
    ])("rejects %s without writing", async (_label, bad) => {
        const { db } = setup();
        const result = await saveProposalDraftAction(PROJECT_ID, bad as ProposalDraftPayload);
        expect(result.success).toBe(false);
        expect(db.updates).toEqual([]);
    });

    it("never reads or writes a published version", async () => {
        const { db } = setup();
        await saveProposalDraftAction(PROJECT_ID, payload);
        expect(db.log.some((entry) => entry.includes("proposal_publications") || entry.startsWith("rpc:"))).toBe(false);
    });
});

describe("publishProposalAction", () => {
    it("publishes an acknowledgement proposal with the canonical programme in the snapshot", async () => {
        const { db } = setup();
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false });
        expect(result).toMatchObject({ success: true, versionNumber: 1, delivery: { status: "not_requested" } });
        if (!result.success) return;
        expect(result.url).toMatch(/^https:\/\/app\.example\.test\/proposal\/[a-f0-9]{64}$/);

        const snapshot = publishedSnapshot(db);
        expect(snapshot.publication.response_mode).toBe("acknowledgement");
        expect(snapshot.response).toEqual({ kind: "acknowledgement", notice: responseWording("acknowledgement").notice });
        expect(snapshot.programme_plan).toMatchObject({ start_date: "2026-11-02", end_date: "2026-11-20", duration_label: "3 weeks" });
        expect(snapshot.commercial).toMatchObject({ contract_sum_ex_vat: 7552.05, vat_rate: 20, vat_treatment: "standard", contract_sum_inc_vat: 9062.46 });
        expect(snapshot.case_studies?.map((study) => study.title)).toEqual(["Shower room, 3 Sample Street"]);
        expect(snapshot.photos).toHaveLength(2);

        const args = db.rpcCalls[0].args;
        expect(args.p_contract_sum_ex_vat).toBe(7552.05);
        expect(args.p_delivery_email).toBeNull();
        // The link's token is stored only as its hash.
        expect(args.p_token_hash).toBe(await hashProposalAccessToken(result.url.split("/").pop()!));
        expect(mocks.sendProposalEmail).not.toHaveBeenCalled();
    });

    it("publishes a non-binding intention under the acknowledgement mode", async () => {
        const { db } = setup();
        await publishProposalAction(PROJECT_ID, { responseKind: "non_binding_intent", deliverByEmail: false });
        const snapshot = publishedSnapshot(db);
        expect(snapshot.publication.response_mode).toBe("acknowledgement");
        expect(snapshot.response).toEqual({ kind: "non_binding_intent", notice: responseWording("non_binding_intent").notice });
    });

    it.each(["binding_acceptance", "accepted", "", null, undefined])("refuses to publish asking for %j, before touching the database", async (kind) => {
        const { db } = setup();
        const result = await publishProposalAction(PROJECT_ID, { responseKind: kind as never, deliverByEmail: false });
        expect(result).toEqual({ success: false, error: PUBLISH_ERROR });
        expect(db.log).toEqual([]);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
    });

    it("blocks a proposal with no programme, checked again on the server", async () => {
        const { db } = setup({ programme_phases: [] });
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: true });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("Add the start date and how long the job takes in Programme.");
        expect(db.rpcCalls).toEqual([]);
        expect(mocks.sendProposalEmail).not.toHaveBeenCalled();
    });

    it("blocks a proposal with a duration but no start date", async () => {
        const { db } = setup({ start_date: null });
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false });
        expect(result.success).toBe(false);
        expect(db.rpcCalls).toEqual([]);
    });

    it("blocks a proposal with no scope or no payment stages", async () => {
        const { db } = setup({ scope_text: "", payment_schedule: [] });
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false });
        expect(result.success).toBe(false);
        expect(db.rpcCalls).toEqual([]);
    });

    it("refuses a locked project and one without exactly one active estimate", async () => {
        const { db } = setup();
        mocks.requireEditableProjectAccess.mockRejectedValueOnce(new Error("This proposal has been accepted. Record later scope or price changes as variations."));
        await expect(publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false })).resolves.toMatchObject({
            success: false,
            error: "This proposal has been accepted. Record later scope or price changes as variations.",
        });
        db.tables.estimates[0].is_active = false;
        await expect(publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false })).resolves.toMatchObject({
            success: false,
            error: "Exactly one active estimate is required before publishing this proposal.",
        });
        expect(db.rpcCalls).toEqual([]);
    });

    it("reports a publication the database refused as not published, and sends no email", async () => {
        const { db } = setup();
        db.fail("publish_proposal_publication", "rpc", "23514", 1, "Published contract sum does not match the active estimate.");
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: true });
        expect(result).toEqual({ success: false, error: "Published contract sum does not match the active estimate." });
        expect(mocks.sendProposalEmail).not.toHaveBeenCalled();
    });

    it("emails the client only after the publication commits, worded for the chosen response", async () => {
        const { db, admin } = setup();
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "non_binding_intent", deliverByEmail: true });
        expect(result).toMatchObject({ success: true, delivery: { status: "sent", email: "alex@example.test" } });
        expect(db.rpcCalls[0].args.p_delivery_email).toBe("alex@example.test");
        expect(mocks.sendProposalEmail).toHaveBeenCalledWith(expect.objectContaining({
            clientEmail: "alex@example.test",
            responseKind: "non_binding_intent",
            idempotencyKey: `proposal-delivery/${DELIVERY_ID}`,
        }));
        expect(admin.rpcCalls).toEqual([{
            name: "record_proposal_delivery_attempt",
            args: { p_delivery_id: DELIVERY_ID, p_succeeded: true, p_provider_message_id: "provider-1", p_error_code: null },
        }]);
    });

    it.each([
        ["the provider rejects it", () => mocks.sendProposalEmail.mockResolvedValue({ data: null, error: { name: "validation_error" } })],
        ["the send throws", () => mocks.sendProposalEmail.mockRejectedValue(new Error("RESEND_API_KEY is required to send email."))],
    ])("still reports the publication as published when %s", async (_label, arrange) => {
        const { admin } = setup();
        arrange();
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: true });
        expect(result).toMatchObject({ success: true, versionNumber: 1, delivery: { status: "failed", email: "alex@example.test" } });
        expect(admin.rpcCalls[0].args).toMatchObject({ p_delivery_id: DELIVERY_ID, p_succeeded: false });
    });

    it("still reports the publication as published when the email outcome cannot be recorded", async () => {
        const { admin } = setup();
        admin.fail("record_proposal_delivery_attempt", "rpc");
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: true });
        expect(result).toMatchObject({ success: true, delivery: { status: "sent" } });
    });

    it("sends no email when there is no client email, even if asked", async () => {
        const { db } = setup({ client_email: null });
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: true });
        expect(result).toMatchObject({ success: true, delivery: { status: "not_requested" } });
        expect(db.rpcCalls[0].args.p_delivery_email).toBeNull();
    });

    it("republishing makes the next version and never updates an earlier publication", async () => {
        const earlier = { id: "pub-1", project_id: PROJECT_ID, version_number: 1, status: "viewed", snapshot: { frozen: true }, snapshot_hash: "h1" };
        const { db } = setup({}, [earlier]);
        await saveProposalDraftAction(PROJECT_ID, { ...payload, scope: "A different scope after sending." });
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false });
        expect(result).toMatchObject({ success: true, versionNumber: 2 });
        expect(publishedSnapshot(db).content.scope).toBe("A different scope after sending.");
        // The earlier row is untouched: superseding it is the database's job, inside the publish transaction.
        expect(db.tables.proposal_publications[0]).toEqual(earlier);
        expect(db.updates.every((update) => update.table === "projects")).toBe(true);
    });
});

describe("retryProposalDeliveryAction", () => {
    const token = "ab".repeat(32);
    const url = `https://app.example.test/proposal/${token}`;
    const PUBLICATION_ID = "66666666-6666-4666-8666-666666666666";

    async function arrange(status = "sent", attemptStatus = "failed") {
        const snapshot = { project: { name: "Job", client_name: "Alex Client", site_address: null }, contractor: { company_name: "Example Building Ltd" }, publication: { response_mode: "acknowledgement" }, response: { kind: "non_binding_intent" } };
        const world = setup({}, [{ id: PUBLICATION_ID, project_id: PROJECT_ID, token_hash: await hashProposalAccessToken(token), status, snapshot }]);
        world.admin.tables.proposal_delivery_attempts.push({ id: DELIVERY_ID, publication_id: PUBLICATION_ID, status: attemptStatus, attempt_count: 1, recipient_email: "alex@example.test" });
        return world;
    }

    it("sends the email again for the same publication, worded from its own snapshot", async () => {
        const { db, admin } = await arrange();
        await expect(retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url })).resolves.toEqual({
            success: true,
            delivery: { status: "sent", email: "alex@example.test" },
        });
        expect(mocks.sendProposalEmail).toHaveBeenCalledWith(expect.objectContaining({
            proposalUrl: url,
            responseKind: "non_binding_intent",
            idempotencyKey: `proposal-delivery/${DELIVERY_ID}/retry-1`,
        }));
        expect(admin.rpcCalls[0].args).toMatchObject({ p_delivery_id: DELIVERY_ID, p_succeeded: true });
        // Nothing about the publication changes.
        expect(db.updates).toEqual([]);
        expect(db.rpcCalls).toEqual([]);
    });

    it("reports a second failure as a failed email, not as an error in the publication", async () => {
        await arrange();
        mocks.sendProposalEmail.mockRejectedValue(new Error("provider down"));
        await expect(retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url })).resolves.toEqual({
            success: true,
            delivery: { status: "failed", email: "alex@example.test" },
        });
    });

    it("refuses a link that does not belong to the publication", async () => {
        await arrange();
        await expect(retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url: `https://evil.example.test/proposal/${"cd".repeat(32)}` }))
            .resolves.toEqual({ success: false, error: DELIVERY_ERROR });
        await expect(retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url: "not a link" }))
            .resolves.toEqual({ success: false, error: DELIVERY_ERROR });
        expect(mocks.sendProposalEmail).not.toHaveBeenCalled();
    });

    it("does not email a version that is no longer open, or one already delivered", async () => {
        await arrange("revoked");
        const closed = await retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url });
        expect(closed.success).toBe(false);
        await arrange("sent", "sent");
        await expect(retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url })).resolves.toEqual({
            success: true,
            delivery: { status: "sent", email: "alex@example.test" },
        });
        expect(mocks.sendProposalEmail).not.toHaveBeenCalled();
    });

    it("refuses another user's project", async () => {
        await arrange();
        mocks.requireProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        await expect(retryProposalDeliveryAction(PROJECT_ID, { publicationId: PUBLICATION_ID, url })).resolves.toEqual({ success: false, error: "You can't send this proposal." });
    });
});

describe("suggestProposalWordingAction", () => {
    it("returns wording and writes nothing", async () => {
        const { db } = setup();
        mocks.generateText.mockResolvedValue("  We will refit the bathroom.  ");
        await expect(suggestProposalWordingAction(PROJECT_ID, "scope", "we do the bathroom")).resolves.toEqual({ ok: true, text: "We will refit the bathroom." });
        expect(db.log).toEqual([]);
        const prompt = String(mocks.generateText.mock.calls[0][0]);
        expect(prompt).toContain("Do not add any fact, figure, price, date, duration");
        expect(prompt).toContain("we do the bathroom");
    });

    it("checks the contractor may edit the project before calling the assistant", async () => {
        setup();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        await expect(suggestProposalWordingAction(PROJECT_ID, "scope", "text")).resolves.toEqual({ ok: false, error: "You can't change this proposal." });
        expect(mocks.generateText).not.toHaveBeenCalled();
    });

    it("fails quietly so the contractor's own wording carries on working", async () => {
        setup();
        mocks.generateText.mockRejectedValue(new Error("OPENAI_API_KEY missing"));
        await expect(suggestProposalWordingAction(PROJECT_ID, "closing", "text")).resolves.toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
        mocks.generateText.mockResolvedValue("   ");
        await expect(suggestProposalWordingAction(PROJECT_ID, "closing", "text")).resolves.toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
    });

    it("rejects an unknown field or empty text without calling the assistant", async () => {
        setup();
        await expect(suggestProposalWordingAction(PROJECT_ID, "price" as never, "text")).resolves.toMatchObject({ ok: false });
        await expect(suggestProposalWordingAction(PROJECT_ID, "scope", "   ")).resolves.toMatchObject({ ok: false });
        expect(mocks.generateText).not.toHaveBeenCalled();
    });
});

describe("getProposalPublicationAction", () => {
    const rows = [
        { id: "pub-1", project_id: PROJECT_ID, snapshot: { v: 1 }, snapshot_hash: "h1" },
        { id: "pub-2", project_id: PROJECT_ID, snapshot: { v: 2 }, snapshot_hash: "h2" },
        { id: "pub-x", project_id: "another-project", snapshot: { v: 9 }, snapshot_hash: "hx" },
    ];

    it("loads the current version from its publication row, not from the draft", async () => {
        setup({ current_proposal_publication_id: "pub-2", scope_text: "Draft text edited after sending." }, rows);
        await expect(getProposalPublicationAction(PROJECT_ID)).resolves.toEqual({ success: true, snapshot: { v: 2 }, snapshotHash: "h2" });
    });

    it("loads an earlier version by id, so its PDF is made from what was sent then", async () => {
        setup({ current_proposal_publication_id: "pub-2" }, rows);
        await expect(getProposalPublicationAction(PROJECT_ID, "pub-1")).resolves.toEqual({ success: true, snapshot: { v: 1 }, snapshotHash: "h1" });
    });

    it("will not load a version belonging to a different project", async () => {
        setup({ current_proposal_publication_id: "pub-2" }, rows);
        await expect(getProposalPublicationAction(PROJECT_ID, "pub-x")).resolves.toMatchObject({ success: false });
    });

    it("says so when nothing has been published", async () => {
        setup();
        await expect(getProposalPublicationAction(PROJECT_ID)).resolves.toEqual({ success: false, error: "Publish the proposal before downloading its PDF." });
    });
});
