import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { legacyCaseStudiesStoredFingerprint } from "@/lib/server/legacy-case-studies-fingerprint";
import { saveCaseStudiesAction } from "./actions";
import { SAVE_MESSAGES, initialSaveState, isDirty, needsLeaveWarning, nothingToSave, requestOf, sameData, saveReducer, statusLine, type SaveAction, type SaveCaseStudiesResult, type SaveState } from "./save-state";

/**
 * The editor's rules, driven as the screen drives them: it asks the rules to
 * start a save, sends ONLY the copy the rules recorded, once per save, and
 * hands the answer back. The save is the real action over a stand-in table.
 */
type Entry = Record<string, unknown>;
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let table: Map<string, { case_studies: unknown }>;
let writes: unknown[];
/** What the next write does: answer normally, or one of the failures. */
let mode: "ok" | "no-row" | "write-then-error" | "error-no-write" | "throw";
let signedIn: boolean;

type TableFilter = [string, unknown, "eq" | "is" | undefined];
const rowMatches = (id: string, row: { case_studies: unknown }, filters: TableFilter[]) =>
    filters.every(([column, value, kind]) => {
        if (column === "id") return id === value;
        if (column === "case_studies") {
            if (kind === "is") return (row.case_studies === null || row.case_studies === undefined) && value === null;
            return typeof value === "string"
                && legacyCaseStudiesStoredFingerprint(row.case_studies) === legacyCaseStudiesStoredFingerprint(JSON.parse(value));
        }
        return false;
    });

const client = {
    from() {
        const filters: TableFilter[] = [];
        let selected: string | null = null;
        let payload: { case_studies: unknown } | null = null;
        let op: "select" | "update" = "select";
        let id: string | null = null;

        const run = async () => {
            const now = op === "update" ? mode : "ok";
            if (op === "update") mode = "ok";
            if (op === "select") {
                if (now === "throw") throw new Error("raw transport text");
                const row = table.get(ME);
                return { data: row ? { case_studies: structuredClone(row.case_studies) } : null, error: null };
            }
            if (now === "throw") throw new Error("raw transport text");
            const row = now === "no-row" ? undefined : table.get(String(id));
            if (!row || !rowMatches(String(id), row, filters)) return { data: [], error: null };
            if (now === "error-no-write") return { data: null, error: { code: "08006", message: "raw" } };
            writes.push(structuredClone(payload!.case_studies));
            row.case_studies = structuredClone(payload!.case_studies);
            if (now === "write-then-error") return { data: null, error: { code: "57014", message: "raw" } };
            return { data: [{ id, case_studies: structuredClone(row.case_studies) }], error: null };
        };

        return {
            select(_columns: string) {
                op = "select";
                const query = {
                    eq(column: string, value: unknown) {
                        if (column === "id") id = String(value);
                        filters.push([column, value, "eq"]);
                        return query;
                    },
                    maybeSingle() { return run(); },
                };
                return query;
            },
            update(nextPayload: { case_studies: unknown }) {
                op = "update";
                payload = nextPayload;
                const query = {
                    eq(column: string, value: unknown) {
                        if (column === "id") id = String(value);
                        filters.push([column, value, "eq"]);
                        return query;
                    },
                    is(column: string, value: unknown) { filters.push([column, value, "is"]); return query; },
                    select(columns: string) { selected = columns; return query; },
                    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return run().then(resolve, reject); },
                };
                return query;
            },
        };
    },
};

const study = (id: string, projectName: string, extra: Entry = {}): Entry => ({ id, projectName, projectType: "", contractValue: "", programmeDuration: "", client: "", location: "", whatWeDelivered: "", valueAdded: "", photos: ["", "", ""], ...extra });
const stored = () => table.get(ME)?.case_studies as Entry[] | null | undefined;
const names = (list: Entry[] | null | undefined) => (list ?? []).map((entry) => entry.projectName);
/** What the page hands the editor: the stored list, or an empty one when there is none (page.tsx). */
const loaded = () => structuredClone((table.get(ME)?.case_studies as Entry[] | null | undefined) || []);

