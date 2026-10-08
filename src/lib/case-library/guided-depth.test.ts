import { describe, expect, it } from "vitest";
import { CONTENT_LIMITS, contentFromInput, contentProblem, newDraft } from "./content";
import { DEPTH_KEYS, DEPTH_QUESTIONS, LEAD_IN, NOTE_MAX, add, anyNote, canAdd, chars, depthAfter, depthBefore, noteThere, notesWith, present, room, sameNotes, type AddStatus, type DepthKey, type Notes } from "./guided-depth";

/**
 * The depth functions add one paragraph to the end of a text and check, by
 * literal comparison, whether a paragraph already starts with certain words.
 *
 * What these tests show: existing text is never altered, a note is added
 * exactly as typed, lengths are exact, and every string has a defined
 * answer. What they do NOT show, and nothing can: who wrote a paragraph,
 * whether it is true, or that a text was ever "made of answers". There is no
 * function here that takes a text apart, so there is no round trip to test.
 */
const MAX = CONTENT_LIMITS.delivered;
const none: Notes = { challenge: "", response: "", lesson: "" };

/** A small seeded generator, so a failure can be run again. No dependency. */
function seeded(seed: number) {
    let state = seed >>> 0;
    const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
    return { pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)], int: (max: number) => Math.floor(next() * (max + 1)) };
}

/** Pieces chosen to break text handling. */
const PIECES: readonly string[] = [
    ...Object.values(LEAD_IN),
    ...Object.values(LEAD_IN).map((value) => value.trimEnd()),
    ...Object.values(LEAD_IN).map((value) => value.toLowerCase()),
    ...Object.values(LEAD_IN).map((value) => `\n\n${value}`),
    ...Object.values(LEAD_IN).map((value) => `\r\n\r\n${value}`),
    "\n", "\n\n", "\n\n\n", "\n\n\n\n", "\r\n", "\r", "\t", " ", "  ", "",
    "\u2028", "\u2029", "\u0085", "\u00a0", "\u200b", "\u200d", "\u200e", "\u200f", "\ufeff",
    "e\u0301", "\u00e9", "a\u0308\u0323", "😀", "👩‍👧", "𝒜", "\ud83d", "\ude00", "\u0000", "\u0007", "\u007f",
    "We refitted the kitchen.", "the tricky part was access", "Mrs O'Brien — £9,000", "عربى", "日本語", "<b>x</b>", "$&", "\\n",
];
function randomText(random: ReturnType<typeof seeded>, pieces = 8): string {
    let text = "";
    for (let count = random.int(pieces); count > 0; count -= 1) text += random.pick(PIECES);
    return text;
}
const hasRealText = (note: string) => note.trim() !== "";

describe("the three questions", () => {
    it("are these, in this order, each with fixed words a paragraph added from it starts with", () => {
        expect(DEPTH_KEYS).toEqual(["challenge", "response", "lesson"]);
        expect(LEAD_IN).toEqual({ challenge: "The tricky part: ", response: "What we did about it: ", lesson: "What we do differently now: " });
        expect(Object.values(LEAD_IN).map(chars)).toEqual([17, 22, 28]);
        for (const question of DEPTH_QUESTIONS) expect(question.leadIn).toBe(`${question.said} `);
    });

    it("ask for nothing that would have to be made up, and none of them asks about results or wins", () => {
        const words = DEPTH_QUESTIONS.map((question) => `${question.title} ${question.help}`).join(" ");
        expect(words).not.toMatch(/qualif|accredit|award|certif|saving|%|guarantee|testimonial|\bwin\b|\bwins\b|\bwon\b/i);
        expect(DEPTH_QUESTIONS[2].help).toContain("Not a result, and not a promise.");
    });

    it("a note may be as long as the text may be, and no longer", () => {
        expect(NOTE_MAX).toBe(5000);
    });
});

