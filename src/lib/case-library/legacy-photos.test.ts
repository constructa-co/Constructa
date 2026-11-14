import { describe, expect, it } from "vitest";
import { LEGACY_CASE_STUDY_PHOTOS_MESSAGE, keepFirstThreePhotos, legacyCaseStudiesPhotosProblem, legacyEntryPhotosProblem, legacyExtraPhotoCount } from "./legacy-photos";

describe("older case study photograph saves", () => {
    it("accepts three slots including empties", () => {
        expect(legacyEntryPhotosProblem(["https://images.example.test/a.jpg", "", ""])).toBeNull();
    });

    it("accepts fewer than three and treats the rest as empty slots", () => {
        expect(legacyEntryPhotosProblem(["https://images.example.test/a.jpg"])).toBeNull();
    });

    it("refuses more than three urls", () => {
        expect(legacyEntryPhotosProblem(["a", "b", "c", "d"])).toBe("photos");
    });

    it("refuses a non-list", () => {
        expect(legacyEntryPhotosProblem("not a list")).toBe("photos");
    });

    it("refuses unsafe or overlong urls", () => {
        expect(legacyEntryPhotosProblem(["javascript:alert(1)", "", ""])).toBe("photos");
        expect(legacyEntryPhotosProblem(["http://images.example.test/a.jpg", "", ""])).toBe("photos");
        expect(legacyEntryPhotosProblem([`https://images.example.test/${"a".repeat(2000)}`, "", ""])).toBe("photos");
    });

    it("allows local http for developer uploads", () => {
        expect(legacyEntryPhotosProblem(["http://127.0.0.1:3000/x.png", "", ""])).toBeNull();
    });

    it("finds the first offending entry in a list", () => {
        const list = [
            { projectName: "Fine", photos: ["https://images.example.test/ok.jpg", "", ""] },
            { projectName: "Too many", photos: ["1", "2", "3", "4"] },
        ];
        expect(legacyCaseStudiesPhotosProblem(list)).toBe(1);
    });

    it("ignores entries with no photos key or non-objects", () => {
        expect(legacyCaseStudiesPhotosProblem([{ projectName: "No photos" }, "bare string", null])).toBeNull();
    });

    it("exposes one clear refusal message", () => {
        expect(LEGACY_CASE_STUDY_PHOTOS_MESSAGE).toMatch(/up to three/i);
        expect(LEGACY_CASE_STUDY_PHOTOS_MESSAGE).toMatch(/https/i);
    });
});

describe("older entries that already hold more than three pictures", () => {
    const four = ["https://images.example.test/1.jpg", "https://images.example.test/2.jpg", "https://images.example.test/3.jpg", "https://images.example.test/4.jpg"];

    it("counts exactly what the save refuses on, and nothing for anything that is not a list", () => {
        expect(legacyExtraPhotoCount(four)).toBe(1);
        expect(legacyExtraPhotoCount([...four, "", ""])).toBe(3);
        expect(legacyExtraPhotoCount(["a", "b", "c"])).toBe(0);
        expect(legacyExtraPhotoCount([])).toBe(0);
        for (const notAList of [null, undefined, "a,b,c,d", { length: 9 }]) expect(legacyExtraPhotoCount(notAList)).toBe(0);
        // Whatever it counts, the save refuses; whatever it does not, the length rule does not refuse.
        expect(legacyEntryPhotosProblem(four)).toBe("photos");
        expect(legacyEntryPhotosProblem(four.slice(0, 3))).toBeNull();
    });

    it("keeps the first three as stored, in order, without touching the original", () => {
        const original = [...four];
        const kept = keepFirstThreePhotos(original);
        expect(kept).toEqual(four.slice(0, 3));
        expect(original).toEqual(four);
        expect(kept).not.toBe(original);
        expect(legacyEntryPhotosProblem(kept)).toBeNull();
    });

    it("leaves a short list as it is", () => {
        expect(keepFirstThreePhotos(["https://images.example.test/1.jpg", "", ""])).toEqual(["https://images.example.test/1.jpg", "", ""]);
        expect(keepFirstThreePhotos([])).toEqual([]);
    });
});
