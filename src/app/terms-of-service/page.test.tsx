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

    it("shows the standard wording and return link without a draft notice", () => {
        const html = renderToStaticMarkup(<TermsOfServicePage />);
        expect(html).not.toMatch(/placeholder/i);
        expect(html).not.toMatch(/draft for review|pending legal review/i);
        expect(html).toContain("Your account and acceptable use");
        expect(html).toContain('href="/login"');
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
        expect(withinChrome).not.toMatch(/placeholder/i);
        expect(withinChrome).not.toMatch(/draft for review|pending legal review/i);
        expect(withinChrome).toContain("Your account and acceptable use");
        expect(withinChrome).toContain('href="/login"');
    });
});
