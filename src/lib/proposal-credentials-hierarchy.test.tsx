import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { representativeInput } from "./__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { buildProposalDocument } from "./proposal-document";

describe("prominent literal saved document credentials", () => {
    it("puts exact saved credential facts before the capability narrative without mutating the snapshot", () => {
        const snapshot = buildProposalPublicationSnapshot(representativeInput());
        snapshot.project.project_type = "  Refurbishments!  ";
        snapshot.contractor.specialisms = "  Kitchens, Bathrooms\nListed work!  ";
        snapshot.contractor.accreditations = " Register A;\n(member text) ";
        snapshot.contractor.insurance_details = " Policy wording only,\ncertificate on request ";
        const before = structuredClone(snapshot);
        const doc = buildProposalDocument(snapshot);
        const about = doc.sections.find(section => section.id === "about")!;
        expect(about.blocks[0]).toEqual({
            type: "facts",
            items: [
                { label: "Type of work", value: snapshot.project.project_type },
                { label: "Years trading", value: "12" },
                { label: "Specialisms", value: snapshot.contractor.specialisms },
                { label: "Accreditations", value: snapshot.contractor.accreditations },
                { label: "Insurance", value: snapshot.contractor.insurance_details },
            ],
        });
        expect(about.blocks[1].type).toBe("paragraphs");
        expect(snapshot).toEqual(before);
    });

    it("does not manufacture an About section from a job work type when company content is absent", () => {
        const snapshot = buildProposalPublicationSnapshot(representativeInput());
        snapshot.project.project_type = "Other";
        Object.assign(snapshot.contractor, {
            capability_statement: null, years_trading: null, specialisms: null,
            accreditations: null, insurance_details: null, md_message: null, md_name: null,
        });
        expect(buildProposalDocument(snapshot).sections.some(section => section.id === "about")).toBe(false);
    });

    it("preserves multiline About facts without changing other document fact styling", () => {
        const snapshot = buildProposalPublicationSnapshot(representativeInput());
        const html = renderToStaticMarkup(<ProposalDocumentView doc={buildProposalDocument(snapshot)} />);
        const about = html.match(/<section\b[^>]*data-doc-section="about"[\s\S]*?<\/section>/)?.[0];
        expect(about).toBeDefined();
        expect(about).toMatch(/<dd\b[^>]*whitespace-pre-wrap/);
        expect(html.replace(about!, "")).not.toMatch(/<dd\b[^>]*whitespace-pre-wrap/);
    });
});
