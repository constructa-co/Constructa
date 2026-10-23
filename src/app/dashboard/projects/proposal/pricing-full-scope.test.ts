import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";
import { draftFromProject } from "@/lib/proposal-review";
import { pricingFullScopeDraft } from "@/lib/pricing-full-scope";

const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { savePricingFullScopeAction } from "./actions";
const id = "22222222-2222-4222-8222-222222222222", userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: ReturnType<typeof fakeSupabase>;
const source = (scope_text: string | null = null, brief_scope: string | null = "Brief work") => ({ scope_text, brief_scope });
beforeEach(() => {
    db = fakeSupabase({ projects: [{ id, user_id: userId, ...source(), proposal_introduction: "Keep opening", exclusions_text: "Keep exclusions", closing_statement: "Keep closing", payment_schedule: [{ stage: "Keep payment", percentage: 40 }], tc_overrides: [{ body: "Keep terms" }] }] });
    access.mockReset().mockResolvedValue({ supabase: db.client, user: { id: userId } });
});
describe("explicit pricing full scope save", () => {
    it("writes only scope_text under owner and both exact expected-source guards", async () => {
        const before = { ...db.tables.projects[0] };
        expect(await savePricingFullScopeAction(id, source(), "  Reviewed scope\nSecond paragraph  ")).toEqual({ success: true, source: source("Reviewed scope\nSecond paragraph") });
        expect(db.updates).toEqual([{ table: "projects", values: { scope_text: "Reviewed scope\nSecond paragraph" }, filters: { id, user_id: userId, ...source() } }]);
        expect(db.tables.projects[0]).toEqual({ ...before, scope_text: "Reviewed scope\nSecond paragraph" });
    });
    it("carries acknowledged scope into reopened review,snapshot and document without publication", async () => {
        await savePricingFullScopeAction(id, source(), "Our reviewed full scope.");
        const input = minimalInput(), project = { ...input.project, ...db.tables.projects[0] };
        expect(draftFromProject(project, () => "unused").scope).toBe("Our reviewed full scope.");
        const snapshot = buildProposalPublicationSnapshot({ ...input, project });
        expect(snapshot.content.scope).toBe("Our reviewed full scope.");
        expect(JSON.stringify(buildProposalDocument(snapshot))).toContain("Our reviewed full scope.");
    });
    it("uses only brief work as fallback and preserves saved override/qualifiers verbatim", () => {
        const brief = "Paint walls\n\nSite, access and assumptions:\nAccess by agreement";
        expect(pricingFullScopeDraft(source(null, brief))).toBe("Paint walls");
        expect(pricingFullScopeDraft(source(" Saved override ", brief))).toBe(" Saved override ");
        expect(pricingFullScopeDraft(source(" \n ", brief))).toBe("Paint walls");
    });
    it.each([null, "", "Saved scope"])("refuses a false clear with brief work for legacy source %s", async expected => {
        db.tables.projects[0].scope_text = expected;
        expect(await savePricingFullScopeAction(id, source(expected), " \n ")).toMatchObject({ success: false, error: expect.stringContaining("would reappear") });
        expect(db.updates).toEqual([]);
    });
    it.each([null, "", "Site, access and assumptions:\nAccess only"])("retains explicit blank-to-null without fallback work %s", async brief => {
        db.tables.projects[0].brief_scope = brief;
        expect(await savePricingFullScopeAction(id, source(null, brief), " ")).toEqual({ success: true, source: source(null, brief) });
        expect(db.updates[0].filters.brief_scope).toBe(brief);
    });
    it("enforces existing 20k limit without truncation", async () => {
        expect((await savePricingFullScopeAction(id, source(), "x".repeat(20000))).success).toBe(true);
        access.mockClear(); db.updates.length = 0;
        expect((await savePricingFullScopeAction(id, source(), "x".repeat(20001))).success).toBe(false);
        expect(access).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
    });
    it.each(["scope_text", "brief_scope"])("refuses changed %s even with a saved override", async field => {
        db.tables.projects[0].scope_text = "Override"; db.tables.projects[0][field] = "External";
        expect(await savePricingFullScopeAction(id, source("Override"), "My draft")).toMatchObject({ success: false, error: expect.stringContaining("changed") });
        expect(db.updates).toEqual([]);
    });
    it("refuses invalid source shape,locks,wrong owner and unreadable source", async () => {
        expect((await savePricingFullScopeAction(id, { ...source(), extra: "bad" } as ReturnType<typeof source>, "Draft")).success).toBe(false);
        access.mockRejectedValueOnce(Error("This proposal has been accepted. Record later scope or price changes as variations."));
        expect(await savePricingFullScopeAction(id, source(), "Draft")).toMatchObject({ success: false, error: expect.stringContaining("accepted") });
        expect(db.log).toEqual([]); db.tables.projects[0].user_id = "other";
        expect((await savePricingFullScopeAction(id, source(), "Draft")).success).toBe(false);
        db.tables.projects[0].user_id = userId; db.fail("projects", "select");
        expect((await savePricingFullScopeAction(id, source(), "Draft")).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("does not confirm a database update rejection", async () => {
        db.fail("projects", "update");
        expect(await savePricingFullScopeAction(id, source(), "Draft")).toMatchObject({ success: false, uncertain: true });
    });
    it.each(["scope_text", "brief_scope"])("CAS prevents concurrent %s update without overwriting it", async field => {
        const from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = from(table), update = builder.update;
            builder.update = values => { db.tables.projects[0][field] = "Concurrent"; return update(values); };
            return builder;
        });
        expect(await savePricingFullScopeAction(id, source(), "Draft")).toMatchObject({ success: false, uncertain: true });
        expect(db.tables.projects[0][field]).toBe("Concurrent");
        if (field === "brief_scope") expect(db.tables.projects[0].scope_text).toBeNull();
    });
});
