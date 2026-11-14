import { describe, expect, it } from "vitest";
import { JOB_TYPE_EXAMPLES } from "./job-type-options";
import {
    CASE_STUDY_DISCIPLINE_TAGS,
    CASE_STUDY_TAG_LIMITS,
    JOB_TYPE_EXAMPLE_TAG_HINTS,
    disciplineHintsForExample,
    exampleTagSuggestions,
    legacyCaseStudyForSave,
    readStoredExampleTags,
    normaliseDisciplineTags,
    normaliseSectorTags,
    sectorHintsForExample,
    sectorHintsFromClientText,
    suggestedDisciplineChips,
    suggestedSectorChips,
    toggleDisciplineTag,
    toggleSectorTag,
} from "./case-study-example-tags";
import { SETUP_WORK_SUGGESTIONS } from "./first-session";

describe("A037 case study example tags", () => {
    it("uses SETUP_WORK_SUGGESTIONS as the discipline catalogue", () => {
        expect(CASE_STUDY_DISCIPLINE_TAGS).toEqual(SETUP_WORK_SUGGESTIONS);
    });

    it("labels every job-type datalist example with evidence-based hints", () => {
        for (const example of JOB_TYPE_EXAMPLES) {
            expect(JOB_TYPE_EXAMPLE_TAG_HINTS[example]).toBeDefined();
            const { disciplines, sectors } = JOB_TYPE_EXAMPLE_TAG_HINTS[example];
            for (const tag of disciplines) {
                expect(SETUP_WORK_SUGGESTIONS).toContain(tag);
            }
            expect(sectors.length).toBeLessThanOrEqual(3);
        }
        expect(JOB_TYPE_EXAMPLE_TAG_HINTS.Other.disciplines).toEqual([]);
        expect(JOB_TYPE_EXAMPLE_TAG_HINTS.Other.sectors).toEqual([]);
    });

    it("normalises and limits tag arrays", () => {
        const extra = [...SETUP_WORK_SUGGESTIONS, "General building"];
        expect(normaliseDisciplineTags(extra).length).toBe(CASE_STUDY_TAG_LIMITS.disciplines);
        expect(normaliseDisciplineTags(["Not in list", "Roofing"])).toEqual(["Roofing"]);
        expect(toggleDisciplineTag(["Roofing"], "Roofing")).toEqual([]);
        expect(toggleSectorTag(["domestic"], "commercial")).toEqual(["domestic", "commercial"]);
        expect(normaliseSectorTags(["domestic", "unknown", "public"])).toEqual(["domestic", "public"]);
    });

    it("maps standard job types to discipline hints", () => {
        expect(disciplineHintsForExample("extension")).toEqual(["General building", "Carpentry & joinery"]);
        expect(sectorHintsForExample("Loft Conversion")).toEqual(["domestic"]);
        expect(sectorHintsFromClientText("Private homeowner")).toEqual(["domestic"]);
    });
});

describe("A037 D17 — suggestions vs stored selections", () => {
    it("shows inferred tags as suggestions only, not as stored selections", () => {
        const stored = readStoredExampleTags({
            projectType: "Bathroom/Kitchen",
            client: "Private homeowner",
        });
        const suggestions = exampleTagSuggestions({ projectType: "Bathroom/Kitchen", client: "Private homeowner" });

        expect(stored.disciplineTags).toEqual([]);
        expect(stored.sectorTags).toEqual([]);
        expect(stored.disciplineTagsExplicit).toBe(false);
        expect(stored.sectorTagsExplicit).toBe(false);

        expect(suggestions.disciplineTags).toEqual(["Refurbishment & fit-out", "Plumbing & heating"]);
        expect(suggestions.sectorTags).toEqual(["domestic"]);
        expect(suggestedDisciplineChips(stored.disciplineTags, suggestions.disciplineTags)).toEqual(suggestions.disciplineTags);

        const wire = legacyCaseStudyForSave({
            id: "s1",
            projectType: "Bathroom/Kitchen",
            client: "Private homeowner",
            ...stored,
        });
        expect(wire).not.toHaveProperty("disciplineTags");
        expect(wire).not.toHaveProperty("sectorTags");
    });

    it("persists deliberate empty selections with explicit flags", () => {
        const stored = readStoredExampleTags({
            disciplineTags: [],
            disciplineTagsExplicit: true,
            sectorTags: [],
            sectorTagsExplicit: true,
        });
        expect(stored.disciplineTags).toEqual([]);
        expect(stored.sectorTags).toEqual([]);
        expect(stored.disciplineTagsExplicit).toBe(true);
        expect(stored.sectorTagsExplicit).toBe(true);

        const wire = legacyCaseStudyForSave({
            id: "s1",
            projectName: "Empty tags",
            ...stored,
        });
        expect(wire.disciplineTags).toEqual([]);
        expect(wire.sectorTags).toEqual([]);
        expect(wire.disciplineTagsExplicit).toBe(true);
        expect(wire.sectorTagsExplicit).toBe(true);
    });

    it("selected chip state follows stored data, not suggestions alone", () => {
        const stored = readStoredExampleTags({
            projectType: "Extension",
            client: "Private homeowner",
            disciplineTags: ["Roofing"],
            disciplineTagsExplicit: true,
            sectorTags: ["commercial"],
            sectorTagsExplicit: true,
        });
        const suggestions = exampleTagSuggestions({ projectType: "Extension", client: "Private homeowner" });

        expect(stored.disciplineTags).toEqual(["Roofing"]);
        expect(stored.sectorTags).toEqual(["commercial"]);
        expect(suggestions.disciplineTags).toContain("General building");
        expect(suggestedDisciplineChips(stored.disciplineTags, suggestions.disciplineTags)).not.toContain("Roofing");
        expect(suggestedSectorChips(stored.sectorTags, suggestions.sectorTags)).not.toContain("commercial");

        const wire = legacyCaseStudyForSave({ id: "s1", ...stored });
        expect(wire.disciplineTags).toEqual(["Roofing"]);
        expect(wire.sectorTags).toEqual(["commercial"]);
    });
});