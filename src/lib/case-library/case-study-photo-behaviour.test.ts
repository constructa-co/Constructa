import { describe, expect, it } from "vitest";
import {
    caseStudyPhotoContentHash,
    legacyProfileCaseStudyPhotos,
    mergeLegacyProfilePhotoUrls,
    splitLegacyProfilePhotoUrls,
} from "./case-study-photo-behaviour";

describe("case study photo behaviour (CON-061)", () => {
    it("splits three active slots from a legacy tail", () => {
        const photos = [
            "https://images.example.test/a.jpg",
            "",
            "https://images.example.test/c.jpg",
            "https://images.example.test/legacy.jpg",
        ];
        expect(splitLegacyProfilePhotoUrls(photos)).toEqual({
            active: ["https://images.example.test/a.jpg", "", "https://images.example.test/c.jpg"],
            legacyTail: ["https://images.example.test/legacy.jpg"],
        });
        expect(mergeLegacyProfilePhotoUrls(photos.slice(0, 3), ["https://images.example.test/legacy.jpg"])).toEqual(photos);
    });

    it("puts the main slot first on proposals and ignores the legacy tail", () => {
        const photos = [
            "https://images.example.test/a.jpg",
            "https://images.example.test/b.jpg",
            "",
            "https://images.example.test/legacy.jpg",
        ];
        expect(legacyProfileCaseStudyPhotos(photos, 1)).toEqual([
            "https://images.example.test/b.jpg",
            "https://images.example.test/a.jpg",
        ]);
    });

    it("defaults the main slot to the first filled active picture", () => {
        expect(legacyProfileCaseStudyPhotos(["", "https://images.example.test/b.jpg", "https://images.example.test/c.jpg"], null)).toEqual([
            "https://images.example.test/b.jpg",
            "https://images.example.test/c.jpg",
        ]);
    });

    it("hashes file bytes the same way twice", async () => {
        const file = new File(["synthetic-bytes"], "x.png", { type: "image/png" });
        const one = await caseStudyPhotoContentHash(file);
        const two = await caseStudyPhotoContentHash(file);
        expect(one).toMatch(/^[0-9a-f]{64}$/);
        expect(one).toBe(two);
    });
});