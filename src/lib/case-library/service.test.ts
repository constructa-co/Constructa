import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLibrary } from "./__fixtures__/fake-library";
import { approvedValue, newDraft, type CaseStudyContent } from "./content";
import { LIBRARY_MESSAGES as M } from "./messages";
import { approveStudy, archiveDiscipline, archiveStudy, createStudy, loadForApproval, saveDiscipline, saveStudy, startFromOlder, type LibraryContext } from "./service";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const content = (title: string, extra: Partial<CaseStudyContent> = {}): CaseStudyContent => ({ ...newDraft(title), delivered: "We refitted the kitchen.", ...extra });

let db: ReturnType<typeof fakeLibrary>;
let adminMade: number;
const contextFor = (userId: string): LibraryContext => ({ userId, reader: db.reader, admin: () => { adminMade += 1; return db.admin; } });
let me: LibraryContext;

async function kind(label: string, user = me): Promise<string> {
    const result = await saveDiscipline(user, { id: null, revision: 0, label });
    if (result.status !== "saved" || !result.id) throw new Error(`could not add ${label}: ${result.status}`);
    return result.id;
}
async function study(title = "Kitchen", tags: string[] = []): Promise<{ id: string; revision: number }> {
    const result = await createStudy(me, { content: content(title), disciplineIds: tags });
    if (result.status !== "saved" || !result.id) throw new Error(`could not create: ${result.status}`);
    return { id: result.id, revision: result.revision! };
}
const stored = (id: string) => db.studies.find((row) => row.id === id)!;
/** Approves as the screen does: loads the check, then sends back what it showed with the revision it was loaded at. */
async function approve(id: string, context: LibraryContext = me) {
    const shown = await loadForApproval(context, id);
    if (shown.status !== "ok") throw new Error(`the check could not be loaded: ${shown.status}`);
    return approveStudy(context, { id, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
}
const SOME_COPY = approvedValue({ ...newDraft("Any"), delivered: "Any." }, []);
const tagsOf = (id: string) => db.links.filter((link) => link.study === id).map((link) => link.discipline);

beforeEach(() => {
    db = fakeLibrary({ olderByUser: { [ME]: [{ id: "cs-a", projectName: "Older kitchen", client: "Mrs Older", contractValue: "£20,000", whatWeDelivered: "Old words.", photos: ["https://images.example.test/a.jpg"] }, { projectName: "" }, "not an object"] } });
    adminMade = 0;
    me = contextFor(ME);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("validation happens before anything privileged", () => {
    it.each([
        ["a case study with no job name", () => createStudy(me, { content: content(""), disciplineIds: [] }), "invalid"],
        ["a case study with an over-long field", () => createStudy(me, { content: content("Job", { delivered: "d".repeat(5001) }), disciplineIds: [] }), "invalid"],
        ["seven kinds of work", () => createStudy(me, { content: content("Job"), disciplineIds: Array.from({ length: 7 }, (_, n) => `00000000-0000-4000-8000-00000000000${n}`) }), "invalid"],
        ["a tag that is not an id", () => createStudy(me, { content: content("Job"), disciplineIds: ["kitchens"] }), "invalid"],
        ["a save with a malformed id", () => saveStudy(me, { id: "1 OR 1=1", revision: 1, content: content("Job"), disciplineIds: [] }), "not-found"],
        ["an approval without the tick", () => approveStudy(me, { id: "00000000-0000-4000-8000-000000000001", revision: 1, confirmed: false, shown: SOME_COPY }), "unconfirmed"],
        ["an approval with a truthy non-boolean tick", () => approveStudy(me, { id: "00000000-0000-4000-8000-000000000001", revision: 1, confirmed: "yes", shown: SOME_COPY }), "unconfirmed"],
        ["a kind of work with no name", () => saveDiscipline(me, { id: null, revision: 0, label: "   " }), "invalid"],
        ["a kind of work that is too long", () => saveDiscipline(me, { id: null, revision: 0, label: "k".repeat(81) }), "invalid"],
        ["an archive with a malformed id", () => archiveStudy(me, { id: "x", revision: 1, archived: true }), "not-found"],
        ["a start-from-older with a bad place", () => startFromOlder(me, { index: -1 }), "legacy-missing"],
        ["a start-from-older with a non-number", () => startFromOlder(me, { index: "0" }), "legacy-missing"],
    ] as const)("%s is refused without a privileged client or a database function", async (_label, run, status) => {
        expect((await run()).status).toBe(status);
        expect(adminMade).toBe(0);
        expect(db.rpcCalls).toEqual([]);
    });

    it("unknown keys in what is sent are dropped, never stored", async () => {
        const result = await createStudy(me, { content: { ...content("Job"), approved: true, user_id: OTHER, photos: ["https://elsewhere.example/x.jpg"] }, disciplineIds: [] });
        expect(result.status).toBe("saved");
        expect(Object.keys(stored(result.id!).draft).sort()).toEqual(Object.keys(newDraft("x")).sort());
        expect(stored(result.id!).user_id).toBe(ME);
    });

    it("every database call carries the session's contractor and nobody else's", async () => {
        const tag = await kind("Kitchens");
        const { id } = await study("Job", [tag]);
        await saveStudy(me, { id, revision: 2, content: content("Job two"), disciplineIds: [] });
        expect((await approve(id)).status).toBe("approved");
        expect(db.rpcCalls.length).toBeGreaterThan(4);
        for (const call of db.rpcCalls) expect(call.args.p_user_id, call.name).toBe(ME);
    });
});

describe("creating", () => {
    it("adds a draft with the client hidden and no price shown, then its kinds of work", async () => {
        const tag = await kind("Kitchen Installation");
        const result = await createStudy(me, { content: { title: "Kitchen at Example Road" }, disciplineIds: [tag] });
        expect(result).toMatchObject({ status: "saved", revision: 2 });
        expect(stored(result.id!).draft).toMatchObject({ client_display: "hidden", show_value: false, client_named_ok: false });
        expect(stored(result.id!).approved).toBeNull();
        expect(tagsOf(result.id!)).toEqual([tag]);
    });

    it("says so when the case study was added but its kinds of work were not", async () => {
        const tag = await kind("Kitchens");
        db.disciplines[0].archived = true;
        const result = await createStudy(me, { content: content("Job"), disciplineIds: [tag] });
        expect(result).toMatchObject({ status: "partial", message: M.partialTagsRemoved });
        expect(result.id).toBeTruthy();
    });

    it("an add with no answer is not known, and does not say nothing happened", async () => {
        db.failAfter("case_study_create");
        const result = await createStudy(me, { content: content("Job"), disciplineIds: [] });
        expect(result).toEqual({ status: "unknown", message: M.unknownCreate });
        expect(db.studies).toHaveLength(1);
    });

    it("the limit is said plainly", async () => {
        for (let n = 0; n < 50; n += 1) await study(`Job ${n}`);
        expect(await createStudy(me, { content: content("One more"), disciplineIds: [] })).toEqual({ status: "limit", message: M.limitStudies });
    });
});

describe("saving wording and kinds of work", () => {
    it("calls only what differs, chains the revision, and reports saved", async () => {
        const [a, b] = [await kind("Kitchens"), await kind("Tiling")];
        const { id } = await study("Job", [a]);
        db.rpcCalls.length = 0;

        const both = await saveStudy(me, { id, revision: 2, content: content("Job, renamed"), disciplineIds: [a, b] });
        expect(both).toMatchObject({ status: "saved", revision: 4 });
        expect(db.rpcCalls.map((call) => [call.name, call.args.p_expected_revision])).toEqual([["case_study_save_draft", 2], ["case_study_set_disciplines", 3]]);

        db.rpcCalls.length = 0;
        expect(await saveStudy(me, { id, revision: 4, content: content("Job, renamed again"), disciplineIds: [b, a] })).toMatchObject({ status: "saved", revision: 5 });
        expect(db.rpcCalls.map((call) => call.name)).toEqual(["case_study_save_draft"]);

        db.rpcCalls.length = 0;
        expect(await saveStudy(me, { id, revision: 5, content: content("Job, renamed again"), disciplineIds: [a] })).toMatchObject({ status: "saved", revision: 6 });
        expect(db.rpcCalls.map((call) => call.name)).toEqual(["case_study_set_disciplines"]);
    });

    it("a save with nothing new calls nothing, so an approved case study is not marked as changed", async () => {
        const { id } = await study("Job");
        expect((await approve(id)).status).toBe("approved");
        db.rpcCalls.length = 0;
        const result = await saveStudy(me, { id, revision: 1, content: content("Job"), disciplineIds: [] });
        expect(result).toMatchObject({ status: "unchanged", message: M.unchanged, revision: 1 });
        expect(db.rpcCalls).toEqual([]);
        expect(stored(id).revision).toBe(1);
        expect(stored(id).approved_revision).toBe(1);
    });

    it("a double press with the old revision is 'already saved' only when everything matches, including tags and the client choice", async () => {
        const tag = await kind("Kitchens");
        const { id } = await study("Job");
        const sent = { id, revision: 1, content: content("Job, edited", { client_display: "described", client_text: "a homeowner" }), disciplineIds: [tag] };
        expect(await saveStudy(me, sent)).toMatchObject({ status: "saved", revision: 3 });
        db.rpcCalls.length = 0;

        // The same thing again, still naming revision 1.
        expect(await saveStudy(me, sent)).toMatchObject({ status: "unchanged", revision: 3 });
        // Same wording, different tags: not "already saved".
        expect(await saveStudy(me, { ...sent, disciplineIds: [] })).toMatchObject({ status: "conflict", message: M.conflict, revision: 3 });
        // Same tags, the client choice differs: not "already saved".
        expect(await saveStudy(me, { ...sent, content: { ...sent.content, client_display: "hidden", client_text: "" } })).toMatchObject({ status: "conflict" });
        expect(await saveStudy(me, { ...sent, content: { ...sent.content, client_named_ok: true } })).toMatchObject({ status: "conflict" });
        expect(db.rpcCalls).toEqual([]);
    });

    it("a stale tab is told about the conflict, given the latest, and nothing is overwritten", async () => {
        const { id } = await study("Job");
        await saveStudy(me, { id, revision: 1, content: content("Changed elsewhere"), disciplineIds: [] });
        const result = await saveStudy(me, { id, revision: 1, content: content("Typed in the stale tab"), disciplineIds: [] });
        expect(result).toMatchObject({ status: "conflict", revision: 2 });
        expect(result.latest?.content.title).toBe("Changed elsewhere");
        expect(stored(id).draft.title).toBe("Changed elsewhere");
    });

    it("a change that lands between the read and the write is still a conflict", async () => {
        const { id } = await study("Job");
        db.beforeNext("case_study_save_draft", () => { stored(id).draft = content("Raced in"); stored(id).revision += 1; });
        const result = await saveStudy(me, { id, revision: 1, content: content("Mine"), disciplineIds: [] });
        expect(result).toMatchObject({ status: "conflict", revision: 2 });
        expect(result.latest?.content.title).toBe("Raced in");
    });

    it("wording saved, tags refused: says exactly that, with the revision the wording reached", async () => {
        const tag = await kind("Kitchens");
        const { id } = await study("Job");
        db.beforeNext("case_study_set_disciplines", () => { stored(id).revision += 1; });
        const result = await saveStudy(me, { id, revision: 1, content: content("New wording"), disciplineIds: [tag] });
        expect(result).toMatchObject({ status: "partial", message: M.partialTagsRefused, revision: 3 });
        expect(stored(id).draft.title).toBe("New wording");
        expect(tagsOf(id)).toEqual([]);

        const gone = await kind("Tiling");
        db.disciplines.find((row) => row.id === gone)!.archived = true;
        const removed = await saveStudy(me, { id, revision: 3, content: content("Newer wording"), disciplineIds: [gone] });
        expect(removed).toMatchObject({ status: "partial", message: M.partialTagsRemoved });
        expect(stored(id).draft.title).toBe("Newer wording");
    });

    describe("when a call fails without an answer", () => {
        it("wording call, and the write DID land: confirmed saved by reading, then the tags are saved too", async () => {
            const tag = await kind("Kitchens");
            const { id } = await study("Job");
            db.failAfter("case_study_save_draft");
            const result = await saveStudy(me, { id, revision: 1, content: content("Landed"), disciplineIds: [tag] });
            expect(result).toMatchObject({ status: "saved", revision: 3 });
            expect(stored(id).draft.title).toBe("Landed");
            expect(tagsOf(id)).toEqual([tag]);
        });

        it("wording call, and the write did NOT land: not known, and never 'nothing changed'", async () => {
            const { id } = await study("Job");
            db.failBefore("case_study_save_draft");
            const result = await saveStudy(me, { id, revision: 1, content: content("Lost"), disciplineIds: [] });
            expect(result).toMatchObject({ status: "unknown", message: M.unknownNotSeen, revision: 1 });
            expect(result.message).not.toMatch(/nothing (was )?changed/i);
            expect(result.latest?.content.title).toBe("Job");
        });

        it("wording call, and the follow-up read fails too: not known", async () => {
            const { id } = await study("Job");
            db.failAfter("case_study_save_draft");
            const reads = db.readCalls.length;
            db.reader.study = new Proxy(db.reader.study, { apply: (target, self, args) => (db.readCalls.length - reads >= 2 ? Promise.resolve({ state: "unavailable" as const }) : Reflect.apply(target, self, args)) });
            const result = await saveStudy(me, { id, revision: 1, content: content("Landed, unseen"), disciplineIds: [] });
            expect(result).toEqual({ status: "unknown", message: M.unknown });
            expect(stored(id).draft.title).toBe("Landed, unseen");
        });

        it("tags call, and the write DID land: saved, not 'kinds of work were not saved'", async () => {
            const tag = await kind("Kitchens");
            const { id } = await study("Job");
            db.failAfter("case_study_set_disciplines");
            const result = await saveStudy(me, { id, revision: 1, content: content("New wording"), disciplineIds: [tag] });
            expect(result).toMatchObject({ status: "saved", message: M.saved, revision: 3 });
            expect(result.latest?.disciplineIds).toEqual([tag]);
        });

        it("tags call, and the write did NOT land: wording saved, tags currently show as not saved", async () => {
            const tag = await kind("Kitchens");
            const { id } = await study("Job");
            db.failBefore("case_study_set_disciplines");
            const result = await saveStudy(me, { id, revision: 1, content: content("New wording"), disciplineIds: [tag] });
            expect(result).toMatchObject({ status: "partial", message: M.partialTagsUnknown, revision: 2 });
            expect(result.message).not.toMatch(/nothing (was )?changed/i);
            expect(stored(id).draft.title).toBe("New wording");
        });

        it("tags only, no answer and not landed: not known rather than a false partial", async () => {
            const tag = await kind("Kitchens");
            const { id } = await study("Job");
            db.failBefore("case_study_set_disciplines");
            const result = await saveStudy(me, { id, revision: 1, content: content("Job"), disciplineIds: [tag] });
            expect(result).toMatchObject({ status: "unknown", message: M.unknownNotSeen });
        });
    });

    it("the functions being absent is 'not available', and nothing is claimed", async () => {
        const { id } = await study("Job");
        db.setUnavailable(true);
        expect(await saveStudy(me, { id, revision: 1, content: content("New"), disciplineIds: [] })).toEqual({ status: "unavailable", message: M.unavailable });
        expect(await createStudy(me, { content: content("New"), disciplineIds: [] })).toEqual({ status: "unavailable", message: M.unavailable });
        expect(await saveDiscipline(me, { id: null, revision: 0, label: "Roofing" })).toEqual({ status: "unavailable", message: M.unavailable });
    });

    it("archived kinds of work already on a case study are left alone by a wording-only save", async () => {
        const tag = await kind("Kitchens");
        const { id } = await study("Job", [tag]);
        await archiveDiscipline(me, { id: tag, revision: 1, archived: true });
        db.rpcCalls.length = 0;
        const result = await saveStudy(me, { id, revision: stored(id).revision, content: content("Reworded"), disciplineIds: [] });
        expect(result.status).toBe("saved");
        expect(db.rpcCalls.map((call) => call.name)).toEqual(["case_study_save_draft"]);
        expect(tagsOf(id)).toEqual([tag]);
    });
});

describe("another contractor's rows", () => {
    it("are 'not available' for every action, with nothing about them returned", async () => {
        const theirs = contextFor(OTHER);
        const theirTag = await kind("Their trade", theirs);
        const created = await createStudy(theirs, { content: content("Their job", { client_text: "Their client" }), disciplineIds: [theirTag] });
        const id = created.id!;

        const attempts = [
            await saveStudy(me, { id, revision: 2, content: content("Mine now"), disciplineIds: [] }),
            await approveStudy(me, { id, revision: 2, confirmed: true, shown: SOME_COPY }),
            await archiveStudy(me, { id, revision: 2, archived: true }),
            await loadForApproval(me, id),
            await saveDiscipline(me, { id: theirTag, revision: 1, label: "Renamed" }),
            await archiveDiscipline(me, { id: theirTag, revision: 1, archived: true }),
        ];
        for (const attempt of attempts) {
            expect(attempt.status).toBe("not-found");
            expect(JSON.stringify(attempt)).not.toMatch(/Their|revision/);
        }
        expect(stored(id)).toMatchObject({ user_id: OTHER, revision: 2, archived: false, approved: null });
        expect(stored(id).draft.title).toBe("Their job");
        // And their kind of work cannot be used as a tag.
        const mine = await study("My job");
        expect(await saveStudy(me, { id: mine.id, revision: 1, content: content("My job"), disciplineIds: [theirTag] })).toMatchObject({ status: "conflict" });
        expect(tagsOf(mine.id)).toEqual([]);
    });
});

describe("check and approve", () => {
    it("shows the approved copy that would be made from what is saved now", async () => {
        const [b, a] = [await kind("Tiling"), await kind("Kitchens")];
        const { id } = await study("Job", [a, b]);
        await saveStudy(me, { id, revision: 2, content: content("Job", { client_text: "Mrs Private", value_text: "£9,000" }), disciplineIds: [a, b] });
        const result = await loadForApproval(me, id);
        if (result.status !== "ok") throw new Error("expected a check");
        expect(result.check.labels).toEqual(["Tiling", "Kitchens"]);
        expect(result.check.wouldApprove).toMatchObject({ client_display: "hidden", client_text: "", show_value: false, value_text: "", disciplines: ["Tiling", "Kitchens"] });
        expect(JSON.stringify(result.check.wouldApprove)).not.toContain("Mrs Private");
        expect(result.check.problem).toBeNull();
        expect(adminMade, "checking uses no privileged client beyond earlier writes").toBe(db.rpcCalls.length);
    });

    it("approves the revision shown, and what is stored equals what was shown", async () => {
        const tag = await kind("Kitchens");
        const { id } = await study("Job", [tag]);
        const shown = await loadForApproval(me, id);
        if (shown.status !== "ok") throw new Error("expected a check");
        const result = await approveStudy(me, { id, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        expect(result).toMatchObject({ status: "approved", message: M.approved });
        expect(stored(id).approved).toEqual(shown.check.wouldApprove);
        expect(result.latest?.approved).toEqual(shown.check.wouldApprove);
    });

    it("is refused, and nothing approved, when a kind of work was renamed after the check was loaded", async () => {
        const tag = await kind("Kitchens");
        const { id } = await study("Job", [tag]);
        const shown = await loadForApproval(me, id);
        if (shown.status !== "ok") throw new Error("expected a check");
        await saveDiscipline(me, { id: tag, revision: 1, label: "Kitchen Installation" });
        const result = await approveStudy(me, { id, revision: shown.check.study.revision, confirmed: true, shown: shown.check.wouldApprove });
        expect(result).toMatchObject({ status: "conflict", message: M.approveConflict });
        expect(stored(id).approved).toBeNull();
    });

    it("naming a client needs their agreement, said in words about the right box", async () => {
        const created = await createStudy(me, { content: content("Job", { client_display: "named", client_text: "Mrs Patel" }), disciplineIds: [] });
        const check = await loadForApproval(me, created.id!);
        expect(check.status === "ok" && check.check.problem).toContain("confirm that they've agreed");
        if (check.status !== "ok") throw new Error("expected a check");
        expect(await approveStudy(me, { id: created.id!, revision: 1, confirmed: true, shown: check.check.wouldApprove })).toMatchObject({ status: "not-approvable", field: "client_text" });
        // Whatever is sent back, the agreement is read from what is saved, by the database. Nothing is approved without it.
        expect(await approveStudy(me, { id: created.id!, revision: 1, confirmed: true, shown: { ...check.check.wouldApprove, client_named_ok: true } })).toMatchObject({ status: "not-approvable" });
        expect(stored(created.id!).approved).toBeNull();
    });

    it("an approval with no answer is 'approved' only if the saved copy says so", async () => {
        const first = await study("Landed");
        db.failAfter("case_study_approve");
        expect(await approve(first.id)).toMatchObject({ status: "approved" });
        const second = await study("Lost");
        db.failBefore("case_study_approve");
        expect(await approve(second.id)).toMatchObject({ status: "unknown", message: M.unknown });
        expect(stored(second.id).approved).toBeNull();
    });

    it("an archived case study cannot be approved", async () => {
        const { id } = await study("Job");
        expect(await archiveStudy(me, { id, revision: 1, archived: true })).toMatchObject({ status: "saved", revision: 2, message: M.archivedOk });
        expect(await approve(id)).toMatchObject({ status: "archived" });
        expect(db.calls("case_study_approve"), "refused before the database is asked").toEqual([]);
    });
});

describe("kinds of work", () => {
    it("adds at the end, renames with the revision shown, and refuses a stale rename", async () => {
        const first = await kind("Kitchens");
        const second = await kind("Tiling");
        expect(db.disciplines.map((row) => [row.label, row.position])).toEqual([["Kitchens", 0], ["Tiling", 1]]);
        expect(await saveDiscipline(me, { id: second, revision: 1, label: "  Wall   tiling " })).toMatchObject({ status: "saved", revision: 2 });
        expect(db.disciplines[1]).toMatchObject({ label: "Wall tiling", position: 1 });
        expect(await saveDiscipline(me, { id: second, revision: 1, label: "Floor tiling" })).toMatchObject({ status: "conflict", revision: 2 });
        expect(db.disciplines[1].label).toBe("Wall tiling");
        expect(await saveDiscipline(me, { id: first, revision: 1, label: "wall TILING" })).toMatchObject({ status: "duplicate", message: M.duplicateDiscipline });
        // The same name again changes nothing and is not an error.
        expect(await saveDiscipline(me, { id: second, revision: 2, label: "Wall tiling" })).toMatchObject({ status: "saved", revision: 2 });
    });

    it("archives and brings back with the revision shown, and returns the current list", async () => {
        const id = await kind("Kitchens");
        const archived = await archiveDiscipline(me, { id, revision: 1, archived: true });
        expect(archived).toMatchObject({ status: "saved", revision: 2, message: M.archivedOk });
        expect(archived.disciplines).toEqual([{ id, label: "Kitchens", position: 0, revision: 2, archived: true }]);
        expect(await archiveDiscipline(me, { id, revision: 1, archived: false })).toMatchObject({ status: "conflict", revision: 2 });
        expect(await archiveDiscipline(me, { id, revision: 2, archived: false })).toMatchObject({ status: "saved", revision: 3, message: M.restoredOk });
    });

    it("the limit of twelve is said plainly", async () => {
        for (let n = 0; n < 12; n += 1) await kind(`Trade ${n}`);
        expect(await saveDiscipline(me, { id: null, revision: 0, label: "Thirteenth" })).toMatchObject({ status: "limit", message: M.limitDisciplines });
    });
});

describe("starting from an older case study", () => {
    it("makes a draft from the server's own read: client hidden, no price, no pictures; the older entry untouched", async () => {
        const before = structuredClone(db.older[ME]);
        const result = await startFromOlder(me, { index: 0 });
        expect(result).toMatchObject({ status: "saved", revision: 1 });
        const row = stored(result.id!);
        expect(row.legacy_index).toBe(0);
        expect(row.draft).toMatchObject({ title: "Older kitchen", delivered: "Old words.", client_display: "hidden", client_text: "Mrs Older", show_value: false, value_text: "£20,000" });
        expect(JSON.stringify(row.draft)).not.toContain("images.example.test");
        expect(row.approved).toBeNull();
        expect(db.older[ME]).toEqual(before);
        expect(db.calls("case_study_create")[0].args).toMatchObject({ p_user_id: ME, p_legacy_index: 0 });
    });

    it("refuses a second start, an entry without a name, something that is not an entry, and a place past the end", async () => {
        await startFromOlder(me, { index: 0 });
        expect(await startFromOlder(me, { index: 0 })).toMatchObject({ status: "already-adopted", message: M.alreadyAdopted });
        expect(await startFromOlder(me, { index: 1 })).toMatchObject({ status: "invalid", message: M.olderNoTitle });
        expect(await startFromOlder(me, { index: 2 })).toMatchObject({ status: "legacy-missing" });
        expect(await startFromOlder(me, { index: 9 })).toMatchObject({ status: "legacy-missing" });
    });

    it("the older entry can change between the two reads: the draft is the server's read, and no match is claimed", async () => {
        db.beforeNext("case_study_create", () => { (db.older[ME][0] as Record<string, unknown>).projectName = "Renamed in the older editor"; });
        const result = await startFromOlder(me, { index: 0 });
        expect(result.status).toBe("saved");
        expect(stored(result.id!).draft.title).toBe("Older kitchen");
        expect(result.message).toBe(M.saved);
        expect(JSON.stringify(result)).not.toMatch(/match|same as|identical/i);
    });

    it("looks only in the contractor's own older list", async () => {
        expect(await startFromOlder(contextFor(OTHER), { index: 0 })).toMatchObject({ status: "legacy-missing" });
    });
});
