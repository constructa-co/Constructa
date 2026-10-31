import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./onboarding-client", () => ({ default: () => null }));
vi.mock("../dashboard/settings/profile/readiness/readiness-client", () => ({ default: () => null }));

import OnboardingPage from "./page";
import ProposalReadinessPage from "../dashboard/settings/profile/readiness/page";

function reads(profileError: string | null, projectsError: string | null, count: number | null = 0) {
    mocks.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: (table: string) => ({ select: () => ({ eq: () => table === "profiles"
            ? { single: async () => ({ data: { company_name: "Saved business" }, error: profileError ? { message: profileError } : null }) }
            : Promise.resolve({ count, error: projectsError ? { message: projectsError } : null }) }) }),
    });
}

describe("setup page database failures", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    for (const [name, page] of [
        ["onboarding", () => OnboardingPage({ searchParams: Promise.resolve({ force: "true" }) })],
        ["readiness", () => ProposalReadinessPage()],
    ] as const) {
        it(`${name} does not render empty setup after a failed profile read`, async () => {
            reads("profile unavailable", null);
            await expect(page()).rejects.toThrow("Company profile failed to load");
            expect(mocks.redirect).not.toHaveBeenCalled();
        });
        it(`${name} does not guess the next step after a failed project count`, async () => {
            reads(null, "count unavailable", null);
            await expect(page()).rejects.toThrow("Project count failed to load");
        });
        it(`${name} renders saved data after successful reads`, async () => {
            reads(null, null);
            expect(await page()).toHaveProperty("props");
        });
    }
});