const storedFingerprint = () => legacyCaseStudiesStoredFingerprint(table.get(ME)?.case_studies);

function editor(initial: Entry[] = loaded()) {
    let state: SaveState<Entry> = initialSaveState(initial, storedFingerprint());
    const requests: Entry[][] = [];
    let sentToken = 0;
    const d = (action: SaveAction<Entry>) => { state = saveReducer(state, action); };
    /** What the screen's effect does after every render: sends the running save if it has not sent it yet. */
    const flush = () => {
        const request = requestOf(state);
        if (!request || sentToken === request.token) return null;
        sentToken = request.token;
        requests.push(structuredClone(request.sent));
        const reply: Promise<SaveCaseStudiesResult> = saveCaseStudiesAction(request.sent, request.expectedFingerprint, request.unconfirmed).catch(() => ({ status: "unknown" as const, message: SAVE_MESSAGES.unknown }));
        return async () => { const result = await reply; d({ type: "save/reply", token: request.token, result }); return result; };
    };
    return {
        get state() { return state; },
        requests,
        d,
        flush,
        edit: (change: (draft: Entry[]) => Entry[]) => d({ type: "edit", change }),
        set: (index: number, patch: Entry) => d({ type: "edit", change: (draft) => draft.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)) }),
        add: (entry: Entry) => d({ type: "edit", change: (draft) => [...draft, entry] }),
        remove: (index: number) => d({ type: "edit", change: (draft) => draft.filter((_, at) => at !== index) }),
        /** Press save; returns a function that delivers the reply, or null if nothing was sent. */
        begin() { d({ type: "save/start" }); return flush(); },
        async save() { const finish = this.begin(); return finish ? finish() : null; },
    };
}

