import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_ORIGIN, REVIEW_PROJECT, reviewPageAllowed } from "@/lib/deployment/review-policy";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({ createClient: vi.fn(), createServerClient: vi.fn(), email: "admin@example.invalid" as string | null, signedIn: true, queries: [] as string[] }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mock.createServerClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/theme-context", () => ({ ThemeProvider: () => null }));
vi.mock("@/components/dashboard-shell", () => ({ default: () => null }));
vi.mock("sonner", () => ({ Toaster: () => null }));
import DashboardLayout from "./layout";
import { proxy } from "@/proxy";

beforeEach(() => {
    mock.email = "admin@example.invalid"; mock.signedIn = true; mock.queries = [];
    mock.createServerClient.mockReset();
    vi.stubEnv("ADMIN_EMAIL", "admin@example.invalid");
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
    vi.stubEnv("CONSTRUCTA_REVIEW_EDITABLE", "0");
    mock.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: mock.signedIn ? { id: "owner", email: mock.email } : null } }) },
        from: (table: string) => {
            mock.queries.push(table);
            const query = { select: () => query, eq: () => query, order: async () => ({ data: [] }), single: async () => ({ data: { theme_preference: "dark" } }) };
            return query;
        },
    });
});
afterEach(() => vi.unstubAllEnvs());

const adminVisible = async () => (await DashboardLayout({ children: <p>Existing workspace</p> })).props.children[0].props.isAdmin;
function review(editable: boolean) {
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "1"); vi.stubEnv("CONSTRUCTA_REVIEW_EDITABLE", editable ? "1" : "0");
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", REVIEW_ORIGIN);
    vi.stubEnv("CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF", REVIEW_PROJECT);
}

describe("protected-review Admin entry eligibility", () => {
    it.each(["cohort", "full"])("hides the unavailable entry for read-only %s review", async profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile); review(false);
        expect(await adminVisible()).toBe(false);
        expect(reviewPageAllowed("GET", "/admin")).toBe(false);
    });
    it.each(["cohort", "full"])("does not confuse editable %s QA with Admin permission", async profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile); review(true);
        expect(await adminVisible()).toBe(false);
        for (const method of ["GET", "HEAD", "POST"]) expect(reviewPageAllowed(method, "/admin")).toBe(false);
    });
    it.each(["cohort", "full"])("preserves existing matched-admin visibility outside %s review", async profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile);
        expect(await adminVisible()).toBe(true);
    });
    it.each([false, true])("retains real proxy403 before auth, editable review %s", async editable => {
        review(editable);
        for (const method of ["GET", "HEAD", "POST"]) {
            const response = await proxy(new NextRequest("https://review.example.invalid/admin", { method }));
            expect(response.status).toBe(403);
        }
        expect(mock.createServerClient).not.toHaveBeenCalled();
    });
    it.each(["different-user", "missing-user-email", "unset-admin"])("does not grant visibility for %s", async mode => {
        if (mode === "different-user") mock.email = "other@example.invalid";
        if (mode === "missing-user-email") mock.email = null;
        if (mode === "unset-admin") vi.stubEnv("ADMIN_EMAIL", "");
        expect(await adminVisible()).toBe(false);
    });
    it("retains authentication before project/profile reads", async () => {
        mock.signedIn = false; review(true);
        await expect(adminVisible()).rejects.toThrow("REDIRECT:/login"); expect(mock.queries).toEqual([]);
    });
    it.each(["production", "wrong-backend"])("fails closed for invalid review configuration: %s", async mode => {
        review(false);
        if (mode === "production") vi.stubEnv("VERCEL_ENV", "production");
        else vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://wrong.example.invalid");
        await expect(adminVisible()).rejects.toThrow(/Review mode requires/);
    });
});
