import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    generateText: vi.fn(),
    order: [] as string[],
}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
// The provider is replaced with canned replies; no real API is ever reached.
vi.mock("@/lib/ai", async (original) => ({ ...(await original<typeof import("@/lib/ai")>()), generateText: mocks.generateText }));

import { enhanceCaseStudyAction } from "./actions";

const DELIVERED = "We refitted the kitchen, moved the wall and replastered throughout.";
const VALUE = "The family could stay in the house throughout the work.";

describe("enhanceCaseStudyAction authentication", () => {
    beforeEach(() => {
        mocks.order.length = 0;
        mocks.requireAuth.mockReset();
        mocks.generateText.mockReset();
        mocks.requireAuth.mockImplementation(async () => { mocks.order.push("auth"); return { user: { id: "user-1" } }; });
        mocks.generateText.mockImplementation(async (prompt: string) => {
            mocks.order.push("provider");
            return prompt.includes("Value Added") ? "Enhanced value added." : "Enhanced delivered.";
        });
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("a signed-out caller reaches no provider, even with long fields", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        const longText = "x".repeat(10_000);
        const result = await enhanceCaseStudyAction(longText, longText, "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: longText, valueAdded: longText });
        expect(mocks.generateText).not.toHaveBeenCalled();
        expect(mocks.order).toEqual([]);
    });

    it("a signed-out caller reaches no provider even when no call would be made anyway", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        const result = await enhanceCaseStudyAction("short", "tiny", "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: "short", valueAdded: "tiny" });
        expect(mocks.generateText).not.toHaveBeenCalled();
    });

    it("checks authentication before anything touches the provider", async () => {
        await enhanceCaseStudyAction(DELIVERED, VALUE, "Project", "Extension");
        expect(mocks.order[0]).toBe("auth");
        expect(mocks.order.filter((entry) => entry === "provider")).toHaveLength(2);
    });

    it("returns both canned replies for two long fields, with two calls", async () => {
        const result = await enhanceCaseStudyAction(DELIVERED, VALUE, "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: "Enhanced delivered.", valueAdded: "Enhanced value added." });
        expect(mocks.generateText).toHaveBeenCalledTimes(2);
    });

    it("makes no provider call for short fields, but still requires authentication", async () => {
        const result = await enhanceCaseStudyAction("short", "tiny", "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: "short", valueAdded: "tiny" });
        expect(mocks.generateText).not.toHaveBeenCalled();
        expect(mocks.order).toEqual(["auth"]);
    });

    it("makes exactly one provider call when only one field is long enough", async () => {
        const result = await enhanceCaseStudyAction(DELIVERED, "tiny", "Project", "Extension");
        expect(result).toEqual({ whatWeDelivered: "Enhanced delivered.", valueAdded: "tiny" });
        expect(mocks.generateText).toHaveBeenCalledTimes(1);
        expect(mocks.generateText.mock.calls[0][0]).toContain("What We Delivered");
    });
});
