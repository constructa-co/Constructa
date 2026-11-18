import { describe, expect, it, vi } from "vitest";
import {
    mergeTrackingOntoPublishedPlanning,
    overlayPublishedTrackingOnDraftPhases,
    phasesWithoutTrackingFields,
    PROGRAMME_TRACKING_ASSOCIATION_ERROR,
    programmePlanningChanged,
    programmePhaseIdentityKey,
    programmeTrackingAssociationError,
    programmeTrackingFieldsChanged,
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

    it("detects tracking deltas even when stages are reordered", () => {
        const published = [
            phase("Groundworks", 0),
            phase("Roofing", 0),
        ];
        const reordered = [
            { ...published[1], startOffset: 0, pct_complete: 30 },
            { ...published[0], startOffset: 7, pct_complete: 0 },
        ];
        expect(programmePhaseIdentityKey(reordered[1])).toBe(programmePhaseIdentityKey(published[0]));
        expect(programmeTrackingFieldsChanged(published, reordered, "2026-10-19", "2026-10-19")).toBe(true);
        expect(programmePlanningChanged(published, reordered, "2026-10-19", "2026-10-19")).toBe(true);
    });

    it("overlays published tracking onto draft stages by identity, not row index", () => {
        const published = [phase("Groundworks", 55), phase("Roofing", 0)];
        const draft = [
            { ...published[1], startOffset: 0 },
            { ...published[0], startOffset: 7, pct_complete: 5 },
        ];
        const opened = overlayPublishedTrackingOnDraftPhases(published, draft);
        expect((opened[0] as typeof published[0]).pct_complete).toBe(0);
        expect((opened[1] as typeof published[0]).pct_complete).toBe(55);
    });

    it("merges tracking onto published planning without adopting draft planning", () => {
        const published = [phase("Groundworks", 0)];
        const observed = [{ ...published[0], pct_complete: 40 }];
        const merged = mergeTrackingOntoPublishedPlanning(published, observed) as typeof published;
        expect(merged[0].manualDays).toBe(5);
        expect(merged[0].pct_complete).toBe(40);
    });

    it("detects tracking deltas when the draft start date differs from published", () => {
        const published = [phase("Brickwork", 0)];
        const after = [phase("Brickwork", 40)];
        expect(programmeTrackingFieldsChanged(published, after, "2026-10-19", "2026-10-26")).toBe(true);
    });

    it("refuses ambiguous tracking when a published stage is renamed in the draft", () => {
        const published = [phase("Groundworks", 55)];
        const renamed = [{ ...phase("Groundworks renamed", 40), calculatedDays: 5, manualDays: 5 }];
        expect(programmeTrackingAssociationError(published, renamed)).toBe(PROGRAMME_TRACKING_ASSOCIATION_ERROR);
    });

    it("refuses ambiguous tracking when two stages share the same identity", () => {
        const duplicate = [phase("Snagging", 10), phase("Snagging", 0)];
        expect(programmeTrackingAssociationError(duplicate, duplicate)).toBe(PROGRAMME_TRACKING_ASSOCIATION_ERROR);
    });

    it("strips operational fields before draft persistence", () => {
        const phases = [{ ...phase("Brickwork", 40), actual_start_date: "2026-10-20" }];
        expect(phasesWithoutTrackingFields(phases)[0]).not.toHaveProperty("pct_complete");
        expect(phasesWithoutTrackingFields(phases)[0]).not.toHaveProperty("actual_start_date");
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