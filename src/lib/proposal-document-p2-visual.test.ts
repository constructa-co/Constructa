import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import {
    buildProposalDocument,
    feeSectionTitle,
    publicationProjectTypeDisplay,
} from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";

const html = (doc: ReturnType<typeof buildProposalDocument>) =>
    renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));

describe("CON-055 misleading Other work label", () => {
    it("hides unspecified and Other work fee group titles", () => {
        expect(publicationProjectTypeDisplay("Other")).toBeNull();
        expect(publicationProjectTypeDisplay("Other work")).toBeNull();
        expect(publicationProjectTypeDisplay("Kitchen")).toBe("Kitchen");
        expect(feeSectionTitle("General")).toBeNull();
        expect(feeSectionTitle("Other work")).toBeNull();
        expect(feeSectionTitle("Plumbing")).toBe("Plumbing");
    });

    it("leaves price lines visible without an Other work group heading", () => {
        const input = representativeInput();
        input.estimate.estimate_lines = [
            { id: "l1", trade_section: "Other work", description: "Loose items", quantity: 1, unit: "item", line_total: 250 },
        ];
        const doc = buildProposalDocument(buildProposalPublicationSnapshot(input));
        const price = doc.sections.find((section) => section.id === "price")!.blocks.find((block) => block.type === "price")!;
        expect(price.type).toBe("price");
        if (price.type !== "price") return;
        expect(price.groups).toHaveLength(1);
        expect(price.groups[0].title).toBeNull();
        expect(price.groups[0].items[0].description).toBe("Loose items");
        expect(html(doc)).not.toContain("OTHER WORK");
    });
});

describe("CON-057 headings with content", () => {
    it("marks section and subheadings to stay with the following content in web layout", () => {
        const markup = html(buildProposalDocument(buildProposalPublicationSnapshot(representativeInput())));
        expect(markup).toContain('break-after-avoid');
        expect(markup.match(/break-after-avoid/g)?.length).toBeGreaterThan(3);
    });
});

describe("CON-060 paginated cover logo sizing", () => {
    it("tags the cover logo for paginated height constraints", () => {
        const input = representativeInput();
        input.profile.logo_url = "https://images.example.test/logo.png";
        const markup = html(buildProposalDocument(buildProposalPublicationSnapshot(input)));
        expect(markup).toContain("data-cover-logo");
    });
});