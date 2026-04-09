import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ManagementAccountsClient from "./management-accounts-client";

export default async function ManagementAccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: projects },
    { data: estimates },
    { data: invoices },
    { data: expenses },
    { data: variations },
    { data: snapshots },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("financial_year_start_month, company_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, name, client_name, project_type, status, start_date, is_archived, archived_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("estimates")
      .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("invoices")
      .select("project_id, amount, status, created_at, due_date, paid_date, net_due, retention_held, retention_pct")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("project_expenses")
      .select("project_id, amount, expense_date, cost_type, cost_status")
      .eq("user_id", user.id)
      .order("expense_date", { ascending: true }),
    supabase
      .from("variations")
      .select("project_id, amount, status, date_instructed")
      .eq("user_id", user.id),
    supabase
      .from("archive_snapshots")
      .select("project_id, contract_value, total_costs_posted, gross_margin_pct, total_invoiced, total_paid, retention_outstanding, final_account_amount, snapshot_date")
      .eq("user_id", user.id),
  ]);

  return (
    <ManagementAccountsClient
      profile={profile ?? { financial_year_start_month: 4, company_name: null }}
      projects={projects ?? []}
      estimates={estimates ?? []}
      invoices={invoices ?? []}
      expenses={expenses ?? []}
      variations={variations ?? []}
      snapshots={snapshots ?? []}
    />
  );
}
