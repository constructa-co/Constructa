import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { readProgrammeInclusion, withProgrammeInclusion } from "@/lib/programme-inclusion";
import { writeProgrammeStorage, PROGRAMME_CHOICE_UNCONFIRMED } from "@/lib/server/programme-storage";

const mocks = vi.hoisted(() => ({ requireEditableProjectAccess: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveProgrammeInclusionAction } from "./inclusion-actions";
import { saveSimpleProgrammeAction } from "./simple-actions";

const id = "11111111-1111-4111-8111-111111111111", user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stages = [{ name: "Private planning", manualDays: 5, startOffset: 0, color: "emerald", manhours: 12 }];
function setup(raw: unknown = stages) {
    const db = fakeSupabase({ projects: [{ id, user_id: user, programme_phases: raw, start_date: "2026-10-19" }] });
    mocks.requireEditableProjectAccess.mockResolvedValue({ user: { id: user }, supabase: db.client });
    return db;
}
beforeEach(() => vi.clearAllMocks());

describe("owner-confirmed programme choice", () => {
    it("omits and restores the exact saved phases with owner and JSON compare filters", async () => {
        const db = setup();
        const omitted = await saveProgrammeInclusionAction(id, false);
        expect(omitted).toMatchObject({ success: true, programmePhases: withProgrammeInclusion(stages, false) });
        expect(db.updates[0].filters).toEqual({ id, user_id: user, programme_phases: JSON.stringify(stages) });
        expect(db.tables.projects[0].start_date).toBe("2026-10-19");
        expect(await saveProgrammeInclusionAction(id, true)).toEqual({ success: true, programmePhases: stages });
        expect(db.tables.projects[0].programme_phases).toEqual(stages);
    });
    it("records an empty-job omission without creating activities and restores the original absence", async () => {
        const db = setup(null);
        expect((await saveProgrammeInclusionAction(id, false)).success).toBe(true);
        expect(db.updates[0].filters).toEqual({ id, user_id: user, programme_phases: null });
        expect(readProgrammeInclusion(db.tables.projects[0].programme_phases)).toEqual({ intent: "omit", phases: [] });
        expect(await saveProgrammeInclusionAction(id, true)).toEqual({ success: true, programmePhases: [] });
    });
    it("makes repeated same-choice requests read-only", async () => {
        const db = setup(withProgrammeInclusion(stages, false));
        expect((await saveProgrammeInclusionAction(id, false)).success).toBe(true);
        expect(db.updates).toEqual([]);
    });
    it("does not claim success after DB error or an unmatched owner, and can retry", async () => {
        const db = setup(); db.fail("projects", "update", "57014");
        expect(await saveProgrammeInclusionAction(id, false)).toEqual({ success: false, error: PROGRAMME_CHOICE_UNCONFIRMED });
        expect(db.tables.projects[0].programme_phases).toEqual(stages);
        expect((await saveProgrammeInclusionAction(id, false)).success).toBe(true);
        db.tables.projects[0].user_id = "someone else";
        expect((await saveProgrammeInclusionAction(id, true)).success).toBe(false);
    });
    it("rejects a concurrent phase change instead of overwriting it", async () => {
        const db = setup(), from = db.client.from;
        db.client.from = table => {
            const q = from(table), update = q.update;
            q.update = values => { db.tables.projects[0].programme_phases = [{ name: "Newer activity", manualDays: 2 }]; return update(values); };
            return q;
        };
        expect((await saveProgrammeInclusionAction(id, false)).success).toBe(false);
        expect(db.tables.projects[0].programme_phases).toEqual([{ name: "Newer activity", manualDays: 2 }]);
    });
    it("keeps pre-contract locks and input checks before data mutation", async () => {
        const db = setup();
        expect((await saveProgrammeInclusionAction("not-id", false)).success).toBe(false);
        expect(mocks.requireEditableProjectAccess).not.toHaveBeenCalled();
        mocks.requireEditableProjectAccess.mockRejectedValue(new Error("This proposal has been accepted. Record later scope or price changes as variations."));
        expect((await saveProgrammeInclusionAction(id, false)).success).toBe(false);
        expect(db.log).toEqual([]);
    });
    it("requires explicit include before a stale simple editor can save activities", async () => {
        const db = setup(withProgrammeInclusion(stages, false));
        const result = await saveSimpleProgrammeAction(id, { startDate: "2026-10-19", stages: [{ name: "Old editor", workingDays: 1, unit: "days", source: null }] });
        expect(result.success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("retains omission while an operational planner saves progress", async () => {
        const db = setup(withProgrammeInclusion(stages, false));
        const access = await mocks.requireEditableProjectAccess(id);
        const updated = [{ ...stages[0], pct_complete: 25 }];
        await writeProgrammeStorage(access.supabase, user, id, { phases: updated });
        expect(readProgrammeInclusion(db.tables.projects[0].programme_phases)).toEqual({ intent: "omit", phases: updated });
    });
    it("does not treat malformed metadata as omission or erase it on save", async () => {
        const raw = [{ programmeIntent: "omit" }], db = setup(raw);
        expect((await saveProgrammeInclusionAction(id, false)).success).toBe(false);
        expect(db.tables.projects[0].programme_phases).toEqual(raw); expect(db.updates).toEqual([]);
    });
});
