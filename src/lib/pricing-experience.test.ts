import { describe, expect, it } from "vitest";
import { pricingExperienceSource, pricingExperienceChangeError } from "./pricing-experience";
describe("legacy experience selection meanings stay unchanged", () => {
    it("preserves legacy index/id aliases and shared IDs without rekeying", () => {
        const source = pricingExperienceSource("key", [{ id: "shared", projectName: "One" }, { id: "shared", projectName: "Two" }], ["0", "unknown", "shared"]);
        expect(source.options.find(option => option.tick === "shared")).toMatchObject({ title: "One / Two", detail: expect.stringContaining("2 older entries") });
        expect(source.options.find(option => option.tick === "0")?.title).toBe("One"); expect(source.retained).toEqual(["unknown"]);
        expect(source.selected).toEqual(["0", "unknown", "shared"]); expect(pricingExperienceChangeError(source, ["0", "unknown"])).toBeNull();
    });
    it("reports id-versus-index collisions rather than guessing identity", () => {
        const source = pricingExperienceSource("key", [{ id: "1", projectName: "One" }, { projectName: "Two" }], []);
        expect(source.options.find(option => option.tick === "1")?.title).toBe("One / Two");
    });
    it("preserves unresolved duplicate ticks exactly and refuses silent loss or invention", () => {
        const source = pricingExperienceSource("key", null, ["missing", "missing", "lib:bad"]);
        expect(source.retained).toEqual(["missing", "missing", "lib:bad"]);
        expect(pricingExperienceChangeError(source, ["missing", "lib:bad"])).toContain("unchanged");
        expect(pricingExperienceChangeError(source, ["missing", "missing", "lib:bad", "new"])).toContain("no longer available");
    });
    it("does not invent entries from untitled/malformed source or mutate inputs", () => {
        const older = [{ projectName: "" }, null, { projectName: "Named" }], selected = ["missing"];
        const before = JSON.stringify({ older, selected }); const source = pricingExperienceSource("key", older, selected);
        expect(source.options.map(option => option.tick)).toEqual(["2"]); expect(JSON.stringify({ older, selected })).toBe(before);
    });
    it("retains the existing older first-six rule and notes instead of filtered count claims", () => {
        const older = Array.from({ length: 7 }, (_, i) => ({ id: "id" + i, projectName: "Job " + i }));
        const source = pricingExperienceSource("key", older, older.map(row => row.id));
        expect(source.options).toHaveLength(7); expect(source.notes.join(" ")).toContain("first 6"); expect(source.notes.join(" ")).toContain("not approval to send");
    });
});