beforeEach(() => {
    table = new Map([[ME, { case_studies: [study("s1", "Kitchen refit")] }]]);
    writes = [];
    mode = "ok";
    signedIn = true;
    for (const mock of [mocks.requireAuth, mocks.createAdminClient, mocks.revalidatePath]) mock.mockReset();
    mocks.requireAuth.mockImplementation(async () => { if (!signedIn) throw new Error("Unauthorized"); return { user: { id: ME }, supabase: client }; });
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("nothing changed: nothing is sent", () => {
    it("an untouched list, pressed any number of times", async () => {
        const tab = editor();
        for (let press = 0; press < 3; press += 1) expect(await tab.save()).toBeNull();
        expect(tab.requests).toEqual([]);
        expect(writes).toEqual([]);
        expect(tab.state.notice).toEqual({ kind: "nothing-to-save", message: SAVE_MESSAGES.nothingToSave });
        expect(needsLeaveWarning(tab.state)).toBe(false);
    });

    it.each([["nothing stored yet (null)", null], ["an empty list", []]])("%s stays exactly as it is when the editor is saved untouched", async (_name, value) => {
        table.set(ME, { case_studies: value });
        const tab = editor();
        expect(tab.state.draft).toEqual([]);
        expect(await tab.save()).toBeNull();
        expect(writes).toEqual([]);
        expect(stored()).toEqual(value);
    });

    it("no profile row: an untouched editor sends nothing", async () => {
        table.clear();
        const tab = editor();
        expect(await tab.save()).toBeNull();
        expect(writes).toEqual([]);
    });

    it("added and then removed again: back to what is saved, so nothing is sent", async () => {
        const tab = editor();
        tab.add(study("s2", "Loft"));
        expect(isDirty(tab.state)).toBe(true);
        tab.remove(1);
        expect(isDirty(tab.state)).toBe(false);
        expect(await tab.save()).toBeNull();
        expect(writes).toEqual([]);
    });

    it("a real change is sent whole: add, edit, remove, and a deliberate clear", async () => {
        const tab = editor();
        tab.add(study("s2", "Loft"));
        expect((await tab.save())!.status).toBe("saved");
        tab.set(0, { location: "Leeds" });
        await tab.save();
        tab.remove(0);
        await tab.save();
        expect(names(stored())).toEqual(["Loft"]);
        tab.remove(0);
        expect((await tab.save())!.status).toBe("saved");
        expect(stored()).toEqual([]);
        expect(tab.requests.map((sent) => sent.length)).toEqual([2, 2, 1, 0]);
    });
});

describe("an acknowledged save confirms what was SENT, not what is on the screen", () => {
    it("what is typed while the save runs is kept, and is unsaved afterwards", async () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        const finish = tab.begin()!;
        tab.set(0, { location: "Leeds, then typed during the save" });
        tab.add(study("s2", "Added during the save"));
        const during = structuredClone(tab.state.draft);
        expect((await finish()).status).toBe("saved");

        expect(tab.state.draft, "the screen is untouched by the reply").toEqual(during);
        expect(tab.state.saved, "the baseline is the copy that was sent").toEqual([study("s1", "Kitchen refit", { location: "Leeds" })]);
        expect(stored()).toEqual([study("s1", "Kitchen refit", { location: "Leeds" })]);
        expect(isDirty(tab.state)).toBe(true);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.unsaved);
        expect(needsLeaveWarning(tab.state)).toBe(true);
        // A second, deliberate save sends the rest.
        expect((await tab.save())!.status).toBe("saved");
        expect(stored()).toEqual(during);
        expect(isDirty(tab.state)).toBe(false);
        expect(tab.requests).toHaveLength(2);
    });

    it("what was sent is a copy: nothing done to the screen afterwards can change it, or the acknowledged baseline", async () => {
        const tab = editor();
        tab.set(0, { photos: ["https://images.example.test/a.jpg", "", ""] });
        const finish = tab.begin()!;
        const sent = requestOf(tab.state)!.sent;
        // A change made in place, as a careless edit might.
        (tab.state.draft[0].photos as string[])[0] = "changed in place after sending";
        expect((sent[0].photos as string[])[0]).toBe("https://images.example.test/a.jpg");
        await finish();
        expect((tab.state.saved[0].photos as string[])[0]).toBe("https://images.example.test/a.jpg");
        expect(((stored() as Entry[])[0].photos as string[])[0]).toBe("https://images.example.test/a.jpg");
    });

    it("the baseline the editor starts from shares nothing with what the page handed it", () => {
        const fromPage = [study("s1", "Kitchen refit")];
        const tab = editor(fromPage);
        fromPage[0].projectName = "changed by the caller afterwards";
        expect(tab.state.saved[0].projectName).toBe("Kitchen refit");
        expect(tab.state.draft[0].projectName).toBe("Kitchen refit");
    });
});

describe("one save at a time, sent once", () => {
    it("pressing save again and again while one runs sends one request", async () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        const finish = tab.begin()!;
        for (let press = 0; press < 5; press += 1) expect(tab.begin()).toBeNull();
        // The screen's effect runs after every render; it must not send the same save twice.
        for (let render = 0; render < 5; render += 1) expect(tab.flush()).toBeNull();
        await finish();
        expect(tab.requests).toHaveLength(1);
        expect(writes).toHaveLength(1);
    });

    it("a reply that is not from the save now running changes nothing", async () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        const before = tab.state;
        tab.d({ type: "save/reply", token: 7, result: { status: "saved", refreshed: true, fingerprint: storedFingerprint() } });
        expect(tab.state).toBe(before);
        const finish = tab.begin()!;
        const during = tab.state;
        tab.d({ type: "save/reply", token: 99, result: { status: "saved", refreshed: true, fingerprint: storedFingerprint() } });
        tab.d({ type: "save/reply", token: 0, result: { status: "unknown", message: "x" } });
        expect(tab.state).toBe(during);
        await finish();
        // And an old reply arriving after the real one changes nothing either.
        const after = tab.state;
        tab.d({ type: "save/reply", token: 1, result: { status: "unknown", message: "x" } });
        expect(tab.state).toBe(after);
        expect(tab.state.uncertain).toBe(false);
    });
});

