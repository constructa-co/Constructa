import { describe, expect, it } from "vitest";
import { legacyCaseStudiesStoredFingerprint } from "./legacy-case-studies-cas";

describe("legacyCaseStudiesStoredFingerprint", () => {
    it("is stable for the same stored list", () => {
        const stored = [{ id: "a", projectName: "Kitchen" }];
        expect(legacyCaseStudiesStoredFingerprint(stored)).toBe(legacyCaseStudiesStoredFingerprint(structuredClone(stored)));
    });

    it("changes when the stored list changes", () => {
        const a = legacyCaseStudiesStoredFingerprint([{ id: "a", projectName: "One" }]);
        const b = legacyCaseStudiesStoredFingerprint([{ id: "a", projectName: "Two" }]);
        expect(a).not.toBe(b);
    });

    it("treats non-arrays as empty", () => {
        expect(legacyCaseStudiesStoredFingerprint(null)).toBe(legacyCaseStudiesStoredFingerprint([]));
    });
});