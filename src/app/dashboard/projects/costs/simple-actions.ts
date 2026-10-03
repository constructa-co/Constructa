"use server";

import { z } from "zod";
import { getActiveOrganizationId, requireAuth } from "@/lib/supabase/auth-utils";
import {
    requireEditableAccessForVerifiedProject,
    requireEditableProjectAccess,
    requireEstimateAccess,
} from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";
import {
    ADJUSTMENTS_SAVE_ERROR,
    LINE_DELETE_ERROR,
    LINE_SAVE_ERROR,
    MAX_DESCRIPTION_LENGTH,
    MAX_LINE_AMOUNT,
    MAX_LINE_QUANTITY,
    MAX_UNIT_LENGTH,
    SIMPLE_LINE_SECTION,
    lineTotal,
    type AdjustmentsInput,
    type PriceLineInput,
    type SavePriceLineRequest,
    type SavePriceLineResult,
    type SimpleResult,
    type UpdatePriceLineResult,
} from "@/lib/simple-estimate";
import { recalcEstimateTotal } from "./estimate-total";
import { toEstimate, toEstimateLine } from "./estimate-mapping";
import type { CostLibraryItem, LabourRate, RateBuildup } from "./types";

// Simple estimating actions. Like the other estimating actions these never
// call revalidatePath: the screen updates from the confirmed result.

const UNIQUE_VIOLATION = "23505";
const TOTAL_WARNING = "The line was saved, but the stored estimate total could not be refreshed. Reload the page to check it.";

const LineSchema = z.object({
    description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
    quantity: z.number().positive().max(MAX_LINE_QUANTITY),
    unit: z.string().trim().min(1).max(MAX_UNIT_LENGTH),
    unit_rate: z.number().positive().max(MAX_LINE_AMOUNT),
}).refine((line) => lineTotal(line.quantity, line.unit_rate) <= MAX_LINE_AMOUNT);

const SaveLineSchema = z.object({
    projectId: z.string().uuid(),
    estimateId: z.string().uuid().nullable(),
    newEstimateId: z.string().uuid(),
    lineId: z.string().uuid(),
    line: LineSchema,
});

const AdjustmentsSchema = z.object({
    prelims_pct: z.number().min(0).max(100),
    overhead_pct: z.number().min(0).max(100),
    risk_pct: z.number().min(0).max(100),
    profit_pct: z.number().min(0).max(100),
    discount_pct: z.number().min(0).max(100),
    discount_reason: z.string().max(500),
});

async function editableEstimate(estimateId: string) {
    const access = await requireEstimateAccess(estimateId);
    await requireEditableAccessForVerifiedProject(access, access.projectId);
    return access;
}

/**
 * Saves a new price line. When the project has no estimate yet, the estimate
 * is created here, by the first real line, and never before.
 *
 * Retry-safe without a schema change: the browser chooses the estimate id and
 * the line id once and sends the same ids on every retry. A retry after a lost
 * response finds those rows already there and reports them as saved rather
 * than creating a second estimate or a duplicate line.
 */
