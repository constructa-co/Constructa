import { describe, expect, it, vi } from "vitest";
import {
    AI_UNAVAILABLE_ERROR,
    BRIEF_SAVE_ERROR,
    DESCRIPTION_NEEDED_ERROR,
    SAVE_STATUS_LABEL,
    briefReducer,
    briefSaveStatus,
    buildBriefPayload,
    composeScope,
    continueToPricing,
    draftFromProject,
    initialBriefState,
    isBriefConfirmed,
    isSuggestionStale,
    parseRoughValue,
    pricingPathForProject,
    requestSuggestion,
    saveBrief,
    splitScope,
    suggestionFromRaw,
    suggestionParts,
    type AskAssistant,
    type BriefAction,
    type BriefProjectFields,
    type BriefState,
    type BriefStore,
    type RawBriefSuggestion,
    type SaveBrief,
} from "./guided-brief";

const BLANK_PROJECT: BriefProjectFields = {
    brief_scope: "",
    brief_trade_sections: [],
    client_type: "domestic",
    potential_value: null,
    start_date: "",
    lat: null,
    lng: null,
    region: "",
    brief_completed: false,
};

function makeStore(project: BriefProjectFields = BLANK_PROJECT): BriefStore & { actions: BriefAction[] } {
    let state: BriefState = initialBriefState(project);
    const actions: BriefAction[] = [];
    return {
        actions,
        getState: () => state,
        dispatch: (action) => {
            actions.push(action);
            state = briefReducer(state, action);
        },
    };
}

/** A promise the test resolves by hand, to hold a request "in flight". */
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

const AI_REPLY: RawBriefSuggestion = {
    scope: "Strip out the existing bathroom and fit a new suite with full tiling.",
    clientType: "commercial",
    suggestedTrades: ["Bathroom Installation", "Tiling", "Made Up Trade"],
    estimatedValue: 8500,
    startDate: "2026-11-01",
    response: "Tidied the wording.",
};

const okAsk = (result: RawBriefSuggestion): AskAssistant => async () => ({ ok: true, result });

describe("scope and site notes share one saved field", () => {
    it("round-trips a description with site notes", () => {
        const scope = composeScope("Refit the bathroom.", "Rear access only.");
        expect(scope).toBe("Refit the bathroom.\n\nSite, access and assumptions:\nRear access only.");
        expect(splitScope(scope)).toEqual({ work: "Refit the bathroom.", siteNotes: "Rear access only." });
    });

    it("leaves a description without site notes untouched", () => {
        expect(composeScope("Refit the bathroom.", "  ")).toBe("Refit the bathroom.");
        expect(splitScope("Refit the bathroom.")).toEqual({ work: "Refit the bathroom.", siteNotes: "" });
    });

    it("keeps site notes when there is no description yet", () => {
        const scope = composeScope("", "Parking on street.");
        expect(splitScope(scope)).toEqual({ work: "", siteNotes: "Parking on street." });
    });
});

describe("existing project data is preserved", () => {
    it("builds the draft from what the project already holds", () => {
        const draft = draftFromProject({
            ...BLANK_PROJECT,
            brief_scope: "Rear extension.\n\nSite, access and assumptions:\nSkip on the drive.",
            brief_trade_sections: ["Roofing"],
            client_type: "commercial",
            potential_value: 45000,
            start_date: "2026-12-01",
            lat: 51.5,
            lng: -0.1,
            region: "London",
        });
        expect(draft).toEqual({
            work: "Rear extension.",
            siteNotes: "Skip on the drive.",
            clientType: "commercial",
            trades: ["Roofing"],
            roughValue: "45000",
            startDate: "2026-12-01",
            lat: 51.5,
            lng: -0.1,
            region: "London",
        });
    });

    it("sends a cleared value and date as null, and omits an unknown location", () => {
        const built = buildBriefPayload({ ...draftFromProject(BLANK_PROJECT), work: "Refit." }, true);
        expect(built).toEqual({
            ok: true,
            payload: {
                brief_scope: "Refit.",
                brief_trade_sections: [],
                client_type: "domestic",
                brief_completed: true,
                potential_value: null,
                start_date: null,
            },
        });
    });
});

