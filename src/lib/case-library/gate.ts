/**
 * The one switch for the case-study library. Read on the server only.
 *
 * Off (the default): no library page, action or read exists as far as a
 * contractor can tell, and every existing screen behaves as before. It is a
 * rollout gate. It is not a secret and it is not a product setting.
 *
 * One thing ignores it on purpose: a proposal's saved ticks are always
 * resolved through the shared resolver, so a library tick can never be
 * dropped quietly because the switch was turned off. See `resolve.ts`.
 */
export const CASE_LIBRARY_VARIABLE = "CONSTRUCTA_CASE_LIBRARY";

export function caseLibraryEnabled(source: Record<string, string | undefined> = process.env): boolean {
    return source[CASE_LIBRARY_VARIABLE] === "1";
}
