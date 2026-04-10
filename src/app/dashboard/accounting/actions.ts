"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

const PATH = "/dashboard/accounting";

// ── Bank Transactions ─────────────────────────────────────────────────────────

export async function importBankTransactionsAction(rows: {
  transaction_date: string;
  description: string;
  reference?: string;
  amount: number;
  balance?: number;
}[], sourceFile: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const batchId = randomUUID();
  const payload = rows.map(r => ({
    user_id:          user.id,
    transaction_date: r.transaction_date,
    description:      r.description,
    reference:        r.reference || null,
    amount:           r.amount,
    balance:          r.balance ?? null,
    source_file:      sourceFile,
    import_batch_id:  batchId,
  }));

  const { error } = await supabase.from("bank_transactions").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { success: true, batchId, count: rows.length };
}

export async function deleteBankTransactionAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  await supabase.from("bank_reconciliation").delete()
    .eq("bank_transaction_id", id).eq("user_id", user.id);

  const { error } = await supabase.from("bank_transactions")
    .delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { success: true };
}

export async function deleteImportBatchAction(batchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  // Get all transaction ids in batch
  const { data: txns } = await supabase.from("bank_transactions")
    .select("id").eq("import_batch_id", batchId).eq("user_id", user.id);

  if (txns?.length) {
    const ids = txns.map(t => t.id);
    await supabase.from("bank_reconciliation")
      .delete().in("bank_transaction_id", ids).eq("user_id", user.id);
    await supabase.from("bank_transactions")
      .delete().eq("import_batch_id", batchId).eq("user_id", user.id);
  }

  revalidatePath(PATH);
  return { success: true };
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export async function reconcileTransactionAction(data: {
  bank_transaction_id: string;
  invoice_id?: string | null;
  match_type: "manual" | "auto" | "unmatched";
  category?: string;
  project_id?: string | null;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  // Remove existing match for this transaction first
  await supabase.from("bank_reconciliation")
    .delete()
    .eq("bank_transaction_id", data.bank_transaction_id)
    .eq("user_id", user.id);

  const { error } = await supabase.from("bank_reconciliation").insert({
    user_id:             user.id,
    bank_transaction_id: data.bank_transaction_id,
    invoice_id:          data.invoice_id || null,
    match_type:          data.match_type,
    category:            data.category || null,
    project_id:          data.project_id || null,
    notes:               data.notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { success: true };
}

export async function unreconcileTransactionAction(bankTransactionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase.from("bank_reconciliation")
    .delete()
    .eq("bank_transaction_id", bankTransactionId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { success: true };
}

// ── Auto-match ────────────────────────────────────────────────────────────────
// Runs client-side matching logic and persists results for confirmed matches

export async function autoMatchTransactionsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  // Get unreconciled transactions (credits only — likely invoice payments)
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("id, transaction_date, description, reference, amount")
    .eq("user_id", user.id)
    .gt("amount", 0)
    .order("transaction_date");

  // Get already reconciled transaction ids
  const { data: existing } = await supabase
    .from("bank_reconciliation")
    .select("bank_transaction_id")
    .eq("user_id", user.id);
  const reconciledIds = new Set((existing ?? []).map(r => r.bank_transaction_id));

  // Get unpaid invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount, net_due, due_date, invoice_number, project_id")
    .in("status", ["Sent", "Draft"])
    .order("due_date");

  // Get projects for user filter
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id);
  const userProjectIds = new Set((projects ?? []).map(p => p.id));

  const userInvoices = (invoices ?? []).filter(i => userProjectIds.has(i.project_id));

  let matched = 0;
  const matchPayload: {
    user_id: string;
    bank_transaction_id: string;
    invoice_id: string;
    match_type: string;
    match_confidence: number;
    project_id: string;
  }[] = [];

  for (const txn of txns ?? []) {
    if (reconciledIds.has(txn.id)) continue;

    const txnAmount = Math.abs(txn.amount);
    const txnDate = new Date(txn.transaction_date);

    for (const inv of userInvoices) {
      const invAmount = inv.net_due ?? inv.amount ?? 0;
      const amountMatch = Math.abs(txnAmount - invAmount) < 0.02;
      if (!amountMatch) continue;

      // Date proximity: within 60 days of invoice due date
      if (inv.due_date) {
        const daysDiff = Math.abs(
          (txnDate.getTime() - new Date(inv.due_date).getTime()) / 86_400_000
        );
        if (daysDiff > 60) continue;
      }

      // Reference match bonus
      const refMatch = inv.invoice_number &&
        txn.description.toLowerCase().includes(inv.invoice_number.toLowerCase());
      const confidence = refMatch ? 0.95 : 0.75;

      matchPayload.push({
        user_id:             user.id,
        bank_transaction_id: txn.id,
        invoice_id:          inv.id,
        match_type:          "auto",
        match_confidence:    confidence,
        project_id:          inv.project_id,
      });
      matched++;
      break; // first match wins
    }
  }

  if (matchPayload.length > 0) {
    await supabase.from("bank_reconciliation").insert(matchPayload);
  }

  revalidatePath(PATH);
  return { success: true, matched };
}

// ── VAT Periods ───────────────────────────────────────────────────────────────

export async function upsertVatPeriodAction(data: {
  id?: string;
  period_start: string;
  period_end: string;
  period_key?: string;
  vat_rate?: number;
  output_vat: number;
  input_vat: number;
  status?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const payload = {
    user_id:      user.id,
    period_start: data.period_start,
    period_end:   data.period_end,
    period_key:   data.period_key || null,
    vat_rate:     data.vat_rate ?? 20,
    output_vat:   data.output_vat,
    input_vat:    data.input_vat,
    status:       data.status || "open",
    notes:        data.notes || null,
  };

  if (data.id) {
    const { error } = await supabase.from("vat_periods")
      .update(payload).eq("id", data.id).eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("vat_periods").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(PATH);
  return { success: true };
}

export async function deleteVatPeriodAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase.from("vat_periods")
    .delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { success: true };
}

// ── Overhead Costs ────────────────────────────────────────────────────────────

export async function upsertOverheadCostAction(data: {
  id?: string;
  cost_date: string;
  category: string;
  description: string;
  amount: number;
  vat_amount?: number;
  supplier?: string;
  reference?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const payload = {
    user_id:     user.id,
    cost_date:   data.cost_date,
    category:    data.category,
    description: data.description,
    amount:      data.amount,
    vat_amount:  data.vat_amount ?? 0,
    supplier:    data.supplier || null,
    reference:   data.reference || null,
    notes:       data.notes || null,
  };

  if (data.id) {
    const { error } = await supabase.from("overhead_costs")
      .update(payload).eq("id", data.id).eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("overhead_costs").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(PATH);
  return { success: true };
}

export async function deleteOverheadCostAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const { error } = await supabase.from("overhead_costs")
    .delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { success: true };
}
