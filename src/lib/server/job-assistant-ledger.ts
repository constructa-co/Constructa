import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UsageLedger } from "./job-assistant-generation";

/** The part of a Supabase client this ledger uses. Tests pass a fake. */
export type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

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
 * The service-role client is made only when a step runs.
 */
export function createRpcUsageLedger(client: () => RpcClient = createAdminClient): UsageLedger {
    const step = async (fn: string, args: Record<string, unknown>) => {
        const { data, error } = await client().rpc(fn, args);
        if (error || data !== true) throw new Error(`Job assistant ledger step ${fn} was not recorded`);
    };
    return {
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
