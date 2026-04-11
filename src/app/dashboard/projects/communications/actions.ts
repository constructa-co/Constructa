"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

function revalidateComms(projectId: string) {
    revalidatePath(`/dashboard/projects/communications?projectId=${projectId}`);
}

// ── Site Instructions ─────────────────────────────────────────────────────────

export async function createSiteInstructionAction(data: {
    project_id: string;
    type: string;
    recipient: string;
    date_issued: string;
    description: string;
}) {
    const { supabase } = await requireAuth();
    const { count } = await supabase
        .from("site_instructions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id);
    const si_number = `SI-${String((count ?? 0) + 1).padStart(3, "0")}`;
    const { error } = await supabase.from("site_instructions").insert([{ ...data, si_number, status: "Issued" }]);
    if (error) throw new Error(error.message);
    revalidateComms(data.project_id);
}

export async function updateSIStatusAction(id: string, status: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("site_instructions").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

export async function deleteSiteInstructionAction(id: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("site_instructions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

// ── RFIs ──────────────────────────────────────────────────────────────────────

export async function createRfiAction(data: {
    project_id: string;
    question: string;
    addressee: string;
    date_sent: string;
    date_response_due: string;
}) {
    const { supabase } = await requireAuth();
    const { count } = await supabase
        .from("rfis")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id);
    const rfi_number = `RFI-${String((count ?? 0) + 1).padStart(3, "0")}`;
    const { error } = await supabase.from("rfis").insert([{ ...data, rfi_number, status: "Open" }]);
    if (error) throw new Error(error.message);
    revalidateComms(data.project_id);
}

export async function respondToRfiAction(id: string, projectId: string, data: {
    response_summary: string;
    date_responded: string;
}) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("rfis")
        .update({ ...data, status: "Responded" })
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

export async function updateRfiStatusAction(id: string, status: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("rfis").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

export async function deleteRfiAction(id: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("rfis").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

// ── Early Warning Notices ─────────────────────────────────────────────────────

export async function createEwnAction(data: {
    project_id: string;
    type: string;
    description: string;
    date_issued: string;
    potential_cost_impact: number;
    potential_time_impact_days: number;
}) {
    const { supabase } = await requireAuth();
    const { count } = await supabase
        .from("early_warning_notices")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id);
    const ewn_number = `EWN-${String((count ?? 0) + 1).padStart(3, "0")}`;
    const { error } = await supabase.from("early_warning_notices").insert([{ ...data, ewn_number, status: "Issued" }]);
    if (error) throw new Error(error.message);
    revalidateComms(data.project_id);
}

export async function updateEwnStatusAction(id: string, status: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("early_warning_notices").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

export async function deleteEwnAction(id: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("early_warning_notices").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}

// ── Document Register ─────────────────────────────────────────────────────────

export async function createDocumentAction(data: {
    project_id: string;
    doc_type: string;
    title: string;
    revision?: string;
    direction: string;
    date_issued: string;
    file_ref?: string;
    notes?: string;
}) {
    const { supabase } = await requireAuth();
    const { count } = await supabase
        .from("document_register")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id);
    const doc_number = `DOC-${String((count ?? 0) + 1).padStart(3, "0")}`;
    const { error } = await supabase.from("document_register").insert([{ ...data, doc_number }]);
    if (error) throw new Error(error.message);
    revalidateComms(data.project_id);
}

export async function deleteDocumentAction(id: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("document_register").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateComms(projectId);
}
