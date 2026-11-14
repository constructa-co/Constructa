import { describe, expect, it } from "vitest";
import { JOB_TYPE_EXAMPLES } from "./job-type-options";
import {
    CASE_STUDY_DISCIPLINE_TAGS,
    CASE_STUDY_TAG_LIMITS,
    JOB_TYPE_EXAMPLE_TAG_HINTS,
    disciplineHintsForExample,
    legacyCaseStudyTagsFromFields,
    normaliseDisciplineTags,
    normaliseSectorTags,
    sectorHintsForExample,
    sectorHintsFromClientText,
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

    it("infers tags for legacy rows with no saved tags", () => {
        const inferred = legacyCaseStudyTagsFromFields({
            projectType: "Bathroom/Kitchen",
            client: "Private homeowner",
        });
        expect(inferred.disciplineTags).toEqual(["Refurbishment & fit-out", "Plumbing & heating"]);
        expect(inferred.sectorTags).toEqual(["domestic"]);
    });

    it("keeps contractor-selected tags when present", () => {
        const kept = legacyCaseStudyTagsFromFields({
            projectType: "Extension",
            client: "",
            disciplineTags: ["Roofing"],
            sectorTags: ["commercial"],
        });
        expect(kept).toEqual({ disciplineTags: ["Roofing"], sectorTags: ["commercial"] });
    });
});