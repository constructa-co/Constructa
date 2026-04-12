import { createClient } from "@/lib/supabase/server";
import SupervisorPortalClient from "./supervisor-portal-client";

export const dynamic = "force-dynamic";

export default async function SupervisorPortalPage({ params }: { params: { token: string } }) {
    const supabase = createClient();
    const { token } = params;

    // Fetch the supervisor token — no auth required (public route)
    const { data: invite } = await supabase
        .from("supervisor_tokens")
        .select("id, user_id, project_id, name, role, expires_at")
        .eq("token", token)
        .single();

    if (!invite) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-slate-100 mb-3">Link Not Found</h1>
                    <p className="text-slate-400">
                        This supervisor portal link is invalid or has been revoked. Please contact the contractor for a new link.
                    </p>
                </div>
            </div>
        );
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-slate-100 mb-3">Link Expired</h1>
                    <p className="text-slate-400">
                        This supervisor portal link has expired. Please contact the contractor for a new link.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch project details
    const { data: project } = await supabase
        .from("projects")
        .select("id, name, client_name, start_date")
        .eq("id", invite.project_id)
        .single();

    // Fetch contractor profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, logo_url, phone")
        .eq("id", invite.user_id)
        .single();

    // Fetch contract settings to get terminology
    const { data: settings } = await supabase
        .from("contract_settings")
        .select("contract_type")
        .eq("project_id", invite.project_id)
        .single();

    // Fetch obligations for this project (all parties — supervisor will see their relevant ones)
    const { data: obligations } = await supabase
        .from("contract_obligations")
        .select("id, label, clause_ref, due_date, status, party, obligation_type, acknowledged_at, acknowledged_by")
        .eq("project_id", invite.project_id)
        .neq("status", "waived")
        .order("due_date", { ascending: true });

    return (
        <SupervisorPortalClient
            token={token}
            invite={invite}
            project={project}
            profile={profile}
            contractType={settings?.contract_type ?? null}
            obligations={obligations ?? []}
        />
    );
}
