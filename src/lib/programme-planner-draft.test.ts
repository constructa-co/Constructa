import { describe, expect, it, vi } from "vitest";
import {
    programmePlanningChanged,
    programmeTrackingOnlyChanged,
    parseProgrammePlannerDraft,
    readLocalPlannerDraft,
    writeLocalPlannerDraft,
} from "./programme-planner-draft";

const phase = (name: string, pct = 0) => ({
    name, calculatedDays: 5, manualDays: 5, manhours: 0, startOffset: 0, pct_complete: pct,
});

describe("programme planner draft helpers", () => {
    it("parses a stored draft record", () => {
        expect(parseProgrammePlannerDraft({
            phases: [phase("Groundworks")],
            start_date: "2026-10-19",
            saved_at: "2026-10-19T10:00:00.000Z",
        })).toEqual({
            phases: [phase("Groundworks")],
            start_date: "2026-10-19",
            saved_at: "2026-10-19T10:00:00.000Z",
        });
    });

    it("treats tracking-only edits separately from planning edits", () => {
        const before = [phase("Brickwork", 0)];
        const afterTracking = [phase("Brickwork", 40)];
        expect(programmeTrackingOnlyChanged(before, afterTracking, "2026-10-19", "2026-10-19")).toBe(true);
        expect(programmePlanningChanged(before, afterTracking, "2026-10-19", "2026-10-19")).toBe(false);
        expect(programmePlanningChanged(before, [phase("Brickwork renamed", 40)], "2026-10-19", "2026-10-19")).toBe(true);
    });

    it("ignores property order when comparing planning fields", () => {
        const a = [{ manualDays: 5, name: "Roof", calculatedDays: 5, startOffset: 0, manhours: 0 }];
        const b = [{ name: "Roof", startOffset: 0, manhours: 0, calculatedDays: 5, manualDays: 5 }];
        expect(programmePlanningChanged(a, b, "2026-10-19", "2026-10-19")).toBe(false);
    });

    it("scopes session drafts to the signed-in owner", () => {
        const store = new Map<string, string>();
        vi.stubGlobal("sessionStorage", {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
        });
        writeLocalPlannerDraft("job-1", [phase("A")], "2026-10-19", "user-a");
        expect(readLocalPlannerDraft("job-1", "user-a")?.phases).toHaveLength(1);
        expect(readLocalPlannerDraft("job-1", "user-b")).toBeNull();
        vi.unstubAllGlobals();
    });
});