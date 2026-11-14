import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";

const mocks = vi.hoisted(() => ({ requireEditableProjectAccess: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addPlanningItemToProgramme } from "@/lib/planning-programme-item";
import { PROGRAMME_STALE_ERROR, viewForProject } from "@/lib/simple-programme";
import { saveSimpleProgrammeAction } from "./simple-actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
// 12 October 2026 is a Monday.
const MONDAY = "2026-10-12";

// Fields the detailed planner and live tracking keep on a phase must survive an add.
const established = [
    { name: "Strip out", calculatedDays: 3, manualDays: 5, manhours: 24, startOffset: 0, color: "blue", duration_unit: "Weeks" },
    { name: "First fix", calculatedDays: 10, manualDays: 10, manhours: 80, startOffset: 7, color: "emerald", duration_unit: "Weeks" },
];
const item = { name: "Order windows", duration: "3", unit: "weeks" as const };
let keys = 0;
const makeKey = () => `key-${keys++}`;

function setup(project: Record<string, unknown> = {}) {
    const db = fakeSupabase({ projects: [{ id: PROJECT_ID, user_id: USER_ID, start_date: MONDAY, programme_phases: established, ...project }] });
    mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
    return db;
}
const add = (db: ReturnType<typeof setup>, overrides: Partial<Parameters<typeof addPlanningItemToProgramme>[0]> = {}) =>
    addPlanningItemToProgramme({
        project: db.tables.projects[0], item, makeKey,
        save: input => saveSimpleProgrammeAction(PROJECT_ID, input),
        ...overrides,
    });

beforeEach(() => { vi.clearAllMocks(); keys = 0; });

describe("adding a confirmed planning item through the real programme save", () => {
    it("stores the new stage last and leaves the saved stages' own fields in place", async () => {
        const db = setup();
        expect(await add(db)).toEqual({ ok: true, name: "Order windows" });
        const phases = db.tables.projects[0].programme_phases as Array<Record<string, unknown>>;
        expect(phases.map(phase => phase.name)).toEqual(["Strip out", "First fix", "Order windows"]);
        expect(phases[0]).toMatchObject({ color: "blue", manhours: 24, calculatedDays: 3, manualDays: 5 });
        expect(phases[1]).toMatchObject({ color: "emerald", manhours: 80 });
        expect(phases[2]).toMatchObject({ manualDays: 15, startOffset: 21, duration_unit: "Weeks" });
        expect(db.updates).toHaveLength(1);
        // The server's own ownership and optimistic-match filters were applied.
        expect(db.updates[0].filters).toMatchObject({ id: PROJECT_ID, user_id: USER_ID, programme_phases: JSON.stringify(established) });
        // What it stored still opens as the same simple programme, now with the new stage.
        const view = viewForProject(db.tables.projects[0], () => "key");
        expect(view).toMatchObject({ kind: "simple", hasSaved: true });
        expect(view.kind === "simple" && view.draft.stages.map(stage => stage.name)).toEqual(["Strip out", "First fix", "Order windows"]);
    });

    it("loses cleanly, changing nothing, when the stored programme changes while the add is being saved", async () => {
        const db = setup();
        const concurrent = [...established, { name: "Finishes", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 21, duration_unit: "Weeks" }];
        const from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const query = from(table), update = query.update;
            query.update = values => { db.tables.projects[0].programme_phases = concurrent; return update(values); };
            return query;
        });
        expect(await add(db)).toEqual({ ok: false, error: PROGRAMME_STALE_ERROR, stale: true });
        expect(db.tables.projects[0].programme_phases).toEqual(concurrent);
    });

    describe("a page that is out of date with the stored programme", () => {
        const T1 = "2026-11-14T09:00:00+00:00";
        const T2 = "2026-11-14T10:00:00+00:00";
        const finishes = { name: "Finishes", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 21, duration_unit: "Weeks" };

        it("refuses the add and writes nothing when the programme was edited after the page loaded", async () => {
            const db = setup();
            const pageCopy = structuredClone(db.tables.projects[0]);
            db.tables.projects[0].programme_phases = [...established, finishes];
            expect(await add(db, { project: pageCopy })).toEqual({ ok: false, error: PROGRAMME_STALE_ERROR, stale: true });
            expect(db.updates).toHaveLength(0);
            expect(db.tables.projects[0].programme_phases).toEqual([...established, finishes]);
        });

        it("refuses when only updated_at has moved on", async () => {
            const db = setup({ updated_at: T1 });
            const pageCopy = structuredClone(db.tables.projects[0]);
            db.tables.projects[0].updated_at = T2;
            expect(await add(db, { project: pageCopy })).toEqual({ ok: false, error: PROGRAMME_STALE_ERROR, stale: true });
            expect(db.updates).toHaveLength(0);
            expect(db.tables.projects[0].programme_phases).toEqual(established);
        });

        it("refuses when the start date was changed after the page loaded", async () => {
            const db = setup();
            const pageCopy = structuredClone(db.tables.projects[0]);
            db.tables.projects[0].start_date = "2026-10-19";
            expect(await add(db, { project: pageCopy })).toMatchObject({ ok: false, stale: true });
            expect(db.updates).toHaveLength(0);
        });

        it("saves when the page matches, and the write itself is bound to that version", async () => {
            const db = setup({ updated_at: T1 });
            expect(await add(db)).toEqual({ ok: true, name: "Order windows" });
            expect(db.updates).toHaveLength(1);
            expect(db.updates[0].filters).toMatchObject({ id: PROJECT_ID, user_id: USER_ID, start_date: MONDAY, updated_at: T1 });
        });

        it("loses cleanly when updated_at moves between the server's read and its write", async () => {
            const db = setup({ updated_at: T1 });
            const from = db.client.from;
            vi.spyOn(db.client, "from").mockImplementation(table => {
                const query = from(table), update = query.update;
                query.update = values => { db.tables.projects[0].updated_at = T2; return update(values); };
                return query;
            });
            expect(await add(db)).toEqual({ ok: false, error: PROGRAMME_STALE_ERROR, stale: true });
            expect(db.tables.projects[0].programme_phases).toEqual(established);
        });
    });

    it("writes nothing when the job is locked", async () => {
        const db = setup();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("Pre-contract information is locked because the proposal was accepted."));
        const result = await add(db);
        expect(result.ok).toBe(false);
        expect(db.updates).toHaveLength(0);
        expect(db.tables.projects[0].programme_phases).toEqual(established);
    });

    it("writes nothing when the contractor has left the programme out of the proposal", async () => {
        const omitted = [...established, { programmeIntent: "omit", intent_version: 1 }];
        const db = setup({ programme_phases: omitted });
        const result = await add(db);
        expect(result.ok).toBe(false);
        expect(db.updates).toHaveLength(0);
        expect(db.tables.projects[0].programme_phases).toEqual(omitted);
    });

    it("writes nothing for an unusable length", async () => {
        const db = setup();
        expect(await add(db, { item: { ...item, duration: "soon" } })).toEqual({ ok: false, error: "Enter a whole number, for example 3." });
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        expect(db.updates).toHaveLength(0);
    });
});
