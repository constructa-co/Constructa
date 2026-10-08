import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLibrary } from "./__fixtures__/fake-library";
import { newDraft, type CaseStudyContent } from "./content";
import { isDirty } from "./editor-state";
import { GUIDED_MESSAGES, dirtyQuestions } from "./guided";
import { guidedReducer, initialGuidedState, mayLeave, planSave, type AfterSave, type GuidedAction, type GuidedState, type LeaveTo } from "./guided-state";
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
    const d = (action: GuidedAction) => { state = guidedReducer(state, action); };
    const send = async (again: boolean) => {
        const { plan } = planSave(state, again);
        return plan;
    };
    return {
        get state(): GuidedState { return state; },
        requests,
        d,
        type: (content: Partial<CaseStudyContent>) => d({ type: "edit", content }),
        tags: (disciplineIds: string[]) => d({ type: "edit", disciplineIds }),
        /** Starts a save and returns a function that delivers the reply, so a test can do things in between. */
        begin: async (then: AfterSave, again = false) => {
            const plan = await send(again);
            d({ type: "save/start", then, again });
            if (!plan) return null;
            requests.push(plan.id ? "save" : "create");
            const request: Promise<LibraryResult> = plan.id
                ? saveStudy(me, { id: plan.id, revision: plan.revision, content: plan.sent.content, disciplineIds: plan.sent.disciplineIds })
                : createStudy(me, { content: plan.sent.content, disciplineIds: plan.sent.disciplineIds });
            return async () => { const result = await request; d({ type: "save/reply", token: plan.token, result }); return result; };
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
        expect(s.state).toMatchObject({ screen: { kind: "summary" }, createUnknown: false, after: null, leave: null, leaveHeld: null, local: null });
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
