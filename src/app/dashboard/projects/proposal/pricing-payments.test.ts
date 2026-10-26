import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";

const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { savePricingPaymentStagesAction, saveProposalDraftAction } from "./actions";
import { buildProposalPayload, draftFromProject } from "@/lib/proposal-review";

const id = "22222222-2222-4222-8222-222222222222", userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stages = [{ id: "stage-1", stage: "First agreed stage", description: "At the agreed milestone", percentage: 40 }];
let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
    db = fakeSupabase({ projects: [{ id, user_id: userId, payment_schedule: null, scope_text: "Keep scope", tc_overrides: [{ body: "Keep terms" }], programme_phases: [{ name: "Keep programme" }] }] });
    access.mockReset().mockResolvedValue({ supabase: db.client, user: { id: userId } });
});

describe("payment-only save from pricing", () => {
    it("does not let an older proposal draft overwrite stages just saved while pricing", async () => {
        const built = buildProposalPayload(draftFromProject({ id, name: "Job", payment_schedule: null }, () => "draft-stage"));
        if (!built.ok) throw Error("Invalid fixture");
        const before = { ...db.tables.projects[0] };
        expect((await savePricingPaymentStagesAction(id, null, stages)).success).toBe(true);
        const result = await saveProposalDraftAction(id, { ...built.payload, scope: "Stale proposal scope" }, null);
        expect(result).toMatchObject({ success: false, error: expect.stringMatching(/changed elsewhere/) });
        expect(db.tables.projects[0]).toEqual({ ...before, payment_schedule: stages });
        expect(db.updates).toHaveLength(1);
    });
    it("confirms guarded proposal payment edits and leaves the earlier pricing editor's stale source protected", async () => {
        db.tables.projects[0].payment_schedule = stages;
        const built = buildProposalPayload(draftFromProject({ id, name: "Job", payment_schedule: stages }, () => "draft-stage"));
        if (!built.ok) throw Error("Invalid fixture");
        const next = [{ ...stages[0], percentage: 55 }];
        expect(await saveProposalDraftAction(id, { ...built.payload, paymentSchedule: next }, stages)).toEqual({ success: true });
        expect(db.updates[0].filters).toEqual({ id, user_id: userId, payment_schedule: JSON.stringify(stages) });
        expect(db.tables.projects[0].payment_schedule).toEqual(next);
        expect(await savePricingPaymentStagesAction(id, stages, [])).toMatchObject({ success: false });
        expect(db.tables.projects[0].payment_schedule).toEqual(next);
    });
    it("does not check or replace fixed-amount stages for a proposal save that omits payments", async () => {
        const fixed = [{ stage: "Existing", amount: 250 }];
        db.tables.projects[0].payment_schedule = fixed;
        const built = buildProposalPayload(draftFromProject({ id, name: "Job", payment_schedule: fixed }, () => "draft-stage"));
        if (!built.ok) throw Error("Invalid fixture");
        expect(await saveProposalDraftAction(id, built.payload, fixed)).toEqual({ success: true });
        expect(db.updates[0].values).not.toHaveProperty("payment_schedule");
        expect(db.tables.projects[0].payment_schedule).toEqual(fixed);
    });
    it("keeps the pricing schedule and all proposal fields when payment stages race the guarded proposal write", async () => {
        const built = buildProposalPayload(draftFromProject({ id, name: "Job", payment_schedule: null }, () => "draft-stage"));
        if (!built.ok) throw Error("Invalid fixture");
        const before = { ...db.tables.projects[0] }, original = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = original(table), update = builder.update;
            builder.update = values => { db.tables.projects[0].payment_schedule = stages; return update(values); };
            return builder;
        });
        expect(await saveProposalDraftAction(id, { ...built.payload, scope: "Stale proposal scope" }, null)).toMatchObject({ success: false });
        expect(db.tables.projects[0]).toEqual({ ...before, payment_schedule: stages });
        expect(db.updates[0].filters.payment_schedule).toBeNull();
    });
    it("saves only the contractor's stages, with owner and null-source guards and returned data", async () => {
        const before = { ...db.tables.projects[0] };
        expect(await savePricingPaymentStagesAction(id, null, stages)).toEqual({ success: true, paymentSchedule: stages });
        expect(db.updates).toEqual([{ table: "projects", values: { payment_schedule: stages }, filters: { id, user_id: userId, payment_schedule: null } }]);
        expect(db.tables.projects[0]).toEqual({ ...before, payment_schedule: stages });
    });
    it("reopens the exact saved stages and uses the existing JSON compare-and-set for later edits", async () => {
        db.tables.projects[0].payment_schedule = stages;
        const next = [{ ...stages[0], percentage: 55 }];
        expect(await savePricingPaymentStagesAction(id, stages, next)).toEqual({ success: true, paymentSchedule: next });
        expect(db.updates[0].filters.payment_schedule).toBe(JSON.stringify(stages));
    });
    it("allows an explicit empty draft save but never invents a stage or a 100% requirement", async () => {
        expect(await savePricingPaymentStagesAction(id, null, [])).toEqual({ success: true, paymentSchedule: [] });
        db.tables.projects[0].payment_schedule = null;
        expect((await savePricingPaymentStagesAction(id, null, stages)).success).toBe(true);
    });
    it.each([[], [{ ...stages[0], percentage: 1 }]].map(rows => ({ rows })))("preserves the existing draft readiness policy for $rows", async ({ rows }) => {
        expect((await savePricingPaymentStagesAction(id, null, rows)).success).toBe(true);
    });
    it.each([
        [{ ...stages[0], percentage: 0 }], [{ ...stages[0], percentage: 101 }], [{ ...stages[0], stage: " " }],
        [{ ...stages[0], description: "x".repeat(1001) }], Array.from({ length: 13 }, (_, n) => ({ ...stages[0], id: String(n) })),
        [{ ...stages[0], percentage: 60 }, { ...stages[0], id: "s2", percentage: 50 }],
    ].map(rows => ({ rows })))("refuses invalid stage payload before access or write: $rows", async ({ rows }) => {
        expect((await savePricingPaymentStagesAction(id, null, rows)).success).toBe(false);
        expect(access).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
    });
    it("refuses another owner and pre-contract edit-lock rejection", async () => {
        access.mockRejectedValueOnce(Error("No edit access"));
        expect((await savePricingPaymentStagesAction(id, null, stages)).success).toBe(false); expect(db.log).toEqual([]);
        db.tables.projects[0].user_id = "another-owner";
        expect((await savePricingPaymentStagesAction(id, null, stages)).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("does not overwrite a schedule changed in another editor", async () => {
        db.tables.projects[0].payment_schedule = [{ ...stages[0], percentage: 80 }];
        expect(await savePricingPaymentStagesAction(id, null, stages)).toMatchObject({ success: false, error: expect.stringMatching(/changed/) });
        expect(db.updates).toEqual([]);
    });
    it("preserves legacy fixed-amount stages instead of converting them", async () => {
        const fixed = [{ stage: "Existing", amount: 250 }]; db.tables.projects[0].payment_schedule = fixed;
        expect((await savePricingPaymentStagesAction(id, fixed, stages)).success).toBe(false);
        expect(db.tables.projects[0].payment_schedule).toEqual(fixed); expect(db.updates).toEqual([]);
    });
    it("refuses a read error without a write", async () => {
        db.fail("projects", "select"); expect((await savePricingPaymentStagesAction(id, null, stages)).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("does not report a successful save on database rejection", async () => {
        db.fail("projects", "update");
        expect(await savePricingPaymentStagesAction(id, null, stages)).toMatchObject({ success: false, uncertain: true });
    });
    it("requires an affected row even when a concurrent change wins after the read", async () => {
        const original = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = original(table), update = builder.update;
            builder.update = values => { db.tables.projects[0].payment_schedule = stages; return update(values); };
            return builder;
        });
        expect(await savePricingPaymentStagesAction(id, null, stages)).toMatchObject({ success: false, uncertain: true });
    });
});
