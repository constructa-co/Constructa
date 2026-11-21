import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPolicyPage from "./page";

const html = renderToStaticMarkup(<PrivacyPolicyPage />);
const text = html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("privacy information", () => {
    it("no longer makes the unsupported absolute claims", () => {
        for (const claim of [
            "We collect only the data necessary",
            "never sold",
            "shared with third parties without your consent",
            "industry-standard security measures",
        ]) expect(text, claim).not.toContain(claim);
    });

    it("keeps the contact address as a mail link and names the information people can ask about", () => {
        const links = html.match(/<a [^>]*>[^<]*<\/a>/g) ?? [];
        expect(links.some((link) => link.includes('href="mailto:hello@constructa.co"'))).toBe(true);
        expect(text).toContain(
            "You can contact us at hello@constructa.co to request access to, correction of, or deletion of your information",
        );
    });

    it("shows the draft status banner and UK SaaS sections with rob-confirm tokens", () => {
        expect(text).toContain("Draft, not yet legally approved");
        expect(html).toMatch(/data-privacy-draft-notice/);
        expect(html).toMatch(/data-privacy-controller/);
        expect(text).toContain("[ROB TO CONFIRM: legal entity name]");
        expect(text).toContain("[ROB TO CONFIRM: registered office address]");
        expect(text).toContain(
            "This site can include Vercel Web Analytics. When it is on, it counts visits to public pages for signed-out visitors.",
        );
        expect(text).toContain("If you submit the updates form on this site, your email address is sent to Kit (ConvertKit)");
    });

    it("does not present compliance certification", () => {
        expect(text).toContain("not presented as compliance certification");
        expect(text).not.toMatch(/\bGDPR compliant\b/i);
        expect(text).not.toMatch(/\bISO\s*27001\b/i);
    });

    it("keeps the March 2026 prior-version note", () => {
        expect(text).toContain("Previous version dated March 2026.");
        expect(text).not.toContain("Last updated: March 2026");
    });
});