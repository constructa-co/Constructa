import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
    getProposalPublicationAction: vi.fn(), publishProposalAction: vi.fn(), retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(), suggestProposalWordingAction: vi.fn(), uploadPhotoAction: vi.fn(),
}));
vi.mock("../schedule/simple-actions", () => ({ saveSimpleProgrammeAction: vi.fn() }));

import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildPreviewSnapshot, buildProposalPayload, draftFromProject, type ReviewContext } from "@/lib/proposal-review";
import ReviewSendClient from "./review-send-client";

const NOW = "2026-10-05T09:00:00.000Z";
function context(title = "", body = "Synthetic wording only", hidden = false): ReviewContext {
    const input = representativeInput();
    return {
        project: { ...input.project, validity_days: 30, tc_overrides: [{ clause_number: 37, title, body, hidden, custom: true }] },
        profile: input.profile, estimate: input.estimate, nextVersion: 1,
    };
}
function page(c: ReviewContext, lockReason: string | null = null) {
    return renderToStaticMarkup(<ReviewSendClient context={c} caseStudies={[]} lockReason={lockReason} estimateIssue={null} publications={[]} now={NOW} />);
}
function previewArea(html: string) {
    return html.slice(html.indexOf("data-review-preview"), html.indexOf("data-review-send") > 0 ? html.indexOf("data-review-send") : undefined);
}

describe("current draft preview diagnostics, not legal approval", () => {
    it.each(["", "   ", "\n\t"])("explains a blank title %j using the existing draft validation", title => {
        const c = context(title), draft = draftFromProject(c.project, () => "unit");
        const before = JSON.stringify(c);
        expect(buildPreviewSnapshot(c, draft, "acknowledgement", NOW)).toBeNull();
        const built = buildProposalPayload(draft);
        expect(built.ok).toBe(false);
        const html = previewArea(page(c));
        expect(html).toContain("This draft cannot be previewed.");
        expect(html).toContain("Term 1: A term needs a title and its wording, or hide it.");
        expect(html).toContain('href="#review-terms"');
        expect(html).not.toContain("once the job has a name and an estimate");
        expect(html).toContain('role="alert"');
        expect(JSON.stringify(c)).toBe(before);
    });
    it("explains missing wording without discarding the current title", () => {
        const html = page(context("UNIT TITLE", ""));
        expect(previewArea(html)).toContain("A term needs a title and its wording, or hide it.");
        expect(html).toContain("UNIT TITLE");
    });
    it("reuses the existing maximum-length error", () => {
        expect(previewArea(page(context("x".repeat(501))))).toContain("Term 1: This term is too long.");
    });
    it("does not invent a default for an explicitly empty list", () => {
        const c = context(); c.project.tc_overrides = [];
        const html = page(c);
        expect(previewArea(html)).toContain("This draft cannot be previewed.");
        expect(html).toContain("0 terms are shown to the client");
        expect(previewArea(html)).not.toContain("Term 1:");
        expect(c.project.tc_overrides).toEqual([]);
    });
    it("does not blame a hidden blank term when another term is valid", () => {
        const c = context("", "", true);
        c.project.tc_overrides!.push({ clause_number: 90, title: "UNIT VISIBLE", body: "Synthetic body", custom: true });
        expect(previewArea(page(c))).not.toContain("This draft cannot be previewed.");
        expect(page(c)).toContain("UNIT VISIBLE");
    });
    it("clears the diagnostic on a corrected draft without changing snapshot content", () => {
        expect(previewArea(page(context()))).toContain("This draft cannot be previewed.");
        const c = context("UNIT CORRECTED"), draft = draftFromProject(c.project, () => "unit");
        expect(previewArea(page(c))).not.toContain("This draft cannot be previewed.");
        expect(buildPreviewSnapshot(c, draft, "acknowledgement", NOW)!.terms.clauses[0].title).toBe("UNIT CORRECTED");
    });
    it("retains the standard terms path", () => {
        const c = context(); c.project.tc_overrides = null;
        expect(previewArea(page(c))).not.toContain("This draft cannot be previewed.");
        expect(page(c)).toContain("12 terms are shown to the client");
    });
    it("retains the existing hidden-preview policy on a locked read-only job", () => {
        const html = page(context(), "This job is locked.");
        expect(html).not.toContain("data-review-preview");
        expect(html).not.toContain("Change the terms");
        expect(html).toContain("No title yet");
    });
    it("retains the missing-estimate fallback rather than blaming terms", () => {
        const c = context(); c.estimate = null;
        const html = previewArea(page(c));
        expect(html).toContain("once the job has a name and an estimate");
        expect(html).not.toContain("This draft cannot be previewed.");
    });
    it("retains the missing-name fallback", () => {
        const c = context(); c.project.name = " ";
        expect(previewArea(page(c))).not.toContain("This draft cannot be previewed.");
    });
});
