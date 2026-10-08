/**
 * Guided case-study capture: the screen's state, as plain rules. Pure.
 *
 * The full form's `editorReducer` is used here for one thing only: what is
 * saved, what is typed, the one save in flight, and what the server said.
 * Its rules are unchanged: one save at a time, a late reply is ignored, a
 * refusal never clears what was typed.
 *
 * This file adds what that reducer does not model:
 *
 *  - which screen is showing, and where a CONFIRMED save leads. Nothing
 *    moves on for any other answer from the server;
 *  - Back, Skip and jumping about make no request and clear nothing, so
 *    several answers can be unsaved at once. A save sends all of them, with
 *    the revision the screen holds. It never fetches a newer revision to
 *    save over;
 *  - "keep what I typed" after a conflict puts ONLY the answers the
 *    contractor changed onto the latest saved copy. Everything they did not
 *    touch is the latest saved copy's, not the older one this screen loaded;
 *  - a first create that got no answer cannot be retried safely, because
 *    there is no id to look for. It stops until the contractor says to add
 *    it again;
 *  - "save, then go" leaves only if NOTHING is unsaved when the reply
 *    arrives. A confirmed save confirms the copy that was sent, not what is
 *    on the screen now: anything typed while it was running is still
 *    unsaved, so the screen stays, keeps it, and says so. It is never saved
 *    again automatically and never discarded automatically. Once leaving
 *    has been decided, the screen takes no more typing, so nothing can be
 *    typed into a page that is already going.
 */

import { newDraft, trimSpaces, type CaseStudyContent } from "./content";
import { editorReducer, initialEditorState, isDirty, type Copy, type EditorState } from "./editor-state";
import { GUIDED_MESSAGES, problemBeforeSave, type GuidedKey } from "./guided";
import { sameTags, type LibraryResult, type StudyView } from "./service";

export type Screen = { kind: "summary" } | { kind: "question"; key: GuidedKey } | { kind: "done" };
/** Where to leave to once a save is confirmed: the full form, or the list. */
export type LeaveTo = "form" | "list";
export type AfterSave = Screen | { kind: "leave"; to: LeaveTo } | null;

export interface GuidedState {
    editor: EditorState;
    screen: Screen;
    /** What a confirmed reply to the save now running leads to. Cleared if the contractor moves by hand meanwhile. */
    after: { token: number; then: AfterSave } | null;
    /** The first create got no answer. Whether the case study exists is not known. */
    createUnknown: boolean;
    /** A refusal made here, before any request. */
    local: { key: GuidedKey | null; message: string } | null;
    /**
     * Set once a save-then-leave was confirmed WITH NOTHING LEFT UNSAVED. The screen then navigates.
     * While it is set, nothing further is accepted: see `edit` below.
     */
    leave: LeaveTo | null;
    /**
     * A save-then-leave was confirmed, but something was typed while it was running and is not saved.
     * The screen stayed. This is where the contractor had asked to go, so they can be asked again.
     */
    leaveHeld: LeaveTo | null;
}

export type GuidedAction =
    | { type: "edit"; content?: Partial<CaseStudyContent>; disciplineIds?: string[] }
    | { type: "go"; screen: Screen }
    | { type: "save/start"; then: AfterSave; again?: boolean }
    | { type: "save/reply"; token: number; result: LibraryResult }
    | { type: "latest/use" }
    | { type: "latest/keep-mine" }
    /** The contractor chose to stay after a leave was held back. */
    | { type: "leave/stay" };

export function initialGuidedState(view: StudyView | null): GuidedState {
    return {
        editor: initialEditorState(view, newDraft("")),
        // Coming back to a saved case study opens on what is saved. A new one opens on the first question.
        screen: view ? { kind: "summary" } : { kind: "question", key: "title" },
        after: null,
        createUnknown: false,
        local: null,
        leave: null,
        leaveHeld: null,
    };
}

export interface SavePlan {
    token: number;
    /** Null for the first save, which creates the case study. */
    id: string | null;
    /** The revision this screen holds. The save is refused if the saved copy has moved on from it. */
    revision: number;
    sent: Copy;
}

/** The job name as it will be sent: the accepted content rule refuses spaces at either end. Nothing else is altered. */
const titleTidied = (editor: EditorState): EditorState => {
    const tidy = trimSpaces(editor.draft.content.title);
    return tidy === editor.draft.content.title ? editor : editorReducer(editor, { type: "edit", content: { title: tidy } });
};

/**
 * What a save would send now, or why none can start. The screen calls this
 * to make the request; the reducer calls it to decide the same thing, so the
 * two cannot disagree.
 */
