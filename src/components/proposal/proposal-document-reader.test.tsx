import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import ProposalDocumentView from "./proposal-document-view";
import ProposalDocumentReader from "./proposal-document-reader";

const doc = buildProposalDocument(buildProposalPublicationSnapshot(representativeInput()));
const response = <h2 id="doc-response">Synthetic response preview</h2>;

describe("section-based reading pages, not PDF pagination", () => {
    it("keeps default continuous output visible and selected-page content byte-exact apart from visibility attributes", () => {
        const before = JSON.stringify(doc);
        const continuous = renderToStaticMarkup(<ProposalDocumentView doc={doc}>{response}</ProposalDocumentView>);
        const terms = renderToStaticMarkup(<ProposalDocumentView doc={doc} readingPage="terms">{response}</ProposalDocumentView>);
        expect(continuous).not.toContain(' hidden=""');
        expect(continuous).not.toContain("data-reading-page");
        expect(terms.replaceAll(' hidden=""', "").replace(' data-reading-page="terms"', "")).toBe(continuous);
        expect(terms).toMatch(/<header hidden=""/);
        expect(terms).toMatch(/data-doc-section="terms" class=/);
        expect(terms).not.toMatch(/data-doc-section="terms" hidden=/);
        expect(JSON.stringify(doc)).toBe(before);
    });

    it("derives logical reading pages from the exact supplied sections and optional response", () => {
        const before = JSON.stringify(doc);
        const html = renderToStaticMarkup(<ProposalDocumentReader doc={doc}>{response}</ProposalDocumentReader>);
        const keys = [...html.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
        expect(keys).toEqual(["cover", ...doc.sections.map(section => section.id), "response"]);
        expect(html).toContain(`Web reading page 1 of ${doc.sections.length + 2}`);
        expect(html).toContain("The PDF may use different page breaks.");
        expect(html.match(/id="doc-response"/g)).toHaveLength(1);
        expect(JSON.stringify(doc)).toBe(before);
    });

    it("does not invent a missing section or response page", () => {
        const omitted = { ...doc, sections: doc.sections.filter(section => section.id !== "programme") };
        const before = JSON.stringify(omitted);
        const html = renderToStaticMarkup(<ProposalDocumentReader doc={omitted} />);
        expect(html).not.toContain('<option value="programme"');
        expect(html).not.toContain('<option value="response"');
        expect(html).toContain(`Web reading page 1 of ${omitted.sections.length + 1}`);
        expect(JSON.stringify(omitted)).toBe(before);
    });
});
