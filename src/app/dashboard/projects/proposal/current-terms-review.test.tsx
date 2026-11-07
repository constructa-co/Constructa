import { createElement, type ReactElement } from "react";
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
import { STANDARD_PROPOSAL_TERMS, type ProposalTermsClause } from "@/lib/proposal-terms";
import { workspaceStyles } from "@/lib/workspace-styles";
import type { ReviewContext } from "@/lib/proposal-review";
import type { ReviewServer } from "./review-send-client";
import CurrentTermsReview from "@/components/proposal/current-terms-review";
import ReviewSendClient from "./review-send-client";

const input = representativeInput();
const LOCK = "This proposal has been accepted. Record later scope or price changes as variations.";

function server(): ReviewServer {
    return { save: vi.fn(), ask: vi.fn(), publish: vi.fn(), retry: vi.fn(), upload: vi.fn(), loadPublication: vi.fn() } as unknown as ReviewServer;
}

function context(tc_overrides: ProposalTermsClause[] | null | undefined): ReviewContext {
    return {
        project: { ...input.project, validity_days: 30, client_email: "alex@example.test", tc_overrides },
        profile: input.profile,
        estimate: input.estimate,
        nextVersion: 1,
    };
}

const decode = (html: string) => html
    .replace(/<!-- -->/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function review(tc_overrides: ProposalTermsClause[] | null | undefined, lockReason: string | null = null, api = server()) {
    return decode(renderToStaticMarkup(createElement(ReviewSendClient, {
        context: context(tc_overrides), caseStudies: [], lockReason, estimateIssue: null, publications: [], server: api, now: "2026-10-05T09:00:00.000Z",
    })));
}

/** The viewer's markup, and each listed term as the reader sees it. */
function viewer(html: string) {
    const block = html.match(/<details[^>]*data-current-terms[^>]*>[\s\S]*?<\/details>/)?.[0];
    expect(block, "the terms viewer is on the page").toBeDefined();
    const items = [...block!.matchAll(/<li[^>]*data-current-term[^>]*><h3[^>]*>([\s\S]*?)<\/h3><p[^>]*>([\s\S]*?)<\/p><\/li>/g)]
        .map(([, heading, body]) => ({ heading: heading.replace(/<[^>]+>/g, ""), body }));
    return { block: block!, items };
}

const visible = (rows: ProposalTermsClause[]) => rows.filter((row) => !row.hidden);

describe("current terms viewer in Review and Send", () => {
    it.each([["null", null], ["undefined", undefined]] as const)("%s overrides: lists the existing standard terms exactly, in order", (_label, overrides) => {
        const { items, block } = viewer(review(overrides));
        expect(block).toContain(`Read the terms in full (${STANDARD_PROPOSAL_TERMS.length})`);
        expect(items).toEqual(STANDARD_PROPOSAL_TERMS.map((clause, index) => ({ heading: `${index + 1}. ${clause.title}`, body: clause.body })));
    });

    it("an explicitly empty set stays empty and is never filled with the standard terms", () => {
        const { block, items } = viewer(review([]));
        expect(items).toEqual([]);
        expect(block).toContain("Read the terms in full (0)");
        expect(block).toContain("No terms are shown to the client.");
        for (const clause of STANDARD_PROPOSAL_TERMS) expect(block).not.toContain(clause.body);
    });

    it("an all-hidden set stays empty and shows none of the hidden wording", () => {
        const allHidden = STANDARD_PROPOSAL_TERMS.map((clause) => ({ ...clause, hidden: true }));
        const { block, items } = viewer(review(allHidden));
        expect(items).toEqual([]);
        expect(block).toContain("No terms are shown to the client.");
        for (const clause of STANDARD_PROPOSAL_TERMS) expect(block).not.toContain(clause.body);
    });

    it("keeps saved order, numbers only shown terms, excludes hidden ones, and keeps inner whitespace", () => {
        const rows: ProposalTermsClause[] = [
            { clause_number: 3, title: "Alternative Dispute Resolution", body: STANDARD_PROPOSAL_TERMS[2].body },
            { clause_number: 1, title: "Jurisdiction", body: "Hidden unit wording that must not show.", hidden: true },
            { clause_number: 13, title: "  Site hours  ", body: "\n  Line one.\n\n    Line two, indented.  \n", custom: true },
            { clause_number: 7, title: "Payments", body: STANDARD_PROPOSAL_TERMS[6].body },
        ];
        const { block, items } = viewer(review(rows));
        expect(items).toEqual([
            { heading: "1. Alternative Dispute Resolution", body: STANDARD_PROPOSAL_TERMS[2].body },
            { heading: "2. Site hours", body: "Line one.\n\n    Line two, indented." },
            { heading: "3. Payments", body: STANDARD_PROPOSAL_TERMS[6].body },
        ]);
        expect(items).toHaveLength(visible(rows).length);
        expect(block).not.toContain("Hidden unit wording");
        expect(block).toContain("whitespace-pre-wrap");
    });

    it("says this is the current proposal wording, not a legal check or a confirmed original", () => {
        const { block } = viewer(review(null));
        expect(block).toContain("The wording in this proposal now, including any changes not saved yet.");
        expect(block).toContain("It is not a legal check of the terms or a confirmed original version of them.");
    });

    it("is readable when locked, without the editor or any control that could change the terms", () => {
        const html = review(null, LOCK);
        expect(html).toContain("data-review-locked");
        expect(html).toMatch(/<fieldset disabled=""/);
        const { block, items } = viewer(html);
        expect(items).toHaveLength(STANDARD_PROPOSAL_TERMS.length);
        expect(block).not.toMatch(/<(button|input|textarea|select)\b/);
        expect(block).not.toMatch(/\bdisabled\b/);
        expect(html).not.toContain("Change the terms");
        expect(html).not.toContain('id="review-terms-editor"');
    });

    it("stays separate from the existing Change the terms editor, which is unchanged and closed", () => {
        const html = review(null);
        const { block } = viewer(html);
        expect(block).not.toMatch(/<(button|input|textarea|select)\b/);
        expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="review-terms-editor"[^>]*>Change the terms<\/button>/);
        expect(html).not.toContain('id="review-terms-editor"');
        expect(html.indexOf("data-current-terms")).toBeLessThan(html.indexOf("Change the terms"));
    });

    it("rendering in either state calls no save, send, upload, wording or load action", () => {
        for (const lock of [null, LOCK]) {
            const api = server();
            review([{ clause_number: 1, title: "Custom", body: "Custom wording.", custom: true }], lock, api);
            for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
        }
    });
});

