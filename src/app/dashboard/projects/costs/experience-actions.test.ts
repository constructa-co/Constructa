import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";
import { draftFromProject } from "@/lib/proposal-review";
import { approvedValue, newDraft } from "@/lib/case-library/content";

const mocks = vi.hoisted(() => ({ access: vi.fn(), enabled: false, library: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.access }));
vi.mock("@/lib/case-library/gate", () => ({ caseLibraryEnabled: () => mocks.enabled }));
vi.mock("@/lib/case-library/proposal-read", () => ({ readProposalLibrary: mocks.library }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { loadPricingExperienceSource } from "@/lib/server/pricing-experience";
import { savePricingExperienceAction } from "./experience-actions";
const id = "22222222-2222-4222-8222-222222222222", userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const libId = "00000000-0000-4000-8000-000000000001", tick = "lib:" + libId;
let db: ReturnType<typeof fakeSupabase>;
let older: Array<Record<string, string>>;
const read = async () => (await loadPricingExperienceSource((await mocks.access()).supabase, userId, db.tables.projects[0].selected_case_study_ids))!;
beforeEach(() => {
    older = [{ id: "old", projectName: "Saved kitchen", projectType: "Refurbishment", whatWeDelivered: "Kitchen fitted" }, { projectName: "Saved bathroom" }];
    db = fakeSupabase({ projects: [{ id, user_id: userId, selected_case_study_ids: [], scope_text: "Keep scope", proposal_introduction: "Keep opening", payment_schedule: [] }],
        profiles: [{ id: userId, case_studies: older }] });
    mocks.enabled = false; mocks.access.mockReset().mockResolvedValue({ supabase: db.client, user: { id: userId } }); mocks.library.mockReset();
});
describe("reviewed pricing experience selection", () => {
    it("updates ONLY selections with owner and JSONB CAS,then carries into existing review/snapshot/document", async () => {
        const source = await read(), before = { ...db.tables.projects[0] };
        const result = await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected: source.selected }, ["old", "1"]);
        expect(result.success).toBe(true);
        expect(db.updates).toEqual([{ table: "projects", values: { selected_case_study_ids: ["old", "1"] }, filters: { id, user_id: userId, selected_case_study_ids: "[]" } }]);
        expect(db.tables.projects[0]).toEqual({ ...before, selected_case_study_ids: ["old", "1"] });
        const input = minimalInput(), project = { ...input.project, ...db.tables.projects[0] }, profile = { ...input.profile, case_studies: older };
        expect(draftFromProject(project, () => "unused").caseStudyIds).toEqual(["old", "1"]);
        const snapshot = buildProposalPublicationSnapshot({ ...input, project, profile });
        expect(snapshot.case_studies?.map(study => study.title)).toEqual(["Saved kitchen", "Saved bathroom"]);
        expect(JSON.stringify(buildProposalDocument(snapshot))).toContain("Saved kitchen");
    });
    it("does not read the library while its gate is off", async () => { await read(); expect(mocks.library).not.toHaveBeenCalled(); });
    it.each([{ selected: null }, { selected: [] }, { selected: ["0", "missing", tick] }])("preserves exact legacy source %j and unavailable choices", async ({ selected }) => {
        db.tables.projects[0].selected_case_study_ids = selected;
        const source = await read(), next = [...(selected ?? []), "old"];
        expect((await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected }, next)).success).toBe(true);
        expect(db.tables.projects[0].selected_case_study_ids).toEqual(next);
    });
    it("refuses dropping unknown/disabled-library values or inventing a new choice", async () => {
        db.tables.projects[0].selected_case_study_ids = ["missing", tick]; const source = await read();
        const expected = { catalogKey: source.catalogKey, selected: source.selected };
        expect(await savePricingExperienceAction(id, expected, ["old"])).toMatchObject({ success: false, error: expect.stringContaining("unchanged") });
        expect(await savePricingExperienceAction(id, expected, ["missing", tick, "invented"])).toMatchObject({ success: false, error: expect.stringContaining("no longer available") });
        expect(db.updates).toEqual([]);
    });
    it("refuses changed source content even when the title/selection IDs stayed the same", async () => {
        const source = await read(); older[0].whatWeDelivered = "Revised facts";
        expect((await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected: source.selected }, ["old"])).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("refuses changed selection,null source read,wrong owner and accepted locks", async () => {
        const source = await read(), expected = { catalogKey: source.catalogKey, selected: source.selected };
        db.tables.projects[0].selected_case_study_ids = ["1"]; expect((await savePricingExperienceAction(id, expected, ["old"])).success).toBe(false);
        db.tables.projects[0].selected_case_study_ids = []; db.fail("profiles", "select"); expect((await savePricingExperienceAction(id, expected, ["old"])).success).toBe(false);
        db.tables.projects[0].user_id = "other"; expect((await savePricingExperienceAction(id, expected, ["old"])).success).toBe(false);
        mocks.access.mockRejectedValueOnce(Error("This proposal has been accepted. Record later scope or price changes as variations."));
        expect(await savePricingExperienceAction(id, expected, ["old"])).toMatchObject({ success: false, error: expect.stringContaining("accepted") }); expect(db.updates).toEqual([]);
    });
    it("enforces existing length limits before access without truncating", async () => {
        const source = await read(); mocks.access.mockClear();
        expect((await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected: [] }, Array(51).fill("old"))).success).toBe(false);
        expect((await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected: [] }, ["x".repeat(101)])).success).toBe(false); expect(mocks.access).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
    });
    it("does not confirm update rejection or concurrent selection changes", async () => {
        const source = await read(), expected = { catalogKey: source.catalogKey, selected: [] };
        db.fail("projects", "update"); expect(await savePricingExperienceAction(id, expected, ["old"])).toMatchObject({ success: false, uncertain: true });
        const from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = from(table), update = builder.update;
            builder.update = values => { db.tables.projects[0].selected_case_study_ids = ["1"]; return update(values); }; return builder;
        });
        expect(await savePricingExperienceAction(id, expected, ["old"])).toMatchObject({ success: false, uncertain: true }); expect(db.tables.projects[0].selected_case_study_ids).toEqual(["1"]);
    });
    it("retains uncertainty if profile content changes during the acknowledged update", async () => {
        const source = await read(), from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = from(table), update = builder.update;
            builder.update = values => { older[0].projectName = "Changed title"; return update(values); }; return builder;
        });
        expect(await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected: [] }, ["old"])).toMatchObject({ success: false, uncertain: true });
        expect(db.tables.projects[0].selected_case_study_ids).toEqual(["old"]);
    });
    it("reuses only approved owned library copies without exposing hidden client/value,with unchanged gate", async () => {
        mocks.enabled = true;
        mocks.library.mockResolvedValue({ userId, available: true, unapproved: 2, legacyIndexById: {}, rows: [{
            id: libId, user_id: userId, approved: approvedValue({ ...newDraft("Approved loft"), delivered: "Converted loft", client_text: "Hidden client", value_text: "Hidden value" }, ["Carpentry"]), approved_revision: 3, archived_at: null,
        }] });
        const source = await read(); expect(source.options.some(option => option.tick === tick)).toBe(true);
        expect(JSON.stringify(source)).not.toContain("Hidden client"); expect(JSON.stringify(source)).not.toContain("Hidden value");
        expect((await savePricingExperienceAction(id, { catalogKey: source.catalogKey, selected: [] }, [tick])).success).toBe(true);
        expect(mocks.enabled).toBe(true);
    });
    it("does not normalize malformed stored selections or unreadable profiles into an empty catalog", async () => {
        db.tables.projects[0].selected_case_study_ids = [42]; expect(await read()).toBeNull();
        db.tables.projects[0].selected_case_study_ids = []; db.tables.profiles[0].case_studies = "malformed"; expect(await read()).toBeNull();
    });
});
