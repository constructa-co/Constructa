import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLibrary } from "./__fixtures__/fake-library";
import { approvedValue, newDraft } from "./content";
import { LIBRARY_MESSAGES as M } from "./messages";
import { approveStudy, createStudy, loadForApproval, saveDiscipline, saveStudy, archiveDiscipline, viewOf, type LibraryContext } from "./service";
import { COHERENT_READ_ATTEMPTS, readStudyAtOneRevision, type LibraryReader } from "./store";

/**
 * The approval check must never show one revision's labels with another
 * revision's number. These tests put a committed change at every point in the
 * sequence of reads and require that what is shown is what gets approved, or
 * that nothing is shown.
 *
 * `inOrder` holds each read until the test releases it, and a read sees the
 * library as it is at the moment it is released. A change can therefore be
 * committed between any two reads, in any order the code under test allows.
 * If the code never has a read waiting at the point a plan names, the plan is
 * an ordering that cannot happen with that code, and `inOrder` says so.
 */
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
type ReadName = "revision" | "study" | "disciplines";
type Step = ReadName | (() => Promise<unknown>);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function inOrder(base: LibraryReader, plan: Step[]) {
    const waiting: Array<{ name: ReadName; release: () => void }> = [];
    const released: ReadName[] = [];
    let free = false;
    const gate = (name: ReadName) => (free ? Promise.resolve() : new Promise<void>((resolve) => waiting.push({ name, release: resolve })));
    const reader: LibraryReader = {
        ...base,
        revision: async (user, id) => { await gate("revision"); released.push("revision"); return base.revision(user, id); },
        study: async (user, id) => { await gate("study"); released.push("study"); return base.study(user, id); },
        disciplines: async (user) => { await gate("disciplines"); released.push("disciplines"); return base.disciplines(user); },
    };
    const run = async () => {
        for (const step of plan) {
            if (typeof step === "function") { await step(); continue; }
            for (let waits = 0; waits < 20 && !waiting.some((entry) => entry.name === step); waits += 1) await tick();
            const index = waiting.findIndex((entry) => entry.name === step);
            if (index < 0) throw new Error(`ordering not possible: no '${step}' read was waiting (waiting: ${waiting.map((entry) => entry.name).join(", ") || "nothing"})`);
            waiting.splice(index, 1)[0].release();
            await tick();
        }
        // The plan is done: everything else is answered as it is asked.
        free = true;
        for (const entry of waiting.splice(0)) entry.release();
    };
    return { reader, run, released };
}

let db: ReturnType<typeof fakeLibrary>;
let me: LibraryContext;
let studyId: string;
let oldKind: string;
let otherKind: string;

/** Each is one committed change that an approval would capture, made "somewhere else". */
const CHANGES: Record<string, () => Promise<unknown>> = {
    "a tag is renamed": () => saveDiscipline(me, { id: oldKind, revision: 1, label: "New label" }),
    "a tag is archived": () => archiveDiscipline(me, { id: oldKind, revision: 1, archived: true }),
    "the tags are reordered": async () => { await db.admin.rpc("case_library_discipline_save", { p_user_id: ME, p_id: oldKind, p_expected_revision: 1, p_label: "Old label", p_position: 9 }); },
    "the tags are replaced": async () => { await db.admin.rpc("case_study_set_disciplines", { p_user_id: ME, p_id: studyId, p_expected_revision: stored().revision, p_discipline_ids: [otherKind] }); },
    "the wording is edited": async () => { await db.admin.rpc("case_study_save_draft", { p_user_id: ME, p_id: studyId, p_expected_revision: stored().revision, p_content: { ...newDraft("Kitchen"), delivered: "Edited elsewhere." } }); },
};
const stored = () => db.studies.find((row) => row.id === studyId)!;

