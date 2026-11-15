import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
    addPlanningItemToProgramme, planningAddBlockReason,
    PLANNING_ADD_DETAILED, PLANNING_ADD_DUPLICATE, PLANNING_ADD_FULL, PLANNING_ADD_NAME,
    PLANNING_ADD_NO_PROGRAMME, PLANNING_ADD_OMITTED, PLANNING_ADD_UNREADABLE,
} from "./planning-programme-item";
import { withProgrammeInclusion } from "./programme-inclusion";
import { buildProgrammePhases, PROGRAMME_SAVE_ERROR, PROGRAMME_STALE_ERROR, type ProgrammeProjectFields, type SaveProgramme, type SimpleProgrammeStageInput } from "./simple-programme";

// 12 October 2026 is a Monday.
const MONDAY = "2026-10-12";
const stage = (name: string, workingDays: number): SimpleProgrammeStageInput => ({ name, workingDays, unit: "weeks", source: null });
const saved = (stages: SimpleProgrammeStageInput[]): ProgrammeProjectFields => ({
    start_date: MONDAY, programme_phases: buildProgrammePhases({ startDate: MONDAY, stages }, []),
});
const project = saved([stage("Strip out", 5), stage("First fix", 10)]);
const counter = () => { let n = 0; return () => `key-${n++}`; };
const okSave = () => vi.fn<SaveProgramme>().mockResolvedValue({ success: true });
const item = { name: "Order windows", duration: "3", unit: "weeks" as const };

