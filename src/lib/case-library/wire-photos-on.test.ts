import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A038: the enabled contract, ahead of the switch. The switch itself stays off
 * in the product; only this file's view of it is on. The real service, status
 * and resolver run, against the fake's copy of the rules in
 * `20261028120000_case_library_photos.sql`. Synthetic fixtures only.
 */
vi.mock("./content", async (importOriginal) => {
    const real = await importOriginal<typeof import("./content")>();
    return {
        ...real,
        caseLibraryDraftPhotosOnWire: () => true,
        toWireContent: (content: Parameters<typeof real.toWireContent>[0]) => real.toWireContent(content, true),
        approvedValue: (content: Parameters<typeof real.approvedValue>[0], labels: readonly string[]) => real.approvedValue(content, labels, true),
    };
});

import { fakeLibrary } from "./__fixtures__/fake-library";
import { LEGACY_WIRE_CONTENT_KEYS, approvedProblem, approvedValue, contentFromInput, newDraft, type ApprovedCaseStudy, type CaseStudyContent } from "./content";
import { LIBRARY_MESSAGES as M, fieldMessage } from "./messages";
import { buildPastJobs } from "./past-jobs";
import { emptyPhotoSlots, normalisePhotoSlots, type CaseStudyPhotoSlot } from "./photos";
import { libraryTick, resolveSelectedCaseStudies } from "./resolve";
import { approveStudy, createStudy, loadForApproval, saveStudy, startFromOlder, type LibraryContext } from "./service";
import { studyState } from "./status";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const URL_A = "https://images.example.test/a.jpg";
const URL_B = "https://images.example.test/b.jpg";
const URL_C = "https://images.example.test/c.jpg";
const URL_OLD = "https://images.example.test/older.jpg";
const THIRTEEN_KEYS = [...LEGACY_WIRE_CONTENT_KEYS, "photos"].sort();
const PHOTOS: CaseStudyPhotoSlot[] = [{ url: URL_A, caption: "Before" }, { url: URL_B, caption: "" }, { url: "", caption: "" }];
const withPhotos = (photos: unknown = PHOTOS): CaseStudyContent => ({ ...newDraft("Kitchen"), delivered: "Done.", photos: photos as CaseStudyPhotoSlot[] });

let db: ReturnType<typeof fakeLibrary>;
let me: LibraryContext;
const stored = (id: string) => db.studies.find((study) => study.id === id)!;
const lastCall = (name: string) => db.calls(name).at(-1)!;

async function created(content: CaseStudyContent = withPhotos()) {
    const result = await createStudy(me, { content, disciplineIds: [] });
    expect(result.status).toBe("saved");
    return result.id!;
}

