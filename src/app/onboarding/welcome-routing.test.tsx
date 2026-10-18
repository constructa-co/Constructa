import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePostSetupPath, PROPOSAL_READINESS_PATH } from "@/lib/first-session";

const mocks = vi.hoisted(() => ({ client: vi.fn(), redirect: vi.fn((path: string) => { throw Error(`NEXT_REDIRECT:${path}`); }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./onboarding-client", () => ({ default: () => null }));
import OnboardingPage from "./page";

function reads(companyName: string | null, count: number) {
    mocks.client.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "welcome-check" } } }) },
        from: (table: string) => ({ select: () => ({ eq: () => table === "profiles"
            ? { single: async () => ({ data: { company_name: companyName, full_name: "Sam", business_type: "Kitchen fitting" }, error: null }) }
            : Promise.resolve({ count, error: null }) }) }),
    });
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("company introduction routing", () => {
    it.each(["/dashboard", "/dashboard/home"])("keeps first introductions out of %s even when projects exist", landing => {
        expect(resolvePostSetupPath(2, landing, true)).toBe(PROPOSAL_READINESS_PATH);
        expect(resolvePostSetupPath(null, landing, true)).toBe(PROPOSAL_READINESS_PATH);
    });

    it("keeps existing no-project routing and returning-company count fallback", () => {
        expect(resolvePostSetupPath(0, "/dashboard")).toBe(PROPOSAL_READINESS_PATH);
        expect(resolvePostSetupPath(2, "/dashboard")).toBe("/dashboard");
        expect(resolvePostSetupPath(2, "/dashboard/home")).toBe("/dashboard/home");
        expect(resolvePostSetupPath(null, "/dashboard")).toBe("/dashboard");
    });

    it("gives an unnamed company the same welcome fallback as the server completion", async () => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort"); reads(null, 2);
        const result = await OnboardingPage({});
        expect(result.props).toMatchObject({ completionPath: PROPOSAL_READINESS_PATH, exitPath: null, initialStep: "business", initialFullName: "Sam", initialBusinessType: "Kitchen fitting" });
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it.each(["cohort", "full"])("preserves %s returning-company redirect and explicit edit exit", async profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile); reads("Saved business", 2);
        const expected = profile === "full" ? "/dashboard/home" : "/dashboard";
        await expect(OnboardingPage({})).rejects.toThrow(`NEXT_REDIRECT:${expected}`);
        const forced = await OnboardingPage({ searchParams: Promise.resolve({ force: "1" }) });
        expect(forced.props).toMatchObject({ completionPath: expected, exitPath: expected, initialCompanyName: "Saved business", initialStep: "trade" });
    });
});
