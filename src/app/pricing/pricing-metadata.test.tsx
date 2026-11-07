import FullMarketingPage from "@/components/marketing/full-pricing";
import { PhaseOnePricing } from "@/components/marketing/phase-one";
import { getLaunchProfile } from "@/lib/launch-profile";
import { describe, expect, it, vi } from "vitest";
import PricingPage, { metadata } from "./page";

vi.mock("@/components/marketing/full-pricing", () => ({
    default: function FullMarketingPage() {
        return null;
    },
}));

vi.mock("@/components/marketing/phase-one", () => ({
    PhaseOnePricing: function PhaseOnePricing() {
        return null;
    },
}));

vi.mock("@/lib/launch-profile", () => ({
    getLaunchProfile: vi.fn(),
}));

describe("actual pricing route metadata", () => {
    it("exports named Pricing | Constructa title metadata from the page module", () => {
        expect(metadata).toEqual({
            title: "Pricing | Constructa",
        });
    });

    it("keeps the existing launch-profile choice for both full and cohort", () => {
        vi.mocked(getLaunchProfile).mockReturnValue("full");
        expect(PricingPage().type).toBe(FullMarketingPage);

        vi.mocked(getLaunchProfile).mockReturnValue("cohort");
        expect(PricingPage().type).toBe(PhaseOnePricing);
    });
});
