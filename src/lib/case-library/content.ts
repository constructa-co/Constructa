/**
 * Case-study library: what a case study's content may be. Pure.
 *
 * NOT USED BY THE APPLICATION YET. Nothing imports this outside its own
 * tests. It is the application half of a contract whose database half is
 * `supabase/migrations/20261012090000_case_library_foundation.sql`.
 *
 * The rules here are the same rules, checked in the same order and reported
 * with the same codes, as `public.case_library_content_problem` and its
 * companions. `__fixtures__/contract-vectors.json` is run through both, so a
 * rule changed on one side only fails a test.
 *
 * Lengths are counted in characters as the database counts them (code
 * points), not as JavaScript's `.length` does.
 */

export const CONTENT_VERSION = 1;

export const CONTENT_LIMITS = {
    title: 200,
    work_type: 200,
    place: 200,
    client_text: 200,
    value_text: 50,
    duration_text: 100,
    delivered: 5000,
    value_added: 5000,
    disciplinesPerStudy: 6,
    label: 80,
} as const;

export type ClientDisplay = "hidden" | "described" | "named";

/** CaseStudyContent v1: exactly these keys, all present, nothing else. */
export interface CaseStudyContent {
    version: 1;
    title: string;
    work_type: string;
    place: string;
    client_display: ClientDisplay;
    client_text: string;
    client_named_ok: boolean;
    value_text: string;
    show_value: boolean;
    duration_text: string;
    delivered: string;
    value_added: string;
}

/** The complete copy made at approval: the content, minus anything hidden, plus the tag labels as plain strings. */
export interface ApprovedCaseStudy extends CaseStudyContent {
    disciplines: string[];
}

const CONTENT_KEYS = ["client_display", "client_named_ok", "client_text", "delivered", "duration_text", "place", "show_value", "title", "value_added", "value_text", "version", "work_type"];

const SINGLE_LINE_CONTROL = /[\u0001-\u001F\u007F]/;
/** Line breaks and tabs are allowed; other control characters are not. */
const MULTI_LINE_CONTROL = /[\u0001-\u0008\u000B-\u001F\u007F]/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const characters = (value: string) => Array.from(value).length;
/** Spaces only, as the database's `btrim(value, ' ')`. */
export const trimSpaces = (value: string) => value.replace(/^ +| +$/g, "");

function textOk(value: unknown, min: number, max: number, multiline: boolean): value is string {
    if (typeof value !== "string") return false;
    const length = characters(value);
    return length >= min && length <= max && !(multiline ? MULTI_LINE_CONTROL : SINGLE_LINE_CONTROL).test(value);
}

/** Null when a discipline label is acceptable, otherwise "label". */
export function labelProblem(label: unknown): "label" | null {
    if (typeof label !== "string") return "label";
    if (label !== trimSpaces(label)) return "label";
    const length = characters(label);
    if (length < 1 || length > CONTENT_LIMITS.label) return "label";
    if (SINGLE_LINE_CONTROL.test(label)) return "label";
    if (label.includes("  ")) return "label";
    return null;
}

/** Null when the value is acceptable CaseStudyContent v1, otherwise the code of the first rule it breaks. */
export function contentProblem(value: unknown): string | null {
    if (!isObject(value)) return "not-object";
    const keys = Object.keys(value).sort();
    if (keys.length !== CONTENT_KEYS.length || keys.some((key, index) => key !== CONTENT_KEYS[index])) return "keys";
    if (value.version !== 1) return "version";
    if (!textOk(value.title, 1, CONTENT_LIMITS.title, false) || value.title !== trimSpaces(value.title)) return "title";
    if (!textOk(value.work_type, 0, CONTENT_LIMITS.work_type, false)) return "work_type";
    if (!textOk(value.place, 0, CONTENT_LIMITS.place, false)) return "place";
    if (typeof value.client_display !== "string" || !["hidden", "described", "named"].includes(value.client_display)) return "client_display";
    if (!textOk(value.client_text, 0, CONTENT_LIMITS.client_text, false)) return "client_text";
    if (typeof value.client_named_ok !== "boolean") return "client_named_ok";
    if (!textOk(value.value_text, 0, CONTENT_LIMITS.value_text, false)) return "value_text";
    if (typeof value.show_value !== "boolean") return "show_value";
    if (!textOk(value.duration_text, 0, CONTENT_LIMITS.duration_text, false)) return "duration_text";
    if (!textOk(value.delivered, 0, CONTENT_LIMITS.delivered, true)) return "delivered";
    if (!textOk(value.value_added, 0, CONTENT_LIMITS.value_added, true)) return "value_added";
    return null;
}

