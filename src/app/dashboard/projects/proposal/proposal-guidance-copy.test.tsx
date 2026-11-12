import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
    getProposalPublicationAction: vi.fn(),
    publishProposalAction: vi.fn(),
    retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(),
    suggestProposalWordingAction: vi.fn(),
    uploadPhotoAction: vi.fn(),
}));

import { representativeInput } from "@/lib/__fixtures__/proposal";
import { draftFromProject, reviewReadiness, type ReviewContext } from "@/lib/proposal-review";
import ProposalWorkspaceHeading from "@/components/proposal-workspace-heading";
import ReviewSendClient, { type ReviewServer } from "./review-send-client";

const input = representativeInput();
const LOCK = "This proposal has been accepted. Record later scope or price changes as variations.";
const NOTE = "None of these is needed to send. Add the ones that suit this job: site photos and a relevant past job can help your client picture the work. Anything you have already chosen, such as a past job, still has to pass the Needed checks above.";

function context(patch: Partial<ReviewContext["project"]> = {}): ReviewContext {
    return {
        project: { ...input.project, validity_days: 30, client_email: "alex@example.test", ...patch },
        profile: input.profile,
        estimate: input.estimate,
        nextVersion: 1,
    };
}
function server() {
    return { save: vi.fn(), ask: vi.fn(), publish: vi.fn(), retry: vi.fn(), upload: vi.fn(), loadPublication: vi.fn() };
}
function review(ctx: ReviewContext, lockReason: string | null = null, api = server()) {
    const markup = renderToStaticMarkup(createElement(ReviewSendClient, {
        context: ctx, caseStudies: [], lockReason, estimateIssue: null, publications: [], server: api as unknown as ReviewServer, now: "2026-10-05T09:00:00.000Z",
    }));
    return markup.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/<!-- -->/g, "");
}
const readinessOf = (ctx: ReviewContext) => reviewReadiness(ctx, draftFromProject(ctx.project, () => "k"));
const h1 = (markup: string) => markup.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) ?? [];
const GAPS = { programme_phases: [], scope_text: "", proposal_introduction: "", closing_statement: "" };

describe("proposal-focused heading", () => {
    it.each([[null, "Saving a draft and sending it are separate actions. Check the preview before you send."], [LOCK, "This proposal is read-only. Review the details and any previously sent versions below."]] as const)(
        "lock %s: the workspace h1 is Your proposal, with the project, client and the existing guide", (lock, guide) => {
            const markup = review(context(), lock);
            // The workspace heading is the page's first h1; the preview document below has its own title.
            expect(h1(markup)[0]).toMatch(/>Your proposal<\/h1>$/);
            expect(h1(markup).filter((heading) => heading.endsWith(">Your proposal</h1>"))).toHaveLength(1);
            expect(markup).not.toContain(">Review and send</h1>");
            expect(markup).toContain("From your draft to your client");
            expect(markup).toContain(`${input.project.name} for ${input.project.client_name}`);
            expect(markup).toContain(guide);
        },
    );

    it("keeps the heading's classes, data and children slot", () => {
        const classes = { header: "h-cls", eyebrow: "e-cls", title: "t-cls", project: "p-cls", guide: "g-cls" };
        const markup = renderToStaticMarkup(createElement(ProposalWorkspaceHeading, { projectName: "Job", clientName: null, locked: false, isDark: true, classes }, createElement("span", { "data-child": "" }, "child"))).replace(/<!-- -->/g, "");
        expect(markup).toBe('<header class="h-cls" data-dark="true"><div><p class="e-cls">From your draft to your client</p><h1 class="t-cls">Your proposal</h1><p class="p-cls">Job</p><p class="g-cls">Saving a draft and sending it are separate actions. Check the preview before you send.</p></div><span data-child="">child</span></header>');
    });
});

describe("optional additions guidance", () => {
    it("heads the optional list as optional, explains it once, and keeps every item, fix and link", () => {
        const ctx = context(GAPS);
        const markup = review(ctx);
        const readiness = readinessOf(ctx);
        const optional = readiness.recommended.filter((item) => !item.ok);
        expect(optional.length).toBeGreaterThan(0);

        expect(markup).not.toContain("Would improve it. You can send without these.");
        const block = markup.match(/<h3[^>]*>Optional additions to consider<\/h3><p class="([^"]*)" data-recommended-note="true">([\s\S]*?)<\/p><ul class="mt-2 space-y-2">([\s\S]*?)<\/ul>/);
        expect(block, "heading, note and list sit together in that order").not.toBeNull();
        expect(block![1]).toContain("mt-1 text-sm");
        expect(block![2]).toBe(NOTE);
        expect(markup.match(/data-recommended-note/g)).toHaveLength(1);

        const keys = [...block![3].matchAll(/data-recommended-item="([^"]+)"/g)].map((m) => m[1]);
        expect(keys).toEqual(optional.map((item) => item.key));
        for (const item of optional) expect(block![3]).toContain(item.fix);
        expect(block![3]).toContain('href="#review-closing"');
        expect(block![3]).toContain("Go to the closing message");
    });

    it("leaves what is Needed and the send gate exactly as readiness says", () => {
        const ctx = context(GAPS);
        const markup = review(ctx);
        const readiness = readinessOf(ctx);
        expect(readiness.ready).toBe(false);
        expect(markup).toContain('data-readiness="not-ready"');
        expect(markup).toContain(`${readiness.missing.length} things are needed before you can send`);
        for (const item of readiness.mandatory) expect(markup).toContain(`data-readiness-item="${item.key}" data-ok="${item.ok}"`);
        expect(markup).toContain('data-send-block="not-ready"');
        expect(markup.match(/<input[^>]*data-send-confirm[^>]*>/)![0]).toContain('disabled=""');
    });

    it("shows the note only when an optional item is open, and never in the locked view", () => {
        const ready = context();
        const markup = review(ready);
        const open = readinessOf(ready).recommended.some((item) => !item.ok);
        expect(markup.includes("data-recommended-note")).toBe(open);
        expect(markup.includes("Optional additions to consider")).toBe(open);
        const locked = review(context(GAPS), LOCK);
        expect(locked).not.toContain("data-recommended-note");
        expect(locked).not.toContain("Optional additions to consider");
    });

    it("rendering writes nothing and leaves the saved project and draft as they were", () => {
        for (const lock of [null, LOCK]) {
            const ctx = context(GAPS);
            const before = JSON.stringify(ctx);
            const draft = JSON.stringify(draftFromProject(ctx.project, () => "k"));
            const api = server();
            review(ctx, lock, api);
            for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
            expect(JSON.stringify(ctx)).toBe(before);
            expect(JSON.stringify(draftFromProject(ctx.project, () => "k"))).toBe(draft);
        }
    });
});
