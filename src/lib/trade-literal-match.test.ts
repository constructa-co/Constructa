import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { literalNameMatches } from "./trade-literal-match";

const NAMES = ["Groundworks & Civils", "Drainage", "Masonry / Brickwork / Blockwork", "Utilities – Water", "Tiling", "Kitchen Installation", "Roofing"];

describe("A031 literal whole-name matcher", () => {
    it.each([
        ["Groundworks & Civils and drainage", ["Groundworks & Civils", "Drainage"]],
        ["GROUNDWORKS, civils", ["Groundworks & Civils"]],
        ["utilities - water connections", ["Utilities – Water"]],
        ["Ｒｏｏｆｉｎｇ", ["Roofing"]],
        ["masonry / brickwork / blockwork", ["Masonry / Brickwork / Blockwork"]],
    ])("matches %j", (text, expected) => {
        expect(literalNameMatches(NAMES, text)).toEqual(expected);
    });

    it.each([
        "groundwork and civils", "drains", "brickwork", "kitchens", "kitchen", "roofer", "tilings",
        "groundworks and civils", "", "   ", "re-roofing",
    ])("does not stem, split, guess or match part of a word: %j", text => {
        expect(literalNameMatches(NAMES, text)).toEqual([]);
    });

    it("keeps the list order, never duplicates, and ignores names that fold to nothing", () => {
        expect(literalNameMatches(["Roofing", "Tiling", "Roofing", "&"], "tiling roofing roofing")).toEqual(["Roofing", "Tiling"]);
    });

    it("is pure and imports no taxonomy, mapping, AI or storage", () => {
        const source = readFileSync(join(process.cwd(), "src/lib/trade-literal-match.ts"), "utf8");
        expect(source).not.toMatch(/^import /m);
        expect(source).not.toMatch(/project-types|case-library|job-type|fetch\(|supabase/);
    });
});
