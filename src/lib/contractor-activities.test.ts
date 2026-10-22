import { describe, expect, it, vi } from "vitest";
import {
    activityEntryError, briefReducer, briefSaveStatus, buildBriefPayload,
    continueToPricing, initialBriefState, isBriefConfirmed, saveBrief,
    type BriefAction, type BriefProjectFields, type BriefStore,
} from "./guided-brief";
import { priceActivitySuggestions } from "./price-activity-suggestions";

const project: BriefProjectFields = {
    brief_scope: "Work described by the contractor.", brief_trade_sections: ["Roofing", "  Legacy name  "],
    client_type: "domestic", potential_value: null, start_date: "", lat: null, lng: null,
    region: "", brief_completed: true,
};
function storeFor(trades = project.brief_trade_sections): BriefStore {
    let state = initialBriefState({ ...project, brief_trade_sections: trades });
    return { getState: () => state, dispatch: (a: BriefAction) => { state = briefReducer(state, a); } };
}
function entry(store: BriefStore, text: string) { store.dispatch({ type: "activity/edit", text }); }
function add(store: BriefStore) {
    const s = store.getState();
    store.dispatch({ type: "activity/add", text: s.activityEntry, version: s.activityEntryVersion });
}
function clear(store: BriefStore) {
    const s = store.getState();
    store.dispatch({ type: "activity/clear", text: s.activityEntry, version: s.activityEntryVersion });
}

