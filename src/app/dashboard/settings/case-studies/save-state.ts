/**
 * The older case-study editor: what is known to be saved, what is on the
 * screen, and what a save said. Pure.
 *
 * This makes saving HONEST. It is NOT protection against two tabs. A save
 * still replaces the whole stored list, so a tab that loaded an older list
 * will still overwrite a newer one, and that write will still be
 * acknowledged, because it will have been made. Nothing here detects,
 * refuses, merges or warns about that. It is a known, open residual.
 *
 * The rules:
 *
 *  - `saved` is the list as last KNOWN to be stored: as loaded, or as SENT in
 *    the last acknowledged save. Never what is on the screen.
 *  - `draft` is what is on the screen. No reply ever changes it.
 *  - One save at a time. A reply that is not from the save now running is
 *    ignored.
 *  - A save whose outcome is not known leaves the editor UNCERTAIN: the
 *    stored list may be the old one or the one that was sent. That stays so,
 *    whatever is typed afterwards, until a later save is acknowledged. Typing
 *    the old list back in does not make it known.
 *  - With nothing changed, nothing running and nothing uncertain, pressing
 *    save sends nothing.
 *
 * Entries are never inspected, tidied, capped or reshaped here: whatever keys
 * and values an entry has are kept exactly.
 */

export type SaveCaseStudiesResult =
    /** Exactly one row came back and it is the caller's own. `refreshed` is false if other pages could not be told to reload. */
    | { status: "saved"; refreshed: boolean }
    /** Nobody is signed in. No write was attempted. */
    | { status: "signed-out"; message: string }
    /** What was sent is not a list. No write was attempted. */
    | { status: "refused"; message: string }
    /** The write ran and no row came back. Whether the profile is missing or not the caller's to change is not known. */
    | { status: "no-row"; message: string }
    /** The write may or may not have been made. */
    | { status: "unknown"; message: string };

export const SAVE_MESSAGES = {
    signedOut: "You're signed out, so nothing was sent. Sign in again to save. Your case studies are still on this page.",
    refused: "That couldn't be sent as it is, so nothing was sent.",
    noRow: "The save wasn't confirmed: your company profile wasn't available to save to. Your changes are still on this page.",
    unknown: "We couldn't confirm whether that was saved. Your changes are still on this page. Saving again sends this whole list and replaces whatever is stored, including anything changed in another tab or window.",
    saved: "Saved.",
    savedNotRefreshed: "Saved. Other pages may show the older list until they are reloaded.",
    nothingToSave: "There's nothing new to save.",
    unsaved: "Changes not saved.",
    uncertain: "We don't know whether your last save went through. Save again to be sure.",
    saving: "Saving…",
    leaveConfirm: "Your case studies have changes that aren't saved, or a save that wasn't confirmed. Leave anyway?",
} as const;

export type SaveNotice =
    | { kind: "none" }
    | { kind: "saved"; message: string }
    | { kind: "nothing-to-save"; message: string }
    | { kind: "failed"; message: string }
    | { kind: "unknown"; message: string };

export interface SaveState<T> {
    saved: T[];
    draft: T[];
    /** The save in flight: its number and a copy of exactly what it sent. */
    saving: { token: number; sent: T[] } | null;
    nextToken: number;
    /** A save may have been made, and it is not known whether it was. Cleared only by an acknowledged save. */
    uncertain: boolean;
    notice: SaveNotice;
}

export type SaveAction<T> =
    | { type: "edit"; change: (draft: T[]) => T[] }
    | { type: "save/start" }
    | { type: "save/reply"; token: number; result: SaveCaseStudiesResult };

/** A copy that shares nothing with the original, so later typing cannot alter what was sent or acknowledged. */
const copyOf = <T,>(list: T[]): T[] => structuredClone(list);

export function initialSaveState<T>(loaded: T[]): SaveState<T> {
    return { saved: copyOf(loaded), draft: copyOf(loaded), saving: null, nextToken: 1, uncertain: false, notice: { kind: "none" } };
}

/**
 * Whether two values hold the same data: same entries in the same order,
 * objects with the same keys and values whatever order the keys are in.
 * Changes neither. An absent key and a key set to `undefined` are the same,
 * as they are once sent.
 */
export function sameData(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((entry, index) => sameData(entry, b[index]));
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) if (!sameData(left[key], right[key])) return false;
    return true;
}

/** What is on the screen differs from what is known to be saved. */
export const isDirty = <T,>(state: SaveState<T>): boolean => !sameData(state.draft, state.saved);

/** Leaving now could lose something: unsaved changes, a save still running, or a save whose outcome is not known. */
export const needsLeaveWarning = <T,>(state: SaveState<T>): boolean => isDirty(state) || state.saving !== null || state.uncertain;

/** Pressing save would send nothing: nothing changed, nothing running, nothing uncertain. */
export const nothingToSave = <T,>(state: SaveState<T>): boolean => state.saving === null && !state.uncertain && !isDirty(state);

/** The save now running, as the screen must send it: once, and exactly this list. Null when none is running. */
export function requestOf<T>(state: SaveState<T>): { token: number; sent: T[] } | null {
    return state.saving;
}

/** The one line that says where things stand. Never blank once there is something to say. */
export function statusLine<T>(state: SaveState<T>): string {
    if (state.saving) return SAVE_MESSAGES.saving;
    if (state.notice.kind === "failed" || state.notice.kind === "unknown") return state.notice.message;
    if (state.uncertain) return SAVE_MESSAGES.uncertain;
    if (isDirty(state)) return SAVE_MESSAGES.unsaved;
    if (state.notice.kind === "saved" || state.notice.kind === "nothing-to-save") return state.notice.message;
    return "";
}

export function saveReducer<T>(state: SaveState<T>, action: SaveAction<T>): SaveState<T> {
    switch (action.type) {
        case "edit":
            // Typing never touches what is saved, what was sent, or whether the last save is known.
            return { ...state, draft: action.change(state.draft), notice: state.notice.kind === "saved" || state.notice.kind === "nothing-to-save" ? { kind: "none" } : state.notice };

        case "save/start":
            // One at a time.
            if (state.saving) return state;
            if (nothingToSave(state)) return { ...state, notice: { kind: "nothing-to-save", message: SAVE_MESSAGES.nothingToSave } };
            return { ...state, saving: { token: state.nextToken, sent: copyOf(state.draft) }, nextToken: state.nextToken + 1, notice: { kind: "none" } };

        case "save/reply": {
            // Not the save now running: an old reply. It changes nothing.
            if (!state.saving || state.saving.token !== action.token) return state;
            const { sent } = state.saving;
            const { result } = action;
            const base = { ...state, saving: null };
            switch (result.status) {
                case "saved":
                    // What was SENT is what is saved. Anything typed since is still on the screen, and still unsaved.
                    return { ...base, saved: sent, uncertain: false, notice: { kind: "saved", message: result.refreshed ? SAVE_MESSAGES.saved : SAVE_MESSAGES.savedNotRefreshed } };
                case "unknown":
                    // It may have been written. What is stored is now not known, and stays so until a save is acknowledged.
                    return { ...base, uncertain: true, notice: { kind: "unknown", message: result.message } };
                default:
                    // No write was attempted, or none was confirmed. Nothing known has changed; an earlier uncertainty remains.
                    return { ...base, notice: { kind: "failed", message: result.message } };
            }
        }
    }
}
