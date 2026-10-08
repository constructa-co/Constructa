import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { representativeInput } from "@/lib/__fixtures__/proposal";

const mocks = vi.hoisted(() => ({
    requireEditableProjectAccess: vi.fn(),
    requireProjectAccess: vi.fn(),
    createAdminClient: vi.fn(),
    sessionReader: vi.fn(),
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.requireEditableProjectAccess }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireProjectAccess: mocks.requireProjectAccess }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/email", () => ({ sendProposalEmail: vi.fn() }));
vi.mock("@/lib/storage/public-image", () => ({ validatePublicImage: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The library is read through the contractor's own session. Here that session is the in-memory library.
vi.mock("@/lib/case-library/store", async (original) => ({ ...(await original<typeof import("@/lib/case-library/store")>()), sessionReader: mocks.sessionReader }));

import { fakeLibrary } from "@/lib/case-library/__fixtures__/fake-library";
import { newDraft } from "@/lib/case-library/content";
import { CASE_LIBRARY_VARIABLE } from "@/lib/case-library/gate";
import { readProposalLibrary } from "@/lib/case-library/proposal-read";
import { libraryTick } from "@/lib/case-library/resolve";
import { CASE_STUDY_UNSENDABLE_ERROR, hashProposalContent, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { REVIEW_CHANGED_ERROR, buildPreviewSnapshot, draftFromProject, type ReviewContext } from "@/lib/proposal-review";
import { publishProposalAction } from "./actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const input = representativeInput();

let db: ReturnType<typeof fakeSupabase>;
let library: ReturnType<typeof fakeLibrary>;

function setup(selected: unknown[]) {
    db = fakeSupabase({
        projects: [{ ...input.project, id: PROJECT_ID, user_id: USER_ID, status: "Estimating", validity_days: 30, tc_overrides: null, client_email: "alex@example.test", is_vat_reverse_charge: false, current_proposal_publication_id: null, selected_case_study_ids: selected }],
        estimates: [{ ...input.estimate, id: "33333333-3333-4333-8333-333333333333", project_id: PROJECT_ID, is_active: true }],
        profiles: [{ ...input.profile, id: USER_ID }],
        proposal_publications: [],
        proposal_delivery_attempts: [],
    });
    db.onRpc((name, args) => name === "publish_proposal_publication" ? { data: [{ publication_id: args.p_publication_id, delivery_id: null }], error: null } : { data: null, error: null });
    mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
    mocks.sessionReader.mockImplementation(() => library.reader);
}

/** An approved case study in the contractor's library. Returns its tick. */
async function approved(title: string, delivered = `${title} delivered.`): Promise<string> {
    const created = library.admin.rpc("case_study_create", { p_user_id: USER_ID, p_content: { ...newDraft(title), delivered, client_text: "Mrs Private" }, p_legacy_index: null });
    const id = String((await created).data.id);
    await library.admin.rpc("case_study_approve", { p_user_id: USER_ID, p_id: id, p_expected_revision: 1, p_confirmed: true });
    return libraryTick(id);
}

/** The fingerprint the review screen would send: the preview built from what the page was handed. */
async function reviewed(withLibrary: boolean): Promise<string> {
    const project = db.tables.projects[0] as unknown as ReviewContext["project"];
    const context: ReviewContext = {
        project, profile: db.tables.profiles[0], estimate: db.tables.estimates[0] as unknown as ReviewContext["estimate"], nextVersion: 1,
        ...(withLibrary ? { caseStudyLibrary: await readProposalLibrary(library.reader, USER_ID, project.selected_case_study_ids) } : {}),
    };
    const preview = buildPreviewSnapshot(context, draftFromProject(project, () => "k"), "acknowledgement", "2026-10-05T09:00:00.000Z");
    return hashProposalContent(preview!);
}
const publish = async (reviewedContent: string) => publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false, reviewedContent });
const published = () => db.rpcCalls.filter((call) => call.name === "publish_proposal_publication");

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    library = fakeLibrary();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("publishing with the case-study library switched on", () => {
    beforeEach(() => vi.stubEnv(CASE_LIBRARY_VARIABLE, "1"));

    it("sends an approved library case study exactly as it was previewed", async () => {
        const tick = await approved("Kitchen at Example Road");
        setup(["cs-1", tick]);
        const result = await publish(await reviewed(true));
        expect(result).toMatchObject({ success: true, versionNumber: 1 });
        const snapshot = published()[0].args.p_snapshot as ProposalPublicationSnapshot;
        expect(snapshot.case_studies!.map((study) => study.title)).toEqual(["Shower room, 3 Sample Street", "Kitchen at Example Road"]);
        expect(JSON.stringify(snapshot)).not.toContain("Mrs Private");
        // The library was read with the contractor's own session, and no privileged client was made to read it.
        expect(mocks.sessionReader).toHaveBeenCalledWith(db.client);
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(library.rpcCalls.filter((call) => !["case_study_create", "case_study_approve"].includes(call.name))).toEqual([]);
    });

    it("an older-only proposal publishes as before, whatever the library holds", async () => {
        await approved("Not chosen");
        setup(["cs-1"]);
        const result = await publish(await reviewed(false));
        expect(result).toMatchObject({ success: true });
        expect((published()[0].args.p_snapshot as ProposalPublicationSnapshot).case_studies!.map((study) => study.title)).toEqual(["Shower room, 3 Sample Street"]);
    });

    it("refuses, as changed, when the case study was approved again with different words after the preview", async () => {
        const tick = await approved("Kitchen");
        setup([tick]);
        const before = await reviewed(true);
        const id = tick.slice(4);
        await library.admin.rpc("case_study_save_draft", { p_user_id: USER_ID, p_id: id, p_expected_revision: 1, p_content: { ...newDraft("Kitchen"), delivered: "Different words." } });
        await library.admin.rpc("case_study_approve", { p_user_id: USER_ID, p_id: id, p_expected_revision: 2, p_confirmed: true });
        expect(await publish(before)).toEqual({ success: false, error: REVIEW_CHANGED_ERROR, changed: true });
        expect(published()).toEqual([]);
    });

    it("an edit that is saved but not approved changes nothing that is sent", async () => {
        const tick = await approved("Kitchen");
        setup([tick]);
        const before = await reviewed(true);
        await library.admin.rpc("case_study_save_draft", { p_user_id: USER_ID, p_id: tick.slice(4), p_expected_revision: 1, p_content: { ...newDraft("Kitchen"), delivered: "Unapproved edit." } });
        expect(await publish(before)).toMatchObject({ success: true });
        expect(JSON.stringify(published()[0].args.p_snapshot)).not.toContain("Unapproved edit.");
    });

    it.each([
        ["archived after it was chosen", async (tick: string) => { await library.admin.rpc("case_study_archive", { p_user_id: USER_ID, p_id: tick.slice(4), p_expected_revision: 1, p_archived: true }); }],
        ["the library can no longer be read", async () => { library.setUnavailable(true); }],
        ["it belongs to nobody the contractor can see", async () => { library.studies.length = 0; }],
    ] as const)("refuses to publish, and publishes nothing, when the chosen case study is %s", async (_label, change) => {
        const tick = await approved("Kitchen");
        setup(["cs-1", tick]);
        const before = await reviewed(true);
        await change(tick);
        expect(await publish(before)).toEqual({ success: false, error: CASE_STUDY_UNSENDABLE_ERROR });
        expect(published()).toEqual([]);
    });

    it("a draft that was never approved cannot be published by ticking it", async () => {
        const created = await library.admin.rpc("case_study_create", { p_user_id: USER_ID, p_content: newDraft("Only a draft"), p_legacy_index: null });
        setup([libraryTick(String(created.data.id))]);
        expect(await publish("0".repeat(64))).toEqual({ success: false, error: CASE_STUDY_UNSENDABLE_ERROR });
        expect(published()).toEqual([]);
    });

    it("another contractor's approved case study cannot be published by ticking its id", async () => {
        const theirs = await library.admin.rpc("case_study_create", { p_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", p_content: { ...newDraft("Their job"), delivered: "Their words." }, p_legacy_index: null });
        await library.admin.rpc("case_study_approve", { p_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", p_id: theirs.data.id, p_expected_revision: 1, p_confirmed: true });
        setup([libraryTick(String(theirs.data.id))]);
        expect(await publish("0".repeat(64))).toEqual({ success: false, error: CASE_STUDY_UNSENDABLE_ERROR });
        expect(published()).toEqual([]);
    });

    it("a project that can no longer be edited is refused before the library is read", async () => {
        const tick = await approved("Kitchen");
        setup([tick]);
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("This project has been accepted."));
        expect((await publish("0".repeat(64))).success).toBe(false);
        expect(mocks.sessionReader).not.toHaveBeenCalled();
        expect(published()).toEqual([]);
    });
});

describe("publishing with the case-study library switched off", () => {
    it("a saved library tick still stops the publication: it is never sent without it", async () => {
        const tick = await approved("Kitchen");
        setup(["cs-1", tick]);
        for (const value of [undefined, "0", "true", "yes", " 1"]) {
            vi.unstubAllEnvs();
            vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");
            if (value !== undefined) vi.stubEnv(CASE_LIBRARY_VARIABLE, value);
            expect(await publish(await reviewed(false)), String(value)).toEqual({ success: false, error: CASE_STUDY_UNSENDABLE_ERROR });
        }
        expect(published()).toEqual([]);
        // Off means the library is not read at all.
        expect(mocks.sessionReader).not.toHaveBeenCalled();
    });

    it("an older-only proposal publishes exactly as before", async () => {
        setup(["cs-1"]);
        expect(await publish(await reviewed(false))).toMatchObject({ success: true });
        expect(mocks.sessionReader).not.toHaveBeenCalled();
    });
});
