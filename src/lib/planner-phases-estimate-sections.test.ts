import { describe, expect, it } from "vitest";
import { estimateSuggestedPhases } from "./planner-phases";

const FIVE_DAY = { version: 1 as const, weekdays: [1, 2, 3, 4, 5] };
const MONDAY = "2026-11-02";

describe("CON-028 meaningful regenerate phases from estimate work", () => {
    it("builds one stage per trade section from labour hours", () => {
        const estimate = {
            estimate_lines: [
                { trade_section: "Groundworks", quantity: 1, estimate_line_components: [{ total_manhours: 40 }] },
                { trade_section: "Roofing", quantity: 2, estimate_line_components: [{ total_manhours: 8 }] },
            ],
        };
        const phases = estimateSuggestedPhases(estimate, 5, MONDAY, FIVE_DAY);
        expect(phases.map(p => p.name)).toEqual(["Groundworks", "Roofing"]);
        expect(phases[0]).toMatchObject({ calculatedDays: 5, manhours: 40 });
        expect(phases[1]).toMatchObject({ calculatedDays: 2, manhours: 16 });
    });

    it("keeps named placeholder stages when lines have no labour hours", () => {
        const estimate = {
            estimate_lines: [
                { trade_section: "Drawing items", quantity: 4, estimate_line_components: [] },
            ],
        };
        const [phase] = estimateSuggestedPhases(estimate, 5, MONDAY, FIVE_DAY);
        expect(phase).toMatchObject({ name: "Drawing items", calculatedDays: 5, manhours: 0 });
    });

    it("does not invent a stage from a lone filing label without lines", () => {
        expect(estimateSuggestedPhases({ estimate_lines: [] }, 5, MONDAY, FIVE_DAY)).toEqual([]);
    });
});