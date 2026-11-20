/**
 * Case-study contract value helpers (CON-064).
 *
 * A past job's value can be held two ways on the older case-study record:
 * the long-standing free-text `contractValue` (printed back as typed when it
 * is not a plain figure), or a numeric `contractValueAmount` with an explicit
 * VAT basis, printed exactly like the proposal's other figures. Old free text
 * is never rewritten; the numeric form is used only when it was saved.
 */

import { formatGbp } from "@/lib/pdf/pdf-money";

export const CONTRACT_VALUE_VAT_BASES = ["ex_vat", "inc_vat"] as const;
export type ContractValueVatBasis = (typeof CONTRACT_VALUE_VAT_BASES)[number];

/** A stored VAT basis, or null when it is not one of the two known values. */
export function contractValueVatBasis(value: unknown): ContractValueVatBasis | null {
    return (CONTRACT_VALUE_VAT_BASES as readonly unknown[]).includes(value) ? value as ContractValueVatBasis : null;
}

/**
 * A figure typed for a past job as a number, when it is only digits with an
 * optional single decimal point (a leading £, commas and spaces are ignored).
 * Anything else — "about £85k", "TBC", an empty box — is not a number: null.
 */
export function typedValueAmount(value: string): number | null {
    const cleaned = value.replace(/[£,\s]/g, "");
    if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : null;
}

/**
 * A stored numeric contract value, printed like the proposal's other figures.
 * A basis that is not one of the two known values prints with no basis words:
 * "ex VAT" is never assumed, so a stored record cannot put a VAT claim the
 * contractor never made onto a client proposal.
 */
export function formatContractValue(amount: number, basis: ContractValueVatBasis | null | undefined): string {
    const basisWords = basis === "inc_vat" ? " inc VAT" : basis === "ex_vat" ? " ex VAT" : "";
    return `${formatGbp(amount)}${basisWords}`;
}
