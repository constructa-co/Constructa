import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [
        { data: projects },
        { data: profile },
        { data: estimates },
        { data: invoices },
        { data: variations },
        { data: changeEvents },
        { data: rfis },
        { data: ewns },
        { data: contractEvents },
        { data: contractObligations },
    ] = await Promise.all([
        supabase
            .from("projects")
            .select("id, name, client_name, status, potential_value, proposal_status, proposal_sent_at, proposal_accepted_at, proposal_accepted_by, created_at, start_date, programme_phases")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

        supabase
            .from("profiles")
            .select("company_name, logo_url, capability_statement, md_name, md_message, phone, accreditations, years_trading, onboarding_seen_at")
            .eq("id", user.id)
            .single(),

        supabase
            .from("estimates")
            .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, discount_pct, is_active")
            .eq("is_active", true),

        supabase
            .from("invoices")
            .select("id, project_id, amount, status, due_date, paid_date, net_due, retention_held, is_retention_release, period_number, gross_valuation, invoice_date")
            .order("invoice_date", { ascending: false }),

        supabase
            .from("variations")
            .select("id, project_id, amount, status, variation_number, title"),

        supabase
            .from("change_events")
            .select("id, project_id, reference, title, status, value_claimed, value_agreed, time_claimed_days"),

        supabase
            .from("rfis")
            .select("id, project_id, reference, question, status, date_due"),

        supabase
            .from("early_warning_notices")
            .select("id, project_id, reference, title, status, potential_cost_impact, potential_time_impact_days"),

        // Sprint 59 — cross-project contract events with a live time bar.
        // Filtered to status 'open' so closed/agreed CE notices don't sit in the
        // alert banner forever. RLS handles the user_id scoping.
        supabase
            .from("contract_events")
            .select("id, project_id, reference, title, status, time_bar_date, date_aware, event_type")
            .eq("user_id", user.id)
            .eq("status", "open")
            .not("time_bar_date", "is", null),

        // Sprint 59 — cross-project obligations that are open or pending.
        // Anything with a due_date in the past or within the next 7 days
        // surfaces on the home dashboard so the contractor can't miss it.
        supabase
            .from("contract_obligations")
            .select("id, project_id, label, clause_ref, due_date, status")
            .eq("user_id", user.id)
            .neq("status", "complete")
            .not("due_date", "is", null),
    ]);

    return (
        <HomeClient
            projects={projects ?? []}
            profile={profile}
            estimates={estimates ?? []}
            invoices={invoices ?? []}
            variations={variations ?? []}
            changeEvents={changeEvents ?? []}
            rfis={rfis ?? []}
            ewns={ewns ?? []}
            contractEvents={contractEvents ?? []}
            contractObligations={contractObligations ?? []}
            userId={user.id}
        />
    );
}