describe("add: one paragraph on the end, and nothing else touched", () => {
    it.each(DEPTH_KEYS)("%s: for thousands of generated texts and notes, the text is an exact prefix and the note an exact suffix", (key) => {
        const random = seeded(20261008 + DEPTH_KEYS.indexOf(key));
        let checked = 0;
        for (let round = 0; round < 4000; round += 1) {
            const text = randomText(random);
            const note = randomText(random, 5);
            const result = add(text, key, note);
            // A1: existing text untouched, whatever it is.
            expect(result.startsWith(text)).toBe(true);
            // A2: the note exactly as typed, spaces and all, after the fixed words.
            expect(result.endsWith(LEAD_IN[key] + note)).toBe(true);
            // Nothing else: the only thing between them is a blank line, and only when there was text.
            expect(result).toBe(text === "" ? LEAD_IN[key] + note : `${text}\n\n${LEAD_IN[key]}${note}`);
            // A3: exact length, by characters and by UTF-16 units.
            expect(chars(result)).toBe(chars(text) + (text === "" ? 0 : 2) + chars(LEAD_IN[key]) + chars(note));
            expect(result.length).toBe(text.length + (text === "" ? 0 : 2) + LEAD_IN[key].length + note.length);
            checked += 1;
        }
        expect(checked).toBe(4000);
    });

    it("an empty text gets no blank line before the paragraph; a text of only spaces is a text and is kept", () => {
        expect(add("", "challenge", "access")).toBe("The tricky part: access");
        expect(add("  ", "challenge", "access")).toBe("  \n\nThe tricky part: access");
        expect(add("\n", "lesson", "x")).toBe("\n\n\nWhat we do differently now: x");
    });

    it("spaces and line breaks at either end of a note are added as typed", () => {
        expect(add("Work.", "challenge", "  access \n\n second line  ")).toBe("Work.\n\nThe tricky part:   access \n\n second line  ");
    });

    it("does no normalising: a combining form and its precomposed form stay different, and a carriage return stays", () => {
        expect(add("e\u0301", "challenge", "\u00e9")).toBe("e\u0301\n\nThe tricky part: \u00e9");
        expect(add("e\u0301", "challenge", "x")).not.toBe(add("\u00e9", "challenge", "x"));
        expect(add("Work.\r\n", "challenge", "a\r\nb")).toBe("Work.\r\n\n\nThe tricky part: a\r\nb");
        expect(add("\ud83d", "challenge", "\ude00")).toBe("\ud83d\n\nThe tricky part: \ude00");
        expect(add("\u0000", "challenge", "\u0007")).toBe("\u0000\n\nThe tricky part: \u0007");
    });

    it("counts characters as the saved limit does, not as JavaScript's length does", () => {
        expect(chars("😀😀")).toBe(2);
        expect("😀😀".length).toBe(4);
        expect(chars(add("😀", "challenge", "😀"))).toBe(1 + 2 + 17 + 1);
    });
});

describe("present: a literal fact about the text, and no more", () => {
    it.each(DEPTH_KEYS)("%s: at the very start, or straight after a blank line", (key) => {
        expect(present(LEAD_IN[key], key)).toBe(true);
        expect(present(`${LEAD_IN[key]}something`, key)).toBe(true);
        expect(present(`Work.\n\n${LEAD_IN[key]}something`, key)).toBe(true);
        expect(present(`Work.\n\n\n${LEAD_IN[key]}something`, key)).toBe(true);
        expect(present(`Work.\n\n${LEAD_IN[key]}`, key)).toBe(true);
    });

    it.each(DEPTH_KEYS)("%s: not in the middle of a line, after one line break, without its space, or in other case", (key) => {
        expect(present(`Work, and ${LEAD_IN[key]}something`, key)).toBe(false);
        expect(present(`Work.\n${LEAD_IN[key]}something`, key)).toBe(false);
        expect(present(` ${LEAD_IN[key]}something`, key)).toBe(false);
        expect(present(`Work.\n\n ${LEAD_IN[key]}something`, key)).toBe(false);
        expect(present(`Work.\n\n${LEAD_IN[key].trimEnd()}something`, key)).toBe(false);
        expect(present(`Work.\n\n${LEAD_IN[key].toLowerCase()}something`, key)).toBe(false);
        expect(present(`Work.\n\n${LEAD_IN[key].toUpperCase()}something`, key)).toBe(false);
        expect(present("", key)).toBe(false);
    });

    it("other separators are not blank lines: a paragraph after them is not seen", () => {
        for (const separator of ["\u2028\u2028", "\u2029", "\u0085\u0085", "\n\u00a0\n", "\n\t\n", "\n \n"]) {
            expect(present(`Work.${separator}The tricky part: x`, "challenge"), JSON.stringify(separator)).toBe(false);
        }
    });

    it("repeated and reordered paragraphs are simply 'present'; it does not count them or say what order they are in", () => {
        const text = "What we do differently now: z\n\nThe tricky part: a\n\nThe tricky part: b";
        expect(DEPTH_KEYS.map((key) => present(text, key))).toEqual([true, false, true]);
    });

    it("never changes what it is given, and answers for every generated string", () => {
        const random = seeded(7);
        for (let round = 0; round < 4000; round += 1) {
            const text = randomText(random);
            const copy = `${text}`;
            for (const key of DEPTH_KEYS) expect(typeof present(text, key)).toBe("boolean");
            expect(text).toBe(copy);
        }
    });

    it("is true after an Add of real text, whatever the text and note were", () => {
        const random = seeded(11);
        for (let round = 0; round < 4000; round += 1) {
            const key = random.pick(DEPTH_KEYS);
            expect(present(add(randomText(random), key, randomText(random, 4)), key)).toBe(true);
        }
    });
});