export async function saveSimplePriceLineAction(request: SavePriceLineRequest): Promise<SavePriceLineResult> {
    const parsed = SaveLineSchema.safeParse(request);
    if (!parsed.success) return { ok: false, error: "Check the description and price, then try again." };
    const { projectId, newEstimateId, lineId, line } = parsed.data;

    try {
        const { supabase, user } = await requireEditableProjectAccess(projectId);

        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("organization_id, status")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();
        if (projectError || !project) return { ok: false, error: LINE_SAVE_ERROR };

        let estimateId = parsed.data.estimateId;
        let createdHere = false;
        const clientHadNoEstimate = estimateId === null;

        if (estimateId) {
            const { data: owned } = await supabase
                .from("estimates")
                .select("id")
                .eq("id", estimateId)
                .eq("project_id", projectId)
                .maybeSingle();
            if (!owned) return { ok: false, error: "This estimate is no longer available. Reload the page and try again." };
        } else {
            // Another tab, or an earlier attempt, may already have made one.
            const { data: existing, error: existingError } = await supabase
                .from("estimates")
                .select("id, is_active")
                .eq("project_id", projectId)
                .order("created_at");
            if (existingError) return { ok: false, error: LINE_SAVE_ERROR };

            const reuse = (existing || []).find((e) => e.is_active) ?? (existing || [])[0];
            if (reuse) {
                estimateId = reuse.id;
            } else {
                // No template, no seeded lines, and no mark-up the contractor
                // did not choose: the total starts as exactly what they type.
                const { error: insertError } = await supabase.from("estimates").insert({
                    id: newEstimateId,
                    project_id: projectId,
                    organization_id: project.organization_id ?? null,
                    version_name: "Estimate v1",
                    total_cost: 0,
                    prelims_pct: 0,
                    overhead_pct: 0,
                    risk_pct: 0,
                    profit_pct: 0,
                    is_active: true,
                });
                if (insertError && insertError.code !== UNIQUE_VIOLATION) {
                    console.error("[saveSimplePriceLineAction] estimate insert failed", { projectId, code: insertError.code });
                    return { ok: false, error: LINE_SAVE_ERROR };
                }
                if (insertError) {
                    const { data: already } = await supabase
                        .from("estimates")
                        .select("id")
                        .eq("id", newEstimateId)
                        .eq("project_id", projectId)
                        .maybeSingle();
                    if (!already) return { ok: false, error: LINE_SAVE_ERROR };
                } else {
                    createdHere = true;
                }
                estimateId = newEstimateId;
            }
        }

        if (!estimateId) return { ok: false, error: LINE_SAVE_ERROR };

        const { error: lineError } = await supabase.from("estimate_lines").insert({
            id: lineId,
            estimate_id: estimateId,
            organization_id: project.organization_id ?? null,
            trade_section: SIMPLE_LINE_SECTION,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unit_rate: line.unit_rate,
            line_total: lineTotal(line.quantity, line.unit_rate),
            line_type: "general",
            pricing_mode: "simple",
        });

        if (lineError && lineError.code !== UNIQUE_VIOLATION) {
            console.error("[saveSimplePriceLineAction] line insert failed", { projectId, code: lineError.code });
            if (createdHere) {
                // Do not leave an empty estimate behind a failed first line.
                const { error: undoError } = await supabase
                    .from("estimates")
                    .delete()
                    .eq("id", estimateId)
                    .eq("project_id", projectId);
                if (undoError) console.error("[saveSimplePriceLineAction] could not remove empty estimate", { projectId, code: undoError.code });
            }
            return { ok: false, error: LINE_SAVE_ERROR };
        }

        // Read back what is stored. After a unique violation this is the line
        // an earlier attempt saved; it must belong to this estimate.
        const { data: savedLine } = await supabase
            .from("estimate_lines")
            .select("*")
            .eq("id", lineId)
            .eq("estimate_id", estimateId)
            .maybeSingle();
        if (!savedLine) return { ok: false, error: LINE_SAVE_ERROR };

        let warning: string | undefined;
        try {
            await recalcEstimateTotal(supabase, estimateId);
        } catch (error) {
            console.error("[saveSimplePriceLineAction] recalc failed (line still saved)", error);
            warning = TOTAL_WARNING;
        }

        if (createdHere && (project.status === "Lead" || project.status === null)) {
            // Same pipeline step the first estimate has always triggered.
            const { error: statusError } = await supabase
                .from("projects")
                .update({ status: "Estimating" })
                .eq("id", projectId);
            if (statusError) console.error("[saveSimplePriceLineAction] status update failed", { projectId, code: statusError.code });
        }

        let createdEstimate = null;
        if (clientHadNoEstimate) {
            const { data: estimateRow } = await supabase
                .from("estimates")
                .select("*, estimate_lines(*, estimate_line_components(*))")
                .eq("id", estimateId)
                .maybeSingle();
            if (!estimateRow) {
                return { ok: false, error: "The line was saved, but the page could not refresh. Reload the page to see it." };
            }
            createdEstimate = toEstimate(estimateRow);
        }

        return { ok: true, estimateId, createdEstimate, line: toEstimateLine(savedLine), warning };
    } catch (error) {
        const locked = precontractLockMessage(error);
        if (!locked) console.error("[saveSimplePriceLineAction] unexpected failure", error);
        return { ok: false, error: locked ?? LINE_SAVE_ERROR };
    }
}

