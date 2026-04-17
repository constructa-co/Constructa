"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { getTaxMonthStart } from "@/lib/cis";

// P1-10 — getTaxMonthStart extracted to src/lib/cis.ts (UTC-safe, tested).
// The previous inline version used local-timezone Date methods and drifted
// around DST + UK tax-year boundary (6 April).

// ── Subcontractor CRUD ────────────────────────────────────────────────────────

export async function addSubcontractorAction(data: {
  name: string;
  trading_name: string;
  utr: string;
  company_number: string;
  cis_status: string;
  verification_number: string;
  last_verified_at: string;
  notes: string;
}): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase.from("cis_subcontractors").insert({
    user_id: user.id,
    name: data.name.trim(),
    trading_name: data.trading_name.trim() || null,
    utr: data.utr.replace(/\s/g, "") || null,
    company_number: data.company_number.trim() || null,
    cis_status: data.cis_status,
    verification_number: data.verification_number.trim() || null,
    last_verified_at: data.last_verified_at || null,
    notes: data.notes.trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/cis");
  return {};
}

export async function updateSubcontractorAction(
  id: string,
  data: {
    name: string;
    trading_name: string;
    utr: string;
    company_number: string;
    cis_status: string;
    verification_number: string;
    last_verified_at: string;
    notes: string;
    is_active: boolean;
  }
): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("cis_subcontractors")
    .update({
      name: data.name.trim(),
      trading_name: data.trading_name.trim() || null,
      utr: data.utr.replace(/\s/g, "") || null,
      company_number: data.company_number.trim() || null,
      cis_status: data.cis_status,
      verification_number: data.verification_number.trim() || null,
      last_verified_at: data.last_verified_at || null,
      notes: data.notes.trim() || null,
      is_active: data.is_active,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/cis");
  return {};
}

// ── Payment CRUD ──────────────────────────────────────────────────────────────

export async function recordPaymentAction(data: {
  project_id: string;
  subcontractor_id: string;
  payment_date: string;
  gross_payment: number;
  materials_amount: number;
  deduction_rate: number;
  description: string;
}): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase.from("cis_payments").insert({
    user_id: user.id,
    project_id: data.project_id || null,
    subcontractor_id: data.subcontractor_id,
    payment_date: data.payment_date,
    gross_payment: data.gross_payment,
    materials_amount: data.materials_amount,
    deduction_rate: data.deduction_rate,
    description: data.description.trim() || null,
    tax_month_start: getTaxMonthStart(data.payment_date),
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/cis");
  return {};
}

export async function deletePaymentAction(id: string): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("cis_payments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/cis");
  return {};
}

export async function markStatementSentAction(
  paymentIds: string[]
): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("cis_payments")
    .update({ statement_sent: true })
    .in("id", paymentIds)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/cis");
  return {};
}

// ── Profile CIS settings ──────────────────────────────────────────────────────

export async function saveCisSettingsAction(data: {
  cis_registered: boolean;
  cis_contractor_utr: string;
  cis_paye_reference: string;
  cis_accounts_office_ref: string;
}): Promise<{ error?: string }> {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("profiles")
    .update({
      cis_registered: data.cis_registered,
      cis_contractor_utr: data.cis_contractor_utr.trim() || null,
      cis_paye_reference: data.cis_paye_reference.trim() || null,
      cis_accounts_office_ref: data.cis_accounts_office_ref.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/cis");
  return {};
}
