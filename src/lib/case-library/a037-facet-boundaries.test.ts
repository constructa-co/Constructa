import { describe, expect, it } from "vitest";
import { groupByTag, type TaggedStudy } from "./labels";

// Existing flat discipline contract, not an implementation of typed sectors.
const studies: TaggedStudy[] = [
    { id: "roof-house", labels: ["Roofing", "Residential"], disciplineIds: ["roof", "homes"] },
    { id: "roof-shop", labels: ["Roofing", "Commercial"], disciplineIds: ["roof", "shops"] },
    { id: "tile-house", labels: ["Tiling", "Residential"], disciplineIds: ["tile", "homes"] },
];

describe("A037 existing flat tag boundaries", () => {
    it("two selected chips form a union, so they cannot stand for trade AND sector", () => {
        const groups = groupByTag({ studies, jobSignals: [], chosenDisciplineIds: ["roof", "homes"] });
        expect(groups.tagged.map(study => study.id)).toEqual(["roof-house", "roof-shop", "tile-house"]);
        expect(groups.other).toEqual([]);
        expect(groups.basis).toBe("chips");
    });

    it("matching is independent of tag order and leaves caller records intact", () => {
        const frozen = Object.freeze(studies.map(study => Object.freeze({
            ...study, labels: Object.freeze([...study.labels]), disciplineIds: Object.freeze([...study.disciplineIds]),
        })));
        const before = JSON.stringify(frozen);
        const first = groupByTag({ studies: frozen, jobSignals: ["Commercial", "Roofing"] });
        const reversed = groupByTag({ studies: frozen, jobSignals: ["Roofing", "Commercial"] });
        expect(first.tagged.map(study => study.id)).toEqual(["roof-house", "roof-shop"]);
        expect(reversed).toEqual(first);
        expect(first.tagged[0]).toBe(frozen[0]);
        expect(JSON.stringify(frozen)).toBe(before);
    });
});
