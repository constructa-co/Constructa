import { beforeEach, describe, expect, it } from "vitest";
import { fakeLibrary } from "./__fixtures__/fake-library";
import { approvedValue, CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE, contentFromInput, contentProblemLegacy, contentProblemWithPhotos, hasCaseStudyPhoto, LEGACY_WIRE_CONTENT_KEYS, newDraft, toLegacyWireContent, toWireContent, type ApprovedCaseStudy } from "./content";
import { fieldMessage } from "./messages";
import { emptyPhotoSlots, photoInputWouldBeCut, photoSlotsProblem, storedPhotoSlotsProblem } from "./photos";
import { approveStudy, createStudy, loadForApproval, saveStudy, startFromOlder, type LibraryContext } from "./service";
import { studyState } from "./status";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const URL_A = "https://images.example.test/a.jpg";
const TWELVE_KEYS = [...LEGACY_WIRE_CONTENT_KEYS].sort();
const keysOf = (value: unknown) => Object.keys(value as object).sort();

describe("legacy database wire contract (photos migration not applied)", () => {
    it("rejects any payload that includes a photos key, even when empty", () => {
        const wire = toLegacyWireContent(newDraft("Job"));
        expect(contentProblemLegacy(wire)).toBeNull();
        expect(contentProblemLegacy({ ...wire, photos: [] })).toBe("keys");
        expect(contentProblemLegacy({ ...wire, photos: [{ url: "", caption: "" }] })).toBe("keys");
    });

    it("saveStudy sends the legacy shape and refuses when a picture url was chosen", async () => {
        const db = fakeLibrary();
        const me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const created = await createStudy(me, { content: newDraft("Kitchen"), disciplineIds: [] });
        expect(created.status).toBe("saved");
        const id = created.id!;
        const withPhoto = { ...newDraft("Kitchen"), delivered: "Work done.", photos: [{ url: "https://images.example.test/a.jpg", caption: "", }, { url: "", caption: "" }, { url: "", caption: "" }] };
        expect(hasCaseStudyPhoto(withPhoto)).toBe(true);
        const refused = await saveStudy(me, { id, revision: 1, content: withPhoto, disciplineIds: [] });
        expect(refused).toMatchObject({ status: "invalid", field: "photos" });
        expect(db.rpcCalls.at(-1)?.name).not.toBe("case_study_save_draft");

        const saved = await saveStudy(me, { id, revision: 1, content: { ...newDraft("Kitchen"), delivered: "Work done." }, disciplineIds: [] });
        expect(saved.status).toBe("saved");
        const last = db.rpcCalls.filter((call) => call.name === "case_study_save_draft").at(-1)!;
        expect(contentProblemLegacy(last.args.p_content)).toBeNull();
        expect(last.args.p_content).not.toHaveProperty("photos");
        expect(contentFromInput(db.studies[0].draft).delivered).toBe("Work done.");
    });

    it("the switch is off, and every write sends exactly the twelve keys", async () => {
        expect(CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE).toBe(false);
        const db = fakeLibrary({ olderByUser: { [ME]: [{ projectName: "Older kitchen", photos: [URL_A] }] } });
        const me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const created = await createStudy(me, { content: newDraft("Kitchen"), disciplineIds: [] });
        await saveStudy(me, { id: created.id!, revision: 1, content: { ...newDraft("Kitchen"), delivered: "Done." }, disciplineIds: [] });
        await startFromOlder(me, { index: 0 });
        const writes = [...db.calls("case_study_create"), ...db.calls("case_study_save_draft")];
        expect(writes).toHaveLength(3);
        for (const write of writes) expect(keysOf(write.args.p_content)).toEqual(TWELVE_KEYS);
    });

    it("the approved copy stays twelve keys plus the labels, and the stored copy matches what was shown", async () => {
        const db = fakeLibrary();
        const me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const created = await createStudy(me, { content: { ...newDraft("Kitchen"), delivered: "Done." }, disciplineIds: [] });
        const check = await loadForApproval(me, created.id!);
        if (check.status !== "ok") throw new Error("not shown");
        expect(check.check.wouldApprove).not.toHaveProperty("photos");
        const result = await approveStudy(me, { id: created.id!, revision: 1, confirmed: true, shown: check.check.wouldApprove });
        expect(result.status).toBe("approved");
        expect(db.studies[0].approved).toEqual(check.check.wouldApprove);
        expect(keysOf(db.studies[0].approved)).toEqual([...TWELVE_KEYS, "disciplines"].sort());
    });

    it("the refusal wording does not change", () => {
        expect(fieldMessage("photos")).toContain("Pictures can't be saved to the library yet.");
    });

    it("a four-slot list with no url is still accepted and still leaves no photos on the wire", async () => {
        const db = fakeLibrary();
        const me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const empty = [...emptyPhotoSlots(), { url: "", caption: "" }];
        expect((await createStudy(me, { content: { ...newDraft("Kitchen"), photos: empty }, disciplineIds: [] })).status).toBe("saved");
        expect(keysOf(db.calls("case_study_create")[0].args.p_content)).toEqual(TWELVE_KEYS);
    });

    it("a stored copy with empty slots is not reported as a picture change", () => {
        const approved = { ...approvedValue({ ...newDraft("Kitchen"), delivered: "Done." }, []), photos: emptyPhotoSlots() } as ApprovedCaseStudy;
        expect(studyState({ archived: false, approved, content: { ...newDraft("Kitchen"), delivered: "Done." } }, [])).toEqual({ state: "approved", changes: [] });
    });
});

