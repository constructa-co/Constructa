import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));

import ProfileForm from "./profile-form";

// A029: insurance, accreditations and the company logo belong to Company basics.
// The section that holds a field is the one the chooser, deep links and the
// native invalid reveal (closest section[id]) open for it, so ownership is the
// rendered markup. Switching and saving are covered by the company-basics native leg.
const html = renderToStaticMarkup(createElement(ProfileForm, {
    profile: {
        company_name: "Example Builders Ltd",
        insurance_details: "Public Liability 5M",
        accreditations: "CITB, FMB Member",
        logo_url: "https://example.invalid/logo.png",
    } as never,
    userEmail: "sam@example.com",
}));
const section = (id: string) => {
    const start = html.indexOf(`<section id="${id}"`);
    expect(start, id).toBeGreaterThan(-1);
    return html.slice(start, html.indexOf("</section>", start));
};
const MOVED = [
    /<textarea[^>]*id="company-insurance_details"[^>]*name="insurance_details"/,
    /<input[^>]*id="company-accreditations"[^>]*name="accreditations"/,
    /<input(?=[^>]*name="logo_url")(?=[^>]*type="hidden")(?=[^>]*value="https:\/\/example.invalid\/logo.png")[^>]*\/>/,
    /<input id="company-logo-input" type="file" accept="image\/jpeg,image\/png,image\/webp"/,
    /<label for="company-insurance_details"/,
    /<label for="company-accreditations"/,
    /<label for="company-logo-input"/,
    /Upload Logo/,
    /alt="Logo preview"/,
];

describe("company basics ownership", () => {
    it("renders insurance, accreditations and the logo inside Company basics", () => {
        const basics = section("company-basics");
        for (const pattern of MOVED) expect(basics, String(pattern)).toMatch(pattern);
        expect(basics).toContain(">Public Liability 5M</textarea>");
        expect(basics).toMatch(/name="accreditations"[^>]*value="CITB, FMB Member"/);
    });

    it("leaves none of them in Your work & story, which keeps its own fields", () => {
        const work = section("company-work");
        for (const pattern of MOVED) expect(work, String(pattern)).not.toMatch(pattern);
        for (const name of ["specialisms", "capability_statement"]) expect(work, name).toContain(`name="${name}"`);
    });

    it("mounts each moved control once, so the saved FormData carries one value per name", () => {
        for (const name of ["insurance_details", "accreditations", "logo_url"]) {
            expect(html.match(new RegExp(`name="${name}"`, "g")), name).toHaveLength(1);
        }
        for (const id of ["company-insurance_details", "company-accreditations", "company-logo-input"]) {
            expect(html.match(new RegExp(`id="${id}"`, "g")), id).toHaveLength(1);
        }
        // The file picker posts nothing itself: only the hidden logo_url carries the logo.
        expect(html).not.toMatch(/<input[^>]*type="file"[^>]*name=/);
        expect(html.match(/type="file"/g)).toHaveLength(1);
    });

    it("keeps the required policy: only the company name is required in Company basics", () => {
        const basics = section("company-basics");
        expect(basics).toMatch(/<input[^>]*id="company-company_name"[^>]*required=""/);
        for (const pattern of [/<textarea[^>]*name="insurance_details"[^>]*>/, /<input[^>]*name="accreditations"[^>]*>/, /<input[^>]*type="file"[^>]*>/]) {
            expect(basics.match(pattern)![0]).not.toContain("required");
        }
        expect(section("company-basics").match(/<section[^>]*>/)![0]).not.toContain("hidden");
        expect(section("company-work").match(/<section[^>]*>/)![0]).toContain('hidden=""');
    });
});
