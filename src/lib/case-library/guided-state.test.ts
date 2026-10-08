import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLibrary } from "./__fixtures__/fake-library";
import { newDraft, type CaseStudyContent } from "./content";
import { isDirty } from "./editor-state";
import { GUIDED_MESSAGES, dirtyQuestions } from "./guided";
import { DEPTH_KEYS, DEPTH_MESSAGES, LEAD_IN, NOTE_MAX, NO_NOTES, add as addParagraph, canAdd, present, room, type DepthKey } from "./guided-depth";
import { guidedReducer, initialGuidedState, mayLeave, planSave, requestOf, unappliedNames, unsavedOrUnapplied, type AfterSave, type GuidedAction, type GuidedState, type LeaveTo, type Screen } from "./guided-state";
import { LIBRARY_MESSAGES as M } from "./messages";
import { approveStudy, createStudy, loadForApproval, saveDiscipline, saveStudy, viewOf, type LibraryContext, type LibraryResult, type StudyView } from "./service";
import { readStudyAtOneRevision } from "./store";

/**
 * The guided screen's rules, run against the real library service over the
 * in-memory library. `session` does exactly what the screen does: asks the
 * rules what a save would send, makes that one request, and hands the answer
 * back.
 */
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: ReturnType<typeof fakeLibrary>;
let adminMade: number;
let me: LibraryContext;

function session(view: StudyView | null) {
    let state = initialGuidedState(view);
    const requests: Array<"create" | "save"> = [];
    /** Every body that was actually sent, for checking that a note never is. */
    const sent: Array<{ content: CaseStudyContent; disciplineIds: string[] }> = [];
    const d = (action: GuidedAction) => { state = guidedReducer(state, action); };
    return {
        get state(): GuidedState { return state; },
        requests,
        sent,
        d,
        type: (content: Partial<CaseStudyContent>) => d({ type: "edit", content }),
        tags: (disciplineIds: string[]) => d({ type: "edit", disciplineIds }),
        note: (key: DepthKey, text: string) => d({ type: "note/type", key, text }),
        add: (key: DepthKey) => d({ type: "note/add", key }),
        /**
         * Starts a save and returns a function that delivers the reply, so a test can do things in between.
         * As the screen does: it asks the rules to start one, and sends ONLY what the state then says was sent.
         */
        begin: async (then: AfterSave, again = false) => {
            const before = state.editor.saving?.token ?? null;
            d({ type: "save/start", then, again });
            const request = requestOf(state);
            if (!request || request.token === before) return null;
            requests.push(request.kind);
            sent.push(structuredClone({ content: request.content, disciplineIds: request.disciplineIds }));
            const reply: Promise<LibraryResult> = request.kind === "save"
                ? saveStudy(me, { id: request.id, revision: request.revision, content: request.content, disciplineIds: request.disciplineIds })
                : createStudy(me, { content: request.content, disciplineIds: request.disciplineIds });
            return async () => { const result = await reply; d({ type: "save/reply", token: request.token, result }); return result; };
        },
        async save(then: AfterSave, again = false) {
            const finish = await this.begin(then, again);
            return finish ? finish() : null;
        },
    };
}

const FULL: CaseStudyContent = { version: 1, title: "Kitchen refit", work_type: "Refurbishment", place: "Leeds", client_display: "named", client_text: "Mrs Example", client_named_ok: true, value_text: "£18,500", show_value: true, duration_text: "3 weeks", delivered: "We refitted it.", value_added: "More room." };
const stored = (id: string) => db.studies.find((row) => row.id === id)!;
const tagsOf = (id: string) => db.links.filter((link) => link.study === id).map((link) => link.discipline).sort();
const names = () => db.rpcCalls.map((call) => call.name);

async function kind(label: string): Promise<string> {
    const result = await saveDiscipline(me, { id: null, revision: 0, label });
    return result.id!;
}
/** A saved case study with every field filled, and the screen opened on it as the page would open it. */
async function existing(content: CaseStudyContent = FULL, tags: string[] = []) {
    const created = await createStudy(me, { content, disciplineIds: tags });
    const read = await readStudyAtOneRevision(db.reader, ME, created.id!);
    if (read.state !== "ok") throw new Error("could not read");
    db.rpcCalls.length = 0;
    return { id: created.id!, s: session(viewOf(read.study, read.disciplines)) };
}
const next = { kind: "question", key: "kinds" } as const;

beforeEach(() => {
    db = fakeLibrary();
    adminMade = 0;
    me = { userId: ME, reader: db.reader, admin: () => { adminMade += 1; return db.admin; } };
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a new case study", () => {
    it("opens on the job name, and nothing else can be reached or saved until it has one", async () => {
        const s = session(null);
        expect(s.state.screen).toEqual({ kind: "question", key: "title" });
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        expect(s.state.screen).toEqual({ kind: "question", key: "title" });
        expect(s.state.local).toEqual({ key: "title", message: GUIDED_MESSAGES.titleNeeded });
        s.d({ type: "go", screen: { kind: "summary" } });
        s.d({ type: "go", screen: { kind: "done" } });
        expect(s.state.screen).toEqual({ kind: "question", key: "title" });

        expect(await s.save(next)).toBeNull();
        s.type({ title: "   " });
        expect(await s.save(next)).toBeNull();
        expect(s.requests).toEqual([]);
        expect(adminMade).toBe(0);
        expect(db.rpcCalls).toEqual([]);
        expect(s.state.editor.draft.content.title).toBe("   ");
    });

    it("is created by the first save, with the safe defaults and nothing else, and only then moves on", async () => {
        const s = session(null);
        s.type({ title: "Kitchen refit" });
        const result = await s.save(next);
        expect(result).toMatchObject({ status: "saved", revision: 1 });
        expect(names()).toEqual(["case_study_create"]);
        expect(stored(result!.id!).draft).toEqual(newDraft("Kitchen refit"));
        expect(tagsOf(result!.id!)).toEqual([]);
        expect(s.state.screen).toEqual(next);
        expect(s.state.editor).toMatchObject({ id: result!.id, revision: 1 });
        expect(isDirty(s.state.editor)).toBe(false);
        expect(stored(result!.id!).approved).toBeNull();
    });

    it("spaces round the job name are removed in the box itself, so what is shown is what is saved", async () => {
        const s = session(null);
        s.type({ title: "  Kitchen refit " });
        const result = await s.save(next);
        expect(s.state.editor.draft.content.title).toBe("Kitchen refit");
        expect(stored(result!.id!).draft.title).toBe("Kitchen refit");
        expect(isDirty(s.state.editor)).toBe(false);
    });
});

describe("a first create that got no answer", () => {
    it("stops: no automatic retry, no move, and a plain save sends nothing more", async () => {
        const s = session(null);
        s.type({ title: "Kitchen refit" });
        db.failAfter("case_study_create");
        const result = await s.save(next);
        expect(result).toEqual({ status: "unknown", message: M.unknownCreate });
        expect(s.state).toMatchObject({ createUnknown: true, screen: { kind: "question", key: "title" } });
        expect(s.state.editor.id).toBeNull();
        expect(s.state.editor.draft.content.title).toBe("Kitchen refit");

        expect(await s.save(next)).toBeNull();
        expect(await s.save(null)).toBeNull();
        expect(s.requests).toEqual(["create"]);
        expect(db.calls("case_study_create")).toHaveLength(1);
        // It did land. The screen cannot know that, and does not claim either way.
        expect(db.studies).toHaveLength(1);
    });

    it("adding it again is the contractor's explicit choice, and CAN make a second copy: no promise is made that it will not", async () => {
        const s = session(null);
        s.type({ title: "Kitchen refit" });
        db.failAfter("case_study_create");
        await s.save(next);
        const again = await s.save(next, true);
        expect(again).toMatchObject({ status: "saved" });
        expect(db.studies.map((row) => row.draft.title)).toEqual(["Kitchen refit", "Kitchen refit"]);
        expect(s.state).toMatchObject({ createUnknown: false, screen: next });
        expect(GUIDED_MESSAGES.createAgainWarning).toContain("We can't promise that won't make a second copy.");
    });

    it("when it never reached the database, adding it again makes exactly one", async () => {
        const s = session(null);
        s.type({ title: "Kitchen refit" });
        db.failBefore("case_study_create");
        expect((await s.save(next))!.status).toBe("unknown");
        expect(s.state.createUnknown).toBe(true);
        await s.save(next, true);
        expect(db.studies).toHaveLength(1);
    });
});

