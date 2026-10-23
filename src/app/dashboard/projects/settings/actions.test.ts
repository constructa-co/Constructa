import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { updateProjectAction } from "./actions";

const id = "owned-settings-job";
const form = () => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ projectId: id, name: "Job name", status: "Estimating", project_type: "Other", start_date: "2026-11-06", potential_value: "123.45", payment_terms: "21 days", client_name: "Client", client_email: "", client_phone: "", client_address: "  Exact address  ", site_address: "Site address", scope: "Scope" })) data.set(key, value);
    return data;
};
function database(result: unknown = { data: { id }, error: null }) {
    const query = {
        update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
        single: vi.fn(async () => result),
    };
    const from = vi.fn(() => query);
    mocks.auth.mockResolvedValue({ user: { id: "owner" }, supabase: { from } });
    return { query, from };
}
beforeEach(() => { mocks.auth.mockReset(); mocks.revalidate.mockReset(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("settings save acknowledges only the requested owner-scoped job", () => {
    it("uses one unchanged update payload and confirms the exact returned identity", async () => {
        const db = database();
        expect(await updateProjectAction(form())).toEqual({ success: true });
        expect(db.from).toHaveBeenCalledExactlyOnceWith("projects");
        expect(db.query.update).toHaveBeenCalledExactlyOnceWith({ name: "Job name", status: "Estimating", project_type: "Other", start_date: "2026-11-06", potential_value: 123.45, payment_terms: "21 days", client_name: "Client", client_email: null, client_phone: null, client_address: "  Exact address  ", site_address: "Site address", scope_description: "Scope", is_vat_reverse_charge: false });
        expect(db.query.eq.mock.calls).toEqual([["id", id], ["user_id", "owner"]]);
        expect(db.query.select).toHaveBeenCalledExactlyOnceWith("id"); expect(db.query.single).toHaveBeenCalledTimes(1);
        expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith(`/dashboard/projects/settings?projectId=${id}`);
    });

    it.each([
        { data: null, error: null },
        { data: undefined, error: null },
        { data: {}, error: null },
        { data: { id: "another-job" }, error: null },
        { data: [], error: null },
        { data: { id }, error: { code: "refused" } },
    ])("refuses an empty, mismatched or refused acknowledgement without cache refresh: %j", async result => {
        const db = database(result);
        expect(await updateProjectAction(form())).toEqual({ success: false });
        expect(db.query.update).toHaveBeenCalledTimes(1);
        expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it("does not turn a rejected response into success or retry the update", async () => {
        const db = database(); db.query.single.mockRejectedValueOnce(Error("Unknown result"));
        await expect(updateProjectAction(form())).rejects.toThrow("Unknown result");
        expect(db.query.update).toHaveBeenCalledTimes(1); expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it("does not write without the existing authenticated owner context", async () => {
        const db = database(); mocks.auth.mockRejectedValueOnce(Error("Unauthorized"));
        await expect(updateProjectAction(form())).rejects.toThrow("Unauthorized");
        expect(db.from).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it("retains the existing unconfirmed outcome when cache refresh throws after a clean acknowledgement", async () => {
        const db = database(); mocks.revalidate.mockImplementationOnce(() => { throw Error("Refresh unconfirmed"); });
        await expect(updateProjectAction(form())).rejects.toThrow("Refresh unconfirmed");
        expect(db.query.update).toHaveBeenCalledTimes(1);
    });
});
