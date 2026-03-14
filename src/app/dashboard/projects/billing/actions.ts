"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

export async function createInvoiceAction(data: { project_id: string; invoice_number: string; type: 'Interim' | 'Final'; amount: number }) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const { error } = await supabase.from("invoices").insert([{
        ...data,
        organization_id: orgId,
        status: 'Draft'
    }]);

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${data.project_id}`);
}

export async function updateInvoiceStatusAction(invoiceId: string, status: string, projectId: string) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", invoiceId)
        .eq("organization_id", orgId);

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
}

export async function deleteInvoiceAction(invoiceId: string, projectId: string) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId)
        .eq("organization_id", orgId);

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
}

export async function createValuationAction(formData: FormData) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();
    const projectId = formData.get("projectId") as string;
    const retentionRate = Number(formData.get("retentionRate") || 0);

    // Collect all applied values from the form
    const entries = Array.from(formData.entries());
    
    // We need to calculate the total amount for the invoice/valuation
    let totalAmount = 0;
    
    // For each estimate item in the form
    entries.forEach(([key, value]) => {
        if (key.startsWith("input_")) {
            const id = key.replace("input_", "");
            const mode = formData.get(`mode_${id}`);
            const total = Number(formData.get(`total_${id}`));
            const inputVal = Number(value);

            let claimValue = 0;
            if (mode === 'percent') {
                claimValue = total * (inputVal / 100);
            } else {
                claimValue = inputVal;
            }
            totalAmount += claimValue;
        }
    });

    // Apply retention
    const netAmount = totalAmount * (1 - retentionRate / 100);

    // Create the invoice record via RPC (Transactional)
    const { data: invoiceId, error } = await supabase.rpc('create_valuation_and_invoice', {
        p_project_id: projectId,
        p_organization_id: orgId,
        p_invoice_number: `VAL-${Date.now().toString().slice(-6)}`,
        p_amount: netAmount,
        p_type: 'Interim'
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
}
