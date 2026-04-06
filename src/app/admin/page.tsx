import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface SubscriberRow {
    id: string;
    company_name: string | null;
    email: string | null;
    created_at: string;
    project_count: number;
    proposals_sent: number;
    estimates_created: number;
    contracts_reviewed: number;
    last_active: string | null;
}

export interface AdminStats {
    subscribers: SubscriberRow[];
    totals: {
        total_subscribers: number;
        active_30d: number;
        total_projects: number;
        total_proposals_sent: number;
        total_estimates: number;
        total_contracts_reviewed: number;
    };
}

export default async function AdminPage() {
    const supabase = createAdminClient();

    // --- Fetch all raw data in parallel ---
    const [
        { data: profiles },
        { data: authUsers },
        { data: projects },
        { data: estimates },
        { data: contractFlags },
    ] = await Promise.all([
        // All profiles
        supabase
            .from("profiles")
            .select("id, company_name, created_at")
            .order("created_at", { ascending: false }),

        // Auth users for emails (service role only)
        supabase.auth.admin.listUsers({ perPage: 1000 }),

        // All projects with proposal status and timestamps
        supabase
            .from("projects")
            .select("id, user_id, proposal_status, updated_at, created_at"),

        // All estimates (just id + project_id → join to user)
        supabase
            .from("estimates")
            .select("id, project_id"),

        // Contract review flags (each row = one reviewed contract upload)
        supabase
            .from("projects")
            .select("user_id, contract_review_flags")
            .not("contract_review_flags", "is", null),
    ]);

    // Build a map of project_id → user_id
    const projectUserMap = new Map<string, string>(
        (projects || []).map((p: any) => [p.id, p.user_id])
    );

    // Build email map from auth users
    const emailMap = new Map<string, string>();
    ((authUsers as any)?.users || []).forEach((u: any) => {
        if (u.id && u.email) emailMap.set(u.id, u.email);
    });

    // Build per-user stats
    const userProjects = new Map<string, any[]>();
    (projects || []).forEach((p: any) => {
        if (!userProjects.has(p.user_id)) userProjects.set(p.user_id, []);
        userProjects.get(p.user_id)!.push(p);
    });

    const userEstimates = new Map<string, number>();
    (estimates || []).forEach((e: any) => {
        const userId = projectUserMap.get(e.project_id);
        if (userId) {
            userEstimates.set(userId, (userEstimates.get(userId) || 0) + 1);
        }
    });

    const userContracts = new Map<string, number>();
    (contractFlags || []).forEach((p: any) => {
        const flags = p.contract_review_flags as any[];
        if (flags && flags.length > 0) {
            userContracts.set(
                p.user_id,
                (userContracts.get(p.user_id) || 0) + 1
            );
        }
    });

    // 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Assemble subscriber rows
    const subscribers: SubscriberRow[] = (profiles || []).map((profile: any) => {
        const userProjectList = userProjects.get(profile.id) || [];
        const proposalsSent = userProjectList.filter(
            (p: any) =>
                p.proposal_status &&
                p.proposal_status !== "draft"
        ).length;

        // Last active = most recent project updated_at
        const lastActiveStr = userProjectList.reduce(
            (best: string | null, p: any) => {
                if (!best) return p.updated_at;
                return p.updated_at > best ? p.updated_at : best;
            },
            null
        );

        return {
            id: profile.id,
            company_name: profile.company_name,
            email: emailMap.get(profile.id) || null,
            created_at: profile.created_at,
            project_count: userProjectList.length,
            proposals_sent: proposalsSent,
            estimates_created: userEstimates.get(profile.id) || 0,
            contracts_reviewed: userContracts.get(profile.id) || 0,
            last_active: lastActiveStr,
        };
    });

    // Platform totals
    const totalProjects = (projects || []).length;
    const totalProposalsSent = (projects || []).filter(
        (p: any) => p.proposal_status && p.proposal_status !== "draft"
    ).length;
    const totalEstimates = (estimates || []).length;
    const totalContracts = subscribers.reduce(
        (sum, s) => sum + s.contracts_reviewed,
        0
    );

    const active30d = subscribers.filter((s) => {
        if (!s.last_active) return false;
        return new Date(s.last_active) >= thirtyDaysAgo;
    }).length;

    const stats: AdminStats = {
        subscribers,
        totals: {
            total_subscribers: subscribers.length,
            active_30d: active30d,
            total_projects: totalProjects,
            total_proposals_sent: totalProposalsSent,
            total_estimates: totalEstimates,
            total_contracts_reviewed: totalContracts,
        },
    };

    return <AdminClient stats={stats} />;
}
