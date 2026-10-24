import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));

import ProfileForm from "./profile-form";

// The server-rendered contract of the one-section-at-a-time profile. Browser
// switching, saving and native validation are covered by the local
// profile-sections native leg; this checks what every first render ships.
const SECTIONS = ["company-basics", "company-work", "company-contacts", "company-style", "company-director", "company-consent"];
const html = renderToStaticMarkup(createElement(ProfileForm, {
    profile: { company_name: "Example Builders Ltd", phone: "0113 496 0000", md_name: "Sam", data_consent: true } as never,
    userEmail: "sam@example.com",
}));
const tag = (id: string) => html.match(new RegExp(`<section id="${id}"[^>]*>`))![0];
const presentation = readFileSync(path.resolve(import.meta.dirname, "../../../../components/company-profile-presentation.tsx"), "utf8");

describe("company profile sections", () => {
    it("offers a persistent chooser of six view-only buttons, with the first section current", () => {
        const nav = html.match(/<nav[^>]*aria-label="Company profile sections"[^>]*>([\s\S]*?)<\/nav>/)![1];
        const buttons = Array.from(nav.matchAll(/<button([^>]*)>([^<]*)<\/button>/g));
        expect(buttons.map(match => match[2])).toEqual(["Company basics", "Your work &amp; story", "Your people", "Proposal style", "Director message", "Data consent"]);
        for (const [index, match] of buttons.entries()) {
            expect(match[1]).toContain('type="button"');
            expect(match[1]).toContain(`aria-controls="${SECTIONS[index]}"`);
        }
        expect(buttons.filter(match => match[1].includes('aria-current="true"')).map(match => match[2])).toEqual(["Company basics"]);
    });

    it("renders every section mounted, showing only the current one", () => {
        expect(tag("company-basics")).not.toContain("hidden");
        for (const id of SECTIONS.slice(1)) expect(tag(id)).toContain('hidden=""');
        for (const name of ["company_name", "business_type", "phone", "sales_email", "accounts_email", "specialisms", "insurance_details", "accreditations", "capability_statement", "logo_url", "md_name", "md_message", "data_consent", "financial_year_start_month"]) {
            expect(html, name).toContain(`name="${name}"`);
        }
        expect(html).toContain('value="Sam"');
        expect(html).toMatch(/name="data_consent"[^>]*checked=""/);
    });

    it("keeps native validation and the whole-profile save in view", () => {
        expect(html).not.toMatch(/novalidate/i);
        expect(html).toMatch(/<input[^>]*id="company-company_name"[^>]*required=""/);
        const salesEmail = html.match(/<input[^>]*name="sales_email"[^>]*>/)![0];
        expect(salesEmail).toContain('type="email"');
        expect(html).not.toMatch(/<(input|textarea|select)[^>]*disabled=""[^>]*name="/);
        expect(html).toContain("Save applies to all sections of this profile, not just the section you are viewing.");
        expect(html).toContain("Save Company Profile");
        expect(html).toMatch(/<section data-profile-case-studies[^>]*>/);
        expect(html.match(/<section data-profile-case-studies[^>]*>/)![0]).not.toContain("hidden");
    });

    it("no longer duplicates the sections as anchor links in the page header", () => {
        expect(presentation).not.toMatch(/href="#company-/);
        expect(presentation).not.toContain('aria-label="Company profile sections"');
    });
});
