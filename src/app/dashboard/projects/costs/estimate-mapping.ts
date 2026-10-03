import type { Estimate, EstimateLine } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Database row → the line shape the estimating screens use. */
export function toEstimateLine(row: any): EstimateLine {
    return {
        ...row,
        pricing_mode: row.pricing_mode || "simple",
        estimate_line_components: row.estimate_line_components || [],
    };
}

/** Database row → the estimate shape the estimating screens use. */
export function toEstimate(row: any): Estimate {
    return {
        ...row,
        estimate_lines: (row.estimate_lines || []).map(toEstimateLine),
        overhead_pct: row.overhead_pct ?? 10,
        profit_pct: row.profit_pct ?? 15,
        risk_pct: row.risk_pct ?? 0,
        prelims_pct: row.prelims_pct ?? 0,
        discount_pct: row.discount_pct ?? 0,
        discount_reason: row.discount_reason ?? "",
        total_cost: row.total_cost ?? 0,
        is_active: row.is_active ?? false,
    };
}
