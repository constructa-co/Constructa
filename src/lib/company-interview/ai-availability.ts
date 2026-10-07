/**
 * Whether AI wording is on offer for the interview, so the screen knows
 * whether to show its controls. Reading this is not a provider call and does
 * not touch the budget's ledger: it reads one settings row.
 *
 * It is deliberately separate from `ai-wording.ts` and from the budget
 * wrapper, so the page that loads the interview imports nothing that can
 * reach the provider. The answer here is only a hint for the screen. Whether
 * a call may really be made is decided by the database when one is reserved.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** The same emergency stop the budget wrapper honours. It can only switch AI off. */
function stopped(): boolean {
    const value = (process.env.CONSTRUCTA_AI_DISABLED ?? "").trim().toLowerCase();
    return value !== "" && value !== "0" && value !== "false";
}

export async function aiWordingOffered(admin: Pick<SupabaseClient, "from">): Promise<boolean> {
    if (stopped()) return false;
    try {
        const { data, error } = await admin
            .from("ai_generation_features")
            .select("enabled")
            .eq("feature", "company.introduction")
            .maybeSingle();
        return !error && (data as { enabled?: boolean } | null)?.enabled === true;
    } catch {
        return false;
    }
}