describe("rough value", () => {
    it("accepts plain figures with pound signs and commas", () => {
        expect(parseRoughValue(" £45,000 ")).toEqual({ ok: true, value: 45000 });
        expect(parseRoughValue("")).toEqual({ ok: true, value: null });
    });

    it("rejects exponent, hex, negative and oversized forms", () => {
        for (const raw of ["1e5", "0x10", "-500", "abc", "1000000000"]) {
            expect(parseRoughValue(raw).ok, raw).toBe(false);
        }
    });
});

describe("AI suggestions stay pending until applied", () => {
    it("does not change the draft when a suggestion arrives", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "rip out bathroom, new suite, tile it, about 8500" } });
        const before = store.getState().draft;

        await requestSuggestion(store, okAsk(AI_REPLY), "req-1");

        const state = store.getState();
        expect(state.draft).toBe(before);
        expect(state.suggestion).not.toBeNull();
        expect(state.ai.status).toBe("idle");
    });

    it("applies only the ticked parts, and only to the draft", () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "rip out bathroom about 8500", trades: ["Roofing"] } });
        const suggestion = suggestionFromRaw(AI_REPLY, {
            id: "req-1", source: "assistant", basedOnWork: "rip out bathroom about 8500", draft: store.getState().draft,
        });
        store.dispatch({ type: "suggestion/received", suggestion });
        store.dispatch({ type: "suggestion/applied", parts: ["work", "trades"] });

        const state = store.getState();
        expect(state.draft.work).toBe(AI_REPLY.scope);
        expect(state.draft.trades).toEqual(["Roofing", "Bathroom Installation", "Tiling"]);
        // Not ticked, so not applied.
        expect(state.draft.clientType).toBe("domestic");
        expect(state.draft.roughValue).toBe("");
        expect(state.draft.startDate).toBe("");
        // Applying changes the draft only: nothing is saved yet.
        expect(state.suggestion).toBeNull();
        expect(state.lastOutcome).toBe("applied");
        expect(state.saved.work).toBe("");
        expect(briefSaveStatus(state)).toBe("unsaved");
    });

    it("Discard leaves the contractor's draft exactly as it was", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "my own words 8500", trades: ["Roofing"], roughValue: "9000" } });
        const before = store.getState().draft;
        await requestSuggestion(store, okAsk(AI_REPLY), "req-1");

        store.dispatch({ type: "suggestion/discarded" });

        expect(store.getState().draft).toBe(before);
        expect(store.getState().suggestion).toBeNull();
        expect(store.getState().lastOutcome).toBe("discarded");
    });

    it("drops trades that are not on the list and trades already picked", () => {
        const draft = { ...draftFromProject(BLANK_PROJECT), trades: ["Tiling"] };
        const suggestion = suggestionFromRaw(AI_REPLY, { id: "r", source: "assistant", basedOnWork: "x", draft });
        expect(suggestion.trades).toEqual(["Bathroom Installation"]);
    });

    it("never offers a price the contractor did not state", () => {
        const draft = draftFromProject(BLANK_PROJECT);
        const noFigure = suggestionFromRaw(AI_REPLY, { id: "r", source: "assistant", basedOnWork: "rip out the bathroom", draft });
        expect(noFigure.roughValue).toBeNull();
        expect(suggestionParts(noFigure)).not.toContain("roughValue");

        const withFigure = suggestionFromRaw(AI_REPLY, { id: "r", source: "assistant", basedOnWork: "bathroom, about 8500", draft });
        expect(withFigure.roughValue).toBe(8500);

        const video = suggestionFromRaw({ ...AI_REPLY, observations: ["Damp on north wall"] }, { id: "r", source: "video", basedOnWork: "8500", draft });
        expect(video.roughValue).toBeNull();
        expect(video.siteNotes).toBe("- Damp on north wall");
    });

    it("ignores malformed AI output rather than applying it", () => {
        const draft = draftFromProject(BLANK_PROJECT);
        const suggestion = suggestionFromRaw(
            { scope: 42, clientType: "alien", suggestedTrades: "Tiling", estimatedValue: "lots", startDate: "next week" },
            { id: "r", source: "assistant", basedOnWork: "bathroom 1", draft },
        );
        expect(suggestionParts(suggestion)).toEqual([]);
    });
});

