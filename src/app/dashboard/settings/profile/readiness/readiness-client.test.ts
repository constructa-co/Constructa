import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCompanyReadiness } from "@/lib/company-readiness";
import ReadinessClient from "./readiness-client";

const render = (hasProjects: boolean, profile = { company_name: "Smith Plumbing", business_type: "Boilers and bathrooms" }) =>
    renderToStaticMarkup(createElement(ReadinessClient, { readiness: buildCompanyReadiness(profile), hasProjects }));

describe("ReadinessClient", () => {
    it("shows the saved company, the work and both ways forward", () => {
        const html = render(false);
        expect(html).toContain("Smith Plumbing");
        expect(html).toContain("Boilers and bathrooms");
        expect(html).toMatch(/href="\/dashboard\/projects\/new"[^>]*>Create first project/);
        expect(html).toMatch(/href="\/dashboard\/settings\/profile"[^>]*>\s*Build company profile/);
    });

    it("never disables or hides project creation, however little is filled in", () => {
        const html = render(false, { company_name: "Smith Plumbing", business_type: "" });
        expect(html).toContain("Create first project");
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
        expect(html).toContain("Create a project");
        expect(html).not.toContain("Create first project");
        expect(html).not.toContain("You&#x27;re set up");
    });

    it("links only to Phase 1 routes", () => {
        const hrefs = Array.from(render(false).matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
        expect(new Set(hrefs)).toEqual(new Set([
            "/dashboard/projects/new",
            "/dashboard/settings/profile",
            "/dashboard/settings/case-studies",
        ]));
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
