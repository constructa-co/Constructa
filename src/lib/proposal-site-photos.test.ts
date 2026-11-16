import { describe, expect, it } from "vitest";
import { sitePhotosAfterUpload } from "./proposal-site-photos";

describe("CON-026 site photo upload target", () => {
    it("prepends for cover so the first site photo is the cover image", () => {
        expect(sitePhotosAfterUpload([{ url: "https://example.test/old.jpg", caption: "" }], "https://example.test/new.jpg", "cover")).toEqual([
            { url: "https://example.test/new.jpg", caption: "" },
            { url: "https://example.test/old.jpg", caption: "" },
        ]);
    });

    it("appends for scope uploads", () => {
        expect(sitePhotosAfterUpload([], "https://example.test/a.jpg", "scope")).toEqual([
            { url: "https://example.test/a.jpg", caption: "" },
        ]);
    });
});