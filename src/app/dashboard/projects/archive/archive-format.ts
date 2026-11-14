// Archive snapshot formatting + KPI roll-ups.
//
// A null / undefined / non-finite figure means "not loaded" and is never shown
// as £0, 0% or "On time" — the tile is dropped instead. A real 0 is a measured
// value and is always kept (e.g. £0 retention outstanding, 0 days delay).

export interface ArchiveSnapshotFigures {
  contract_value: number | null;
  total_costs_posted: number | null;
  gross_margin_pct: number | null;
  total_invoiced: number | null;
  total_paid: number | null;
  retention_outstanding: number | null;
  final_account_amount: number | null;
  final_account_status: string | null;
  planned_duration_days: number | null;
  actual_duration_days: number | null;
  programme_delay_days: number | null;
  variation_count: number | null;
  approved_variation_total: number | null;
}

export function isMeasured(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function gbp(n: number | null | undefined): string {
  if (!isMeasured(n)) return "—";
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function pct(n: number | null | undefined): string {
  if (!isMeasured(n)) return "—";
  return n.toFixed(1) + "%";
}

// ── KPI strip ──────────────────────────────────────────────────────────────────

export interface ArchiveKpis {
  totalContractValue: number | null;
  avgMargin: number | null;
  totalRetention: number | null;
}

type KpiSource = Pick<ArchiveSnapshotFigures, "contract_value" | "gross_margin_pct" | "retention_outstanding">;

function measuredValues(
  snaps: ReadonlyArray<KpiSource | null | undefined>,
  key: keyof KpiSource,
): number[] {
  return snaps.map((s) => s?.[key]).filter(isMeasured);
}

const sum = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((total, v) => total + v, 0);

/**
 * Roll up the latest snapshot of each archived project. Only measured figures
 * contribute: a project with no snapshot (or a null column) neither adds a
 * phantom 0 to a total nor drags the margin average down. A rollup with nothing
 * measured is null so the card can be omitted rather than showing £0 / 0.0%.
 */
export function summariseArchive(
  snaps: ReadonlyArray<KpiSource | null | undefined>,
): ArchiveKpis {
  const margins = measuredValues(snaps, "gross_margin_pct");
  return {
    totalContractValue: sum(measuredValues(snaps, "contract_value")),
    avgMargin: margins.length === 0 ? null : margins.reduce((t, v) => t + v, 0) / margins.length,
    totalRetention: sum(measuredValues(snaps, "retention_outstanding")),
  };
}

// ── Expanded detail ────────────────────────────────────────────────────────────

export type FinancialTileKey =
  | "contract_value"
  | "costs"
  | "margin"
  | "invoiced"
  | "paid"
  | "retention"
  | "final_account"
  | "fa_status";

export interface FinancialTile {
  key: FinancialTileKey;
  label: string;
  value: string;
}

/** Financial Outcome tiles that have real data behind them, in display order. */
export function financialTiles(snap: ArchiveSnapshotFigures): FinancialTile[] {
  const tiles: FinancialTile[] = [];
  const money = (key: FinancialTileKey, label: string, n: number | null) => {
    if (isMeasured(n)) tiles.push({ key, label, value: gbp(n) });
  };
  money("contract_value", "Contract Value", snap.contract_value);
  money("costs", "Costs Posted", snap.total_costs_posted);
  if (isMeasured(snap.gross_margin_pct)) {
    tiles.push({ key: "margin", label: "Gross Margin", value: pct(snap.gross_margin_pct) });
  }
  money("invoiced", "Total Invoiced", snap.total_invoiced);
  money("paid", "Total Paid", snap.total_paid);
  money("retention", "Retention O/S", snap.retention_outstanding);
  money("final_account", "Final Account", snap.final_account_amount);
  if (snap.final_account_status) {
    tiles.push({ key: "fa_status", label: "FA Status", value: snap.final_account_status });
  }
  return tiles;
}

export type RowTone = "neutral" | "late" | "ok";

export interface DetailRow {
  label: string;
  value: string;
  tone: RowTone;
}

/** Programme rows that were actually recorded. Delay 0 is a measured "On time". */
export function programmeRows(snap: ArchiveSnapshotFigures): DetailRow[] {
  const rows: DetailRow[] = [];
  if (isMeasured(snap.planned_duration_days)) {
    rows.push({ label: "Planned duration", value: `${snap.planned_duration_days}d`, tone: "neutral" });
  }
  if (isMeasured(snap.actual_duration_days)) {
    rows.push({ label: "Actual duration", value: `${snap.actual_duration_days}d`, tone: "neutral" });
  }
  const delay = snap.programme_delay_days;
  if (isMeasured(delay)) {
    rows.push({
      label: "Programme delay",
      value: delay > 0 ? `+${delay}d` : delay < 0 ? `${Math.abs(delay)}d early` : "On time",
      tone: delay > 0 ? "late" : "ok",
    });
  }
  return rows;
}

/** Variation rows that were actually recorded. A count of 0 is a measured zero. */
export function variationRows(snap: ArchiveSnapshotFigures): DetailRow[] {
  const rows: DetailRow[] = [];
  if (isMeasured(snap.variation_count)) {
    rows.push({ label: "Total raised", value: String(snap.variation_count), tone: "neutral" });
  }
  if (isMeasured(snap.approved_variation_total)) {
    rows.push({ label: "Approved value", value: gbp(snap.approved_variation_total), tone: "neutral" });
  }
  return rows;
}
