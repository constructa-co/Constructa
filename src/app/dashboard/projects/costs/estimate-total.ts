import type { requireAuth } from "@/lib/supabase/auth-utils";

type ServerSupabase = Awaited<ReturnType<typeof requireAuth>>["supabase"];

/** Refreshes the stored `estimates.total_cost` from the estimate's lines. */
export async function recalcEstimateTotal(supabase: ServerSupabase, estimateId: string) {
    const { data: lines, error: linesError } = await supabase
        .from("estimate_lines")
        .select("line_total")
        .eq("estimate_id", estimateId);
    if (linesError) throw new Error(linesError.message);

    const total = (lines || []).reduce((sum, l) => sum + (l.line_total || 0), 0);

    const { error: updateError } = await supabase
        .from("estimates")
        .update({ total_cost: total })
        .eq("id", estimateId);
    if (updateError) throw new Error(updateError.message);
}
