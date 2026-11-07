/**
 * Guided case-study capture: what is asked, and what has been answered. Pure.
 *
 * The questions are a different way of filling in the same draft the full
 * form edits. Each answer is one of the draft's own fields, kept exactly as
 * typed. Nothing here joins, splits, rewords or infers anything, and nothing
 * here knows who wrote a piece of text.
 *
 * `work_type` is not asked for and is never changed by an answer.
 */

import { CONTENT_LIMITS, contentProblem, trimSpaces, type CaseStudyContent } from "./content";
import { isDirty, type Copy, type EditorState } from "./editor-state";
import { fieldMessage } from "./messages";
import { sameTags } from "./service";

export const GUIDED_QUESTION_SET = "case-study-basics-v1";

export type GuidedKey = "title" | "kinds" | "delivered" | "value_added" | "place" | "duration" | "client";
type TextField = "title" | "delivered" | "value_added" | "place" | "duration_text";

export interface GuidedQuestion {
    key: GuidedKey;
    title: string;
    help: string;
    example: string;
    /** How the answer is named in a list of unsaved changes. */
    name: string;
    kind: "line" | "text" | "kinds" | "client";
    /** The one draft field a typed answer is, for the questions that are a box. */
    field?: TextField;
    /** The draft fields this question can change. Kinds of work are not a draft field. */
    fields: Array<keyof CaseStudyContent>;
    limit?: number;
    required: boolean;
}

export const GUIDED_QUESTIONS: readonly GuidedQuestion[] = [
    { key: "title", title: "What was the job?", help: "A short name for it. You can change it later.", example: "Kitchen refit, Headingley", name: "the job name", kind: "line", field: "title", fields: ["title"], limit: CONTENT_LIMITS.title, required: true },
    { key: "kinds", title: "What kinds of work did this job involve?", help: "Only tick what this job actually involved. This helps you pick the right past jobs for each proposal.", example: "", name: "the kinds of work", kind: "kinds", fields: [], required: false },
    { key: "delivered", title: "What did you do?", help: "The work itself, in your own words. A few lines is plenty.", example: "Stripped out the old kitchen, moved the sink to the window wall, fitted new units and worktops, tiled the floor.", name: "what you did", kind: "text", field: "delivered", fields: ["delivered"], limit: CONTENT_LIMITS.delivered, required: false },
    { key: "value_added", title: "What did it mean for the client?", help: "Only what actually happened. If you're not sure, skip this one.", example: "They had a working kitchen again in two weeks and more room to cook.", name: "what it meant for the client", kind: "text", field: "value_added", fields: ["value_added"], limit: CONTENT_LIMITS.value_added, required: false },
    { key: "place", title: "Roughly where?", help: "Town or area, not the address.", example: "Headingley, Leeds", name: "the place", kind: "line", field: "place", fields: ["place"], limit: CONTENT_LIMITS.place, required: false },
    { key: "duration", title: "How long did it take?", help: "Roughly is fine.", example: "3 weeks", name: "how long it took", kind: "line", field: "duration_text", fields: ["duration_text"], limit: CONTENT_LIMITS.duration_text, required: false },
    { key: "client", title: "Client and price", help: "You don't have to change anything here. Unless you do, the client is not mentioned and no price is shown.", example: "", name: "the client and price", kind: "client", fields: ["client_display", "client_text", "client_named_ok", "show_value", "value_text"], required: false },
];

export const GUIDED_KEYS = GUIDED_QUESTIONS.map((question) => question.key);
export const questionOf = (key: GuidedKey): GuidedQuestion => GUIDED_QUESTIONS.find((question) => question.key === key)!;

/** Characters as the saved limits count them. */
export const characters = (value: string) => Array.from(value).length;

/** Whether a question has an answer in this copy. An answer of only spaces is not one. */
export function answered(copy: Copy, key: GuidedKey): boolean {
    const question = questionOf(key);
    if (question.kind === "kinds") return copy.disciplineIds.length > 0;
    if (question.kind === "client") return copy.content.client_display !== "hidden" || copy.content.show_value;
    return copy.content[question.field!].trim() !== "";
}

/** Whether what is on screen for a question differs from what is saved. */
export function questionDirty(state: EditorState, key: GuidedKey): boolean {
    const question = questionOf(key);
    if (question.kind === "kinds") return !sameTags(state.saved.disciplineIds, state.draft.disciplineIds);
    return question.fields.some((field) => state.saved.content[field] !== state.draft.content[field]);
}

/** The questions with something typed and not saved, in order. A save writes all of them. */
export function dirtyQuestions(state: EditorState): GuidedKey[] {
    return GUIDED_KEYS.filter((key) => questionDirty(state, key));
}