describe("a save that is not confirmed keeps everything", () => {
    it.each([
        ["signed out", () => { signedIn = false; }, "signed-out", SAVE_MESSAGES.signedOut, 0],
        ["no row came back", () => { mode = "no-row"; }, "no-row", SAVE_MESSAGES.noRow, 0],
    ] as Array<[string, () => void, string, string, number]>)("%s: the typed list and the saved baseline are both as they were, and nothing is called saved", async (_name, arrange, status, message, sent) => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        tab.add(study("s2", "Loft"));
        const typed = structuredClone(tab.state.draft);
        arrange();
        const finish = tab.begin()!;
        tab.set(1, { location: "typed while it was failing" });
        const result = await finish();
        expect(result).toEqual({ status, message });
        expect(tab.state.draft).toEqual(typed.map((entry, index) => (index === 1 ? { ...entry, location: "typed while it was failing" } : entry)));
        expect(tab.state.saved).toEqual([study("s1", "Kitchen refit")]);
        expect(tab.state.notice).toEqual({ kind: "failed", message });
        expect(tab.state.uncertain).toBe(false);
        expect(isDirty(tab.state)).toBe(true);
        expect(needsLeaveWarning(tab.state)).toBe(true);
        expect(statusLine(tab.state)).toBe(message);
        expect(writes).toHaveLength(sent);
        expect(names(stored())).toEqual(["Kitchen refit"]);
        // Nothing was sent again by itself.
        expect(tab.flush()).toBeNull();
        expect(tab.requests).toHaveLength(1);
    });

    it("a list that is not a list never leaves the editor as one, but the action's refusal is handled the same way", () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        tab.d({ type: "save/start" });
        tab.d({ type: "save/reply", token: 1, result: { status: "refused", message: SAVE_MESSAGES.refused } });
        expect(tab.state.notice).toEqual({ kind: "failed", message: SAVE_MESSAGES.refused });
        expect(tab.state.draft[0].location).toBe("Leeds");
        expect(tab.state.saved[0].location).toBe("");
    });
});

