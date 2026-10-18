import { describe, expect, it } from "vitest";
import { companyStartingPaths, orderWelcomeSteps, welcomeSteps } from "./first-session-welcome";
import { isDashboardPathAllowed } from "./launch-profile";
import { INTERVIEW_PATH } from "./company-interview/questions";
import { IMPORT_PATH } from "./company-import/draft";
import { PROFILE_PATH } from "./first-session";

describe("first-session welcome routes", () => {
    it("keeps four outcome paths with a single job entry", () => {
        const steps = welcomeSteps(false);
        expect(steps).toHaveLength(4);
        expect(steps.map(step => step.id)).toEqual(["company", "experience", "defaults", "proposal"]);
        expect(steps.filter(step => step.id === "proposal").map(step => step.href)).toEqual(["/dashboard/projects/new"]);
    });

    it("asks a returning contractor to choose an existing project", () => {
        expect(welcomeSteps(true).filter(step => step.id === "proposal").map(step => step.href)).toEqual(["/dashboard/projects"]);
    });

    it("reorders without mutation, filtering or new route permissions", () => {
        const steps = welcomeSteps(false);
        const original = [...steps];
        const ordered = orderWelcomeSteps(steps, "defaults");
        expect(ordered[0].id).toBe("defaults");
        expect(new Set(ordered.map((step) => step.href))).toEqual(new Set(steps.map((step) => step.href)));
        expect(steps).toEqual(original);
    });

    it("keeps company first when no optional focus is chosen", () => {
        expect(orderWelcomeSteps(welcomeSteps(false), null)[0].id).toBe("company");
    });

    it("offers the existing guided, manual and import routes without changing permissions", () => {
        expect(companyStartingPaths.map((path) => path.href)).toEqual([INTERVIEW_PATH, PROFILE_PATH, IMPORT_PATH]);
        for (const path of companyStartingPaths) expect(isDashboardPathAllowed(path.href, "cohort")).toBe(true);
    });
});
