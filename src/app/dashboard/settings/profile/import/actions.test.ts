import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
    revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/company-import/service", () => ({ previewImport: mocks.previewImport, applyImport: mocks.applyImport }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { IMPORT_GENERIC_ERROR, IMPORT_SAVE_ERROR } from "@/lib/company-import/draft";
import { applyWebsiteImportAction, previewWebsiteImportAction } from "./actions";

const supabase = { from: vi.fn() };
const APPLY = { draftId: "00000000-0000-4000-8000-000000000001", approvals: [{ field: "phone", expectedExisting: null }] };

describe("website import actions", () => {
    beforeEach(() => {
        Object.values(mocks).forEach((mock) => mock.mockReset());
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.requireAuth.mockResolvedValue({ user: { id: "user-1", email: "c@example.test" }, supabase });
    });

    it("refuse a signed-out caller before any import work", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        expect(await previewWebsiteImportAction({ url: "www.smithbuilders.co.uk", permissionConfirmed: true })).toEqual({ ok: false, error: IMPORT_GENERIC_ERROR });
        expect(await applyWebsiteImportAction(APPLY)).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        expect(mocks.previewImport).not.toHaveBeenCalled();
        expect(mocks.applyImport).not.toHaveBeenCalled();
    });

    it("act only as the signed-in contractor, whatever the request says", async () => {
        mocks.previewImport.mockResolvedValue({ ok: false, error: "x" });
        mocks.applyImport.mockResolvedValue({ ok: false, error: "x" });
        await previewWebsiteImportAction({ url: "www.smithbuilders.co.uk", permissionConfirmed: true, userId: "someone-else" } as never);
        await applyWebsiteImportAction({ ...APPLY, userId: "someone-else" } as never);
        expect(mocks.previewImport.mock.calls[0][0]).toEqual({ supabase, userId: "user-1" });
        expect(mocks.applyImport.mock.calls[0][0]).toEqual({ supabase, userId: "user-1" });
    });

    it("never refresh a page for a preview, and refresh only after something was saved", async () => {
        mocks.previewImport.mockResolvedValue({ ok: true, draft: {} });
        await previewWebsiteImportAction({ url: "www.smithbuilders.co.uk", permissionConfirmed: true });
        mocks.applyImport.mockResolvedValue({ ok: true, draft: {}, outcomes: [{ field: "phone", outcome: "conflict", current: "x" }] });
        await applyWebsiteImportAction(APPLY);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();

        mocks.applyImport.mockResolvedValue({ ok: true, draft: {}, outcomes: [{ field: "phone", outcome: "applied" }] });
        await applyWebsiteImportAction(APPLY);
        expect(mocks.revalidatePath.mock.calls.map((call) => call[0])).toEqual([
            "/dashboard/settings/profile/import", "/dashboard/settings/profile", "/dashboard/settings/profile/readiness",
        ]);
    });

    it("turn an unexpected failure into a message that can be retried", async () => {
        mocks.previewImport.mockRejectedValue(new Error("boom"));
        mocks.applyImport.mockRejectedValue(new Error("boom"));
        expect(await previewWebsiteImportAction({ url: "www.smithbuilders.co.uk", permissionConfirmed: true })).toEqual({ ok: false, error: IMPORT_GENERIC_ERROR });
        expect(await applyWebsiteImportAction(APPLY)).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
    });
});