export async function updateSimplePriceLineAction(
    estimateId: string,
    lineId: string,
    line: PriceLineInput,
): Promise<UpdatePriceLineResult> {
    const ids = z.object({ estimateId: z.string().uuid(), lineId: z.string().uuid() }).safeParse({ estimateId, lineId });
    const parsed = LineSchema.safeParse(line);
    if (!ids.success || !parsed.success) return { ok: false, error: "Check the description and price, then try again." };

    try {
        const { supabase } = await editableEstimate(estimateId);

        const { data: current } = await supabase
            .from("estimate_lines")
            .select("id, pricing_mode")
            .eq("id", lineId)
            .eq("estimate_id", estimateId)
            .maybeSingle();
        if (!current) return { ok: false, error: "This line no longer exists. Reload the page to see the current estimate." };
        if (current.pricing_mode === "buildup") {
            return { ok: false, error: "This line uses a rate build-up. Change it in Advanced estimating." };
        }

        const { data: updated, error } = await supabase
            .from("estimate_lines")
            .update({
                description: parsed.data.description,
                quantity: parsed.data.quantity,
                unit: parsed.data.unit,
                unit_rate: parsed.data.unit_rate,
                line_total: lineTotal(parsed.data.quantity, parsed.data.unit_rate),
            })
            .eq("id", lineId)
            .eq("estimate_id", estimateId)
            .select("id, description, quantity, unit, unit_rate, line_total")
            .maybeSingle();
        if (error || !updated) {
            if (error) console.error("[updateSimplePriceLineAction] failed", { estimateId, code: error.code });
            return { ok: false, error: LINE_SAVE_ERROR };
        }

        try {
            await recalcEstimateTotal(supabase, estimateId);
        } catch (recalcError) {
            console.error("[updateSimplePriceLineAction] recalc failed", recalcError);
            return { ok: true, line: updated, warning: TOTAL_WARNING };
        }
        return { ok: true, line: updated };
    } catch (error) {
        const locked = precontractLockMessage(error);
        if (!locked) console.error("[updateSimplePriceLineAction] unexpected failure", error);
        return { ok: false, error: locked ?? LINE_SAVE_ERROR };
    }
}

/** Removing a line that is already gone counts as removed, so a retry is safe. */
export async function deleteSimplePriceLineAction(estimateId: string, lineId: string): Promise<SimpleResult> {
    const ids = z.object({ estimateId: z.string().uuid(), lineId: z.string().uuid() }).safeParse({ estimateId, lineId });
    if (!ids.success) return { ok: false, error: LINE_DELETE_ERROR };

    try {
        const { supabase } = await editableEstimate(estimateId);
        const { error } = await supabase
            .from("estimate_lines")
            .delete()
            .eq("id", lineId)
            .eq("estimate_id", estimateId);
        if (error) {
            console.error("[deleteSimplePriceLineAction] failed", { estimateId, code: error.code });
            return { ok: false, error: LINE_DELETE_ERROR };
        }

        try {
            await recalcEstimateTotal(supabase, estimateId);
        } catch (recalcError) {
            console.error("[deleteSimplePriceLineAction] recalc failed", recalcError);
            return { ok: true, warning: "The line was removed, but the stored estimate total could not be refreshed. Reload the page to check it." };
        }
        return { ok: true };
    } catch (error) {
        const locked = precontractLockMessage(error);
        if (!locked) console.error("[deleteSimplePriceLineAction] unexpected failure", error);
        return { ok: false, error: locked ?? LINE_DELETE_ERROR };
    }
}

