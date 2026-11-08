import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsOfServicePage from "./page";

describe("terms of service placeholder page", () => {
    it("flags placeholder copy and names the technical revision for Rob sign-off", () => {
        const html = renderToStaticMarkup(<TermsOfServicePage />);
        expect(html).toContain("PLACEHOLDER");
        expect(html).toContain("Rob must review and approve");
        expect(html).toContain("platform-tos-2026-03");
        expect(html).toContain('href="/login"');
    });
});
