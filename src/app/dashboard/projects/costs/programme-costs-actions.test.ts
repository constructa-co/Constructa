import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    computeProgrammeCosts,
    planProgrammeCostApplication,
    programmeCostLineNote,
    type ProgrammeCostInputs,
} from "@/lib/programme-costs";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const ESTIMATE = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
    access: vi.fn(), editable: vi.fn(), recalc: vi.fn(),
    project: null as Record<string, unknown> | null,
    estimate: null as Record<string, unknown> | null,
    lines: [] as Record<string, unknown>[],
    deleted: [] as string[][],
    inserted: [] as Record<string, unknown>[][],
    insertError: null as { message: string; code?: string } | null,
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({
    requireEstimateAccess: mocks.access,
    requireEditableAccessForVerifiedProject: mocks.editable,
}));
vi.mock("./estimate-total", () => ({ recalcEstimateTotal: mocks.recalc }));

import { applyProgrammeCostsAction } from "./programme-costs-actions";

// Synthetic programme: Mon 1 – Fri 5 March 2027 and Wed 3 – Tue 9 March 2027.
const SOURCE = {
    id: PROJECT, start_date: "2027-03-01", region: "England",
    programme_phases: [
        { name: "Groundworks", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 },
        { name: "Drainage", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 2 },
    ],
};
const INPUTS: ProgrammeCostInputs = {
    version: 2,
    stages: [{ name: "Groundworks", shifts: ["day"], costedOperatives: null, crewByShift: { day: null, night: null } }, { name: "Drainage", shifts: ["day"], costedOperatives: null, crewByShift: { day: null, night: null } }],
    gangFloors: [], supervision: [{ shift: "day", ratePerShiftPence: 18_000 }], hires: [], crews: [],
};
const LABOUR = { id: "labour", estimate_id: ESTIMATE, trade_section: "Groundworks", description: "Excavate trench", quantity: 1, unit_rate: 1000, line_total: 1000, notes: null };

function supabase() {
    return {
        from(table: string) {
            const filters: Record<string, unknown> = {};
            const query: Record<string, unknown> = {
                select: () => query,
                eq: (key: string, value: unknown) => { filters[key] = value; return query; },
                single: async () => ({ data: table === "projects" ? mocks.project : mocks.estimate, error: null }),
                then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.lines, error: null }).then(resolve),
                delete: () => {
                    const del: Record<string, unknown> = {
                        eq: () => del,
                        in: (_key: string, ids: string[]) => { mocks.deleted.push(ids); return del; },
                        select: async () => ({ data: (mocks.deleted.at(-1) ?? []).map((id) => ({ id })), error: null }),
                    };
                    return del;
                },
                insert: (rows: Record<string, unknown>[]) => ({
                    select: async () => {
                        mocks.inserted.push(rows);
                        return mocks.insertError ? { data: null, error: mocks.insertError } : { data: rows.map((row, index) => ({ id: `new-${index}`, ...row })), error: null };
                    },
                }),
            };
            return query;
        },
    };
}

function reviewed(lines: Record<string, unknown>[] = mocks.lines) {
    const outcome = computeProgrammeCosts(SOURCE, INPUTS);
    if (!outcome.ok) throw new Error(outcome.errors.join());
    const plan = planProgrammeCostApplication(mocks.estimate!, lines as never, outcome.result.lines);
    return { outcome, plan, acknowledgement: { signature: outcome.result.signature, beforePence: plan.beforePence, afterPence: plan.afterPence } };
}

beforeEach(() => {
    mocks.project = { ...SOURCE };
    mocks.estimate = { id: ESTIMATE, project_id: PROJECT, prelims_pct: 10, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0 };
    mocks.lines = [LABOUR];
    mocks.deleted = []; mocks.inserted = []; mocks.insertError = null;
    const access = { estimateId: ESTIMATE, projectId: PROJECT, supabase: supabase(), user: { id: "user" } };
    mocks.access.mockReset().mockResolvedValue(access);
    mocks.editable.mockReset().mockResolvedValue(access);
    mocks.recalc.mockReset().mockResolvedValue(undefined);
});