beforeEach(async () => {
    db = fakeLibrary();
    me = { userId: ME, reader: db.reader, admin: () => db.admin };
    oldKind = (await saveDiscipline(me, { id: null, revision: 0, label: "Old label" })).id!;
    otherKind = (await saveDiscipline(me, { id: null, revision: 0, label: "Other label" })).id!;
    studyId = (await createStudy(me, { content: newDraft("Kitchen"), disciplineIds: [oldKind, otherKind] })).id!;
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the defect, and why it cannot happen now", () => {
    it("reading the row and the labels side by side can pair the OLD labels with the NEW revision", async () => {
        // The reads as they were made before this repair: started together.
        const { reader, run } = inOrder(db.reader, ["disciplines", CHANGES["a tag is renamed"], "study"]);
        const sideBySide = Promise.all([reader.study(ME, studyId), reader.disciplines(ME)]);
        await run();
        const [study, disciplines] = await sideBySide;
        if (study.state !== "ok" || !study.value || disciplines.state !== "ok") throw new Error("expected both reads");
        const torn = viewOf(study.value, disciplines.value);
        const tornLabels = disciplines.value.filter((entry) => torn.disciplineIds.includes(entry.id)).map((entry) => entry.label);
        expect(torn.revision, "the revision is the one AFTER the rename").toBe(stored().revision);
        expect(tornLabels, "but the labels are the ones from BEFORE it").toEqual(["Old label", "Other label"]);
        // Even so, that mixture cannot now be approved: what was shown is sent back and is not what would be approved.
        const refused = await approveStudy(me, { id: studyId, revision: torn.revision, confirmed: true, shown: approvedValue(torn.content, tornLabels) });
        expect(refused.status).toBe("conflict");
        expect(db.calls("case_study_approve"), "refused before the database is asked").toEqual([]);
        expect(stored().approved).toBeNull();
        // Naming the revision alone, which is all the earlier code did, the database approves, and stores labels the contractor was not shown.
        await db.admin.rpc("case_study_approve", { p_user_id: ME, p_id: studyId, p_expected_revision: torn.revision, p_confirmed: true });
        expect((stored().approved as { disciplines: string[] }).disciplines).toEqual(["New label", "Other label"]);
    });

    it("the bracketed read never has a label read waiting before the revision has answered, so that ordering cannot be produced", async () => {
        const { reader, run } = inOrder(db.reader, ["disciplines", CHANGES["a tag is renamed"], "study"]);
        const read = readStudyAtOneRevision(reader, ME, studyId);
        await expect(run()).rejects.toThrow("ordering not possible: no 'disciplines' read was waiting (waiting: revision)");
        void read.catch(() => {});
    });

    it("its reads are made in the bracketed order: revision, then row and labels, then revision", async () => {
        const { reader, run, released } = inOrder(db.reader, ["revision", "disciplines", "study", "revision"]);
        const read = readStudyAtOneRevision(reader, ME, studyId);
        await run();
        expect((await read).state).toBe("ok");
        expect(released).toEqual(["revision", "disciplines", "study", "revision"]);
        // And the row and labels are not asked for until the first revision read has answered.
        const second = inOrder(db.reader, ["study"]);
        const blocked = readStudyAtOneRevision(second.reader, ME, studyId);
        await expect(second.run()).rejects.toThrow("no 'study' read was waiting (waiting: revision)");
        void blocked.catch(() => {});
    });
});

