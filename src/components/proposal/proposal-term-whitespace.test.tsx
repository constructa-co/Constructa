import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import ProposalDocumentView from "./proposal-document-view";

const LONG_WORD = `Ref-${"X".repeat(320)}`;
const TERMS = [
    { title: "Working hours", body: "\n  Monday to Friday, 8am to 5pm.\n\nNo work on bank holidays.\n    Quiet work only after 4pm.  \n" },
    { title: "Plain", body: "One line of wording, as written." },
    { title: "Long reference", body: `Quote ${LONG_WORD} on every invoice.` },
    { title: "Escaped <b>title</b> & co", body: "<script>alert(1)</script> & \"quoted\" 'text' <img src=x onerror=alert(1)>" },
];

function render(terms = TERMS) {
    const snapshot = buildProposalPublicationSnapshot({ ...representativeInput(), resolvedTerms: terms });
    const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc: buildProposalDocument(snapshot) }));
    return { snapshot, html };
}

/** Each rendered clause: its heading as read, the body's classes, and the body markup exactly. */
function clauses(html: string) {
    const list = html.match(/<ol[^>]*data-doc-terms[^>]*>([\s\S]*?)<\/ol>/)?.[1];
    expect(list, "the terms list is rendered").toBeDefined();
    return [...list!.matchAll(/<li[^>]*><h3[^>]*>([\s\S]*?)<\/h3><p class="([^"]*)">([\s\S]*?)<\/p><\/li>/g)]
        .map(([, heading, cls, body]) => ({ heading: heading.replace(/<!-- -->/g, ""), cls, body }));
}

const unescape = (text: string) => text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("Terms in the client's web document", () => {
    it("keeps line breaks, blank lines and inner indentation of the stored wording", () => {
        const { snapshot, html } = render();
        // The stored clause is the existing publication text: trimmed at its ends only.
        expect(snapshot.terms.clauses[0].body).toBe("Monday to Friday, 8am to 5pm.\n\nNo work on bank holidays.\n    Quiet work only after 4pm.");
        const [first] = clauses(html);
        expect(first.cls.split(" ")).toContain("whitespace-pre-wrap");
        expect(unescape(first.body)).toBe(snapshot.terms.clauses[0].body);
    });

    it("renders every clause body exactly as stored, numbered in the stored order", () => {
        const { snapshot, html } = render();
        const rendered = clauses(html);
        expect(rendered).toHaveLength(snapshot.terms.clauses.length);
        rendered.forEach((clause, index) => {
            expect(unescape(clause.heading)).toBe(`${index + 1}. ${snapshot.terms.clauses[index].title}`);
            expect(unescape(clause.body)).toBe(snapshot.terms.clauses[index].body);
        });
        expect(unescape(rendered[1].body)).toBe("One line of wording, as written.");
    });

    it("lets a long unbroken word wrap: the document's overflow-wrap is inherited, not overridden", () => {
        const { html } = render();
        expect(html).toMatch(/<article[^>]*class="[^"]*\[overflow-wrap:anywhere\][^"]*"/);
        const long = clauses(html)[2];
        expect(long.body).toContain(LONG_WORD);
        expect(long.cls).not.toMatch(/whitespace-pre(?!-wrap)|nowrap|break-normal|break-keep|overflow-wrap|truncate/);
    });

    it("escapes markup in titles and wording, so nothing is injected", () => {
        const { html } = render();
        const escaped = clauses(html)[3];
        expect(escaped.body).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(escaped.body).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(escaped.heading).toContain("&lt;b&gt;title&lt;/b&gt; &amp; co");
        expect(html).not.toMatch(/<script|<img src=x|<b>title/);
    });

    it("applies the change to term wording only, leaving the other sections as they were", () => {
        const { snapshot, html } = render();
        const kept = html.match(/whitespace-pre-wrap/g) ?? [];
        expect(kept).toHaveLength(snapshot.terms.clauses.length);
    });

    it("leaves the existing standard terms reading the same", () => {
        const { snapshot, html } = render(representativeInput().resolvedTerms);
        expect(clauses(html).map((clause) => unescape(clause.body))).toEqual(snapshot.terms.clauses.map((clause) => clause.body));
    });
});