describe("not known whether it was saved", () => {
    const modes: Array<[string, "write-then-error" | "error-no-write" | "throw", boolean]> = [
        ["the write landed and an error came back", "write-then-error", true],
        ["an error came back and nothing was written", "error-no-write", false],
        ["the call threw", "throw", false],
    ];

    it.each(modes)("%s: uncertain, nothing cleared, the baseline NOT moved, and leaving still warns", async (_name, failure, landed) => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        mode = failure;
        const result = await tab.save();
        expect(result).toEqual({ status: "unknown", message: SAVE_MESSAGES.unknown });
        expect(tab.state.uncertain).toBe(true);
        expect(tab.state.draft[0].location).toBe("Leeds");
        expect(tab.state.saved[0].location, "an unconfirmed save never becomes the baseline").toBe("");
        expect(((stored() as Entry[])[0]).location).toBe(landed ? "Leeds" : "");
        expect(needsLeaveWarning(tab.state)).toBe(true);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.unknown);
        // The editor cannot tell these three apart, and does not pretend to.
        expect(tab.state.notice).toEqual({ kind: "unknown", message: SAVE_MESSAGES.unknown });
    });

    it.each(modes)("%s, then the old value typed back in: STILL uncertain. Matching the old list does not make storage known", async (_name, failure, landed) => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        mode = failure;
        await tab.save();
        tab.set(0, { location: "" });

        expect(isDirty(tab.state), "the screen equals the old baseline again").toBe(false);
        expect(tab.state.uncertain).toBe(true);
        expect(nothingToSave(tab.state), "so this is NOT a no-op").toBe(false);
        expect(needsLeaveWarning(tab.state)).toBe(true);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.unknown);
        // What is actually stored may be the list that was sent, which is not what is on the screen.
        expect(((stored() as Entry[])[0]).location).toBe(landed ? "Leeds" : "");

        // Whichever of the two is stored, it is this tab's own: the list it loaded, or the list it sent. Neither is a conflict.
        expect(tab.state.unconfirmed).toEqual([[study("s1", "Kitchen refit", { location: "Leeds" })]]);
        const result = await tab.save();
        expect(result).toMatchObject({ status: "saved", refreshed: true });
        expect(tab.state.uncertain).toBe(false);
        expect(tab.state.unconfirmed).toEqual([]);
        expect(((stored() as Entry[])[0]).location).toBe("");
        expect(tab.state.saved).toEqual(tab.state.draft);
        expect(needsLeaveWarning(tab.state)).toBe(false);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.saved);
        expect(tab.requests).toHaveLength(2);
    });

    it("the lists sent without an answer are each kept once, through saves that write nothing, until a save is acknowledged", async () => {
        const tab = editor();
        const leeds = [study("s1", "Kitchen refit", { location: "Leeds" })];
        const york = [study("s1", "Kitchen refit", { location: "York" })];
        tab.set(0, { location: "Leeds" });
        mode = "error-no-write";
        await tab.save();
        mode = "throw";
        await tab.save();
        expect(tab.state.unconfirmed, "the same list sent twice is named once").toEqual([leeds]);
        tab.set(0, { location: "York" });
        mode = "write-then-error";
        await tab.save();
        expect(tab.state.unconfirmed).toEqual([leeds, york]);
        mode = "no-row";
        await tab.save();
        signedIn = false;
        await tab.save();
        expect(tab.state.unconfirmed).toEqual([leeds, york]);
        // Typing afterwards cannot alter what was sent.
        tab.set(0, { location: "Hull" });
        expect(tab.state.unconfirmed).toEqual([leeds, york]);
        signedIn = true;
        expect((await tab.save())!.status, "York was stored, by this tab").toBe("saved");
        expect(tab.state.unconfirmed).toEqual([]);
        expect(((stored() as Entry[])[0]).location).toBe("Hull");
    });

    it("uncertainty outlasts typing, a failed save and a signed-out save; only an acknowledged save ends it", async () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        mode = "error-no-write";
        await tab.save();
        tab.set(0, { valueAdded: "more typing" });
        tab.set(0, { valueAdded: "" });
        expect(tab.state.uncertain).toBe(true);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.unknown);

        mode = "no-row";
        expect((await tab.save())!.status).toBe("no-row");
        expect(tab.state.uncertain).toBe(true);
        signedIn = false;
        expect((await tab.save())!.status).toBe("signed-out");
        expect(tab.state.uncertain).toBe(true);
        // With the failure message gone, the line still says the last save is not known.
        tab.d({ type: "edit", change: (draft) => draft });
        expect(needsLeaveWarning(tab.state)).toBe(true);

        signedIn = true;
        expect((await tab.save())!.status).toBe("saved");
        expect(tab.state.uncertain).toBe(false);
    });

    it("the standing line names the uncertainty once the failure message has been replaced", () => {
        let state: SaveState<Entry> = { ...initialSaveState([study("s1", "Kitchen refit")], storedFingerprint()), uncertain: true };
        expect(statusLine(state)).toBe(SAVE_MESSAGES.uncertain);
        state = saveReducer(state, { type: "edit", change: (draft) => draft.map((entry) => ({ ...entry, location: "Leeds" })) });
        expect(statusLine(state)).toBe(SAVE_MESSAGES.uncertain);
        expect(SAVE_MESSAGES.uncertain).toContain("don't know");
    });

    it("nothing is sent again without a press", async () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        mode = "throw";
        await tab.save();
        for (let render = 0; render < 5; render += 1) expect(tab.flush()).toBeNull();
        tab.set(0, { location: "Leeds 6" });
        expect(tab.flush()).toBeNull();
        expect(tab.requests).toHaveLength(1);
    });
});

describe("saved, but other pages could not be told to reload", () => {
    it("is still saved: the baseline moves to what was sent, and the line says what the limit is", async () => {
        mocks.revalidatePath.mockImplementation(() => { throw new Error("raw framework text"); });
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        expect(await tab.save()).toMatchObject({ status: "saved", refreshed: false });
        expect(tab.state.saved[0].location).toBe("Leeds");
        expect(tab.state.uncertain).toBe(false);
        expect(isDirty(tab.state)).toBe(false);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.savedNotRefreshed);
        expect(((stored() as Entry[])[0]).location).toBe("Leeds");
    });
});