/** What must also be true before a draft can be approved. Null when it can. */
export function approvalProblem(value: unknown): string | null {
    const problem = contentProblem(value);
    if (problem) return problem;
    const content = value as CaseStudyContent;
    if (content.client_display !== "hidden" && trimSpaces(content.client_text) === "") return "client_text_missing";
    if (content.client_display === "named" && content.client_named_ok !== true) return "client_not_confirmed";
    if (content.show_value && trimSpaces(content.value_text) === "") return "value_text_missing";
    return null;
}

/**
 * The approved copy the database makes. A client the contractor left hidden,
 * and a figure they chose not to show, are blanked, so nothing a proposal
 * reads can carry them.
 */
export function approvedValue(content: CaseStudyContent, labels: readonly string[]): ApprovedCaseStudy {
    return {
        ...content,
        client_text: content.client_display === "hidden" ? "" : content.client_text,
        client_named_ok: content.client_display === "named",
        value_text: content.show_value ? content.value_text : "",
        disciplines: [...labels],
    };
}

/** Null when a stored approved copy is well formed. */
export function approvedProblem(value: unknown): string | null {
    if (!isObject(value)) return "not-object";
    const { disciplines, ...content } = value;
    if (!Array.isArray(disciplines) || disciplines.length > CONTENT_LIMITS.disciplinesPerStudy) return "disciplines";
    if (disciplines.some((label) => labelProblem(label) !== null)) return "disciplines";
    const problem = approvalProblem(content);
    if (problem) return problem;
    const approved = content as unknown as CaseStudyContent;
    if (approved.client_display === "hidden" && approved.client_text !== "") return "client_text_hidden";
    if (!approved.show_value && approved.value_text !== "") return "value_text_hidden";
    return null;
}

/**
 * A new draft with the safe defaults: the client is not mentioned and no
 * figure is shown, until the contractor chooses otherwise.
 */
export function newDraft(title: string): CaseStudyContent {
    return {
        version: 1,
        title: trimSpaces(title),
        work_type: "",
        place: "",
        client_display: "hidden",
        client_text: "",
        client_named_ok: false,
        value_text: "",
        show_value: false,
        duration_text: "",
        delivered: "",
        value_added: "",
    };
}

/**
 * Builds content from loosely typed input, such as a form. Known fields are
 * read; anything else is dropped, never passed through. Windows line endings
 * become plain line breaks. The result still has to pass `contentProblem`:
 * this tidies shape, it does not make over-long or malformed text acceptable.
 */
export function contentFromInput(input: unknown): CaseStudyContent {
    const row = isObject(input) ? input : {};
    const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string).replace(/\r\n?/g, "\n") : "");
    const display = row.client_display;
    return {
        version: 1,
        title: trimSpaces(text("title").replace(/\n/g, " ")),
        work_type: text("work_type"),
        place: text("place"),
        client_display: display === "described" || display === "named" ? display : "hidden",
        client_text: text("client_text"),
        client_named_ok: row.client_named_ok === true,
        value_text: text("value_text"),
        show_value: row.show_value === true,
        duration_text: text("duration_text"),
        delivered: text("delivered"),
        value_added: text("value_added"),
    };
}
