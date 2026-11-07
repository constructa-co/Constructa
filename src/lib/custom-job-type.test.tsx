import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JOB_TYPE_EXAMPLES } from "./job-type-options";
import { PROJECT_TYPE_OPTIONS, validateBlankProjectForm, buildBlankProjectGraph, EMPTY_BLANK_PROJECT_FORM } from "./blank-project";
import { representativeInput } from "./__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { buildProposalDocument } from "./proposal-document";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";

describe("contractor-written job types", () => {
    it("shares the same eight existing examples without turning them into a taxonomy", () => {
        expect(PROJECT_TYPE_OPTIONS).toBe(JOB_TYPE_EXAMPLES);
        expect(JOB_TYPE_EXAMPLES).toEqual(["Extension", "Loft Conversion", "New Build", "Renovation", "Bathroom/Kitchen", "Roofing", "General Works", "Other"]);
    });

    it.each(["Kitchen worktop repairs", "Residential Extension", "Other", "Repairs & alterations"])("preserves %s through the existing creation graph and proposal document", projectType => {
        const parsed = validateBlankProjectForm({ ...EMPTY_BLANK_PROJECT_FORM, name: "Local job", client: "Synthetic client", projectType }, "11111111-1111-4111-8111-111111111111");
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) throw Error("Expected existing type validation to accept text");
        const graph = buildBlankProjectGraph(parsed.input);
        expect(graph.project.project_type).toBe(projectType);
        const input = representativeInput();
        input.project.project_type = graph.project.project_type;
        const snapshot = buildProposalPublicationSnapshot(input);
        expect(snapshot.project.project_type).toBe(projectType);
        const doc = buildProposalDocument(snapshot);
        expect(doc.projectType).toBe(projectType);
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
        expect(html).toContain(projectType.replace(/&/g, "&amp;"));
        const withoutType = structuredClone(input);
        withoutType.project.project_type = "Other";
        expect(snapshot.commercial).toEqual(buildProposalPublicationSnapshot(withoutType).commercial);
    });
});
