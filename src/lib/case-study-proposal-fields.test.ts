import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { representativeInput } from "./__fixtures__/proposal";
import { buildProposalDocument, documentImageUrls, type DocBlock, type ProposalDocument } from "./proposal-document";
import { buildProposalPublicationSnapshot, selectCaseStudies } from "./proposal-publication";
import { renderProposalBrochure, type ImageMap } from "./pdf/proposal-brochure";

/**
 * CON-062/063/064: an optional attributed client quote, a challenge and its
 * solution kept as their own fields, and a numeric contract value with its
 * VAT basis — from the stored older case study through the snapshot into the
 * web document and the PDF. Old stored shapes must come through unchanged.
 */

const stored = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "cs-1",
    projectName: "Kitchen at 3 Sample Street",
    projectType: "",
    client: "",
    location: "",
    contractValue: "",
    programmeDuration: "",
    whatWeDelivered: "",
    valueAdded: "",
    photos: [],
    ...extra,
});

function documentWith(study: Record<string, unknown>): ProposalDocument {
    const input = representativeInput();
    return buildProposalDocument(buildProposalPublicationSnapshot({
        ...input,
        profile: { ...input.profile, case_studies: [study] as never },
        project: { ...input.project, selected_case_study_ids: ["cs-1"] as never },
    }));
}

const experienceStudy = (doc: ProposalDocument): Extract<DocBlock, { type: "caseStudy" }> => {
    const block = doc.sections.find((section) => section.id === "experience")?.blocks.find((item) => item.type === "caseStudy");
    if (!block || block.type !== "caseStudy") throw new Error("no case study block");
    return block;
};

function stubImages(doc: ProposalDocument): ImageMap {
    const data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    return new Map(documentImageUrls(doc).map((url) => [url, { data, format: "PNG" as const, width: 1200, height: 900 }]));
}

function pdfStrings(doc: ProposalDocument): string {
    const result = renderProposalBrochure(doc, stubImages(doc));
    const drawn: string[] = [];
    const internal = result.doc.internal as unknown as { pages: Array<string[] | undefined> };
    internal.pages.forEach((page) => (page ?? []).forEach((operation) => {
        for (const match of String(operation).matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
            drawn.push(match[1].replace(/\\([()\\])/g, "$1"));
        }
    }));
    return drawn.join("\n");
}

function htmlText(doc: ProposalDocument): string {
    return renderToStaticMarkup(createElement(ProposalDocumentView, { doc }))
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
        .replace(/\s+/g, " ");
}

describe("selectCaseStudies with the CON-062/063/064 fields", () => {
    it("carries a quote with attribution, separate challenge and solution, and a numeric value with its VAT basis", () => {
        const [study] = selectCaseStudies([stored({
            clientQuote: "  They kept the site tidy every single day. ",
            clientQuoteAttribution: "  Mrs Smith  ",
            challenge: "Asbestos behind the old units.",
            solution: "Licensed removal, then on as planned.",
            contractValue: "£85,000",
            contractValueAmount: 85000,
            contractValueVatBasis: "inc_vat",
        })], ["cs-1"]);
        expect(study.client_quote).toBe("They kept the site tidy every single day.");
        expect(study.client_quote_attribution).toBe("Mrs Smith");
        expect(study.challenge).toBe("Asbestos behind the old units.");
        expect(study.solution).toBe("Licensed removal, then on as planned.");
        expect(study.contract_value).toBe("£85,000");
        expect(study.contract_value_amount).toBe(85000);
        expect(study.contract_value_vat_basis).toBe("inc_vat");
    });

    it("adds none of the new keys to a study saved before they existed", () => {
        const [study] = selectCaseStudies([stored({ whatWeDelivered: "Plain old entry." })], ["cs-1"]);
        for (const key of ["client_quote", "client_quote_attribution", "challenge", "solution", "contract_value_amount", "contract_value_vat_basis"]) {
            expect(key in study).toBe(false);
        }
    });

    it("drops a value that is not a usable amount or basis, keeping the free text", () => {
        const [study] = selectCaseStudies([stored({
            contractValue: "about £85k",
            contractValueAmount: "85000",
            contractValueVatBasis: "gross",
        })], ["cs-1"]);
        expect("contract_value_amount" in study).toBe(false);
        expect("contract_value_vat_basis" in study).toBe(false);
        expect(study.contract_value).toBe("about £85k");

        const [negative] = selectCaseStudies([stored({ contractValueAmount: -5, contractValueVatBasis: "ex_vat" })], ["cs-1"]);
        expect("contract_value_amount" in negative).toBe(false);
    });

    it("drops a usable amount saved with an unknown basis, never inferring ex VAT", () => {
        // The amount is a real figure but the basis is not one of the two known
        // values: the numeric form is not carried, so no basis the contractor
        // never chose can reach a client proposal.
        const [study] = selectCaseStudies([stored({
            contractValue: "£85,000",
            contractValueAmount: 85000,
            contractValueVatBasis: "gross",
        })], ["cs-1"]);
        expect("contract_value_amount" in study).toBe(false);
        expect("contract_value_vat_basis" in study).toBe(false);
        expect(study.contract_value).toBe("£85,000");

        const [missing] = selectCaseStudies([stored({ contractValue: "", contractValueAmount: 85000 })], ["cs-1"]);
        expect("contract_value_amount" in missing).toBe(false);
    });

    it("bounds the kept fields to the existing snapshot limits", () => {
        const [study] = selectCaseStudies([stored({
            clientQuote: "q".repeat(1500),
            clientQuoteAttribution: "a".repeat(300),
            challenge: "c".repeat(6000),
            solution: "s".repeat(6000),
        })], ["cs-1"]);
        expect(study.client_quote).toHaveLength(1000);
        expect(study.client_quote_attribution).toHaveLength(200);
        expect(study.challenge).toHaveLength(5000);
        expect(study.solution).toHaveLength(5000);
    });
});

