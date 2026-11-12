import { describe, expect, it } from "vitest";
import { emptyPhotoSlots, normalisePhotoSlots, photoSlotsProblem, proposalPhotoUrls, safeCaseStudyPhotoUrl } from "./photos";

describe("case study photo slots", () => {
    it("always keeps three ordered slots", () => {
        expect(normalisePhotoSlots(undefined)).toEqual(emptyPhotoSlots());
        expect(normalisePhotoSlots(["https://images.example.test/a.jpg"])).toEqual([
            { url: "https://images.example.test/a.jpg", caption: "" },
            { url: "", caption: "" },
            { url: "", caption: "" },
        ]);
    });

    it("refuses unsafe links and keeps captions within limit", () => {
        const bad = emptyPhotoSlots();
        bad[0] = { url: "javascript:alert(1)", caption: "x" };
        expect(photoSlotsProblem(bad)).toBe("photos");
        bad[0] = { url: "https://images.example.test/a.jpg", caption: "c".repeat(301) };
        expect(photoSlotsProblem(bad)).toBe("photos");
    });

    it("maps approved slots to proposal urls in order", () => {
        const slots = normalisePhotoSlots([
            { url: "https://images.example.test/one.jpg", caption: "Before" },
            { url: "not-a-url", caption: "" },
            { url: "https://images.example.test/two.jpg", caption: "After" },
        ]);
        expect(proposalPhotoUrls(slots)).toEqual(["https://images.example.test/one.jpg", "https://images.example.test/two.jpg"]);
        expect(safeCaseStudyPhotoUrl("http://127.0.0.1:3000/x.png")).toMatch(/^http:\/\/127\.0\.0\.1:3000/);
    });
});
