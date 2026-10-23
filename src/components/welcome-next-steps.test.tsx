import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import WelcomeNextSteps from "./welcome-next-steps";
import { buildCompanyReadiness } from "@/lib/company-readiness";
import ReadinessClient from "@/app/dashboard/settings/profile/readiness/readiness-client";

const render = (hasProjects = false) => renderToStaticMarkup(<ReadinessClient readiness={buildCompanyReadiness({ company_name: "Example Builders", business_type: "Kitchen fitting" })} hasProjects={hasProjects} />);
const tiles = (html: string) => [...html.matchAll(/data-welcome-step="([^"]+)"/g)].map(match => match[1]);

describe("compact welcome paths", () => {
    it("presents company, experience, defaults and one proposal journey in order", () => {
        expect(tiles(render())).toEqual(["company", "experience", "defaults", "proposal"]);
        expect(render()).not.toContain("Price your first job");
        expect(render()).not.toContain("Your starting point");
    });

    it.each([false, true])("has one job journey when hasProjects is %s", hasProjects => {
        const href = hasProjects ? "/dashboard/projects" : "/dashboard/projects/new";
        const html = render(hasProjects);
        expect([...html.matchAll(/href="([^"]+)"/g)].filter(match => match[1] === href)).toHaveLength(1);
        expect(html).toContain(hasProjects ? "Build your next proposal" : "Build your first proposal");
    });

    it("keeps all three company routes behind a closed company tile", () => {
        const html = renderToStaticMarkup(<WelcomeNextSteps hasProjects={false} />);
        const company = html.match(/<details[^>]*data-welcome-step="company"[\s\S]*?<\/details>/)?.[0];
        expect(company).toBeDefined();
        expect(company).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
        for (const href of ["/dashboard/settings/profile/interview", "/dashboard/settings/profile", "/dashboard/settings/profile/import"]) expect(company).toContain(`href="${href}"`);
        expect(company).toContain("not a live AI chat");
        expect(company).toContain("Opening this page does not fetch your site");
    });

    it("links defaults to actual profile sections without a new save form", () => {
        const html = render();
        expect(html).toContain('href="/dashboard/settings/profile#company-style"');
        expect(html).toContain('href="/dashboard/settings/profile#company-director"');
        expect(html).toContain("Company-wide programme, payment and terms defaults are not available here yet");
        expect(html).not.toContain("<form"); expect(html).not.toContain("<input");
    });

    it("keeps the existing readiness facts inside the company path", () => {
        const html = render();
        const companyStart = html.indexOf('data-welcome-step="company"');
        const companyEnd = html.indexOf("</details>", companyStart);
        const listStart = html.indexOf('aria-labelledby="readiness-list-heading"');
        expect(listStart).toBeGreaterThan(companyStart); expect(listStart).toBeLessThan(companyEnd);
        for (const key of ["basics", "brand", "story", "case-studies", "terms"]) expect(html).toContain(`data-readiness="${key}"`);
        expect(html).toContain("1 of 5 in place");
        expect(html).toContain("optional"); expect(html).not.toContain("aria-disabled");
    });

    it("uses exclusive native disclosures, not a persisted focus preference", () => {
        const html = render();
        expect([...html.matchAll(/<details[^>]*name="welcome-paths"/g)]).toHaveLength(2);
        expect(html).not.toContain("aria-pressed");
    });

    it("scopes compact layout changes away from account and setup controls", () => {
        const css = readFileSync(new URL("./first-session.module.css", import.meta.url), "utf8");
        expect(css).toContain(".welcomePaths .tile");
        expect(css).toContain(".welcomePaths .chooser[open]");
    });
});
