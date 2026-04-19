"use server";

// Stage 4 hardening (19 Apr 2026): every project-scoped mutation runs through
// requireProjectAccess. updateInvoiceStatusAction / deleteInvoiceAction /
// updateMilestoneAction / deleteMilestoneAction take a trusted projectId for
// ownership verification and then anchor their UPDATE/DELETE by both the
// row id and project_id so a spoofed projectId cannot reach a foreign row.
import { requireProjectAccess } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { CreateAfpSchema, parseInput } from "@/lib/validation/schemas";

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
    const input = parseInput(CreateAfpSchema, data, "application for payment");
    const { supabase } = await requireProjectAccess(input.project_id);
    // Guard against negative net_due from a previous_cert > gross_valuation
    // (impossible under the schema today, but defensive).
    const gross_this_cert = Math.max(0, input.gross_valuation - input.previous_cert);
    const retention_held = input.gross_valuation * (input.retention_pct / 100);
    const net_due = Math.max(0, gross_this_cert - retention_held);

    const { error } = await supabase.from("invoices").insert([{
        project_id:       input.project_id,
        invoice_number:   input.invoice_number,
        type:             input.type,
        amount:           net_due,
        status:           "Draft",
        period_number:    input.period_number,
        gross_valuation:  input.gross_valuation,
        previous_cert:    input.previous_cert,
        retention_pct:    input.retention_pct,
        retention_held:   retention_held,
        net_due:          net_due,
        due_date:         input.due_date || null,
        is_retention_release: false,
    }]);
    if (error) throw new Error(error.message);
    revalidateBilling(input.project_id);
}

export async function releaseRetentionAction(data: {
    project_id: string;
    invoice_number: string;
    amount: number;
    due_date?: string;
}) {
    const { supabase } = await requireProjectAccess(data.project_id);
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
    const { supabase } = await requireProjectAccess(projectId);
    const update: any = { status };
    if (status === "Paid" && paidDate) update.paid_date = paidDate;
    if (status === "Paid" && !paidDate) update.paid_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase
        .from("invoices")
        .update(update)
        .eq("id", invoiceId)
        .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    revalidateBilling(projectId);
}

export async function deleteInvoiceAction(invoiceId: string, projectId: string) {
    const { supabase } = await requireProjectAccess(projectId);
    const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId)
        .eq("project_id", projectId);
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
    const { supabase } = await requireProjectAccess(data.project_id);
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
    const { supabase } = await requireProjectAccess(projectId);
    const { error } = await supabase
        .from("payment_schedule_milestones")
        .update(data)
        .eq("id", id)
        .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    revalidateBilling(projectId);
}

export async function deleteMilestoneAction(id: string, projectId: string) {
    const { supabase } = await requireProjectAccess(projectId);
    const { error } = await supabase
        .from("payment_schedule_milestones")
        .delete()
        .eq("id", id)
        .eq("project_id", projectId);
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
    const { supabase } = await requireProjectAccess(data.project_id);
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
