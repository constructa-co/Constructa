import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PublicChrome from "@/components/public-chrome";
import TermsOfServicePage from "./page";

const route = vi.hoisted(() => ({ pathname: "/terms-of-service" }));
vi.mock("next/navigation", () => ({
    usePathname: () => route.pathname,
    useRouter: () => ({}),
}));

describe("platform terms of service", () => {
    beforeEach(() => {
        route.pathname = "/terms-of-service";
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("keeps approved sections and shows draft expansion with rob-confirm tokens", () => {
        const html = renderToStaticMarkup(<TermsOfServicePage />);
        expect(html).toContain("Your account and acceptable use");
        expect(html).toContain('href="/login"');
        expect(html).toMatch(/data-terms-draft-notice/);
        expect(html).toContain("Draft, not yet legally approved");
        expect(html).toContain("[ROB TO CONFIRM: legal entity name]");
        expect(html).toContain("[ROB TO CONFIRM: governing law and jurisdiction wording]");
        expect(html).not.toMatch(/\bplaceholder\b/i);
    });

    it("keeps standard wording inside #public-marketing-content like the Edge loopback check", () => {
        const markup = renderToStaticMarkup(
            <PublicChrome>
                <TermsOfServicePage />
            </PublicChrome>,
        );
        const contentStart = markup.indexOf('id="public-marketing-content"');
        expect(contentStart).toBeGreaterThan(-1);
        const withinChrome = markup.slice(contentStart);
        expect(withinChrome).toContain("Your account and acceptable use");
        expect(withinChrome).toContain('href="/login"');
        expect(withinChrome).toContain("Draft, not yet legally approved");
    });
});