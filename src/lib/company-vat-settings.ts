/**
 * CON-018 — company-level VAT registration, default rate and reverse-charge default.
 *
 * Deploy safety: new profile columns stay off until migration is applied and
 * CONSTRUCTA_PROFILE_VAT_SETTINGS=1 is set at deploy time.
 */

export const PROFILE_VAT_SETTINGS_ENV = "CONSTRUCTA_PROFILE_VAT_SETTINGS";

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

/** Proposal VAT from project override and optional company defaults. */
export function vatFromCompanyAndProject(
    project: { is_vat_reverse_charge?: boolean | null },
    profile?: ProfileVatFields | null,
    env: NodeJS.ProcessEnv = process.env,
): { vatRate: number; vatTreatment: "standard" | "domestic_reverse_charge" } {
    if (project.is_vat_reverse_charge === true) {
        return { vatRate: 0, vatTreatment: "domestic_reverse_charge" };
    }
    if (isProfileVatSettingsEnabled(env) && profile?.vat_registered === false) {
        return { vatRate: 0, vatTreatment: "standard" };
    }
    const rate = isProfileVatSettingsEnabled(env) && profile?.default_vat_rate != null
        ? Number(profile.default_vat_rate)
        : 20;
    return { vatRate: Number.isFinite(rate) ? Math.max(0, Math.min(100, rate)) : 20, vatTreatment: "standard" };
}