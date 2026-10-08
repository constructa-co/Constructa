/**
 * Case-study library: the edit screen's state, as plain rules. Pure.
 *
 *  - One save at a time. A second press while one is running does nothing.
 *  - When a reply arrives, the screen takes the revision it returned at once,
 *    and records what was SENT as the saved copy. Anything typed while the
 *    save was running stays, as a change not yet saved.
 *  - A reply that is not from the save now running is ignored.
 *  - A refusal never clears what was typed.
 */

import type { CaseStudyContent } from "./content";
import { sameTags, type LibraryResult, type StudyView } from "./service";

/** Field by field, whether or not either is complete enough to save. */
const sameWording = (a: CaseStudyContent, b: CaseStudyContent) => (Object.keys(a) as Array<keyof CaseStudyContent>).every((key) => a[key] === b[key]);

export interface Copy {
    content: CaseStudyContent;
    disciplineIds: string[];
}

export type EditorNotice =
    | { kind: "none" }
    | { kind: "saved" | "failed" | "partial" | "conflict" | "unknown"; message: string; field?: string | null };

export interface EditorState {
    /** Null until the case study has been saved for the first time. */
    id: string | null;
    revision: number;
    /** What is known to be saved. */
    saved: Copy;
    /** What is on the screen. */
    draft: Copy;
    /** The save in flight: its number and what it sent. */
    saving: { token: number; sent: Copy } | null;
    nextToken: number;
    notice: EditorNotice;
    /** The saved copy as last read from the server, offered after a conflict. */
    latest: StudyView | null;
}

export type EditorAction =
    | { type: "edit"; content?: Partial<CaseStudyContent>; disciplineIds?: string[] }
    | { type: "save/start" }
    | { type: "save/reply"; token: number; result: LibraryResult }
    | { type: "latest/use" }
    | { type: "latest/keep-mine" }
    | { type: "adopt"; view: StudyView };

const copyOf = (copy: Copy): Copy => ({ content: { ...copy.content }, disciplineIds: [...copy.disciplineIds] });

export function initialEditorState(view: StudyView | null, blank: CaseStudyContent): EditorState {
    const start: Copy = view ? { content: view.content, disciplineIds: view.disciplineIds } : { content: blank, disciplineIds: [] };
    return { id: view?.id ?? null, revision: view?.revision ?? 0, saved: copyOf(start), draft: copyOf(start), saving: null, nextToken: 1, notice: { kind: "none" }, latest: null };
}

export function isDirty(state: EditorState): boolean {
    return !sameWording(state.saved.content, state.draft.content) || !sameTags(state.saved.disciplineIds, state.draft.disciplineIds);
}

/** "Saved", "Changes not saved", or what went wrong. Never blank once something has been typed. */
export function saveLine(state: EditorState): string {
    if (state.saving) return "Saving…";
    if (state.notice.kind !== "none" && state.notice.kind !== "saved") return state.notice.message;
    if (isDirty(state)) return state.id ? "Changes not saved" : "Not saved yet";
    return state.id ? "Saved" : "Nothing to save yet";
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case "edit":
            return {
                ...state,
                draft: { content: { ...state.draft.content, ...(action.content ?? {}) }, disciplineIds: action.disciplineIds ? [...action.disciplineIds] : state.draft.disciplineIds },
                notice: state.notice.kind === "saved" ? { kind: "none" } : state.notice,
            };

        case "save/start":
            // One at a time.
            if (state.saving) return state;
            return { ...state, saving: { token: state.nextToken, sent: copyOf(state.draft) }, nextToken: state.nextToken + 1, notice: { kind: "none" } };

        case "save/reply": {
            // Not the save now running: an old reply. It changes nothing.
            if (!state.saving || state.saving.token !== action.token) return state;
            const { sent } = state.saving;
            const { result } = action;
            const base = { ...state, saving: null, latest: result.latest ?? state.latest };
            switch (result.status) {
                case "saved":
                case "unchanged":
                    return { ...base, id: result.id ?? state.id, revision: result.revision ?? state.revision, saved: sent, latest: null, notice: { kind: "saved", message: result.message } };
                case "partial":
                    // The wording is saved; the kinds of work are whatever the server now holds, or as they were.
                    return {
                        ...base,
                        id: result.id ?? state.id,
                        revision: result.revision ?? state.revision,
                        saved: { content: sent.content, disciplineIds: result.latest ? [...result.latest.disciplineIds] : state.saved.disciplineIds },
                        notice: { kind: "partial", message: result.message },
                    };
                case "conflict":
                    return { ...base, notice: { kind: "conflict", message: result.message } };
                case "unknown":
                    return { ...base, id: result.id ?? state.id, notice: { kind: "unknown", message: result.message } };
                default:
                    return { ...base, notice: { kind: "failed", message: result.message, field: result.field } };
            }
        }

        case "latest/use": {
            // The contractor chose the saved copy over what they typed.
            if (!state.latest) return state;
            const copy: Copy = { content: state.latest.content, disciplineIds: state.latest.disciplineIds };
            return { ...state, revision: state.latest.revision, saved: copyOf(copy), draft: copyOf(copy), latest: null, notice: { kind: "none" } };
        }

        case "latest/keep-mine": {
            // The contractor chose to keep what they typed: it is now a change on top of the latest saved copy.
            if (!state.latest) return state;
            return { ...state, revision: state.latest.revision, saved: copyOf({ content: state.latest.content, disciplineIds: state.latest.disciplineIds }), latest: null, notice: { kind: "none" } };
        }

        case "adopt":
            // After an approval or a reload: the server's copy, when nothing typed would be lost.
            if (isDirty(state) || state.saving) return { ...state, revision: state.id === action.view.id ? Math.max(state.revision, action.view.revision) : state.revision };
            return { ...state, id: action.view.id, revision: action.view.revision, saved: copyOf({ content: action.view.content, disciplineIds: action.view.disciplineIds }), draft: copyOf({ content: action.view.content, disciplineIds: action.view.disciplineIds }) };
    }
}
