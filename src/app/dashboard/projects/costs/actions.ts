"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addExpenseAction(formData: FormData) {
    const supabase = createClient();

    const projectId = formData.get("projectId") as string;
    const assemblyId = formData.get("assemblyId") as string;
    const receiptFile = formData.get("receipt") as File; // Get the file

    // 1. Handle File Upload (If exists)
    let receiptUrl = null;
    if (receiptFile && receiptFile.size > 0) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}.${fileExt}`; // Organize by Project

        const { data, error } = await supabase.storage
            .from('receipts')
            .upload(fileName, receiptFile);

        if (!error && data) {
            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(fileName);

            receiptUrl = publicUrl;
        } else {
            console.error("Upload Error:", error);
        }
    }

    // Parse Detailed Costs
    const qty = parseFloat(formData.get("quantity") as string) || 0;
    const rate = parseFloat(formData.get("rate") as string) || 0;
    const delivery = parseFloat(formData.get("delivery") as string) || 0;
    const surcharge = parseFloat(formData.get("surcharge") as string) || 0;

    // Calculate Grand Total
    const total = (qty * rate) + delivery + surcharge;

    // UUID Check: If "General", send NULL for assembly_id
    const targetAssembly = assemblyId === "General" ? null : assemblyId;

    const { error } = await supabase.from("project_expenses").insert({
        project_id: projectId,
        assembly_id: targetAssembly,
        description: formData.get("description") as string,
        supplier: formData.get("supplier") as string,
        quantity: qty,
        unit_rate: rate,
        unit: formData.get("unit") as string,
        delivery_cost: delivery,
        surcharge_cost: surcharge,
        amount: total,
        expense_date: formData.get("date") as string,
        receipt_url: receiptUrl
    });

    if (error) console.error("Expense Error:", error);
    revalidatePath("/dashboard/projects/costs");
}

export async function deleteExpenseAction(formData: FormData) {
    const supabase = createClient();
    const id = formData.get("id") as string;
    await supabase.from("project_expenses").delete().eq("id", id);
    revalidatePath("/dashboard/projects/costs");
}
