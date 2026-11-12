import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsOfServicePage from "./page";

describe("platform terms of service", () => {
    it("shows the standard wording and return link without a draft notice", () => {
        const html = renderToStaticMarkup(<TermsOfServicePage />);
        expect(html).not.toMatch(/placeholder/i);
        expect(html).not.toMatch(/draft for review|pending legal review/i);
        expect(html).toContain("Your account and acceptable use");
        expect(html).toContain('href="/login"');
    });
});
