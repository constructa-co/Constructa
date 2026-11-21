import { describe, expect, it } from "vitest";
import {
    PROGRAMME_CIRCULAR_DEPENDENCY_ERROR,
    programmeDependsOnHasSelfReference,
    programmeHasCircularDependencies,
    reconcileDependenciesAfterMove,
    validateProgrammeDependencies,
    wouldCreateCircularDependency,
} from "./programme-phase-dependencies";

const link = (
    startOffset: number,
    days: number,
    dependsOn?: number[],
) => ({ startOffset, calculatedDays: days, manualDays: days as number | null, dependsOn });

describe("CON-029 circular programme dependencies", () => {
    it("rejects self-dependency before persistence normalization", () => {
        const phases = [link(0, 5, [0])];
        expect(programmeDependsOnHasSelfReference(phases)).toBe(true);
        expect(validateProgrammeDependencies(phases)).toEqual({ ok: false, error: PROGRAMME_CIRCULAR_DEPENDENCY_ERROR });
        expect(programmeHasCircularDependencies(phases)).toBe(false);
    });

    it("rejects self-dependency and two-stage cycles in wouldCreate", () => {
        const phases = [link(0, 5), link(7, 5, [0])];
        expect(wouldCreateCircularDependency(phases, 0, 0)).toBe(true);
        expect(wouldCreateCircularDependency(phases, 0, 1)).toBe(true);
        expect(programmeHasCircularDependencies([phases[0], { ...phases[1], dependsOn: [0] }])).toBe(false);
        expect(programmeHasCircularDependencies([{ ...phases[0], dependsOn: [1] }, phases[1]])).toBe(true);
    });

    it("rejects a three-stage ring", () => {
        const phases = [link(0, 5, [2]), link(7, 5, [0]), link(14, 5, [1])];
        expect(programmeHasCircularDependencies(phases)).toBe(true);
        expect(validateProgrammeDependencies(phases)).toEqual({ ok: false, error: PROGRAMME_CIRCULAR_DEPENDENCY_ERROR });
        expect(wouldCreateCircularDependency(phases, 2, 1)).toBe(true);
    });

    it("allows a straight chain", () => {
        const phases = [link(0, 5), link(7, 5, [0]), link(14, 5, [1])];
        expect(validateProgrammeDependencies(phases)).toEqual({ ok: true });
        expect(programmeHasCircularDependencies(phases)).toBe(false);
        expect(wouldCreateCircularDependency(phases, 2, 1)).toBe(false);
    });
});

describe("CON-030 drag move keeps duration and dependency timing", () => {
    it("cascades A → B → C when A moves later", () => {
        const phases = [link(0, 5), { ...link(7, 5), dependsOn: [0] }, { ...link(14, 5), dependsOn: [1] }];
        const moved = [{ ...phases[0], startOffset: 14 }, phases[1], phases[2]];
        const reconciled = reconcileDependenciesAfterMove(moved, 0, 5);
        expect(reconciled.map(p => p.startOffset)).toEqual([14, 21, 28]);
        expect(reconciled.every((p, i) => p.calculatedDays === 5 && p.manualDays === 5)).toBe(true);
    });

    it("honours every listed predecessor when a successor moves", () => {
        const phases = [link(0, 5), link(7, 5), { ...link(21, 5), dependsOn: [0, 1] }];
        const moved = [phases[0], { ...phases[1], startOffset: 14 }, { ...phases[2], startOffset: 0 }];
        const reconciled = reconcileDependenciesAfterMove(moved, 2, 5);
        expect(reconciled[2].startOffset).toBe(21);
    });

    it("clamps a moved successor that would start before its predecessor ends", () => {
        const phases = [link(0, 5), link(21, 5, [0])];
        const moved = [{ ...phases[0], startOffset: 14 }, { ...phases[1], startOffset: 7 }];
        const reconciled = reconcileDependenciesAfterMove(moved, 1, 5);
        expect(reconciled[1]).toMatchObject({ startOffset: 21, calculatedDays: 5, manualDays: 5 });
    });
});