import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";
import { draftFromProject } from "@/lib/proposal-review";

const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { savePricingOpeningAction } from "./actions";
const id = "22222222-2222-4222-8222-222222222222", userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
    db = fakeSupabase({ projects: [{ id, user_id: userId, proposal_introduction: null, scope_text: "Keep scope", exclusions_text: "Keep exclusions", closing_statement: "Keep closing", payment_schedule: [{ stage: "Keep payment", percentage: 40 }], tc_overrides: [{ body: "Keep terms" }] }] });
    access.mockReset().mockResolvedValue({ supabase: db.client, user: { id: userId } });
});
describe("explicit pricing opening-message save", () => {
    it("writes only the introduction under owner and expected-value guards", async () => {
        const before = { ...db.tables.projects[0] };
        expect(await savePricingOpeningAction(id, null, "  Reviewed opening\nSecond paragraph  ")).toEqual({ success: true, introduction: "Reviewed opening\nSecond paragraph" });
        expect(db.updates).toEqual([{ table: "projects", values: { proposal_introduction: "Reviewed opening\nSecond paragraph" }, filters: { id, user_id: userId, proposal_introduction: null } }]);
        expect(db.tables.projects[0]).toEqual({ ...before, proposal_introduction: "Reviewed opening\nSecond paragraph" });
    });
    it("carries acknowledged wording into reopened review,snapshot and document without publication", async () => {
        await savePricingOpeningAction(id, null, "Our reviewed opening.");
        const input = minimalInput(), project = { ...input.project, ...db.tables.projects[0] };
        expect(draftFromProject(project, () => "unused").introduction).toBe("Our reviewed opening.");
        const snapshot = buildProposalPublicationSnapshot({ ...input, project });
        expect(snapshot.content.introduction).toBe("Our reviewed opening.");
        expect(JSON.stringify(buildProposalDocument(snapshot))).toContain("Our reviewed opening.");
    });
    it.each([null, "", "Saved message"])("preserves exact legacy expected source %s and explicit blank-to-null clearing", async expected => {
        db.tables.projects[0].proposal_introduction = expected;
        expect(await savePricingOpeningAction(id, expected, " \n ")).toEqual({ success: true, introduction: null });
        expect(db.updates[0].filters.proposal_introduction).toBe(expected);
    });
    it("retains the existing introduction limit without truncation", async () => {
        expect((await savePricingOpeningAction(id, null, "x".repeat(20000))).success).toBe(true);
        access.mockClear(); db.updates.length = 0;
        expect((await savePricingOpeningAction(id, null, "x".repeat(20001))).success).toBe(false);
        expect(access).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
    });
    it("refuses stale wording before writing", async () => {
        db.tables.projects[0].proposal_introduction = "Another editor's message";
        expect(await savePricingOpeningAction(id, null, "My draft")).toMatchObject({ success: false, error: expect.stringContaining("changed") });
        expect(db.updates).toEqual([]);
    });
    it("refuses lock,wrong owner and unreadable source", async () => {
        access.mockRejectedValueOnce(Error("This proposal has been accepted. Record later scope or price changes as variations."));
        expect(await savePricingOpeningAction(id, null, "Draft")).toMatchObject({ success: false, error: expect.stringContaining("accepted") });
        expect(db.log).toEqual([]); db.tables.projects[0].user_id = "other";
        expect((await savePricingOpeningAction(id, null, "Draft")).success).toBe(false);
        db.tables.projects[0].user_id = userId; db.fail("projects", "select");
        expect((await savePricingOpeningAction(id, null, "Draft")).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("does not confirm database rejection or a concurrent edit at update time", async () => {
        db.fail("projects", "update"); expect(await savePricingOpeningAction(id, null, "Draft")).toMatchObject({ success: false, uncertain: true });
        const from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = from(table), update = builder.update;
            builder.update = values => { db.tables.projects[0].proposal_introduction = "Concurrent"; return update(values); };
            return builder;
        });
        expect(await savePricingOpeningAction(id, null, "Draft")).toMatchObject({ success: false, uncertain: true });
        expect(db.tables.projects[0].proposal_introduction).toBe("Concurrent");
    });
});
