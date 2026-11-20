/**
 * CON-017 — detect £ figures in proposal/brief wording that do not match the
 * canonical price the app shows (ex-VAT, inc-VAT, and published payment stages).
 */

import { roundMoney, toNumber } from "@/lib/financial";
import { formatGbp } from "@/lib/pdf/pdf-money";

const GBP_IN_TEXT = /£\s*([\d,]+(?:\.\d{1,2})?)/gi;

export interface FigureConsistencyWarning {
    /** Stable key for list rendering. */
    id: string;
    /** Figure exactly as parsed from text (formatted for display). */
    figure: string;
    amount: number;
    message: string;
}

export interface FigureConsistencyInput {
    wordingFields: string[];
    briefText?: string | null;
    contractSumExVat: number;
    contractSumIncVat: number;
    paymentAmounts?: number[];
}

function parseGbpAmounts(text: string): number[] {
    const amounts: number[] = [];
    for (const match of text.matchAll(GBP_IN_TEXT)) {
        const raw = match[1]?.replace(/,/g, "");
        if (!raw) continue;
        const n = toNumber(raw);
        if (n > 0) amounts.push(roundMoney(n));
    }
    return amounts;
}

function amountsAlign(stated: number, canonical: number): boolean {
    if (canonical <= 0) return false;
    const delta = Math.abs(stated - canonical);
    return delta < 0.02 || delta / canonical <= 0.005;
}

/**
 * Returns a warning for each distinct £ amount in proposal/brief text that does
 * not match any authoritative figure on this job.
 */
export function evaluateProposalFigureConsistency(input: FigureConsistencyInput): FigureConsistencyWarning[] {
    const canonical = [
        input.contractSumExVat,
        input.contractSumIncVat,
        ...(input.paymentAmounts ?? []).map(roundMoney),
    ].filter((n) => n > 0);

  const primary =
        input.contractSumIncVat > input.contractSumExVat && input.contractSumIncVat > 0
            ? input.contractSumIncVat
            : input.contractSumExVat;

    if (canonical.length === 0 || primary <= 0) return [];

    const texts = [...input.wordingFields, input.briefText ?? ""].filter((t) => t.trim().length > 0);
    const warnings: FigureConsistencyWarning[] = [];
    const seen = new Set<number>();

    for (const text of texts) {
        for (const amount of parseGbpAmounts(text)) {
            if (seen.has(amount)) continue;
            if (canonical.some((c) => amountsAlign(amount, c))) continue;
            seen.add(amount);
            const figure = formatGbp(amount);
            warnings.push({
                id: `figure-${amount}`,
                figure,
                amount,
                message: `${figure} appears in your brief or proposal wording but does not match the price here (${formatGbp(primary)}). Check the letter and the estimate agree before you send.`,
            });
        }
    }

    return warnings;
}