describe("CurrentTermsReview component", () => {
    const s = workspaceStyles(false);
    type Node = ReactElement<Record<string, unknown>>;
    function nodes(value: unknown): Node[] {
        if (Array.isArray(value)) return value.flatMap(nodes);
        if (!value || typeof value !== "object" || !("props" in value)) return [];
        const e = value as Node; return [e, ...nodes(e.props.children)];
    }

    it("has no handler of its own: opening and closing is the browser's disclosure and writes nothing", () => {
        const tree = nodes(CurrentTermsReview({ terms: STANDARD_PROPOSAL_TERMS, styles: s }));
        expect(tree[0].type).toBe("details");
        expect(tree[0].props.open).toBeUndefined();
        for (const node of tree) {
            expect(Object.keys(node.props).filter((key) => /^on[A-Z]/.test(key))).toEqual([]);
        }
    });

    it("never lists a hidden term even if one is passed in", () => {
        const html = decode(renderToStaticMarkup(createElement(CurrentTermsReview, {
            terms: [{ title: "Shown", body: "Shown wording." }, { title: "Secret", body: "Hidden wording.", hidden: true }],
            styles: s,
        })));
        expect(html).toContain("1. Shown");
        expect(html).not.toContain("Secret");
        expect(html).not.toContain("Hidden wording.");
        expect(html).toContain("Read the terms in full (1)");
    });

    it("marks a shown term that has no title or wording yet instead of inventing any", () => {
        const html = decode(renderToStaticMarkup(createElement(CurrentTermsReview, { terms: [{ title: "  ", body: "" }], styles: s })));
        expect(html).toContain("No title yet");
        expect(html).toContain("No wording yet.");
    });
});
