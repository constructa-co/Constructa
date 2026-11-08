import { describe, expect, it } from "vitest";
import { emptyPhotoSlots, photoSlotsProblem, safeCaseStudyPhotoUrl } from "./photos";

// A038 offline boundary cases for the three-photo limit. Pure; synthetic URLs only.
// Source/offline evidence only — says nothing about hosted storage or a human QA run.

const BASE = "https://images.example.test/";
const urlOfLength = (length: number) => BASE + "a".repeat(length - BASE.length);
const withFirst = (url: string, caption = "") => {
    const slots = emptyPhotoSlots();
    slots[0] = { url, caption };
    return slots;
};

describe("case study photo boundaries (A038, offline)", () => {
    it("accepts a url of exactly 2000 characters and refuses 2001", () => {
        expect(photoSlotsProblem(withFirst(urlOfLength(2000)))).toBeNull();
        expect(photoSlotsProblem(withFirst(urlOfLength(2001)))).toBe("photos");
    });

    it("accepts a caption of exactly 300 characters and refuses 301", () => {
        expect(photoSlotsProblem(withFirst(`${BASE}a.jpg`, "c".repeat(300)))).toBeNull();
        expect(photoSlotsProblem(withFirst(`${BASE}a.jpg`, "c".repeat(301)))).toBe("photos");
    });

    it("refuses any slot count other than three", () => {
        expect(photoSlotsProblem([...emptyPhotoSlots(), { url: "", caption: "" }])).toBe("photos");
        expect(photoSlotsProblem(emptyPhotoSlots().slice(0, 2))).toBe("photos");
        expect(photoSlotsProblem([])).toBe("photos");
    });

    it("refuses control characters in a url or a caption", () => {
        expect(photoSlotsProblem(withFirst(`${BASE}a\u0007.jpg`))).toBe("photos");
        expect(photoSlotsProblem(withFirst(`${BASE}a.jpg`, "line\nbreak"))).toBe("photos");
    });

    it("refuses embedded credentials and non-web schemes", () => {
        expect(photoSlotsProblem(withFirst("https://user:pass@images.example.test/a.jpg"))).toBe("photos");
        expect(safeCaseStudyPhotoUrl("https://user@images.example.test/a.jpg")).toBeNull();
        expect(safeCaseStudyPhotoUrl("ftp://images.example.test/a.jpg")).toBeNull();
    });

    it("treats a blank url as an empty slot, not a problem", () => {
        expect(photoSlotsProblem(withFirst("   "))).toBeNull();
    });

    it("allows plain-http only for localhost and 127.0.0.1, not look-alike hosts", () => {
        expect(photoSlotsProblem(withFirst("http://localhost:3000/a.png"))).toBeNull();
        expect(photoSlotsProblem(withFirst("http://localhost.evil.test/a.png"))).toBe("photos");
    });
});
