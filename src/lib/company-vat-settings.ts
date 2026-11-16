/**
 * CON-018 — company-level VAT registration, default rate and reverse-charge default.
 *
 * Rollout order (both required):
 * 1. Operator applies migration `20261116103000_con018_profile_vat_settings.sql`
 * 2. Set `CONSTRUCTA_PROFILE_VAT_SETTINGS=1` at deploy time
 *
 * Until both are true, behaviour matches legacy contractors (20% standard on
 * proposals unless a job uses domestic reverse charge).
 */

export const PROFILE_VAT_SETTINGS_ENV = "CONSTRUCTA_PROFILE_VAT_SETTINGS";

/** Columns always safe to read on profiles for proposal publication. */
export const PROFILE_PUBLICATION_COLUMN_LIST = [
    "company_name",
    "logo_url",
    "phone",
    "website",
    "accreditations",
    "capability_statement",
    "years_trading",
    "specialisms",
    "insurance_details",
    "pdf_theme",
    "md_name",
    "md_message",
    "case_studies",
] as const;

const PROFILE_VAT_COLUMN_LIST = ["vat_registered", "default_vat_rate", "default_vat_reverse_charge"] as const;

/** PostgREST select list: VAT columns only when the deploy gate is on (after migration). */
export function profilePublicationSelectColumns(env: NodeJS.ProcessEnv = process.env): string {
    return [
        ...PROFILE_PUBLICATION_COLUMN_LIST,
        ...(isProfileVatSettingsEnabled(env) ? PROFILE_VAT_COLUMN_LIST : []),
    ].join(", ");
}

export const UK_VAT_RATE_OPTIONS = [0, 5, 20] as const;
export type UkVatRateOption = (typeof UK_VAT_RATE_OPTIONS)[number];

export function isProfileVatSettingsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[PROFILE_VAT_SETTINGS_ENV] === "1";
}

/** Trim and normalise a UK VAT number for storage; blank becomes null. */
export function normalizeVatNumber(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) return null;
    return trimmed.toUpperCase();
}

export function parseVatRegistered(raw: FormDataEntryValue | null): boolean {
    return raw === "true" || raw === "on";
}

export function parseDefaultVatRate(raw: FormDataEntryValue | null): UkVatRateOption {
    const n = raw == null || raw === "" ? 20 : Number(raw);
    if (n === 0 || n === 5) return n;
    return 20;
}

export function parseDefaultVatReverseCharge(raw: FormDataEntryValue | null): boolean {
    return raw === "true" || raw === "on";
}

export interface ProfileVatFields {
    vat_number?: string | null;
    vat_registered?: boolean | null;
    default_vat_rate?: number | null;
    default_vat_reverse_charge?: boolean | null;
}

const legacyStandardVat = () => ({ vatRate: 20, vatTreatment: "standard" as const });

function clampVatRate(rate: number): number {
    return Number.isFinite(rate) ? Math.max(0, Math.min(100, rate)) : 20;
}

/** Proposal VAT from project override and optional company defaults. */
export function vatFromCompanyAndProject(
    project: { is_vat_reverse_charge?: boolean | null },
    profile?: ProfileVatFields | null,
    env: NodeJS.ProcessEnv = process.env,
): { vatRate: number; vatTreatment: "standard" | "domestic_reverse_charge" } {
    if (project.is_vat_reverse_charge === true) {
        return { vatRate: 0, vatTreatment: "domestic_reverse_charge" };
    }
    if (!isProfileVatSettingsEnabled(env)) {
        return legacyStandardVat();
    }
    // Gate on but column absent / unread (pre-migration): preserve legacy 20%.
    if (profile?.vat_registered == null) {
        return legacyStandardVat();
    }
    if (profile.vat_registered === false) {
        return { vatRate: 0, vatTreatment: "standard" };
    }
    const rate = profile.default_vat_rate != null ? clampVatRate(Number(profile.default_vat_rate)) : 20;
    return { vatRate: rate, vatTreatment: "standard" };
}