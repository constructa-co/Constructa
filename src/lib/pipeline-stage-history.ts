import type { SupabaseClient } from "@supabase/supabase-js";

/** Reserved for a future migration; writes are skipped when the relation is absent (schema gate). */
export const PIPELINE_STAGE_HISTORY_TABLE = "project_pipeline_stage_events";

export type PipelineStageHistoryAppend =
    | { recorded: true }
    | { recorded: false; schemaGate: true }
    | { recorded: false; schemaGate: false };

/**
 * Append an audit row when the table exists. Never throws — a missing table is an expected schema gate.
 */
export async function appendPipelineStageHistory(
    supabase: SupabaseClient,
    entry: {
        projectId: string;
        userId: string;
        fromStatus: string;
        toStatus: string;
    },
): Promise<PipelineStageHistoryAppend> {
    let error: { code?: string; message?: string } | null;
    try {
        ({ error } = await supabase.from(PIPELINE_STAGE_HISTORY_TABLE).insert({
            project_id: entry.projectId,
            user_id: entry.userId,
            from_status: entry.fromStatus,
            to_status: entry.toStatus,
        }));
    } catch {
        return { recorded: false, schemaGate: false };
    }
    if (!error) return { recorded: true };
    const code = error.code;
    const message = error.message ?? "";
    if (code === "42P01" || /does not exist|schema cache/i.test(message)) {
        return { recorded: false, schemaGate: true };
    }
    return { recorded: false, schemaGate: false };
}