import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    sendWelcomeEmail: vi.fn(),
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: mocks.sendWelcomeEmail }));

import { redirect } from "next/navigation";
import { saveSetupStepAction } from "./actions";
import { SETUP_SAVE_FALLBACK_ERROR } from "@/lib/first-session";

type Row = Record<string, unknown>;
type Call = { table: string; ops: unknown[][] };

/** What the projects count settles with: a returned result, a thrown error, or a call that throws. */
type CountOutcome = { count: number | null; error: unknown } | Error | (() => never);

/**
 * One profile row plus the projects count, behind the query shapes the action
 * uses. Every chain is recorded so the own-user predicates can be checked.
 */
function fakeSupabase(options: { profile: Row; count?: CountOutcome; claimResult?: Row; writeResult?: Row }) {
    const profile = options.profile;
    const calls: Call[] = [];
    const updates: Row[] = [];

    const from = (table: string) => {
        const call: Call = { table, ops: [] };
        calls.push(call);
        if (table === "projects") {
            return {
                select: (...args: unknown[]) => {
                    call.ops.push(["select", ...args]);
                    return {
                        eq: async (...eqArgs: unknown[]) => {
                            call.ops.push(["eq", ...eqArgs]);
                            const outcome = options.count ?? { count: 0, error: null };
                            if (typeof outcome === "function") return outcome();
                            if (outcome instanceof Error) throw outcome;
                            return outcome;
                        },
                    };
                },
            };
        }
        return {
            update: (patch: Row) => {
                call.ops.push(["update", patch]);
                let onlyIfUnnamed = false;
                const builder = {
                    eq: (...args: unknown[]) => { call.ops.push(["eq", ...args]); return builder; },
                    is: (...args: unknown[]) => { call.ops.push(["is", ...args]); onlyIfUnnamed = true; return builder; },
                    select: async (...args: unknown[]) => {
                        call.ops.push(["select", ...args]);
                        if (onlyIfUnnamed && options.claimResult) return options.claimResult;
                        if (!onlyIfUnnamed && options.writeResult) return options.writeResult;
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

    return { supabase: { from }, profile, calls, updates };
}

function signIn(db: ReturnType<typeof fakeSupabase>) {
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1", email: "contractor@example.test" }, supabase: db.supabase });
}

/** The real Next redirect, as thrown by the action, for a given destination. */
const redirectedTo = (path: string) => ({ digest: expect.stringMatching(new RegExp(`^NEXT_REDIRECT;\\w+;${path.replace(/\//g, "\\/")};307;$`)) });

const READINESS = "/dashboard/settings/profile/readiness";
const LANDING = "/dashboard";
const CLAIM_OPS = [["update", { company_name: "Smith Brickwork" }], ["eq", "id", "user-1"], ["is", "company_name", null], ["select", "id"]];
const UPDATE_OPS = [["update", { company_name: "Smith Brickwork" }], ["eq", "id", "user-1"], ["select", "id"]];
const COUNT_OPS = [["select", "id", { count: "exact", head: true }], ["eq", "user_id", "user-1"]];

describe("business setup outcomes after the profile save is confirmed", () => {
    beforeEach(() => {
        mocks.requireAuth.mockReset();
        mocks.sendWelcomeEmail.mockReset();
        mocks.sendWelcomeEmail.mockResolvedValue(undefined);
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("a first company claim that is saved still finishes setup when the project count throws", async () => {
        const db = fakeSupabase({ profile: { company_name: null }, count: new Error("fetch failed") });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(READINESS));

        expect(db.calls).toEqual([
            { table: "profiles", ops: CLAIM_OPS },
            { table: "projects", ops: COUNT_OPS },
        ]);
        expect(db.updates).toEqual([{ company_name: "Smith Brickwork" }]);
        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    });

    it("an existing company's confirmed save still finishes setup on the normal landing page when the count throws", async () => {
        const db = fakeSupabase({ profile: { company_name: "Old Name" }, count: new Error("fetch failed") });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(LANDING));

        expect(db.calls).toEqual([
            { table: "profiles", ops: CLAIM_OPS },
            { table: "profiles", ops: UPDATE_OPS },
            { table: "projects", ops: COUNT_OPS },
        ]);
        expect(db.profile.company_name).toBe("Smith Brickwork");
        expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("a returned count error is not trusted as a project count", async () => {
        const returning = fakeSupabase({ profile: { company_name: "Old Name" }, count: { count: 0, error: { message: "canceling statement due to statement timeout" } } });
        signIn(returning);
        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(LANDING));

        const first = fakeSupabase({ profile: { company_name: null }, count: { count: null, error: { message: "permission denied for table projects" } } });
        signIn(first);
        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(READINESS));
        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    });

    it("a retry after a count failure does not send a second welcome email", async () => {
        const db = fakeSupabase({ profile: { company_name: null }, count: new Error("fetch failed") });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(READINESS));
        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(LANDING));

        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(db.updates).toEqual([{ company_name: "Smith Brickwork" }, { company_name: "Smith Brickwork" }]);
    });

    it("Next control flow thrown by the count is not swallowed as a save failure", async () => {
        const db = fakeSupabase({ profile: { company_name: "Old Name" }, count: () => redirect("/login") });
        signIn(db);

        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo("/login"));
    });

    it.each([
        [3, "Old Name", LANDING],
        [0, "Old Name", READINESS],
        [3, null, READINESS],
    ])("a confirmed save with %s projects routes as before (saved name %s)", async (count, companyName, destination) => {
        const db = fakeSupabase({ profile: { company_name: companyName }, count: { count, error: null } });
        signIn(db);
        await expect(saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).rejects.toMatchObject(redirectedTo(destination));
        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(companyName === null ? 1 : 0);
    });

    it.each([
        ["a claim error", { company_name: null }, { claimResult: { data: null, error: { code: "08006", message: "connection lost" } } }],
        ["a write error", { company_name: "Old Name" }, { writeResult: { data: null, error: { code: "42501", message: "permission denied" } } }],
        ["a write that changed no rows", { company_name: "Old Name" }, { writeResult: { data: [], error: null } }],
    ])("%s before the save is confirmed is still a retryable save failure with no count or email", async (_label, profile, results) => {
        const db = fakeSupabase({ profile, ...results });
        signIn(db);

        expect(await saveSetupStepAction({ step: "business", companyName: "Smith Brickwork" })).toEqual({ error: SETUP_SAVE_FALLBACK_ERROR });
        expect(db.calls.some(c => c.table === "projects")).toBe(false);
        expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("the trade step does not read the project count", async () => {
        const db = fakeSupabase({ profile: { company_name: null }, count: new Error("fetch failed") });
        signIn(db);
        expect(await saveSetupStepAction({ step: "trade", businessType: "Roofing" })).toEqual({ ok: true });
        expect(db.calls.map(c => c.table)).toEqual(["profiles"]);
    });
});
