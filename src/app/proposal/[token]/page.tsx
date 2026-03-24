import { createClient } from "@/lib/supabase/server";
import AcceptanceClient from "./acceptance-client";

export const dynamic = "force-dynamic";

export default async function ProposalAcceptancePage({ params }: { params: { token: string } }) {
    const supabase = createClient();
    const { token } = params;

    // Fetch project by proposal_token — no auth required (public route)
    const { data: project } = await supabase
        .from("projects")
        .select("id, name, client_name, potential_value, proposal_sent_at, proposal_accepted_at, proposal_accepted_by, user_id")
        .eq("proposal_token", token)
        .single();

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-slate-100 mb-3">Proposal Not Found</h1>
                    <p className="text-slate-400">
                        This proposal link is invalid or has expired. Please contact the contractor for a new link.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch contractor company name
    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name")
        .eq("id", project.user_id)
        .single();

    const companyName = profile?.company_name || "The Contractor";

    // Check if proposal was sent more than 30 days ago (expired)
    const sentAt = project.proposal_sent_at ? new Date(project.proposal_sent_at) : null;
    const isExpired = sentAt ? (Date.now() - sentAt.getTime()) > 30 * 86400000 : false;

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-lg w-full">
                {/* Company heading */}
                <div className="text-center mb-8">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">{companyName}</h2>
                    <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
                    <p className="text-slate-400 mt-2">Prepared for <span className="text-slate-200 font-semibold">{project.client_name || "Valued Client"}</span></p>
                </div>

                {/* Details */}
                <div className="bg-slate-800 rounded-xl p-5 mb-6 space-y-3">
                    {project.potential_value && (
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Contract Value</span>
                            <span className="text-lg font-bold text-slate-100">
                                £{Number(project.potential_value).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    {sentAt && (
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Issued</span>
                            <span className="text-sm text-slate-200">
                                {sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                        </div>
                    )}
                    {sentAt && (
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Valid Until</span>
                            <span className="text-sm text-slate-200">
                                {new Date(sentAt.getTime() + 30 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Status */}
                {project.proposal_accepted_at ? (
                    <div className="bg-green-900/30 border border-green-800 rounded-xl p-5 text-center">
                        <div className="text-green-400 text-lg font-bold mb-1">Proposal Accepted</div>
                        <p className="text-sm text-green-300/70">
                            Accepted on {new Date(project.proposal_accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                            {project.proposal_accepted_by && ` by ${project.proposal_accepted_by}`}
                        </p>
                        <p className="text-sm text-slate-400 mt-3">
                            {companyName} will be in touch shortly.
                        </p>
                    </div>
                ) : isExpired ? (
                    <div className="bg-red-900/30 border border-red-800 rounded-xl p-5 text-center">
                        <div className="text-red-400 text-lg font-bold mb-1">Proposal Expired</div>
                        <p className="text-sm text-red-300/70">
                            This proposal has passed its validity period. Please contact {companyName} for an updated proposal.
                        </p>
                    </div>
                ) : (
                    <AcceptanceClient
                        projectId={project.id}
                        token={token}
                        clientName={project.client_name || ""}
                        companyName={companyName}
                    />
                )}
            </div>
        </div>
    );
}