describe("applying programme costs to the estimate (first apply only, insert only)", () => {
    it("writes the reviewed set as Preliminaries lines with an internal note, and keeps the labour line", async () => {
        const { acknowledgement, outcome } = reviewed();
        const result = await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement });
        expect(result).toMatchObject({ ok: true });
        expect(mocks.deleted).toEqual([]);
        expect(mocks.inserted).toHaveLength(1);
        const [row] = mocks.inserted[0];
        expect(row).toMatchObject({ estimate_id: ESTIMATE, trade_section: "Preliminaries", description: "Site supervision – day shifts", quantity: 7, unit: "shift", unit_rate: 180, line_total: 1260 });
        expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(JSON.parse(row.notes as string)).toEqual({ constructaProgrammeCost: 1, key: "supervision:day", sig: outcome.result.signature, inputs: INPUTS });
        expect(mocks.recalc).toHaveBeenCalledOnce();
    });

    it("gives a repeated request for the same reviewed set the same line ids, so the database rejects a second copy", async () => {
        const { acknowledgement } = reviewed();
        await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement });
        mocks.insertError = { message: "duplicate key", code: "23505" } as never;
        const second = await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement });
        expect(mocks.inserted[1].map((row) => row.id)).toEqual(mocks.inserted[0].map((row) => row.id));
        expect(second).toMatchObject({ ok: false, alreadyApplied: true });
        expect(mocks.recalc).toHaveBeenCalledOnce();
    });

    it("refuses to replace a set already on the estimate and deletes nothing", async () => {
        const { outcome } = reviewed();
        const earlier = { id: "earlier", estimate_id: ESTIMATE, trade_section: "Preliminaries", description: "Site supervision – day shifts", quantity: 5, unit_rate: 180, line_total: 900, notes: programmeCostLineNote(outcome.result.lines[0], "0badc0de", INPUTS) };
        mocks.lines = [LABOUR, earlier];
        const { acknowledgement } = reviewed();
        const result = await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement });
        expect(result).toMatchObject({ ok: false, alreadyApplied: true });
        expect(mocks.deleted).toEqual([]);
        expect(mocks.inserted).toEqual([]);
        expect(mocks.recalc).not.toHaveBeenCalled();
    });

    it("never replaces an applied set the contractor edited: the edited price stays and nothing is written", async () => {
        const { outcome } = reviewed();
        const line = outcome.result.lines[0];
        mocks.lines = [LABOUR, { id: "edited", estimate_id: ESTIMATE, trade_section: "Preliminaries", description: line.description, quantity: 5, unit: line.unit, unit_rate: 180, line_total: 900, notes: programmeCostLineNote(line, outcome.result.signature, INPUTS) }];
        const { acknowledgement } = reviewed();
        expect(await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement })).toMatchObject({ ok: false, alreadyApplied: true });
        expect(mocks.deleted).toEqual([]);
        expect(mocks.inserted).toEqual([]);
    });

    it("refuses when the programme changed after the contractor checked the price", async () => {
        const { acknowledgement } = reviewed();
        mocks.project = { ...SOURCE, programme_phases: [SOURCE.programme_phases[0], { ...SOURCE.programme_phases[1], calculatedDays: 8 }] };
        const result = await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement });
        expect(result).toMatchObject({ ok: false, stale: true });
        expect(mocks.inserted).toEqual([]);
    });

    it("refuses when the estimate total moved after review, e.g. a line edited in another tab", async () => {
        const { acknowledgement } = reviewed();
        mocks.lines = [{ ...LABOUR, line_total: 1200, unit_rate: 1200 }];
        expect(await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement })).toMatchObject({ ok: false, stale: true });
        expect(mocks.inserted).toEqual([]);
    });

    it("refuses an unsupported hire basis instead of pricing it", async () => {
        const inputs = { ...INPUTS, hires: [{ id: "h1", description: "Welfare unit", unit: "week", ratePence: 9000, chargeableDays: null, partPeriodRule: null, minimumPeriods: 1, onHire: { kind: "stage_start", stage: 0 }, offHire: { kind: "stage_finish", stage: 1 }, offHireRule: "collection_date", offHireDays: 0, deliveryPence: 0, collectionPence: 0 }] };
        const { acknowledgement } = reviewed();
        const result = await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs, acknowledgement });
        expect(result.ok).toBe(false);
        expect(mocks.inserted).toEqual([]);
    });

    it("refuses an estimate from another job and a locked job before writing anything", async () => {
        const { acknowledgement } = reviewed();
        mocks.access.mockResolvedValueOnce({ estimateId: ESTIMATE, projectId: "33333333-3333-4333-8333-333333333333", supabase: supabase() });
        expect(await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement })).toMatchObject({ ok: false });
        mocks.editable.mockRejectedValueOnce(new Error("This job is under contract."));
        expect(await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement })).toEqual({ ok: false, error: "This job is under contract." });
        expect(mocks.inserted).toEqual([]);
    });

    it("leaves the estimate as it was when the insert fails", async () => {
        mocks.insertError = { message: "insert failed" };
        const { acknowledgement } = reviewed();
        const result = await applyProgrammeCostsAction({ projectId: PROJECT, estimateId: ESTIMATE, inputs: INPUTS, acknowledgement });
        expect(result).toMatchObject({ ok: false });
        expect(mocks.deleted).toEqual([]);
        expect(mocks.recalc).not.toHaveBeenCalled();
    });
});
