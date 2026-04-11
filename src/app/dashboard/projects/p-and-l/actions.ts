"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import {
    LogCostSchema,
    SectionForecastSchema,
    parseInput,
} from "@/lib/validation/schemas";

// ── Log a new actual cost ──────────────────────────────────────────────────────
export async function logCostAction(data: {
    projectId: string;
    description: string;
    amount: number;
    cost_type: string;
    trade_section: string;
    expense_date: string;
    supplier?: string;
    estimate_line_id?: string;
    receipt_url?: string;
    cost_status?: "actual" | "committed";
}): Promise<{ error?: string }> {
    try {
        const input = parseInput(LogCostSchema, data, "cost entry");
        const { supabase } = await requireAuth();
        const { error } = await supabase.from("project_expenses").insert({
            project_id: input.projectId,
            description: input.description,
            amount: input.amount,
            cost_type: input.cost_type,
            trade_section: input.trade_section,
            expense_date: input.expense_date,
            supplier: input.supplier || null,
            estimate_line_id: input.estimate_line_id || null,
            receipt_url: input.receipt_url || null,
            cost_status: input.cost_status ?? "actual",
        });
        if (error) return { error: error.message };
        revalidatePath("/dashboard/projects/p-and-l");
        return {};
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
    }
}

// ── Upsert a per-section forecast override ─────────────────────────────────────
export async function upsertSectionForecastAction(
    projectId: string,
    tradeSection: string,
    forecastCost: number | null
): Promise<{ error?: string }> {
    try {
        const input = parseInput(
            SectionForecastSchema,
            { projectId, tradeSection, forecastCost },
            "forecast override"
        );
        const { supabase } = await requireAuth();
        const { error } = await supabase
            .from("project_section_forecasts")
            .upsert(
                { project_id: input.projectId, trade_section: input.tradeSection, forecast_cost: input.forecastCost, updated_at: new Date().toISOString() },
                { onConflict: "project_id,trade_section" }
            );
        if (error) return { error: error.message };
        revalidatePath("/dashboard/projects/p-and-l");
        return {};
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
    }
}

// ── Delete an actual cost entry ────────────────────────────────────────────────
export async function deleteCostAction(id: string): Promise<void> {
    const { supabase } = await requireAuth();
    await supabase.from("project_expenses").delete().eq("id", id);
    revalidatePath("/dashboard/projects/p-and-l");
}

// ── Update invoice status ──────────────────────────────────────────────────────
export async function updateInvoiceStatusAction(
    id: string,
    status: "Draft" | "Sent" | "Paid"
): Promise<void> {
    const { supabase } = await requireAuth();
    await supabase.from("invoices").update({ status }).eq("id", id);
    revalidatePath("/dashboard/projects/p-and-l");
}
