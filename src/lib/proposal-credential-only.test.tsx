import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";

describe("A073 credential-only company About", () => {
    it("retains About from one saved specialisms credential with exact ordered facts and escaped render", () => {
        const snapshot = buildProposalPublicationSnapshot(representativeInput());
        snapshot.project.project_type = "Other";
        Object.assign(snapshot.contractor, {
            capability_statement: null,
            years_trading: null,
            accreditations: null,
            insurance_details: null,
            md_message: null,
            md_name: null,
            specialisms: "  Joinery, roofing!\n<repair> & pointing  ",
        });
        const before = structuredClone(snapshot);
        const doc = buildProposalDocument(snapshot);
        const about = doc.sections.find(section => section.id === "about");
        expect(about).toBeDefined();
        expect(about!.blocks).toEqual([
            {
                type: "facts",
                items: [
                    { label: "Type of work", value: "Other" },
                    { label: "Specialisms", value: snapshot.contractor.specialisms },
                ],
            },
        ]);
        expect(snapshot).toEqual(before);

        const html = renderToStaticMarkup(<ProposalDocumentView doc={doc} />);
        const aboutHtml = html.match(/<section\b[^>]*data-doc-section="about"[\s\S]*?<\/section>/)?.[0];
        expect(aboutHtml).toBeDefined();
        expect(aboutHtml).toContain("  Joinery, roofing!\n&lt;repair&gt; &amp; pointing  ");
        expect(aboutHtml).not.toMatch(/<repair\b/);
        expect(html.replace(aboutHtml!, "")).not.toMatch(/<dd\b[^>]*whitespace-pre-wrap/);
    });
});
