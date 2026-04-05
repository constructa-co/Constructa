"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createInvoiceAction(data: {
    project_id: string;
    invoice_number: string;
    type: "Interim" | "Final";
    amount: number;
}) {
    const supabase = createClient();
    const { error } = await supabase.from("invoices").insert([{
        project_id: data.project_id,
        invoice_number: data.invoice_number,
        type: data.type,
        amount: data.amount,
        status: "Draft",
    }]);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${data.project_id}`);
    revalidatePath(`/dashboard/projects/p-and-l?projectId=${data.project_id}`);
}

export async function updateInvoiceStatusAction(invoiceId: string, status: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/p-and-l?projectId=${projectId}`);
}

export async function deleteInvoiceAction(invoiceId: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/p-and-l?projectId=${projectId}`);
}

// ── Legacy stub (valuation-form.tsx compatibility) ───���────────────────────────
export async function createValuationAction(_formData: FormData): Promise<void> {
    // Superseded by createInvoiceAction — kept for import compatibility
    throw new Error("createValuationAction is no longer supported. Use createInvoiceAction instead.");
}