/** Saves all price adjustments in one update, so they cannot half-apply. */
export async function savePriceAdjustmentsAction(estimateId: string, input: AdjustmentsInput): Promise<SimpleResult> {
    const id = z.string().uuid().safeParse(estimateId);
    const parsed = AdjustmentsSchema.safeParse(input);
    if (!id.success || !parsed.success) return { ok: false, error: "Enter each percentage as a number between 0 and 100." };

    try {
        const { supabase } = await editableEstimate(estimateId);
        const { data, error } = await supabase
            .from("estimates")
            .update(parsed.data)
            .eq("id", estimateId)
            .select("id")
            .maybeSingle();
        if (error || !data) {
            if (error) console.error("[savePriceAdjustmentsAction] failed", { estimateId, code: error.code });
            return { ok: false, error: ADJUSTMENTS_SAVE_ERROR };
        }
        return { ok: true };
    } catch (error) {
        const locked = precontractLockMessage(error);
        if (!locked) console.error("[savePriceAdjustmentsAction] unexpected failure", error);
        return { ok: false, error: locked ?? ADJUSTMENTS_SAVE_ERROR };
    }
}

export interface AdvancedEstimatingData {
    orgId: string;
    costLibrary: CostLibraryItem[];
    rateBuildups: RateBuildup[];
    labourRates: LabourRate[];
    preferredTrades: string[];
}

/**
 * Reference data for the advanced workspace: cost library, rate build-ups and
 * labour rates. Loaded only when Advanced estimating is opened, so the simple
 * screen does not carry it.
 */
export async function loadAdvancedEstimatingDataAction(): Promise<
    { ok: true; data: AdvancedEstimatingData } | { ok: false; error: string }
> {
    try {
        const { supabase, user } = await requireAuth();

        let orgId: string | null = null;
        try {
            orgId = await getActiveOrganizationId();
        } catch {
            // User may not have an org yet — continue without
        }

        const rateBuildupQuery = supabase.from("rate_buildups").select("*").order("usage_count", { ascending: false });
        if (orgId) rateBuildupQuery.or(`is_system_default.eq.true,organization_id.eq.${orgId}`);
        else rateBuildupQuery.eq("is_system_default", true);

        const labourRateQuery = supabase.from("labour_rates").select("*").order("trade,role");
        if (orgId) labourRateQuery.or(`is_system_default.eq.true,organization_id.eq.${orgId}`);
        else labourRateQuery.eq("is_system_default", true);

        const [rateBuildups, costLibrary, labourRates, profile] = await Promise.all([
            rateBuildupQuery,
            supabase.from("cost_library_items").select("*").or("is_system_default.eq.true").order("category,description"),
            labourRateQuery,
            supabase.from("profiles").select("preferred_trades").eq("id", user.id).single(),
        ]);
        if (rateBuildups.error || costLibrary.error || labourRates.error) {
            return { ok: false, error: "The advanced tools couldn't be loaded. Check your connection and try again." };
        }

        /* eslint-disable @typescript-eslint/no-explicit-any */
        return {
            ok: true,
            data: {
                orgId: orgId || "",
                costLibrary: (costLibrary.data || []).map((c: any) => ({
                    id: c.id,
                    code: c.code || "",
                    description: c.description || "",
                    unit: c.unit || "nr",
                    base_rate: c.base_rate || 0,
                    category: c.category || "General",
                })),
                rateBuildups: (rateBuildups.data || []).map((rb: any) => ({
                    id: rb.id,
                    name: rb.name || "",
                    unit: rb.unit || "nr",
                    built_up_rate: rb.built_up_rate || 0,
                    trade_section: rb.trade_section || "",
                    components: rb.components || [],
                    total_manhours_per_unit: rb.total_manhours_per_unit || 0,
                })),
                labourRates: (labourRates.data || []).map((lr: any) => ({
                    id: lr.id,
                    trade: lr.trade || "",
                    role: lr.role || "",
                    day_rate: lr.day_rate || 0,
                    hourly_rate: lr.hourly_rate || 0,
                    region: lr.region || "national",
                    organization_id: lr.organization_id || null,
                    is_system_default: lr.is_system_default ?? true,
                })),
                preferredTrades: (profile.data?.preferred_trades as string[]) || [],
            },
        };
        /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch (error) {
        console.error("[loadAdvancedEstimatingDataAction] failed", error);
        return { ok: false, error: "The advanced tools couldn't be loaded. Check your connection and try again." };
    }
}
