import type { WorkspaceStyles } from "@/lib/workspace-styles";

export interface CompanyCredentialsSummaryProps {
    yearsTrading?: number | null;
    specialisms?: string | null;
    accreditations?: string | null;
    insuranceDetails?: string | null;
    styles: Pick<WorkspaceStyles, "body" | "muted">;
}

function hasSavedText(value: string | null | undefined): boolean {
    return Boolean(value?.trim());
}

/**
 * Read-only contractor credentials for proposal preparation review.
 * Shows only values already on the profile; no edits, actions or assurance claims.
 */
export default function CompanyCredentialsSummary({
    yearsTrading,
    specialisms,
    accreditations,
    insuranceDetails,
    styles: s,
}: CompanyCredentialsSummaryProps) {
    const items: Array<[string, string]> = [];

    if (typeof yearsTrading === "number" && yearsTrading > 0) {
        items.push(["Years trading", String(yearsTrading)]);
    }
    if (hasSavedText(specialisms)) items.push(["Specialisms", specialisms!]);
    if (hasSavedText(accreditations)) items.push(["Accreditations", accreditations!]);
    if (hasSavedText(insuranceDetails)) items.push(["Insurance", insuranceDetails!]);

    if (items.length === 0) return null;

    return (
        <dl className={`mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm ${s.body}`} data-company-credentials-summary>
            {items.map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <dt className={`font-semibold ${s.muted}`}>{label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words">{value}</dd>
                </div>
            ))}
        </dl>
    );
}