describe("each answer changes its own field and nothing else", () => {
    it.each([
        ["title", { title: "Kitchen and utility" }],
        ["delivered", { delivered: "New words.\n\n  Kept exactly,  with   spacing.\n" }],
        ["value_added", { value_added: "They could cook again." }],
        ["place", { place: " York " }],
        ["duration_text", { duration_text: "about 3 weeks" }],
    ] as Array<[keyof CaseStudyContent, Partial<CaseStudyContent>]>)("%s", async (field, patch) => {
        const k1 = await kind("Kitchens");
        const { id, s } = await existing(FULL, [k1]);
        s.type(patch);
        const result = await s.save({ kind: "summary" });
        expect(result!.status).toBe("saved");
        // Everything untouched, including the type of work, the client's consent and the price, is as it was.
        expect(stored(id).draft).toEqual({ ...FULL, ...patch });
        expect(stored(id).draft[field]).toBe(patch[field]);
        expect(tagsOf(id)).toEqual([k1]);
        expect(names()).toEqual(["case_study_save_draft"]);
    });

    it("kinds of work alone: the wording is not rewritten", async () => {
        const k1 = await kind("Kitchens");
        const k2 = await kind("Tiling");
        const { id, s } = await existing(FULL, [k1]);
        s.tags([k1, k2]);
        expect((await s.save(null))!.status).toBe("saved");
        expect(names()).toEqual(["case_study_set_disciplines"]);
        expect(tagsOf(id)).toEqual([k1, k2].sort());
        expect(stored(id).draft).toEqual(FULL);
    });

    it("a new case study starts with no kinds of work, whatever other case studies have", async () => {
        const k1 = await kind("Kitchens");
        await createStudy(me, { content: FULL, disciplineIds: [k1] });
        const s = session(null);
        expect(s.state.editor.draft.disciplineIds).toEqual([]);
        s.type({ title: "Loft" });
        const result = await s.save(next);
        expect(tagsOf(result!.id!)).toEqual([]);
        expect(db.calls("case_study_set_disciplines")).toHaveLength(1); // the other case study's, from the setup
    });

    it("naming a client never sets their agreement: only that answer does", async () => {
        const { id, s } = await existing({ ...FULL, client_display: "hidden", client_text: "", client_named_ok: false });
        s.type({ client_display: "named", client_text: "Mrs Example" });
        await s.save(null);
        expect(stored(id).draft).toMatchObject({ client_display: "named", client_named_ok: false });
        // Saved as a draft; the existing approval rule is what refuses it.
        const check = await loadForApproval(me, id);
        expect(check.status === "ok" && check.check.problem).toBe("To name the client, confirm that they've agreed to be named. Or choose not to name them.");
    });

    it("an approved case study: the questions change the draft only; the approved copy and its revision stay", async () => {
        const { id, s } = await existing({ ...FULL, client_display: "hidden", client_text: "", client_named_ok: false });
        const check = await loadForApproval(me, id);
        if (check.status !== "ok") throw new Error("no check");
        await approveStudy(me, { id, revision: check.check.study.revision, confirmed: true, shown: check.check.wouldApprove });
        const approvedBefore = structuredClone(stored(id).approved);
        db.rpcCalls.length = 0;
        s.type({ delivered: "Reworded later." });
        expect((await s.save(null))!.status).toBe("saved");
        expect(stored(id).approved).toEqual(approvedBefore);
        expect(stored(id).approved_revision).toBe(1);
        expect(stored(id).revision).toBe(2);
        expect(names()).toEqual(["case_study_save_draft"]);
    });
});

describe("moving about", () => {
    it("Back, Skip and jumping make no request and clear nothing", async () => {
        const { s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "York" });
        s.d({ type: "go", screen: { kind: "question", key: "value_added" } });
        s.d({ type: "go", screen: { kind: "question", key: "duration" } });
        s.d({ type: "go", screen: { kind: "summary" } });
        s.d({ type: "go", screen: { kind: "done" } });
        expect(s.requests).toEqual([]);
        expect(db.rpcCalls).toEqual([]);
        expect(db.readCalls.filter((name) => name !== "library")).toHaveLength(4); // the page's own opening read only
        expect(s.state.editor.draft.content).toEqual({ ...FULL, place: "York" });
        expect(dirtyQuestions(s.state.editor)).toEqual(["place"]);
    });

    it("several unsaved answers are saved together by one save, and the screen can say which", async () => {
        const { id, s } = await existing();
        s.type({ place: "York" });
        s.d({ type: "go", screen: { kind: "question", key: "duration" } });
        s.type({ duration_text: "4 weeks" });
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        s.type({ delivered: "Different." });
        expect(dirtyQuestions(s.state.editor)).toEqual(["delivered", "place", "duration"]);
        await s.save({ kind: "question", key: "value_added" });
        expect(s.requests).toEqual(["save"]);
        expect(stored(id).draft).toEqual({ ...FULL, place: "York", duration_text: "4 weeks", delivered: "Different." });
        expect(dirtyQuestions(s.state.editor)).toEqual([]);
    });

    it("clearing a box and saving is the only way an answer is removed", async () => {
        const { id, s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.d({ type: "go", screen: { kind: "question", key: "duration" } });
        expect(stored(id).draft.place).toBe("Leeds");
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "" });
        expect(stored(id).draft.place).toBe("Leeds");
        await s.save(null);
        expect(stored(id).draft.place).toBe("");
    });

    it("with nothing to save, 'save and go' simply goes, with no request", async () => {
        const { s } = await existing();
        expect(await s.save({ kind: "leave", to: "form" })).toBeNull();
        expect(s.state.leave).toBe("form");
        expect(s.requests).toEqual([]);
    });
});

describe("Next moves on only when the save is confirmed", () => {
    it("too long: refused here, before any request, and not shortened", async () => {
        const { s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        s.type({ delivered: "d".repeat(5001) });
        expect(await s.save({ kind: "question", key: "value_added" })).toBeNull();
        expect(s.requests).toEqual([]);
        expect(s.state.screen).toEqual({ kind: "question", key: "delivered" });
        expect(s.state.local).toEqual({ key: "delivered", message: "Keep what you did to 5,000 characters." });
        expect(s.state.editor.draft.content.delivered).toHaveLength(5001);
    });

    it("a refusal from the server stays put with the typing intact", async () => {
        const { id, s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "York" });
        // The database refuses what the screen's own check passed.
        const original = db.admin.rpc;
        db.admin.rpc = async (name: string, args: Record<string, unknown>) => (name === "case_study_save_draft" ? { data: { outcome: "invalid", problem: "place" }, error: null } : original(name, args));
        const result = await s.save({ kind: "question", key: "duration" });
        expect(result).toMatchObject({ status: "invalid", field: "place" });
        expect(s.state.screen).toEqual({ kind: "question", key: "place" });
        expect(s.state.editor.draft.content.place).toBe("York");
        expect(s.state.editor.notice).toMatchObject({ kind: "failed", field: "place" });
        expect(stored(id).draft.place).toBe("Leeds");
    });

    it("not known: stays put; and because it has an id, trying again finds the earlier write and does not write twice", async () => {
        const { id, s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "York" });
        // The write lands, its answer is lost, and the look afterwards fails too.
        db.failAfter("case_study_save_draft");
        db.beforeNext("case_study_save_draft", () => db.failRead("*"));
        const first = await s.save({ kind: "question", key: "duration" });
        expect(first).toEqual({ status: "unknown", message: M.unknown });
        expect(s.state.screen).toEqual({ kind: "question", key: "place" });
        expect(s.state.createUnknown).toBe(false);
        expect(isDirty(s.state.editor)).toBe(true);
        expect(stored(id).draft.place).toBe("York");

        const second = await s.save({ kind: "question", key: "duration" });
        expect(second).toMatchObject({ status: "unchanged", message: M.unchanged, revision: 2 });
        expect(db.calls("case_study_save_draft")).toHaveLength(1);
        expect(s.state.screen).toEqual({ kind: "question", key: "duration" });
        expect(s.state.editor.revision).toBe(2);
        expect(isDirty(s.state.editor)).toBe(false);
    });

    it("partly saved: the wording is saved and its revision taken at once; the kinds of work stay unsaved, and the screen stays", async () => {
        const k1 = await kind("Kitchens");
        const { id, s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "kinds" } });
        s.type({ place: "York" });
        s.tags([k1]);
        db.failBefore("case_study_set_disciplines");
        const result = await s.save({ kind: "question", key: "delivered" });
        expect(result!.status).toBe("partial");
        expect(s.state.screen).toEqual({ kind: "question", key: "kinds" });
        expect(stored(id).draft.place).toBe("York");
        expect(tagsOf(id)).toEqual([]);
        expect(s.state.editor.revision).toBe(2);
        expect(dirtyQuestions(s.state.editor)).toEqual(["kinds"]);
        // Trying again saves just the kinds of work, at the revision now held.
        expect((await s.save({ kind: "question", key: "delivered" }))!.status).toBe("saved");
        expect(tagsOf(id)).toEqual([k1]);
        expect(db.calls("case_study_save_draft")).toHaveLength(1);
        expect(s.state.screen).toEqual({ kind: "question", key: "delivered" });
    });

    it("the library is not there: stays put, says so, nothing claimed", async () => {
        const { s } = await existing();
        s.type({ place: "York" });
        db.setUnavailable(true);
        const result = await s.save({ kind: "done" });
        expect(result).toEqual({ status: "unavailable", message: M.unavailable });
        expect(s.state.screen).toEqual({ kind: "summary" });
        expect(s.state.editor.draft.content.place).toBe("York");
        expect(s.state.leave).toBeNull();
    });

    it("save-then-leave leaves only when confirmed", async () => {
        const { s } = await existing();
        s.type({ place: "York" });
        db.setUnavailable(true);
        await s.save({ kind: "leave", to: "list" });
        expect(s.state.leave).toBeNull();
        db.setUnavailable(false);
        await s.save({ kind: "leave", to: "list" });
        expect(s.state.leave).toBe("list");
    });
});

