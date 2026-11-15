import { afterEach, describe, expect, it, vi } from "vitest";
import {
    COVER_RENDER_CAPTION,
    PROPOSAL_COVER_PHOTO_ENV,
    coverForIllustrativeRender,
    isProposalCoverPhotoEnabled,
    parseProposalCoverPhotoChoice,
    resolveProposalCoverPhoto,
} from "./proposal-cover-photo";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("A074 proposal cover photo rollout gate", () => {
    it("is disabled by default so pre-migration deploys never touch the column", () => {
        vi.stubEnv(PROPOSAL_COVER_PHOTO_ENV, "");
        expect(isProposalCoverPhotoEnabled()).toBe(false);
        vi.stubEnv(PROPOSAL_COVER_PHOTO_ENV, "true");
        expect(isProposalCoverPhotoEnabled()).toBe(false);
    });

    it("turns on only when the env is exactly 1", () => {
        vi.stubEnv(PROPOSAL_COVER_PHOTO_ENV, "1");
        expect(isProposalCoverPhotoEnabled()).toBe(true);
    });
});

describe("A074 proposal cover photo", () => {
    it("parses only the two explicit stored choices", () => {
        expect(parseProposalCoverPhotoChoice(null)).toBeNull();
        expect(parseProposalCoverPhotoChoice(undefined)).toBeNull();
        expect(parseProposalCoverPhotoChoice("illustrative_render")).toBe("illustrative_render");
        expect(parseProposalCoverPhotoChoice("site")).toBe("site");
        expect(parseProposalCoverPhotoChoice("other")).toBeNull();
    });

    it("returns no cover image unless a choice is saved", () => {
        expect(resolveProposalCoverPhoto(null, [{ url: "https://cdn.example.test/a.jpg" }])).toBeNull();
    });

    it("uses the first site photo only when site is chosen", () => {
        const cover = resolveProposalCoverPhoto("site", [
            { url: "https://cdn.example.test/first.jpg", caption: "  Front elevation  " },
            { url: "https://cdn.example.test/second.jpg" },
        ]);
        expect(cover).toMatchObject({
            kind: "site",
            url: "https://cdn.example.test/first.jpg",
            alt: "Front elevation",
            caption: "Front elevation",
        });
    });

    it("ships the mandatory render caption when the illustrative choice is used", () => {
        const cover = resolveProposalCoverPhoto("illustrative_render", []);
        expect(cover?.caption).toBe(COVER_RENDER_CAPTION);
        expect(cover?.caption).toMatch(/not a photograph of completed work\.$/);
        expect(coverForIllustrativeRender(true).caption).toMatch(/not a photograph of completed work\.$/);
    });

    it("does not fall back to a site photo when site is chosen but none are saved", () => {
        expect(resolveProposalCoverPhoto("site", [])).toBeNull();
    });
});