describe("carriage returns: what the literal check misses in memory, and why it cannot reach saved text", () => {
    const pasted = "Work.\r\n\r\nThe tricky part: typed by hand, pasted with Windows line endings";

    it("a paragraph after CRLF CRLF is NOT seen, so in memory an Add would be offered and would put a second one on the end", () => {
        expect(present(pasted, "challenge")).toBe(false);
        expect(canAdd(pasted, "challenge", "another")).toBe("ok");
        const added = add(pasted, "challenge", "another");
        expect(added).toBe(`${pasted}\n\nThe tricky part: another`);
        // Add did not rewrite the carriage returns to make its own check pass.
        expect(added.startsWith(pasted)).toBe(true);
    });

    it("that text cannot be saved as it is: the existing content rule refuses a carriage return", () => {
        expect(contentProblem({ ...newDraft("Job"), delivered: pasted })).toBe("delivered");
        expect(contentProblem({ ...newDraft("Job"), delivered: add(pasted, "challenge", "another") })).toBe("delivered");
        expect(contentProblem({ ...newDraft("Job"), delivered: "a\rb" })).toBe("delivered");
    });

    it("and the existing action turns CRLF into LF on the way in, after which the paragraph IS seen", () => {
        // This is the accepted service's own tidy-up, unchanged. It is not done by the depth functions.
        const asTheServiceWouldStoreIt = contentFromInput({ ...newDraft("Job"), delivered: pasted }).delivered;
        expect(asTheServiceWouldStoreIt).toBe("Work.\n\nThe tricky part: typed by hand, pasted with Windows line endings");
        expect(present(asTheServiceWouldStoreIt, "challenge")).toBe(true);
        expect(canAdd(asTheServiceWouldStoreIt, "challenge", "another")).toBe("present");
    });

    it("other control characters, NUL and a lone surrogate pass through Add untouched; whether they can be saved is the existing rule's answer, recorded here", () => {
        const withText = (delivered: string) => contentProblem({ ...newDraft("Job"), delivered });
        expect(withText(add("Work.", "challenge", "bell\u0007"))).toBe("delivered");
        expect(withText(add("Work.", "challenge", "del\u007f"))).toBe("delivered");
        expect(withText(add("Work.", "challenge", "tab\tand\nline break"))).toBeNull();
        // The application's existing rule lets NUL and a lone surrogate through. What the database then does with
        // them is the existing contract's business; it is not tested here, not changed here, and not relied on by Add.
        expect(withText(add("Work.", "challenge", "nul\u0000"))).toBeNull();
        expect(withText(add("Work.", "challenge", "lone\ud83d"))).toBeNull();
    });
});

