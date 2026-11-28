/**
 * Live Projects figures (D124 N2.5).
 *
 * A failed read is not the same as an empty one. Each secondary source (cost
 * entries, invoices, variations) is passed in as `null` when it could not be
 * loaded, and every figure that depends on it comes back `null` as well, so
 * the screen can say "Unavailable" rather than show a healthy-looking £0.
 *
 * The contract value and budget come from the estimate, which the page treats
 * as critical: if the project or its estimates cannot be read, the page throws
 * to the dashboard error boundary instead of showing anything.
 */

export interface LiveExpense { amount: number | string | null }
export interface LiveInvoice { amount: number | string | null; status?: string | null }
export interface LiveVariation { amount: number | string | null; status?: string | null }

/** Which secondary sources could not be loaded. */
export interface LiveUnavailable {
    costs: boolean;
    invoices: boolean;
    variations: boolean;
}

export const NONE_UNAVAILABLE: LiveUnavailable = { costs: false, invoices: false, variations: false };

export interface LiveFigures {
    contractValue: number;
    budgetCost: number;
    estimatedMarginPct: number;
    /** Null when cost entries could not be loaded. */
    costsPosted: number | null;
    budgetBurnPct: number | null;
    /** Null when invoices could not be loaded. */
    invoicedTotal: number | null;
    receivedTotal: number | null;
    outstanding: number | null;
    /** Null when variations could not be loaded. */
    approvedVariations: number | null;
    revisedValue: number | null;
    /** Null when invoices or variations could not be loaded. */
    completionPct: number | null;
    /** Null when activity cannot be known because a source could not be loaded and none was found. */
    hasActivity: boolean | null;
}

const sum = (rows: readonly { amount: number | string | null }[]) => rows.reduce((total, row) => total + Number(row.amount), 0);

export function liveFigures(input: {
    contractValue: number;
    budgetCost: number;
    expenses: readonly LiveExpense[] | null;
    invoices: readonly LiveInvoice[] | null;
    variations: readonly LiveVariation[] | null;
}): LiveFigures {
    const { contractValue, budgetCost, expenses, invoices, variations } = input;

    const costsPosted = expenses ? sum(expenses) : null;
    const invoicedTotal = invoices ? sum(invoices) : null;
    const receivedTotal = invoices ? sum(invoices.filter((invoice) => invoice.status === "Paid")) : null;
    const approvedVariations = variations ? sum(variations.filter((variation) => variation.status === "Approved")) : null;
    const revisedValue = approvedVariations === null ? null : contractValue + approvedVariations;

    const knownActivity = (costsPosted ?? 0) > 0 || (invoicedTotal ?? 0) > 0 || (variations?.length ?? 0) > 0;
    const anyUnavailable = expenses === null || invoices === null || variations === null;

    return {
        contractValue,
        budgetCost,
        estimatedMarginPct: contractValue > 0 ? ((contractValue - budgetCost) / contractValue) * 100 : 0,
        costsPosted,
        budgetBurnPct: costsPosted === null ? null : budgetCost > 0 ? Math.min((costsPosted / budgetCost) * 100, 150) : 0,
        invoicedTotal,
        receivedTotal,
        outstanding: invoicedTotal === null || receivedTotal === null ? null : invoicedTotal - receivedTotal,
        approvedVariations,
        revisedValue,
        completionPct: invoicedTotal === null || revisedValue === null ? null : revisedValue > 0 ? Math.min((invoicedTotal / revisedValue) * 100, 100) : 0,
        hasActivity: knownActivity ? true : anyUnavailable ? null : false,
    };
}

/** Plain list of what could not be loaded, for the warning banner. */
export function unavailableLabels(unavailable: LiveUnavailable): string[] {
    return [
        unavailable.costs ? "cost entries" : null,
        unavailable.invoices ? "invoices" : null,
        unavailable.variations ? "variations" : null,
    ].filter((label): label is string => label !== null);
}

/** Sum of the known values, or null when any of them is unknown. */
export function totalOrUnavailable(values: readonly (number | null)[]): number | null {
    let total = 0;
    for (const value of values) {
        if (value === null) return null;
        total += value;
    }
    return total;
}
