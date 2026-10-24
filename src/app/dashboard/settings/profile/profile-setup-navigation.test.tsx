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