describe("adding a confirmed planning item to the programme", () => {
    it("appends the contractor's stage after the saved ones and keeps the saved stages", async () => {
        const save = okSave();
        expect(await addPlanningItemToProgramme({ project, item, save, makeKey: counter() })).toEqual({ ok: true, name: "Order windows" });
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith({
            // The copy of the saved programme this was worked out from, for the server to re-check.
            expectedProgramme: { programme_phases: project.programme_phases, start_date: MONDAY },
            startDate: MONDAY,
            stages: [
                { name: "Strip out", workingDays: 5, unit: "weeks", source: 0 },
                { name: "First fix", workingDays: 10, unit: "weeks", source: 1 },
                { name: "Order windows", workingDays: 15, unit: "weeks", source: null },
            ],
        });
    });

    it("sends updated_at with the basis when the page has one, and reports a stale refusal as stale", async () => {
        const dated = { ...project, updated_at: "2026-11-14T09:00:00+00:00" };
        const save = vi.fn<SaveProgramme>().mockResolvedValue({ success: false, error: PROGRAMME_STALE_ERROR, stale: true });
        expect(await addPlanningItemToProgramme({ project: dated, item, save, makeKey: counter() }))
            .toEqual({ ok: false, error: PROGRAMME_STALE_ERROR, stale: true });
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0][0].expectedProgramme).toEqual({
            programme_phases: project.programme_phases, start_date: MONDAY, updated_at: "2026-11-14T09:00:00+00:00",
        });
    });

    it("uses exactly what was typed: trimmed name, whole working days when chosen", async () => {
        const save = okSave();
        await addPlanningItemToProgramme({ project, item: { name: "  Client picks tiles  ", duration: " 4 ", unit: "days" }, save, makeKey: counter() });
        const stages = (save.mock.calls[0][0] as { stages: SimpleProgrammeStageInput[] }).stages;
        expect(stages.at(-1)).toEqual({ name: "Client picks tiles", workingDays: 4, unit: "days", source: null });
    });

    it("turns a one-bar programme into its first stage and adds after it", async () => {
        const save = okSave();
        const whole = saved([stage("Works on site", 15)]);
        expect(await addPlanningItemToProgramme({ project: whole, item, save, makeKey: counter() })).toMatchObject({ ok: true });
        expect(save).toHaveBeenCalledWith({
            expectedProgramme: { programme_phases: whole.programme_phases, start_date: MONDAY },
            startDate: MONDAY,
            stages: [
                { name: "Works on site", workingDays: 15, unit: "weeks", source: 0 },
                { name: "Order windows", workingDays: 15, unit: "weeks", source: null },
            ],
        });
    });

    it("keeps an undated programme undated", async () => {
        const save = okSave();
        const relative = { start_date: null, programme_phases: buildProgrammePhases({ timeBasis: "relative", startDate: "", stages: [stage("Strip out", 5), stage("First fix", 10)] }, []) };
        expect(await addPlanningItemToProgramme({ project: relative, item, save, makeKey: counter() })).toMatchObject({ ok: true });
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ timeBasis: "relative", startDate: "" }));
    });

    it("refuses, without saving, when there is no editable saved simple programme", async () => {
        const cases: Array<[string, ProgrammeProjectFields, string]> = [
            ["omitted", { start_date: MONDAY, programme_phases: withProgrammeInclusion(project.programme_phases, false) }, PLANNING_ADD_OMITTED],
            ["unreadable", { start_date: MONDAY, programme_phases: {} as never }, PLANNING_ADD_UNREADABLE],
            ["detailed", { start_date: MONDAY, programme_phases: [{ name: "Strip out", manualDays: 5, startOffset: 0, pct_complete: 40 }] }, PLANNING_ADD_DETAILED],
            ["none yet", { start_date: MONDAY, programme_phases: [] }, PLANNING_ADD_NO_PROGRAMME],
            ["null", { start_date: MONDAY, programme_phases: null }, PLANNING_ADD_NO_PROGRAMME],
        ];
        for (const [label, job, error] of cases) {
            const save = okSave();
            expect(await addPlanningItemToProgramme({ project: job, item, save, makeKey: counter() }), label).toEqual({ ok: false, error });
            expect(save, label).not.toHaveBeenCalled();
            expect(planningAddBlockReason(job), label).toBe(error);
        }
    });

    it("refuses a seventh stage, a repeated name and an empty name, without saving", async () => {
        const full = saved(["A", "B", "C", "D", "E", "F"].map(name => stage(name, 5)));
        const save = okSave();
        expect(await addPlanningItemToProgramme({ project: full, item, save, makeKey: counter() })).toEqual({ ok: false, error: PLANNING_ADD_FULL });
        expect(planningAddBlockReason(full)).toBe(PLANNING_ADD_FULL);
        expect(await addPlanningItemToProgramme({ project, item: { ...item, name: "  strip   OUT " }, save, makeKey: counter() })).toEqual({ ok: false, error: PLANNING_ADD_DUPLICATE });
        expect(await addPlanningItemToProgramme({ project, item: { ...item, name: "   " }, save, makeKey: counter() })).toEqual({ ok: false, error: PLANNING_ADD_NAME });
        expect(save).not.toHaveBeenCalled();
        expect(planningAddBlockReason(project)).toBeNull();
    });

    it("never guesses a length: a missing or unusable one is returned for the contractor to fix", async () => {
        for (const [duration, error] of [["", "Say how long this stage takes."], ["abc", "Enter a whole number, for example 3."], ["2.5", "Enter a whole number, for example 3."], ["0", "Enter 1 or more."]]) {
            const save = okSave();
            expect(await addPlanningItemToProgramme({ project, item: { ...item, duration }, save, makeKey: counter() }), duration).toEqual({ ok: false, error });
            expect(save, duration).not.toHaveBeenCalled();
        }
    });

    it("reports a failed or thrown save as not added", async () => {
        const refused = vi.fn<SaveProgramme>().mockResolvedValue({ success: false, error: "The job's working days changed elsewhere. Reload Programme before saving again." });
        expect(await addPlanningItemToProgramme({ project, item, save: refused, makeKey: counter() })).toEqual({
            ok: false, error: "The job's working days changed elsewhere. Reload Programme before saving again.",
        });
        const thrown = vi.fn<SaveProgramme>().mockRejectedValue(new Error("network"));
        expect(await addPlanningItemToProgramme({ project, item, save: thrown, makeKey: counter() })).toEqual({ ok: false, error: PROGRAMME_SAVE_ERROR });
    });

    it("does not alter the project it was given", async () => {
        const before = JSON.stringify(project);
        await addPlanningItemToProgramme({ project, item, save: okSave(), makeKey: counter() });
        expect(JSON.stringify(project)).toBe(before);
    });
});

describe("no data access of its own", () => {
    it("writes only through the save it is handed", () => {
        const code = readFileSync(new URL("./planning-programme-item.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        for (const banned of ["supabase", "fetch(", "localStorage", "sessionStorage", "use server", "revalidatePath", "@/lib/ai", "process.env"]) {
            expect(code, banned).not.toContain(banned);
        }
    });
});