describe("overlapping and stale AI results", () => {
    it("allows one request at a time", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom" } });
        const first = deferred<Awaited<ReturnType<AskAssistant>>>();
        const ask = vi.fn<AskAssistant>(() => first.promise);

        const running = requestSuggestion(store, ask, "req-1");
        await requestSuggestion(store, ask, "req-2");

        expect(ask).toHaveBeenCalledTimes(1);
        expect(store.getState().ai.requestId).toBe("req-1");
        first.resolve({ ok: true, result: AI_REPLY });
        await running;
    });

    it("drops a reply that arrives after the request was cancelled", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom" } });
        const slow = deferred<Awaited<ReturnType<AskAssistant>>>();

        const running = requestSuggestion(store, () => slow.promise, "req-1");
        store.dispatch({ type: "ai/cancelled" });
        store.dispatch({ type: "draft/edit", patch: { work: "kitchen instead" } });
        slow.resolve({ ok: true, result: AI_REPLY });
        await running;

        expect(store.getState().suggestion).toBeNull();
        expect(store.getState().draft.work).toBe("kitchen instead");
    });

    it("drops a reply to an older request when a newer one is running", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom" } });
        const slow = deferred<Awaited<ReturnType<AskAssistant>>>();
        const fast = deferred<Awaited<ReturnType<AskAssistant>>>();

        const first = requestSuggestion(store, () => slow.promise, "req-1");
        store.dispatch({ type: "ai/cancelled" });
        const second = requestSuggestion(store, () => fast.promise, "req-2");
        slow.resolve({ ok: true, result: { scope: "OLD REPLY" } });
        await first;
        expect(store.getState().suggestion).toBeNull();

        fast.resolve({ ok: true, result: { scope: "New reply." } });
        await second;
        expect(store.getState().suggestion?.work).toBe("New reply.");
    });

    it("will not replace a description edited after the request unless the contractor says so", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom" } });
        const slow = deferred<Awaited<ReturnType<AskAssistant>>>();
        const running = requestSuggestion(store, () => slow.promise, "req-1");

        // The contractor keeps typing while the assistant is working.
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom AND the en-suite" } });
        slow.resolve({ ok: true, result: AI_REPLY });
        await running;

        const pending = store.getState();
        expect(pending.draft.work).toBe("bathroom AND the en-suite");
        expect(isSuggestionStale(pending.suggestion!, pending.draft)).toBe(true);

        store.dispatch({ type: "suggestion/applied", parts: ["work", "trades"] });
        expect(store.getState().draft.work).toBe("bathroom AND the en-suite");
        expect(store.getState().draft.trades).toEqual(["Bathroom Installation", "Tiling"]);
    });

    it("replaces newer wording only with explicit confirmation", () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "newer words" } });
        store.dispatch({
            type: "suggestion/received",
            suggestion: suggestionFromRaw(AI_REPLY, { id: "r", source: "assistant", basedOnWork: "older words", draft: store.getState().draft }),
        });
        store.dispatch({ type: "suggestion/applied", parts: ["work"], replaceNewerWork: true });
        expect(store.getState().draft.work).toBe(AI_REPLY.scope);
    });

    it("does not ask again while a suggestion is waiting", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom" } });
        await requestSuggestion(store, okAsk(AI_REPLY), "req-1");
        const ask = vi.fn<AskAssistant>(okAsk(AI_REPLY));
        await requestSuggestion(store, ask, "req-2");
        expect(ask).not.toHaveBeenCalled();
    });
});

