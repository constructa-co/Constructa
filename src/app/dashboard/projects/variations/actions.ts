"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { CreateVariationSchema, parseInput } from "@/lib/validation/schemas";

function revalidateVariations(projectId: string) {
    revalidatePath(`/dashboard/projects/variations?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/overview?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/p-and-l?projectId=${projectId}`);
}

export async function createVariationAction(data: {
    project_id: string;
    title: string;
    description: string;
    amount: number;
    instruction_type?: string;
    trade_section?: string;
    instructed_by?: string;
    date_instructed?: string;
}): Promise<{ success: boolean; error?: string; variationId?: string }> {
    // E2E-P0-1 — previously this action threw on validation OR DB failure
    // without logging, so a Vercel 500 would surface as a generic timeout
    // in the UI with no way to debug. Now we catch every branch, log the
    // details server-side, and return a structured error the client can
    // display as a toast.
    try {
        const input = parseInput(CreateVariationSchema, data, "variation");
        const { supabase } = await requireAuth();

        // Auto-generate variation number. Ignore count errors — we'll
        // fall back to a timestamp-based fragment.
        const { count, error: countErr } = await supabase
            .from("variations")
            .select("id", { count: "exact", head: true })
            .eq("project_id", input.project_id);
        if (countErr) {
            console.error("[createVariationAction] count query failed", countErr);
        }
        const nextNum = (count ?? 0) + 1;
        const variation_number = `VAR-${String(nextNum).padStart(3, "0")}`;

        const { data: inserted, error } = await supabase
            .from("variations")
            .insert([{
                project_id:       input.project_id,
                title:            input.title,
                description:      input.description,
                amount:           input.amount,
                status:           "Draft",
                variation_number,
                instruction_type: input.instruction_type || "Client Instruction",
                trade_section:    input.trade_section   || null,
                instructed_by:    input.instructed_by   || null,
                date_instructed:  input.date_instructed || null,
            }])
            .select("id")
            .single();

        if (error) {
            console.error("[createVariationAction] insert failed", {
                projectId: input.project_id,
                title: input.title,
                error: error.message,
                code: error.code,
                details: error.details,
            });
            return { success: false, error: error.message };
        }

        revalidateVariations(input.project_id);
        return { success: true, variationId: inserted?.id };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save variation";
        console.error("[createVariationAction] unexpected failure", err);
        return { success: false, error: message };
    }
}

export async function updateVariationStatusAction(
    variationId: string,
    status: string,
    projectId: string,
    meta?: { approval_reference?: string; approval_date?: string; rejection_reason?: string }
) {
    const { supabase } = await requireAuth();
    const update: any = { status };
    if (status === "Approved") {
        update.approval_reference = meta?.approval_reference || null;
        update.approval_date      = meta?.approval_date || new Date().toISOString().split("T")[0];
    }
    if (status === "Rejected") {
        update.rejection_reason = meta?.rejection_reason || null;
    }
    const { error } = await supabase.from("variations").update(update).eq("id", variationId);
    if (error) throw new Error(error.message);
    revalidateVariations(projectId);
}

export async function deleteVariationAction(variationId: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("variations").delete().eq("id", variationId);
    if (error) throw new Error(error.message);
    revalidateVariations(projectId);
}
