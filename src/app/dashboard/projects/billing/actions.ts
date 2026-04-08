"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidateBilling(projectId: string) {
    revalidatePath(`/dashboard/projects/billing?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/p-and-l?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/overview?projectId=${projectId}`);
}

// ── Application for Payment ──────────────────────────────────────────────────

export async function createAfpAction(data: {
    project_id: string;
    invoice_number: string;
    type: "Interim" | "Final";
    period_number: number;
    gross_valuation: number;
    previous_cert: number;
    retention_pct: number;
    due_date?: string;
}) {
    const supabase = createClient();
    const gross_this_cert = data.gross_valuation - data.previous_cert;
    const retention_held = data.gross_valuation * (data.retention_pct / 100);
    const net_due = gross_this_cert - retention_held;

    const { error } = await supabase.from("invoices").insert([{
        project_id:       data.project_id,
        invoice_number:   data.invoice_number,
        type:             data.type,
        amount:           net_due,
        status:           "Draft",
        period_number:    data.period_number,
        gross_valuation:  data.gross_valuation,
        previous_cert:    data.previous_cert,
        retention_pct:    data.retention_pct,
        retention_held:   retention_held,
        net_due:          net_due,
        due_date:         data.due_date || null,
        is_retention_release: false,
    }]);
    if (error) throw new Error(error.message);
    revalidateBilling(data.project_id);
}

export async function releaseRetentionAction(data: {
    project_id: string;
    invoice_number: string;
    amount: number;
    due_date?: string;
}) {
    const supabase = createClient();
    const { error } = await supabase.from("invoices").insert([{
        project_id:           data.project_id,
        invoice_number:       data.invoice_number,
        type:                 "Final",
        amount:               data.amount,
        status:               "Draft",
        gross_valuation:      data.amount,
        previous_cert:        0,
        retention_pct:        0,
        retention_held:       0,
        net_due:              data.amount,
        due_date:             data.due_date || null,
        is_retention_release: true,
    }]);
    if (error) throw new Error(error.message);
    revalidateBilling(data.project_id);
}

export async function updateInvoiceStatusAction(invoiceId: string, status: string, projectId: string, paidDate?: string) {
    const supabase = createClient();
    const update: any = { status };
    if (status === "Paid" && paidDate) update.paid_date = paidDate;
    if (status === "Paid" && !paidDate) update.paid_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("invoices").update(update).eq("id", invoiceId);
    if (error) throw new Error(error.message);
    revalidateBilling(projectId);
}

export async function deleteInvoiceAction(invoiceId: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
    if (error) throw new Error(error.message);
    revalidateBilling(projectId);
}

// ── Payment Schedule Milestones ───────────────────────────────────────────────

export async function createMilestoneAction(data: {
    project_id: string;
    label: string;
    target_pct?: number;
    amount?: number;
    due_date?: string;
    order_index: number;
}) {
    const supabase = createClient();
    const { error } = await supabase.from("payment_schedule_milestones").insert([data]);
    if (error) throw new Error(error.message);
    revalidateBilling(data.project_id);
}

export async function updateMilestoneAction(id: string, projectId: string, data: {
    label?: string;
    target_pct?: number;
    amount?: number;
    due_date?: string;
}) {
    const supabase = createClient();
    const { error } = await supabase.from("payment_schedule_milestones").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateBilling(projectId);
}

export async function deleteMilestoneAction(id: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("payment_schedule_milestones").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateBilling(projectId);
}

// ── Legacy stub ───────────────────────────────────────────────────────────────
export async function createInvoiceAction(data: {
    project_id: string;
    invoice_number: string;
    type: "Interim" | "Final";
    amount: number;
}) {
    // Kept for any legacy callers — wraps createAfpAction with defaults
    const supabase = createClient();
    const { error } = await supabase.from("invoices").insert([{
        project_id:     data.project_id,
        invoice_number: data.invoice_number,
        type:           data.type,
        amount:         data.amount,
        status:         "Draft",
        net_due:        data.amount,
        gross_valuation: data.amount,
    }]);
    if (error) throw new Error(error.message);
    revalidateBilling(data.project_id);
}

export async function createValuationAction(_formData: FormData): Promise<void> {
    throw new Error("createValuationAction is no longer supported.");
}
