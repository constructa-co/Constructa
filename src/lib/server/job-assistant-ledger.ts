import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { JobAssistantGenerationConfig, UsageLedger } from "./job-assistant-generation";

/** The part of a Supabase client this ledger uses. Tests pass a fake. */
export type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
/** The one read the readiness check makes. Tests pass a fake. */
export type SettingsClient = {
    from: (table: string) => { select: (columns: string) => { eq: (column: string, value: unknown) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
};

type LedgerCaps = Pick<JobAssistantGenerationConfig, "attemptPence" | "perJobPence" | "monthlyPence">;
/** What the settings row says about an approved configuration. Only "ready" admits it. */
export type LedgerReadiness = "ready" | "not_installed" | "disabled" | "limits" | "unreadable";

/** A usage ledger that can also say, without writing, whether it would accept an approved configuration's caps. */
export interface ActivationLedger extends UsageLedger {
    covers(config: LedgerCaps): Promise<boolean>;
    /** The answer `covers` gives, with which part of the settings refused. */
    assess?(config: LedgerCaps): Promise<LedgerReadiness>;
}

const whole = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
// PostgREST and Postgres ways of saying the settings table does not exist.
const NO_TABLE = new Set(["PGRST205", "42P01"]);

/**
 * A055/A063 usage ledger over the `job_assistant_*` functions in
 * `supabase/migrations/20261028233000_job_assistant_usage_ledger.sql` (source
 * only: NOT applied anywhere, and disabled in the database when it is).
 *
 * Reserve is atomic in the database across all three features: one combined
 * per-job cap and one combined service-wide monthly cap. Every other step
 * moves one attempt through its states exactly once; anything else (an error,
 * an attempt not in the expected state, an unexpected answer) throws, so the
 * seam refuses the reply. A reservation the database refuses, including a
 * repeated attempt id, is `{ ok: false }`, so nothing is sent again.
 * `covers` reads the settings row only: true when it is enabled with ceilings
 * that admit the configuration, which is what reserve itself checks first. It
 * is a readiness hint; reserve still decides every attempt. `assess` is the same
 * single read, naming the refusal as a code: database text never leaves here.
 * The service-role client is made only when a step runs.
 */
// Narrowed to the two calls above; comparing the full Supabase client type against them is too deep for TypeScript.
const adminClient = () => createAdminClient() as unknown as RpcClient & SettingsClient;

export function createRpcUsageLedger(client: () => RpcClient & Partial<SettingsClient> = adminClient): ActivationLedger {
    const step = async (fn: string, args: Record<string, unknown>) => {
        const { data, error } = await client().rpc(fn, args);
        if (error || data !== true) throw new Error(`Job assistant ledger step ${fn} was not recorded`);
    };
    const assess = async (config: LedgerCaps): Promise<LedgerReadiness> => {
        try {
            const db = client();
            if (typeof db.from !== "function") return "unreadable";
            const { data, error } = await db.from("job_assistant_usage_settings")
                .select("enabled, max_attempt_pence, max_per_job_pence, max_monthly_pence").eq("id", 1).maybeSingle();
            if (error) return NO_TABLE.has((error as { code?: string }).code ?? "") ? "not_installed" : "unreadable";
            if (data === null || data === undefined) return "not_installed";
            const row = data as Record<string, unknown>;
            if (row.enabled !== true) return "disabled";
            return whole(row.max_attempt_pence) && config.attemptPence <= row.max_attempt_pence
                && whole(row.max_per_job_pence) && config.perJobPence <= row.max_per_job_pence
                && whole(row.max_monthly_pence) && config.monthlyPence <= row.max_monthly_pence ? "ready" : "limits";
        } catch {
            return "unreadable";
        }
    };
    return {
        assess,
        covers: async config => await assess(config) === "ready",
        async reserve(r) {
            const { data, error } = await client().rpc("job_assistant_reserve", {
                p_attempt_id: r.attemptId, p_user_id: r.userId, p_project_id: r.projectId, p_feature: r.feature,
                p_revision: r.revision, p_provider: r.provider, p_model: r.model, p_approval_ref: r.approvalRef,
                p_pence: r.pence, p_per_job_cap_pence: r.caps.perJobPence, p_monthly_cap_pence: r.caps.monthlyPence,
            });
            if (error) throw new Error("Job assistant reservation failed");
            return { ok: !!data && typeof data === "object" && (data as { status?: unknown }).status === "reserved" };
        },
        settle: (attemptId, pence) => step("job_assistant_settle", { p_attempt_id: attemptId, p_charged_pence: pence }),
        release: attemptId => step("job_assistant_release", { p_attempt_id: attemptId }),
        retain: (attemptId, reason) => step("job_assistant_retain", { p_attempt_id: attemptId, p_reason: reason }),
        conclude: (attemptId, outcome) => step("job_assistant_conclude", { p_attempt_id: attemptId, p_outcome: outcome }),
    };
}
