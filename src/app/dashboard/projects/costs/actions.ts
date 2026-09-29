"use server";

import {
    getActiveOrganizationId,
    requireAuth,
} from "@/lib/supabase/auth-utils";
import {
    requireEditableProjectAccess,
    requireEstimateAccess,
    requireEstimateComponentAccess,
    requireEstimateLineAccess,
} from "@/lib/supabase/project-resource-access";
import { revalidatePath } from "next/cache";

// P1-3 — Estimate immutability after project goes live.
//
// Once a project moves past proposal acceptance, the estimate that
// backs the signed contract sum is the "original contract sum" and
// must not mutate. Any scope change goes through Variations. This
// helper is the single source of truth for the lock check — every
// mutating action in this file calls it before touching the DB.

async function assertEstimateEditable(
    estimateId: string,
): Promise<
    | ({ ok: true } & Awaited<ReturnType<typeof requireEstimateAccess>>)
    | { ok: false; error: string }
> {
    let access: Awaited<ReturnType<typeof requireEstimateAccess>>;
    try {
        access = await requireEstimateAccess(estimateId);
    } catch {
        return { ok: false, error: "Estimate not found or unauthorized" };
    }

    try {
        const editableAccess = await requireEditableProjectAccess(access.projectId);
        return { ok: true, ...access, ...editableAccess };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Estimate is locked" };
    }
}

export async function createEstimateAction(projectId: string, name: string) {
    const { supabase } = await requireEditableProjectAccess(projectId);
    const { data, error } = await supabase
        .from("estimates")
        .insert({
            project_id: projectId,
            version_name: name,
            overhead_pct: 10,
            profit_pct: 15,
            risk_pct: 0,
            prelims_pct: 10,
            is_active: false,
        })
        .select()
        .single();

    if (error) console.error("Create estimate error:", error);

    // Auto-advance: Lead → Estimating when first estimate is created
    const { data: proj } = await supabase
        .from("projects")
        .select("status")
        .eq("id", projectId)
        .single();
    if (proj?.status === "Lead" || proj?.status === null) {
        await supabase
            .from("projects")
            .update({ status: "Estimating" })
            .eq("id", projectId);
        revalidatePath("/dashboard");
    }

    return data;
}

