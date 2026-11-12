import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
    briefReducer, buildBriefPayload, continueToPricing, initialBriefState,
    isDirty, saveBrief, type BriefStore, type BriefSavePayload,
} from "./guided-brief";

const project = {
    brief_scope: "Replace roof", brief_trade_sections: ["Roofing"], client_type: "domestic",
    potential_value: 123.456, start_date: "", lat: null, lng: null,
    region: "", brief_completed: false,
};
function store(): BriefStore {
    let state = initialBriefState(project);
    return { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
}

describe("retired Brief rough value preserves existing stored money", () => {
    it.each(["", "0", "123.456", "1e5", "historical value"])("omits the key without parsing hidden legacy text %j", roughValue => {
        const result = buildBriefPayload({ ...initialBriefState(project).draft, roughValue }, true, { preservePotentialValue: true });
        expect(result.ok).toBe(true);
        if (!result.ok) throw Error(result.error);
        expect(result.payload).not.toHaveProperty("potential_value");
        expect(result.payload.brief_scope).toBe("Replace roof");
        expect(result.payload.brief_completed).toBe(true);
    });

    it("keeps legacy helper callers' explicit-value behavior", () => {
        const result = buildBriefPayload({ ...initialBriefState(project).draft, roughValue: "45000" }, false);
        expect(result).toMatchObject({ ok: true, payload: { potential_value: 45000 } });
    });

    it("does not mark a hidden unpersisted change as acknowledged", async () => {
        const s = store();
        s.dispatch({ type: "draft/edit", patch: { roughValue: "999" } });
        const save = vi.fn(async (payload: BriefSavePayload) => {
            expect(payload).not.toHaveProperty("potential_value");
            return { success: true as const };
        });
        const navigate = vi.fn();
        expect(await continueToPricing(s, save, navigate, { preservePotentialValue: true })).toBe("busy");
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0][0]).not.toHaveProperty("potential_value");
        expect(s.getState().saved.roughValue).toBe("123.456");
        expect(s.getState().draft.roughValue).toBe("999");
        expect(isDirty(s.getState())).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
    });

    it("still refuses incomplete work and pending activity before making a request", async () => {
        const s = store(); const save = vi.fn();
        s.dispatch({ type: "draft/edit", patch: { work: "" } });
        expect(await saveBrief(s, save, { confirm: true, preservePotentialValue: true })).toBe("invalid");
        s.dispatch({ type: "draft/edit", patch: { work: "Roof" } });
        s.dispatch({ type: "activity/edit", text: "Not yet included" });
        expect(await saveBrief(s, save, { confirm: true, preservePotentialValue: true })).toBe("invalid");
        expect(s.getState().activityEntry).toBe("Not yet included");
        expect(save).not.toHaveBeenCalled();
    });

    it("retains newer work and refuses late navigation", async () => {
        const s = store(); let finish!: (result: { success: true }) => void;
        const save = vi.fn(() => new Promise<{ success: true }>(resolve => { finish = resolve; }));
        const navigate = vi.fn();
        const pending = continueToPricing(s, save, navigate, { preservePotentialValue: true });
        s.dispatch({ type: "draft/edit", patch: { work: "Newer exact text" } });
        finish({ success: true });
        expect(await pending).toBe("busy");
        expect(s.getState().draft.work).toBe("Newer exact text");
        expect(navigate).not.toHaveBeenCalled();
    });

    it("retains the existing RPC omission-preserves-value contract and removes video monetary presentation", () => {
        const sql = readFileSync("supabase/migrations/20260930120000_atomic_phase1_project_creation.sql", "utf8");
        expect(sql).toMatch(/potential_value = CASE\s+WHEN p_brief \? 'potential_value' THEN NULLIF\(p_brief->>'potential_value', ''\)::numeric\s+ELSE p.potential_value\s+END/);
        const video = readFileSync("src/app/dashboard/projects/brief/video-walkthrough.tsx", "utf8");
        expect(video).not.toContain("Estimated value:");
        expect(video).not.toContain("result.estimatedValue");
    });
});