describe("changed somewhere else", () => {
    /** Elsewhere: the wording is rewritten, the client is named with their agreement, and the kinds of work are replaced. */
    async function changeElsewhere(id: string, tags: string[]) {
        const row = stored(id);
        await saveStudy(me, { id, revision: row.revision, content: { ...row.draft, delivered: "Rewritten elsewhere.", client_display: "named", client_text: "Mr Elsewhere", client_named_ok: true }, disciplineIds: tags });
    }
    const START: CaseStudyContent = { ...FULL, client_display: "hidden", client_text: "", client_named_ok: false };

    it("a save from the older copy is refused: it never fetches the newer revision and saves over it", async () => {
        const k1 = await kind("Kitchens");
        const { id, s } = await existing(START);
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "York" });
        await changeElsewhere(id, [k1]);
        const before = structuredClone(stored(id));
        db.rpcCalls.length = 0;

        const result = await s.save({ kind: "question", key: "duration" });
        expect(result!.status).toBe("conflict");
        expect(db.rpcCalls).toEqual([]);
        expect(stored(id)).toEqual(before);
        expect(s.state.screen).toEqual({ kind: "question", key: "place" });
        // The revision held is still the one this screen loaded, until the contractor chooses.
        expect(s.state.editor.revision).toBe(1);
        expect(s.state.editor.latest).toMatchObject({ revision: before.revision });
        // Pressing save again changes nothing either.
        expect((await s.save({ kind: "question", key: "duration" }))!.status).toBe("conflict");
        expect(stored(id)).toEqual(before);
    });

    it("keep my changes: ONLY the answers I changed go on top of the latest; nothing I did not touch is put back", async () => {
        const k1 = await kind("Kitchens");
        const { id, s } = await existing(START);
        s.type({ place: "York", duration_text: "4 weeks" });
        await changeElsewhere(id, [k1]);
        await s.save(null);
        s.d({ type: "latest/keep-mine" });

        expect(s.state.editor.draft.content).toEqual({ ...START, delivered: "Rewritten elsewhere.", client_display: "named", client_text: "Mr Elsewhere", client_named_ok: true, place: "York", duration_text: "4 weeks" });
        expect(s.state.editor.draft.disciplineIds).toEqual([k1]);
        expect(dirtyQuestions(s.state.editor)).toEqual(["place", "duration"]);
        expect(s.state.editor.revision).toBe(stored(id).revision);
        expect(s.state.editor.latest).toBeNull();
        // Nothing is saved by choosing.
        expect(stored(id).draft.place).toBe("Leeds");

        db.rpcCalls.length = 0;
        expect((await s.save(null))!.status).toBe("saved");
        expect(stored(id).draft).toEqual({ ...START, delivered: "Rewritten elsewhere.", client_display: "named", client_text: "Mr Elsewhere", client_named_ok: true, place: "York", duration_text: "4 weeks" });
        expect(tagsOf(id)).toEqual([k1]);
        // The kinds of work were not mine to change, so they are not written.
        expect(names()).toEqual(["case_study_save_draft"]);
    });

    it("keep my changes, when I changed the kinds of work: mine are kept, and the wording I did not touch is the latest", async () => {
        const k1 = await kind("Kitchens");
        const k2 = await kind("Tiling");
        const { id, s } = await existing(START);
        s.tags([k2]);
        await changeElsewhere(id, [k1]);
        await s.save(null);
        s.d({ type: "latest/keep-mine" });
        expect(s.state.editor.draft.disciplineIds).toEqual([k2]);
        expect(s.state.editor.draft.content.delivered).toBe("Rewritten elsewhere.");
        await s.save(null);
        expect(tagsOf(id)).toEqual([k2]);
        expect(stored(id).draft.delivered).toBe("Rewritten elsewhere.");
    });

    it("an agreement to be named that was given elsewhere is not undone by keeping an unrelated change, and one I withdrew stays withdrawn", async () => {
        const { id, s } = await existing(START);
        s.type({ value_added: "Mine." });
        await changeElsewhere(id, []);
        await s.save(null);
        s.d({ type: "latest/keep-mine" });
        await s.save(null);
        expect(stored(id).draft).toMatchObject({ client_display: "named", client_named_ok: true, value_added: "Mine." });

        const other = await existing({ ...FULL });
        other.s.type({ client_display: "described", client_named_ok: false });
        await saveStudy(me, { id: other.id, revision: 1, content: { ...FULL, delivered: "Elsewhere." }, disciplineIds: [] });
        await other.s.save(null);
        other.s.d({ type: "latest/keep-mine" });
        await other.s.save(null);
        expect(stored(other.id).draft).toMatchObject({ client_display: "described", client_named_ok: false, delivered: "Elsewhere." });
    });

    it("use the saved version: what I typed is given up, by my choice, and nothing is written", async () => {
        const k1 = await kind("Kitchens");
        const { id, s } = await existing(START);
        s.type({ place: "York" });
        await changeElsewhere(id, [k1]);
        await s.save(null);
        const before = structuredClone(stored(id));
        db.rpcCalls.length = 0;
        s.d({ type: "latest/use" });
        expect(isDirty(s.state.editor)).toBe(false);
        expect(s.state.editor.draft.content.place).toBe("Leeds");
        expect(s.state.editor.draft.content.delivered).toBe("Rewritten elsewhere.");
        expect(s.state.editor.revision).toBe(before.revision);
        expect(db.rpcCalls).toEqual([]);
        expect(stored(id)).toEqual(before);
    });

    it("being changed at this moment: nothing is saved, nothing moves, the typing stays, and trying again works once it is still", async () => {
        const { id, s } = await existing(START);
        s.type({ place: "York" });
        const real = db.reader.revision;
        let reads = 0;
        db.reader.revision = async (user, study) => { reads += 1; stored(id).revision += 1; return real(user, study); };
        const result = await s.save({ kind: "done" });
        expect(result).toEqual({ status: "conflict", message: M.changing });
        expect(reads).toBe(6);
        expect(db.rpcCalls).toEqual([]);
        expect(s.state.screen).toEqual({ kind: "summary" });
        expect(s.state.editor.draft.content.place).toBe("York");
        expect(s.state.editor.latest).toBeNull();
    });
});

describe("one save at a time", () => {
    it("a second save while one is running sends nothing", async () => {
        const { s } = await existing();
        s.type({ place: "York" });
        const finish = await s.begin(null);
        expect(await s.begin(null)).toBeNull();
        expect(planSave(s.state).refusal).toBe("busy");
        await finish!();
        expect(s.requests).toEqual(["save"]);
        expect(db.calls("case_study_save_draft")).toHaveLength(1);
    });

    it("what is typed while a save is running is kept, and is unsaved afterwards; the revision returned is taken at once", async () => {
        const { id, s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "York" });
        const finish = await s.begin({ kind: "question", key: "duration" });
        s.type({ place: "York, North Yorkshire" });
        s.type({ duration_text: "4 weeks" });
        await finish!();
        expect(stored(id).draft.place).toBe("York");
        expect(s.state.editor.revision).toBe(2);
        expect(s.state.editor.draft.content).toMatchObject({ place: "York, North Yorkshire", duration_text: "4 weeks" });
        expect(dirtyQuestions(s.state.editor)).toEqual(["place", "duration"]);
        // The next save goes at the new revision and is accepted.
        expect((await s.save(null))!.status).toBe("saved");
        expect(stored(id).draft).toMatchObject({ place: "York, North Yorkshire", duration_text: "4 weeks" });
    });

    it("moving by hand while a save is running: the reply still records the save, but does not move the screen again", async () => {
        const { s } = await existing();
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.type({ place: "York" });
        const finish = await s.begin({ kind: "question", key: "duration" });
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        await finish!();
        expect(s.state.screen).toEqual({ kind: "question", key: "delivered" });
        expect(isDirty(s.state.editor)).toBe(false);
        expect(s.state.editor.revision).toBe(2);
    });

    it("a reply that is not from the save now running changes nothing and moves nothing", async () => {
        const { s } = await existing();
        s.type({ place: "York" });
        const before = s.state;
        s.d({ type: "save/reply", token: 99, result: { status: "saved", message: M.saved, revision: 50 } });
        expect(s.state).toBe(before);
        const finish = await s.begin({ kind: "done" });
        const during = s.state;
        s.d({ type: "save/reply", token: 0, result: { status: "saved", message: M.saved, revision: 50 } });
        expect(s.state).toBe(during);
        await finish!();
        expect(s.state.screen).toEqual({ kind: "done" });
        expect(s.state.editor.revision).toBe(2);
    });
});

