/** PostgREST / Postgres codes when interview tables or RPCs are not applied yet. */
const INTERVIEW_STORAGE_MISSING = new Set(["PGRST205", "42P01", "PGRST202", "42883"]);

export function isInterviewStorageMissing(error: { code?: string } | null | undefined): boolean {
    const code = error?.code;
    return typeof code === "string" && INTERVIEW_STORAGE_MISSING.has(code);
}