import { describe, expect, it } from "vitest";
import { batchSectionHeadings, groupLinesBySection, orderedEstimateSections } from "./estimate-batch-sections";

describe("CON-022 estimate batch sections", () => {
    it("orders sections by first line appearance, not the trade template list", () => {
        const lines = [
            { trade_section: "Substructure" },
            { trade_section: "Substructure" },
            { trade_section: "Frame" },
            { trade_section: "Substructure" },
        ];
        expect(orderedEstimateSections(lines)).toEqual(["Substructure", "Frame"]);
    });

    it("groups rows without reordering inside a section", () => {
        const lines = [
            { id: "a", trade_section: "A" },
            { id: "b", trade_section: "B" },
            { id: "c", trade_section: "A" },
        ];
        expect(groupLinesBySection(lines).A.map(row => row.id)).toEqual(["a", "c"]);
    });

    it("derives heading order from parsed batch rows in sequence", () => {
        const rows = [
            { section: "2. Frame" },
            { section: "2. Frame" },
            { section: "1. Substructure" },
        ];
        expect(batchSectionHeadings(rows)).toEqual(["2. Frame", "1. Substructure"]);
    });
});