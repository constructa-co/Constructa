import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    sendWelcomeEmail: vi.fn(),
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: mocks.sendWelcomeEmail }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { saveSetupStepAction } from "./actions";
import { SETUP_SAVE_FALLBACK_ERROR } from "@/lib/first-session";

type Row = Record<string, unknown>;

/** A profile row and a project count behind the few query shapes the action uses. */
function fakeSupabase(options: { profile: Row; projectCount?: number | null; failUpdates?: boolean }) {
    const profile = options.profile;
    const updates: Row[] = [];

    const from = (table: string) => {
        if (table === "projects") {
            return {
                select: () => ({
                    eq: async () => ({ count: options.projectCount ?? 0, error: null }),
                }),
            };
        }
        return {
            update: (patch: Row) => {
                let onlyIfUnnamed = false;
                const builder = {
                    eq: () => builder,
                    is: () => { onlyIfUnnamed = true; return builder; },
                    select: async () => {
                        if (options.failUpdates) return { data: null, error: { code: "08006", message: "connection lost" } };
                        if (onlyIfUnnamed && profile.company_name) return { data: [], error: null };
                        Object.assign(profile, patch);
                        updates.push(patch);
                        return { data: [{ id: "user-1" }], error: null };
                    },
                };
                return builder;
            },
        };
    };

    return { supabase: { from }, profile, updates };
}

function signIn(db: ReturnType<typeof fakeSupabase>, email: string | undefined = "contractor@example.test") {
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1", email }, supabase: db.supabase });
}

const EXISTING_OPTIONAL = {
    logo_url: "https://example.test/logo.png",
    capability_statement: "Saved statement",
    default_tc_overrides: [{ clause_number: 1 }],
};

describe("saveSetupStepAction", () => {
    beforeEach(() => {
        mocks.requireAuth.mockReset();
        mocks.redirect.mockClear();
        mocks.sendWelcomeEmail.mockReset();
        mocks.sendWelcomeEmail.mockResolvedValue(undefined);
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("saves the trade on its own and stays in setup", async () => {
        const db = fakeSupabase({ profile: { company_name: null, ...EXISTING_OPTIONAL } });
        signIn(db);

        expect(await saveSetupStepAction({ step: "trade", businessType: "Plumbing & Heating" })).toEqual({ ok: true });

        expect(db.updates).toEqual([{ business_type: "Plumbing & Heating" }]);
        expect(db.profile).toMatchObject({ company_name: null, ...EXISTING_OPTIONAL });
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("saves a free-text description of the work exactly as written", async () => {
        const db = fakeSupabase({ profile: { company_name: null } });
        signIn(db);

        expect(await saveSetupStepAction({ step: "trade", businessType: "  Dry stone walling and\nlime pointing " })).toEqual({ ok: true });
        expect(db.updates).toEqual([{ business_type: "Dry stone walling and lime pointing" }]);
    });

    it("lets a contractor who is already set up change the work answer without a second welcome", async () => {
        const db = fakeSupabase({ profile: { company_name: "Smith Brickwork", business_type: "Bricklaying" }, projectCount: 2 });
        signIn(db);

        expect(await saveSetupStepAction({ step: "trade", businessType: "Bricklaying, Stonework" })).toEqual({ ok: true });
        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toThrow("NEXT_REDIRECT:/dashboard");

        expect(db.profile).toEqual({ company_name: "Smith Brickwork", business_type: "Bricklaying, Stonework" });
        expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("finishes setup for a contractor with no projects by going to proposal readiness", async () => {
        const db = fakeSupabase({ profile: { company_name: null, business_type: "Bricklaying", ...EXISTING_OPTIONAL }, projectCount: 0 });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork", fullName: "Sam Smith" }))
            .rejects.toThrow("NEXT_REDIRECT:/dashboard/settings/profile/readiness");

        expect(db.updates).toEqual([{ company_name: "Smith Brickwork", full_name: "Sam Smith" }]);
        expect(db.profile).toMatchObject({ business_type: "Bricklaying", ...EXISTING_OPTIONAL });
    });

    it("sends the welcome email once, the first time a business name is saved", async () => {
        const db = fakeSupabase({ profile: { company_name: null }, projectCount: 0 });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork", fullName: "Sam Smith" })).rejects.toThrow("NEXT_REDIRECT");
        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork Ltd" })).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(mocks.sendWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({
            contractorEmail: "contractor@example.test",
            companyName: "Smith Brickwork",
            fullName: "Sam Smith",
        }));
        expect(db.profile.company_name).toBe("Smith Brickwork Ltd");
    });

    it("keeps the normal landing page for a contractor who already has projects", async () => {
        const db = fakeSupabase({ profile: { company_name: "Smith Brickwork" }, projectCount: 3 });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" }))
            .rejects.toThrow("NEXT_REDIRECT:/dashboard");
        expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
        expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("does not blank a saved name when the name is left empty", async () => {
        const db = fakeSupabase({ profile: { company_name: "Old Name", full_name: "Sam Smith" }, projectCount: 1 });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "New Name", fullName: "" })).rejects.toThrow("NEXT_REDIRECT");
        expect(db.profile).toEqual({ company_name: "New Name", full_name: "Sam Smith" });
    });

    it("returns a retryable error and does not redirect or email when the save fails", async () => {
        const db = fakeSupabase({ profile: { company_name: null }, failUpdates: true });
        signIn(db);

        expect(await saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).toEqual({ error: SETUP_SAVE_FALLBACK_ERROR });
        expect(await saveSetupStepAction({ step: "trade", businessType: "Roofing" })).toEqual({ error: SETUP_SAVE_FALLBACK_ERROR });
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
        expect(db.profile.company_name).toBeNull();
    });

    it("succeeds on retry after a failed save", async () => {
        const db = fakeSupabase({ profile: { company_name: null }, failUpdates: true });
        signIn(db);
        expect(await saveSetupStepAction({ step: "trade", businessType: "Roofing" })).toEqual({ error: SETUP_SAVE_FALLBACK_ERROR });

        const recovered = fakeSupabase({ profile: db.profile });
        signIn(recovered);
        expect(await saveSetupStepAction({ step: "trade", businessType: "Roofing" })).toEqual({ ok: true });
        expect(recovered.profile.business_type).toBe("Roofing");
    });

    it("rejects an empty answer before touching the database", async () => {
        expect(await saveSetupStepAction({ step: "business", companyName: "  " })).toEqual({
            error: "Enter your business or trading name.",
        });
        expect(mocks.requireAuth).not.toHaveBeenCalled();
    });

    it("returns a retryable error when the session check throws", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        expect(await saveSetupStepAction({ step: "trade", businessType: "Roofing" })).toEqual({ error: SETUP_SAVE_FALLBACK_ERROR });
    });

    it("still finishes setup when the welcome email fails", async () => {
        mocks.sendWelcomeEmail.mockRejectedValue(new Error("mail down"));
        const db = fakeSupabase({ profile: { company_name: null }, projectCount: 0 });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" }))
            .rejects.toThrow("NEXT_REDIRECT:/dashboard/settings/profile/readiness");
    });
});
