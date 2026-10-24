import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readProgrammeInclusion, withProgrammeInclusion } from "./programme-inclusion";
import { computeProgrammePlan, resolveProgrammeSource } from "./programme-plan";
import { evaluateProposalReadiness } from "./proposal-readiness";
import { buildProposalPublicationSnapshot, canonicalProposalPublicationJson } from "./proposal-publication";
import { buildProposalDocument } from "./proposal-document";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { representativeInput } from "./__fixtures__/proposal";
import { renderProposalBrochure } from "./pdf/proposal-brochure";

const saved = [{ name: "Keep this exact stage", manualDays: 5, startOffset: 0, color: "emerald", dependsOn: [], manhours: 12 }];
describe("explicit programme inclusion", () => {
    it("defaults to include; missing or invalid programmes never count as deliberate omission", () => {
        expect(readProgrammeInclusion(null).intent).toBe("include");
        expect(readProgrammeInclusion([]).intent).toBe("include");
        for (const phases of [[], [{ name: "Invalid", manualDays: 0 }]]) {
            expect(evaluateProposalReadiness({ programmePhases: phases }).mandatory.find(i => i.key === "programme")?.ok).toBe(false);
        }
    });
    it("retains every saved field and restores it exactly without mutating the source", () => {
        const old = JSON.stringify(saved);
        const omitted = withProgrammeInclusion(saved, false);
        expect(omitted.slice(0, -1)).toEqual(saved);
        expect(readProgrammeInclusion(omitted)).toMatchObject({ intent: "omit", phases: saved });
        expect(withProgrammeInclusion(omitted, true)).toEqual(saved);
        expect(JSON.stringify(saved)).toBe(old);
    });
    it.each([
        [{ programmeIntent: "omit" }],
        [{ programmeIntent: "omit", intent_version: 2 }],
        [{ programmeIntent: "omit", intent_version: 1, name: "Not metadata" }],
        [{ programmeIntent: "omit", intent_version: 1 }, ...saved],
        [{ programmeIntent: "omit", intent_version: 1 }, { programmeIntent: "omit", intent_version: 1 }],
    ])("rejects ambiguous/malformed omission metadata %#", (...phases) => {
        expect(readProgrammeInclusion(phases).intent).toBe("invalid");
        expect(evaluateProposalReadiness({ programmePhases: phases, projectStartDate: "2026-10-19" }).mandatory.find(i => i.key === "programme")?.ok).toBe(false);
    });
    it("blocks legacy date readers and timeline fallback for a deliberately omitted programme", () => {
        const omitted = withProgrammeInclusion(saved, false);
        expect(computeProgrammePlan("2026-10-19", omitted)).toBeNull();
        expect(resolveProgrammeSource({ programme_phases: omitted, gantt_phases: [{ name: "Old timeline", duration_days: 10 }] }).phases).toEqual(omitted);
        expect(evaluateProposalReadiness({ programmePhases: omitted }).mandatory.find(i => i.key === "programme")).toMatchObject({ ok: true, label: "Programme (deliberately omitted)" });
    });
    it("freezes omission rather than private retained stages, and removes timing from HTML/PDF", () => {
        const input = representativeInput();
        input.project.programme_phases = withProgrammeInclusion(saved, false);
        const snapshot = buildProposalPublicationSnapshot(input);
        expect(snapshot.programme_intent).toBe("omit");
        expect(snapshot.programme).toEqual([]); expect(snapshot.programme_plan).toBeUndefined();
        expect(snapshot.project.start_date).toBeNull();
        expect(canonicalProposalPublicationJson(snapshot)).not.toContain("Keep this exact stage");
        const doc = buildProposalDocument(JSON.parse(JSON.stringify(snapshot)), { isDraft: true });
        expect(doc.sections.some(s => s.id === "programme")).toBe(false);
        expect(doc.keyFacts.some(f => ["Start on site", "Finish", "Duration"].includes(f.label))).toBe(false);
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
        expect(html).not.toContain("data-programme-timeline");
        expect(renderProposalBrochure(doc, new Map()).doc.output()).not.toContain("Keep this exact stage");
    });
    it("restoring the decision does not invent a usable programme or bypass validation", () => {
        const phases = withProgrammeInclusion(withProgrammeInclusion([], false), true);
        expect(phases).toEqual([]);
        expect(evaluateProposalReadiness({ programmePhases: phases }).mandatory.find(i => i.key === "programme")?.ok).toBe(false);
        const input = representativeInput(); input.project.programme_phases = phases; input.project.gantt_phases = [];
        expect(() => buildProposalPublicationSnapshot(input)).toThrow();
    });
});
