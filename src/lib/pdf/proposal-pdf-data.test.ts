import { describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import {
    buildProposalDocument,
    publicationClientDisplayName,
    type ProposalDocument,
} from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import * as brochure from "@/lib/pdf/proposal-brochure";
import * as proposalDocument from "@/lib/proposal-document";

const { downloadProposalPdf, renderProposalBrochure } = brochure;

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

    it("names the saved client once on the cover and drops a site address mistyped as client", () => {
        const mistaken = buildProposalPublicationSnapshot({
            ...representativeInput(),
            project: {
                ...representativeInput().project,
                client_name: "SITE ONLY - Plot 9",
                site_address: "SITE ONLY - Plot 9",
                client_address: "Mrs Real Client\nBilling House",
            },
        });
        const doc = buildProposalDocument(mistaken);
        expect(publicationClientDisplayName(mistaken.project)).toBeNull();
        expect(doc.clientName).toBeNull();
        expect(pdfStrings(doc)).not.toContain("Mrs Real Client");
        expect(pdfStrings(doc)).toContain("SITE ONLY - Plot 9");
    });

    it("states a zero-VAT contract price once on the cover", () => {
        const reverse = buildProposalPublicationSnapshot({
            ...representativeInput(),
            vatRate: 0,
            vatTreatment: "domestic_reverse_charge",
        });
        expect(countSubstring(pdfStrings(buildProposalDocument(reverse)), "£7,552.05")).toBe(1);
    });

    it("states each canonical price figure once in the sent PDF", () => {
        expect(countSubstring(pdf, "£7,552.05")).toBe(1);
        expect(countSubstring(pdf, "£9,062.46")).toBe(1);
        expect(countSubstring(pdf, "£1,510.41")).toBe(1);
    });

    it("marks a pre-issue preview as draft and an issued snapshot export without the watermark", () => {
        const draft = buildProposalDocument(snapshot, { isDraft: true, draftCheckCode: "ABCD-1234" });
        const issued = buildProposalDocument(snapshot, { snapshotHash: "cd".repeat(32) });
        const draftText = pdfStrings(draft);
        const issuedText = pdfStrings(issued);
        expect(draftText).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
        expect(issuedText).not.toContain("DRAFT PREVIEW");
        expect(issued.reference).not.toBe("Draft");
        expect(countSubstring(issuedText, "£9,062.46")).toBe(1);
    });

    it("routes draft download through draft marking and issued export through the snapshot ref", async () => {
        const buildSpy = vi.spyOn(proposalDocument, "buildProposalDocument");
        vi.spyOn(brochure, "loadDocumentImages").mockResolvedValue(new Map());
        vi.spyOn(brochure, "renderProposalBrochure").mockReturnValue({
            doc: { save: vi.fn() },
            pages: 1,
            skippedImages: [],
        } as never);
        await downloadProposalPdf(snapshot, null, { checkCode: "ABCD-1234" });
        expect(buildSpy).toHaveBeenCalledWith(snapshot, { isDraft: true, draftCheckCode: "ABCD-1234" });
        buildSpy.mockClear();
        await downloadProposalPdf(snapshot, "ef".repeat(32));
        expect(buildSpy).toHaveBeenCalledWith(snapshot, { snapshotHash: "ef".repeat(32) });
        buildSpy.mockRestore();
        vi.restoreAllMocks();
    });
});