describe("comparing two lists", () => {
    it("ignores the order of keys, respects the order of entries, and changes neither", () => {
        const a = [{ id: "1", projectName: "A", photos: ["x", ""], extra: { p: 1, q: [1, 2] } }, { id: "2" }];
        const b = [{ extra: { q: [1, 2], p: 1 }, photos: ["x", ""], projectName: "A", id: "1" }, { id: "2" }];
        const before = JSON.stringify([a, b]);
        expect(sameData(a, b)).toBe(true);
        expect(sameData(a, [b[1], b[0]])).toBe(false);
        expect(JSON.stringify([a, b])).toBe(before);
    });

    it.each([
        ["a changed value", [{ a: "x" }], [{ a: "y" }]],
        ["a space at the end", [{ a: "x" }], [{ a: "x " }]],
        ["a number and its string", [{ a: 1 }], [{ a: "1" }]],
        ["null and an empty string", [{ a: null }], [{ a: "" }]],
        ["null and an empty object", [null], [{}]],
        ["a list and an object", [[]], [{}]],
        ["an extra key", [{ a: 1 }], [{ a: 1, b: 2 }]],
        ["an extra entry", [{ a: 1 }], [{ a: 1 }, { a: 1 }]],
        ["a longer inner list", [{ p: ["", ""] }], [{ p: ["", "", ""] }]],
    ])("%s is a difference", (_name, a, b) => {
        expect(sameData(a, b)).toBe(false);
        expect(sameData(b, a)).toBe(false);
    });

    it("a key that is absent and a key set to undefined are the same, as they are once sent", () => {
        expect(sameData([{ a: 1 }], [{ a: 1, b: undefined }])).toBe(true);
    });
});

describe("concurrent tabs: stale saves are refused", () => {
    it("tab A adds and saves; stale tab B is refused and storage keeps A's list", async () => {
        const a = editor();
        const b = editor();
        a.add(study("s2", "Loft, added in tab A"));
        expect((await a.save())!.status).toBe("saved");
        expect(names(stored())).toEqual(["Kitchen refit", "Loft, added in tab A"]);

        b.set(0, { location: "typed in stale tab B" });
        const result = await b.save();
        expect(result!.status).toBe("conflict");
        expect(names(stored())).toEqual(["Kitchen refit", "Loft, added in tab A"]);
        expect(statusLine(b.state)).toBe(SAVE_MESSAGES.conflict);
    });

    it("a tab that loaded an empty list cannot erase a list saved elsewhere", async () => {
        table.set(ME, { case_studies: [] });
        const stale = editor();
        const other = editor();
        other.add(study("s1", "Saved by the other tab"));
        await other.save();
        stale.add(study("s9", "Added in the stale tab"));
        expect((await stale.save())!.status).toBe("conflict");
        expect(names(stored())).toEqual(["Saved by the other tab"]);
    });

    it.each([
        ["the write landed and an error came back", "write-then-error"],
        ["an error came back and nothing was written", "error-no-write"],
    ] as const)("a save that was never answered (%s) does not excuse a stale tab: another tab's later save is still a conflict", async (_name, failure) => {
        const stale = editor();
        stale.set(0, { location: "Leeds" });
        mode = failure;
        expect((await stale.save())!.status).toBe("unknown");

        const other = editor();
        other.add(study("s2", "Loft, added in the other tab"));
        expect((await other.save())!.status).toBe("saved");
        const kept = structuredClone(stored());

        expect((await stale.save())!.status).toBe("conflict");
        expect(stored()).toEqual(kept);
        expect(stale.state.uncertain, "and its own last save is still not known").toBe(true);
        expect(statusLine(stale.state)).toBe(SAVE_MESSAGES.conflict);
        // After that conflict, a fresh tab saves as usual.
        const fresh = editor();
        fresh.set(0, { location: "York" });
        expect((await fresh.save())!.status).toBe("saved");
    });

    it("the conflict message tells the contractor to reload", () => {
        expect(SAVE_MESSAGES.conflict).toMatch(/Another tab or window/i);
    });
});
