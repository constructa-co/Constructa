import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { COVER_RENDER_CAPTION } from "@/lib/proposal-cover-photo";
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

const input = representativeInput();

function review(project: Partial<ReviewContext["project"]> = {}) {
    const context: ReviewContext = {
        project: { ...input.project, validity_days: 30, client_email: "alex@example.test", ...project },
        profile: input.profile,
        estimate: input.estimate,
        nextVersion: 1,
    };
    return renderToStaticMarkup(createElement(ReviewSendClient, {
        context,
        caseStudies: [],
        lockReason: null,
        estimateIssue: null,
        publications: [],
        now: "2026-11-14T12:00:00Z",
    }));
}

describe("A074 proposal cover photo choice", () => {
    it("offers no cover, first site photo, and the labelled illustrative render", () => {
        const html = review();
        expect(html).toContain("Cover image");
        expect(html).toContain("No cover image");
        expect(html).toContain("First site photo");
        expect(html).toContain("Illustrative design render");
        expect(html).toContain(COVER_RENDER_CAPTION);
    });

    it("checks the illustrative option when that choice is saved on the project", () => {
        const html = review({ proposal_cover_photo: "illustrative_render" });
        expect(html).toContain('id="review-cover-photo-illustrative_render"');
        expect(html).toMatch(/<input[^>]*id="review-cover-photo-illustrative_render"[^>]*checked/);
    });
});