describe("save and next: it moves on only when nothing typed since is unsaved", () => {
    const START: CaseStudyContent = { ...FULL, client_display: "named", client_text: "Mrs Example", client_named_ok: false };
    const FROM = { kind: "question", key: "place" } as const;
    const TO = { kind: "question", key: "duration" } as const;
    const DURING: Array<[string, (s: ReturnType<typeof session>, kinds: string[]) => void, string[]]> = [
        ["the same answer typed further", (s) => s.type({ place: "York, North Yorkshire" }), ["place"]],
        ["the job name", (s) => s.type({ title: "Renamed while saving" }), ["title"]],
        ["other wording", (s) => s.type({ delivered: "Typed while the save was running." }), ["delivered"]],
        ["kinds of work", (s, kinds) => s.tags([kinds[0]]), ["kinds"]],
        ["the client's agreement to be named", (s) => s.type({ client_named_ok: true }), ["client"]],
        ["whether a price is shown", (s) => s.type({ show_value: false }), ["client"]],
    ];
    const opened = async () => {
        const made = await existing(START);
        made.s.d({ type: "go", screen: FROM });
        made.s.type({ place: "York" });
        return made;
    };

    it.each(DURING)("%s changed while the save was running: it stays on the question it was on, keeps the change as unsaved, and says so", async (_name, change, dirty) => {
        const k1 = await kind("Kitchens");
        const { id, s } = await opened();
        const finish = await s.begin(TO);
        change(s, [k1]);
        const typed = structuredClone(s.state.editor.draft);
        const result = await finish!();

        expect(result!.status).toBe("saved");
        expect(s.state.screen, "the question it was on, not the next one").toEqual(FROM);
        expect(s.state.moveHeld).toBe(true);
        expect(s.state.leave).toBeNull();
        expect(s.state.leaveHeld).toBeNull();
        // What was sent is saved and its revision is held. What was typed since is exactly as typed, and unsaved.
        expect(stored(id).draft).toEqual({ ...START, place: "York" });
        expect(tagsOf(id)).toEqual([]);
        expect(s.state.editor.saved.content).toEqual({ ...START, place: "York" });
        expect(s.state.editor.revision).toBe(2);
        expect(s.state.editor.draft).toEqual(typed);
        expect(dirtyQuestions(s.state.editor)).toEqual(dirty);
        // Nothing was sent again by itself.
        expect(s.requests).toEqual(["save"]);
        expect(s.state.editor.saving).toBeNull();

        // Pressed again, deliberately, with nothing typed meanwhile: it moves on.
        expect((await s.save(TO))!.status).toBe("saved");
        expect(s.state.screen).toEqual(TO);
        expect(s.state.moveHeld).toBe(false);
        expect(isDirty(s.state.editor)).toBe(false);
        expect(s.requests).toEqual(["save", "save"]);
    });

    it("the same when the reply is 'already saved'", async () => {
        const { id, s } = await opened();
        await saveStudy(me, { id, revision: 1, content: { ...START, place: "York" }, disciplineIds: [] });
        const finish = await s.begin(TO);
        s.type({ place: "York, typed further" });
        expect((await finish!())!.status).toBe("unchanged");
        expect(s.state.screen).toEqual(FROM);
        expect(s.state.moveHeld).toBe(true);
        expect(s.state.editor.revision).toBe(2);
        expect(s.state.editor.saved.content.place).toBe("York");
        expect(s.state.editor.draft.content.place).toBe("York, typed further");
    });

    it("the integrator's interleaving: typed, save and next, typed further, confirmed", async () => {
        const { id, s } = await existing({ ...newDraft("Original job") });
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        s.type({ delivered: "Sent text" });
        const finish = await s.begin({ kind: "question", key: "value_added" });
        s.type({ delivered: "New typing after the request started" });
        await finish!();
        expect(s.state.screen).toEqual({ kind: "question", key: "delivered" });
        expect(s.state.moveHeld).toBe(true);
        expect(isDirty(s.state.editor)).toBe(true);
        expect(s.state.editor.draft.content.delivered).toBe("New typing after the request started");
        expect(s.state.editor.saved.content.delivered).toBe("Sent text");
        expect(stored(id).draft.delivered).toBe("Sent text");
    });

    it("nothing typed meanwhile, or typed and put back: it moves on, as before", async () => {
        let { s } = await opened();
        await s.save(TO);
        expect(s.state).toMatchObject({ screen: TO, moveHeld: false });

        ({ s } = await opened());
        const finish = await s.begin(TO);
        s.type({ delivered: "Second thoughts" });
        s.type({ delivered: START.delivered });
        await finish!();
        expect(s.state).toMatchObject({ screen: TO, moveHeld: false });
    });

    it("moving by hand while the save runs: the screen is where the contractor went, and nothing is held", async () => {
        const { s } = await opened();
        const finish = await s.begin(TO);
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        s.type({ delivered: "Typed on the screen I moved to." });
        await finish!();
        expect(s.state.screen).toEqual({ kind: "question", key: "delivered" });
        expect(s.state.moveHeld).toBe(false);
        expect(s.state.editor.draft.content.delivered).toBe("Typed on the screen I moved to.");
        expect(s.state.editor.revision).toBe(2);
    });

    it.each([
        ["refused as changed elsewhere", async (id: string) => { await saveStudy(me, { id, revision: 1, content: { ...START, delivered: "Elsewhere." }, disciplineIds: [] }); }, "conflict"],
        ["not known", async () => { db.failAfter("case_study_save_draft"); db.beforeNext("case_study_save_draft", () => db.failRead("*")); }, "unknown"],
        ["not available", async () => { db.setUnavailable(true); }, "unavailable"],
    ] as Array<[string, (id: string) => Promise<void>, string]>)("a save that is %s stays, keeps the typing, and is not described as an earlier save having worked", async (_name, arrange, status) => {
        const { id, s } = await opened();
        await arrange(id);
        const finish = await s.begin(TO);
        s.type({ place: "York, typed further" });
        expect((await finish!())!.status).toBe(status);
        expect(s.state.screen).toEqual(FROM);
        expect(s.state.moveHeld).toBe(false);
        expect(s.state.editor.draft.content.place).toBe("York, typed further");
    });

    it("partly saved stays and holds no move", async () => {
        const k1 = await kind("Kitchens");
        const { s } = await opened();
        s.tags([k1]);
        db.failBefore("case_study_set_disciplines");
        expect((await s.save(TO))!.status).toBe("partial");
        expect(s.state.screen).toEqual(FROM);
        expect(s.state.moveHeld).toBe(false);
    });

    it("a held move is put down by saving again, by moving by hand and by taking the saved version; typing on does not put it down", async () => {
        const held = async () => {
            const { id, s } = await opened();
            const finish = await s.begin(TO);
            s.type({ place: "York, typed further" });
            await finish!();
            expect(s.state.moveHeld).toBe(true);
            return { id, s };
        };
        let { s } = await held();
        s.type({ place: "York, typed further still" });
        expect(s.state.moveHeld).toBe(true);
        expect(s.state.screen).toEqual(FROM);
        s.d({ type: "go", screen: TO });
        expect(s.state).toMatchObject({ screen: TO, moveHeld: false });
        expect(s.state.editor.draft.content.place).toBe("York, typed further still");

        ({ s } = await held());
        const finish = await s.begin(null);
        expect(s.state.moveHeld).toBe(false);
        await finish!();
        expect(s.state.screen).toEqual(FROM);
    });

    it("typing again during the second save holds it again: never an automatic resend", async () => {
        const { id, s } = await opened();
        let finish = await s.begin(TO);
        s.type({ place: "One" });
        await finish!();
        finish = await s.begin(TO);
        s.type({ place: "Two" });
        await finish!();
        expect(s.state.screen).toEqual(FROM);
        expect(s.state.moveHeld).toBe(true);
        expect(stored(id).draft.place).toBe("One");
        expect(s.state.editor.draft.content.place).toBe("Two");
        expect(s.requests).toEqual(["save", "save"]);
        expect(s.state.editor.revision).toBe(3);
    });

    it("the first save of a new case study, with the name typed further while it runs: created, and still on the name", async () => {
        const s = session(null);
        s.type({ title: "Loft" });
        const finish = await s.begin(next);
        s.type({ title: "Loft conversion" });
        const result = await finish!();
        expect(result!.status).toBe("saved");
        expect(s.state.screen).toEqual({ kind: "question", key: "title" });
        expect(s.state.moveHeld).toBe(true);
        expect(s.state.editor).toMatchObject({ id: result!.id, revision: 1 });
        expect(db.studies).toHaveLength(1);
        expect(db.studies[0].draft.title).toBe("Loft");
        // The next save is a save of that case study, not a second create.
        await s.save(next);
        expect(s.requests).toEqual(["create", "save"]);
        expect(db.studies).toHaveLength(1);
        expect(db.studies[0].draft.title).toBe("Loft conversion");
        expect(s.state.screen).toEqual(next);
    });

    it("with nothing to save, 'save and next' simply moves, with no request and nothing held", async () => {
        const { s } = await existing(START);
        s.d({ type: "go", screen: FROM });
        expect(await s.save(TO)).toBeNull();
        expect(s.state).toMatchObject({ screen: TO, moveHeld: false, after: null });
        expect(s.requests).toEqual([]);
    });
});

describe("leaving with nothing to save: decided at once, and nothing queued behind it can change that", () => {
    it.each(["form", "list"] as LeaveTo[])("to the %s: an edit, a move and a save arriving after it are all ignored", async (to) => {
        const { id, s } = await existing();
        const before = structuredClone(stored(id));
        expect(await s.save({ kind: "leave", to })).toBeNull();
        expect(s.state.leave).toBe(to);
        expect(mayLeave(s.state)).toBe(true);
        const going = s.state;
        // Whatever was already on its way when leaving was decided.
        s.type({ delivered: "A keystroke that arrived after leaving was decided" });
        s.tags(["anything"]);
        s.d({ type: "go", screen: { kind: "question", key: "place" } });
        s.d({ type: "latest/keep-mine" });
        s.d({ type: "leave/stay" });
        s.d({ type: "save/reply", token: 1, result: { status: "saved", message: M.saved, revision: 9 } });
        expect(await s.save(null)).toBeNull();
        expect(await s.save({ kind: "leave", to: to === "form" ? "list" : "form" })).toBeNull();
        expect(s.state, "the very same state: still clean, still leaving to the same place").toBe(going);
        expect(mayLeave(s.state)).toBe(true);
        expect(isDirty(s.state.editor)).toBe(false);
        expect(s.requests).toEqual([]);
        expect(stored(id)).toEqual(before);
    });

    it("an edit that arrives BEFORE leaving is decided stops it: there is no order in which unsaved typing and a leave coexist", async () => {
        const { s } = await existing();
        s.type({ place: "York" });
        // Every ordering of one further edit around the reply.
        for (const editFirst of [true, false]) {
            const made = await existing();
            made.s.type({ place: "York" });
            const finish = await made.s.begin({ kind: "leave", to: "form" });
            if (editFirst) made.s.type({ delivered: "Before the reply" });
            await finish!();
            if (!editFirst) made.s.type({ delivered: "After the reply" });
            const state = made.s.state;
            expect(state.leave !== null && isDirty(state.editor), `edit ${editFirst ? "before" : "after"} the reply`).toBe(false);
            expect(mayLeave(state)).toBe(!editFirst);
        }
        expect(s.state.leave).toBeNull();
    });
});

