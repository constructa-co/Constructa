import { describe, expect, it } from "vitest";
import {
    programmeHasCircularDependencies,
    reconcileDependenciesAfterMove,
    wouldCreateCircularDependency,
} from "./programme-phase-dependencies";

const link = (
    startOffset: number,
    days: number,
    dependsOn?: number[],
) => ({ startOffset, calculatedDays: days, manualDays: days as number | null, dependsOn });

describe("CON-029 circular programme dependencies", () => {
    it("rejects self-dependency and two-stage cycles", () => {
        const phases = [link(0, 5), link(7, 5, [0])];
        expect(wouldCreateCircularDependency(phases, 0, 0)).toBe(true);
        expect(wouldCreateCircularDependency(phases, 0, 1)).toBe(true);
        expect(programmeHasCircularDependencies([phases[0], { ...phases[1], dependsOn: [0] }])).toBe(false);
        expect(programmeHasCircularDependencies([{ ...phases[0], dependsOn: [1] }, phases[1]])).toBe(true);
    });

    it("rejects a three-stage ring", () => {
        const phases = [link(0, 5, [2]), link(7, 5, [0]), link(14, 5, [1])];
        expect(programmeHasCircularDependencies(phases)).toBe(true);
        expect(wouldCreateCircularDependency(phases, 2, 1)).toBe(true);
    });

    it("allows a straight chain", () => {
        const phases = [link(0, 5), link(7, 5, [0]), link(14, 5, [1])];
        expect(programmeHasCircularDependencies(phases)).toBe(false);
        expect(wouldCreateCircularDependency(phases, 2, 1)).toBe(false);
    });
});

describe("CON-030 drag move keeps duration and dependency timing", () => {
    it("shifts a dependent successor when its predecessor moves later", () => {
        const phases = [link(0, 5), link(7, 5, [0])];
        const moved = [{ ...phases[0], startOffset: 14 }, phases[1]];
        const reconciled = reconcileDependenciesAfterMove(moved, 0, 5);
        expect(reconciled[0]).toMatchObject({ startOffset: 14, calculatedDays: 5, manualDays: 5 });
        expect(reconciled[1]).toMatchObject({ startOffset: 21, calculatedDays: 5, manualDays: 5 });
    });

    it("clamps a moved successor that would start before its predecessor ends", () => {
        const phases = [link(0, 5), link(21, 5, [0])];
        const moved = [{ ...phases[0], startOffset: 14 }, { ...phases[1], startOffset: 7 }];
        const reconciled = reconcileDependenciesAfterMove(moved, 1, 5);
        expect(reconciled[1]).toMatchObject({ startOffset: 21, calculatedDays: 5, manualDays: 5 });
    });
});