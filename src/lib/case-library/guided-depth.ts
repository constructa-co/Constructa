/**
 * Guided case-study capture: the three optional "more about this job"
 * questions. Pure.
 *
 * A depth answer is typed as a NOTE. A note is not part of the case study
 * and is never sent. The contractor can ADD it, once, as one paragraph on
 * the end of "What you did", after which it is ordinary text in that one
 * box.
 *
 * Nothing here takes saved text apart. `present` is a literal check that a
 * paragraph starts with certain words. It says nothing about who wrote it,
 * whether it is true, or how many there are. Nothing is trimmed, normalised
 * or cut, and there is no regular expression over text.
 */

import { CONTENT_LIMITS } from "./content";

export type DepthKey = "challenge" | "response" | "lesson";
export const DEPTH_KEYS: readonly DepthKey[] = ["challenge", "response", "lesson"];

export interface DepthQuestion {
    key: DepthKey;
    title: string;
    help: string;
    /** How the note is named in a list of things typed but not added. */
    name: string;
    /** The fixed words a paragraph added from this question starts with. */
    leadIn: string;
    /** Those words as they are quoted on screen: without the trailing space. */
    said: string;
}

export const DEPTH_QUESTIONS: readonly DepthQuestion[] = [
    { key: "challenge", title: "Was anything tricky about this job?", help: "Access, timing, something you only found once you'd started. If nothing was, skip this.", name: "the tricky part", leadIn: "The tricky part: ", said: "The tricky part:" },
    { key: "response", title: "What did you do about it?", help: "What you actually did.", name: "what you did about it", leadIn: "What we did about it: ", said: "What we did about it:" },
    { key: "lesson", title: "Is there anything you do differently because of this job?", help: "Something you now do as a matter of course. Not a result, and not a promise.", name: "what you do differently now", leadIn: "What we do differently now: ", said: "What we do differently now:" },
];

export const depthOf = (key: DepthKey): DepthQuestion => DEPTH_QUESTIONS.find((question) => question.key === key)!;
export const LEAD_IN: Record<DepthKey, string> = { challenge: depthOf("challenge").leadIn, response: depthOf("response").leadIn, lesson: depthOf("lesson").leadIn };


export type Notes = Record<DepthKey, string>;
export const NO_NOTES: Notes = { challenge: "", response: "", lesson: "" };

/** The most a note may hold, on its own account. An edit that would pass it is refused; nothing is cut. */
export const NOTE_MAX = CONTENT_LIMITS.delivered;
const TEXT_MAX = CONTENT_LIMITS.delivered;
const BLANK_LINE = "\n\n";

/** Characters as the saved limit counts them (code points). */
export const chars = (value: string): number => Array.from(value).length;

/** A note is THERE when it is not exactly empty. Spaces count: typing spaces is still typing. */
export const noteThere = (note: string): boolean => note !== "";
export const anyNote = (notes: Notes): boolean => DEPTH_KEYS.some((key) => noteThere(notes[key]));
export const notesWith = (notes: Notes): DepthKey[] => DEPTH_KEYS.filter((key) => noteThere(notes[key]));
export const sameNotes = (a: Notes, b: Notes): boolean => DEPTH_KEYS.every((key) => a[key] === b[key]);

/**
 * Whether the text has a paragraph starting with this question's lead-in:
 * at the very start, or straight after a blank line. Literal and
 * case-sensitive. A lead-in after "\r\n\r\n" is NOT seen: see the tests for
 * why that cannot reach saved text.
 */
export function present(text: string, key: DepthKey): boolean {
    return text.startsWith(LEAD_IN[key]) || text.includes(BLANK_LINE + LEAD_IN[key]);
}

const separator = (text: string): string => (text === "" ? "" : BLANK_LINE);

/** How many characters a note for this question could be and still fit. May be zero or negative. */
export function room(text: string, key: DepthKey): number {
    return TEXT_MAX - chars(text) - chars(separator(text)) - chars(LEAD_IN[key]);
}

export type AddStatus = "ok" | "nothing" | "present" | "not-offered" | "no-room";

/**
 * Whether a note can be added, and if not, the first reason, in this order:
 * nothing to add (empty, or only white space); a paragraph with that lead-in
 * is already there; for "what did you do about it", no paragraph with the
 * challenge lead-in to follow; not enough room; otherwise ok.
 */
export function canAdd(text: string, key: DepthKey, note: string): AddStatus {
    if (note.trim() === "") return "nothing";
    if (present(text, key)) return "present";
    if (key === "response" && !present(text, "challenge")) return "not-offered";
    if (chars(note) > room(text, key)) return "no-room";
    return "ok";
}

/**
 * The text with one paragraph on its end: the lead-in and the note, exactly
 * as typed. The existing text is not touched in any way. Call only when
 * `canAdd` says "ok".
 */
export function add(text: string, key: DepthKey, note: string): string {
    return text + separator(text) + LEAD_IN[key] + note;
}

/** Where the depth questions lead next from a given one, given the text as it is now and what is typed. */
export function depthAfter(text: string, notes: Notes, key: DepthKey): DepthKey | null {
    if (key === "challenge") return present(text, "challenge") || noteThere(notes.response) ? "response" : "lesson";
    if (key === "response") return "lesson";
    return null;
}
export function depthBefore(text: string, notes: Notes, key: DepthKey): DepthKey | null {
    if (key === "lesson") return present(text, "challenge") || noteThere(notes.response) ? "response" : "challenge";
    if (key === "response") return "challenge";
    return null;
}

export const DEPTH_MESSAGES = {
    noteTooLong: `That's more than this box can hold (${NOTE_MAX.toLocaleString("en-GB")} characters). Nothing was changed or cut.`,
    notesBlockLeave: (names: string[]) => `You've typed ${names.join(", ")} but not added it to your text. Add it or clear it first, or choose to go without it. Nothing was saved or sent.`,
    leaveHeldNotes: (names: string[]) => `Your answers were saved. What you typed for ${names.join(", ")} hasn't been added to your text, so you're still here.`,
    moveHeldNotes: (names: string[]) => `Your answers were saved. What you typed for ${names.join(", ")} hasn't been added to your text, so this is still open.`,
} as const;