export function planSave(state: GuidedState, again = false): { plan: SavePlan; refusal: null } | { plan: null; refusal: GuidedState["local"] | "busy" | "nothing" | "create-unknown" | "leaving" } {
    // Already on the way out with everything saved: nothing more is sent.
    if (state.leave !== null) return { plan: null, refusal: "leaving" };
    if (state.editor.saving) return { plan: null, refusal: "busy" };
    if (state.createUnknown && !again) return { plan: null, refusal: "create-unknown" };
    const editor = titleTidied(state.editor);
    const problem = problemBeforeSave(editor.draft.content);
    if (problem) return { plan: null, refusal: problem };
    if (editor.id !== null && !isDirty(editor)) return { plan: null, refusal: "nothing" };
    return { plan: { token: editor.nextToken, id: editor.id, revision: editor.revision, sent: { content: { ...editor.draft.content }, disciplineIds: [...editor.draft.disciplineIds] } }, refusal: null };
}

const CONFIRMED = new Set(["saved", "unchanged"]);

/** Leaving is allowed only when there is nothing on the screen that is not saved, and no save still running. */
export function mayLeave(state: GuidedState): boolean {
    return state.leave !== null && !isDirty(state.editor) && state.editor.saving === null;
}

export function guidedReducer(state: GuidedState, action: GuidedAction): GuidedState {
    // Leaving has been decided with everything saved. Nothing after that changes the screen:
    // typing into a page that is already going would be lost without anyone choosing that.
    if (state.leave !== null) return state;
    switch (action.type) {
        case "edit":
            return { ...state, editor: editorReducer(state.editor, action), local: null };

        case "go": {
            // Until the case study exists there is only the first question: everything else needs somewhere to be saved.
            if (state.editor.id === null && !(action.screen.kind === "question" && action.screen.key === "title")) {
                return { ...state, local: { key: "title", message: GUIDED_MESSAGES.titleNeeded } };
            }
            // Moving by hand: a reply still on its way no longer moves the screen.
            return { ...state, screen: action.screen, after: null, local: null, leaveHeld: null };
        }

        case "save/start": {
            const { plan, refusal } = planSave(state, action.again);
            if (!plan) {
                if (refusal === "nothing") {
                    // Nothing to save: going where the save would have led is safe and makes no request.
                    if (action.then === null) return state;
                    // "Nothing to save" was decided from this very state, so nothing is unsaved.
                    return action.then.kind === "leave" ? { ...state, leave: action.then.to, leaveHeld: null } : { ...state, screen: action.then, after: null, local: null, leaveHeld: null };
                }
                return typeof refusal === "object" && refusal ? { ...state, local: refusal } : state;
            }
            const editor = editorReducer(titleTidied(state.editor), { type: "save/start" });
            return { ...state, editor, after: { token: plan.token, then: action.then }, createUnknown: false, local: null, leaveHeld: null };
        }

        case "save/reply": {
            const editor = editorReducer(state.editor, { type: "save/reply", token: action.token, result: action.result });
            // Not the save now running: nothing changes, and nothing moves.
            if (editor === state.editor) return state;
            const then = state.after?.token === action.token ? state.after.then : null;
            const next: GuidedState = {
                ...state,
                editor,
                after: null,
                local: null,
                // No id before, none now, and no answer: it may or may not exist.
                createUnknown: state.editor.id === null && editor.id === null && action.result.status === "unknown",
            };
            if (!CONFIRMED.has(action.result.status) || then === null) return next;
            if (then.kind !== "leave") return { ...next, screen: then };
            // What was SENT is saved. If anything typed since is not, the screen stays and keeps it.
            return isDirty(editor) ? { ...next, leaveHeld: then.to } : { ...next, leave: then.to };
        }

        case "leave/stay":
            return { ...state, leaveHeld: null };

        case "latest/use":
            return { ...state, editor: editorReducer(state.editor, action), local: null };

        case "latest/keep-mine": {
            const { editor } = state;
            if (!editor.latest) return state;
            // Only what the contractor changed, measured against the copy this screen loaded.
            const mine: Partial<CaseStudyContent> = {};
            for (const key of Object.keys(editor.draft.content) as Array<keyof CaseStudyContent>) {
                if (editor.draft.content[key] !== editor.saved.content[key]) Object.assign(mine, { [key]: editor.draft.content[key] });
            }
            const tagsMine = !sameTags(editor.saved.disciplineIds, editor.draft.disciplineIds);
            // Start from the latest saved copy, then put those changes on top. They are now unsaved changes to it.
            const latest = editorReducer(editor, { type: "latest/use" });
            const merged = editorReducer(latest, { type: "edit", content: mine, ...(tagsMine ? { disciplineIds: [...editor.draft.disciplineIds] } : {}) });
            return { ...state, editor: merged, local: null };
        }
    }
}
