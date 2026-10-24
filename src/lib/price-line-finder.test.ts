import { describe, expect, it } from "vitest";
import { findPriceLineIds, nextPriceLineMatch } from "./price-line-finder";

const lines = [
    { id: "one", description: "Paint walls", trade_section: "Decoration", line_total: 10 },
    { id: "two", description: "Fit cabinets", trade_section: "Kitchen", line_total: 20 },
    { id: "three", description: "PAINT ceiling", trade_section: "Decoration", line_total: 30 },
];
describe("literal existing-price-line finder", () => {
    it("matches case-insensitive description or actual activity without changing source order or totals", () => {
        const before = JSON.stringify(lines);
        expect(findPriceLineIds(lines, " PAINT ")).toEqual(["one", "three"]);
        expect(findPriceLineIds(lines, "kitchen")).toEqual(["two"]);
        expect(findPriceLineIds(lines, "decoration")).toEqual(["one", "three"]);
        expect(JSON.stringify(lines)).toBe(before);
    });
    it.each(["", "  ", "10", "unknown", ".*", "[", "<script>"])("does not invent matches for %s", query => {
        expect(findPriceLineIds(lines, query)).toEqual([]);
    });
    it("handles missing wording and treats special characters literally", () => {
        expect(findPriceLineIds([{ id: "blank", description: null }, { id: "actual", description: "Bracket [work]", trade_section: null }], "[")).toEqual(["actual"]);
    });
    it("wraps explicit navigation and restarts safely after a selected line disappears", () => {
        const ids = ["one", "three"];
        expect(nextPriceLineMatch(ids, null, 1)).toBe("one");
        expect(nextPriceLineMatch(ids, null, -1)).toBe("three");
        expect(nextPriceLineMatch(ids, "three", 1)).toBe("one");
        expect(nextPriceLineMatch(ids, "one", -1)).toBe("three");
        expect(nextPriceLineMatch(ids, "removed", 1)).toBe("one");
        expect(nextPriceLineMatch([], "one", 1)).toBeNull();
    });
});
