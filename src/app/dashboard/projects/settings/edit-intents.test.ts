import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), owned: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.auth, requireProjectAccess: mocks.owned }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { updateProjectAction, updateProjectStatusAction } from "./actions";
import { getPrecontractEditLockReason, type PrecontractProjectState } from "@/lib/project-editability";

const id = "owned-settings-job";
function form(entries: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ projectId: id, ...entries })) data.set(key, value);
    return data;
}
function database(project: PrecontractProjectState = { status: "Draft" }, result: unknown = { data: { id }, error: null }) {
    const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: project, error: null }) };
    const write = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue(result) };
    const update = vi.fn((updates: Record<string, unknown>) => { void updates; return write; });
    const from = vi.fn(() => ({ ...read, update }));
    const access = { user: { id: "owner" }, supabase: { from } };
    mocks.auth.mockResolvedValue(access); mocks.owned.mockResolvedValue(access);
    return { read, write, update, from };
}
const locks: PrecontractProjectState[] = [
    { is_archived: true }, { proposal_accepted_at: "2026-10-22T00:00:00Z" }, { proposal_status: "Accepted" },
    ...["active", "Won", "completed", "Lost", "Archived"].map(status => ({ status })),
];
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("settings protected details and operational status intents", () => {
    it.each(locks)("refuses protected edits under the existing classification: %j", async project => {
        const db = database(project);
        expect(await updateProjectAction(form({ name: "Do not write" }))).toEqual({ success: false, lockReason: getPrecontractEditLockReason(project) });
        expect(mocks.owned).toHaveBeenCalledExactlyOnceWith(id);
        expect(db.read.select).toHaveBeenCalledExactlyOnceWith("status, is_archived, proposal_status, proposal_accepted_at");
        expect(db.read.eq.mock.calls).toEqual([["id", id], ["user_id", "owner"]]);
        expect(db.update).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it.each(locks)("does not blanket-lock the existing owner-scoped status path: %j", async project => {
        const db = database(project);
        expect(await updateProjectStatusAction(form({ status: "Review", potential_value: "999", name: "Not submitted" }))).toEqual({ success: true });
        expect(mocks.auth).toHaveBeenCalledOnce(); expect(mocks.owned).not.toHaveBeenCalled();
        expect(db.read.single).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalledExactlyOnceWith({ status: "Review" });
        expect(db.write.eq.mock.calls).toEqual([["id", id], ["user_id", "owner"]]);
    });
    it("uses the shared guard for an unlocked protected save and keeps the existing parser", async () => {
        const db = database();
        expect(await updateProjectAction(form({ name: "  Exact name  ", potential_value: "0.125", project_type: "  Specialist work  " }))).toEqual({ success: true });
        expect(db.update.mock.calls[0][0]).toMatchObject({ name: "  Exact name  ", potential_value: 0.125, project_type: "  Specialist work  ", start_date: null });
        expect(db.update.mock.calls[0][0]).not.toHaveProperty("status");
    });
    it("refuses legacy combined submissions rather than falsely acknowledging status", async () => {
        const db = database();
        expect(await updateProjectAction(form({ name: "Combined", status: "Won" }))).toEqual({ success: false, error: "Save the project status separately." });
        expect(db.update).not.toHaveBeenCalled(); expect(mocks.owned).not.toHaveBeenCalled();
    });
    it.each(["Draft", "Review", "Sent", "Won", "Lost", "active", "  Legacy status  ", ""])("retains the existing raw status contract %j without protected defaults", async status => {
        const db = database();
        await updateProjectStatusAction(form({ status }));
        expect(db.update).toHaveBeenCalledExactlyOnceWith({ status: status === "" ? null : status });
    });
    it.each([null, {}, { id: "foreign" }])("does not confirm a status update with a missing or different acknowledgement: %j", async data => {
        const db = database({}, { data, error: null });
        expect(await updateProjectStatusAction(form({ status: "Lost" }))).toEqual({ success: false });
        expect(db.update).toHaveBeenCalledOnce(); expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it("refuses unreadable owner/lock state before a protected update", async () => {
        const db = database(); db.read.single.mockResolvedValue({ data: null, error: null });
        await expect(updateProjectAction(form({ name: "Unconfirmed" }))).rejects.toThrow("Unauthorized project access");
        expect(db.update).not.toHaveBeenCalled();
    });
    it("propagates owner rejection without a protected write", async () => {
        const db = database(); mocks.owned.mockRejectedValueOnce(Error("Unauthorized project access."));
        await expect(updateProjectAction(form({ name: "Foreign" }))).rejects.toThrow("Unauthorized");
        expect(db.from).not.toHaveBeenCalled();
    });
    it("does not retry an unknown status response", async () => {
        const db = database(); db.write.single.mockRejectedValueOnce(Error("Unknown remote result"));
        await expect(updateProjectStatusAction(form({ status: "Won" }))).rejects.toThrow("Unknown remote result");
        expect(db.update).toHaveBeenCalledOnce(); expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it("refuses absent status instead of defaulting it", async () => {
        const db = database();
        expect(await updateProjectStatusAction(form({}))).toEqual({ success: false }); expect(db.update).not.toHaveBeenCalled();
    });
});
