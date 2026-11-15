import { describe, expect, it, vi } from "vitest";
import AdminPage from "./page";

const dependencies = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
    requireAdmin: dependencies.requireAdmin,
}));
vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: dependencies.createAdminClient,
}));
vi.mock("./admin-client", () => ({ default: () => null }));

describe("AdminPage", () => {
    it("denies a non-admin before constructing a privileged database client", async () => {
        dependencies.requireAdmin.mockRejectedValueOnce(new Error("Unauthorized admin access."));

        await expect(AdminPage()).rejects.toThrow("Unauthorized admin access.");
        expect(dependencies.createAdminClient).not.toHaveBeenCalled();
    });
});
