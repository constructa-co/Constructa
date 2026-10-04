import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";

const mocks = vi.hoisted(() => ({ requireEditableProjectAccess: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { computeProgrammePlan } from "@/lib/programme-plan";
import { PROGRAMME_SAVE_ERROR } from "@/lib/simple-programme";
import { saveSimpleProgrammeAction } from "./simple-actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
// 12 October 2026 is a Monday.
const MONDAY = "2026-10-12";

const established = [
    { name: "Strip out", calculatedDays: 3, manualDays: 5, manhours: 24, startOffset: 0, color: "blue" },
    { name: "First fix", calculatedDays: 10, manualDays: null, manhours: 80, startOffset: 7, color: "emerald" },
    { name: "Finishes", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 21, color: "orange" },
];

function setup(project: Record<string, unknown> = {}) {
    const db = fakeSupabase({ projects: [{ id: PROJECT_ID, user_id: USER_ID, start_date: null, programme_phases: [], ...project }] });
    mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
    return db;
}

const whole = { startDate: MONDAY, stages: [{ name: "Works on site", workingDays: 15, unit: "weeks" as const, source: null }] };

beforeEach(() => vi.clearAllMocks());

describe("saveSimpleProgrammeAction", () => {
    it("saves a start date and one duration as a programme with one canonical end date", async () => {
        const db = setup();
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: true });

        const saved = db.tables.projects[0];
        expect(saved.start_date).toBe(MONDAY);
        expect(saved.programme_phases).toEqual([
            { name: "Works on site", calculatedDays: 15, manualDays: 15, manhours: 0, startOffset: 0, duration_unit: "Weeks" },
        ]);
        expect(computeProgrammePlan(MONDAY, saved.programme_phases as unknown[])).toMatchObject({ end_date: "2026-10-30", duration_label: "3 weeks" });
        // Scoped to the owner as well as the project.
        expect(db.updates[0].filters).toEqual({ id: PROJECT_ID, user_id: USER_ID });
    });

    it("works out stage positions on the server, not from the request", async () => {
        const db = setup();
        await saveSimpleProgrammeAction(PROJECT_ID, {
            startDate: MONDAY,
            stages: [
                { name: "Strip out", workingDays: 5, unit: "weeks", source: null },
                { name: "First fix", workingDays: 8, unit: "days", source: null },
                { name: "Finishes", workingDays: 10, unit: "weeks", source: null },
            ],
        });
        expect((db.tables.projects[0].programme_phases as Array<{ startOffset: number }>).map((p) => p.startOffset)).toEqual([0, 7, 17]);
    });

    it("keeps the detailed planner's fields from the saved project when a stage changes", async () => {
        const db = setup({ start_date: MONDAY, programme_phases: established });
        await saveSimpleProgrammeAction(PROJECT_ID, {
            startDate: MONDAY,
            stages: [
                { name: "Strip out", workingDays: 5, unit: "weeks", source: 0 },
                { name: "First fix and plaster", workingDays: 15, unit: "weeks", source: 1 },
                { name: "Finishes", workingDays: 5, unit: "weeks", source: 2 },
            ],
        });
        const phases = db.tables.projects[0].programme_phases as Array<Record<string, unknown>>;
        expect(phases[1]).toMatchObject({ name: "First fix and plaster", calculatedDays: 10, manualDays: 15, manhours: 80, color: "emerald" });
        expect(phases[2]).toMatchObject({ color: "orange", manhours: 40, startOffset: 28 });
    });

    it("retains nothing from a failed save and succeeds on retry with the same input", async () => {
        const db = setup();
        db.fail("projects", "update", "57014");
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: false, error: PROGRAMME_SAVE_ERROR });
        expect(db.tables.projects[0].programme_phases).toEqual([]);
        expect(db.tables.projects[0].start_date).toBeNull();

        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: true });
        expect(db.tables.projects[0].start_date).toBe(MONDAY);
    });

    it("reports a save that matched no row as failed", async () => {
        const db = setup();
        db.tables.projects[0].user_id = "someone-else";
        mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: false, error: PROGRAMME_SAVE_ERROR });
    });

    it("refuses once pre-contract information is locked, with the reason", async () => {
        const db = setup();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("This proposal has been accepted. Record later scope or price changes as variations."));
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({
            success: false,
            error: "This proposal has been accepted. Record later scope or price changes as variations.",
        });
        expect(db.updates).toEqual([]);
    });

    it("refuses another user's project without saying why", async () => {
        const db = setup();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Unauthorized project access."));
        await expect(saveSimpleProgrammeAction(PROJECT_ID, whole)).resolves.toEqual({ success: false, error: "You can't change this project's programme." });
        expect(db.log).toEqual([]);
    });

    it.each([
        ["a weekend start", { ...whole, startDate: "2026-10-17" }],
        ["a malformed date", { ...whole, startDate: "12/10/2026" }],
        ["two stages", { startDate: MONDAY, stages: [whole.stages[0], whole.stages[0]] }],
        ["seven stages", { startDate: MONDAY, stages: Array.from({ length: 7 }, () => whole.stages[0]) }],
        ["no stages", { startDate: MONDAY, stages: [] }],
        ["a zero duration", { startDate: MONDAY, stages: [{ ...whole.stages[0], workingDays: 0 }] }],
        ["a fractional duration", { startDate: MONDAY, stages: [{ ...whole.stages[0], workingDays: 2.5 }] }],
        ["an unnamed stage", { startDate: MONDAY, stages: [{ ...whole.stages[0], name: "  " }] }],
    ])("rejects %s before touching the database", async (_label, input) => {
        const db = setup();
        const result = await saveSimpleProgrammeAction(PROJECT_ID, input as never);
        expect(result.success).toBe(false);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        expect(db.log).toEqual([]);
    });
});
