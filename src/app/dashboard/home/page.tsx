import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // P0-2 — capture both data AND error for every query. Swallowing errors
    // was silently rendering a "healthy" dashboard when RLS policies or
    // schema changes were actually breaking queries under the hood.
    // Critical queries (projects, estimates) throw and trigger the error
    // boundary. Secondary queries (variations, rfis, etc.) log and fall
    // back to empty arrays but pass a warning flag to the client so the
    // user knows some data failed to load.
    const [
        { data: projects,            error: projectsErr },
        { data: profile,             error: profileErr },
        { data: estimates,           error: estimatesErr },
        { data: invoices,            error: invoicesErr },
        { data: variations,          error: variationsErr },
        { data: changeEvents,        error: changeEventsErr },
        { data: rfis,                error: rfisErr },
        { data: ewns,                error: ewnsErr },
        { data: contractEvents,      error: contractEventsErr },
        { data: contractObligations, error: contractObligationsErr },
    ] = await Promise.all([
        supabase
            .from("projects")
            .select("id, name, client_name, status, potential_value, proposal_status, proposal_sent_at, proposal_accepted_at, proposal_accepted_by, created_at, start_date, programme_phases, validity_days")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

        supabase
            .from("profiles")
            .select("company_name, logo_url, capability_statement, md_name, md_message, phone, accreditations, years_trading, onboarding_seen_at")
            .eq("id", user.id)
            .single(),

        // Stage 5 hardening (19 Apr 2026): added prelims_pct + estimate_lines
        // so home-client can use computeContractSumValue (canonical) instead
        // of the hand-rolled compound math it had before — which hard-coded
        // a 5% risk rate and ignored the estimate's actual risk_pct.
        supabase
            .from("estimates")
            .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, discount_pct, is_active, estimate_lines(trade_section, line_total)")
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
        supabase
            .from("contract_events")
            .select("id, project_id, reference, title, status, time_bar_date, date_aware, event_type")
            .eq("user_id", user.id)
            .eq("status", "open")
            .not("time_bar_date", "is", null),

        // Sprint 59 — cross-project obligations that are open or pending.
        supabase
            .from("contract_obligations")
            .select("id, project_id, label, clause_ref, due_date, status")
            .eq("user_id", user.id)
            .neq("status", "complete")
            .not("due_date", "is", null),
    ]);

    // Critical queries — if these fail, the dashboard would be lying to the
    // contractor. Throw to trigger the route's error boundary.
    if (projectsErr) {
        console.error("[home] projects query failed", projectsErr);
        throw new Error(`Projects failed to load: ${projectsErr.message}`);
    }
    if (estimatesErr) {
        console.error("[home] estimates query failed", estimatesErr);
        throw new Error(`Estimates failed to load: ${estimatesErr.message}`);
    }

    // Secondary queries — log and degrade. The client gets a warning flag
    // so the user knows some panels may be incomplete.
    const secondaryErrors: string[] = [];
    if (profileErr) { console.error("[home] profile query failed", profileErr); secondaryErrors.push("profile"); }
    if (invoicesErr) { console.error("[home] invoices query failed", invoicesErr); secondaryErrors.push("invoices"); }
    if (variationsErr) { console.error("[home] variations query failed", variationsErr); secondaryErrors.push("variations"); }
    if (changeEventsErr) { console.error("[home] change_events query failed", changeEventsErr); secondaryErrors.push("change events"); }
    if (rfisErr) { console.error("[home] rfis query failed", rfisErr); secondaryErrors.push("RFIs"); }
    if (ewnsErr) { console.error("[home] ewns query failed", ewnsErr); secondaryErrors.push("early warning notices"); }
    if (contractEventsErr) { console.error("[home] contract_events query failed", contractEventsErr); secondaryErrors.push("contract events"); }
    if (contractObligationsErr) { console.error("[home] contract_obligations query failed", contractObligationsErr); secondaryErrors.push("obligations"); }

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
            dataWarnings={secondaryErrors}
        />
    );
}
