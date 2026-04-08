"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
}) {
    const supabase = createClient();

    // Auto-generate variation number
    const { count } = await supabase
        .from("variations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id);
    const nextNum = (count ?? 0) + 1;
    const variation_number = `VAR-${String(nextNum).padStart(3, "0")}`;

    const { error } = await supabase.from("variations").insert([{
        project_id:     data.project_id,
        title:          data.title,
        description:    data.description,
        amount:         data.amount,
        status:         "Draft",
        variation_number,
        instruction_type: data.instruction_type || "Client Instruction",
        trade_section:    data.trade_section   || null,
        instructed_by:    data.instructed_by   || null,
        date_instructed:  data.date_instructed || null,
    }]);
    if (error) throw new Error(error.message);
    revalidateVariations(data.project_id);
}

export async function updateVariationStatusAction(
    variationId: string,
    status: string,
    projectId: string,
    meta?: { approval_reference?: string; approval_date?: string; rejection_reason?: string }
) {
    const supabase = createClient();
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
    const supabase = createClient();
    const { error } = await supabase.from("variations").delete().eq("id", variationId);
    if (error) throw new Error(error.message);
    revalidateVariations(projectId);
}
