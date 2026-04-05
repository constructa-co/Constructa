"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const COST_TYPES = ["labour", "materials", "plant", "subcontract", "overhead", "prelims", "other"] as const;
export type CostType = typeof COST_TYPES[number];

export const TRADE_SECTIONS = [
    "Preliminaries",
    "Groundworks",
    "Concrete",
    "Drainage",
    "Utilities",
    "Surfacing",
    "Masonry",
    "Carpentry",
    "Electrical",
    "Plumbing",
    "Finishes",
    "External Works",
    "Subcontract",
    "Provisional Sums",
    "General",
] as const;

// ── Log a new actual cost ──────────────────────────────────────────────────────
export async function logCostAction(data: {
    projectId: string;
    description: string;
    amount: number;
    cost_type: string;
    trade_section: string;
    expense_date: string;
    supplier?: string;
}): Promise<{ error?: string }> {
    try {
        const supabase = createClient();
        const { error } = await supabase.from("project_expenses").insert({
            project_id: data.projectId,
            description: data.description,
            amount: data.amount,
            cost_type: data.cost_type,
            trade_section: data.trade_section,
            expense_date: data.expense_date,
            supplier: data.supplier || null,
        });
        if (error) return { error: error.message };
        revalidatePath("/dashboard/projects/p-and-l");
        return {};
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
    }
}

// ── Delete an actual cost entry ────────────────────────────────────────────────
export async function deleteCostAction(id: string): Promise<void> {
    const supabase = createClient();
    await supabase.from("project_expenses").delete().eq("id", id);
    revalidatePath("/dashboard/projects/p-and-l");
}

// ── Update invoice status ──────────────────────────────────────────────────────
export async function updateInvoiceStatusAction(
    id: string,
    status: "Draft" | "Sent" | "Paid"
): Promise<void> {
    const supabase = createClient();
    await supabase.from("invoices").update({ status }).eq("id", id);
    revalidatePath("/dashboard/projects/p-and-l");
}
