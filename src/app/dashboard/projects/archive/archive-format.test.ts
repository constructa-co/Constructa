import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  financialTiles,
  gbp,
  pct,
  programmeRows,
  summariseArchive,
  variationRows,
  type ArchiveSnapshotFigures,
} from "./archive-format";

const EMPTY: ArchiveSnapshotFigures = {
  contract_value: null,
  total_costs_posted: null,
  gross_margin_pct: null,
  total_invoiced: null,
  total_paid: null,
  retention_outstanding: null,
  final_account_amount: null,
  final_account_status: null,
  planned_duration_days: null,
  actual_duration_days: null,
  programme_delay_days: null,
  variation_count: null,
  approved_variation_total: null,
};

const snap = (over: Partial<ArchiveSnapshotFigures>): ArchiveSnapshotFigures => ({ ...EMPTY, ...over });

describe("archive formatters", () => {
  it("gbp shows no figure for missing data but keeps a measured zero", () => {
    expect(gbp(null)).toBe("—");
    expect(gbp(undefined)).toBe("—");
    expect(gbp(Number.NaN)).toBe("—");
    expect(gbp(0)).toBe("£0");
    expect(gbp(12345)).toBe("£12,345");
  });

  it("pct shows no figure for missing data but keeps a measured 0.0%", () => {
    expect(pct(null)).toBe("—");
    expect(pct(undefined)).toBe("—");
    expect(pct(0)).toBe("0.0%");
    expect(pct(12.34)).toBe("12.3%");
  });
});

describe("summariseArchive", () => {
  it("is all null when nothing is measured (no snapshots / null columns)", () => {
    expect(summariseArchive([])).toEqual({ totalContractValue: null, avgMargin: null, totalRetention: null });
    expect(summariseArchive([undefined, null, EMPTY])).toEqual({
      totalContractValue: null,
      avgMargin: null,
      totalRetention: null,
    });
  });

  it("averages margin over measured projects only, not over every project", () => {
    const kpis = summariseArchive([
      snap({ gross_margin_pct: 20 }),
      snap({ gross_margin_pct: 10 }),
      undefined, // project with no snapshot
      EMPTY, // snapshot with no margin
    ]);
    expect(kpis.avgMargin).toBe(15);
  });

  it("keeps a measured 0% margin in the average", () => {
    expect(summariseArchive([snap({ gross_margin_pct: 0 }), snap({ gross_margin_pct: 10 })]).avgMargin).toBe(5);
    expect(summariseArchive([snap({ gross_margin_pct: 0 })]).avgMargin).toBe(0);
  });

  it("sums only measured values and reports a measured zero total as 0, not null", () => {
    const kpis = summariseArchive([
      snap({ contract_value: 1000, retention_outstanding: 0 }),
      snap({ contract_value: 500, retention_outstanding: 0 }),
      undefined,
    ]);
    expect(kpis.totalContractValue).toBe(1500);
    expect(kpis.totalRetention).toBe(0);
  });
});

describe("financialTiles", () => {
  it("returns no tiles for an unloaded snapshot", () => {
    expect(financialTiles(EMPTY)).toEqual([]);
  });

  it("drops unloaded tiles and keeps measured zeroes", () => {
    const tiles = financialTiles(
      snap({ contract_value: 50000, retention_outstanding: 0, total_paid: 0, final_account_status: "Agreed" }),
    );
    expect(tiles.map((t) => [t.key, t.value])).toEqual([
      ["contract_value", "£50,000"],
      ["paid", "£0"],
      ["retention", "£0"],
      ["fa_status", "Agreed"],
    ]);
  });

  it("keeps a measured 0% margin tile", () => {
    expect(financialTiles(snap({ gross_margin_pct: 0 }))).toEqual([
      { key: "margin", label: "Gross Margin", value: "0.0%" },
    ]);
  });
});

describe("programmeRows", () => {
  it("does not claim 'On time' when delay was never measured", () => {
    expect(programmeRows(EMPTY)).toEqual([]);
    expect(programmeRows(snap({ planned_duration_days: 30 })).map((r) => r.label)).toEqual(["Planned duration"]);
  });

  it("reports a measured zero delay as On time", () => {
    expect(programmeRows(snap({ programme_delay_days: 0 }))).toEqual([
      { label: "Programme delay", value: "On time", tone: "ok" },
    ]);
  });

  it("formats late and early delays without a '+-' artefact", () => {
    expect(programmeRows(snap({ programme_delay_days: 4 }))[0]).toMatchObject({ value: "+4d", tone: "late" });
    expect(programmeRows(snap({ programme_delay_days: -3 }))[0]).toMatchObject({ value: "3d early", tone: "ok" });
  });

  it("keeps a measured zero-day duration", () => {
    expect(programmeRows(snap({ actual_duration_days: 0 }))).toEqual([
      { label: "Actual duration", value: "0d", tone: "neutral" },
    ]);
  });
});

describe("variationRows", () => {
  it("does not invent a zero count when none was recorded", () => {
    expect(variationRows(EMPTY)).toEqual([]);
  });

  it("keeps a measured zero count and zero approved value", () => {
    expect(variationRows(snap({ variation_count: 0, approved_variation_total: 0 }))).toEqual([
      { label: "Total raised", value: "0", tone: "neutral" },
      { label: "Approved value", value: "£0", tone: "neutral" },
    ]);
  });
});

describe("legacy resources hub", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/resources/client-page.tsx"), "utf8");

  it("only shows the overtime rate when one was loaded (the add action never saves it)", () => {
    expect(source).toContain('typeof item.overtime_rate === "number" &&');
    expect(source).not.toContain("overtime_rate?.toFixed");
  });
});

describe("archive-client wiring", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/projects/archive/archive-client.tsx"), "utf8");

  it("uses the shared formatters instead of local null-collapsing copies", () => {
    expect(source).toContain('from "./archive-format"');
    expect(source).not.toMatch(/function gbp\(/);
    expect(source).not.toMatch(/function pct\(/);
  });

  it("no longer zero-fills or truthy-gates archive figures", () => {
    expect(source).not.toContain("projects.reduce("); // roll-ups live in summariseArchive
    expect(source).not.toContain("gross_margin_pct ?? 0");
    expect(source).not.toContain("variation_count ?? 0");
    expect(source).not.toContain('"On time"');
    expect(source).not.toMatch(/final_account_amount \? gbp/);
  });

  it("omits KPI cards that have no backing data", () => {
    expect(source).toContain("totalContractValue != null &&");
    expect(source).toContain("avgMargin != null &&");
  });
});