describe("AI unavailable", () => {
    it("reports a plain recovery message and leaves the manual brief usable", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom" } });

        await requestSuggestion(store, async () => { throw new Error("network"); }, "req-1");
        expect(store.getState().ai).toEqual({ status: "failed", requestId: null, error: AI_UNAVAILABLE_ERROR });

        // Typing and saving still work.
        store.dispatch({ type: "draft/edit", patch: { work: "bathroom, written by hand" } });
        const save = vi.fn<SaveBrief>(async () => ({ success: true }));
        expect(await saveBrief(store, save, { confirm: true })).toBe("saved");

        // And the assistant can be tried again.
        await requestSuggestion(store, okAsk(AI_REPLY), "req-2");
        expect(store.getState().suggestion).not.toBeNull();
    });

    it("does nothing when there is no description to work from", async () => {
        const store = makeStore();
        const ask = vi.fn<AskAssistant>(okAsk(AI_REPLY));
        await requestSuggestion(store, ask, "req-1");
        expect(ask).not.toHaveBeenCalled();
    });
});

describe("save states and retry", () => {
    it("moves through Unsaved, Saving and Saved", async () => {
        const store = makeStore();
        expect(briefSaveStatus(store.getState())).toBe("empty");

        store.dispatch({ type: "draft/edit", patch: { work: "Refit the bathroom." } });
        expect(SAVE_STATUS_LABEL[briefSaveStatus(store.getState())]).toBe("Unsaved");

        const pending = deferred<Awaited<ReturnType<SaveBrief>>>();
        const running = saveBrief(store, () => pending.promise, { confirm: false });
        expect(SAVE_STATUS_LABEL[briefSaveStatus(store.getState())]).toBe("Saving");

        pending.resolve({ success: true });
        expect(await running).toBe("saved");
        expect(SAVE_STATUS_LABEL[briefSaveStatus(store.getState())]).toBe("Saved");
    });

    it("keeps every input after a failed save and succeeds on retry", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit the bathroom.", siteNotes: "Rear access.", roughValue: "8500", trades: ["Tiling"] } });
        const typed = store.getState().draft;
        const save = vi.fn<SaveBrief>()
            .mockResolvedValueOnce({ success: false, error: BRIEF_SAVE_ERROR })
            .mockResolvedValueOnce({ success: true });

        expect(await saveBrief(store, save, { confirm: true })).toBe("failed");
        expect(SAVE_STATUS_LABEL[briefSaveStatus(store.getState())]).toBe("Failed - try again");
        expect(store.getState().save.error).toBe(BRIEF_SAVE_ERROR);
        expect(store.getState().draft).toBe(typed);
        expect(isBriefConfirmed(store.getState())).toBe(false);

        expect(await saveBrief(store, save, { confirm: true })).toBe("saved");
        expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
        expect(store.getState().draft).toBe(typed);
        expect(isBriefConfirmed(store.getState())).toBe(true);
    });

    it("treats a thrown save as a failure, not a crash", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit." } });
        expect(await saveBrief(store, async () => { throw new Error("offline"); }, { confirm: false })).toBe("failed");
        expect(store.getState().save.error).toBe(BRIEF_SAVE_ERROR);
        expect(store.getState().draft.work).toBe("Refit.");
    });

    it("does not start a second save while one is running", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit." } });
        const pending = deferred<Awaited<ReturnType<SaveBrief>>>();
        const save = vi.fn<SaveBrief>(() => pending.promise);

        const running = saveBrief(store, save, { confirm: false });
        expect(await saveBrief(store, save, { confirm: false })).toBe("busy");
        expect(save).toHaveBeenCalledTimes(1);
        pending.resolve({ success: true });
        await running;
    });

    it("shows typing done during a save as unsaved afterwards", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit." } });
        const pending = deferred<Awaited<ReturnType<SaveBrief>>>();
        const running = saveBrief(store, () => pending.promise, { confirm: true });

        store.dispatch({ type: "draft/edit", patch: { work: "Refit. And the en-suite." } });
        pending.resolve({ success: true });
        await running;

        expect(briefSaveStatus(store.getState())).toBe("unsaved");
        expect(store.getState().saved.work).toBe("Refit.");
    });

    it("a plain save does not mark the brief as confirmed", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit." } });
        const save = vi.fn<SaveBrief>(async () => ({ success: true }));
        await saveBrief(store, save, { confirm: false });
        expect(save.mock.calls[0][0].brief_completed).toBe(false);
        expect(isBriefConfirmed(store.getState())).toBe(false);
    });

    it("will not confirm a brief with no description", async () => {
        const store = makeStore();
        store.dispatch({ type: "stage/set", stage: "review" });
        const save = vi.fn<SaveBrief>(async () => ({ success: true }));

        expect(await saveBrief(store, save, { confirm: true })).toBe("invalid");
        expect(save).not.toHaveBeenCalled();
        expect(store.getState().save.error).toBe(DESCRIPTION_NEEDED_ERROR);
        expect(store.getState().stage).toBe("client");
    });

    it("sends the contractor to the field that needs fixing", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit.", roughValue: "about ten grand" } });
        const save = vi.fn<SaveBrief>(async () => ({ success: true }));

        expect(await saveBrief(store, save, { confirm: true })).toBe("invalid");
        expect(save).not.toHaveBeenCalled();
        expect(store.getState().stage).toBe("site");
        expect(store.getState().draft.roughValue).toBe("about ten grand");
    });
});