describe("room and canAdd", () => {
    it("room is the limit less the text, the blank line if there is text, and the fixed words", () => {
        expect(room("", "challenge")).toBe(4983);
        expect(room("", "response")).toBe(4978);
        expect(room("", "lesson")).toBe(4972);
        expect(room("x".repeat(100), "challenge")).toBe(4881);
        expect(room("x".repeat(4981), "challenge")).toBe(0);
        expect(room("x".repeat(MAX), "challenge")).toBe(-19);
        expect(room("😀".repeat(100), "challenge")).toBe(4881);
    });

    it.each([
        ["", "challenge", 4983], ["x".repeat(100), "challenge", 4881], ["The tricky part: a", "response", 5000 - 18 - 2 - 22], ["x".repeat(4000), "lesson", 5000 - 4000 - 2 - 28],
    ] as Array<[string, DepthKey, number]>)("a note of exactly the room fits and fills the text; one more does not", (text, key, expected) => {
        expect(room(text, key)).toBe(expected);
        const fits = "n".repeat(expected);
        expect(canAdd(text, key, fits)).toBe("ok");
        expect(chars(add(text, key, fits))).toBe(MAX);
        expect(contentProblem({ ...newDraft("Job"), delivered: add(text, key, fits) })).toBeNull();
        expect(canAdd(text, key, `${fits}n`)).toBe("no-room");
        expect(chars(add(text, key, `${fits}n`))).toBe(MAX + 1);
    });

    it("a text with no room at all refuses any real note, and a full text is simply left alone", () => {
        expect(canAdd("x".repeat(4981), "challenge", "n")).toBe("no-room");
        expect(canAdd("x".repeat(MAX), "lesson", "n")).toBe("no-room");
        expect(canAdd("x".repeat(MAX), "lesson", "")).toBe("nothing");
    });

    it("the reasons come in a fixed order: nothing to add, already there, nothing to follow, no room", () => {
        const full = "x".repeat(MAX);
        const cases: Array<[string, DepthKey, string, AddStatus]> = [
            ["Work.", "challenge", "", "nothing"],
            ["Work.", "challenge", "   ", "nothing"],
            ["Work.", "challenge", "\n\t \u00a0", "nothing"],
            ["Work.\n\nThe tricky part: a", "challenge", "   ", "nothing"],
            [`${full}`, "challenge", "  ", "nothing"],
            ["Work.\n\nThe tricky part: a", "challenge", "b", "present"],
            [`The tricky part: a${"x".repeat(MAX)}`, "challenge", "b", "present"],
            ["Work.", "response", "b", "not-offered"],
            [full, "response", "b", "not-offered"],
            ["Work.\n\nThe tricky part: a", "response", "b", "ok"],
            ["Work.\n\nWhat we did about it: a", "response", "b", "present"],
            ["Work.", "lesson", "b", "ok"],
            [full, "lesson", "b", "no-room"],
        ];
        for (const [text, key, note, expected] of cases) expect(canAdd(text, key, note), JSON.stringify([text.slice(0, 30), key, note])).toBe(expected);
    });

    it("for every generated text and note: a defined answer; 'ok' exactly when no earlier reason applies and it fits; and 'ok' always yields a text within the limit", () => {
        const random = seeded(99);
        const seen = new Set<AddStatus>();
        for (let round = 0; round < 6000; round += 1) {
            const key = random.pick(DEPTH_KEYS);
            const text = round % 7 === 0 ? "x".repeat(4950 + random.int(60)) : randomText(random);
            const note = randomText(random, 4);
            const status = canAdd(text, key, note);
            seen.add(status);
            const earlier = !hasRealText(note) || present(text, key) || (key === "response" && !present(text, "challenge"));
            // Room decides only when nothing earlier does. It is not claimed to decide every answer.
            if (!earlier) expect(status).toBe(chars(note) <= room(text, key) ? "ok" : "no-room");
            else expect(["nothing", "present", "not-offered"]).toContain(status);
            if (status === "ok") {
                expect(chars(add(text, key, note))).toBeLessThanOrEqual(MAX);
                expect(hasRealText(note)).toBe(true);
            }
            if (status === "nothing") expect(hasRealText(note)).toBe(false);
        }
        expect([...seen].sort()).toEqual(["no-room", "not-offered", "nothing", "ok", "present"]);
    });

    it("a second Add for the same question is never 'ok': the first one made its paragraph present", () => {
        const random = seeded(5);
        for (let round = 0; round < 3000; round += 1) {
            const key = random.pick(DEPTH_KEYS);
            const text = randomText(random);
            const note = `real ${randomText(random, 3)}`;
            if (canAdd(text, key, note) !== "ok") continue;
            expect(canAdd(add(text, key, note), key, "again")).toBe("present");
        }
    });
});

describe("notes", () => {
    it("a note is there when it is not exactly empty: spaces are typing too", () => {
        expect(noteThere("")).toBe(false);
        expect(noteThere(" ")).toBe(true);
        expect(noteThere("\n")).toBe(true);
        expect(anyNote(none)).toBe(false);
        expect(anyNote({ ...none, lesson: " " })).toBe(true);
        expect(notesWith({ challenge: "a", response: "", lesson: " " })).toEqual(["challenge", "lesson"]);
        expect(sameNotes(none, { ...none })).toBe(true);
        expect(sameNotes(none, { ...none, response: " " })).toBe(false);
    });

    it("the second question comes into the order only when there is a tricky-part paragraph, or something already typed for it", () => {
        expect(depthAfter("Work.", none, "challenge")).toBe("lesson");
        expect(depthAfter("Work.\n\nThe tricky part: a", none, "challenge")).toBe("response");
        expect(depthAfter("Work.", { ...none, response: "typed" }, "challenge")).toBe("response");
        expect(depthAfter("Work.", none, "response")).toBe("lesson");
        expect(depthAfter("Work.", none, "lesson")).toBeNull();
        expect(depthBefore("Work.", none, "lesson")).toBe("challenge");
        expect(depthBefore("Work.\n\nThe tricky part: a", none, "lesson")).toBe("response");
        expect(depthBefore("Work.", none, "response")).toBe("challenge");
        expect(depthBefore("Work.", none, "challenge")).toBeNull();
    });
});