describe("save, then go: a confirmed save confirms what was SENT, not what is on the screen now", () => {
    const TARGETS: LeaveTo[] = ["form", "list"];
    const START: CaseStudyContent = { ...FULL, client_display: "named", client_text: "Mrs Example", client_named_ok: false };
    /** Something typed, ticked or chosen while the save is on its way. */
    const DURING: Array<[string, (s: ReturnType<typeof session>, kinds: string[]) => void, string[]]> = [
        ["the job name", (s) => s.type({ title: "Renamed while saving" }), ["title"]],
        ["wording", (s) => s.type({ delivered: "Typed while the save was running." }), ["delivered"]],
        ["kinds of work", (s, kinds) => s.tags([kinds[0]]), ["kinds"]],
        ["how the client is shown", (s) => s.type({ client_display: "described", client_named_ok: false }), ["client"]],
        ["the client's agreement to be named", (s) => s.type({ client_named_ok: true }), ["client"]],
        ["whether a price is shown", (s) => s.type({ show_value: false }), ["client"]],
    ];

    describe.each(TARGETS)("to the %s", (to) => {
        it.each(DURING)("%s changed while the save was running: it does not leave, keeps the change as unsaved, and says so", async (_name, change, dirty) => {
            const k1 = await kind("Kitchens");
            const { id, s } = await existing(START);
            s.type({ place: "York" });
            const finish = await s.begin({ kind: "leave", to });
            change(s, [k1]);
            const typed = structuredClone(s.state.editor.draft);
            const result = await finish!();

            expect(result!.status).toBe("saved");
            expect(s.state.leave, "it must not leave").toBeNull();
            expect(mayLeave(s.state)).toBe(false);
            expect(s.state.leaveHeld).toBe(to);
            // What was sent is saved, and its revision is held. What was typed since is exactly as typed, and unsaved.
            expect(stored(id).draft).toEqual({ ...START, place: "York" });
            expect(tagsOf(id)).toEqual([]);
            expect(s.state.editor.revision).toBe(2);
            expect(s.state.editor.draft).toEqual(typed);
            expect(dirtyQuestions(s.state.editor)).toEqual(dirty);
            // No second save was started by itself, and nothing was discarded.
            expect(s.requests).toEqual(["save"]);
            expect(s.state.editor.saving).toBeNull();

            // The contractor saves again, deliberately. With nothing typed meanwhile, it leaves.
            expect((await s.save({ kind: "leave", to }))!.status).toBe("saved");
            expect(s.state.leave).toBe(to);
            expect(mayLeave(s.state)).toBe(true);
            expect(s.state.leaveHeld).toBeNull();
            expect(isDirty(s.state.editor)).toBe(false);
        });

        it("the same when the reply is 'already saved'", async () => {
            const { id, s } = await existing(START);
            s.type({ place: "York" });
            // The same change lands from somewhere else first, so this save finds nothing new to write.
            await saveStudy(me, { id, revision: 1, content: { ...START, place: "York" }, disciplineIds: [] });
            const finish = await s.begin({ kind: "leave", to });
            s.type({ delivered: "Typed while the save was running." });
            const result = await finish!();
            expect(result!.status).toBe("unchanged");
            expect(s.state.leave).toBeNull();
            expect(s.state.leaveHeld).toBe(to);
            expect(s.state.editor.revision).toBe(2);
            expect(s.state.editor.draft.content.delivered).toBe("Typed while the save was running.");
            expect(stored(id).draft.delivered).toBe(START.delivered);
        });

        it("nothing typed meanwhile: it leaves, as before", async () => {
            const { s } = await existing(START);
            s.type({ place: "York" });
            await s.save({ kind: "leave", to });
            expect(s.state.leave).toBe(to);
            expect(s.state.leaveHeld).toBeNull();
            expect(mayLeave(s.state)).toBe(true);
        });

        it("typed and then put back before the reply: nothing is unsaved, so it leaves", async () => {
            const { s } = await existing(START);
            s.type({ place: "York" });
            const finish = await s.begin({ kind: "leave", to });
            s.type({ delivered: "Second thoughts" });
            s.type({ delivered: START.delivered });
            await finish!();
            expect(s.state.leave).toBe(to);
        });

        it.each([
            ["refused as changed elsewhere", async (id: string) => { await saveStudy(me, { id, revision: 1, content: { ...START, delivered: "Elsewhere." }, disciplineIds: [] }); }, "conflict"],
            ["not known", async () => { db.failAfter("case_study_save_draft"); db.beforeNext("case_study_save_draft", () => db.failRead("*")); }, "unknown"],
            ["not available", async () => { db.setUnavailable(true); }, "unavailable"],
        ] as Array<[string, (id: string) => Promise<void>, string]>)("a save that is %s stays put, with or without new typing, and holds no leave", async (_name, arrange, status) => {
            for (const typeMore of [false, true]) {
                db = fakeLibrary();
                me = { userId: ME, reader: db.reader, admin: () => db.admin };
                const { id, s } = await existing(START);
                s.type({ place: "York" });
                await arrange(id);
                const finish = await s.begin({ kind: "leave", to });
                if (typeMore) s.type({ value_added: "More." });
                expect((await finish!())!.status).toBe(status);
                expect(s.state.leave).toBeNull();
                expect(s.state.leaveHeld).toBeNull();
                expect(s.state.editor.draft.content.place).toBe("York");
                if (typeMore) expect(s.state.editor.draft.content.value_added).toBe("More.");
            }
        });

        it("partly saved stays put and holds no leave", async () => {
            const k1 = await kind("Kitchens");
            const { s } = await existing(START);
            s.type({ place: "York" });
            s.tags([k1]);
            db.failBefore("case_study_set_disciplines");
            expect((await s.save({ kind: "leave", to }))!.status).toBe("partial");
            expect(s.state.leave).toBeNull();
            expect(s.state.leaveHeld).toBeNull();
        });
    });

    it("the integrator's interleaving: renamed, save and open the full form, more typed, confirmed", async () => {
        const { id, s } = await existing({ ...newDraft("Original job") });
        s.type({ title: "Renamed job" });
        const finish = await s.begin({ kind: "leave", to: "form" });
        s.type({ delivered: "New typing after the request started" });
        await finish!();
        expect(isDirty(s.state.editor)).toBe(true);
        expect(s.state.leave).toBeNull();
        expect(s.state.leaveHeld).toBe("form");
        expect(s.state.editor.draft.content.delivered).toBe("New typing after the request started");
        expect(stored(id).draft).toEqual(newDraft("Renamed job"));
    });

    it("moving by hand while the save runs gives up the leave altogether: nothing is held, nothing leaves", async () => {
        const { s } = await existing(START);
        s.type({ place: "York" });
        const finish = await s.begin({ kind: "leave", to: "list" });
        s.d({ type: "go", screen: { kind: "question", key: "delivered" } });
        await finish!();
        expect(s.state.leave).toBeNull();
        expect(s.state.leaveHeld).toBeNull();
        expect(s.state.screen).toEqual({ kind: "question", key: "delivered" });
    });

    it("a held leave is put down by staying, by moving, and by starting another save; typing on does not put it down", async () => {
        const held = async () => {
            const { s } = await existing(START);
            s.type({ place: "York" });
            const finish = await s.begin({ kind: "leave", to: "form" });
            s.type({ delivered: "More." });
            await finish!();
            expect(s.state.leaveHeld).toBe("form");
            return s;
        };
        let s = await held();
        s.type({ delivered: "More, and more." });
        expect(s.state.leaveHeld).toBe("form");
        s.d({ type: "leave/stay" });
        expect(s.state.leaveHeld).toBeNull();
        expect(s.state.editor.draft.content.delivered).toBe("More, and more.");

        s = await held();
        s.d({ type: "go", screen: { kind: "summary" } });
        expect(s.state.leaveHeld).toBeNull();

        s = await held();
        const finish = await s.begin(null);
        expect(s.state.leaveHeld).toBeNull();
        await finish!();
        expect(s.state.leave).toBeNull();
    });

    it("typing again during the second save holds it again: there is never an automatic save or discard", async () => {
        const { id, s } = await existing(START);
        s.type({ place: "York" });
        let finish = await s.begin({ kind: "leave", to: "list" });
        s.type({ delivered: "One." });
        await finish!();
        finish = await s.begin({ kind: "leave", to: "list" });
        s.type({ delivered: "Two." });
        await finish!();
        expect(s.state.leave).toBeNull();
        expect(s.state.leaveHeld).toBe("list");
        expect(stored(id).draft.delivered).toBe("One.");
        expect(s.state.editor.draft.content.delivered).toBe("Two.");
        expect(s.requests).toEqual(["save", "save"]);
        expect(s.state.editor.revision).toBe(3);
    });

    it("once leaving is decided with everything saved, the screen takes nothing more: no typing, move or save can follow it", async () => {
        const { id, s } = await existing(START);
        s.type({ place: "York" });
        await s.save({ kind: "leave", to: "form" });
        const going = s.state;
        s.type({ delivered: "Typed into a page that is already going" });
        s.tags(["anything"]);
        s.d({ type: "go", screen: { kind: "summary" } });
        s.d({ type: "latest/use" });
        expect(await s.save(null)).toBeNull();
        expect(s.state).toBe(going);
        expect(planSave(s.state).refusal).toBe("leaving");
        expect(stored(id).draft.delivered).toBe(START.delivered);
    });

    it("leaving is allowed only with nothing unsaved and no save running, whatever the state says was decided", () => {
        const base = initialGuidedState({ id: "00000000-0000-4000-8000-000000000001", revision: 1, content: FULL, disciplineIds: [], approved: null, approvedRevision: null, archived: false, legacyIndex: null });
        expect(mayLeave(base)).toBe(false);
        expect(mayLeave({ ...base, leave: "form" })).toBe(true);
        const dirty = guidedReducer(base, { type: "edit", content: { place: "York" } });
        expect(mayLeave({ ...dirty, leave: "form" })).toBe(false);
        const saving = guidedReducer(dirty, { type: "save/start", then: null });
        expect(mayLeave({ ...saving, leave: "list" })).toBe(false);
    });

    it("a first save of a new case study, with more typed while it runs, does not leave either", async () => {
        const s = session(null);
        s.type({ title: "Loft" });
        const finish = await s.begin({ kind: "leave", to: "form" });
        s.type({ title: "Loft conversion" });
        const result = await finish!();
        expect(result!.status).toBe("saved");
        expect(s.state.leave).toBeNull();
        expect(s.state.leaveHeld).toBe("form");
        expect(s.state.editor).toMatchObject({ id: result!.id, revision: 1 });
        expect(db.studies[0].draft.title).toBe("Loft");
        expect(s.state.editor.draft.content.title).toBe("Loft conversion");
        expect(s.state.createUnknown).toBe(false);
    });
});

