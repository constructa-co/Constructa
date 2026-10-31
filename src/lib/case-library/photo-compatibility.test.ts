import { describe, expect, it } from "vitest";
import { approvedValue, newDraft, type ApprovedCaseStudy } from "./content";
import { fieldMessage, libraryPhotoHint } from "./messages";
import { buildPastJobs, type ProposalLibrary } from "./past-jobs";
import { normalisePhotoSlots } from "./photos";
import { libraryTick } from "./resolve";

/**
 * A038 on the applied database contract: library rows cannot hold pictures,
 * older entries can. Nothing a contractor reads may say otherwise, and a
 * proposal may not lose an older job's pictures without a word.
 * Synthetic fixtures only.
 */
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUDY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const URL_A = "https://images.example.test/a.jpg";
const URL_B = "https://images.example.test/b.jpg";
const tick = libraryTick(STUDY);

const older = (photos: unknown[]) => [{ id: "older-1", projectName: "Kitchen", whatWeDelivered: "Work", photos }];
const library = (approved: ApprovedCaseStudy = approvedValue({ ...newDraft("New kitchen"), delivered: "Done." }, []), legacyIndex: number | null = 0): ProposalLibrary => ({
    userId: USER,
    rows: [{ id: STUDY, user_id: USER, approved, approved_revision: 1, archived_at: null }],
    legacyIndexById: legacyIndex === null ? {} : { [STUDY]: legacyIndex },
    available: true,
    unapproved: 0,
});
const pictureNotes = (notes: string[]) => notes.filter((note) => note.includes("without pictures"));

describe("a new version chosen in place of an older job with pictures", () => {
    it("says the proposal goes out without them, how many the older one has, and what to do", () => {
        const jobs = buildPastJobs({ olderStored: older([URL_A, "", URL_B]), selected: [tick], library: library() });
        expect(pictureNotes(jobs.notes)).toEqual(["“New kitchen” will go out without pictures, because library case studies can't hold them yet. Its older version has 2 photos. Tick that one instead to show them."]);
        expect(jobs.blocked).toBeNull();
        expect(jobs.resolution.sendable).toBe(true);
    });

    it("counts only pictures a proposal could really show", () => {
        const jobs = buildPastJobs({ olderStored: older([URL_A, "javascript:alert(1)", "http://images.example.test/plain.jpg"]), selected: [tick], library: library() });
        expect(pictureNotes(jobs.notes)[0]).toContain("has 1 photo.");
    });

    it.each([
        ["the older job has no usable pictures", older(["", "", "not a url"]), [tick]],
        ["the older job is ticked too, which already has its own note", older([URL_A]), [tick, "older-1"]],
        ["the new version is not ticked", older([URL_A]), []],
    ])("says nothing when %s", (_name, stored, selected) => {
        expect(pictureNotes(buildPastJobs({ olderStored: stored, selected, library: library() }).notes)).toEqual([]);
    });

    it("says nothing for a library job that was not started from an older one", () => {
        expect(pictureNotes(buildPastJobs({ olderStored: older([URL_A]), selected: [tick], library: library(undefined, null) }).notes)).toEqual([]);
    });

    it("says nothing once the approved copy itself carries a picture", () => {
        const approved = { ...approvedValue({ ...newDraft("New kitchen"), delivered: "Done." }, []), photos: normalisePhotoSlots([{ url: URL_B, caption: "" }]) };
        expect(pictureNotes(buildPastJobs({ olderStored: older([URL_A]), selected: [tick], library: library(approved) }).notes)).toEqual([]);
    });

    it("never moves an older job's pictures onto the library job", () => {
        const jobs = buildPastJobs({ olderStored: older([URL_A]), selected: [tick], library: library() });
        expect(jobs.resolution.sendable && jobs.resolution.studies[0]?.photos).toEqual([]);
    });
});

describe("what the library says about photos", () => {
    it("points to where photos can be kept today, and promises nothing on the full form", () => {
        expect(libraryPhotoHint()).toBe("Photos can't be saved to the library yet. Up to three can go on an older case study on the Case Studies page.");
        expect(libraryPhotoHint()).not.toContain("full form");
    });

    it("returns to the full form only when the wire carries photos", () => {
        expect(libraryPhotoHint(true)).toBe("You can add up to three photos on the full form.");
    });

    it("a refused picture keeps the wording safe and says where pictures can go", () => {
        expect(fieldMessage("photos")).toContain("Your other wording can still be saved without them.");
        expect(fieldMessage("photos")).toContain("older case study");
    });
});
