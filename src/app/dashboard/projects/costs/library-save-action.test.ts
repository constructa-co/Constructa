import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ org: vi.fn(), auth: vi.fn(), from: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ getActiveOrganizationId: mocks.org, requireAuth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveRateBuildupAction } from "./actions";

const rows = [{ type: "material", description: "Boards", quantity: 20, unit: "nr", unit_rate: 2, manhours_per_unit: 0 }];
const save = (name = "Cupboards") => saveRateBuildupAction("org", name, "m2", "Carpentry", rows, 4, 0);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.org.mockResolvedValue("org"); mocks.auth.mockResolvedValue({ supabase: { from: mocks.from } });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({ data: { id: "copy", organization_id: "org", name: "Cupboards" }, error: null });
});
describe("resource library save acknowledgement", () => {
    it("copies consultancy identity and entered hours without normalizing them into labour or a recipe", async () => {
        const consultancy = [{ type: "consultancy", description: "Engineer review", quantity: 2, unit: "hr", unit_rate: 150, manhours_per_unit: 4 }];
        await expect(saveRateBuildupAction("org", "Cupboards", "item", "Design", consultancy, 300, 0)).resolves.toEqual({ id: "copy", name: "Cupboards" });
        expect(mocks.insert).toHaveBeenCalledExactlyOnceWith({ organization_id: "org", name: "Cupboards", unit: "item", trade_section: "Design", components: consultancy, built_up_rate: 300, total_manhours_per_unit: 0 });
    });
    it("returns the confirmed organization-owned copy without changing total resource quantities", async () => {
        await expect(save()).resolves.toEqual({ id: "copy", name: "Cupboards" });
        expect(mocks.from).toHaveBeenCalledExactlyOnceWith("rate_buildups");
        expect(mocks.insert).toHaveBeenCalledExactlyOnceWith({ organization_id: "org", name: "Cupboards", unit: "m2", trade_section: "Carpentry", components: rows, built_up_rate: 4, total_manhours_per_unit: 0 });
        expect(mocks.select).toHaveBeenCalledWith("id, organization_id, name");
    });
    it.each([null, { id: "", organization_id: "org", name: "Cupboards" }, { id: "copy", organization_id: "other", name: "Cupboards" }, { id: "copy", organization_id: "org", name: "Other" }])("does not claim an unconfirmed copy: %j", async data => {
        mocks.single.mockResolvedValueOnce({ data, error: null });
        await expect(save()).rejects.toThrow(/not confirmed.*may already/i);
    });
    it("retains uncertainty when an insert response reports an error", async () => {
        mocks.single.mockResolvedValueOnce({ data: null, error: { message: "Response lost" } });
        await expect(save()).rejects.toThrow(/not confirmed.*may already/i);
    });
    it("retains the existing active organization authorization before any insert", async () => {
        mocks.org.mockResolvedValueOnce("other");
        await expect(save()).rejects.toThrow(/Unauthorized/);
        expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
    });
    it("requires authentication before the library write", async () => {
        mocks.auth.mockRejectedValueOnce(new Error("Not signed in"));
        await expect(save()).rejects.toThrow("Not signed in"); expect(mocks.from).not.toHaveBeenCalled();
    });
    it("refuses a blank name rather than creating an unnamed copy", async () => {
        await expect(save("  ")).rejects.toThrow(/name/i); expect(mocks.insert).not.toHaveBeenCalled();
    });
});
