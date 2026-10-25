import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import type { ReviewContext } from "@/lib/proposal-review";
import ReviewSendClient from "./review-send-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
    getProposalPublicationAction: vi.fn(),
    publishProposalAction: vi.fn(),
    retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(),
    suggestProposalWordingAction: vi.fn(),
    uploadPhotoAction: vi.fn(),
}));
vi.mock("../schedule/simple-actions", () => ({ saveSimpleProgrammeAction: vi.fn() }));

const NOW = "2026-10-05T09:00:00.000Z";
const input = representativeInput();

function context(projectPatch: Partial<ReviewContext["project"]> = {}, profilePatch: Partial<ReviewContext["profile"]> = {}): ReviewContext {
    return {
        project: { ...input.project, validity_days: 30, client_email: "alex@example.test", ...projectPatch },
        profile: { ...input.profile, ...profilePatch },
        estimate: input.estimate,
        nextVersion: 1,
    };
}

function preparationHtml(ctx: ReviewContext) {
    return renderToStaticMarkup(createElement(ReviewSendClient, {
        context: ctx,
        caseStudies: [],
        lockReason: null,
        estimateIssue: null,
        publications: [],
        now: NOW,
    })).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

function slice(html: string, from: string, to: string) {
    return html.slice(html.indexOf(from), html.indexOf(to));
}

describe("proposal preparation credentials and work type (A073)", () => {
    it("shows saved profile credentials in review-about, not only the profile link", () => {
        const html = preparationHtml(context());
        const about = slice(html, 'id="review-about"', 'id="review-experience"');
        expect(about).toContain('data-company-credentials-summary="true"');
        expect(about).toContain("Public liability cover, certificate available on request");
        expect(about).toContain("Example Trade Register member");
        expect(about).toContain("Bathrooms, Kitchens, Tiling");
        expect(about).toMatch(/<dt[^>]*>Years trading<\/dt>\s*<dd[^>]*>12<\/dd>/);
        expect(about).toContain('href="/dashboard/settings/profile"');
        expect(about).toContain("Your logo also comes from the profile.");
        expect(about).not.toMatch(/verified|certified|compliant/i);
    });

    it("omits credential rows when profile fields are empty and keeps the profile link", () => {
        const html = preparationHtml(context({}, {
            years_trading: null,
            specialisms: "",
            accreditations: null,
            insurance_details: "   ",
        }));
        const about = slice(html, 'id="review-about"', 'id="review-experience"');
        expect(about).not.toContain("data-company-credentials-summary");
        expect(about).toContain('href="/dashboard/settings/profile"');
    });

    it("shows exact project_type on the cover summary when present, including Other", () => {
        const typed = preparationHtml(context({ project_type: "Other" }));
        const cover = slice(typed, 'id="review-cover"', 'id="review-about"');
        expect(cover).toMatch(/<dt[^>]*>Type of work<\/dt>\s*<dd[^>]*>Other<\/dd>/);
        expect(cover.match(/Type of work/g)?.length).toBe(1);

        const omitted = preparationHtml(context({ project_type: null }));
        const coverBare = slice(omitted, 'id="review-cover"', 'id="review-about"');
        expect(coverBare).not.toContain("Type of work");
    });
});
