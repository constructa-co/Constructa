import { describe, expect, it } from "vitest";
import { representativeInput } from "./__fixtures__/proposal";
import { buildProposalDocument } from "./proposal-document";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { buildPreviewSnapshot, draftFromProject, type ReviewContext } from "./proposal-review";
import { sitePhotoOrigin, sitePhotosAfterUpload, sitePhotosForJob } from "./proposal-site-photos";

// Synthetic ids and a synthetic storage host. No real project, user or image.
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const OTHER_PROJECT = "99999999-9999-4999-8999-999999999999";
const stored = (path: string) => `https://storage.example.test/storage/v1/object/public/proposal-photos/${path}`;

const MINE = stored(`${USER}/proposal/${PROJECT}/0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f.jpg`);
const OTHER_JOB = stored(`${USER}/proposal/${OTHER_PROJECT}/1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a.jpg`);
const OTHER_OWNER = stored(`${OTHER_USER}/proposal/${PROJECT}/2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b.jpg`);
const BRANDING = stored(`${USER}/branding/3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c.png`);
const CASE_STUDY = stored(`${USER}/case-study/4d4d4d4d-4d4d-4d4d-8d4d-4d4d4d4d4d4d.jpg`);
const OLDER_UPLOAD = stored("site-1700000000000.jpg");
const HOSTED_ELSEWHERE = "https://images.example.test/bathroom-before.jpg";

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

describe("D51 where a site photo was uploaded", () => {
    const job = { projectId: PROJECT, userId: USER };

    it("recognises a photo uploaded for this job", () => {
        expect(sitePhotoOrigin(MINE, job)).toBe("this-job");
        expect(sitePhotoOrigin(stored(`${USER.toUpperCase()}/proposal/${PROJECT.toUpperCase()}/photo.jpg`), job)).toBe("this-job");
        expect(sitePhotoOrigin(MINE, { projectId: PROJECT })).toBe("this-job");
    });

    it.each([
        ["another job's photo", OTHER_JOB],
        ["another contractor's folder", OTHER_OWNER],
        ["a branding image", BRANDING],
        ["a case-study image", CASE_STUDY],
    ])("refuses %s", (_label, url) => {
        expect(sitePhotoOrigin(url, job)).toBe("elsewhere");
    });

    it("does not guess about a link that does not follow the upload layout", () => {
        for (const url of [OLDER_UPLOAD, HOSTED_ELSEWHERE, stored(`${USER}/proposal/not-a-project/x.jpg`), stored(`${USER}/something-else/x.jpg`), "not a link", ""]) {
            expect(sitePhotoOrigin(url, job)).toBe("unknown");
        }
    });

    it("checks the contractor's folder only when the contractor is known", () => {
        expect(sitePhotoOrigin(OTHER_OWNER, { projectId: PROJECT })).toBe("this-job");
    });

    it("keeps the saved order and drops only what belongs elsewhere", () => {
        const photos = [OLDER_UPLOAD, OTHER_JOB, MINE, BRANDING, HOSTED_ELSEWHERE].map((url) => ({ url, caption: null }));
        expect(sitePhotosForJob(photos, job).map((photo) => photo.url)).toEqual([OLDER_UPLOAD, MINE, HOSTED_ELSEWHERE]);
    });
});

describe("D51 only this job's site photographs are sent", () => {
    const input = representativeInput();
    const withPhotos = (site_photos: unknown[]) => ({ ...input, project: { ...input.project, site_photos } });
    const mixed = [
        { url: OTHER_JOB, caption: "Another job" },
        { url: MINE, caption: "This bathroom" },
        { url: CASE_STUDY, caption: "A past job" },
        { url: HOSTED_ELSEWHERE, caption: "" },
    ];

    it("leaves another job's photo, and branding or case-study images, out of the snapshot and the document", () => {
        const snapshot = buildProposalPublicationSnapshot(withPhotos(mixed));
        expect(snapshot.photos).toEqual([
            { url: MINE, caption: "This bathroom" },
            { url: HOSTED_ELSEWHERE, caption: null },
        ]);
        const scope = buildProposalDocument(snapshot).sections.find((section) => section.id === "scope")!;
        const photos = scope.blocks.find((block) => block.type === "photos");
        expect(photos).toEqual({ type: "photos", photos: snapshot.photos });
        expect(JSON.stringify(snapshot)).not.toContain(OTHER_PROJECT);
        expect(JSON.stringify(snapshot)).not.toContain("/case-study/");
    });

    it("shows no photo section when every saved photo belongs elsewhere", () => {
        const snapshot = buildProposalPublicationSnapshot(withPhotos([{ url: OTHER_JOB, caption: "Another job" }]));
        expect(snapshot.photos).toEqual([]);
        const scope = buildProposalDocument(snapshot).sections.find((section) => section.id === "scope")!;
        expect(scope.blocks.some((block) => block.type === "photos" || (block.type === "subheading" && block.text === "Site photographs"))).toBe(false);
    });

    it("previews exactly the photographs that would be sent", () => {
        const project = { ...input.project, site_photos: mixed };
        const context: ReviewContext = { project, profile: input.profile, estimate: input.estimate, nextVersion: 1 };
        const draft = draftFromProject(project, () => "unit-stage");
        // The editor still lists every saved photo, so the contractor can see and remove it.
        expect(draft.photos.map((photo) => photo.url)).toEqual(mixed.map((photo) => photo.url));
        const preview = buildPreviewSnapshot(context, draft, "acknowledgement", input.sentAt)!;
        expect(preview.photos).toEqual(buildProposalPublicationSnapshot(withPhotos(mixed)).photos);
    });

    it("draws an issued proposal with the photographs it was issued with", () => {
        const issued = structuredClone(buildProposalPublicationSnapshot(input));
        issued.document_presentation_version = 2;
        issued.photos = [{ url: OTHER_JOB, caption: "As issued" }, { url: MINE, caption: null }];
        const before = structuredClone(issued);
        const scope = buildProposalDocument(issued).sections.find((section) => section.id === "scope")!;
        expect(scope.blocks.find((block) => block.type === "photos")).toEqual({ type: "photos", photos: issued.photos });
        expect(issued).toEqual(before);
    });
});