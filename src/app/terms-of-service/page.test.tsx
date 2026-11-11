import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsOfServicePage from "./page";

describe("terms of service review page", () => {
    it("shows substantive wording, review status and the return link", () => {
        const html = renderToStaticMarkup(<TermsOfServicePage />);
        expect(html).not.toMatch(/placeholder/i);
        expect(html).toContain("Draft for review.");
        expect(html).toContain("pending legal review and final approval");
        expect(html).toContain("Your account and acceptable use");
        expect(html).toContain('href="/login"');
    });
});
