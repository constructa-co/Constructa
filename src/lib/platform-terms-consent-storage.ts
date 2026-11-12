// A023 — consent-table readiness adapter (migration not applied yet).
//
// The platform_terms_acceptances migration is drafted in the repo only;
// deployed databases may not have the table until Rob approves and applies
// it. PostgREST/Postgres codes that mean “relation missing” are treated as
// not_installed so signup and completion flows can rely on auth user
// metadata until durable storage exists.

/** PostgREST schema-cache miss and Postgres undefined_table. */
export const PLATFORM_TERMS_CONSENT_TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);

export function isPlatformTermsConsentTableMissing(error: unknown): boolean {
    const code = typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    return PLATFORM_TERMS_CONSENT_TABLE_MISSING_CODES.has(code);
}
