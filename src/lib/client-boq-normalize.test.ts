import { describe, expect, it } from "vitest";
import { normalizeClientBoQLines } from "./client-boq-normalize";

describe("client BoQ AI row normalisation", () => {
    it("coerces non-string sections and keeps description-only headings", () => {
        const lines = normalizeClientBoQLines([
            { section: 2, description: "Frame", quantity: null, unit: "item", unit_rate: 0 },
            { description: "Steel frame shell", quantity: null, unit: "", unit_rate: 0 },
            { section: "Frame", description: "Erect steel", quantity: 12, unit: "tonne", unit_rate: 950 },
        ]);
        expect(lines[0]).toMatchObject({ section: "Frame", description: "Frame", quantity: null });
        expect(lines[1]).toMatchObject({ section: "Frame", description: "Steel frame shell", quantity: null });
        expect(lines[2].section).toBe("Frame");
    });

    it("flags malformed quantity and rate without inventing values or turning into headings", () => {
        const lines = normalizeClientBoQLines([
            { section: "Groundworks", description: "Clear site", quantity: "n/a", unit: "m2", unit_rate: "TBC" },
        ]);
        expect(lines[0]).toMatchObject({
            quantity: null,
            unit: "m2",
            unit_rate: 0,
            line_total: 0,
            parse_warnings: ["quantity", "unit_rate"],
        });
    });

    it("keeps an explicit client line total when quantity and rate are present", () => {
        const lines = normalizeClientBoQLines([
            { section: "Groundworks", description: "Paving", quantity: 10, unit: "m2", unit_rate: 12, line_total: 130 },
        ]);
        expect(lines[0].line_total).toBe(130);
        expect(lines[0].unit).toBe("m2");
    });
});