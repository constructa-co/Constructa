import { describe, expect, it } from "vitest";
import { normalizeClientBoQLines } from "./client-boq-normalize";

describe("client BoQ AI row normalisation", () => {
    it("coerces non-string sections and keeps description-only headings", () => {
        const lines = normalizeClientBoQLines([
            { section: 2, description: "Frame", quantity: null, unit: "item", unit_rate: 0 },
            { description: "Steel frame shell", quantity: null, unit: "", unit_rate: 0 },
            { section: "Frame", description: "Erect steel", quantity: 12, unit: "tonne", unit_rate: 950 },
        ]);
        expect(lines[0]).toMatchObject({ section: "2", description: "Frame", quantity: null });
        expect(lines[1]).toMatchObject({ section: "2", description: "Steel frame shell", quantity: null });
        expect(lines[2].section).toBe("Frame");
    });

    it("keeps an unpriced row with a real unit as a line instead of a heading", () => {
        const lines = normalizeClientBoQLines([
            { section: "Joinery", description: "Doors", quantity: 4, unit: "nr", unit_rate: 0 },
            { description: "Ironmongery", quantity: null, unit: "nr", unit_rate: 0 },
            { description: "Architraves", quantity: 30, unit: "m", unit_rate: 0 },
        ]);
        expect(lines[1]).toMatchObject({ section: "Joinery", description: "Ironmongery", unit: "nr", quantity: null });
        expect(lines[2].section).toBe("Joinery");
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
            { section: "Groundworks", description: "Paving", quantity: 10, unit: "m2", unit_rate: "£12.00", line_total: 120 },
            { section: "Groundworks", description: "Kerbs", quantity: null, unit: "m", unit_rate: 0, line_total: 300 },
        ]);
        expect(lines[0]).toMatchObject({ unit: "m2", unit_rate: 12, line_total: 120 });
        expect(lines[0].parse_warnings).toBeUndefined();
        expect(lines[1]).toMatchObject({ unit: "m", line_total: 300 });
    });

    it("stores qty × rate and reports the client total when the two disagree", () => {
        const lines = normalizeClientBoQLines([
            { section: "Groundworks", description: "Paving", quantity: 10, unit: "m2", unit_rate: 12, line_total: 130 },
        ]);
        expect(lines[0]).toMatchObject({ line_total: 120, total_mismatch: { stated: 130, computed: 120 } });
        expect(lines[0].parse_warnings).toBeUndefined();
    });
});