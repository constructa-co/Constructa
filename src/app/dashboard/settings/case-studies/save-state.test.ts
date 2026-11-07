import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

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

const client = {
    from() {
        return {
            update(payload: { case_studies: unknown }) {
                let id: unknown = null;
                const run = async () => {
                    writes.push(structuredClone(payload.case_studies));
                    const now = mode;
                    mode = "ok";
                    if (now === "throw") throw new Error("raw transport text");
                    if (now === "error-no-write") return { data: null, error: { code: "08006", message: "raw" } };
                    const row = now === "no-row" ? undefined : table.get(String(id));
                    if (row) row.case_studies = structuredClone(payload.case_studies);
                    if (now === "write-then-error") return { data: null, error: { code: "57014", message: "raw" } };
                    return { data: row ? [{ id }] : [], error: null };
                };
                const query = {
                    eq(_column: string, value: unknown) { id = value; return query; },
                    select() { return query; },
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

function editor(initial: Entry[] = loaded()) {
    let state: SaveState<Entry> = initialSaveState(initial);
    const requests: Entry[][] = [];
    let sentToken = 0;
    const d = (action: SaveAction<Entry>) => { state = saveReducer(state, action); };
    /** What the screen's effect does after every render: sends the running save if it has not sent it yet. */
    const flush = () => {
        const request = requestOf(state);
        if (!request || sentToken === request.token) return null;
        sentToken = request.token;
        requests.push(structuredClone(request.sent));
        const reply: Promise<SaveCaseStudiesResult> = saveCaseStudiesAction(request.sent).catch(() => ({ status: "unknown" as const, message: SAVE_MESSAGES.unknown }));
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
        tab.d({ type: "save/reply", token: 7, result: { status: "saved", refreshed: true } });
        expect(tab.state).toBe(before);
        const finish = tab.begin()!;
        const during = tab.state;
        tab.d({ type: "save/reply", token: 99, result: { status: "saved", refreshed: true } });
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
        ["no row came back", () => { mode = "no-row"; }, "no-row", SAVE_MESSAGES.noRow, 1],
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

        // An explicit save is sent, although nothing differs from the old baseline, and its acknowledgement ends the uncertainty.
        const result = await tab.save();
        expect(result).toEqual({ status: "saved", refreshed: true });
        expect(tab.requests).toHaveLength(2);
        expect(tab.state.uncertain).toBe(false);
        expect(((stored() as Entry[])[0]).location).toBe("");
        expect(tab.state.saved).toEqual(tab.state.draft);
        expect(needsLeaveWarning(tab.state)).toBe(false);
        expect(statusLine(tab.state)).toBe(SAVE_MESSAGES.saved);
    });

    it("uncertainty outlasts typing, a failed save and a signed-out save; only an acknowledged save ends it", async () => {
        const tab = editor();
        tab.set(0, { location: "Leeds" });
        mode = "write-then-error";
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
        let state: SaveState<Entry> = { ...initialSaveState([study("s1", "Kitchen refit")]), uncertain: true };
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
        expect(await tab.save()).toEqual({ status: "saved", refreshed: false });
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

/**
 * STILL OPEN. These tests record a fault that this change does NOT fix.
 *
 * Saving replaces the whole stored list with no condition on what it was. Two
 * tabs that loaded the same list overwrite each other, and the second save is
 * a genuine write that is genuinely acknowledged. Nothing detects, refuses,
 * merges or warns. Closing this needs a condition inside the write itself.
 *
 * If one of these ever fails, the residual has changed and the test must be
 * rewritten on purpose. They are not protection and must not be read as it.
 */
describe("STILL OPEN: two tabs overwrite each other, and the overwrite is acknowledged as saved", () => {
    it("STILL OPEN: tab A adds and saves; stale tab B saves; A's addition is gone and B is told 'saved'", async () => {
        const a = editor();
        const b = editor();
        a.add(study("s2", "Loft, added in tab A"));
        expect((await a.save())!.status).toBe("saved");
        expect(names(stored())).toEqual(["Kitchen refit", "Loft, added in tab A"]);

        b.set(0, { location: "typed in stale tab B" });
        const result = await b.save();
        expect(result, "a real write, really acknowledged").toEqual({ status: "saved", refreshed: true });
        expect(names(stored()), "tab A's addition has been overwritten").toEqual(["Kitchen refit"]);
        expect(b.state.uncertain).toBe(false);
        expect(statusLine(b.state)).toBe(SAVE_MESSAGES.saved);
        // Tab A is not told. It still believes its own list is the saved one.
        expect(isDirty(a.state)).toBe(false);
        expect(names(a.state.saved)).toEqual(["Kitchen refit", "Loft, added in tab A"]);
    });

    it("STILL OPEN: both edit the same entry; the first tab's field is lost", async () => {
        const a = editor();
        const b = editor();
        a.set(0, { whatWeDelivered: "Tab A wrote this." });
        await a.save();
        b.set(0, { valueAdded: "Tab B wrote this." });
        expect((await b.save())!.status).toBe("saved");
        expect((stored() as Entry[])[0]).toMatchObject({ whatWeDelivered: "", valueAdded: "Tab B wrote this." });
    });

    it("STILL OPEN: an entry removed in one tab comes back when a stale tab saves", async () => {
        table.set(ME, { case_studies: [study("s1", "Kitchen refit"), study("s2", "Loft"), study("s3", "Shop")] });
        const a = editor();
        const b = editor();
        a.remove(0);
        await a.save();
        expect(names(stored())).toEqual(["Loft", "Shop"]);
        b.set(2, { location: "typed in stale tab B" });
        expect((await b.save())!.status).toBe("saved");
        expect(names(stored())).toEqual(["Kitchen refit", "Loft", "Shop"]);
    });

    it("STILL OPEN: a tab opened on an empty list erases what another tab saved since, once it adds anything", async () => {
        table.set(ME, { case_studies: [] });
        const stale = editor();
        const other = editor();
        other.add(study("s1", "Saved by the other tab"));
        await other.save();
        stale.add(study("s9", "Added in the stale tab"));
        expect((await stale.save())!.status).toBe("saved");
        expect(names(stored())).toEqual(["Added in the stale tab"]);
    });

    it("STILL OPEN: trying again after an unconfirmed save replaces whatever another tab stored meanwhile", async () => {
        const a = editor();
        const b = editor();
        a.set(0, { location: "Leeds" });
        mode = "throw";
        expect((await a.save())!.status).toBe("unknown");
        b.add(study("s2", "Saved by tab B meanwhile"));
        await b.save();
        expect((await a.save())!.status).toBe("saved");
        expect(names(stored()), "tab B's entry is gone").toEqual(["Kitchen refit"]);
        expect(SAVE_MESSAGES.unknown).toContain("replaces whatever is stored");
    });

    it("no message this editor shows claims otherwise", () => {
        for (const message of Object.values(SAVE_MESSAGES)) expect(message).not.toMatch(/conflict|another (tab|window) (changed|saved)|merged|up to date|latest version|protected/i);
    });
});
