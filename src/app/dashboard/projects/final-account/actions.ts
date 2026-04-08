"use server";

import { createClient } from "@/lib/supabase/server";
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
    const supabase = createClient();
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
    const supabase = createClient();
    const { error } = await supabase.from("final_account_adjustments").insert([data]);
    if (error) throw new Error(error.message);
    revalidate(data.project_id);
}

export async function deleteAdjustmentAction(id: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("final_account_adjustments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}
