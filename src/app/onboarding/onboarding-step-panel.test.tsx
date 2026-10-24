import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FirstSessionPanel } from "@/components/first-session-frame";
import OnboardingClient from "./onboarding-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ saveSetupStepAction: vi.fn() }));

const baseProps = {
    initialBusinessType: "Kitchen fitting",
    initialCompanyName: "Example Local Builders",
    initialFullName: "Local Builder",
    completionPath: "/dashboard",
    exitPath: "/dashboard",
};

function aside(html: string) {
    return html.slice(html.indexOf("<aside"));
}

describe("setup step-specific right panel (A009)", () => {
    it("keeps the account introduction four-row structure when step is 0", () => {
        const html = renderToStaticMarkup(
            <FirstSessionPanel step={0}><p>Form</p></FirstSessionPanel>,
        );
        expect(html).toContain("Your work deserves<br/>a better introduction.");
        const panel = aside(html);
        expect(panel.match(/<li\b/g)).toHaveLength(4);
        for (const title of ["Your company", "Your work", "Your price", "Your proposal"]) {
            expect(panel).toContain(`<strong>${title}</strong>`);
        }
    });

    it("renders distinct trade and company setup panel copy from OnboardingClient", () => {
        const tradeHtml = renderToStaticMarkup(createElement(OnboardingClient, {
            ...baseProps,
            initialStep: "trade",
        }));
        const companyHtml = renderToStaticMarkup(createElement(OnboardingClient, {
            ...baseProps,
            initialStep: "business",
        }));

        const tradeAside = aside(tradeHtml);
        const companyAside = aside(companyHtml);

        expect(tradeAside).toContain("Built around<br/>the work you do.");
        expect(tradeAside).toContain("<strong>Your business</strong>");
        expect(tradeAside).not.toContain("Make it feel like<br/>your business.");

        expect(companyAside).toContain("Make it feel like<br/>your business.");
        expect(companyAside).toContain("The essentials, in place");
        expect(companyAside).toContain("<strong>Your trading name</strong>");
        expect(companyAside).toContain("The description you already gave stays with your profile.");
        expect(companyAside).not.toContain("Built around<br/>the work you do.");

        expect(tradeAside.match(/<li\b/g)).toHaveLength(4);
        expect(companyAside.match(/<li\b/g)).toHaveLength(4);
        expect(tradeHtml).toContain("What kind of work do you do?");
        expect(companyHtml).toContain("Business or trading name");
    });
});
