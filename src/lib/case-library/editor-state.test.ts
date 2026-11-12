import { describe, expect, it } from "vitest";
import { newDraft } from "./content";
import { editorReducer, initialEditorState, isDirty, saveLine, type EditorState } from "./editor-state";
import type { LibraryResult, StudyView } from "./service";

const view = (overrides: Partial<StudyView> = {}): StudyView => ({ id: "s1", revision: 3, content: { ...newDraft("Kitchen"), delivered: "As saved." }, disciplineIds: ["k"], approved: null, approvedRevision: null, archived: false, legacyIndex: null, ...overrides });
const type = (state: EditorState, delivered: string) => editorReducer(state, { type: "edit", content: { delivered } });
const reply = (state: EditorState, token: number, result: Partial<LibraryResult> & { status: LibraryResult["status"] }) => editorReducer(state, { type: "save/reply", token, result: { message: result.status, ...result } });

describe("the edit screen's state", () => {
    it("starts saved, and knows when something typed is not saved", () => {
        const state = initialEditorState(view(), newDraft(""));
        expect(isDirty(state)).toBe(false);
        expect(saveLine(state)).toBe("Saved");
        expect(saveLine(type(state, "Edited."))).toBe("Changes not saved");
        expect(isDirty(editorReducer(state, { type: "edit", disciplineIds: ["k", "t"] }))).toBe(true);
        expect(isDirty(editorReducer(state, { type: "edit", content: { client_named_ok: true } }))).toBe(true);
        const fresh = initialEditorState(null, newDraft(""));
        expect(saveLine(fresh)).toBe("Nothing to save yet");
        expect(saveLine(editorReducer(fresh, { type: "edit", content: { title: "New job" } }))).toBe("Not saved yet");
    });

    it("runs one save at a time: a second press while one is running does nothing", () => {
        const saving = editorReducer(type(initialEditorState(view(), newDraft("")), "Edited."), { type: "save/start" });
        expect(saving.saving).toMatchObject({ token: 1 });
        expect(saveLine(saving)).toBe("Saving…");
        expect(editorReducer(saving, { type: "save/start" })).toBe(saving);
    });

    it("takes the returned revision at once and records what was SENT as saved", () => {
        const saving = editorReducer(type(initialEditorState(view(), newDraft("")), "Edited."), { type: "save/start" });
        const saved = reply(saving, 1, { status: "saved", revision: 4 });
        expect(saved).toMatchObject({ revision: 4, saving: null });
        expect(saved.saved.content.delivered).toBe("Edited.");
        expect(isDirty(saved)).toBe(false);
        expect(saveLine(saved)).toBe("Saved");
    });

    it("keeps anything typed while the save was running, as a change not yet saved", () => {
        const saving = editorReducer(type(initialEditorState(view(), newDraft("")), "First edit."), { type: "save/start" });
        const typedMeanwhile = type(saving, "First edit. And more, typed during the save.");
        const after = reply(typedMeanwhile, 1, { status: "saved", revision: 4 });
        expect(after.draft.content.delivered).toBe("First edit. And more, typed during the save.");
        expect(after.saved.content.delivered).toBe("First edit.");
        expect(after.revision).toBe(4);
        expect(isDirty(after)).toBe(true);
    });

    it("ignores a reply that is not from the save now running", () => {
        const first = editorReducer(type(initialEditorState(view(), newDraft("")), "One."), { type: "save/start" });
        const done = reply(first, 1, { status: "saved", revision: 4 });
        const second = editorReducer(type(done, "Two."), { type: "save/start" });
        expect(second.saving?.token).toBe(2);
        // A late duplicate of the first reply, and a reply when nothing is saving.
        expect(reply(second, 1, { status: "conflict", revision: 99 })).toBe(second);
        expect(reply(done, 1, { status: "saved", revision: 99 })).toBe(done);
        expect(reply(second, 2, { status: "saved", revision: 5 }).revision).toBe(5);
    });

    it.each(["conflict", "unknown", "invalid", "unavailable", "not-found", "limit", "off", "signed-out"] as const)("a %s reply clears nothing that was typed and does not claim to be saved", (status) => {
        const saving = editorReducer(type(initialEditorState(view(), newDraft("")), "My careful wording."), { type: "save/start" });
        const after = reply(saving, 1, { status, message: `it was ${status}`, latest: view({ revision: 9, content: { ...newDraft("Kitchen"), delivered: "Someone else's." } }) });
        expect(after.draft.content.delivered).toBe("My careful wording.");
        expect(after.saved.content.delivered).toBe("As saved.");
        expect(isDirty(after)).toBe(true);
        expect(saveLine(after)).toBe(`it was ${status}`);
        expect(after.saving).toBeNull();
    });

    it("a partial save records the wording as saved and the kinds of work as the server holds them", () => {
        const edited = editorReducer(type(initialEditorState(view(), newDraft("")), "New wording."), { type: "edit", disciplineIds: ["k", "t"] });
        const after = reply(editorReducer(edited, { type: "save/start" }), 1, { status: "partial", revision: 4, message: "Your wording was saved. The kinds of work were not.", latest: view({ revision: 4, disciplineIds: ["k"] }) });
        expect(after.revision).toBe(4);
        expect(after.saved.content.delivered).toBe("New wording.");
        expect(after.saved.disciplineIds).toEqual(["k"]);
        expect(after.draft.disciplineIds).toEqual(["k", "t"]);
        expect(isDirty(after)).toBe(true);
        expect(saveLine(after)).toContain("kinds of work were not");
    });

    it("after a conflict the contractor chooses: keep what they typed, or take the saved version", () => {
        const latest = view({ revision: 9, content: { ...newDraft("Kitchen"), delivered: "Saved elsewhere." }, disciplineIds: [] });
        const conflicted = reply(editorReducer(type(initialEditorState(view(), newDraft("")), "Mine."), { type: "save/start" }), 1, { status: "conflict", latest });

        const kept = editorReducer(conflicted, { type: "latest/keep-mine" });
        expect(kept).toMatchObject({ revision: 9, latest: null });
        expect(kept.draft.content.delivered).toBe("Mine.");
        expect(kept.saved.content.delivered).toBe("Saved elsewhere.");
        expect(isDirty(kept)).toBe(true);

        const taken = editorReducer(conflicted, { type: "latest/use" });
        expect(taken.draft.content.delivered).toBe("Saved elsewhere.");
        expect(taken.revision).toBe(9);
        expect(isDirty(taken)).toBe(false);
        // Neither happens without a latest copy to choose.
        const none = initialEditorState(view(), newDraft(""));
        expect(editorReducer(none, { type: "latest/use" })).toBe(none);
        expect(editorReducer(none, { type: "latest/keep-mine" })).toBe(none);
    });

    it("a first save gives the case study its id", () => {
        const fresh = editorReducer(initialEditorState(null, newDraft("")), { type: "edit", content: { title: "New job" } });
        const after = reply(editorReducer(fresh, { type: "save/start" }), 1, { status: "saved", id: "new-id", revision: 1 });
        expect(after).toMatchObject({ id: "new-id", revision: 1 });
        expect(saveLine(after)).toBe("Saved");
    });

    it("a fresh server copy never replaces something typed and not saved", () => {
        const dirty = type(initialEditorState(view(), newDraft("")), "Unsaved words.");
        const adopted = editorReducer(dirty, { type: "adopt", view: view({ revision: 7, content: { ...newDraft("Kitchen"), delivered: "From the server." } }) });
        expect(adopted.draft.content.delivered).toBe("Unsaved words.");
        const clean = editorReducer(initialEditorState(view(), newDraft("")), { type: "adopt", view: view({ revision: 7, content: { ...newDraft("Kitchen"), delivered: "From the server." } }) });
        expect(clean.draft.content.delivered).toBe("From the server.");
        expect(clean.revision).toBe(7);
    });
});