describe("the two wire shapes", () => {
    const slots = [{ url: URL_A, caption: "Before" }, { url: "", caption: "" }, { url: "", caption: "" }];

    it("the switch decides the shape, and the default follows the switch", () => {
        const draft = { ...newDraft("Kitchen"), photos: slots };
        expect(toWireContent(draft)).toEqual(toLegacyWireContent(draft));
        expect(toWireContent(draft, false)).not.toHaveProperty("photos");
        expect(contentProblemLegacy(toWireContent(draft, false))).toBeNull();
        expect(toWireContent(draft, true)).toEqual(draft);
        expect(contentProblemWithPhotos(toWireContent(draft, true))).toBeNull();
        expect(contentProblemWithPhotos(toWireContent(draft, false))).toBe("keys");
        expect(contentProblemLegacy(toWireContent(draft, true))).toBe("keys");
    });

    it("the approved copy keeps exactly the slots the wire stored, and still blanks what is hidden", () => {
        const draft = { ...newDraft("Kitchen"), client_text: "Mrs Private", value_text: "£9,000", photos: slots };
        const copy = approvedValue(draft, ["Roofing"], true);
        expect(copy.photos).toEqual(slots);
        expect(copy).toMatchObject({ client_text: "", value_text: "", disciplines: ["Roofing"] });
        expect(approvedValue(draft, ["Roofing"], false)).not.toHaveProperty("photos");
    });

    it("the strict rule reads the photos as stored, as the migration does", () => {
        expect(storedPhotoSlotsProblem(slots)).toBeNull();
        expect(storedPhotoSlotsProblem(emptyPhotoSlots())).toBeNull();
        for (const bad of [undefined, null, [], "x", slots.slice(0, 2), [...slots, slots[2]], [URL_A, "", ""], [{ url: URL_A }, slots[1], slots[2]], [{ ...slots[0], path: "x" }, slots[1], slots[2]], [{ url: 1, caption: "" }, slots[1], slots[2]]]) {
            expect(storedPhotoSlotsProblem(bad)).toBe("photos");
        }
    });

    it("rules out urls the migration would refuse, however they parse", () => {
        const withUrl = (url: string) => [{ url, caption: "" }, slots[1], slots[2]];
        for (const url of ["https://images.example.test/a.jpg", "http://localhost:3000/a.jpg", "http://127.0.0.1/a.jpg"]) expect(photoSlotsProblem(withUrl(url))).toBeNull();
        for (const url of ["HTTPS://images.example.test/a.jpg", "https:/images.example.test/a.jpg", "http://localhost?x=1", "http://images.example.test/a.jpg"]) expect(photoSlotsProblem(withUrl(url))).toBe("photos");
    });

    it("spots only what tidying would lose", () => {
        expect(photoInputWouldBeCut(undefined)).toBe(false);
        expect(photoInputWouldBeCut([])).toBe(false);
        expect(photoInputWouldBeCut(slots)).toBe(false);
        expect(photoInputWouldBeCut([URL_A])).toBe(false);
        expect(photoInputWouldBeCut([{ url: "u".repeat(2000), caption: "c".repeat(300) }])).toBe(false);
        expect(photoInputWouldBeCut([...slots, slots[2]])).toBe(true);
        expect(photoInputWouldBeCut(["u".repeat(2001)])).toBe(true);
        expect(photoInputWouldBeCut([{ url: "u".repeat(2001), caption: "" }])).toBe(true);
        expect(photoInputWouldBeCut([{ url: "", caption: "c".repeat(301) }])).toBe(true);
    });
});
