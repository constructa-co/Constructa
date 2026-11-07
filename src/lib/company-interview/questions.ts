/**
 * The guided company interview: what is asked, in what order, and where a
 * contractor is up to. Pure, and fixed: no model decides what to ask next.
 *
 * Every question is optional. Nothing here stops a contractor creating a
 * project or typing their profile in by hand instead.
 */

export const QUESTION_SET_VERSION = "interview-v1";
export const ANSWER_MAX = 600;
export const INTERVIEW_PATH = "/dashboard/settings/profile/interview";

export type QuestionKey =
    | "work"
    | "business_started"
    | "career_experience"
    | "area"
    | "customers"
    | "strengths"
    | "memberships"
    | "insurance";

export interface Question {
    key: QuestionKey;
    title: string;
    help: string;
    example: string;
    /** A year is asked for as four digits; everything else is free text. */
    kind: "text" | "year";
}

export const QUESTIONS: readonly Question[] = [
    {
        key: "work",
        title: "What work does your business do most?",
        help: "Say it as you would to a customer.",
        example: "Kitchen and bathroom fitting, tiling and small extensions",
        kind: "text",
    },
    {
        key: "business_started",
        title: "What year did this business start trading?",
        help: "The business itself, not how long you have been in the trade. That is the next question. If you're not sure, skip this one.",
        example: "2017",
        kind: "year",
    },
    {
        key: "career_experience",
        title: "How long have you personally been doing this kind of work?",
        help: "Your own time in the trade, including before this business.",
        example: "22 years, starting as an apprentice joiner",
        kind: "text",
    },
    {
        key: "area",
        title: "Where do you work?",
        help: "The places you cover.",
        example: "Leeds and about 20 miles around",
        kind: "text",
    },
    {
        key: "customers",
        title: "Who do you usually work for?",
        help: "The kind of customer, not their names.",
        example: "Homeowners and a few local landlords",
        kind: "text",
    },
    {
        key: "strengths",
        title: "What do your customers notice about how you work?",
        help: "Something true and specific. A real example helps. No client names needed.",
        example: "We tidy up at the end of every day and turn up when we say we will",
        kind: "text",
    },
    {
        key: "memberships",
        title: "Do you hold any trade memberships or qualifications you want clients to know about?",
        help: "Only list what you hold now. We use your exact words and add nothing. Leave insurance for the next question.",
        example: "Gas Safe registered. City & Guilds Level 3 in plumbing",
        kind: "text",
    },
    {
        key: "insurance",
        title: "What insurance do you want clients to know you have?",
        help: "Only what you hold now, in your own words. We use them exactly and add nothing.",
        example: "Public liability £2 million. Employers' liability",
        kind: "text",
    },
];

export const QUESTION_KEYS = QUESTIONS.map((question) => question.key) as [QuestionKey, ...QuestionKey[]];

export interface SavedAnswer {
    answer: string;
    skipped: boolean;
    /** 0 means never saved. A save must name the revision it replaces. */
    revision: number;
}

export type AnswerMap = Partial<Record<QuestionKey, SavedAnswer>>;

export const hasAnswer = (saved: SavedAnswer | undefined): boolean => !!saved && !saved.skipped && saved.answer.trim() !== "";
const isDecided = (saved: SavedAnswer | undefined): boolean => !!saved && (saved.skipped || saved.answer.trim() !== "");

/** Where to open the interview: the first question neither answered nor skipped, or the review once all are. */
export function resolveStartIndex(answers: AnswerMap): number {
    const index = QUESTIONS.findIndex((question) => !isDecided(answers[question.key]));
    return index === -1 ? QUESTIONS.length : index;
}

export function interviewProgress(answers: AnswerMap): { answered: number; skipped: number; total: number } {
    return {
        answered: QUESTIONS.filter((question) => hasAnswer(answers[question.key])).length,
        skipped: QUESTIONS.filter((question) => answers[question.key]?.skipped).length,
        total: QUESTIONS.length,
    };
}

export const EARLIEST_YEAR = 1900;

/** The year a business started, if the answer is a sensible four-digit year. */
export function parseStartYear(answer: string | undefined, nowYear: number): number | null {
    const text = (answer ?? "").trim();
    if (!/^\d{4}$/.test(text)) return null;
    const year = Number(text);
    return year >= EARLIEST_YEAR && year <= nowYear ? year : null;
}

export type CleanAnswer = { ok: true; value: string } | { ok: false; error: string };

/** One answer as plain text: no control characters, single spaces, within the limit. */
export function cleanAnswer(key: QuestionKey, raw: unknown, nowYear: number): CleanAnswer {
    const text = (typeof raw === "string" ? raw : "")
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff]/g, " ")
        .replace(/[<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length > ANSWER_MAX) return { ok: false, error: `That's a bit long. Please keep it under ${ANSWER_MAX} characters.` };
    const question = QUESTIONS.find((entry) => entry.key === key);
    if (question?.kind === "year" && text !== "" && parseStartYear(text, nowYear) === null) {
        return { ok: false, error: "Enter the year as four numbers, for example 2017. If you're not sure, skip this one." };
    }
    return { ok: true, value: text };
}
