import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCompanyReadiness, type CompanyReadinessProfile } from "@/lib/company-readiness";
import ReadinessClient from "./readiness-client";

const render = (hasProjects: boolean, profile: CompanyReadinessProfile = { company_name: "Smith Plumbing", business_type: "Boilers and bathrooms" }) =>
    renderToStaticMarkup(createElement(ReadinessClient, { readiness: buildCompanyReadiness(profile), hasProjects }));

describe("ReadinessClient", () => {
    it("shows the saved company, the work and both ways forward", () => {
        const html = render(false);
        expect(html).toContain("Smith Plumbing");
        expect(html).toContain("Boilers and bathrooms");
        expect(html).toContain("Build your first proposal");
        const companyPath = html.match(/<details[^>]*data-welcome-step="company"[\s\S]*?<\/details>/)?.[0];
        expect(companyPath).toMatch(/href="\/dashboard\/settings\/profile"/);
        expect(companyPath).toContain("Fill it in yourself");
    });

    it("never disables or hides project creation, however little is filled in", () => {
        const html = render(false, { company_name: "Smith Plumbing", business_type: "" });
        expect(html).toContain("Build your first proposal");
        expect(html).not.toMatch(/\sdisabled[=\s>]|aria-disabled/);
        expect(html).toContain("optional");
    });

    it("lists the five parts with their status", () => {
        const html = render(false);
        for (const title of ["Company basics", "Logo and brand", "Company story", "Case studies", "Terms"]) {
            expect(html).toContain(title);
        }
        expect(html).toContain("1 of 5 in place");
        expect(html.match(/data-status="todo"/g)).toHaveLength(3);
    });

    it("drops the first-time wording for a contractor who already has projects", () => {
        const html = render(true);
        expect(html).toContain("Build your next proposal");
        expect(html).not.toContain("Build your first proposal");
        expect(html).not.toContain("You&#x27;re set up");
    });

    it("links only to Phase 1 routes", () => {
        const hrefs = Array.from(render(false).matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
        expect(new Set(hrefs)).toEqual(new Set([
            "/dashboard/projects/new",
            "/dashboard/settings/profile",
            "/dashboard/settings/profile/interview",
            "/dashboard/settings/profile/import",
            "/dashboard/settings/case-studies",
            "/dashboard/settings/profile#company-style",
            "/dashboard/settings/profile#company-director",
        ]));
    });

    it("offers three optional company paths without hiding project creation", () => {
        const html = render(false);
        for (const label of ["Answer a few questions", "Fill it in yourself", "Bring in details from your own website"]) {
            expect(html).toContain(label);
        }
        expect(html).toContain("not a live AI chat");
        expect(html).toContain("Opening this page does not fetch your site");
        expect(html).toContain("Build your first proposal");
        expect(html).toMatch(/<details[^>]*data-welcome-step="company"/);
        expect(html).not.toContain("<form");
        expect(html).not.toContain("<input");
    });

    it("adds guided entry beside a missing story but keeps saved stories as Edit", () => {
        const storyRow = (profile: CompanyReadinessProfile) => render(true, profile).match(/<li[^>]*data-readiness="story"[\s\S]*?<\/li>/)?.[0];
        expect(storyRow({ capability_statement: "   " })).toContain("Add story");
        expect(storyRow({ capability_statement: "   " })).toContain("Use guided questions");
        expect(storyRow({ capability_statement: "We build extensions." })).toContain("Edit");
        expect(storyRow({ capability_statement: "We build extensions." })).not.toContain("Use guided questions");
    });
});

describe("profile form", () => {
    it("keeps the work answer as free text, so an answer outside a fixed list is never blanked on save", async () => {
        const { readFileSync } = await import("node:fs");
        const source = readFileSync(new URL("../profile-form.tsx", import.meta.url), "utf8");
        const field = source.slice(source.indexOf('id="profile-business-type"') - 200, source.indexOf('id="profile-business-type"') + 400);
        expect(field).toContain("<input");
        expect(field).toContain('name="business_type"');
        expect(source).not.toMatch(/<select[^>]*\n?[^>]*name="business_type"/);
    });
});
