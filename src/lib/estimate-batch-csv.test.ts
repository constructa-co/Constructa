import { describe, expect, it } from "vitest";
import { parseEstimateBatchCsv } from "./estimate-batch-csv";

const csv = `Section,Ref,Description,Qty,Unit,Rate
Substructure,2.1,Excavate spoil,45,m3,18.5
Substructure,2.2,Disposal,45,m3,12
Frame,,Steel frame shell,,heading,
Frame,3.1,Erect steel,12,tonne,950
`;

describe("CON-022 estimate batch CSV import", () => {
    it("parses priced rows, carries sections, and preserves heading order", () => {
        const result = parseEstimateBatchCsv(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.sections).toEqual(["Substructure", "Frame"]);
        expect(result.lines[0]).toMatchObject({
            section: "Substructure",
            client_ref: "2.1",
            description: "Excavate spoil",
            quantity: 45,
            unit: "m3",
            unit_rate: 18.5,
            line_total: 45 * 18.5,
        });
        expect(result.lines[2]).toMatchObject({
            section: "Frame",
            description: "Steel frame shell",
            quantity: null,
            unit: "item",
        });
        expect(result.lines[3].section).toBe("Frame");
    });

    it("does not invent rates when the Rate column is blank", () => {
        const blank = `Section,Description,Qty,Unit,Rate\nGroundworks,Clear site,1,item,\n`;
        const result = parseEstimateBatchCsv(blank);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.lines[0].unit_rate).toBe(0);
        expect(result.lines[0].line_total).toBe(0);
    });

    it("treats description-only rows as headings and flags malformed qty cells", () => {
        const csv = `Section,Description,Qty,Unit,Rate\nFit out,Kitchen refurbishment,,,\nWorks,Dig out,abc,item,10\n`;
        const result = parseEstimateBatchCsv(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.lines[0]).toMatchObject({ description: "Kitchen refurbishment", quantity: null, unit: "item" });
        expect(result.lines[1]).toMatchObject({ quantity: null, unit: "item", parse_warnings: ["quantity"] });
    });

    it("uses an explicit Total column without overwriting the unit", () => {
        const csv = `Section,Description,Qty,Unit,Rate,Total\nRoofing,Slates,8,nr,4.5,36\nRoofing,Lead flashing,,m,,250\n`;
        const parsed = parseEstimateBatchCsv(csv);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.lines[0]).toMatchObject({ unit: "nr", line_total: 36 });
        expect(parsed.lines[0].total_mismatch).toBeUndefined();
        expect(parsed.lines[1]).toMatchObject({ unit: "m", quantity: null, unit_rate: 0, line_total: 250 });
    });

    it("stores qty × rate and reports the file total when the two disagree", () => {
        const csv = `Section,Description,Qty,Unit,Rate,Total\nRoofing,Slates,8,nr,4.5,40\nRoofing,Battens,3,m,3.333,10\n`;
        const parsed = parseEstimateBatchCsv(csv);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.lines[0]).toMatchObject({ line_total: 36, total_mismatch: { stated: 40, computed: 36 } });
        expect(parsed.lines[0].parse_warnings).toBeUndefined();
        // A penny of rounding in the client's total is not a mismatch.
        expect(parsed.lines[1].line_total).toBe(10);
        expect(parsed.lines[1].total_mismatch).toBeUndefined();
    });

    it("keeps a single-word unpriced row with a real unit as a line in its section", () => {
        const csv = `Section,Description,Qty,Unit,Rate\nFinishes,Skirting,20,m,6\n,Plastering,,m2,\n,Decoration,10,m2,8\n,Externals,,,\n,Paving,5,m2,40\n`;
        const parsed = parseEstimateBatchCsv(csv);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.lines[1]).toMatchObject({ section: "Finishes", description: "Plastering", unit: "m2", quantity: null });
        expect(parsed.lines[2].section).toBe("Finishes");
        // With no unit, a single word is still a heading and starts a section.
        expect(parsed.lines[3]).toMatchObject({ section: "Externals", description: "Externals", unit: "item" });
        expect(parsed.lines[4].section).toBe("Externals");
        expect(parsed.sections).toEqual(["Finishes", "Externals"]);
    });

    it("reads currency-formatted cells instead of flagging them", () => {
        const csv = `Section,Description,Qty,Unit,Rate,Total\nGroundworks,Excavate,45,m3,£18.50,"£832.50"\nGroundworks,Muck away,1,item,"£ 1,250.00",\nGroundworks,Skip,2,nr,£abc,\n`;
        const parsed = parseEstimateBatchCsv(csv);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.lines[0]).toMatchObject({ unit_rate: 18.5, line_total: 832.5 });
        expect(parsed.lines[0].parse_warnings).toBeUndefined();
        expect(parsed.lines[1]).toMatchObject({ unit_rate: 1250, line_total: 1250 });
        expect(parsed.lines[2]).toMatchObject({ unit_rate: 0, parse_warnings: ["unit_rate"] });
    });
});