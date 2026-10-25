import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPolicyPage from "./page";

// A024: the public privacy page says only what is known, names the kinds of
// information people can ask about, and says plainly that the notice is not
// yet complete. It makes no new claim about sharing, security or legal basis.
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
        expect(links).toHaveLength(1);
        expect(links[0]).toContain('href="mailto:hello@constructa.co"');
        expect(links[0]).toContain(">hello@constructa.co</a>");
        expect(text).toContain(
            "You can contact us at hello@constructa.co to request access to, correction of, or deletion of your data, or to ask how personal, company, tax, pricing or salary information is handled.",
        );
    });

    it("says the notice is incomplete and needs completing and reviewing before it is relied on", () => {
        const note = html.match(/<p [^>]*data-privacy-review-note[^>]*>([^<]*)<\/p>/);
        expect(note).not.toBeNull();
        expect(note![1].replace(/\s+/g, " ").trim()).toBe(
            "This notice is incomplete. It does not yet explain who is responsible for your information, the legal basis for using it, who it is shared with, where it is stored, how long it is kept or how it is protected. It needs to be completed and reviewed before it can be relied on as a full account of how information is handled. Until then, please ask us using the address below.",
        );
        // The March 2026 notice is not presented as the current, complete version.
        expect(text).toContain("Previous version dated March 2026.");
        expect(text).not.toContain("Last updated: March 2026");
    });

    it("keeps the page structure and the facts it already stated", () => {
        expect(html).toMatch(/^<main[^>]*><div[^>]*><h1[^>]*>Privacy Policy<\/h1>/);
        expect(text).toContain("When you sign up for updates or use our platform, we hold the details you give us, such as your name, email address and company details.");
        expect(html.match(/<p /g)).toHaveLength(5);
    });
});