describe("proposal document with the CON-062/063/064 fields", () => {
    it("prints a numeric value with its VAT basis like the proposal's other figures", () => {
        const doc = documentWith(stored({ contractValue: "£85,000", contractValueAmount: 85000, contractValueVatBasis: "ex_vat" }));
        const facts = experienceStudy(doc).facts;
        expect(facts).toContainEqual({ label: "Value", value: "£85,000.00 ex VAT" });
    });

    it("prints an inc VAT basis and prefers the amount over free text", () => {
        const doc = documentWith(stored({ contractValue: "roughly 90k", contractValueAmount: 90000, contractValueVatBasis: "inc_vat" }));
        expect(experienceStudy(doc).facts).toContainEqual({ label: "Value", value: "£90,000.00 inc VAT" });
    });

    it("still prints old free text exactly as before", () => {
        const doc = documentWith(stored({ contractValue: "9800" }));
        expect(experienceStudy(doc).facts).toContainEqual({ label: "Value", value: "£9,800" });
        const words = documentWith(stored({ contractValue: "about £85k" }));
        expect(experienceStudy(words).facts).toContainEqual({ label: "Value", value: "about £85k" });
    });

    it("never prints ex VAT for an amount without a known basis: the free text carries it, or the figure prints alone", () => {
        // A stored amount with an unrecognised basis: the selection drops the
        // numeric form, so the client's document shows the free text.
        const doc = documentWith(stored({ contractValue: "£85,000", contractValueAmount: 85000, contractValueVatBasis: "gross" as never }));
        expect(experienceStudy(doc).facts).toContainEqual({ label: "Value", value: "£85,000" });

        // An already-issued snapshot can hold an amount with a null basis and no
        // free text: the figure still prints, with no basis words claimed.
        const input = representativeInput();
        const snapshot = buildProposalPublicationSnapshot({
            ...input,
            profile: { ...input.profile, case_studies: [stored({ contractValue: "", contractValueAmount: 85000, contractValueVatBasis: "ex_vat" })] as never },
            project: { ...input.project, selected_case_study_ids: ["cs-1"] as never },
        });
        // As a snapshot written before the basis was validated would hold it.
        snapshot.case_studies![0].contract_value_vat_basis = null;
        snapshot.case_studies![0].contract_value = null;
        const alone = buildProposalDocument(snapshot);
        expect(experienceStudy(alone).facts).toContainEqual({ label: "Value", value: "£85,000.00" });
        const pdf = pdfStrings(alone);
        expect(pdf).toContain("£85,000.00");
        expect(pdf).not.toContain("ex VAT");
    });

    it("shows the challenge and solution under their own headings, with the delivered text beside them", () => {
        const doc = documentWith(stored({
            whatWeDelivered: "Refitted the kitchen.",
            challenge: "Asbestos behind the old units.\nFound on day two.",
            solution: "Licensed removal.",
        }));
        const block = experienceStudy(doc);
        expect(block.delivered).toEqual(["Refitted the kitchen."]);
        expect(block.challenge).toEqual(["Asbestos behind the old units.", "Found on day two."]);
        expect(block.solution).toEqual(["Licensed removal."]);
        const web = htmlText(doc);
        expect(web).toContain("The challenge");
        expect(web).toContain("How we resolved it");
        const pdf = pdfStrings(doc);
        expect(pdf).toContain("THE CHALLENGE");
        expect(pdf).toContain("HOW WE RESOLVED IT");
    });

    it("shows the client quote as an attributed pull quote on the web document and the PDF", () => {
        const doc = documentWith(stored({ clientQuote: "They kept the site tidy every single day.", clientQuoteAttribution: "Mrs Smith" }));
        const block = experienceStudy(doc);
        expect(block.quote).toEqual({ paragraphs: ["They kept the site tidy every single day."], attribution: "Mrs Smith" });
        const web = htmlText(doc);
        expect(web).toContain("They kept the site tidy every single day.");
        expect(web).toContain("Mrs Smith");
        const pdf = pdfStrings(doc);
        expect(pdf).toContain("They kept the site tidy every single day.");
        expect(pdf).toContain("Mrs Smith");
    });

    it("prints a quote without an attribution, and nothing at all when no quote is saved", () => {
        const withoutAttribution = documentWith(stored({ clientQuote: "Great crew." }));
        expect(experienceStudy(withoutAttribution).quote).toEqual({ paragraphs: ["Great crew."], attribution: null });
        const none = documentWith(stored({}));
        expect(experienceStudy(none).quote).toBeUndefined();
        expect(htmlText(none)).not.toContain("data-doc-case-study-quote");
    });

    it("gives a study saved before these fields no new headings and no quote", () => {
        const doc = documentWith(stored({ whatWeDelivered: "The work as stored." }));
        const block = experienceStudy(doc);
        expect(block.challenge).toBeUndefined();
        expect(block.solution).toBeUndefined();
        expect(block.quote).toBeUndefined();
        const web = htmlText(doc);
        expect(web).not.toContain("The challenge");
        expect(web).not.toContain("How we resolved it");
        const pdf = pdfStrings(doc);
        expect(pdf).not.toContain("THE CHALLENGE");
        expect(pdf).not.toContain("HOW WE RESOLVED IT");
    });
});