describe.each(Object.keys(CHANGES))("when %s while the approval check is being loaded", (name) => {
    const change = () => CHANGES[name]();
    /** Where the committed change falls in the sequence of reads. */
    const PLANS: Array<[string, Step[], "reread" | "caught-at-approval"]> = [
        ["before any read", [change], "reread"],
        ["after the first revision read", ["revision", change], "reread"],
        ["between the row and the labels (row first)", ["revision", "study", change, "disciplines"], "reread"],
        ["between the labels and the row (labels first)", ["revision", "disciplines", change, "study"], "reread"],
        ["after the row and the labels, before the final revision read", ["revision", "study", "disciplines", change], "reread"],
        ["after the row and the labels (labels first), before the final revision read", ["revision", "disciplines", "study", change], "reread"],
        ["after the final revision read", ["revision", "study", "disciplines", "revision", change], "caught-at-approval"],
    ];

    it.each(PLANS)("%s: what is approved is what was shown, or nothing is approved", async (_where, plan, expected) => {
        const { reader, run } = inOrder(db.reader, plan);
        const loading = loadForApproval({ ...me, reader }, studyId);
        await run();
        const shown = await loading;
        if (shown.status !== "ok") throw new Error(`the check was refused: ${shown.status}`);

        const result = await approveStudy(me, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        if (expected === "reread") {
            // The change was seen: the check was read again and shows the state after it.
            expect(shown.check.study.revision).toBe(stored().revision);
            expect(result.status).toBe("approved");
            expect(stored().approved).toEqual(shown.check.wouldApprove);
        } else {
            // The change came after the check was loaded: the approval names an old revision and is refused.
            expect(result.status).toBe("conflict");
            expect(stored().approved, "nothing was approved").toBeNull();
        }
        // In no case is something approved that differs from what was shown.
        if (stored().approved !== null) expect(stored().approved).toEqual(shown.check.wouldApprove);
    });
});

describe("when it will not settle, or cannot be read", () => {
    /** A change committed just before every final revision read: the case study never holds still. */
    const neverStill = (base: LibraryReader): { reader: LibraryReader; reads: () => number } => {
        let revisionReads = 0;
        let total = 0;
        return {
            reads: () => total,
            reader: {
                ...base,
                study: async (user, id) => { total += 1; return base.study(user, id); },
                disciplines: async (user) => { total += 1; return base.disciplines(user); },
                revision: async (user, id) => {
                    total += 1;
                    revisionReads += 1;
                    if (revisionReads % 2 === 0) await db.admin.rpc("case_study_save_draft", { p_user_id: ME, p_id: studyId, p_expected_revision: stored().revision, p_content: { ...newDraft("Kitchen"), delivered: `Edit ${revisionReads}` } });
                    return base.revision(user, id);
                },
            },
        };
    };

    it("gives up after a fixed number of tries and says so, rather than looping or showing a mixture", async () => {
        const moving = neverStill(db.reader);
        expect(await readStudyAtOneRevision(moving.reader, ME, studyId)).toEqual({ state: "changing" });
        expect(moving.reads()).toBe(COHERENT_READ_ATTEMPTS * 4);
        expect(COHERENT_READ_ATTEMPTS).toBeLessThanOrEqual(5);
    });

    it("the approval check is refused honestly, and nothing can be approved from it", async () => {
        const result = await loadForApproval({ ...me, reader: neverStill(db.reader).reader }, studyId);
        expect(result).toEqual({ status: "conflict", message: M.changing });
        expect(stored().approved).toBeNull();
    });

    it("a save is refused before any write: nothing is compared with a mixture, and nothing typed is said to be saved", async () => {
        const calls = db.rpcCalls.length;
        const moving = neverStill(db.reader);
        const before = db.rpcCalls.filter((call) => call.name !== "case_study_save_draft").length;
        const result = await saveStudy({ ...me, reader: moving.reader }, { id: studyId, revision: stored().revision, content: { ...newDraft("Kitchen"), delivered: "Mine." }, disciplineIds: [oldKind, otherKind] });
        expect(result).toEqual({ status: "conflict", message: M.changing });
        expect(result.message).toContain("Your wording is still here");
        // The only writes were the ones "somewhere else"; the save itself wrote nothing and touched no tags.
        expect(db.rpcCalls.filter((call) => call.name !== "case_study_save_draft").length).toBe(before);
        expect(db.rpcCalls.length).toBeGreaterThan(calls);
        expect(stored().draft.delivered).not.toBe("Mine.");
    });

    it.each(["first revision read", "row read", "labels read", "final revision read"])("a failed %s is 'not available': nothing is shown and nothing is approved", async (which) => {
        const failing = (): LibraryReader => {
            let revisionReads = 0;
            return {
                ...db.reader,
                revision: async (user, id) => { revisionReads += 1; return (which === "first revision read" && revisionReads === 1) || (which === "final revision read" && revisionReads === 2) ? { state: "unavailable" } : db.reader.revision(user, id); },
                study: async (user, id) => (which === "row read" ? { state: "unavailable" } : db.reader.study(user, id)),
                disciplines: async (user) => (which === "labels read" ? { state: "unavailable" } : db.reader.disciplines(user)),
            };
        };
        expect(await readStudyAtOneRevision(failing(), ME, studyId)).toEqual({ state: "unavailable" });
        expect(await loadForApproval({ ...me, reader: failing() }, studyId)).toEqual({ status: "unavailable", message: M.unavailable });
        expect(stored().approved).toBeNull();
    });

    it("a case study that does not exist, or is deleted between the reads, is 'not found'", async () => {
        expect(await readStudyAtOneRevision(db.reader, ME, "00000000-0000-4000-8000-999999999999")).toEqual({ state: "missing" });
        expect(await readStudyAtOneRevision(db.reader, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", studyId), "someone else's is not found either").toEqual({ state: "missing" });
        const vanishing: LibraryReader = { ...db.reader, study: async () => ({ state: "ok", value: null }), revision: async (user, id) => { const answer = await db.reader.revision(user, id); db.studies.length = 0; return answer; } };
        expect(await readStudyAtOneRevision(vanishing, ME, studyId)).toEqual({ state: "missing" });
    });
});

describe("saving does not act on a mixture either", () => {
    const mine = (delivered: string) => ({ ...newDraft("Kitchen"), delivered });

    it.each([
        ["before any read", [CHANGES["the tags are replaced"]] as Step[]],
        ["after the first revision read", ["revision", CHANGES["the tags are replaced"]] as Step[]],
        ["between the row and the labels", ["revision", "study", CHANGES["the tags are replaced"], "disciplines"] as Step[]],
        ["after the row and the labels", ["revision", "study", "disciplines", CHANGES["the tags are replaced"]] as Step[]],
    ])("tags replaced elsewhere %s: a save from the stale screen is a conflict, and the other change is not undone", async (_where, plan) => {
        const revisionOnScreen = stored().revision;
        const { reader, run } = inOrder(db.reader, plan);
        // The screen still holds the old revision and the old tags, and only the wording was edited.
        const saving = saveStudy({ ...me, reader }, { id: studyId, revision: revisionOnScreen, content: mine("Only the wording changed."), disciplineIds: [oldKind, otherKind] });
        await run();
        const result = await saving;
        expect(result.status).toBe("conflict");
        expect(result.latest?.disciplineIds, "the latest returned is the real current tags").toEqual([otherKind]);
        expect(db.links.filter((link) => link.study === studyId).map((link) => link.discipline), "the tags set elsewhere are still set").toEqual([otherKind]);
        expect(stored().draft.delivered).not.toBe("Only the wording changed.");
        expect(db.calls("case_study_set_disciplines"), "the save never wrote tags").toHaveLength(2);
    });

    it("tags replaced after the save's read finished: the wording write is refused by its revision, and no tags are written", async () => {
        // The read is clean. The other change is committed after it, just before the wording write is applied.
        let replaced = false;
        db.beforeNext("case_study_save_draft", () => {
            const row = stored();
            for (let index = db.links.length - 1; index >= 0; index -= 1) if (db.links[index].study === row.id && db.links[index].discipline === oldKind) db.links.splice(index, 1);
            row.revision += 1;
            replaced = true;
        });
        const result = await saveStudy(me, { id: studyId, revision: stored().revision, content: mine("Only the wording changed."), disciplineIds: [oldKind, otherKind] });
        expect(replaced).toBe(true);
        expect(result.status).toBe("conflict");
        expect(result.latest?.disciplineIds).toEqual([otherKind]);
        expect(db.links.filter((link) => link.study === studyId).map((link) => link.discipline)).toEqual([otherKind]);
        expect(stored().draft.delivered).not.toBe("Only the wording changed.");
    });

    it("'already saved' is said only when the wording and the tags read at ONE revision both match", async () => {
        const content = mine("Saved once.");
        const first = await saveStudy(me, { id: studyId, revision: stored().revision, content, disciplineIds: [oldKind, otherKind] });
        expect(first.status).toBe("saved");
        // The same save again, from a screen still holding the old revision, while the tags are replaced during its read.
        const { reader, run } = inOrder(db.reader, ["revision", "study", CHANGES["the tags are replaced"], "disciplines"]);
        const again = saveStudy({ ...me, reader }, { id: studyId, revision: 2, content, disciplineIds: [oldKind, otherKind] });
        await run();
        const result = await again;
        expect(result.status, "the tags no longer match, so it is not 'already saved'").toBe("conflict");
        expect(result.message).toBe(M.conflict);
    });

    it("after a lost answer, a follow-up read that will not settle is 'not known', never a claim either way", async () => {
        db.failAfter("case_study_save_draft");
        let revisionReads = 0;
        const reader: LibraryReader = {
            ...db.reader,
            revision: async (user, id) => {
                revisionReads += 1;
                // The first, clean read is the one before the write. Every later bracket is disturbed.
                if (revisionReads > 2 && revisionReads % 2 === 0) stored().revision += 1;
                return db.reader.revision(user, id);
            },
        };
        const result = await saveStudy({ ...me, reader }, { id: studyId, revision: stored().revision, content: mine("Landed, then unreadable."), disciplineIds: [oldKind, otherKind] });
        expect(result).toEqual({ status: "unknown", message: M.unknown });
        expect(stored().draft.delivered).toBe("Landed, then unreadable.");
    });
});

describe("approval is held to what was shown, not only to a revision number", () => {
    /** A reader whose labels are always the ones from before a rename, however the reads are ordered. */
    const staleLabels = async (): Promise<LibraryReader> => {
        const old = await db.reader.disciplines(ME);
        await CHANGES["a tag is renamed"]();
        return { ...db.reader, disciplines: async () => old };
    };

    it("a check that showed stale labels at the current revision cannot be used to approve the current labels", async () => {
        const stale = await staleLabels();
        const shown = await loadForApproval({ ...me, reader: stale }, studyId);
        if (shown.status !== "ok") throw new Error("expected a check");
        expect(shown.check.labels).toEqual(["Old label", "Other label"]);
        expect(shown.check.study.revision).toBe(stored().revision);

        const result = await approveStudy(me, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        expect(result).toMatchObject({ status: "conflict", message: M.approveConflict });
        expect(result.latest?.revision).toBe(stored().revision);
        expect(db.calls("case_study_approve")).toEqual([]);
        expect(stored().approved, "nothing was approved").toBeNull();
    });

    it("if the server's own read were stale in the same way, the approval goes through and the difference is said out loud", async () => {
        const stale = await staleLabels();
        let reads = 0;
        // Stale for the check and for the read before approving; current afterwards.
        const reader: LibraryReader = { ...db.reader, disciplines: async (user) => { reads += 1; return reads <= 2 ? stale.disciplines(user) : db.reader.disciplines(user); } };
        const shown = await loadForApproval({ ...me, reader }, studyId);
        if (shown.status !== "ok") throw new Error("expected a check");
        const result = await approveStudy({ ...me, reader }, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        expect(result).toMatchObject({ status: "approved", message: M.approvedDiffers });
        expect(result.latest?.approved?.disciplines).toEqual(["New label", "Other label"]);
    });

    it.each([
        ["nothing", undefined],
        ["null", null],
        ["text", "the kitchen one"],
        ["a draft, not an approved copy", { ...newDraft("Kitchen") }],
        ["an approved copy with an extra field", { ...approvedValue(newDraft("Kitchen"), ["Old label", "Other label"]), assets: [] }],
    ])("sending back %s is refused before anything is read or written", async (_label, sent) => {
        const reads = db.readCalls.length;
        expect(await approveStudy(me, { id: studyId, revision: stored().revision, confirmed: true, shown: sent })).toEqual({ status: "conflict", message: M.approveConflict });
        expect(db.readCalls.length).toBe(reads);
        expect(db.calls("case_study_approve")).toEqual([]);
    });

    it.each([
        ["a different label", (copy: Record<string, unknown>) => ({ ...copy, disciplines: ["Old label", "Something else"] })],
        ["the labels in another order", (copy: Record<string, unknown>) => ({ ...copy, disciplines: ["Other label", "Old label"] })],
        ["one label fewer", (copy: Record<string, unknown>) => ({ ...copy, disciplines: ["Old label"] })],
        ["different wording", (copy: Record<string, unknown>) => ({ ...copy, delivered: "Not what is saved." })],
        ["the client described, when the saved copy hides them", (copy: Record<string, unknown>) => ({ ...copy, client_display: "described", client_text: "a homeowner" })],
        ["a price shown, when the saved copy shows none", (copy: Record<string, unknown>) => ({ ...copy, show_value: true, value_text: "£1" })],
    ])("a shown copy with %s is not approved", async (_label, alter) => {
        const shown = await loadForApproval(me, studyId);
        if (shown.status !== "ok") throw new Error("expected a check");
        const result = await approveStudy(me, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: alter(shown.check.wouldApprove as unknown as Record<string, unknown>) });
        expect(result.status).toBe("conflict");
        expect(db.calls("case_study_approve")).toEqual([]);
        expect(stored().approved).toBeNull();
    });

    it("the unaltered copy at the right revision is approved, and what is stored is exactly it", async () => {
        const shown = await loadForApproval(me, studyId);
        if (shown.status !== "ok") throw new Error("expected a check");
        const result = await approveStudy(me, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        expect(result).toMatchObject({ status: "approved", message: M.approved });
        expect(stored().approved).toEqual(shown.check.wouldApprove);
    });

    it("a change committed after the server's own read is still refused by the database", async () => {
        const shown = await loadForApproval(me, studyId);
        if (shown.status !== "ok") throw new Error("expected a check");
        db.beforeNext("case_study_approve", () => { stored().revision += 1; });
        const result = await approveStudy(me, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        expect(result.status).toBe("conflict");
        expect(stored().approved).toBeNull();
    });

    it("if the read before approving will not settle, nothing is approved", async () => {
        const shown = await loadForApproval(me, studyId);
        if (shown.status !== "ok") throw new Error("expected a check");
        let revisionReads = 0;
        const moving: LibraryReader = { ...db.reader, revision: async (user, id) => { revisionReads += 1; if (revisionReads % 2 === 0) stored().revision += 1; return db.reader.revision(user, id); } };
        expect(await approveStudy({ ...me, reader: moving }, { id: studyId, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove })).toEqual({ status: "conflict", message: M.changing });
        expect(db.calls("case_study_approve")).toEqual([]);
    });
});
