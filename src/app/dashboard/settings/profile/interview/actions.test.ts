import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    createAdminClient: vi.fn(),
    saveAnswer: vi.fn(),
    buildDraft: vi.fn(),
    approve: vi.fn(),
    revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/company-interview/service", () => ({ saveAnswer: mocks.saveAnswer, buildDraft: mocks.buildDraft, approve: mocks.approve, INTERVIEW_SAVE_ERROR: "save-error" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { approveInterviewAction, buildInterviewDraftAction, saveInterviewAnswerAction } from "./actions";

const supabase = { from: vi.fn() };
const admin = { rpc: vi.fn() };
const ANSWER = { key: "work", answer: "Roofing", skipped: false, expectedRevision: 0 };
const APPROVE = { draftId: "00000000-0000-4000-8000-000000000001", target: "introduction", text: "x", expectedExisting: null };

describe("interview actions", () => {
    beforeEach(() => {
        Object.values(mocks).forEach((mock) => mock.mockReset());
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.requireAuth.mockResolvedValue({ user: { id: "user-1" }, supabase });
        mocks.createAdminClient.mockReturnValue(admin);
    });

    it("refuse a signed-out caller before any work, and never create the privileged client for them", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        for (const result of [await saveInterviewAnswerAction(ANSWER), await buildInterviewDraftAction(), await approveInterviewAction(APPROVE)]) {
            expect(result).toEqual({ ok: false, error: "save-error" });
        }
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(mocks.saveAnswer).not.toHaveBeenCalled();
        expect(mocks.buildDraft).not.toHaveBeenCalled();
        expect(mocks.approve).not.toHaveBeenCalled();
    });

    it("act only as the signed-in contractor, whatever the request says", async () => {
        mocks.saveAnswer.mockResolvedValue({ ok: false, error: "x" });
        mocks.approve.mockResolvedValue({ ok: false, error: "x" });
        mocks.buildDraft.mockResolvedValue({ ok: false, error: "x" });
        await saveInterviewAnswerAction({ ...ANSWER, userId: "someone-else" } as never);
        await buildInterviewDraftAction();
        await approveInterviewAction({ ...APPROVE, userId: "someone-else" } as never);
        for (const mock of [mocks.saveAnswer, mocks.buildDraft, mocks.approve]) {
            expect(mock.mock.calls[0][0]).toEqual({ supabase, admin, userId: "user-1" });
        }
    });

    it("fail closed when the privileged client is not configured", async () => {
        mocks.createAdminClient.mockImplementation(() => { throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY"); });
        expect(await saveInterviewAnswerAction(ANSWER)).toEqual({ ok: false, error: "save-error" });
        expect(mocks.saveAnswer).not.toHaveBeenCalled();
    });

    it("refresh pages only after something reached the profile", async () => {
        mocks.saveAnswer.mockResolvedValue({ ok: true, revision: 1, answer: "Roofing", skipped: false });
        mocks.buildDraft.mockResolvedValue({ ok: true, state: {} });
        mocks.approve.mockResolvedValue({ ok: true, outcome: "conflict", state: {} });
        await saveInterviewAnswerAction(ANSWER);
        await buildInterviewDraftAction();
        await approveInterviewAction(APPROVE);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();

        mocks.approve.mockResolvedValue({ ok: true, outcome: "applied", state: {} });
        await approveInterviewAction(APPROVE);
        expect(mocks.revalidatePath.mock.calls.map((call) => call[0])).toEqual([
            "/dashboard/settings/profile/interview", "/dashboard/settings/profile", "/dashboard/settings/profile/readiness",
        ]);
    });
});