describe("coming back", () => {
    it("opens on what is saved, and holds nothing else", async () => {
        const { id } = await existing({ ...newDraft("Kitchen refit"), delivered: "We refitted it." });
        const read = await readStudyAtOneRevision(db.reader, ME, id);
        if (read.state !== "ok") throw new Error("could not read");
        const s = session(viewOf(read.study, read.disciplines));
        expect(s.state).toMatchObject({ screen: { kind: "summary" }, createUnknown: false, after: null, leave: null, leaveHeld: null, moveHeld: false, local: null, notes: NO_NOTES });
        expect(s.state.editor.draft.content).toEqual(stored(id).draft);
        expect(isDirty(s.state.editor)).toBe(false);
    });

    it("the rules keep nothing outside the state they are given", async () => {
        const first = session(null);
        first.type({ title: "Typed and never saved" });
        const second = session(null);
        expect(second.state.editor.draft.content.title).toBe("");
        expect(initialGuidedState(null)).toEqual(initialGuidedState(null));
    });
});

describe("depth notes: typed, added by an explicit press, and never sent as notes", () => {
    const START: CaseStudyContent = { ...FULL, client_display: "named", client_text: "Mrs Example", client_named_ok: false };
    const TARGETS: LeaveTo[] = ["form", "list"];
    const depth = (key: DepthKey): Screen => ({ kind: "depth", key });

    describe("Add", () => {
        it("puts one paragraph on the end of the text exactly, empties only that note, and makes no request", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "  the stairwell was only 700mm wide \n");
            s.note("lesson", "we measure access first");
            s.add("challenge");
            expect(s.state.editor.draft.content.delivered).toBe("We refitted it.\n\nThe tricky part:   the stairwell was only 700mm wide \n");
            expect(s.state.notes).toEqual({ challenge: "", response: "", lesson: "we measure access first" });
            expect(dirtyQuestions(s.state.editor)).toEqual(["delivered"]);
            expect(s.requests).toEqual([]);
            expect(db.rpcCalls).toEqual([]);
            expect(stored(id).draft).toEqual(START);
            // Every other answer on screen is as it was.
            expect({ ...s.state.editor.draft.content, delivered: "" }).toEqual({ ...START, delivered: "" });
        });

        it.each([
            ["nothing typed", "challenge", "", "Work."],
            ["only spaces", "challenge", "   \n ", "Work."],
            ["a paragraph with those words already there", "challenge", "another", "Work.\n\nThe tricky part: first"],
            ["nothing for it to follow", "response", "we lifted it in", "Work."],
            ["no room", "lesson", "x", "y".repeat(5000)],
        ] as Array<[string, DepthKey, string, string]>)("is refused for %s: the very same state, note and text untouched", async (_name, key, note, text) => {
            const { s } = await existing({ ...START, delivered: text });
            s.note(key, note);
            const before = s.state;
            s.add(key);
            expect(s.state).toBe(before);
            expect(s.state.notes[key]).toBe(note);
            expect(s.state.editor.draft.content.delivered).toBe(text);
        });

        it("then an ordinary save stores exactly that text; other fields, kinds of work, consent and the approved copy are as they were", async () => {
            const k1 = await kind("Kitchens");
            const { id, s } = await existing({ ...START, client_display: "hidden", client_text: "", client_named_ok: false }, [k1]);
            const check = await loadForApproval(me, id);
            if (check.status !== "ok") throw new Error("no check");
            await approveStudy(me, { id, revision: check.check.study.revision, confirmed: true, shown: check.check.wouldApprove });
            const approved = structuredClone(stored(id).approved);
            const approvedRevision = stored(id).approved_revision;
            const draftBefore = structuredClone(stored(id).draft);
            db.rpcCalls.length = 0;

            s.note("challenge", "access");
            s.add("challenge");
            expect((await s.save(depth("response")))!.status).toBe("saved");
            expect(stored(id).draft).toEqual({ ...draftBefore, delivered: "We refitted it.\n\nThe tricky part: access" });
            expect(names()).toEqual(["case_study_save_draft"]);
            expect(tagsOf(id)).toEqual([k1]);
            expect(stored(id).approved).toEqual(approved);
            expect(stored(id).approved_revision).toBe(approvedRevision);
            expect(s.state.screen).toEqual(depth("response"));
        });

        it("consecutive adds and saves: three paragraphs in the order added, each lead-in once, never offered twice", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "access");
            s.add("challenge");
            await s.save(null);
            s.note("response", "lifted it in through the window");
            s.add("response");
            await s.save(null);
            s.note("lesson", "measure first");
            s.add("lesson");
            await s.save(null);
            const text = stored(id).draft.delivered;
            expect(text).toBe("We refitted it.\n\nThe tricky part: access\n\nWhat we did about it: lifted it in through the window\n\nWhat we do differently now: measure first");
            for (const key of DEPTH_KEYS) {
                expect(text.split(LEAD_IN[key])).toHaveLength(2);
                s.note(key, "again");
                const before = s.state;
                s.add(key);
                expect(s.state, key).toBe(before);
            }
            expect(s.requests).toEqual(["save", "save", "save"]);
            expect(stored(id).revision).toBe(4);
        });

        it("after the save is lost and found, trying again writes nothing more and adds nothing more", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "access");
            s.add("challenge");
            db.failAfter("case_study_save_draft");
            db.beforeNext("case_study_save_draft", () => db.failRead("*"));
            expect((await s.save(null))!.status).toBe("unknown");
            expect(s.state.notes.challenge).toBe("");
            expect((await s.save(null))!.status).toBe("unchanged");
            expect(db.calls("case_study_save_draft")).toHaveLength(1);
            expect(stored(id).draft.delivered).toBe("We refitted it.\n\nThe tricky part: access");
        });

        it("a text already at the limit: every depth screen can be visited and nothing changes or is sent", async () => {
            const full = "y".repeat(5000);
            const { id, s } = await existing({ ...START, delivered: full });
            for (const key of DEPTH_KEYS) { s.d({ type: "go", screen: depth(key) }); s.add(key); }
            expect(await s.save({ kind: "done" })).toBeNull();
            expect(s.state.screen).toEqual({ kind: "done" });
            expect(s.requests).toEqual([]);
            expect(stored(id).draft.delivered).toBe(full);
            expect(stored(id).revision).toBe(1);
        });
    });

    describe("a note's own bound", () => {
        it("exactly the bound is kept; one more is refused whole, with the note exactly as it was and nothing cut", async () => {
            const { s } = await existing(START);
            const most = "n".repeat(NOTE_MAX);
            s.note("challenge", most);
            expect(s.state.notes.challenge).toBe(most);
            s.note("challenge", `${most}n`);
            expect(s.state.notes.challenge).toBe(most);
            expect(s.state.local).toEqual({ key: null, message: DEPTH_MESSAGES.noteTooLong });
            s.note("lesson", "😀".repeat(NOTE_MAX));
            expect(Array.from(s.state.notes.lesson)).toHaveLength(NOTE_MAX);
        });

        it("when the room shrinks after a note was typed, the note is left as it is and simply cannot be added", async () => {
            const { s } = await existing({ ...START, delivered: "Work." });
            const note = "n".repeat(4000);
            s.note("challenge", note);
            expect(canAdd(s.state.editor.draft.content.delivered, "challenge", note)).toBe("ok");
            s.type({ delivered: "w".repeat(2000) });
            expect(canAdd(s.state.editor.draft.content.delivered, "challenge", note)).toBe("no-room");
            expect(room(s.state.editor.draft.content.delivered, "challenge")).toBe(2981);
            expect(s.state.notes.challenge).toBe(note);
            s.add("challenge");
            expect(s.state.notes.challenge).toBe(note);
            expect(s.state.editor.draft.content.delivered).toBe("w".repeat(2000));
            // Cleared only by the contractor.
            s.note("challenge", "");
            expect(s.state.notes.challenge).toBe("");
        });
    });

    describe("leaving with a note there (D1): refused at the start, by the rules, whichever way it was asked", () => {
        const NOTES: Array<[string, string]> = [["real text", "access was tight"], ["only spaces", "   "], ["a line break", "\n"]];

        describe.each(TARGETS)("to the %s", (to) => {
            it.each(NOTES)("nothing to save, a note of %s: no leave, nothing locked, nothing sent, and the note can still be dealt with", async (_name, note) => {
                const { id, s } = await existing(START);
                s.note("challenge", note);
                expect(isDirty(s.state.editor)).toBe(false);
                expect(unsavedOrUnapplied(s.state)).toBe(true);

                expect(await s.save({ kind: "leave", to })).toBeNull();
                expect(s.state.leave, "the no-request shortcut must not be taken").toBeNull();
                expect(mayLeave(s.state)).toBe(false);
                expect(s.state.local).toEqual({ key: null, message: DEPTH_MESSAGES.notesBlockLeave(["the tricky part"]) });
                expect(s.requests).toEqual([]);
                expect(db.rpcCalls).toEqual([]);

                // Not locked: typing, clearing and moving all still work.
                s.note("lesson", "typed after the refusal");
                expect(s.state.notes.lesson).toBe("typed after the refusal");
                s.d({ type: "go", screen: depth("lesson") });
                expect(s.state.screen).toEqual(depth("lesson"));
                s.note("lesson", "");
                s.note("challenge", "");
                // With every note dealt with, it leaves.
                expect(await s.save({ kind: "leave", to })).toBeNull();
                expect(s.state.leave).toBe(to);
                expect(mayLeave(s.state)).toBe(true);
                expect(stored(id).draft).toEqual(START);
            });

            it("something to save AND a note already there: a named refusal and ZERO requests, not a save that goes without it", async () => {
                const { id, s } = await existing(START);
                s.type({ place: "York" });
                s.note("lesson", "measure first");
                expect(planSave(s.state, { kind: "leave", to }).refusal).toEqual({ key: null, message: DEPTH_MESSAGES.notesBlockLeave(["what you do differently now"]) });
                expect(await s.save({ kind: "leave", to })).toBeNull();
                expect(requestOf(s.state), "the rules started no save, so there is nothing for the screen to send").toBeNull();
                expect(s.state.editor.saving).toBeNull();
                expect(s.requests).toEqual([]);
                expect(s.sent).toEqual([]);
                expect(db.rpcCalls).toEqual([]);
                expect(stored(id).draft.place).toBe("Leeds");
                expect(s.state.leave).toBeNull();
                expect(s.state.editor.draft.content.place).toBe("York");
                expect(s.state.notes.lesson).toBe("measure first");
            });

            it.each(NOTES)("a note of %s typed WHILE a save-then-go runs: held, not left, not locked; clearing it and saving again leaves", async (_name, note) => {
                for (const already of [false, true]) {
                    db = fakeLibrary();
                    me = { userId: ME, reader: db.reader, admin: () => db.admin };
                    const { id, s } = await existing(START);
                    s.type({ place: "York" });
                    if (already) await saveStudy(me, { id, revision: 1, content: { ...START, place: "York" }, disciplineIds: [] });
                    const finish = await s.begin({ kind: "leave", to });
                    s.note("response", note);
                    expect((await finish!())!.status).toBe(already ? "unchanged" : "saved");
                    expect(s.state.leave).toBeNull();
                    expect(s.state.leaveHeld).toBe(to);
                    expect(mayLeave(s.state)).toBe(false);
                    expect(isDirty(s.state.editor)).toBe(false);
                    expect(s.state.notes.response).toBe(note);
                    expect(s.state.editor.revision).toBe(2);
                    expect(s.requests).toEqual(["save"]);
                    // Held is not locked.
                    s.d({ type: "leave/stay" });
                    expect(s.state.leaveHeld).toBeNull();
                    s.note("response", `${note}more`);
                    expect(s.state.notes.response).toBe(`${note}more`);
                    s.note("response", "");
                    expect(await s.save({ kind: "leave", to })).toBeNull();
                    expect(s.state.leave).toBe(to);
                }
            });

            it("held by a note, then added: the text is now unsaved, so it saves and then leaves, with the paragraph stored", async () => {
                const { id, s } = await existing(START);
                s.type({ place: "York" });
                const finish = await s.begin({ kind: "leave", to });
                s.note("challenge", "access");
                await finish!();
                expect(s.state.leaveHeld).toBe(to);
                s.add("challenge");
                expect(s.state.notes.challenge).toBe("");
                expect((await s.save({ kind: "leave", to }))!.status).toBe("saved");
                expect(s.state.leave).toBe(to);
                expect(stored(id).draft.delivered).toBe("We refitted it.\n\nThe tricky part: access");
            });

            it("a failed, unknown or conflicting save-then-go with a note typed during it: stays, and the note is untouched", async () => {
                for (const arrange of [() => db.setUnavailable(true), () => { db.failAfter("case_study_save_draft"); db.beforeNext("case_study_save_draft", () => db.failRead("*")); }]) {
                    db = fakeLibrary();
                    me = { userId: ME, reader: db.reader, admin: () => db.admin };
                    const { s } = await existing(START);
                    s.type({ place: "York" });
                    arrange();
                    const finish = await s.begin({ kind: "leave", to });
                    s.note("lesson", "typed during");
                    await finish!();
                    expect(s.state.leave).toBeNull();
                    expect(s.state.leaveHeld).toBeNull();
                    expect(s.state.notes.lesson).toBe("typed during");
                    expect(s.state.editor.draft.content.place).toBe("York");
                }
            });
        });

        it("the terminal state is only ever entered with every note empty, and then takes no note either", async () => {
            const { s } = await existing(START);
            expect(await s.save({ kind: "leave", to: "form" })).toBeNull();
            const going = s.state;
            expect(going.leave).toBe("form");
            expect(going.notes).toEqual(NO_NOTES);
            s.note("challenge", "typed into a page that is already going");
            s.add("challenge");
            expect(s.state).toBe(going);
        });

        it("mayLeave is false whenever a note is there, whatever else the state says", () => {
            const base = initialGuidedState({ id: "00000000-0000-4000-8000-000000000001", revision: 1, content: FULL, disciplineIds: [], approved: null, approvedRevision: null, archived: false, legacyIndex: null });
            expect(mayLeave({ ...base, leave: "form" })).toBe(true);
            for (const key of DEPTH_KEYS) for (const note of ["x", " ", "\n"]) expect(mayLeave({ ...base, leave: "form", notes: { ...NO_NOTES, [key]: note } })).toBe(false);
        });
    });

    describe("an ordinary save with a note there", () => {
        it("saves the draft; the note is not in what is sent or stored, is not changed, and is still named as not added", async () => {
            const { id, s } = await existing(START);
            s.d({ type: "go", screen: depth("challenge") });
            s.note("challenge", "SENTINEL note never added");
            s.type({ place: "York" });
            expect((await s.save(null))!.status).toBe("saved");
            expect(JSON.stringify(s.sent)).not.toContain("SENTINEL");
            expect(JSON.stringify(db.rpcCalls)).not.toContain("SENTINEL");
            expect(JSON.stringify(stored(id))).not.toContain("SENTINEL");
            expect(s.state.notes.challenge).toBe("SENTINEL note never added");
            expect(unappliedNames(s.state.notes)).toEqual(["the tricky part"]);
            expect(unsavedOrUnapplied(s.state)).toBe(true);
            expect(isDirty(s.state.editor)).toBe(false);
        });

        it("Save and next with a note that was ALREADY there moves on: the note is kept and still counts", async () => {
            const { s } = await existing(START);
            s.d({ type: "go", screen: depth("challenge") });
            s.note("challenge", "typed before pressing");
            s.type({ place: "York" });
            await s.save(depth("lesson"));
            expect(s.state.screen).toEqual(depth("lesson"));
            expect(s.state.moveHeld).toBe(false);
            expect(s.state.notes.challenge).toBe("typed before pressing");
            expect(unsavedOrUnapplied(s.state)).toBe(true);
        });

        it.each([["saved", false], ["already saved", true]] as Array<[string, boolean]>)("Save and next with a note typed or changed WHILE it runs (%s): stays on the screen it was on", async (_name, already) => {
            for (const change of [(s: ReturnType<typeof session>) => s.note("challenge", "typed during"), (s: ReturnType<typeof session>) => s.note("lesson", " "), (s: ReturnType<typeof session>) => s.note("response", "")]) {
                db = fakeLibrary();
                me = { userId: ME, reader: db.reader, admin: () => db.admin };
                const { id, s } = await existing(START);
                s.d({ type: "go", screen: depth("challenge") });
                s.note("response", "there before");
                s.type({ place: "York" });
                if (already) await saveStudy(me, { id, revision: 1, content: { ...START, place: "York" }, disciplineIds: [] });
                const finish = await s.begin(depth("lesson"));
                change(s);
                const notes = structuredClone(s.state.notes);
                await finish!();
                expect(s.state.screen).toEqual(depth("challenge"));
                expect(s.state.moveHeld).toBe(true);
                expect(s.state.notes).toEqual(notes);
                expect(isDirty(s.state.editor)).toBe(false);
                expect(s.requests).toEqual(["save"]);
                // Pressed again with nothing to save: it simply moves, and the notes go with it.
                expect(await s.save(depth("lesson"))).toBeNull();
                expect(s.state.screen).toEqual(depth("lesson"));
                expect(s.state.notes).toEqual(notes);
            }
        });

        it("a note typed and put back exactly as it was while the save ran does not hold Next", async () => {
            const { s } = await existing(START);
            s.note("challenge", "as it was");
            s.type({ place: "York" });
            const finish = await s.begin(depth("lesson"));
            s.note("challenge", "changed");
            s.note("challenge", "as it was");
            await finish!();
            expect(s.state.screen).toEqual(depth("lesson"));
        });

        it("an Add made while a save runs leaves the text unsaved, so Next is held and nothing is sent again", async () => {
            const { id, s } = await existing(START);
            s.d({ type: "go", screen: depth("challenge") });
            s.note("challenge", "access");
            s.type({ place: "York" });
            const finish = await s.begin(depth("lesson"));
            s.add("challenge");
            await finish!();
            expect(s.state.screen).toEqual(depth("challenge"));
            expect(s.state.moveHeld).toBe(true);
            expect(stored(id).draft.delivered).toBe("We refitted it.");
            expect(dirtyQuestions(s.state.editor)).toEqual(["delivered"]);
            expect(s.requests).toEqual(["save"]);
        });
    });

    describe("what does NOT change a note", () => {
        it("Back, Skip, jumping, a save, any reply, and either conflict choice", async () => {
            const k1 = await kind("Kitchens");
            const { id, s } = await existing(START);
            const typed = { challenge: "  one ", response: "\n", lesson: "three" };
            for (const key of DEPTH_KEYS) s.note(key, typed[key]);
            for (const screen of [depth("lesson"), { kind: "summary" }, { kind: "question", key: "place" }, { kind: "done" }, depth("challenge")] as Screen[]) s.d({ type: "go", screen });
            expect(s.state.notes).toEqual(typed);

            s.type({ place: "York" });
            await s.save(null);
            expect(s.state.notes).toEqual(typed);

            s.type({ place: "Hull" });
            s.tags([k1]);
            db.failBefore("case_study_set_disciplines");
            expect((await s.save(null))!.status).toBe("partial");
            expect(s.state.notes).toEqual(typed);

            s.d({ type: "save/reply", token: 99, result: { status: "saved", message: M.saved, revision: 50 } });
            expect(s.state.notes).toEqual(typed);

            await saveStudy(me, { id, revision: stored(id).revision, content: { ...stored(id).draft, value_added: "Elsewhere." }, disciplineIds: [] });
            s.type({ duration_text: "5 weeks" });
            expect((await s.save(null))!.status).toBe("conflict");
            s.d({ type: "latest/keep-mine" });
            expect(s.state.notes).toEqual(typed);
            await saveStudy(me, { id, revision: stored(id).revision, content: { ...stored(id).draft, value_added: "Elsewhere again." }, disciplineIds: [] });
            expect((await s.save(null))!.status).toBe("conflict");
            s.d({ type: "latest/use" });
            expect(s.state.notes).toEqual(typed);
            expect(JSON.stringify(s.sent)).not.toContain("three");
        });

        it("moving by hand while a save runs still cancels the automatic move, with notes there or not", async () => {
            const { s } = await existing(START);
            s.d({ type: "go", screen: depth("challenge") });
            s.note("challenge", "access");
            s.type({ place: "York" });
            const finish = await s.begin(depth("lesson"));
            s.d({ type: "go", screen: { kind: "summary" } });
            await finish!();
            expect(s.state.screen).toEqual({ kind: "summary" });
            expect(s.state.moveHeld).toBe(false);
            expect(s.state.notes.challenge).toBe("access");
        });

        it("a new visit starts with no notes, whatever was typed or saved before", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "typed and never added");
            const read = await readStudyAtOneRevision(db.reader, ME, id);
            if (read.state !== "ok") throw new Error("could not read");
            expect(session(viewOf(read.study, read.disciplines)).state.notes).toEqual(NO_NOTES);
            expect(initialGuidedState(null).notes).toEqual(NO_NOTES);
        });

        it("the depth screens cannot be reached before the case study exists", () => {
            const s = session(null);
            s.d({ type: "go", screen: depth("challenge") });
            expect(s.state.screen).toEqual({ kind: "question", key: "title" });
        });
    });

    describe("changed somewhere else, with depth in play", () => {
        const elsewhere = "Remote work.\n\nThe tricky part: remote challenge";

        it("my words are still a note, the latest text already has that paragraph: no duplicate, nothing hidden, not called saved", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "my different challenge");
            s.type({ place: "York" });
            await saveStudy(me, { id, revision: 1, content: { ...START, delivered: elsewhere }, disciplineIds: [] });
            expect((await s.save(null))!.status).toBe("conflict");
            for (const choice of ["latest/keep-mine", "latest/use"] as const) {
                const branch = guidedReducer(s.state, { type: choice });
                expect(branch.editor.draft.content.delivered).toBe(elsewhere);
                expect(branch.notes.challenge).toBe("my different challenge");
                expect(canAdd(branch.editor.draft.content.delivered, "challenge", branch.notes.challenge)).toBe("present");
                expect(guidedReducer(branch, { type: "note/add", key: "challenge" })).toBe(branch);
                expect(unsavedOrUnapplied(branch)).toBe(true);
                expect(branch.editor.draft.content.delivered.split(LEAD_IN.challenge)).toHaveLength(2);
            }
        });

        it("my words were already added: keeping mine replaces the whole field with mine, and only that field", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "my different challenge");
            s.add("challenge");
            await saveStudy(me, { id, revision: 1, content: { ...START, delivered: elsewhere, client_named_ok: true, work_type: "Changed elsewhere" }, disciplineIds: [] });
            expect((await s.save(null))!.status).toBe("conflict");
            expect(db.calls("case_study_save_draft")).toHaveLength(1); // the other tab's
            expect(s.state.editor.revision, "the held revision is not swapped for the newer one").toBe(1);
            expect(s.state.editor.latest!.content.delivered).toBe(elsewhere);
            const mine = "We refitted it.\n\nThe tricky part: my different challenge";
            s.d({ type: "latest/keep-mine" });
            expect(s.state.editor.draft.content).toEqual({ ...START, delivered: mine, client_named_ok: true, work_type: "Changed elsewhere" });
            expect(stored(id).draft.delivered, "nothing is written by choosing").toBe(elsewhere);
            expect((await s.save(null))!.status).toBe("saved");
            expect(stored(id).draft).toEqual({ ...START, delivered: mine, client_named_ok: true, work_type: "Changed elsewhere" });
            expect(stored(id).draft.delivered.split(LEAD_IN.challenge)).toHaveLength(2);
        });

        it("my words were already added, and I take the saved version: mine is given up by my choice, and nothing is written", async () => {
            const { id, s } = await existing(START);
            s.note("challenge", "my different challenge");
            s.add("challenge");
            await saveStudy(me, { id, revision: 1, content: { ...START, delivered: elsewhere }, disciplineIds: [] });
            await s.save(null);
            db.rpcCalls.length = 0;
            s.d({ type: "latest/use" });
            expect(s.state.editor.draft.content.delivered).toBe(elsewhere);
            expect(isDirty(s.state.editor)).toBe(false);
            expect(db.rpcCalls).toEqual([]);
            expect(stored(id).draft.delivered).toBe(elsewhere);
        });
    });

    it("a long random walk: a note is never sent or stored unless added, never changes except by typing or its own Add, and leaving is never decided with one there", async () => {
        let state = 20261008;
        const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
        const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
        const screens: Screen[] = [{ kind: "summary" }, { kind: "done" }, { kind: "question", key: "place" }, { kind: "question", key: "delivered" }, depth("challenge"), depth("response"), depth("lesson")];
        const thens: AfterSave[] = [null, { kind: "done" }, depth("lesson"), { kind: "leave", to: "form" }, { kind: "leave", to: "list" }];

        for (let walk = 0; walk < 12; walk += 1) {
            db = fakeLibrary();
            me = { userId: ME, reader: db.reader, admin: () => db.admin };
            const { id, s } = await existing({ ...START, delivered: "Work." });
            let serial = 0;
            /** Note texts that were deliberately added to the text. Only these may ever be sent or stored. */
            const added = new Set<string>();
            /** A save on its way, to be answered a few steps later. */
            let pending: (() => Promise<unknown>) | null = null;

            for (let step = 0; step < 60 && s.state.leave === null; step += 1) {
                const before = s.state;
                const roll = next();
                let acted: "type" | "clear" | "add" | "other" = "other";
                const key: DepthKey = pick(DEPTH_KEYS);
                if (roll < 0.22) { acted = "type"; s.note(key, pick([`NOTE${serial += 1} text`, " ", `NOTE${serial += 1}\nlines`])); }
                else if (roll < 0.28) { acted = "clear"; s.note(key, ""); } // the contractor's own explicit clear: an intended change, not an exception to the rule
                else if (roll < 0.42) { acted = "add"; if (canAdd(before.editor.draft.content.delivered, key, before.notes[key]) === "ok") added.add(before.notes[key]); s.add(key); }
                else if (roll < 0.52) s.type({ place: `Place ${serial += 1}` });
                else if (roll < 0.57) s.type({ delivered: `${before.editor.draft.content.delivered} more` });
                else if (roll < 0.70) s.d({ type: "go", screen: pick(screens) });
                else if (roll < 0.74) s.d({ type: "leave/stay" });
                else if (roll < 0.78 && before.editor.latest) s.d({ type: pick(["latest/use", "latest/keep-mine"] as const) });
                else if (roll < 0.82) { const row = stored(id); await saveStudy(me, { id, revision: row.revision, content: { ...row.draft, value_added: `Elsewhere ${serial += 1}` }, disciplineIds: [] }); }
                else if (pending && roll < 0.92) { const finish = pending; pending = null; await finish(); }
                else if (!pending) pending = await s.begin(pick(thens));
                const after = s.state;

                // Notes change only by typing (clearing included) and by the note's own Add.
                for (const other of DEPTH_KEYS) {
                    if (after.notes[other] === before.notes[other]) continue;
                    expect(other, `step ${step}: only the note acted on may change`).toBe(key);
                    if (acted === "add") expect(after.notes[other]).toBe("");
                    else expect(["type", "clear"]).toContain(acted);
                }
                // Leaving is decided only with nothing unsaved and no note there.
                if (after.leave !== null) {
                    expect(unsavedOrUnapplied(after), `step ${step}`).toBe(false);
                    expect(after.notes).toEqual(NO_NOTES);
                    expect(mayLeave(after)).toBe(after.editor.saving === null);
                }
                // A held state is never the terminal one.
                if (after.leaveHeld !== null || after.moveHeld) expect(after.leave).toBeNull();
            }
            if (pending) await pending();

            // Nothing typed as a note reached a request or the stored row unless it was added.
            const everywhere = `${JSON.stringify(s.sent)}${JSON.stringify(db.rpcCalls)}${JSON.stringify(stored(id))}`;
            for (const marker of everywhere.match(/NOTE\d+/g) ?? []) {
                expect([...added].some((text) => text.startsWith(marker) || text.includes(`${marker} `) || text.includes(`${marker}\n`)), `${marker} was sent or stored without being added`).toBe(true);
            }
            // Each lead-in appears at most once in the stored text: no path adds a second.
            for (const key of DEPTH_KEYS) expect(stored(id).draft.delivered.split(LEAD_IN[key]).length).toBeLessThanOrEqual(2);
        }
    });

    it("the paragraph functions the rules use are the pure ones: what Add writes is what `add` returns", async () => {
        const { s } = await existing(START);
        s.note("lesson", "measure first");
        const expected = addParagraph(s.state.editor.draft.content.delivered, "lesson", "measure first");
        s.add("lesson");
        expect(s.state.editor.draft.content.delivered).toBe(expected);
        expect(present(expected, "lesson")).toBe(true);
    });
});
