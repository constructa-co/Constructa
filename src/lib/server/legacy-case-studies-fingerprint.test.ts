import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { legacyCaseStudiesStoredFingerprint, legacyCaseStudiesStoredIsKnown } from "./legacy-case-studies-fingerprint";

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

    it("is the same whatever order the keys are in, as a list is once stored and read back, but not the order of entries", () => {
        const sent = [{ id: "a", projectName: "Kitchen", photos: ["x", ""], extra: { p: 1, q: [{ b: 2, a: 1 }] } }, { id: "b" }];
        const readBack = [{ extra: { q: [{ a: 1, b: 2 }], p: 1 }, photos: ["x", ""], projectName: "Kitchen", id: "a" }, { id: "b" }];
        expect(legacyCaseStudiesStoredFingerprint(readBack)).toBe(legacyCaseStudiesStoredFingerprint(sent));
        expect(legacyCaseStudiesStoredFingerprint([sent[1], sent[0]])).not.toBe(legacyCaseStudiesStoredFingerprint(sent));
        expect(legacyCaseStudiesStoredFingerprint([{ ...sent[0], photos: ["", "x"] }, sent[1]])).not.toBe(legacyCaseStudiesStoredFingerprint(sent));
    });
});

describe("legacyCaseStudiesStoredIsKnown", () => {
    const loaded = [{ id: "a", projectName: "As loaded" }];
    const sent = [{ id: "a", projectName: "Sent, answer lost" }];
    const elsewhere = [{ id: "a", projectName: "Saved in another tab" }];
    const expected = legacyCaseStudiesStoredFingerprint(loaded);

    it("knows the list the tab loaded", () => {
        expect(legacyCaseStudiesStoredIsKnown(structuredClone(loaded), expected, undefined)).toBe(true);
    });

    it("knows a list the tab sent itself, in any key order, and nothing else", () => {
        expect(legacyCaseStudiesStoredIsKnown([{ projectName: "Sent, answer lost", id: "a" }], expected, [sent])).toBe(true);
        expect(legacyCaseStudiesStoredIsKnown(elsewhere, expected, [sent])).toBe(false);
        expect(legacyCaseStudiesStoredIsKnown(elsewhere, expected, [])).toBe(false);
        expect(legacyCaseStudiesStoredIsKnown(elsewhere, expected, undefined)).toBe(false);
    });

    it.each([["a string", "x"], ["an object", { 0: elsewhere }], ["a list of things that are not lists", [null, "x", 3, { length: 1 }]]])("%s in place of the sent lists knows nothing more", (_name, value) => {
        expect(legacyCaseStudiesStoredIsKnown(elsewhere, expected, value)).toBe(false);
        expect(legacyCaseStudiesStoredIsKnown(null, expected, value)).toBe(false);
    });
});