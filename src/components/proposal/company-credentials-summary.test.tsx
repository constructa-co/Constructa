import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CompanyCredentialsSummary from "./company-credentials-summary";

const styles = { body: "body-token", muted: "muted-token" };
const html = (props: Partial<Parameters<typeof CompanyCredentialsSummary>[0]> = {}) =>
    renderToStaticMarkup(createElement(CompanyCredentialsSummary, { styles, ...props }));

describe("CompanyCredentialsSummary", () => {
    it("renders nothing when no credential fields are supplied", () => {
        expect(html({})).toBe("");
        expect(html({ yearsTrading: 0, specialisms: "  ", accreditations: null, insuranceDetails: "\n" })).toBe("");
    });

    it("shows positive years trading and literal text fields with semantic labels", () => {
        const markup = html({
            yearsTrading: 12,
            specialisms: "Bathrooms, Kitchens",
            accreditations: "Register A\nRegister B",
            insuranceDetails: "Public liability cover",
        });
        expect(markup).toContain('data-company-credentials-summary="true"');
        expect(markup).toMatch(/<dt[^>]*>Years trading<\/dt>\s*<dd[^>]*>12<\/dd>/);
        expect(markup).toMatch(/<dt[^>]*>Specialisms<\/dt>\s*<dd[^>]*>Bathrooms, Kitchens<\/dd>/);
        expect(markup).toContain("Register A\nRegister B");
        expect(markup).toMatch(/<dt[^>]*>Insurance<\/dt>/);
        expect(markup).toContain("whitespace-pre-wrap");
        expect(markup).not.toMatch(/verified|certified|compliant/i);
    });

    it("renders each supplied field once", () => {
        const markup = html({ yearsTrading: 5, insuranceDetails: "Cover note" });
        expect(markup.match(/Years trading/g)?.length).toBe(1);
        expect(markup.match(/Insurance/g)?.length).toBe(1);
        expect(markup).not.toContain("Specialisms");
    });

    it("keeps the original saved credential string after a nonblank trim check", () => {
        const saved = "  Register A;\n(next line)  ";
        const markup = html({ accreditations: saved });
        const value = markup.match(/<dt[^>]*>Accreditations<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/)?.[1];
        expect(value).toBe(saved);
    });
});