describe("Build the price never opens before a confirmed save", () => {
    it("saves first, then opens Estimating for the same project", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit the bathroom." } });
        const order: string[] = [];
        const save: SaveBrief = async (payload) => {
            order.push(`save:${payload.brief_completed}`);
            return { success: true };
        };

        const outcome = await continueToPricing(store, save, () => order.push("navigate"));

        expect(outcome).toBe("navigated");
        expect(order).toEqual(["save:true", "navigate"]);
        expect(pricingPathForProject("abc-123")).toBe("/dashboard/projects/costs?projectId=abc-123");
    });

    it("stays on the Brief when the save fails", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit the bathroom." } });
        const navigate = vi.fn();

        const outcome = await continueToPricing(store, async () => ({ success: false, error: BRIEF_SAVE_ERROR }), navigate);

        expect(outcome).toBe("failed");
        expect(navigate).not.toHaveBeenCalled();
        expect(store.getState().draft.work).toBe("Refit the bathroom.");
        expect(briefSaveStatus(store.getState())).toBe("failed");
    });

    it("does not navigate while the save is still in flight", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit." } });
        const pending = deferred<Awaited<ReturnType<SaveBrief>>>();
        const navigate = vi.fn();

        const running = continueToPricing(store, () => pending.promise, navigate);
        await Promise.resolve();
        expect(navigate).not.toHaveBeenCalled();

        pending.resolve({ success: true });
        expect(await running).toBe("navigated");
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it("does not navigate with text typed during the save still unsaved", async () => {
        const store = makeStore();
        store.dispatch({ type: "draft/edit", patch: { work: "Refit." } });
        const pending = deferred<Awaited<ReturnType<SaveBrief>>>();
        const navigate = vi.fn();

        const running = continueToPricing(store, () => pending.promise, navigate);
        store.dispatch({ type: "draft/edit", patch: { work: "Refit. Plus more." } });
        pending.resolve({ success: true });

        expect(await running).toBe("busy");
        expect(navigate).not.toHaveBeenCalled();
    });

    it("goes straight through when the brief is already confirmed and unchanged", async () => {
        const store = makeStore({ ...BLANK_PROJECT, brief_scope: "Refit the bathroom.", brief_completed: true });
        const save = vi.fn<SaveBrief>();
        const navigate = vi.fn();

        expect(await continueToPricing(store, save, navigate)).toBe("navigated");
        expect(save).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it("blocks an empty brief with a plain reason", async () => {
        const store = makeStore();
        const navigate = vi.fn();
        expect(await continueToPricing(store, async () => ({ success: true }), navigate)).toBe("invalid");
        expect(navigate).not.toHaveBeenCalled();
    });
});
