import { describe, expect, it } from "vitest";
import { isDashboardPathAllowed } from "./launch-profile";
import { buildPhoneNav, getPhoneNavTitle, isPhoneNavItemActive } from "./phone-nav";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function flat(groups: ReturnType<typeof buildPhoneNav>) {
    return groups.flatMap((group) => group.items);
}

describe("buildPhoneNav", () => {
    it("reaches every Phase 1 destination with short labels", () => {
        expect(flat(buildPhoneNav(null, "cohort")).map((item) => item.label)).toEqual([
            "Pipeline", "New Project", "Brief", "Estimates", "Programmes", "Proposals", "Profile", "Case Studies",
        ]);
    });

    it("only links to routes the cohort launch profile allows", () => {
        for (const item of flat(buildPhoneNav(PROJECT_ID, "cohort"))) {
            expect(isDashboardPathAllowed(item.path, "cohort")).toBe(true);
        }
    });

    it("does not widen the menu under the full profile", () => {
        expect(flat(buildPhoneNav(null, "full")).map((item) => item.key))
            .toEqual(flat(buildPhoneNav(null, "cohort")).map((item) => item.key));
    });

    it("carries the active project into project routes only", () => {
        const items = Object.fromEntries(flat(buildPhoneNav(PROJECT_ID, "cohort")).map((item) => [item.key, item.href]));
        expect(items.brief).toBe(`/dashboard/projects/brief?projectId=${PROJECT_ID}`);
        expect(items.estimates).toBe(`/dashboard/projects/costs?projectId=${PROJECT_ID}`);
        expect(items.programmes).toBe(`/dashboard/projects/schedule?projectId=${PROJECT_ID}`);
        expect(items.proposals).toBe(`/dashboard/projects/proposal?projectId=${PROJECT_ID}`);
        expect(items.pipeline).toBe("/dashboard");
        expect(items["new-project"]).toBe("/dashboard/projects/new");
        expect(items.profile).toBe("/dashboard/settings/profile");
        expect(items["case-studies"]).toBe("/dashboard/settings/case-studies");
    });

    it("falls back to the project picker routes when no project is active", () => {
        const items = flat(buildPhoneNav(null, "cohort"));
        expect(items.every((item) => item.href === item.path)).toBe(true);
    });

    it("escapes the project id", () => {
        const brief = flat(buildPhoneNav("a b&c", "cohort")).find((item) => item.key === "brief");
        expect(brief?.href).toBe("/dashboard/projects/brief?projectId=a%20b%26c");
    });
});

describe("isPhoneNavItemActive", () => {
    it("matches Pipeline exactly so it is not active on every dashboard page", () => {
        expect(isPhoneNavItemActive("/dashboard", { path: "/dashboard" })).toBe(true);
        expect(isPhoneNavItemActive("/dashboard/projects/brief", { path: "/dashboard" })).toBe(false);
    });

    it("matches a route and its sub-routes but not a sibling prefix", () => {
        expect(isPhoneNavItemActive("/dashboard/projects/proposal", { path: "/dashboard/projects/proposal" })).toBe(true);
        expect(isPhoneNavItemActive("/dashboard/projects/proposal/preview", { path: "/dashboard/projects/proposal" })).toBe(true);
        expect(isPhoneNavItemActive("/dashboard/projects/proposals-old", { path: "/dashboard/projects/proposal" })).toBe(false);
        expect(isPhoneNavItemActive(null, { path: "/dashboard" })).toBe(false);
    });
});

describe("getPhoneNavTitle", () => {
    const groups = buildPhoneNav(null, "cohort");

    it("names the current Phase 1 page", () => {
        expect(getPhoneNavTitle("/dashboard", groups)).toBe("Pipeline");
        expect(getPhoneNavTitle("/dashboard/projects/costs", groups)).toBe("Estimates");
        expect(getPhoneNavTitle("/dashboard/settings/case-studies", groups)).toBe("Case Studies");
    });

    it("falls back to the product name elsewhere", () => {
        expect(getPhoneNavTitle("/dashboard/projects/settings", groups)).toBe("Constructa");
        expect(getPhoneNavTitle(undefined, groups)).toBe("Constructa");
    });
});
