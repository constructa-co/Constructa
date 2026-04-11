/**
 * Constructa — PDF money formatting helpers.
 *
 * Sprint 58 Phase 3 item #3. Every PDF generator in the app used to
 * roll its own GBP formatter. Five different copies existed and they
 * disagreed on:
 *   - decimal places (some used 2, some used 0)
 *   - negative handling (some wrapped `(£1,200)`, some `-£1,200`, some emitted `£-1,200`)
 *   - negative-zero handling (none of them normalised `-0`, so PDFs occasionally printed `£-0.00`)
 *
 * This module is the single source of truth. Uses en-GB locale with
 * the £ sign built in via `style: "currency"`.
 */

// ── Normalisation helper ────────────────────────────────────────────────────

/**
 * Coerce a possibly-string Supabase numeric to a safe number. Matches the
 * `toNumber()` helper in src/lib/financial.ts so the two stay aligned.
 * Returns 0 for null, undefined, empty string, NaN, and Infinity.
 */
function normaliseAmount(v: number | string | null | undefined): number {
    if (v == null) return 0;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return 0;
    // Normalise -0 to 0 so PDFs never print "£-0.00".
    if (Object.is(n, -0)) return 0;
    return n;
}

// ── Core formatter ──────────────────────────────────────────────────────────

export interface GbpFormatOptions {
    /** Decimal places. Defaults to 2. */
    decimals?: number;
    /** Show "£" prefix. Defaults to true. Disable for table cells that already have a unit label. */
    symbol?: boolean;
}

/**
 * Standard UK pound formatter. Handles null/undefined/string/NaN/-0
 * gracefully. Never produces "£-0.00".
 */
export function formatGbp(
    value: number | string | null | undefined,
    options: GbpFormatOptions = {},
): string {
    const { decimals = 2, symbol = true } = options;
    const n = normaliseAmount(value);
    const body = n.toLocaleString("en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return symbol ? `£${body}` : body;
}

/**
 * Format a deduction in UK accounting style. Non-zero amounts are
 * wrapped in parentheses: "(£1,250.00)". Zero renders plain: "£0.00"
 * (so a PDF never advertises "(£0.00)" which reads as a loss to any
 * skim-reader).
 */
export function formatDeduction(
    value: number | string | null | undefined,
    options: GbpFormatOptions = {},
): string {
    const n = normaliseAmount(value);
    if (n > 0) return `(${formatGbp(n, options)})`;
    return formatGbp(0, options);
}

/**
 * Format a signed amount as "+£1,250.00" / "-£900.00" / "£0.00".
 * Useful for variation schedules and P&L variance rows.
 */
export function formatSignedGbp(
    value: number | string | null | undefined,
    options: GbpFormatOptions = {},
): string {
    const n = normaliseAmount(value);
    if (n > 0) return `+${formatGbp(n, options)}`;
    if (n < 0) return `-${formatGbp(Math.abs(n), options)}`;
    return formatGbp(0, options);
}

/**
 * Short-form for dashboards and cards: "£1.2m", "£45k", "£2,300".
 * Not for documents sent to clients — use `formatGbp` there.
 */
export function formatGbpShort(value: number | string | null | undefined): string {
    const n = normaliseAmount(value);
    if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
    if (Math.abs(n) >= 1_000)     return `£${Math.round(n / 1_000)}k`;
    return `£${Math.round(n).toLocaleString("en-GB")}`;
}
