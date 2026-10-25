import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
import ProfileForm from "./profile-form";
import CompanyProfilePresentation from "@/components/company-profile-presentation";

describe("company setup navigation", () => {
    it("separates proposal defaults from company details without a second save owner", () => {
        const html = renderToStaticMarkup(createElement(ProfileForm, {
            profile: { company_name: "Example Builders", pdf_theme: "navy", md_name: "Sam", md_message: "Our own message" } as never,
            userEmail: "sam@example.invalid",
        }));
        const navigation = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
        const groups = [...navigation.matchAll(/<div[^>]*role="group" aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)];
        expect(groups.map(group => group[1])).toEqual(["Company profile", "Proposal defaults", "Data choices"]);
        expect([...groups[1][2].matchAll(/aria-controls="([^"]+)"/g)].map(match => match[1])).toEqual(["company-style", "company-director"]);
        expect(groups[0][2]).not.toContain('aria-controls="company-style"');
        expect(html).toMatch(/role="group" aria-label="Proposal defaults"[^>]*hidden=""/);
        expect(html).toContain('aria-label="Profile journeys"');
        expect(html.match(/<form\b/g)).toHaveLength(1);
        expect(html).toContain('data-pdf-theme="navy"');
        expect(html).toContain('name="md_name"');
        expect(html).toContain("Our own message");
        expect(html).toContain("Shared proposal settings stay in this profile. Save still applies to every section.");
        expect(html).toContain("Saving this profile does not change them.");
    });

    it("groups the persistent section chooser beside the same mounted profile panels", () => {
        const html = renderToStaticMarkup(createElement(ProfileForm, {
            profile: { company_name: "Example Builders", business_type: "Kitchen fitting" } as never,
            userEmail: "sam@example.invalid",
        }));
        expect(html).toMatch(/<div[^>]*data-profile-journey[^>]*>\s*<nav/);
        expect(html).toMatch(/<\/nav>\s*<div[^>]*data-profile-panels/);
        expect(html).toMatch(/aria-controls="company-basics" aria-current="true"/);
        expect(html).toContain("Save applies to all sections of this profile");
        const css = readFileSync(new URL("../../../../components/company-profile.module.css", import.meta.url), "utf8");
        expect(css).toMatch(/\.sectionLayout\s*\{[^}]*grid-template-columns:\s*180px minmax\(0,\s*1fr\)/);
        expect(css).toMatch(/\.sectionLayout > \.navigation\s*\{[^}]*flex-direction:\s*column/);
        expect(css).toMatch(/@media\s*\(max-width:\s*800px\)\s*\{\s*\.sectionLayout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    });

    it("names Work Winning as the next journey without making a save or route automatic", () => {
        const html = renderToStaticMarkup(createElement(CompanyProfilePresentation, null, "Existing profile form"));
        expect(html).toContain("Next: Work Winning");
        expect(html).toContain("Save your profile changes before leaving");
        expect(html).toContain("Pipeline or New Project from Work Winning in the main navigation");
        expect(html).toContain("Existing profile form");
        expect(html).not.toContain("href=\"/dashboard/projects/new\"");
    });
});
