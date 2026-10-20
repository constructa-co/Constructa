import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { markAsWonAction, updateStatusAction } from "./board-actions";

const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const project = "11111111-1111-4111-8111-111111111111";
function setup(kind: "success" | "error" | "empty" | "throw" | "wrong-id" | "wrong-status" | "wrong-acceptance" | "wrong-time" | "equivalent-time" = "success") {
    let payload: Record<string, unknown> = {};
    const filters: [string, unknown][] = [];
    const result = () => {
        if (kind === "throw") throw Error("private database detail");
        return { error: kind === "error" ? { code: "08006", message: "private database detail" } : null,
            data: ["empty", "error"].includes(kind) ? null : { id: kind === "wrong-id" ? "another-job" : project, ...payload,
                ...(kind === "wrong-status" ? { status: "other" } : {}), ...(kind === "wrong-acceptance" ? { proposal_status: "draft" } : {}),
                ...(kind === "wrong-time" ? { proposal_accepted_at: "2000-01-01T00:00:00Z" } : {}),
                ...(kind === "equivalent-time" ? { proposal_accepted_at: String(payload.proposal_accepted_at).replace("Z", "+00:00") } : {}) } };
    };
    const builder = {
        update: vi.fn((data: Record<string, unknown>) => { payload = data; return builder; }),
        eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return builder; }),
        select: vi.fn(() => builder), single: vi.fn(async () => result()),
        then: (yes: (value: unknown) => unknown, no?: (reason: unknown) => unknown) => Promise.resolve().then(result).then(yes, no),
    };
    const from = vi.fn(() => builder);
    mocks.requireAuth.mockResolvedValue({ user: { id: user }, supabase: { from } });
    return { builder, from, filters, payload: () => payload };
}
beforeEach(() => { vi.clearAllMocks(); mocks.revalidate.mockReset(); });
describe("pipeline server mutation acknowledgement", () => {
    it.each(["error", "empty", "throw", "wrong-id", "wrong-status"] as const)("does not confirm an ordinary stage change on %s", async kind => {
        setup(kind);
        const result = await updateStatusAction(project, "Estimating");
        expect(result.success).toBe(false);
        expect(JSON.stringify(result)).not.toContain("private database detail");
        expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it.each(["error", "empty", "throw", "wrong-id", "wrong-status", "wrong-acceptance", "wrong-time"] as const)("does not confirm Mark as Won on %s", async kind => {
        setup(kind);
        const result = await markAsWonAction(project);
        expect(result.success).toBe(false);
        expect(JSON.stringify(result)).not.toContain("private database detail");
        expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it("preserves the exact owner filter, stage payload and dashboard revalidation on a confirmed ordinary write", async () => {
        const db = setup(); expect(await updateStatusAction(project, "Lost")).toEqual({ success: true });
        expect(db.payload()).toEqual({ status: "Lost" });
        expect(db.filters).toEqual([["id", project], ["user_id", user]]);
        expect(db.builder.select).toHaveBeenCalledOnce(); expect(db.builder.single).toHaveBeenCalledOnce();
        expect(mocks.revalidate.mock.calls).toEqual([["/dashboard"]]);
    });
    it("preserves the existing explicit Won payload without choosing a new acceptance policy", async () => {
        const db = setup(), result = await markAsWonAction(project);
        expect(result).toEqual({ success: true });
        expect(db.payload()).toEqual({ status: "Active", proposal_status: "accepted", proposal_accepted_at: expect.any(String) });
        expect(Number.isFinite(Date.parse(String(db.payload().proposal_accepted_at)))).toBe(true);
        expect(db.filters).toEqual([["id", project], ["user_id", user]]);
        expect(mocks.revalidate.mock.calls).toEqual([["/dashboard"], ["/dashboard/live"], ["/dashboard/projects/p-and-l"]]);
    });
    it("does not label a committed write unsaved when cache revalidation throws", async () => {
        setup(); mocks.revalidate.mockImplementation(() => { throw Error("cache failure"); });
        const result = await updateStatusAction(project, "Estimating");
        expect(result.success).toBe(true); expect(result).toHaveProperty("warning");
    });
    it("accepts equivalent database timestamp formatting without silently changing the requested time", async () => {
        setup("equivalent-time");
        expect(await markAsWonAction(project)).toEqual({ success: true });
    });
    it("keeps invalid status rejection before authentication or a database call", async () => {
        expect(await updateStatusAction(project, "invented")).toEqual({ success: false, error: "Invalid status" });
        expect(mocks.requireAuth).not.toHaveBeenCalled();
    });
    it("handles authentication failures without an unhandled rejection", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("private auth detail"));
        const result = await updateStatusAction(project, "Estimating");
        expect(result.success).toBe(false); expect(JSON.stringify(result)).not.toContain("private auth detail");
    });
});
