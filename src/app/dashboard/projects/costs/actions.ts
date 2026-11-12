"use server";

import {
    getActiveOrganizationId,
    requireAuth,
} from "@/lib/supabase/auth-utils";
import {
    requireEditableAccessForVerifiedProject,
    requireEditableProjectAccess,
    requireEstimateAccess,
    requireEstimateComponentAccess,
    requireEstimateLineAccess,
} from "@/lib/supabase/project-resource-access";
import { revalidatePath } from "next/cache";
import { recalcEstimateTotal } from "./estimate-total";
import type { EstimateLine, EstimateLineComponent } from "./types";

// P1-3 — Estimate immutability after project goes live.
//
// Once a project moves past proposal acceptance, the estimate that
// backs the signed contract sum is the "original contract sum" and
// must not mutate. Any scope change goes through Variations. This
// helper is the single source of truth for the lock check — every
// mutating action in this file calls it before touching the DB.

async function assertEstimateEditable(
    estimateId: string,
    verifiedAccess?: Awaited<ReturnType<typeof requireEstimateAccess>>,
): Promise<
    | ({ ok: true } & Awaited<ReturnType<typeof requireEstimateAccess>>)
    | { ok: false; error: string }
> {
    let access: Awaited<ReturnType<typeof requireEstimateAccess>>;
    try {
        access = verifiedAccess ?? await requireEstimateAccess(estimateId);
    } catch {
        return { ok: false, error: "Estimate not found or unauthorized" };
    }

    try {
        const editableAccess = await requireEditableAccessForVerifiedProject(access, access.projectId);
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

    if (error) throw new Error(error.message);
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
): Promise<
    | { id: string; warning?: string; error?: undefined }
    | { id?: undefined; warning?: undefined; error: string }
> {
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

        // The line may have committed before the aggregate update. Report that
        // partial persistence explicitly so the client reloads authoritative
        // state instead of displaying a false "Saved" confirmation.
        try {
            await recalcEstimateTotal(lock.supabase, estimateId);
        } catch (recalcErr) {
            console.error("[addLineItemAction] recalc failed (line still saved)", recalcErr);
            if (!result?.id) return { error: "Insert succeeded but no id was returned" };
            return {
                id: result.id,
                warning: "The line was saved, but the stored estimate total could not be refreshed.",
            };
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
): Promise<{ success: boolean; error?: string; warning?: string; line?: Partial<EstimateLine> }> {
    let lineAccess: Awaited<ReturnType<typeof requireEstimateLineAccess>>;
    try {
        lineAccess = await requireEstimateLineAccess(lineId);
    } catch {
        return { success: false, error: "Line not found or unauthorized" };
    }
    const lock = await assertEstimateEditable(lineAccess.estimateId, lineAccess);
    if (!lock.ok) return { success: false, error: lock.error };

    const updateData: Record<string, unknown> = { ...data };
    const changesPrice = data.quantity !== undefined || data.unit_rate !== undefined;
    let previous: { quantity: number | null; unit_rate: number | null } | null = null;
    if (changesPrice) {
        const { data: current, error } = await lock.supabase.from("estimate_lines")
            .select("quantity, unit_rate, estimate_id")
            .eq("id", lineId).eq("estimate_id", lineAccess.estimateId).single();
        if (error || !current || current.estimate_id !== lineAccess.estimateId) {
            return { success: false, error: "The current quantity and rate could not be checked. Reload the estimate before editing the price." };
        }
        previous = current;
        const quantity = data.quantity ?? current.quantity;
        const rate = data.unit_rate ?? current.unit_rate;
        if (typeof quantity !== "number" || typeof rate !== "number" ||
            !Number.isFinite(quantity) || !Number.isFinite(rate) || !Number.isFinite(quantity * rate)) {
            return { success: false, error: "Enter a finite priced quantity and rate." };
        }
        updateData.line_total = quantity * rate;
    }

    let update = lock.supabase
        .from("estimate_lines")
        .update(updateData)
        .eq("id", lineId)
        .eq("estimate_id", lineAccess.estimateId);
    if (previous) {
        update = previous.quantity === null ? update.is("quantity", null) : update.eq("quantity", previous.quantity);
        update = previous.unit_rate === null ? update.is("unit_rate", null) : update.eq("unit_rate", previous.unit_rate);
    }
    const { data: saved, error } = await update.select("*").single();
    if (error || !saved || saved.id !== lineId || saved.estimate_id !== lineAccess.estimateId ||
        (changesPrice && ![saved.quantity, saved.unit_rate, saved.line_total].every(value => typeof value === "number" && Number.isFinite(value)))) {
        return { success: false, error: "The line save was not confirmed and may already have saved. Reload the estimate before retrying." };
    }
    const line: Partial<EstimateLine> = { id: saved.id, ...Object.fromEntries(Object.keys(data).map(key => [key, saved[key]])) };
    if (changesPrice) Object.assign(line, { quantity: saved.quantity, unit_rate: saved.unit_rate, line_total: saved.line_total });

    try {
        await recalcEstimateTotal(lock.supabase, lineAccess.estimateId);
    } catch (error) {
        console.error("[updateLineItemAction] recalc failed", error);
        return { success: true, line, warning: "The line was saved, but the stored estimate total could not be refreshed." };
    }
    return { success: true, line };
}

export async function deleteLineItemAction(
    lineId: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
    let lineAccess: Awaited<ReturnType<typeof requireEstimateLineAccess>>;
    try {
        lineAccess = await requireEstimateLineAccess(lineId);
    } catch {
        return { success: false, error: "Line not found or unauthorized" };
    }
    const lock = await assertEstimateEditable(lineAccess.estimateId, lineAccess);
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

    try {
        await recalcEstimateTotal(lock.supabase, lineAccess.estimateId);
    } catch (error) {
        console.error("[deleteLineItemAction] recalc failed", error);
        return { success: true, warning: "The line was deleted, but the stored estimate total could not be refreshed." };
    }
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
): Promise<EstimateLineComponent | null> {
    let lineAccess: Awaited<ReturnType<typeof requireEstimateLineAccess>>;
    try {
        lineAccess = await requireEstimateLineAccess(lineId);
    } catch (error) {
        console.error("addComponentAction: cannot access estimate line", lineId, error);
        return null;
    }
    const lock = await assertEstimateEditable(lineAccess.estimateId, lineAccess);
    if (!lock.ok) return null;

    const { data: result, error } = await lock.supabase
        .from("estimate_line_components")
        .insert({ estimate_line_id: lineId, ...data })
        .select("*")
        .single();
    if (error) { console.error("addComponentAction: insert failed", error); return null; }
    if (!isConfirmedResource(result, lineId)) return null;
    return result;
}

function isConfirmedResource(row: EstimateLineComponent | null, lineId: string): row is EstimateLineComponent {
    return !!row && typeof row.id === "string" && row.id.length > 0 && row.estimate_line_id === lineId &&
        typeof row.description === "string" && typeof row.unit === "string" &&
        [row.quantity, row.unit_rate, row.line_total, row.manhours_per_unit, row.total_manhours, row.sort_order]
            .every(value => typeof value === "number" && Number.isFinite(value));
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
): Promise<EstimateLineComponent> {
    const access = await requireEstimateComponentAccess(componentId);
    const lock = await assertEstimateEditable(access.estimateId, access);
    if (!lock.ok) throw new Error(lock.error);
    const { data: saved, error } = await lock.supabase
        .from("estimate_line_components")
        .update(data)
        .eq("id", componentId)
        .eq("estimate_line_id", access.lineId)
        .select("*").single();
    if (error || !isConfirmedResource(saved, access.lineId) || saved.id !== componentId) {
        throw new Error("Resource save was not confirmed and may already have saved.");
    }
    return saved;
}

export async function deleteComponentAction(componentId: string): Promise<void> {
    const access = await requireEstimateComponentAccess(componentId);
    const lock = await assertEstimateEditable(access.estimateId, access);
    if (!lock.ok) throw new Error(lock.error);
    const { data: removed, error } = await lock.supabase
        .from("estimate_line_components")
        .delete()
        .eq("id", componentId)
        .eq("estimate_line_id", access.lineId)
        .select("id, estimate_line_id").single();
    if (error || !removed || removed.id !== componentId || removed.estimate_line_id !== access.lineId) {
        throw new Error("Resource removal was not confirmed and may already have saved.");
    }
}

export async function setPricingModeAction(lineId: string, mode: "simple" | "buildup"): Promise<void> {
    const access = await requireEstimateLineAccess(lineId);
    const lock = await assertEstimateEditable(access.estimateId, access);
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
): Promise<{ id: string; name: string }> {
    const savedName = name.trim();
    if (!savedName) throw new Error("Enter a name for the library copy.");
    const activeOrgId = await getActiveOrganizationId();
    if (activeOrgId !== orgId) {
        throw new Error("Unauthorized organization access.");
    }
    const { supabase } = await requireAuth();
    const { data: saved, error } = await supabase.from("rate_buildups").insert({
        organization_id: orgId,
        name: savedName,
        unit,
        trade_section: tradeSection,
        components,
        built_up_rate: builtUpRate,
        total_manhours_per_unit: totalManhoursPerUnit,
    }).select("id, organization_id, name").single();
    if (error || !saved || typeof saved.id !== "string" || !saved.id ||
        saved.organization_id !== orgId || saved.name !== savedName) {
        throw new Error("The library copy was not confirmed and may already have saved. Check the library before saving another copy.");
    }
    return { id: saved.id, name: saved.name };
}

export async function updateLineBuiltUpRateAction(
    lineId: string,
    builtUpRate: number,
    expectedQuantity: number,
): Promise<{ unitRate: number; lineTotal: number; quantity: number }> {
    if (!Number.isFinite(builtUpRate) || builtUpRate < 0 ||
        !Number.isFinite(expectedQuantity) || expectedQuantity < 0 ||
        !Number.isFinite(expectedQuantity * builtUpRate)) {
        throw new Error("Enter a finite non-negative rate and priced quantity.");
    }
    const access = await requireEstimateLineAccess(lineId);
    const lock = await assertEstimateEditable(access.estimateId, access);
    if (!lock.ok) throw new Error(lock.error);
    const { data: line, error: readError } = await lock.supabase
        .from("estimate_lines")
        .select("quantity, estimate_id")
        .eq("id", lineId)
        .eq("estimate_id", access.estimateId)
        .single();
    if (readError || !line || line.estimate_id !== access.estimateId) {
        throw new Error("The priced quantity could not be checked. Reload the estimate before applying the rate.");
    }
    if (line.quantity !== expectedQuantity) {
        throw new Error("The priced quantity has changed. Recheck the resources before applying the rate.");
    }
    const { data: saved, error } = await lock.supabase.from("estimate_lines").update({
        unit_rate: builtUpRate,
        line_total: expectedQuantity * builtUpRate,
    }).eq("id", lineId).eq("estimate_id", access.estimateId)
        .eq("quantity", expectedQuantity)
        .select("id, estimate_id, quantity, unit_rate, line_total").single();
    if (error || !saved || saved.id !== lineId || saved.estimate_id !== access.estimateId ||
        saved.quantity !== expectedQuantity ||
        typeof saved.unit_rate !== "number" || !Number.isFinite(saved.unit_rate) || saved.unit_rate < 0 ||
        typeof saved.line_total !== "number" || !Number.isFinite(saved.line_total) || saved.line_total < 0) {
        throw new Error("The rate was not confirmed and may already have saved. Reload the estimate before retrying.");
    }
    await recalcEstimateTotal(lock.supabase, access.estimateId);
    // Return stored amounts, including the database's existing numeric precision.
    return { unitRate: saved.unit_rate, lineTotal: saved.line_total, quantity: saved.quantity };
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
