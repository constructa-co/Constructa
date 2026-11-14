// Builds the figures written to archive_snapshots.
//
// Every column is nullable, so a figure that could not be measured is written
// as null — never as a fabricated 0. A real zero only comes from a successful
// read that genuinely totals to zero (no expenses, no invoices, no variations)
// or from measured data that works out to zero.

import { computeContractSumValue } from "@/lib/financial";
import { toMeasured } from "./archive-format";

/** The shape of a Supabase query result, reduced to what the builder needs. */
export interface ReadResult<T> {
  data: T | null;
  error: unknown;
}

export interface ArchiveSnapshotInputs {
  programmePhases: unknown;
  expenses: ReadResult<Array<{ amount: unknown }>>;
  invoices: ReadResult<Array<{ amount: unknown; status: unknown; retention_held: unknown }>>;
  variations: ReadResult<Array<{ amount: unknown; status: unknown }>>;
  finalAccount: ReadResult<{ agreed_amount: unknown; status: unknown }>;
  estimate: ReadResult<Record<string, unknown> & { estimate_lines?: unknown }>;
}

export interface ArchiveSnapshotFiguresToWrite {
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

const roundMoney = (n: number) => Math.round(n * 100) / 100;

function rowsOf<T>(read: ReadResult<T[]>): T[] | null {
  if (read.error || !Array.isArray(read.data)) return null;
  return read.data;
}

/** Sum of measured values; null when any row is unmeasured (a partial sum would understate). */
function sumMeasured(values: unknown[]): number | null {
  let total = 0;
  for (const raw of values) {
    const n = toMeasured(raw);
    if (n === null) return null;
    total += n;
  }
  return roundMoney(total);
}

function parseDay(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Planned span and actual span in days. Each is null unless EVERY phase carries
 * the data for it: a partial maximum / min-max would understate the real span.
 * Phases are not guessed at (no offset or duration means unknown, not 0).
 */
function programmeDurations(phasesRaw: unknown): { planned: number | null; actual: number | null } {
  if (!Array.isArray(phasesRaw) || phasesRaw.length === 0) return { planned: null, actual: null };
  const phases = phasesRaw as Array<Record<string, unknown> | null>;

  let planned: number | null = 0;
  let starts: number[] | null = [];
  let ends: number[] | null = [];

  for (const phase of phases) {
    const offset = toMeasured(phase?.startOffset);
    const duration = toMeasured(phase?.manualDays) ?? toMeasured(phase?.calculatedDays);
    if (planned !== null) {
      planned =
        offset === null || duration === null || offset < 0 || duration < 0
          ? null
          : Math.max(planned, offset + duration);
    }

    const start = parseDay(phase?.actual_start_date);
    const finish = parseDay(phase?.actual_finish_date);
    if (starts !== null && ends !== null) {
      if (start === null || finish === null || finish < start) {
        starts = null;
        ends = null;
      } else {
        starts.push(start);
        ends.push(finish);
      }
    }
  }

  const actual =
    starts && ends ? Math.round((Math.max(...ends) - Math.min(...starts)) / MS_PER_DAY) : null;
  return { planned, actual };
}

export function buildArchiveSnapshotFigures(input: ArchiveSnapshotInputs): ArchiveSnapshotFiguresToWrite {
  // Costs
  const expenseRows = rowsOf(input.expenses);
  const totalCosts = expenseRows ? sumMeasured(expenseRows.map((e) => e.amount)) : null;

  // Invoices. Retention is only a total when every invoice states its own.
  const invoiceRows = rowsOf(input.invoices);
  const totalInvoiced = invoiceRows ? sumMeasured(invoiceRows.map((i) => i.amount)) : null;
  const totalPaid = invoiceRows
    ? sumMeasured(invoiceRows.filter((i) => i.status === "Paid").map((i) => i.amount))
    : null;
  const retentionOutstanding = invoiceRows ? sumMeasured(invoiceRows.map((i) => i.retention_held)) : null;

  // Variations
  const variationRows = rowsOf(input.variations);
  const variationCount = variationRows ? variationRows.length : null;
  const approvedVariationTotal = variationRows
    ? sumMeasured(variationRows.filter((v) => v.status === "Approved").map((v) => v.amount))
    : null;

  // Contract value: needs an active estimate whose lines were actually read.
  let contractValue: number | null = null;
  const estimate = input.estimate.error ? null : input.estimate.data;
  if (estimate && Array.isArray(estimate.estimate_lines)) {
    const computed = computeContractSumValue(estimate as any, estimate.estimate_lines as any);
    contractValue = Number.isFinite(computed) ? computed : null;
  }

  const grossMarginPct =
    contractValue !== null && contractValue > 0 && totalCosts !== null
      ? ((contractValue - totalCosts) / contractValue) * 100
      : null;

  const { planned, actual } = programmeDurations(input.programmePhases);
  // Persisted as days late, clamped at 0 (unchanged); unknown unless both spans are.
  const delay = planned !== null && actual !== null ? Math.max(0, actual - planned) : null;

  const finalAccount = input.finalAccount.error ? null : input.finalAccount.data;
  const finalStatus = typeof finalAccount?.status === "string" ? finalAccount.status : null;

  return {
    contract_value: contractValue,
    total_costs_posted: totalCosts,
    gross_margin_pct: grossMarginPct,
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    retention_outstanding: retentionOutstanding,
    final_account_amount: toMeasured(finalAccount?.agreed_amount),
    final_account_status: finalStatus,
    planned_duration_days: planned,
    actual_duration_days: actual,
    programme_delay_days: delay,
    variation_count: variationCount,
    approved_variation_total: approvedVariationTotal,
  };
}
