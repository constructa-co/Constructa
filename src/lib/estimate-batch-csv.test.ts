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
});