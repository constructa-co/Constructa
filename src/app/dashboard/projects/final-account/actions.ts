"use server";

// Stage 4 hardening (19 Apr 2026): every project-scoped mutation runs
// through requireProjectAccess(projectId). deleteAdjustmentAction takes only
// an adjustment id plus projectId so we ownership-check the projectId and
// then anchor the DELETE by both id AND project_id.
import { requireProjectAccess } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

function revalidate(projectId: string) {
    revalidatePath(`/dashboard/projects/final-account?projectId=${projectId}`);
}

// ── Final Account record ──────────────────────────────────────────────────────

export async function upsertFinalAccountAction(projectId: string, data: {
    status?: string;
    agreed_amount?: number | null;
    disputed_amount?: number;
    dispute_notes?: string;
    agreed_date?: string;
    signed_date?: string;
    agreement_reference?: string;
    notes?: string;
}) {
    const { supabase } = await requireProjectAccess(projectId);
    const { error } = await supabase
        .from("final_accounts")
        .upsert([{ project_id: projectId, ...data, updated_at: new Date().toISOString() }], { onConflict: "project_id" });
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

// ── Adjustments ───────────────────────────────────────────────────────────────

export async function createAdjustmentAction(data: {
    project_id: string;
    description: string;
    type: "Addition" | "Deduction";
    amount: number;
    notes?: string;
    order_index: number;
}) {
    const { supabase } = await requireProjectAccess(data.project_id);
    const { error } = await supabase.from("final_account_adjustments").insert([data]);
    if (error) throw new Error(error.message);
    revalidate(data.project_id);
}

export async function deleteAdjustmentAction(id: string, projectId: string) {
    const { supabase } = await requireProjectAccess(projectId);
    const { error } = await supabase
        .from("final_account_adjustments")
        .delete()
        .eq("id", id)
        .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}
