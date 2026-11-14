import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildArchiveSnapshotFigures, type ArchiveSnapshotInputs } from "./archive-snapshot";

const ok = <T,>(data: T) => ({ data, error: null });
const failed = { data: null, error: { message: "boom" } };

const ESTIMATE = {
  total_cost: 0,
  overhead_pct: 10,
  profit_pct: 0,
  risk_pct: 0,
  prelims_pct: 10,
  discount_pct: 0,
  estimate_lines: [{ trade_section: "Groundworks", line_total: 1000 }],
}; // 1000 + 10% prelims + 10% overhead = 1210

const PHASES = [
  { startOffset: 0, manualDays: 10, actual_start_date: "2026-01-05", actual_finish_date: "2026-01-20" },
  { startOffset: 14, calculatedDays: 6, actual_start_date: "2026-01-21", actual_finish_date: "2026-01-30" },
];

const FULL: ArchiveSnapshotInputs = {
  programmePhases: PHASES,
  expenses: ok([{ amount: "400.50" }, { amount: 567.5 }]),
  invoices: ok([
    { amount: "700", status: "Paid", retention_held: "35.00" },
    { amount: 300.25, status: "Sent", retention_held: 0 },
  ]),
  variations: ok([
    { amount: "100.10", status: "Approved" },
    { amount: 50, status: "Rejected" },
  ]),
  finalAccount: ok({ agreed_amount: "1300.00", status: "Agreed" }),
  estimate: ok(ESTIMATE),
};

const build = (over: Partial<ArchiveSnapshotInputs> = {}) => buildArchiveSnapshotFigures({ ...FULL, ...over });

describe("buildArchiveSnapshotFigures — measured data", () => {
  it("measures every figure, including decimal strings from Supabase", () => {
    const f = build();
    expect(f.contract_value).toBe(1210);
    expect(f.total_costs_posted).toBe(968);
    expect(f.gross_margin_pct).toBeCloseTo(20, 6);
    expect(f.total_invoiced).toBe(1000.25);
    expect(f.total_paid).toBe(700);
    expect(f.retention_outstanding).toBe(35);
    expect(f.final_account_amount).toBe(1300);
    expect(f.final_account_status).toBe("Agreed");
    expect(f.variation_count).toBe(2);
    expect(f.approved_variation_total).toBe(100.1);
  });

  it("derives programme spans from the phases", () => {
    const f = build();
    expect(f.planned_duration_days).toBe(20); // max(0+10, 14+6)
    expect(f.actual_duration_days).toBe(25); // 5 Jan → 30 Jan
    expect(f.programme_delay_days).toBe(5);
  });

  it("keeps the late-days clamp: an early finish persists 0 late days", () => {
    const f = build({
      programmePhases: [
        { startOffset: 0, manualDays: 20, actual_start_date: "2026-01-05", actual_finish_date: "2026-01-15" },
      ],
    });
    expect(f.planned_duration_days).toBe(20);
    expect(f.actual_duration_days).toBe(10);
    expect(f.programme_delay_days).toBe(0);
  });
});

describe("buildArchiveSnapshotFigures — genuine empty totals stay measured zeroes", () => {
  it("successful empty reads total 0, not null", () => {
    const f = build({ expenses: ok([]), invoices: ok([]), variations: ok([]) });
    expect(f.total_costs_posted).toBe(0);
    expect(f.total_invoiced).toBe(0);
    expect(f.total_paid).toBe(0);
    expect(f.retention_outstanding).toBe(0);
    expect(f.variation_count).toBe(0);
    expect(f.approved_variation_total).toBe(0);
    // zero costs against a real contract value is a real 100% margin
    expect(f.gross_margin_pct).toBe(100);
  });

  it("a measured zero-value invoice / retention stays 0", () => {
    const f = build({ invoices: ok([{ amount: "0.00", status: "Draft", retention_held: "0.00" }]) });
    expect(f.total_invoiced).toBe(0);
    expect(f.retention_outstanding).toBe(0);
  });

  it("a zero-duration planned programme is a measured 0", () => {
    const f = build({ programmePhases: [{ startOffset: 0, manualDays: 0 }] });
    expect(f.planned_duration_days).toBe(0);
  });

  it("an estimate that really totals 0 keeps contract_value 0 but has no margin to report", () => {
    const f = build({
      estimate: ok({ total_cost: 0, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, estimate_lines: [] }),
    });
    expect(f.contract_value).toBe(0);
    expect(f.gross_margin_pct).toBeNull();
  });
});

