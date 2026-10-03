/**
 * Truthful proposal content.
 *
 * The proposal PDF must only state facts the contractor has saved. These
 * tests render the real section builders into a real jsPDF document and
 * read back every string drawn, so an invented stat or fixed promise
 * cannot return unnoticed. Synthetic data only.
 */

import jsPDF from "jspdf";
import { describe, expect, it } from "vitest";
import { getPdfTheme } from "@/lib/pdf/pdf-theme";
import { renderAboutUs } from "./about-us";
import { renderClosing } from "./closing";
import { renderScopeAndPhotos } from "./scope-and-photos";
import { type ProposalContext, resetSectionCounter } from "./helpers";

/** Strings the PDF used to print without any saved fact behind them. */
const INVENTED_CLAIMS = [
    "10+",
    "50+",
    "YEARS EXPERIENCE",
    "PROJECTS DELIVERED",
    "QUALITY ASSURED",
    "OUR COMMITMENT TO YOU",
    "Transparent Pricing",
    "margins explained on request",
    "Clear Communication",
    "weekly written updates",
    "Programme Certainty",
    "resource-loaded programme",
    "Quality Without Compromise",
    "accredited trades",
    "snag-free",
    "O&M package",
    "Fully insured",
    "Contractors All Risk",
    "years of experience in the construction industry",
    "Experienced in",
    "Dedicated project management",
    "no hidden costs",
    "All works warranted",
    "Defect Liability Period",
    "We are confident our expertise",
    "outstanding result",
    "highest standard",
    "on time and within budget",
    "carefully reviewed your requirements",
];

function render(
    section: (ctx: ProposalContext) => unknown,
    profile: Record<string, unknown>,
    project: Record<string, unknown> = {},
): string {
    resetSectionCounter();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const drawn: string[] = [];
    const originalText = doc.text.bind(doc) as (...args: unknown[]) => jsPDF;
    (doc as unknown as { text: (...args: unknown[]) => jsPDF }).text = (text, ...rest) => {
        drawn.push(...(Array.isArray(text) ? text.map(String) : [String(text)]));
        return originalText(text, ...rest);
    };

    const today = new Date("2026-10-01T00:00:00.000Z");
    const ctx: ProposalContext = {
        doc,
        T: getPdfTheme(undefined),
        companyName: String(profile.company_name ?? "The Contractor"),
        clientName: "Alex Client",
        projectName: "Example Extension",
        address: "1 Example Road",
        clientAddress: "1 Example Road",
        projectType: "Extension",
        docTitle: "Proposal — Example Extension",
        refCode: "22222222",
        today,
        validUntil: new Date(today.getTime() + 30 * 86400000),
        validityDays: 30,
        pricingMode: "full",
        displayTotal: 12000,
        contractValue: 12000,
        totalPagesRef: { n: 1 },
        profile,
        project: { name: "Example Extension", client_name: "Alex Client", project_type: "Extension", ...project },
        pdfEstimates: [],
        computeContractSum: () => ({ contractSum: 12000 }),
        scopeBullets: [],
    };
    section(ctx);
    return drawn.join("\n");
}

function expectNoInventedClaims(text: string) {
    for (const claim of INVENTED_CLAIMS) {
        expect(text, `PDF must not contain "${claim}"`).not.toContain(claim);
    }
}

const sparseProfile = {
    company_name: "Example Plumbing",
    capability_statement: "We fit bathrooms and heating systems for homeowners.",
};

const fullProfile = {
    company_name: "Example Builder Ltd",
    capability_statement: "We build extensions and loft conversions.",
    specialisms: "Extensions, Loft conversions",
    years_trading: 7,
    phone: "01632 960000",
    website: "example-builder.test",
    address: "2 Sample Yard, Exampleton",
    company_number: "00000000",
    vat_number: "GB000000000",
    accreditations: "Example Trade Scheme, Sample Safety Card",
    insurance_details: "Public liability 2m with Example Insurer",
    md_message: "I look after every job myself.",
    md_name: "Sam Example",
};

describe("About Us renders only saved facts", () => {
    it("prints no invented stats or commitments for a sparse profile", () => {
        const text = render(renderAboutUs, sparseProfile);
        expect(text).toContain("About Example Plumbing");
        expect(text).toContain("We fit bathrooms and heating systems for homeowners.");
        expectNoInventedClaims(text);
        // Nothing beyond the heading, the statement and the page furniture.
        expect(text).not.toMatch(/years/i);
        expect(text).not.toContain("Accreditations");
        expect(text).not.toContain("Specialisms");
    });

    it("prints no invented stats or commitments for a full profile", () => {
        expectNoInventedClaims(render(renderAboutUs, fullProfile));
    });

    it("still renders every supplied fact", () => {
        const text = render(renderAboutUs, fullProfile);
        for (const fact of [
            "About Example Builder Ltd",
            "We build extensions and loft conversions.",
            "Extensions",
            "Loft conversions",
            "Est. 7 years trading",
            "01632 960000",
            "example-builder.test",
            "2 Sample Yard",
            "Exampleton",
            "00000000",
            "GB000000000",
            "Example Trade Scheme",
            "Sample Safety Card",
            "I look after every job myself.",
        ]) {
            expect(text, `expected saved fact "${fact}"`).toContain(fact);
        }
        expect(text).toContain("Sam Example");
    });

    it("uses the per-proposal About Us override when one is saved", () => {
        const text = render(renderAboutUs, sparseProfile, { proposal_capability: "Bathroom refits for this street." });
        expect(text).toContain("Bathroom refits for this street.");
        expect(text).not.toContain("We fit bathrooms and heating systems for homeowners.");
    });

    it("renders nothing at all without a capability statement", () => {
        expect(render(renderAboutUs, { company_name: "Example Plumbing" })).toBe("");
    });
});

describe("Closing page renders only saved facts", () => {
    it("falls back to a plain thank-you with no claims for a sparse profile", () => {
        const text = render(renderClosing, sparseProfile);
        expect(text).toContain("Thank you for considering Example Plumbing for this project.");
        expectNoInventedClaims(text);
        expect(text).not.toContain("Insurance:");
        expect(text).not.toContain("Accreditation:");
    });

    it("states saved facts as saved, without embellishment", () => {
        const text = render(renderClosing, fullProfile, { closing_statement: "Thanks for asking us to price this." });
        expectNoInventedClaims(text);
        expect(text).toContain("7 years trading");
        expect(text).toContain("Accreditation: Example Trade Scheme");
        expect(text).toContain("Accreditation: Sample Safety Card");
        expect(text).toContain("Insurance: Public liability 2m with Example Insurer");
        expect(text).toContain("Specialisms: Extensions, Loft conversions");
        expect(text).toContain("Thanks for asking us to price this.");
        expect(text).not.toContain("Thank you for considering");
    });
});

describe("Introduction fallback makes no promises", () => {
    it("uses neutral wording when no introduction is saved", () => {
        const text = render(renderScopeAndPhotos, sparseProfile).replace(/\s+/g, " ");
        expect(text).toContain("Thank you for the opportunity to submit this Proposal for Example Extension");
        expectNoInventedClaims(text);
    });

    it("prints the contractor's own introduction when saved", () => {
        const text = render(renderScopeAndPhotos, sparseProfile, { proposal_introduction: "Thanks for showing me round on Tuesday." })
            .replace(/\s+/g, " ");
        expect(text).toContain("Thanks for showing me round on Tuesday.");
        expect(text).not.toContain("Thank you for the opportunity");
    });
});
