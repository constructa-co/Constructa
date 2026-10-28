import { describe, expect, it } from "vitest";
import { contentFromInput, newDraft } from "@/lib/case-library/content";
import { draftFromLegacy } from "@/lib/case-library/legacy";
import { normalisePhotoSlots, proposalPhotoUrls } from "@/lib/case-library/photos";
import { resolveSelectedCaseStudies } from "@/lib/case-library/resolve";
import { approvedValue } from "@/lib/case-library/content";
import { selectCaseStudies } from "@/lib/proposal-publication";

/**
 * A038 seams: upload/selection/reuse/refusal across older and library journeys.
 * Synthetic fixtures only.
 */
describe("case study photo journey seams", () => {
    it("older entries keep three url slots through save and proposal selection", () => {
        const stored = [{ id: "cs-1", projectName: "Kitchen", projectType: "Refurb", client: "", location: "", whatWeDelivered: "Work", valueAdded: "", photos: ["https://images.example.test/a.jpg", "", "https://images.example.test/b.jpg"] }];
        const chosen = selectCaseStudies(stored, ["cs-1"]);
        expect(chosen[0]?.photos).toEqual(["https://images.example.test/a.jpg", "https://images.example.test/b.jpg"]);
    });

    it("library content drops unknown keys and normalises three photo slots", () => {
        const content = contentFromInput({ ...newDraft("Job"), photos: [{ url: "https://images.example.test/x.jpg", caption: "Before" }] });
        expect(normalisePhotoSlots(content.photos)[0]).toEqual({ url: "https://images.example.test/x.jpg", caption: "Before" });
        expect(contentFromInput({ ...newDraft("Job"), extra: true }).photos).toEqual(normalisePhotoSlots(undefined));
    });

    it("starting a library version from older work does not reuse pictures without an explicit choice", () => {
        const draft = draftFromLegacy({ projectName: "Kitchen", photos: ["https://images.example.test/legacy.jpg", "", ""] });
        expect(proposalPhotoUrls(draft.photos)).toEqual([]);
    });

    it("approved library studies expose safe urls to the shared resolver", () => {
        const content = { ...newDraft("Library kitchen"), delivered: "Done.", photos: normalisePhotoSlots([{ url: "https://images.example.test/lib.jpg", caption: "Finished" }]) };
        const approved = approvedValue(content, ["Kitchens"]);
        const id = "00000000-0000-4000-8000-000000000010";
        const resolved = resolveSelectedCaseStudies({
            userId: "user",
            olderStored: [],
            libraryRows: [{ id, user_id: "user", approved, approved_revision: 1, archived_at: null }],
            selected: [`lib:${id}`],
        });
        expect(resolved.sendable).toBe(true);
        if (resolved.sendable) expect(resolved.studies[0]?.photos).toEqual(["https://images.example.test/lib.jpg"]);
    });
});