export async function updateEstimateMarginsAction(
    estimateId: string,
    overhead: number,
    profit: number,
    risk: number,
    prelims: number = 0
): Promise<{ success: boolean; error?: string }> {
    // P1-3 — refuse to mutate margins on a locked (active/closed) project.
    const lock = await assertEstimateEditable(estimateId);
    if (!lock.ok) return { success: false, error: lock.error };

    const { error } = await lock.supabase
        .from("estimates")
        .update({
            overhead_pct: overhead,
            profit_pct: profit,
            risk_pct: risk,
            prelims_pct: prelims,
        })
        .eq("id", estimateId);

    if (error) {
        console.error("[updateEstimateMarginsAction] failed", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function updateEstimateNameAction(estimateId: string, name: string) {
    const lock = await assertEstimateEditable(estimateId);
    if (!lock.ok) throw new Error(lock.error);
    const { error } = await lock.supabase
        .from("estimates")
        .update({ version_name: name })
        .eq("id", estimateId);

    if (error) console.error("Update estimate name error:", error);
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
): Promise<{ id: string; error?: undefined } | { id?: undefined; error: string }> {
    // E2E-P0-4 — previously this action silently swallowed errors and
    // returned undefined, so a user with a misconfigured estimate or an
    // RLS denial saw a soft failure with no indication. Antigravity
    // reported a 500 in the field; without server-side logging we could
    // never have reproduced it. Now every failure logs with context and
    // returns a structured error for the client to surface.
    try {
        // P1-3 — lock check before mutation.
        const lock = await assertEstimateEditable(estimateId);
        if (!lock.ok) return { error: lock.error };

        // Defensive numeric coercion in case a stringy NaN made it past
        // the client (React uncontrolled inputs + locale parsing).
        const qty = Number(data.quantity);
        const rate = Number(data.unit_rate);
        if (!Number.isFinite(qty) || !Number.isFinite(rate)) {
            return { error: "Quantity and rate must be numbers" };
        }
        const line_total = qty * rate;

        const { data: result, error } = await lock.supabase
            .from("estimate_lines")
            .insert({
                estimate_id: estimateId,
                trade_section: tradeSection,
                description: data.description,
                quantity: qty,
                unit: data.unit,
                unit_rate: rate,
                line_total,
                line_type: data.line_type || "general",
                cost_library_item_id: data.cost_library_item_id || null,
                mom_item_code: data.mom_item_code || null,
                notes: data.notes || null,
            })
            .select("id")
            .single();

        if (error) {
            console.error("[addLineItemAction] insert failed", {
                estimateId,
                tradeSection,
                description: data.description,
                error: error.message,
                code: error.code,
                details: error.details,
            });
            return { error: error.message };
        }

        // Recalc total — if this fails it's not fatal; the line is saved.
        try {
            await recalcEstimateTotal(lock.supabase, estimateId);
        } catch (recalcErr) {
            console.error("[addLineItemAction] recalc failed (line still saved)", recalcErr);
        }

        if (!result?.id) {
            return { error: "Insert succeeded but no id was returned" };
        }
        return { id: result.id };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add line";
        console.error("[addLineItemAction] unexpected failure", err);
        return { error: message };
    }
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
): Promise<{ success: boolean; error?: string }> {
    let lineAccess: Awaited<ReturnType<typeof requireEstimateLineAccess>>;
    try {
        lineAccess = await requireEstimateLineAccess(lineId);
    } catch {
        return { success: false, error: "Line not found or unauthorized" };
    }
    const lock = await assertEstimateEditable(lineAccess.estimateId);
    if (!lock.ok) return { success: false, error: lock.error };

    const updateData: Record<string, unknown> = { ...data };
    if (data.quantity !== undefined && data.unit_rate !== undefined) {
        updateData.line_total = data.quantity * data.unit_rate;
    }

    const { error } = await lock.supabase
        .from("estimate_lines")
        .update(updateData)
        .eq("id", lineId)
        .eq("estimate_id", lineAccess.estimateId);

    if (error) {
        console.error("[updateLineItemAction] failed", error);
        return { success: false, error: error.message };
    }

    await recalcEstimateTotal(lock.supabase, lineAccess.estimateId).catch((e) =>
        console.error("[updateLineItemAction] recalc failed", e),
    );
    return { success: true };
}

export async function deleteLineItemAction(
    lineId: string,
): Promise<{ success: boolean; error?: string }> {
    let lineAccess: Awaited<ReturnType<typeof requireEstimateLineAccess>>;
    try {
        lineAccess = await requireEstimateLineAccess(lineId);
    } catch {
        return { success: false, error: "Line not found or unauthorized" };
    }
    const lock = await assertEstimateEditable(lineAccess.estimateId);
    if (!lock.ok) return { success: false, error: lock.error };

    const { error } = await lock.supabase
        .from("estimate_lines")
        .delete()
        .eq("id", lineId)
        .eq("estimate_id", lineAccess.estimateId);

    if (error) {
        console.error("[deleteLineItemAction] failed", error);
        return { success: false, error: error.message };
    }

    await recalcEstimateTotal(lock.supabase, lineAccess.estimateId).catch((e) =>
        console.error("[deleteLineItemAction] recalc failed", e),
    );
    return { success: true };
}

export async function setActiveEstimateAction(estimateId: string, projectId: string) {
    const lock = await assertEstimateEditable(estimateId);
    if (!lock.ok) throw new Error(lock.error);
    if (lock.projectId !== projectId) throw new Error("Estimate does not belong to this project.");

    // Unmark all other estimates for this project
    const { error: clearError } = await lock.supabase
        .from("estimates")
        .update({ is_active: false })
        .eq("project_id", projectId);
    if (clearError) throw new Error(clearError.message);

    // Mark the selected one
    const { error } = await lock.supabase
        .from("estimates")
        .update({ is_active: true })
        .eq("id", estimateId)
        .eq("project_id", projectId);

    if (error) throw new Error(error.message);
}

export async function deleteEstimateAction(estimateId: string) {
    const lock = await assertEstimateEditable(estimateId);
    if (!lock.ok) throw new Error(lock.error);

    // Lines cascade-delete if FK is set, but let's be safe
    const { error: lineError } = await lock.supabase
        .from("estimate_lines")
        .delete()
        .eq("estimate_id", estimateId);
    if (lineError) throw new Error(lineError.message);

    const { error } = await lock.supabase
        .from("estimates")
        .delete()
        .eq("id", estimateId)
        .eq("project_id", lock.projectId);

    if (error) throw new Error(error.message);
}

// ─── Component CRUD (Rate Build-Up) ─────────────────────

export async function addComponentAction(
    lineId: string,
    data: {
        component_type: string;
        description: string;
        quantity: number;
        unit: string;
        unit_rate: number;
        manhours_per_unit: number;
        sort_order: number;
    }
): Promise<{ id: string; line_total: number; total_manhours: number } | null> {
    let lineAccess: Awaited<ReturnType<typeof requireEstimateLineAccess>>;
    try {
        lineAccess = await requireEstimateLineAccess(lineId);
    } catch (error) {
        console.error("addComponentAction: cannot access estimate line", lineId, error);
        return null;
    }
    const lock = await assertEstimateEditable(lineAccess.estimateId);
    if (!lock.ok) return null;

    const { data: result, error } = await lock.supabase
        .from("estimate_line_components")
        .insert({ estimate_line_id: lineId, ...data })
        .select("id, line_total, total_manhours")
        .single();
    if (error) { console.error("addComponentAction: insert failed", error); return null; }
    return result;
}

export async function updateComponentAction(
    componentId: string,
    data: Partial<{
        description: string;
        quantity: number;
        unit: string;
        unit_rate: number;
        manhours_per_unit: number;
    }>
): Promise<void> {
    const access = await requireEstimateComponentAccess(componentId);
    const lock = await assertEstimateEditable(access.estimateId);
    if (!lock.ok) throw new Error(lock.error);
    const { error } = await lock.supabase
        .from("estimate_line_components")
        .update(data)
        .eq("id", componentId)
        .eq("estimate_line_id", access.lineId);
    if (error) throw new Error(error.message);
}

export async function deleteComponentAction(componentId: string): Promise<void> {
    const access = await requireEstimateComponentAccess(componentId);
    const lock = await assertEstimateEditable(access.estimateId);
    if (!lock.ok) throw new Error(lock.error);
    const { error } = await lock.supabase
        .from("estimate_line_components")
        .delete()
        .eq("id", componentId)
        .eq("estimate_line_id", access.lineId);
    if (error) throw new Error(error.message);
}

export async function setPricingModeAction(lineId: string, mode: "simple" | "buildup"): Promise<void> {
    const access = await requireEstimateLineAccess(lineId);
    const lock = await assertEstimateEditable(access.estimateId);
    if (!lock.ok) throw new Error(lock.error);
    const { error } = await lock.supabase
        .from("estimate_lines")
        .update({ pricing_mode: mode })
        .eq("id", lineId)
        .eq("estimate_id", access.estimateId);
    if (error) throw new Error(error.message);
}

export async function saveRateBuildupAction(
    orgId: string,
    name: string,
    unit: string,
    tradeSection: string,
    components: { type: string; description: string; quantity: number; unit: string; unit_rate: number; manhours_per_unit: number }[],
    builtUpRate: number,
    totalManhoursPerUnit: number
): Promise<void> {
    const activeOrgId = await getActiveOrganizationId();
    if (activeOrgId !== orgId) {
        throw new Error("Unauthorized organization access.");
    }
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("rate_buildups").insert({
        organization_id: orgId,
        name,
        unit,
        trade_section: tradeSection,
        components,
        built_up_rate: builtUpRate,
        total_manhours_per_unit: totalManhoursPerUnit,
        is_system_default: false,
    });
    if (error) throw new Error(error.message);
}

export async function updateLineBuiltUpRateAction(lineId: string, builtUpRate: number): Promise<void> {
    const access = await requireEstimateLineAccess(lineId);
    const lock = await assertEstimateEditable(access.estimateId);
    if (!lock.ok) throw new Error(lock.error);
    const { data: line } = await lock.supabase
        .from("estimate_lines")
        .select("quantity, estimate_id")
        .eq("id", lineId)
        .eq("estimate_id", access.estimateId)
        .single();
    const qty = line?.quantity || 1;
    const { error } = await lock.supabase.from("estimate_lines").update({
        unit_rate: builtUpRate,
        line_total: qty * builtUpRate,
    }).eq("id", lineId).eq("estimate_id", access.estimateId);
    if (error) throw new Error(error.message);
    if (line?.estimate_id) {
        await recalcEstimateTotal(lock.supabase, line.estimate_id);
    }
}

export async function saveDiscountAction(
    estimateId: string,
    discountPct: number,
    discountReason: string
): Promise<{ success: boolean; error?: string }> {
    // P1-3 — discount changes the contract sum, so must be locked after
    // acceptance.
    const lock = await assertEstimateEditable(estimateId);
    if (!lock.ok) return { success: false, error: lock.error };

    const { error } = await lock.supabase
        .from("estimates")
        .update({ discount_pct: discountPct, discount_reason: discountReason })
        .eq("id", estimateId);
    if (error) {
        console.error("[saveDiscountAction] failed", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

async function recalcEstimateTotal(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    estimateId: string,
) {
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
