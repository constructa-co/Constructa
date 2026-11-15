import { describe, expect, it } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import {
    buildProposalDocument,
    publicationClientDisplayName,
    type ProposalDocument,
} from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { renderProposalBrochure } from "@/lib/pdf/proposal-brochure";

function pdfStrings(doc: ProposalDocument): string {
    const result = renderProposalBrochure(doc);
    const drawn: string[] = [];
    const internal = result.doc.internal as unknown as { pages: Array<string[] | undefined> };
    internal.pages.forEach((page) => (page ?? []).forEach((operation) => {
        for (const match of String(operation).matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
            drawn.push(match[1].replace(/\\([()\\])/g, "$1"));
        }
    }));
    return drawn.join("\n");
}

function countSubstring(haystack: string, needle: string): number {
    if (!needle) return 0;
    return haystack.split(needle).length - 1;
}

describe("generated proposal PDF data", () => {
    const snapshot = buildProposalPublicationSnapshot(representativeInput());
    const sentDoc = buildProposalDocument(snapshot, { snapshotHash: "ab".repeat(32) });
    const pdf = pdfStrings(sentDoc);

    it("names the saved client once on the cover, not the job title or site", () => {
        const mistaken = buildProposalPublicationSnapshot({
            ...representativeInput(),
            project: {
                ...representativeInput().project,
                client_name: representativeInput().project.name,
                site_address: "SITE ONLY - Plot 9",
                client_address: "Mrs Real Client\nBilling House",
            },
        });
        const doc = buildProposalDocument(mistaken);
        expect(publicationClientDisplayName(mistaken.project)).toBeNull();
        expect(doc.clientName).toBeNull();
        expect(pdfStrings(doc)).not.toContain(`Prepared for ${mistaken.project.name}`);
        expect(pdfStrings(doc)).not.toContain("Mrs Real Client");
        expect(pdfStrings(doc)).toContain("SITE ONLY - Plot 9");
    });

    it("states each canonical price figure once in the sent PDF", () => {
        expect(countSubstring(pdf, "£7,552.05")).toBe(1);
        expect(countSubstring(pdf, "£9,062.46")).toBe(1);
        expect(countSubstring(pdf, "£1,510.41")).toBe(1);
    });

    it("marks a draft preview and leaves the client-ready export clean", () => {
        const draft = buildProposalDocument(snapshot, { isDraft: true, draftCheckCode: "ABCD-1234" });
        const clean = buildProposalDocument(snapshot);
        const draftText = pdfStrings(draft);
        const cleanText = pdfStrings(clean);
        expect(draftText).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
        expect(cleanText).not.toContain("DRAFT PREVIEW");
        expect(countSubstring(cleanText, "£9,062.46")).toBe(1);
    });
});