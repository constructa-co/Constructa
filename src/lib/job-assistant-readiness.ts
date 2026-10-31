/**
 * A055/A063 why a job assistant is off, in words safe to show its job's owner.
 *
 * The server names a prerequisite by code only; every word shown comes from
 * this table, so no key, project, provider or database text can reach a page.
 * `not_approved` has no words of its own: an environment with no approval
 * (Production today) keeps each feature's existing "isn't switched on" text.
 * No imports: the server and the panels both use this.
 */
export type JobAssistantOffReason =
    | "emergency_stop" | "not_approved" | "approval_mismatch" | "provider_unavailable"
    | "ledger_not_installed" | "ledger_disabled" | "ledger_limits" | "ledger_unreadable" | "check_failed";

const EXPLAINED: Record<Exclude<JobAssistantOffReason, "not_approved">, { label: string; detail: string }> = {
    emergency_stop: { label: "AI is paused", detail: "AI replies are paused on this server." },
    approval_mismatch: { label: "approved limits disagree", detail: "The approved spending limits for the job assistants do not match." },
    provider_unavailable: { label: "AI provider not connected", detail: "The approved AI provider is not connected on this deployment." },
    ledger_not_installed: { label: "usage ledger not installed", detail: "The usage ledger is not installed on this deployment's database." },
    ledger_disabled: { label: "usage ledger switched off", detail: "The usage ledger is installed but switched off." },
    ledger_limits: { label: "usage ledger limits too low", detail: "The usage ledger's limits do not cover the approved spending limits." },
    ledger_unreadable: { label: "usage ledger could not be checked", detail: "The usage ledger could not be checked." },
    check_failed: { label: "readiness check did not finish", detail: "The readiness check did not finish." },
};

const explained = (reason?: JobAssistantOffReason | null) => reason && reason !== "not_approved" ? EXPLAINED[reason] : undefined;

/** The short note beside "Not enabled", or null when there is nothing more to say. */
export function assistantOffLabel(reason?: JobAssistantOffReason | null): string | null {
    return explained(reason)?.label ?? null;
}

/** The feature's own off text, led by the missing prerequisite when there is one. */
export function explainAssistantOff(off: string, reason?: JobAssistantOffReason | null): string {
    const detail = explained(reason)?.detail;
    return detail ? `${detail} ${off}` : off;
}