describe("contractor-led activities use the existing Brief array", () => {
    it("typing is local, exact and dirty, without altering saved or included names", () => {
        const store = storeFor(); const before = store.getState();
        entry(store, "  Protect the hallway\n  before strip-out  ");
        expect(store.getState().activityEntry).toBe("  Protect the hallway\n  before strip-out  ");
        expect(store.getState().draft).toBe(before.draft);
        expect(store.getState().saved).toBe(before.saved);
        expect(briefSaveStatus(store.getState())).toBe("unsaved");
        expect(isBriefConfirmed(store.getState())).toBe(false);
    });
    it("explicit Add appends exact wording after legacy names with no taxonomy membership", () => {
        const store = storeFor(); entry(store, "  Protect the hallway\n  before strip-out  "); add(store);
        expect(store.getState().draft.trades).toEqual([...project.brief_trade_sections, "  Protect the hallway\n  before strip-out  "]);
        expect(store.getState().saved.trades).toEqual(project.brief_trade_sections);
        expect(store.getState().activityEntry).toBe("");
        expect(buildBriefPayload(store.getState().draft, true)).toMatchObject({ ok: true, payload: { brief_trade_sections: store.getState().draft.trades } });
    });
    it.each([" ", "\n", " Custom activity ", "a".repeat(200), "😀".repeat(200)])("accepts exact text within the existing RPC bounds: %j", text => {
        const store = storeFor([]); entry(store, text); expect(activityEntryError(store.getState())).toBeNull(); add(store);
        expect(store.getState().draft.trades).toEqual([text]);
    });
    it("does not add an empty entry", () => {
        const store = storeFor(); const before = store.getState(); add(store); expect(store.getState()).toBe(before);
    });
    it("retains overlength text rather than truncating or writing it", () => {
        const store = storeFor(); entry(store, "😀".repeat(201)); const before = store.getState();
        expect(activityEntryError(before)).toContain("200"); add(store); expect(store.getState()).toBe(before);
    });
    it("accepts the hundredth name but retains the next input at the RPC bound", () => {
        const store = storeFor(Array.from({ length: 99 }, (_, i) => `Legacy ${i}`));
        entry(store, "Last activity"); add(store); expect(store.getState().draft.trades).toHaveLength(100);
        entry(store, "Keep this pending"); const before = store.getState();
        expect(activityEntryError(before)).toContain("100"); add(store); expect(store.getState()).toBe(before);
    });
    it("Clear discards only the current unadded text, without changing the included draft", () => {
        const store = storeFor(); const draft = store.getState().draft; entry(store, "Not included"); clear(store);
        expect(store.getState().draft).toBe(draft); expect(isBriefConfirmed(store.getState())).toBe(true);
    });
    it("old Add and Clear cannot consume newer text even when the wording is identical", () => {
        const store = storeFor(); entry(store, "Repeat wording");
        const old = store.getState(); clear(store); entry(store, "Repeat wording"); const newer = store.getState();
        store.dispatch({ type: "activity/add", text: old.activityEntry, version: old.activityEntryVersion });
        store.dispatch({ type: "activity/clear", text: old.activityEntry, version: old.activityEntryVersion });
        expect(store.getState()).toBe(newer);
    });
    it("duplicate Add dispatch appends once", () => {
        const store = storeFor(); entry(store, "Protect hallway"); const s = store.getState();
        const action = { type: "activity/add", text: s.activityEntry, version: s.activityEntryVersion } as const;
        store.dispatch(action); store.dispatch(action);
        expect(store.getState().draft.trades).toEqual([...project.brief_trade_sections, "Protect hallway"]);
    });
    it.each([false, true])("Save confirm=%s refuses to silently omit unadded text", async confirm => {
        const store = storeFor(); const save = vi.fn(); entry(store, "Still typing");
        expect(await saveBrief(store, save, { confirm })).toBe("invalid"); expect(save).not.toHaveBeenCalled();
        expect(store.getState().stage).toBe("work"); expect(store.getState().activityEntry).toBe("Still typing");
        expect(store.getState().save.error).toContain("Add the activity");
    });
    it("Build price refuses unadded text even on a previously confirmed brief", async () => {
        const store = storeFor(); const save = vi.fn(), navigate = vi.fn(); entry(store, "Keep me");
        expect(await continueToPricing(store, save, navigate)).toBe("invalid");
        expect(save).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    });
    it("one confirmed save carries exact activities to the existing price suggestions", async () => {
        const store = storeFor(); entry(store, "Protect hallway"); add(store);
        const save = vi.fn().mockResolvedValue({ success: true }), navigate = vi.fn();
        expect(await continueToPricing(store, save, navigate)).toBe("navigated");
        expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0].brief_trade_sections).toEqual([...project.brief_trade_sections, "Protect hallway"]);
        expect(navigate).toHaveBeenCalledTimes(1); expect(isBriefConfirmed(store.getState())).toBe(true);
        expect(priceActivitySuggestions([], store.getState().saved.trades)).toEqual([...project.brief_trade_sections, "Protect hallway"]);
        expect(initialBriefState({ ...project, brief_trade_sections: store.getState().saved.trades }).draft.trades).toEqual(store.getState().draft.trades);
    });
    it("failed save retains included names and exact newer raw text", async () => {
        const store = storeFor(); entry(store, "Protect hallway"); add(store);
        const save = vi.fn(async () => { entry(store, "Newer text"); return { success: false as const, error: "Refused" }; });
        expect(await saveBrief(store, save, { confirm: false })).toBe("failed");
        expect(store.getState().draft.trades.at(-1)).toBe("Protect hallway");
        expect(store.getState().saved.trades).toEqual(project.brief_trade_sections);
        expect(store.getState().activityEntry).toBe("Newer text");
    });
    it("typing during a successful save prevents late pricing navigation", async () => {
        const store = storeFor(); entry(store, "Protect hallway"); add(store);
        const navigate = vi.fn(); const save = vi.fn(async () => { entry(store, "Newer pending activity"); return { success: true as const }; });
        expect(await continueToPricing(store, save, navigate)).toBe("busy");
        expect(navigate).not.toHaveBeenCalled(); expect(store.getState().activityEntry).toBe("Newer pending activity");
        expect(isBriefConfirmed(store.getState())).toBe(false);
    });
    it("stage changes retain raw input and existing legacy trade removal still works", () => {
        const store = storeFor(); entry(store, "Keep across steps"); store.dispatch({ type: "stage/set", stage: "review" });
        store.dispatch({ type: "draft/toggleTrade", trade: "Roofing" });
        expect(store.getState().activityEntry).toBe("Keep across steps");
        expect(store.getState().draft.trades).toEqual(["  Legacy name  "]);
    });
});