describe("buildArchiveSnapshotFigures — unavailable data is null, never a fabricated zero", () => {
  it("no active estimate → no contract value and no margin", () => {
    const f = build({ estimate: ok(null as never) });
    expect(f.contract_value).toBeNull();
    expect(f.gross_margin_pct).toBeNull();
    expect(f.total_costs_posted).toBe(968); // unrelated figures are unaffected
  });

  it("failed estimate read → no contract value and no margin", () => {
    const f = build({ estimate: failed });
    expect(f.contract_value).toBeNull();
    expect(f.gross_margin_pct).toBeNull();
  });

  it("estimate whose lines did not load → no contract value (cannot split prelims)", () => {
    const { estimate_lines: _lines, ...withoutLines } = ESTIMATE;
    expect(build({ estimate: ok(withoutLines) }).contract_value).toBeNull();
  });

  it("failed expenses read → no costs and no margin", () => {
    const f = build({ expenses: failed });
    expect(f.total_costs_posted).toBeNull();
    expect(f.gross_margin_pct).toBeNull();
    expect(f.contract_value).toBe(1210);
  });

  it("an unmeasurable expense amount does not produce a partial total", () => {
    const f = build({ expenses: ok([{ amount: 100 }, { amount: null }]) });
    expect(f.total_costs_posted).toBeNull();
    expect(f.gross_margin_pct).toBeNull();
  });

  it("failed invoices read → no invoice figures", () => {
    const f = build({ invoices: failed });
    expect(f.total_invoiced).toBeNull();
    expect(f.total_paid).toBeNull();
    expect(f.retention_outstanding).toBeNull();
  });

  it("an invoice with no stated retention does not make retention 0", () => {
    const f = build({ invoices: ok([{ amount: 100, status: "Paid", retention_held: null }]) });
    expect(f.total_invoiced).toBe(100);
    expect(f.retention_outstanding).toBeNull();
  });

  it("failed variations read → no count and no approved total", () => {
    const f = build({ variations: failed });
    expect(f.variation_count).toBeNull();
    expect(f.approved_variation_total).toBeNull();
  });

  it("failed final account read → no amount or status", () => {
    const f = build({ finalAccount: failed });
    expect(f.final_account_amount).toBeNull();
    expect(f.final_account_status).toBeNull();
  });

  it("no programme phases → no durations or delay", () => {
    for (const programmePhases of [null, undefined, [], "not-an-array"]) {
      const f = build({ programmePhases });
      expect(f.planned_duration_days).toBeNull();
      expect(f.actual_duration_days).toBeNull();
      expect(f.programme_delay_days).toBeNull();
    }
  });

  it("phases without actual dates → planned only, actual and delay unavailable", () => {
    const f = build({ programmePhases: [{ startOffset: 0, manualDays: 10 }] });
    expect(f.planned_duration_days).toBe(10);
    expect(f.actual_duration_days).toBeNull();
    expect(f.programme_delay_days).toBeNull();
  });

  it("a phase missing its actual finish makes the actual span unavailable (no partial span)", () => {
    const f = build({
      programmePhases: [PHASES[0], { startOffset: 14, calculatedDays: 6, actual_start_date: "2026-01-21" }],
    });
    expect(f.planned_duration_days).toBe(20);
    expect(f.actual_duration_days).toBeNull();
    expect(f.programme_delay_days).toBeNull();
  });

  it("invalid or reversed actual dates are unavailable, not 0 or NaN", () => {
    for (const bad of [
      { actual_start_date: "garbage", actual_finish_date: "2026-01-20" },
      { actual_start_date: "2026-01-20", actual_finish_date: "2026-01-05" },
    ]) {
      const f = build({ programmePhases: [{ startOffset: 0, manualDays: 10, ...bad }] });
      expect(f.actual_duration_days).toBeNull();
      expect(f.programme_delay_days).toBeNull();
    }
  });

  it("a phase with no offset or duration does not become a guessed 0 planned span", () => {
    expect(build({ programmePhases: [{ manualDays: 10 }] }).planned_duration_days).toBeNull();
    expect(build({ programmePhases: [{ startOffset: 0 }] }).planned_duration_days).toBeNull();
  });
});

describe("archive actions wiring", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/projects/archive/actions.ts"), "utf8");

  it("builds the snapshot through the truthful builder and keeps related read errors", () => {
    expect(source).toContain("buildArchiveSnapshotFigures(");
    expect(source).toContain("...figures");
    expect(source).not.toContain("data: expenses");
    expect(source).not.toContain("data: invoices");
    expect(source).not.toContain("data: variations");
    expect(source).not.toContain("data: estimate");
  });

  it("no longer zero-fills the snapshot", () => {
    expect(source).not.toContain("computeContractSumValue");
    expect(source).not.toMatch(/\?\? 0/);
    expect(source).not.toContain(": 0;");
  });
});