export function unsavedNames(state: EditorState): string[] {
    return dirtyQuestions(state).map((key) => questionOf(key).name);
}

/**
 * The first of the six questions with no answer on screen, or null. Client
 * and price is never "unanswered": leaving it alone is an answer.
 */
export function firstUnanswered(copy: Copy): GuidedKey | null {
    return GUIDED_KEYS.find((key) => key !== "client" && !answered(copy, key)) ?? null;
}

export function questionAfter(key: GuidedKey): GuidedKey | null {
    return GUIDED_KEYS[GUIDED_KEYS.indexOf(key) + 1] ?? null;
}
export function questionBefore(key: GuidedKey): GuidedKey | null {
    return GUIDED_KEYS[GUIDED_KEYS.indexOf(key) - 1] ?? null;
}

const FIELD_QUESTION: Partial<Record<keyof CaseStudyContent, GuidedKey>> = {
    title: "title", delivered: "delivered", value_added: "value_added", place: "place", duration_text: "duration",
    client_display: "client", client_text: "client", client_named_ok: "client", show_value: "client", value_text: "client",
};
/** Which question a content rule, or a box the server named, belongs to. */
export function questionForField(field: string | null | undefined): GuidedKey | null {
    return (field && FIELD_QUESTION[field as keyof CaseStudyContent]) || null;
}

export const GUIDED_MESSAGES = {
    titleNeeded: "Give the job a name first. You can change it later.",
    notKept: "Anything you typed but didn't save isn't here, and we don't keep track of questions you skipped.",
    leaveConfirm: "You have changes that aren't saved. Leave without saving them?",
    createUnknown: "We couldn't confirm whether this was added. Check your case studies before adding it again.",
    createAgainWarning: "If it's in your list, open it from there. If it isn't, you can add it again. We can't promise that won't make a second copy.",
    moveHeld: "Your earlier answers were saved. What you typed after that isn't saved yet, so this question is still open.",
    leaveHeld: "Your earlier answers were saved. What you typed after that isn't saved yet, so you're still here.",
    requestFailed: "We couldn't confirm whether this was saved. Your answers are still here. Check your connection, then try again.",
} as const;

/**
 * Whether what is on screen could be saved, checked before any request with
 * the same rules the server and the database apply. Nothing is shortened or
 * tidied to make it pass. Returns the question to look at and what to say.
 */
export function problemBeforeSave(content: CaseStudyContent): { key: GuidedKey | null; message: string } | null {
    if (trimSpaces(content.title) === "") return { key: "title", message: GUIDED_MESSAGES.titleNeeded };
    const problem = contentProblem({ ...content, title: trimSpaces(content.title) });
    if (!problem) return null;
    return { key: questionForField(problem), message: fieldMessage(problem) };
}

/** How the client is referred to and whether a price is shown, in words, including whether a named client's agreement has been given. */
export function clientLines(content: CaseStudyContent): string[] {
    return [
        content.client_display === "hidden" ? "The client isn't mentioned." : content.client_display === "named"
            ? `The client is named${content.client_text.trim() ? `: ${content.client_text}` : ""}.${content.client_named_ok ? "" : " You haven't said they've agreed to it."}`
            : `The client is described${content.client_text.trim() ? `: ${content.client_text}` : ""}.`,
        content.show_value ? `A price is shown${content.value_text.trim() ? `: ${content.value_text}` : ""}.` : "No price is shown.",
    ];
}

export interface SummaryLine {
    key: GuidedKey;
    title: string;
    answered: boolean;
    /** What is on screen now, in words. Empty when there is no answer. */
    lines: string[];
    /** True when this is typed and not yet saved. */
    unsaved: boolean;
}

/** Every question with what is on screen for it now, and whether that is saved. */
export function summaryOf(state: EditorState, labelOf: (id: string) => string | null): SummaryLine[] {
    const { content, disciplineIds } = state.draft;
    return GUIDED_QUESTIONS.map((question) => {
        let lines: string[] = [];
        if (question.kind === "kinds") {
            lines = disciplineIds.map((id) => labelOf(id)).filter((label): label is string => label !== null);
        } else if (question.kind === "client") {
            lines = clientLines(content);
        } else if (answered(state.draft, question.key)) {
            lines = [content[question.field!]];
        }
        return { key: question.key, title: question.title, answered: question.kind === "client" ? true : answered(state.draft, question.key), lines, unsaved: questionDirty(state, question.key) };
    });
}

/** True when anything at all is typed and not saved, including a box no question owns. */
export const anythingUnsaved = (state: EditorState): boolean => isDirty(state);
