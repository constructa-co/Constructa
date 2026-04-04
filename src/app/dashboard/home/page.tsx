import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Projects — all fields needed for command centre
    const { data: projects } = await supabase
        .from("projects")
        .select(
            "id, name, client_name, status, potential_value, proposal_status, proposal_sent_at, proposal_accepted_at, created_at, updated_at, validity_days"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    // Full profile for completion scoring
    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, logo_url, capability_statement, md_name, md_message, phone, accreditations, years_trading")
        .eq("id", user.id)
        .single();

    // Active estimate totals
    const { data: estimates } = await supabase
        .from("estimates")
        .select("project_id, total_cost, overhead_pct, profit_pct, risk_pct, prelims_pct, is_active")
        .eq("is_active", true);

    // Billing invoices (table may not exist yet)
    let invoices: any[] = [];
    try {
        const { data } = await supabase
            .from("invoices")
            .select("id, amount, status, project_id")
            .in("status", ["draft", "sent"])
            .limit(50);
        invoices = data || [];
    } catch {
        invoices = [];
    }

    return (
        <HomeClient
            projects={projects || []}
            estimates={estimates || []}
            invoices={invoices}
            profile={profile}
            userId={user.id}
        />
    );
}
