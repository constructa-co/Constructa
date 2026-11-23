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
import { buildProposalPublicationSnapshot, hashProposalContent, hashProposalPublication } from "@/lib/proposal-publication";

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

describe("CON-055 suppression applies from presentation version 3 only", () => {
    type Issued = "no version" | 2;

    /** One price group under `section`, a job typed `projectType`, stored as it was issued. */
    function snapshotOf(projectType: string, section: string, issued?: Issued) {
        const input = representativeInput();
        input.project.project_type = projectType;
        input.estimate.estimate_lines = [
            { id: "l1", trade_section: section, description: "Loose items", quantity: 1, unit: "item", line_total: 250 },
        ];
        const snapshot = buildProposalPublicationSnapshot(input);
        if (issued === 2) snapshot.document_presentation_version = 2;
        if (issued === "no version") delete snapshot.document_presentation_version;
        return snapshot;
    }

    const priceGroups = (doc: ReturnType<typeof buildProposalDocument>) => {
        const price = doc.sections.find((section) => section.id === "price")!.blocks.find((block) => block.type === "price")!;
        if (price.type !== "price") throw Error("Expected a price block");
        return price.groups;
    };
    const typeOfWorkFact = (doc: ReturnType<typeof buildProposalDocument>) => {
        const facts = doc.sections.find((section) => section.id === "about")!.blocks.find((block) => block.type === "facts")!;
        if (facts.type !== "facts") throw Error("Expected a facts block");
        return facts.items.find((fact) => fact.label === "Type of work")?.value ?? null;
    };

    it("stamps every newly built snapshot, draft preview or sent, with the current version", () => {
        expect(buildProposalPublicationSnapshot(representativeInput()).document_presentation_version).toBe(6);
    });

    it.each<[Issued, string, string]>([
        ["no version", "Other", "Other work"],
        ["no version", "Other work", "Other"],
        [2, "Other", "Other work"],
        [2, "Other work", "Other"],
        [2, "other work", "OTHER WORK"],
    ])("keeps the issued type of work and price heading on a snapshot issued with %j (%s / %s)", (issued, projectType, section) => {
        const snapshot = snapshotOf(projectType, section, issued);
        const before = structuredClone(snapshot);
        const doc = buildProposalDocument(snapshot, { snapshotHash: "ab".repeat(32) });
        expect(doc.projectType).toBe(projectType);
        expect(typeOfWorkFact(doc)).toBe(projectType);
        expect(priceGroups(doc).map((group) => group.title)).toEqual([section]);
        const markup = html(doc);
        expect(markup).toContain(`>${projectType}</dd>`);
        expect(markup).toContain(`>${section}</h3>`);
        expect(snapshot).toEqual(before);
    });

    it.each<Issued>(["no version", 2])("still leaves the unnamed General group without a heading when issued with %j", (issued) => {
        expect(priceGroups(buildProposalDocument(snapshotOf("Kitchen", "General", issued))).map((group) => group.title)).toEqual([null]);
    });

    it.each<Issued>(["no version", 2])("does not start suppressing an issued %j snapshot because it is drawn as a draft", (issued) => {
        const doc = buildProposalDocument(snapshotOf("Other", "Other work", issued), { isDraft: true });
        expect(doc.projectType).toBe("Other");
        expect(priceGroups(doc).map((group) => group.title)).toEqual(["Other work"]);
    });

    it.each([
        ["Other", "Other work"],
        ["Other work", "Other"],
        ["Other", "General"],
    ])("suppresses %s / %s on a version 3 snapshot, the same in the draft preview and once sent", (projectType, section) => {
        const snapshot = snapshotOf(projectType, section);
        const before = structuredClone(snapshot);
        for (const doc of [buildProposalDocument(snapshot, { isDraft: true }), buildProposalDocument(snapshot, { snapshotHash: "ab".repeat(32) })]) {
            expect(doc.projectType).toBeNull();
            expect(typeOfWorkFact(doc)).toBeNull();
            expect(priceGroups(doc).map((group) => group.title)).toEqual([null]);
            expect(priceGroups(doc)[0].items[0].description).toBe("Loose items");
        }
        // What the contractor entered stays on the record; only the drawing leaves it out.
        expect(snapshot).toEqual(before);
        expect(snapshot.project.project_type).toBe(projectType);
        expect(snapshot.commercial.fee_items[0].trade_section).toBe(section);
    });

    it("keeps a type of work and price headings the contractor chose on a version 3 snapshot", () => {
        const chosen = buildProposalDocument(snapshotOf("Kitchen worktop repairs", "Plumbing"));
        expect(chosen.projectType).toBe("Kitchen worktop repairs");
        expect(priceGroups(chosen).map((group) => group.title)).toEqual(["Plumbing"]);

        const input = representativeInput();
        input.estimate.estimate_lines = [
            { id: "l1", trade_section: "Other work", description: "Loose items", quantity: 1, unit: "item", line_total: 250 },
            { id: "l2", trade_section: "Plumbing", description: "Second fix", quantity: 1, unit: "item", line_total: 400 },
        ];
        const several = buildProposalDocument(buildProposalPublicationSnapshot(input));
        expect(priceGroups(several).map((group) => group.title)).toEqual(["Other work", "Plumbing"]);
    });

    it("leaves the send fingerprint alone, so the version changes the drawing and nothing the client agreed", async () => {
        const current = snapshotOf("Other", "Other work");
        const issued = snapshotOf("Other", "Other work", 2);
        expect(await hashProposalContent(current)).toBe(await hashProposalContent(issued));
        expect(await hashProposalPublication(current)).toBe(await hashProposalPublication(issued));
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