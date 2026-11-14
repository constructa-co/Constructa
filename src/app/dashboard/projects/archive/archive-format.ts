// Archive snapshot formatting + KPI roll-ups.
//
// A null / undefined / unparseable figure means "not loaded" and is never shown
// as £0, 0% or "On time" — the tile is dropped instead. A real 0 is a measured
// value and is always kept (e.g. £0 retention outstanding, 0 days delay).
//
// Supabase can hand NUMERIC columns back as decimal strings ("1250.50"), so a
// valid decimal string is a measured figure, not a missing one.

export type NumericLike = number | string | null;

export interface ArchiveSnapshotFigures {
  contract_value: NumericLike;
  total_costs_posted: NumericLike;
  gross_margin_pct: NumericLike;
  total_invoiced: NumericLike;
  total_paid: NumericLike;
  retention_outstanding: NumericLike;
  final_account_amount: NumericLike;
  final_account_status: string | null;
  planned_duration_days: NumericLike;
  actual_duration_days: NumericLike;
  /**
   * Persisted as days LATE: the archive write clamps at 0, so 0 means "not
   * late" (on time or early) and cannot say which. Negative values are only
   * ever an unambiguous early finish.
   */
  programme_delay_days: NumericLike;
  variation_count: NumericLike;
  approved_variation_total: NumericLike;
}

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** The finite number behind a number / decimal string, or null when there is none. */
export function toMeasured(n: unknown): number | null {
  if (typeof n === "number") return Number.isFinite(n) ? n : null;
  if (typeof n === "string") {
    const trimmed = n.trim();
    if (!DECIMAL.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isMeasured(n: unknown): boolean {
  return toMeasured(n) !== null;
}

export function gbp(n: unknown): string {
  const value = toMeasured(n);
  if (value === null) return "—";
  return "£" + value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function pct(n: unknown): string {
  const value = toMeasured(n);
  if (value === null) return "—";
  return value.toFixed(1) + "%";
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
  return snaps.map((s) => toMeasured(s?.[key])).filter((v): v is number => v !== null);
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
  const money = (key: FinancialTileKey, label: string, n: NumericLike) => {
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

/**
 * Programme rows that were actually recorded. The persisted delay is days late
 * (clamped at 0 on write), so it is shown as "Days late": a stored 0 is a real
 * "0d" late, not a claim of "On time" — it may equally be an early finish.
 */
export function programmeRows(snap: ArchiveSnapshotFigures): DetailRow[] {
  const rows: DetailRow[] = [];
  const planned = toMeasured(snap.planned_duration_days);
  if (planned !== null) {
    rows.push({ label: "Planned duration", value: `${planned}d`, tone: "neutral" });
  }
  const actual = toMeasured(snap.actual_duration_days);
  if (actual !== null) {
    rows.push({ label: "Actual duration", value: `${actual}d`, tone: "neutral" });
  }
  const delay = toMeasured(snap.programme_delay_days);
  if (delay !== null) {
    if (delay < 0) {
      // Only a signed value can say this unambiguously.
      rows.push({ label: "Days early", value: `${Math.abs(delay)}d`, tone: "ok" });
    } else {
      rows.push({ label: "Days late", value: `${delay}d`, tone: delay > 0 ? "late" : "ok" });
    }
  }
  return rows;
}

/** Variation rows that were actually recorded. A count of 0 is a measured zero. */
export function variationRows(snap: ArchiveSnapshotFigures): DetailRow[] {
  const rows: DetailRow[] = [];
  const count = toMeasured(snap.variation_count);
  if (count !== null) {
    rows.push({ label: "Total raised", value: String(count), tone: "neutral" });
  }
  if (isMeasured(snap.approved_variation_total)) {
    rows.push({ label: "Approved value", value: gbp(snap.approved_variation_total), tone: "neutral" });
  }
  return rows;
}
