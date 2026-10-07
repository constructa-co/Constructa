/**
 * Assembles a draft introduction and the facts on offer from a contractor's
 * own answers, by fixed rules. No model is involved: the same answers always
 * give the same text, and every sentence is one of their answers in a plain
 * frame. What a question was not answered for is simply left out.
 */

import { QUESTIONS, hasAnswer, parseStartYear, type AnswerMap, type QuestionKey } from "./questions";

export const INTRO_TEMPLATE_VERSION = "intro-template-v1";
export const INTRODUCTION_MAX = 2000;

export interface InterviewProfile {
    company_name?: string | null;
    business_type?: string | null;
    capability_statement?: string | null;
    years_trading?: number | null;
    accreditations?: string | null;
    insurance_details?: string | null;
}

/** What a piece of the draft came from: an answer at a revision, or a saved profile value. */
export type BasedOn =
    | { kind: "answer"; key: QuestionKey; revision: number }
    | { kind: "profile"; field: "company_name" };

export interface IntroductionDraft {
    text: string;
    basedOn: BasedOn[];
}

const strip = (text: string) => text.replace(/\s+/g, " ").trim().replace(/[.!?;,:]+$/, "");

/** "Kitchen fitting" reads better mid-sentence as "kitchen fitting". Acronyms and names like "uPVC" or "M&E" are left alone. */
function midSentence(text: string): string {
    const first = text.split(/\s/)[0] ?? "";
    return /^[A-Z][a-z]+$/.test(first) ? text[0].toLowerCase() + text.slice(1) : text;
}

/**
 * Two short paragraphs: who the business is and what it does, then how it
 * works. Returns null when there is nothing to say yet.
 *
 * How long the business has traded and how long the person has been in the
 * trade are different facts and are never combined: the first comes only
 * from the "year this business started" answer.
 */
export function buildIntroduction(answers: AnswerMap, profile: InterviewProfile | null | undefined, nowYear: number): IntroductionDraft | null {
    const text = (key: QuestionKey) => (hasAnswer(answers[key]) ? strip(answers[key]!.answer) : "");
    const used: BasedOn[] = [];
    const cite = (key: QuestionKey) => used.push({ kind: "answer", key, revision: answers[key]!.revision });

    const company = strip(profile?.company_name ?? "");
    const about: string[] = [];

    if (text("work")) {
        about.push(company ? `${company} specialises in ${midSentence(text("work"))}.` : `We specialise in ${midSentence(text("work"))}.`);
        if (company) used.push({ kind: "profile", field: "company_name" });
        cite("work");
    }
    if (text("area")) { about.push(`We cover ${text("area")}.`); cite("area"); }
    if (text("customers")) { about.push(`We mainly work for ${midSentence(text("customers"))}.`); cite("customers"); }
    const started = parseStartYear(text("business_started"), nowYear);
    if (started !== null) { about.push(`The business has been trading since ${started}.`); cite("business_started"); }
    if (text("career_experience")) { about.push(`Experience in the trade: ${midSentence(text("career_experience"))}.`); cite("career_experience"); }

    const how: string[] = [];
    if (text("strengths")) { how.push(`How we work: ${midSentence(text("strengths"))}.`); cite("strengths"); }

    const paragraphs = [about.join(" "), how.join(" ")].filter(Boolean);
    if (paragraphs.length === 0) return null;
    return { text: paragraphs.join("\n\n").slice(0, INTRODUCTION_MAX), basedOn: used };
}

export type FactField = "years_trading" | "accreditations" | "insurance_details";

export interface OfferedFact {
    field: FactField;
    /** The contractor's own answer, used word for word. For years trading, the count worked out from the year they gave. */
    proposed: string;
    existing: string | null;
    questionKey: QuestionKey;
    status: "pending" | "same" | "applied";
    appliedAt: string | null;
}

export const FACT_LABELS: Record<FactField, string> = {
    years_trading: "Years trading",
    accreditations: "Memberships and qualifications",
    insurance_details: "Insurance",
};

const comparable = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
export const sameFact = (a: string | null | undefined, b: string | null | undefined) => comparable(a) === comparable(b);

/**
 * Facts the contractor can choose to save to their profile, each approved on
 * its own. Memberships and insurance are their exact words. Nothing is
 * inferred: an unanswered question offers nothing, and personal experience
 * never becomes years trading.
 */
export function buildFacts(answers: AnswerMap, profile: InterviewProfile | null | undefined, nowYear: number): OfferedFact[] {
    const facts: OfferedFact[] = [];
    const offer = (field: FactField, proposed: string, existing: string | null, questionKey: QuestionKey) => {
        facts.push({ field, proposed, existing, questionKey, status: sameFact(existing, proposed) ? "same" : "pending", appliedAt: null });
    };

    const started = hasAnswer(answers.business_started) ? parseStartYear(answers.business_started!.answer, nowYear) : null;
    if (started !== null && nowYear - started >= 1) {
        offer("years_trading", String(nowYear - started), profile?.years_trading == null ? null : String(profile.years_trading), "business_started");
    }
    if (hasAnswer(answers.memberships)) offer("accreditations", answers.memberships!.answer.trim(), profile?.accreditations ?? null, "memberships");
    if (hasAnswer(answers.insurance)) offer("insurance_details", answers.insurance!.answer.trim(), profile?.insurance_details ?? null, "insurance");
    return facts;
}

/** The questions a draft drew on, in interview order, for "built from your answers". */
export function answersUsed(basedOn: BasedOn[]): QuestionKey[] {
    const keys = new Set(basedOn.flatMap((entry) => (entry.kind === "answer" ? [entry.key] : [])));
    return QUESTIONS.map((question) => question.key).filter((key) => keys.has(key));
}
