import { describe, expect, it } from "vitest";
import { buildCompanyReadiness, countCaseStudies } from "./company-readiness";
import { isDashboardPathAllowed } from "./launch-profile";

const status = (profile: Parameters<typeof buildCompanyReadiness>[0]) =>
    Object.fromEntries(buildCompanyReadiness(profile).items.map((entry) => [entry.key, entry.status]));

describe("buildCompanyReadiness", () => {
    it("shows a contractor straight out of setup what is saved and what is not", () => {
        const readiness = buildCompanyReadiness({ company_name: " Smith Plumbing ", business_type: "Boilers and bathrooms" });

        expect(readiness.companyName).toBe("Smith Plumbing");
        expect(readiness.workType).toBe("Boilers and bathrooms");
        expect(readiness.items.map((entry) => entry.key)).toEqual(["basics", "brand", "story", "case-studies", "terms"]);
        expect(status({ company_name: "Smith Plumbing" })).toEqual({
            basics: "started",
            brand: "todo",
            story: "todo",
            "case-studies": "todo",
            terms: "included",
        });
        expect(readiness.readyCount).toBe(1);
        expect(readiness.total).toBe(5);
    });

    it("names exactly the basics that are still missing", () => {
        const detail = (profile: Parameters<typeof buildCompanyReadiness>[0]) =>
            buildCompanyReadiness(profile).items[0].detail;

        expect(detail({ company_name: "Smith Plumbing" }))
            .toBe("Your business name is saved. Add a phone number so clients know who you are and how to reach you.");
        expect(detail({ company_name: "Smith Plumbing", phone: "01234 567890" }))
            .toBe("Your client-facing business name and phone number are saved.");
    });

    it("marks each part ready only from what is saved", () => {
        const full = {
            company_name: "Smith Plumbing",
            phone: "01234 567890",
            logo_url: "https://example.test/logo.png",
            capability_statement: "We fit bathrooms.",
            case_studies: [{ projectName: "Example Road refit" }, { projectName: "High Street wet room", whatWeDelivered: "A wet room" }],
        };
        expect(status(full)).toEqual({ basics: "ready", brand: "ready", story: "ready", "case-studies": "ready", terms: "included" });
        expect(buildCompanyReadiness(full).readyCount).toBe(5);
        expect(buildCompanyReadiness(full).items[3].detail).toBe("2 case studies saved.");
        expect(buildCompanyReadiness({ ...full, case_studies: [{ projectName: "One" }] }).items[3].detail).toBe("1 case study saved.");

        expect(status({ company_name: "S", phone: "x" }).basics).toBe("ready");
        expect(status({ company_name: "S", sales_phone: "x" }).basics).toBe("started");
        expect(status({ company_name: "S", sales_email: "x" }).basics).toBe("started");
    });

    it("does not count blank or malformed values as content", () => {
        expect(status({
            company_name: "Smith Plumbing",
            address: "   ",
            logo_url: "",
            capability_statement: "  \n ",
            case_studies: [{}, { projectName: "  " }, null, "text"],
        })).toEqual({ basics: "started", brand: "todo", story: "todo", "case-studies": "todo", terms: "included" });
        expect(countCaseStudies("not a list")).toBe(0);
        expect(countCaseStudies(null)).toBe(0);
        expect(countCaseStudies([{ whatWeDelivered: "A wet room" }])).toBe(0);
    });

    it("copes with a missing profile without inventing anything", () => {
        const readiness = buildCompanyReadiness(null);
        expect(readiness.companyName).toBe("");
        expect(readiness.workType).toBe("");
        expect(readiness.items[0].status).toBe("todo");
        expect(readiness.items[0].detail).toContain("Add your business name");
    });

    it("offers no setup step for terms and never claims they are the contractor's own", () => {
        const terms = buildCompanyReadiness({ company_name: "Smith Plumbing" }).items[4];
        expect(terms.action).toBeUndefined();
        expect(terms.detail).toContain("Standard terms");
    });

    it("links only to pages the cohort launch profile can open", () => {
        for (const entry of buildCompanyReadiness({ company_name: "Smith Plumbing" }).items) {
            if (entry.action) expect(isDashboardPathAllowed(entry.action.href, "cohort"), entry.key).toBe(true);
        }
    });
});