async function approved(id: string) {
    const shown = await loadForApproval(me, id);
    if (shown.status !== "ok") throw new Error("not shown");
    const result = await approveStudy(me, { id, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
    return { shown: shown.check.wouldApprove, result };
}

async function proposalRows(ids: string[]) {
    const read = await db.reader.forProposal(ME, ids);
    if (read.state !== "ok") throw new Error("not read");
    return read.value;
}

beforeEach(() => {
    db = fakeLibrary({ olderByUser: { [ME]: [{ id: "older-1", projectName: "Older kitchen", client: "Mrs Older", whatWeDelivered: "Old words.", photos: [URL_OLD] }] } });
    me = { userId: ME, reader: db.reader, admin: () => db.admin };
});

describe("on the wire", () => {
    it("create sends the strict thirteen keys, and the database's copy holds the slots", async () => {
        const id = await created();
        const { p_content } = lastCall("case_study_create").args;
        expect(Object.keys(p_content as object).sort()).toEqual(THIRTEEN_KEYS);
        expect((p_content as CaseStudyContent).photos).toEqual(PHOTOS);
        expect(stored(id).draft.photos).toEqual(PHOTOS);
    });

    it("save sends slots in three, whatever shape the screen's list was", async () => {
        const id = await created(newDraft("Kitchen"));
        const result = await saveStudy(me, { id, revision: 1, content: withPhotos([{ url: `  ${URL_A} `, caption: " Before " }]), disciplineIds: [] });
        expect(result.status).toBe("saved");
        const { p_content } = lastCall("case_study_save_draft").args;
        expect(Object.keys(p_content as object).sort()).toEqual(THIRTEEN_KEYS);
        expect((p_content as CaseStudyContent).photos).toEqual([{ url: URL_A, caption: "Before" }, { url: "", caption: "" }, { url: "", caption: "" }]);
    });

    it("a draft with no pictures still sends three empty slots, because the key is required", async () => {
        await created(newDraft("Kitchen"));
        expect((lastCall("case_study_create").args.p_content as CaseStudyContent).photos).toEqual(emptyPhotoSlots());
    });

    it("keeps the revision and idempotency rules for pictures as for wording", async () => {
        const id = await created();
        expect((await saveStudy(me, { id, revision: 1, content: withPhotos(), disciplineIds: [] })).status).toBe("unchanged");
        expect(db.calls("case_study_save_draft")).toHaveLength(0);

        const other = withPhotos([{ url: URL_C, caption: "" }]);
        expect((await saveStudy(me, { id, revision: 1, content: other, disciplineIds: [] })).status).toBe("saved");
        expect(await saveStudy(me, { id, revision: 1, content: withPhotos(), disciplineIds: [] })).toMatchObject({ status: "conflict", revision: 2 });
        expect(await saveStudy(me, { id, revision: 1, content: other, disciplineIds: [] })).toMatchObject({ status: "unchanged", revision: 2 });
        expect(db.calls("case_study_save_draft")).toHaveLength(1);
    });

    it("a save whose answer was lost is confirmed by the pictures now stored, not assumed", async () => {
        const id = await created(newDraft("Kitchen"));
        db.failAfter("case_study_save_draft");
        expect(await saveStudy(me, { id, revision: 1, content: withPhotos(), disciplineIds: [] })).toMatchObject({ status: "saved", revision: 2 });

        db.failBefore("case_study_save_draft");
        const other = withPhotos([{ url: URL_C, caption: "" }]);
        expect((await saveStudy(me, { id, revision: 2, content: other, disciplineIds: [] })).status).toBe("unknown");
        expect(stored(id).draft.photos).toEqual(PHOTOS);
    });

    it.each([
        ["a fourth picture", [...PHOTOS.slice(0, 2), { url: URL_C, caption: "" }, { url: URL_OLD, caption: "" }]],
        ["a url too long to keep whole", [{ url: `https://images.example.test/${"a".repeat(2000)}`, caption: "" }]],
        ["a caption too long to keep whole", [{ url: URL_A, caption: "c".repeat(301) }]],
        ["a non-BMP caption the normalizer would shorten", [{ url: URL_A, caption: "\u{1F600}".repeat(200) }]],
    ])("refuses %s before any call, rather than cutting it", async (_name, photos) => {
        const result = await createStudy(me, { content: withPhotos(photos), disciplineIds: [] });
        expect(result).toMatchObject({ status: "invalid", field: "photos", message: fieldMessage("photos") });
        expect(db.rpcCalls).toEqual([]);
    });

    it.each([
        ["an unsafe scheme", "javascript:alert(1)"],
        ["a url the database refuses as typed", "HTTPS://images.example.test/a.jpg"],
        ["plain http on another host", "http://images.example.test/a.jpg"],
    ])("refuses %s, and does not say pictures can't be saved yet", async (_name, url) => {
        const result = await createStudy(me, { content: withPhotos([{ url, caption: "" }]), disciplineIds: [] });
        expect(result).toMatchObject({ status: "invalid", field: "photos" });
        expect(result.message).toContain("Check the pictures");
        expect(result.message).not.toContain("yet");
        expect(db.rpcCalls).toEqual([]);
    });

    it("the stand-in refuses a list that is not three slots, as the migration does", async () => {
        const id = await created();
        const answer = await db.admin.rpc("case_study_save_draft", { p_user_id: ME, p_id: id, p_expected_revision: 1, p_content: { ...withPhotos(), photos: [] } });
        expect(answer.data).toEqual({ outcome: "invalid", problem: "photos" });
        expect(stored(id).revision).toBe(1);
    });
});

describe("approval is bound to the exact snapshot", () => {
    it("what is shown, what the database stores and what the screen compares are one copy", async () => {
        const id = await created();
        const { shown, result } = await approved(id);
        expect(shown.photos).toEqual(PHOTOS);
        expect(stored(id).approved).toEqual(shown);
        expect(result).toMatchObject({ status: "approved", message: M.approved });
    });

    it("stops pictures being added, dropped or reworded behind what was shown", async () => {
        const id = await created();
        const check = await loadForApproval(me, id);
        if (check.status !== "ok") throw new Error("not shown");
        const { wouldApprove } = check.check;
        for (const shown of [
            { ...wouldApprove, photos: emptyPhotoSlots() },
            { ...wouldApprove, photos: [PHOTOS[1], PHOTOS[0], PHOTOS[2]] },
            { ...wouldApprove, photos: [{ url: URL_A, caption: "Other words" }, PHOTOS[1], PHOTOS[2]] },
        ]) {
            expect((await approveStudy(me, { id, revision: 1, confirmed: true, shown })).status).toBe("conflict");
        }
        const { photos: _photos, ...withoutKey } = wouldApprove;
        expect((await approveStudy(me, { id, revision: 1, confirmed: true, shown: withoutKey })).status).toBe("conflict");
        expect(db.calls("case_study_approve")).toEqual([]);
        expect(stored(id).approved).toBeNull();
    });

    it.each<[string, (copy: ApprovedCaseStudy) => unknown]>([
        ["a fourth slot", (copy) => ({ ...copy, photos: [...copy.photos, { url: URL_C, caption: "" }] })],
        ["two slots", (copy) => ({ ...copy, photos: copy.photos.slice(0, 2) })],
        ["a slot with an extra key", (copy) => ({ ...copy, photos: [{ ...copy.photos[0], storage_path: "x" }, copy.photos[1], copy.photos[2]] })],
        ["bare url strings", (copy) => ({ ...copy, photos: [URL_A, URL_B, ""] })],
        ["an extra field beside the photos", (copy) => ({ ...copy, assets: [] })],
    ])("treats a shown copy with %s as not the copy", async (_name, alter) => {
        const id = await created();
        const check = await loadForApproval(me, id);
        if (check.status !== "ok") throw new Error("not shown");
        expect(approvedProblem(alter(check.check.wouldApprove))).not.toBeNull();
        expect((await approveStudy(me, { id, revision: 1, confirmed: true, shown: alter(check.check.wouldApprove) })).status).toBe("conflict");
        expect(db.calls("case_study_approve")).toEqual([]);
    });

    it("says so if the stored copy is not what was shown", async () => {
        const id = await created();
        const check = await loadForApproval(me, id);
        if (check.status !== "ok") throw new Error("not shown");
        db.beforeNext("case_study_approve", () => { stored(id).draft = contentFromInput(withPhotos([{ url: URL_C, caption: "" }])); });
        const result = await approveStudy(me, { id, revision: 1, confirmed: true, shown: check.check.wouldApprove });
        expect(result).toMatchObject({ status: "approved", message: M.approvedDiffers });
    });
});

describe("status after approval", () => {
    const stateOf = (id: string) => studyState({ archived: false, approved: stored(id).approved as ApprovedCaseStudy, content: contentFromInput(stored(id).draft) }, []);

    it("is unchanged when the pictures are, and names them when they are not", async () => {
        const id = await created();
        await approved(id);
        expect(stateOf(id)).toEqual({ state: "approved", changes: [] });
        await saveStudy(me, { id, revision: 1, content: withPhotos([{ url: URL_A, caption: "After" }, PHOTOS[1], PHOTOS[2]]), disciplineIds: [] });
        expect(stateOf(id)).toEqual({ state: "approved-changed", changes: ["the pictures"] });
    });

    it("a copy approved before pictures were stored has not changed just because the key is new", () => {
        const { photos: _photos, ...twelveKeys } = approvedValue({ ...newDraft("Kitchen"), delivered: "Done." }, []);
        const legacy = twelveKeys as ApprovedCaseStudy;
        expect(approvedProblem(legacy)).toBeNull();
        expect(studyState({ archived: false, approved: legacy, content: { ...newDraft("Kitchen"), delivered: "Done." } }, [])).toEqual({ state: "approved", changes: [] });
        expect(studyState({ archived: false, approved: legacy, content: withPhotos() }, [])).toEqual({ state: "approved-changed", changes: ["the pictures"] });
    });
});

describe("a proposal", () => {
    it("carries the approved pictures in order, through the resolver publication uses", async () => {
        const id = await created();
        await approved(id);
        const { rows } = await proposalRows([id]);
        const resolved = resolveSelectedCaseStudies({ userId: ME, olderStored: [], libraryRows: rows, selected: [libraryTick(id)] });
        expect(resolved.sendable && resolved.studies[0]?.photos).toEqual([URL_A, URL_B]);
    });

    it("carries the approved pictures, not later unapproved ones", async () => {
        const id = await created();
        await approved(id);
        await saveStudy(me, { id, revision: 1, content: withPhotos([{ url: URL_C, caption: "" }]), disciplineIds: [] });
        const { rows } = await proposalRows([id]);
        const resolved = resolveSelectedCaseStudies({ userId: ME, olderStored: [], libraryRows: rows, selected: [libraryTick(id)] });
        expect(resolved.sendable && resolved.studies[0]?.photos).toEqual([URL_A, URL_B]);
    });

    it("never sends more than three, and refuses a stored copy with more", async () => {
        const id = "00000000-0000-4000-8000-000000000099";
        const approvedCopy = { ...approvedValue(withPhotos(), []), photos: [...PHOTOS, { url: URL_C, caption: "" }] };
        const resolved = resolveSelectedCaseStudies({ userId: ME, olderStored: [], libraryRows: [{ id, user_id: ME, approved: approvedCopy, approved_revision: 1, archived_at: null }], selected: [libraryTick(id)] });
        expect(resolved.sendable).toBe(false);
    });

    it("still sends a copy approved before pictures were stored, without any", () => {
        const id = "00000000-0000-4000-8000-000000000098";
        const { photos: _photos, ...twelveKeys } = approvedValue(withPhotos(), []);
        const resolved = resolveSelectedCaseStudies({ userId: ME, olderStored: [], libraryRows: [{ id, user_id: ME, approved: twelveKeys, approved_revision: 1, archived_at: null }], selected: [libraryTick(id)] });
        expect(resolved.sendable && resolved.studies[0]?.photos).toEqual([]);
    });
});

describe("a new version from an older case study", () => {
    it("starts with empty slots: the older pictures are not copied, and the older entry is untouched", async () => {
        const before = structuredClone(db.older[ME]);
        const result = await startFromOlder(me, { index: 0 });
        expect(result.status).toBe("saved");
        const { args } = lastCall("case_study_create");
        expect(args.p_legacy_index).toBe(0);
        expect(Object.keys(args.p_content as object).sort()).toEqual(THIRTEEN_KEYS);
        expect((args.p_content as CaseStudyContent).photos).toEqual(emptyPhotoSlots());
        expect(JSON.stringify(args)).not.toContain(URL_OLD);
        expect(db.older[ME]).toEqual(before);
    });

    it("does not borrow them at approval or at proposal, and says so truthfully", async () => {
        const id = (await startFromOlder(me, { index: 0 })).id!;
        const { shown } = await approved(id);
        expect(normalisePhotoSlots(shown.photos)).toEqual(emptyPhotoSlots());
        const { rows, legacyIndexById } = await proposalRows([id]);
        const jobs = buildPastJobs({ olderStored: db.older[ME], selected: [libraryTick(id)], library: { userId: ME, rows, legacyIndexById, available: true, unapproved: 0 } });
        expect(jobs.resolution.sendable && jobs.resolution.studies[0]?.photos).toEqual([]);
        expect(jobs.notes).toEqual(["“Older kitchen” will go out without pictures, because its approved version has none. Its older version has 1 photo. Tick that one instead to show them."]);
    });

    it("pictures added to the new version go through the same approval, and silence the note", async () => {
        const started = await startFromOlder(me, { index: 0 });
        const id = started.id!;
        const content = { ...contentFromInput(stored(id).draft), photos: normalisePhotoSlots([{ url: URL_A, caption: "" }]) };
        await saveStudy(me, { id, revision: 1, content, disciplineIds: [] });
        await approved(id);
        const { rows, legacyIndexById } = await proposalRows([id]);
        const jobs = buildPastJobs({ olderStored: db.older[ME], selected: [libraryTick(id)], library: { userId: ME, rows, legacyIndexById, available: true, unapproved: 0 } });
        expect(jobs.resolution.sendable && jobs.resolution.studies[0]?.photos).toEqual([URL_A]);
        expect(jobs.notes).toEqual([]);
    });
});
