"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createEstimateAction(projectId: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("estimates")
        .insert({
            project_id: projectId,
            version_name: name,
            overhead_pct: 10,
            profit_pct: 15,
            risk_pct: 0,
            is_active: false,
        })
        .select()
        .single();

    if (error) console.error("Create estimate error:", error);
    revalidatePath("/dashboard/projects/costs");
    return data;
}

export async function updateEstimateMarginsAction(
    estimateId: string,
    overhead: number,
    profit: number,
    risk: number,
    prelims: number = 0
) {
    const supabase = createClient();
    const { error } = await supabase
        .from("estimates")
        .update({
            overhead_pct: overhead,
            profit_pct: profit,
            risk_pct: risk,
            prelims_pct: prelims,
        })
        .eq("id", estimateId);

    if (error) console.error("Update margins error:", error);
    revalidatePath("/dashboard/projects/costs");
}

export async function updateEstimateNameAction(estimateId: string, name: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from("estimates")
        .update({ version_name: name })
        .eq("id", estimateId);

    if (error) console.error("Update estimate name error:", error);
    revalidatePath("/dashboard/projects/costs");
}

export async function addLineItemAction(
    estimateId: string,
    tradeSection: string,
    data: {
        description: string;
        quantity: number;
        unit: string;
        unit_rate: number;
        line_type?: string;
        cost_library_item_id?: string | null;
        mom_item_code?: string | null;
        notes?: string | null;
    }
) {
    const supabase = createClient();
    const line_total = data.quantity * data.unit_rate;

    const { data: result, error } = await supabase
        .from("estimate_lines")
        .insert({
            estimate_id: estimateId,
            trade_section: tradeSection,
            description: data.description,
            quantity: data.quantity,
            unit: data.unit,
            unit_rate: data.unit_rate,
            line_total,
            line_type: data.line_type || "general",
            cost_library_item_id: data.cost_library_item_id || null,
            mom_item_code: data.mom_item_code || null,
            notes: data.notes || null,
        })
        .select()
        .single();

    if (error) console.error("Add line error:", error);

    // Update estimate total_cost
    await recalcEstimateTotal(estimateId);
    revalidatePath("/dashboard/projects/costs");
    return result;
}

export async function updateLineItemAction(
    lineId: string,
    data: {
        description?: string;
        quantity?: number;
        unit?: string;
        unit_rate?: number;
        trade_section?: string;
        line_type?: string;
        mom_item_code?: string | null;
        notes?: string | null;
    }
) {
    const supabase = createClient();

    const updateData: Record<string, unknown> = { ...data };
    if (data.quantity !== undefined && data.unit_rate !== undefined) {
        updateData.line_total = data.quantity * data.unit_rate;
    }

    const { data: line, error } = await supabase
        .from("estimate_lines")
        .update(updateData)
        .eq("id", lineId)
        .select("estimate_id")
        .single();

    if (error) console.error("Update line error:", error);

    if (line?.estimate_id) {
        await recalcEstimateTotal(line.estimate_id);
    }
    revalidatePath("/dashboard/projects/costs");
}

export async function deleteLineItemAction(lineId: string) {
    const supabase = createClient();

    // Get estimate_id before deleting
    const { data: line } = await supabase
        .from("estimate_lines")
        .select("estimate_id")
        .eq("id", lineId)
        .single();

    const { error } = await supabase
        .from("estimate_lines")
        .delete()
        .eq("id", lineId);

    if (error) console.error("Delete line error:", error);

    if (line?.estimate_id) {
        await recalcEstimateTotal(line.estimate_id);
    }
    revalidatePath("/dashboard/projects/costs");
}

export async function setActiveEstimateAction(estimateId: string, projectId: string) {
    const supabase = createClient();

    // Unmark all other estimates for this project
    await supabase
        .from("estimates")
        .update({ is_active: false })
        .eq("project_id", projectId);

    // Mark the selected one
    const { error } = await supabase
        .from("estimates")
        .update({ is_active: true })
        .eq("id", estimateId);

    if (error) console.error("Set active error:", error);
    revalidatePath("/dashboard/projects/costs");
}

export async function deleteEstimateAction(estimateId: string) {
    const supabase = createClient();

    // Lines cascade-delete if FK is set, but let's be safe
    await supabase
        .from("estimate_lines")
        .delete()
        .eq("estimate_id", estimateId);

    const { error } = await supabase
        .from("estimates")
        .delete()
        .eq("id", estimateId);

    if (error) console.error("Delete estimate error:", error);
    revalidatePath("/dashboard/projects/costs");
}

async function recalcEstimateTotal(estimateId: string) {
    const supabase = createClient();
    const { data: lines } = await supabase
        .from("estimate_lines")
        .select("line_total")
        .eq("estimate_id", estimateId);

    const total = (lines || []).reduce((sum, l) => sum + (l.line_total || 0), 0);

    await supabase
        .from("estimates")
        .update({ total_cost: total })
        .eq("id", estimateId);
}
