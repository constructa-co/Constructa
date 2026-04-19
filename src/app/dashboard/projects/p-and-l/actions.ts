"use server";

// Stage 4 hardening (19 Apr 2026): every project-scoped mutation runs through
// requireProjectAccess. deleteCostAction and updateInvoiceStatusAction receive
// only a row id (no projectId on the signature), so we look up the row's
// project_id server-side first, ownership-check it, then anchor the DELETE/
// UPDATE by both id and project_id. Callers are not changed.
import {
    requireAuth,
    requireProjectAccess,
} from "@/lib/supabase/auth-utils";
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
        const { supabase } = await requireProjectAccess(input.projectId);
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
        const { supabase } = await requireProjectAccess(input.projectId);
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
// Signature kept (only id in) so no caller ripple. We look up the owning
// project first and ownership-check that before deleting; the DELETE is then
// anchored by (id, project_id) so a spoofed cost id whose project is owned
// by another user cannot match.
export async function deleteCostAction(id: string): Promise<void> {
    const { supabase: rawSb } = await requireAuth();
    const { data: row } = await rawSb
        .from("project_expenses")
        .select("project_id")
        .eq("id", id)
        .single();
    if (!row?.project_id) return;
    const { supabase } = await requireProjectAccess(row.project_id);
    await supabase
        .from("project_expenses")
        .delete()
        .eq("id", id)
        .eq("project_id", row.project_id);
    revalidatePath("/dashboard/projects/p-and-l");
}

// ── Update invoice status ──────────────────────────────────────────────────────
// Signature kept. Same fetch-and-check pattern as deleteCostAction.
export async function updateInvoiceStatusAction(
    id: string,
    status: "Draft" | "Sent" | "Paid"
): Promise<void> {
    const { supabase: rawSb } = await requireAuth();
    const { data: row } = await rawSb
        .from("invoices")
        .select("project_id")
        .eq("id", id)
        .single();
    if (!row?.project_id) return;
    const { supabase } = await requireProjectAccess(row.project_id);
    await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id)
        .eq("project_id", row.project_id);
    revalidatePath("/dashboard/projects/p-and-l");
}
