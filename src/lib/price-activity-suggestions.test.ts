import { describe, expect, it } from "vitest";
import { MAX_PRICE_ACTIVITY_LENGTH } from "./simple-estimate";
import { priceActivitySuggestions } from "./price-activity-suggestions";

const line = (trade_section: string) => ({ trade_section });

describe("price activity suggestions", () => {
    it("lists existing estimate names first, then saved Brief names, dropping an exact duplicate", () => {
        const lines = [line("Kitchen"), line("Kitchen"), line("Preliminaries")];
        const brief = ["Strip out cupboards", "Kitchen", "Fit new cabinets"];
        expect(priceActivitySuggestions(lines, brief)).toEqual(["Kitchen", "Strip out cupboards", "Fit new cabinets"]);
    });

    it("returns no Brief names when the saved value is absent or not an array", () => {
        const lines = [line("Kitchen")];
        for (const brief of [undefined, null, "Kitchen", 3, true, { 0: "Kitchen", length: 1 }, { name: "Kitchen" }]) {
            expect(priceActivitySuggestions(lines, brief)).toEqual(["Kitchen"]);
        }
    });

    it("uses actual Brief names when the estimate has none", () => {
        const brief = ["Protect the existing kitchen", "Remove old cupboards"];
        expect(priceActivitySuggestions([], brief)).toEqual(brief);
    });

    it("drops non-strings, blank, reserved, and over-length names without changing kept text", () => {
        const exact = "A".repeat(MAX_PRICE_ACTIVITY_LENGTH);
        const lines = [
            line(""),
            line("   "),
            line("Preliminaries"),
            line("A".repeat(MAX_PRICE_ACTIVITY_LENGTH + 1)),
            line(exact),
            line("Keep"),
        ];
        const brief = [1, null, {}, [], "", "  ", "Preliminaries", "B".repeat(MAX_PRICE_ACTIVITY_LENGTH + 1), "Brief only", "Keep"];
        expect(priceActivitySuggestions(lines, brief)).toEqual([exact, "Keep", "Brief only"]);
    });

    it("keeps legacy spacing and case as separate exact names and does not change the sources", () => {
        const lines = [line("Bathroom"), line(" bathroom"), line("Bathroom ")];
        const brief = ["BATHROOM", " Preliminaries", "preliminaries"];
        const linesBefore = lines.map(item => item.trade_section);
        const briefBefore = [...brief];
        expect(priceActivitySuggestions(lines, brief)).toEqual([
            "Bathroom", " bathroom", "Bathroom ", "BATHROOM", " Preliminaries", "preliminaries",
        ]);
        expect(lines.map(item => item.trade_section)).toEqual(linesBefore);
        expect(brief).toEqual(briefBefore);
    });
});
