import { describe, expect, it } from "vitest";
import { ANSWER_MAX, QUESTIONS, cleanAnswer, interviewProgress, parseStartYear, resolveStartIndex, type AnswerMap } from "./questions";

const answered = (answer: string, revision = 1) => ({ answer, skipped: false, revision });
const skipped = { answer: "", skipped: true, revision: 1 };

describe("question set", () => {
    it("asks eight plain questions, with business age and personal experience as separate questions, and memberships apart from insurance", () => {
        expect(QUESTIONS.map((question) => question.key)).toEqual([
            "work", "business_started", "career_experience", "area", "customers", "strengths", "memberships", "insurance",
        ]);
        const text = (key: string) => { const q = QUESTIONS.find((entry) => entry.key === key)!; return `${q.title} ${q.help}`; };
        expect(text("business_started")).toContain("this business start trading");
        expect(text("business_started")).toContain("not how long you have been in the trade");
        expect(text("career_experience")).toContain("personally");
        expect(QUESTIONS[6].title).not.toMatch(/insurance/i);
        expect(QUESTIONS[7].title).toMatch(/insurance/i);
    });

    it("never asks the contractor to write a prompt or mentions AI", () => {
        for (const question of QUESTIONS) expect(`${question.title} ${question.help} ${question.example}`, question.key).not.toMatch(/\b(prompt|AI|assistant|generate)\b/i);
    });
});

describe("resolveStartIndex", () => {
    it("starts a new contractor on the first question", () => {
        expect(resolveStartIndex({})).toBe(0);
    });

    it("resumes on the first question that is neither answered nor skipped", () => {
        expect(resolveStartIndex({ work: answered("Roofing") })).toBe(1);
        expect(resolveStartIndex({ work: answered("Roofing"), business_started: skipped, career_experience: answered("20 years") })).toBe(3);
        // A gap earlier in the list wins over later answers.
        expect(resolveStartIndex({ work: answered("Roofing"), area: answered("Leeds") })).toBe(1);
    });

    it("treats a blank, never-saved answer as not yet decided", () => {
        expect(resolveStartIndex({ work: { answer: "  ", skipped: false, revision: 1 } })).toBe(0);
    });

    it("goes to the review once every question is answered or skipped", () => {
        const all: AnswerMap = Object.fromEntries(QUESTIONS.map((question, at) => [question.key, at % 2 ? skipped : answered("x")]));
        expect(resolveStartIndex(all)).toBe(QUESTIONS.length);
        expect(interviewProgress(all)).toEqual({ answered: 4, skipped: 4, total: 8 });
    });
});

describe("cleanAnswer", () => {
    it("keeps plain words and drops markup, control characters and extra space", () => {
        expect(cleanAnswer("work", "  Kitchens\n\tand   <b>bathrooms</b>\u0000‮ ", 2026)).toEqual({ ok: true, value: "Kitchens and b bathrooms /b" });
        expect(cleanAnswer("work", 42, 2026)).toEqual({ ok: true, value: "" });
    });

    it("refuses an answer over the limit", () => {
        expect(cleanAnswer("work", "x".repeat(ANSWER_MAX), 2026).ok).toBe(true);
        expect(cleanAnswer("work", "x".repeat(ANSWER_MAX + 1), 2026).ok).toBe(false);
    });

    it("accepts only a real four-digit year for when the business started", () => {
        expect(cleanAnswer("business_started", " 2017 ", 2026)).toEqual({ ok: true, value: "2017" });
        expect(cleanAnswer("business_started", "", 2026)).toEqual({ ok: true, value: "" });
        for (const bad of ["about 9 years", "17", "2030", "1850", "2017 or so", "twenty seventeen"]) {
            expect(cleanAnswer("business_started", bad, 2026).ok, bad).toBe(false);
        }
        expect(parseStartYear("2026", 2026)).toBe(2026);
        expect(parseStartYear("2027", 2026)).toBeNull();
    });
});
