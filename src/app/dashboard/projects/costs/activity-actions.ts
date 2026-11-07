"use server";

import { z } from "zod";
import { requireEstimateAccess, requireEditableAccessForVerifiedProject } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";

const Input = z.object({
    estimateId: z.string().uuid(), lineId: z.string().uuid(),
    expectedSection: z.string().nullable(), section: z.string().trim().min(1).max(100),
}).strict();

export type ActivitySaveResult = { ok: true; lineId: string; estimateId: string; section: string }
    | { ok: false; error: string; uncertain?: boolean };

/** An explicit, single-line assignment. No financial fields or totals are written. */
export async function savePriceLineActivityAction(input: z.infer<typeof Input>): Promise<ActivitySaveResult> {
    const parsed = Input.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Enter an activity name of 1 to 100 characters." };
    const { estimateId, lineId, expectedSection, section } = parsed.data;
    if (section === "Preliminaries" || expectedSection === "Preliminaries") return {
        ok: false, error: "Preliminaries affects price calculations. Review that change in Advanced estimating.",
    };
    let attempted = false;
    try {
        const access = await requireEstimateAccess(estimateId);
        await requireEditableAccessForVerifiedProject(access, access.projectId);
        const { supabase } = access;
        const { data: estimate, error: estimateError } = await supabase.from("estimates").select("id, is_client_boq")
            .eq("id", estimateId).eq("project_id", access.projectId).maybeSingle();
        if (estimateError || !estimate) return { ok: false, error: "This estimate could not be confirmed. Your activity draft is still here." };
        if (estimate.is_client_boq) return { ok: false, error: "Keep the client BoQ structure in Advanced estimating." };
        const { data: line, error: lineError } = await supabase.from("estimate_lines").select("id, trade_section, pricing_mode")
            .eq("id", lineId).eq("estimate_id", estimateId).maybeSingle();
        if (lineError || !line) return { ok: false, error: "This line could not be confirmed. Reload to review the saved activity." };
        if (line.pricing_mode === "buildup") return { ok: false, error: "Change this rate build-up in Advanced estimating." };
        if (line.trade_section !== expectedSection) return { ok: false, error: "The saved activity changed. Reload to review it before assigning this line." };
        if (expectedSection === section) return { ok: true, lineId, estimateId, section };
        let update = supabase.from("estimate_lines").update({ trade_section: section }).eq("id", lineId).eq("estimate_id", estimateId);
        update = expectedSection === null ? update.is("trade_section", null) : update.eq("trade_section", expectedSection);
        update = line.pricing_mode === null ? update.is("pricing_mode", null) : update.eq("pricing_mode", line.pricing_mode);
        attempted = true;
        const { data: saved, error } = await update.select("id, trade_section").maybeSingle();
        if (error || saved?.id !== lineId || saved.trade_section !== section) return {
            ok: false, uncertain: true, error: "The activity save is not confirmed and may have been saved. Your draft is still here. Reload to reconcile before retrying.",
        };
        return { ok: true, lineId, estimateId, section: saved.trade_section };
    } catch (error) {
        return { ok: false, uncertain: attempted, error: precontractLockMessage(error)
            ?? (attempted ? "The activity may have saved. Reload to reconcile it before retrying; your draft is still here." : "The activity could not be saved. Your draft is still here.") };
    }
}
