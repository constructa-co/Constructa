import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import QuickQuotePage from "./page";
import { isDashboardPathAllowed } from "@/lib/launch-profile";

describe("Quick Quote compatibility route", () => {
    it("redirects to the single New Project route with no template or query", () => {
        expect(() => QuickQuotePage()).toThrow("NEXT_REDIRECT:/dashboard/projects/new");
        expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/projects/new");
    });

    it("stays reachable in the cohort profile so old links hit the redirect", () => {
        expect(isDashboardPathAllowed("/dashboard/projects/quick-quote", "cohort")).toBe(true);
        expect(isDashboardPathAllowed("/dashboard/projects/new", "cohort")).toBe(true);
    });
});
