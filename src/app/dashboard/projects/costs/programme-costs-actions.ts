"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import {
    requireEditableAccessForVerifiedProject,
    requireEstimateAccess,
} from "@/lib/supabase/project-resource-access";
import {
    PROGRAMME_COST_SECTION,
    acknowledgementMatches,
    computeProgrammeCosts,
    hireDatesForNote,
    hireIdFromLineKey,
    planProgrammeCostApplication,
    programmeCostApplyProblems,
    programmeCostLineNote,
} from "@/lib/programme-costs";
import { recalcEstimateTotal } from "./estimate-total";
import { toEstimateLine } from "./estimate-mapping";
import type { EstimateLine } from "./types";

// Like the other estimating actions this never calls revalidatePath: the
// screen updates from the confirmed result.

export type ApplyProgrammeCostsRequest = {
    projectId: string;
    estimateId: string;
    inputs: unknown;
    acknowledgement: { signature: string; beforePence: number; afterPence: number };
};

export type ApplyProgrammeCostsResult =
    | { ok: true; lines: EstimateLine[]; warning?: string }
    | { ok: false; error: string; stale?: boolean; alreadyApplied?: boolean };

const RequestSchema = z.object({
    projectId: z.string().uuid(),
    estimateId: z.string().uuid(),
    inputs: z.unknown(),
    acknowledgement: z.object({
        signature: z.string().regex(/^[0-9a-f]{8}$/),
        beforePence: z.number().int(),
        afterPence: z.number().int(),
    }).strict(),
}).strict();

const STALE = "The programme, these settings or the estimate changed after you checked the price. Review the change again before applying it.";
const SAVE_ERROR = "The programme costs could not be applied. Nothing was changed. Reload the estimate and try again.";

/**
 * Line ids derived from the estimate, the reviewed signature and each cost's
 * key. A retry or second click for the same reviewed set therefore re-uses
 * the same primary keys, and the single insert is rejected as a whole rather
 * than charging the costs twice. This narrows duplicates; it does not stop
 * two different sets being applied from two tabs at the same moment (the
 * estimate then shows them as inconsistent).
 */
function lineId(estimateId: string, signature: string, key: string): string {
    const hex = createHash("sha256").update(`constructa-programme-cost:v1:${estimateId}:${signature}:${key}`).digest("hex");
    const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const UNIQUE_VIOLATION = "23505";
const PROGRAMME_COSTS_ALREADY_APPLIED =
    "Programme costs are already on this estimate. This version adds programme costs once and cannot update or replace them. The lines on the estimate stay unchanged.";

/**
 * First apply only: adds the programme-cost Preliminaries lines the saved
 * programme and the contractor's settings give, in one insert.
 *
 * Everything is recomputed here from the saved programme and the saved
 * estimate; nothing priced in the browser is trusted. It applies only when
 * the figures match the ones the contractor acknowledged, so a programme or
 * estimate change after review is refused, never silently re-priced.
 *
 * Nothing is ever deleted or changed here. When a set is already applied the
 * request is refused (pending review stays visible), because there is no
 * existing atomic replace for estimate lines and a delete-then-insert could
 * lose saved costs. Every existing line, including measured labour, is kept.
 */
export async function applyProgrammeCostsAction(request: ApplyProgrammeCostsRequest): Promise<ApplyProgrammeCostsResult> {
    const parsed = RequestSchema.safeParse(request);
    if (!parsed.success) return { ok: false, error: "Check the programme cost settings, then try again." };
    const { projectId, estimateId, inputs, acknowledgement } = parsed.data;

    let supabase: Awaited<ReturnType<typeof requireEstimateAccess>>["supabase"];
    try {
        const access = await requireEstimateAccess(estimateId);
        if (access.projectId !== projectId) return { ok: false, error: "This estimate does not belong to this job." };
        await requireEditableAccessForVerifiedProject(access, projectId);
        supabase = access.supabase;
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "This estimate cannot be changed." };
    }

    // Only current settings with named stage anchors are applied; an unnamed anchor is never matched to today's stages.
    const settingsProblems = programmeCostApplyProblems(inputs);
    if (settingsProblems.length > 0) return { ok: false, error: settingsProblems.join(" "), stale: true };

    try {
        // Read whole rows so an optional calendar column missing on an older target cannot block the read.
        const [{ data: project, error: projectError }, { data: estimate, error: estimateError }, { data: lines, error: linesError }] = await Promise.all([
            supabase.from("projects").select("*").eq("id", projectId).single(),
            supabase.from("estimates").select("*").eq("id", estimateId).eq("project_id", projectId).single(),
            supabase.from("estimate_lines").select("*").eq("estimate_id", estimateId),
        ]);
        if (projectError || !project || estimateError || !estimate || linesError || !lines) return { ok: false, error: SAVE_ERROR };

        const outcome = computeProgrammeCosts(project, inputs);
        if (!outcome.ok) return { ok: false, error: outcome.errors.join(" "), stale: true };
        const { result } = outcome;
        const plan = planProgrammeCostApplication(estimate, lines, result.lines);
        if (plan.removeLineIds.length > 0) return { ok: false, error: PROGRAMME_COSTS_ALREADY_APPLIED, alreadyApplied: true };
        if (!acknowledgementMatches(acknowledgement, result.signature, plan)) return { ok: false, error: STALE, stale: true };
        if (result.lines.length === 0) return { ok: false, error: "These settings give no programme costs, so there is nothing to add." };

        const hiresById = new Map(result.hires.map((hire) => [hire.id, hire]));
        const rows = result.lines.map((line) => {
            const unitRate = line.unitRatePence / 100;
            const hireId = hireIdFromLineKey(line.key);
            const hire = hireId ? hiresById.get(hireId) : undefined;
            return {
                id: lineId(estimateId, result.signature, line.key),
                estimate_id: estimateId,
                trade_section: PROGRAMME_COST_SECTION,
                description: line.description,
                quantity: line.quantity,
                unit: line.unit,
                unit_rate: unitRate,
                line_total: line.quantity * unitRate,
                line_type: "general",
                // Internal record of what this line was worked out from. Never shown to the client.
                // Every line carries the settings, so deleting any one of them does not lose them.
                // Hire lines also record the planned on-hire, off-hire and charged-to dates, so a later
                // programme change can show how far they moved. Planned dates only: nothing is booked.
                notes: programmeCostLineNote(line, result.signature, outcome.inputs, hire ? hireDatesForNote(hire) : undefined),
            };
        });
        // One insert: the set is written whole or not at all.
        const { data, error } = await supabase.from("estimate_lines").insert(rows).select("*");
        if (error?.code === UNIQUE_VIOLATION) return { ok: false, error: "These programme costs are already being added to the estimate. Reload the estimate to see them.", alreadyApplied: true };
        if (error || !data || data.length !== rows.length) {
            console.error("[applyProgrammeCostsAction] insert not confirmed", { estimateId, error: error?.message });
            return { ok: false, error: "The programme costs were not confirmed as saved. Reload the estimate and check its Preliminaries before trying again." };
        }

        try {
            await recalcEstimateTotal(supabase, estimateId);
        } catch (error) {
            console.error("[applyProgrammeCostsAction] recalc failed", error);
            return { ok: true, lines: data.map(toEstimateLine), warning: "The programme costs were added, but the stored estimate total could not be refreshed." };
        }
        return { ok: true, lines: data.map(toEstimateLine) };
    } catch (error) {
        console.error("[applyProgrammeCostsAction] unexpected failure", error);
        return { ok: false, error: SAVE_ERROR };
    }
}
