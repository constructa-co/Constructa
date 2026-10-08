import { describe, expect, it } from "vitest";
import { CONTENT_LIMITS, newDraft, type CaseStudyContent } from "./content";
import { initialEditorState, editorReducer } from "./editor-state";
import { GUIDED_KEYS, GUIDED_MESSAGES, GUIDED_QUESTIONS, answered, characters, dirtyQuestions, firstUnanswered, problemBeforeSave, questionAfter, questionBefore, questionForField, questionOf, summaryOf, unsavedNames } from "./guided";
import type { StudyView } from "./service";

const full: CaseStudyContent = { version: 1, title: "Kitchen refit", work_type: "Refurbishment", place: "Leeds", client_display: "named", client_text: "Mrs Example", client_named_ok: true, value_text: "£18,500", show_value: true, duration_text: "3 weeks", delivered: "We refitted it.\n\nThen tiled.", value_added: "More room." };
const view = (content: CaseStudyContent, disciplineIds: string[] = []): StudyView => ({ id: "00000000-0000-4000-8000-000000000001", revision: 4, content, disciplineIds, approved: null, approvedRevision: null, archived: false, legacyIndex: null });
const state = (content: CaseStudyContent, tags: string[] = []) => initialEditorState(view(content, tags), newDraft(""));

describe("what is asked", () => {
    it("is six questions and one optional screen, in this order, and only the job name is required", () => {
        expect(GUIDED_KEYS).toEqual(["title", "kinds", "delivered", "value_added", "place", "duration", "client"]);
        expect(GUIDED_QUESTIONS.filter((question) => question.required).map((question) => question.key)).toEqual(["title"]);
    });

    it("every draft field belongs to exactly one question, except the type of work, which no question touches", () => {
        const owned = GUIDED_QUESTIONS.flatMap((question) => question.fields);
        expect(new Set(owned).size).toBe(owned.length);
        expect([...owned].sort()).toEqual(Object.keys(full).filter((key) => key !== "version" && key !== "work_type").sort());
        expect(owned).not.toContain("work_type");
        for (const question of GUIDED_QUESTIONS.filter((entry) => entry.field)) expect(question.fields).toEqual([question.field]);
    });

    it("a box's limit is the saved limit for its field", () => {
        expect(questionOf("title").limit).toBe(CONTENT_LIMITS.title);
        expect(questionOf("delivered").limit).toBe(CONTENT_LIMITS.delivered);
        expect(questionOf("value_added").limit).toBe(CONTENT_LIMITS.value_added);
        expect(questionOf("place").limit).toBe(CONTENT_LIMITS.place);
        expect(questionOf("duration").limit).toBe(CONTENT_LIMITS.duration_text);
    });

    it("asks how long, and never when: no date goes into the programme field", () => {
        const duration = questionOf("duration");
        expect(duration.title).toBe("How long did it take?");
        expect(`${duration.title} ${duration.help} ${duration.example}`).not.toMatch(/when|date|year|month|spring|summer|autumn|winter|20\d\d/i);
    });

    it("asks for nothing that would have to be made up: no qualifications, awards, savings or results", () => {
        const words = GUIDED_QUESTIONS.map((question) => `${question.title} ${question.help} ${question.example}`).join(" ");
        expect(words).not.toMatch(/qualif|accredit|award|certif|saving|saved the client|%|guarantee|testimonial/i);
        expect(questionOf("value_added").help).toContain("Only what actually happened");
        expect(questionOf("kinds").help).toContain("Only tick what this job actually involved");
    });

    it("moves through the questions in order", () => {
        expect(questionAfter("title")).toBe("kinds");
        expect(questionAfter("duration")).toBe("client");
        expect(questionAfter("client")).toBeNull();
        expect(questionBefore("title")).toBeNull();
        expect(questionBefore("client")).toBe("duration");
    });
});

describe("what counts as answered", () => {
    it("spaces alone are not an answer, and nothing is trimmed to decide it", () => {
        const copy = { content: { ...newDraft("Job"), delivered: "  \n ", place: " Leeds " }, disciplineIds: [] };
        expect(answered(copy, "delivered")).toBe(false);
        expect(answered(copy, "place")).toBe(true);
        expect(copy.content.place).toBe(" Leeds ");
    });

    it("kinds of work are answered by a tick; client and price by a choice other than the defaults", () => {
        expect(answered({ content: newDraft("Job"), disciplineIds: [] }, "kinds")).toBe(false);
        expect(answered({ content: newDraft("Job"), disciplineIds: ["k"] }, "kinds")).toBe(true);
        expect(answered({ content: newDraft("Job"), disciplineIds: [] }, "client")).toBe(false);
        expect(answered({ content: { ...newDraft("Job"), show_value: true }, disciplineIds: [] }, "client")).toBe(true);
    });

    it("resume goes to the first of the six with no answer, and never to client and price", () => {
        expect(firstUnanswered({ content: newDraft("Job"), disciplineIds: [] })).toBe("kinds");
        expect(firstUnanswered({ content: { ...newDraft("Job"), delivered: "x" }, disciplineIds: ["k"] })).toBe("value_added");
        expect(firstUnanswered({ content: { ...full, client_display: "hidden", show_value: false }, disciplineIds: ["k"] })).toBeNull();
    });
});

