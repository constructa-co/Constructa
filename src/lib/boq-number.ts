/** Shared number handling for client BoQ imports (deterministic CSV and AI rows). */

export type BoQNumberCell = { value: number | null; malformed: boolean };

/**
 * Reads a quantity/rate/total cell. Blank and "-" are "not provided"; plain
 * numbers (with thousands commas) read as before; currency-formatted cells such
 * as "£18.50" or "£ 1,250.00" are read rather than flagged. Anything else is
 * malformed — never guessed.
 */
export function parseBoQNumberCell(raw: string | undefined | null): BoQNumberCell {
    const text = (raw ?? "").trim();
    if (!text || text === "-") return { value: null, malformed: false };

    const plain = Number(text.replace(/,/g, ""));
    if (Number.isFinite(plain)) return { value: plain, malformed: false };

    const withoutCurrency = text.replace(/^(-?)\s*[£$€]\s*/, "$1").replace(/[,\s]/g, "");
    if (withoutCurrency === text.replace(/[,\s]/g, "")) return { value: null, malformed: true };
    // "£" or "£ -" is an empty accounting-format cell, not a number.
    if (!withoutCurrency || withoutCurrency === "-") return { value: null, malformed: false };
    const value = Number(withoutCurrency);
    return Number.isFinite(value) ? { value, malformed: false } : { value: null, malformed: true };
}

export type BoQTotalMismatch = { stated: number; computed: number };

/**
 * Every other estimate write stores line_total = quantity × unit_rate. A stated
 * total that disagrees by more than a penny is not stored: the line keeps the
 * computed total and the stated figure is reported back for the preview.
 * Without both a quantity and a rate there is nothing to reconcile against.
 */
export function reconcileBoQLineTotal(
    quantity: number | null,
    unitRate: number,
    stated: number | null,
): { line_total: number; total_mismatch?: BoQTotalMismatch } {
    if (quantity === null || !unitRate) return { line_total: stated ?? 0 };
    const computed = quantity * unitRate;
    if (stated === null) return { line_total: computed };
    if (Math.abs(Math.round(stated * 100) - Math.round(computed * 100)) <= 1) return { line_total: stated };
    return { line_total: computed, total_mismatch: { stated, computed } };
}
