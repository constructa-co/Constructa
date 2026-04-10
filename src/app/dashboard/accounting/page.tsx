import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountingClient from "./accounting-client";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Projects (for linking unmatched transactions)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, status")
    .eq("user_id", user.id)
    .not("status", "eq", "lost")
    .order("name");

  // Invoices (for reconciliation matching)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, net_due, status, due_date, paid_date, project_id, period_number")
    .in("project_id", (projects ?? []).map(p => p.id))
    .order("due_date", { ascending: false });

  // Bank transactions
  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("id, transaction_date, description, reference, amount, balance, source_file, import_batch_id, created_at")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false });

  // Reconciliation records
  const { data: reconciliation } = await supabase
    .from("bank_reconciliation")
    .select("id, bank_transaction_id, invoice_id, match_type, match_confidence, category, project_id, notes")
    .eq("user_id", user.id);

  // VAT periods
  const { data: vatPeriods } = await supabase
    .from("vat_periods")
    .select("id, period_start, period_end, period_key, vat_rate, output_vat, input_vat, status, submitted_at, notes")
    .eq("user_id", user.id)
    .order("period_start", { ascending: false });

  // Overhead costs
  const { data: overheadCosts } = await supabase
    .from("overhead_costs")
    .select("id, cost_date, category, description, amount, vat_amount, supplier, reference, notes")
    .eq("user_id", user.id)
    .order("cost_date", { ascending: false });

  // Project expenses (for company P&L)
  const { data: projectExpenses } = await supabase
    .from("project_expenses")
    .select("id, project_id, description, amount, cost_date, cost_type, cost_status")
    .in("project_id", (projects ?? []).map(p => p.id))
    .eq("cost_status", "actual")
    .order("cost_date", { ascending: false });

  // Staff resources (for overhead headcount)
  const { data: staffResources } = await supabase
    .from("staff_resources")
    .select("id, name, job_title, staff_type, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true);

  return (
    <AccountingClient
      projects={projects ?? []}
      invoices={invoices ?? []}
      transactions={transactions ?? []}
      reconciliation={reconciliation ?? []}
      vatPeriods={vatPeriods ?? []}
      overheadCosts={overheadCosts ?? []}
      projectExpenses={projectExpenses ?? []}
      staffResources={staffResources ?? []}
    />
  );
}