describe("what is unsaved", () => {
    it("names each question whose answer differs from the saved copy, in order", () => {
        let editor = state(full, ["k1"]);
        expect(dirtyQuestions(editor)).toEqual([]);
        editor = editorReducer(editor, { type: "edit", content: { place: "York", title: "Kitchen" } });
        editor = editorReducer(editor, { type: "edit", disciplineIds: ["k1", "k2"] });
        expect(dirtyQuestions(editor)).toEqual(["title", "kinds", "place"]);
        expect(unsavedNames(editor)).toEqual(["the job name", "the kinds of work", "the place"]);
    });

    it("the same kinds of work in another order are not a change", () => {
        const editor = editorReducer(state(full, ["k1", "k2"]), { type: "edit", disciplineIds: ["k2", "k1"] });
        expect(dirtyQuestions(editor)).toEqual([]);
    });
});

describe("checked before any request, with nothing shortened", () => {
    it("no job name", () => {
        expect(problemBeforeSave(newDraft(""))).toEqual({ key: "title", message: GUIDED_MESSAGES.titleNeeded });
        expect(problemBeforeSave({ ...newDraft(""), title: "   " })).toEqual({ key: "title", message: GUIDED_MESSAGES.titleNeeded });
    });

    it.each([
        ["title", { title: "t".repeat(201) }, "title"],
        ["delivered", { delivered: "d".repeat(5001) }, "delivered"],
        ["value_added", { value_added: "v".repeat(5001) }, "value_added"],
        ["place", { place: "p".repeat(201) }, "place"],
        ["duration_text", { duration_text: "d".repeat(101) }, "duration"],
        ["client_text", { client_text: "c".repeat(201) }, "client"],
        ["value_text", { value_text: "9".repeat(51) }, "client"],
        ["a line break in a one-line box", { place: "Leeds\nYork" }, "place"],
    ])("over-long or malformed %s is refused and pointed at its question", (_name, patch, key) => {
        const content = { ...newDraft("Job"), ...patch } as CaseStudyContent;
        const before = JSON.stringify(content);
        expect(problemBeforeSave(content)?.key).toBe(key);
        expect(JSON.stringify(content)).toBe(before);
    });

    it("at the limit is fine, counted in characters as the database counts them", () => {
        expect(problemBeforeSave({ ...newDraft("Job"), delivered: "😀".repeat(5000) })).toBeNull();
        expect(characters("😀😀")).toBe(2);
    });

    it("a field no question owns is not blamed on a question", () => {
        expect(problemBeforeSave({ ...newDraft("Job"), work_type: "w".repeat(201) })?.key).toBeNull();
        expect(questionForField("work_type")).toBeNull();
        expect(questionForField("client_named_ok")).toBe("client");
    });
});

describe("the summary", () => {
    const labels = (id: string) => ({ k1: "Kitchens", k2: "Tiling" } as Record<string, string>)[id] ?? null;

    it("shows each answer exactly as it is, and 'not answered' as no lines", () => {
        const lines = summaryOf(state({ ...newDraft("Kitchen refit"), delivered: "We refitted it.\n\nThen tiled." }, ["k2", "gone"]), labels);
        expect(lines.map((line) => line.key)).toEqual(GUIDED_KEYS);
        expect(lines.find((line) => line.key === "delivered")!.lines).toEqual(["We refitted it.\n\nThen tiled."]);
        expect(lines.find((line) => line.key === "kinds")!.lines).toEqual(["Tiling"]);
        expect(lines.find((line) => line.key === "place")).toMatchObject({ answered: false, lines: [] });
        expect(lines.find((line) => line.key === "client")!.lines).toEqual(["The client isn't mentioned.", "No price is shown."]);
    });

    it("says when a named client has not been confirmed, and never says it has been when it has not", () => {
        const unconfirmed = summaryOf(state({ ...full, client_named_ok: false }), labels).find((line) => line.key === "client")!;
        expect(unconfirmed.lines[0]).toBe("The client is named: Mrs Example. You haven't said they've agreed to it.");
        const confirmed = summaryOf(state(full), labels).find((line) => line.key === "client")!;
        expect(confirmed.lines).toEqual(["The client is named: Mrs Example.", "A price is shown: £18,500."]);
    });

    it("marks what is typed and not saved", () => {
        const editor = editorReducer(state(full), { type: "edit", content: { place: "York" } });
        const lines = summaryOf(editor, labels);
        expect(lines.filter((line) => line.unsaved).map((line) => line.key)).toEqual(["place"]);
        expect(lines.find((line) => line.key === "place")!.lines).toEqual(["York"]);
    });

    it("says plainly what is not remembered", () => {
        expect(GUIDED_MESSAGES.notKept).toBe("Anything you typed but didn't save isn't here, and we don't keep track of questions you skipped.");
    });
});
