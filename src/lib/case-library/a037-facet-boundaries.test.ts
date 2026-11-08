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


describe("A037 stale and ambiguous tag identities", () => {
    it("a missing chip does not fall back to job matching; clearing it restores job matching", () => {
        const untagged: TaggedStudy = { id: "untagged", labels: [], disciplineIds: [] };
        const input = { studies: [...studies, untagged], jobSignals: ["Roofing"] };
        const stale = groupByTag({ ...input, chosenDisciplineIds: ["removed-id"] });
        expect(stale.basis).toBe("chips");
        expect(stale.tagged).toEqual([]);
        expect(stale.other.map(study => study.id)).toEqual(["roof-house", "roof-shop", "tile-house"]);
        expect(stale.notTagged).toEqual([untagged]);
        const cleared = groupByTag({ ...input, chosenDisciplineIds: [] });
        expect(cleared.basis).toBe("job");
        expect(cleared.tagged.map(study => study.id)).toEqual(["roof-house", "roof-shop"]);
        expect(cleared.notTagged).toEqual([untagged]);
    });

    it("identical labels do not merge distinct chip IDs, while job signals cannot distinguish them", () => {
        const sameLabel: TaggedStudy[] = [
            { id: "first", labels: ["Residential"], disciplineIds: ["first-id"] },
            { id: "second", labels: ["Residential"], disciplineIds: ["second-id"] },
        ];
        const chips = groupByTag({ studies: sameLabel, jobSignals: ["Residential"], chosenDisciplineIds: ["second-id", "second-id"] });
        expect(chips.tagged.map(study => study.id)).toEqual(["second"]);
        expect(chips.other.map(study => study.id)).toEqual(["first"]);
        const signals = groupByTag({ studies: sameLabel, jobSignals: ["Residential"] });
        expect(signals.tagged.map(study => study.id)).toEqual(["first", "second"]);
    });
});
