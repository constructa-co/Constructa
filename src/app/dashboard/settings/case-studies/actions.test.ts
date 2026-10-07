import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    createAdminClient: vi.fn(),
    generateStructured: vi.fn(),
    order: [] as string[],
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
// The real budget wrapper runs. Only the provider call itself is replaced, with canned replies; no real API is ever reached.
vi.mock("@/lib/ai", async (original) => ({ ...(await original<typeof import("@/lib/ai")>()), generateStructured: mocks.generateStructured }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { fakeAiBudget } from "@/lib/__fixtures__/fake-ai-budget";
import { CASE_STUDY_ADDED, CASE_STUDY_TOO_LONG, CASE_STUDY_TOO_SHORT } from "@/lib/cohort-ai/case-study-enhance";
import { COHORT_AI_OFF, COHORT_AI_UNAVAILABLE } from "@/lib/cohort-ai/shared";
import { enhanceCaseStudyAction } from "./actions";

const DELIVERED = "We refitted the kitchen, moved the wall and replastered throughout.";
const VALUE = "The family could stay in the house throughout the work.";
const BETTER_DELIVERED = "We refitted the kitchen, moved the wall and replastered throughout the house.";
const BETTER_VALUE = "The family stayed in the house throughout the work.";

let budget: ReturnType<typeof fakeAiBudget>;
const canned = (data: unknown) => mocks.generateStructured.mockImplementation(async () => { mocks.order.push("provider"); return { data, model: "canned", usage: { promptTokens: 70, completionTokens: 35 } }; });
function arrange(options: { cohortEnabled?: boolean } = { cohortEnabled: true }) {
    budget = fakeAiBudget(options);
    mocks.createAdminClient.mockImplementation(() => {
        mocks.order.push("admin");
        return { rpc: async (name: string, args: Record<string, unknown>) => { mocks.order.push(name.replace("ai_generation_", "")); return budget.admin.rpc(name, args); } };
    });
}

describe("enhanceCaseStudyAction", () => {
    beforeEach(() => {
        mocks.order.length = 0;
        mocks.requireAuth.mockReset();
        mocks.createAdminClient.mockReset();
        mocks.generateStructured.mockReset();
        mocks.requireAuth.mockImplementation(async () => { mocks.order.push("auth"); return { user: { id: "user-1" } }; });
        arrange();
        canned({ whatWeDelivered: BETTER_DELIVERED, valueAdded: BETTER_VALUE });
        vi.unstubAllEnvs();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("a signed-out caller reaches no provider, budget or privileged client, even with long fields", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        const longText = "x".repeat(10_000);
        const result = await enhanceCaseStudyAction(longText, longText, "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: longText, valueAdded: longText, suggested: false, message: COHORT_AI_UNAVAILABLE });
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
        expect(mocks.order).toEqual([]);
    });

    it("a signed-out caller reaches nothing even when no call would be made anyway", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        const result = await enhanceCaseStudyAction("short", "tiny", "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: "short", valueAdded: "tiny", suggested: false, message: COHORT_AI_UNAVAILABLE });
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("checks who is asking, then reserves, then makes ONE call for both sections, then records", async () => {
        const result = await enhanceCaseStudyAction(DELIVERED, VALUE, "Project", "Extension");
        expect(mocks.order).toEqual(["auth", "admin", "reserve", "provider", "finish"]);
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ whatWeDelivered: BETTER_DELIVERED, valueAdded: BETTER_VALUE, suggested: true, sections: ["whatWeDelivered", "valueAdded"] });
        expect(budget.attempts).toHaveLength(1);
        expect(budget.attempts[0]).toMatchObject({ user_id: "user-1", feature: "case-studies.enhance", outcome: "ok", reserved_output_tokens: 1000, completion_tokens: 35, prompt_version: "case-study-enhance-v1" });
    });

    it("makes no call for short fields, but still requires authentication first, and says why nothing changed", async () => {
        const result = await enhanceCaseStudyAction("short", "tiny", "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: "short", valueAdded: "tiny", suggested: false, message: CASE_STUDY_TOO_SHORT });
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
        expect(mocks.order[0]).toBe("auth");
    });

    it("sends only the section that is long enough, and never rewrites the other", async () => {
        canned({ whatWeDelivered: BETTER_DELIVERED, valueAdded: "Something nobody asked for." });
        const result = await enhanceCaseStudyAction(DELIVERED, "tiny", "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: BETTER_DELIVERED, valueAdded: "tiny", suggested: true, sections: ["whatWeDelivered"] });
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        const request = mocks.generateStructured.mock.calls[0][0] as { system: string; user: string };
        expect(JSON.parse(request.user)).toEqual({ projectName: "Project", projectType: "Extension", whatWeDelivered: DELIVERED });
        expect(request.system).not.toContain("kitchen");
    });

    it("a section too long to send is refused honestly, before the budget", async () => {
        const result = await enhanceCaseStudyAction("d".repeat(2001), VALUE, "Project", "Extension");
        expect(result).toMatchObject({ suggested: false, message: CASE_STUDY_TOO_LONG, valueAdded: VALUE });
        expect(result.whatWeDelivered).toHaveLength(2001);
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.rpcCalls).toEqual([]);
    });

    it("a reply that adds a claim to either section returns both originals and is still charged", async () => {
        canned({ whatWeDelivered: BETTER_DELIVERED, valueAdded: "The family stayed in the house and saved £4,000." });
        const result = await enhanceCaseStudyAction(DELIVERED, VALUE, "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: DELIVERED, valueAdded: VALUE, suggested: false, message: CASE_STUDY_ADDED });
        expect(budget.attempts[0]).toMatchObject({ outcome: "rejected:tripwire", completion_tokens: 35 });
    });

    it("as seeded, the feature is off: both originals back, no call, and it says so", async () => {
        arrange({});
        const result = await enhanceCaseStudyAction(DELIVERED, VALUE, "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: DELIVERED, valueAdded: VALUE, suggested: false, message: COHORT_AI_OFF });
        expect(mocks.generateStructured).not.toHaveBeenCalled();
        expect(budget.attempts).toEqual([]);
    });

    it("a provider failure is not retried and never looks like success", async () => {
        mocks.generateStructured.mockRejectedValue(new Error("timeout"));
        const result = await enhanceCaseStudyAction(DELIVERED, VALUE, "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: DELIVERED, valueAdded: VALUE, suggested: false, message: COHORT_AI_UNAVAILABLE });
        expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
        expect(budget.charged()).toEqual([1000]);
    });
});
