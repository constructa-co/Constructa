"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
    Shield, CheckCircle2, Clock, AlertTriangle, AlertCircle,
    FileText, Loader2, Check,
} from "lucide-react";
import { acknowledgeObligationAction } from "./actions";

interface Obligation {
    id: string;
    label: string;
    clause_ref?: string | null;
    due_date?: string | null;
    status: string;
    party?: string | null;
    obligation_type?: string | null;
    acknowledged_at?: string | null;
    acknowledged_by?: string | null;
}

interface Props {
    token: string;
    invite: {
        id: string;
        name: string;
        role: string;
        project_id: string;
    };
    project: { id: string; name: string; client_name?: string | null; start_date?: string | null } | null;
    profile: { company_name?: string | null; logo_url?: string | null; phone?: string | null } | null;
    contractType: string | null;
    obligations: Obligation[];
}

function fmtDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d: string): number {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((new Date(d + "T00:00:00").getTime() - now.getTime()) / 86400000);
}

function StatusBadge({ status, dueDate }: { status: string; dueDate?: string | null }) {
    if (status === "complete") return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Complete
        </span>
    );
    if (dueDate) {
        const days = daysUntil(dueDate);
        if (days < 0) return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-950/40 px-2 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" /> Overdue ({Math.abs(days)}d)
            </span>
        );
        if (days <= 7) return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-950/40 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Due in {days}d
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" /> Pending
        </span>
    );
}

export default function SupervisorPortalClient({ token, invite, project, profile, contractType, obligations }: Props) {
    const [ackName, setAckName] = useState(invite.name);
    const [acknowledging, setAcknowledging] = useState<string | null>(null);
    const [acked, setAcked] = useState<Set<string>>(
        new Set(obligations.filter(o => o.acknowledged_at).map(o => o.id)),
    );

    const handleAcknowledge = async (obligationId: string) => {
        if (!ackName.trim()) { toast.error("Please enter your name"); return; }
        setAcknowledging(obligationId);
        try {
            const result = await acknowledgeObligationAction(token, obligationId, ackName.trim());
            if (result.success) {
                setAcked(prev => new Set([...prev, obligationId]));
                toast.success("Obligation acknowledged");
            } else {
                toast.error(result.error ?? "Failed to acknowledge");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setAcknowledging(null);
        }
    };

    const supervisorObligations = obligations.filter(o =>
        o.party === "supervisor" || o.party === "engineer" || o.party === "pm",
    );
    const contractorObligations = obligations.filter(o =>
        o.party === "contractor" || !o.party,
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-5 h-5 text-blue-400" />
                            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                                Supervisor Portal
                            </span>
                        </div>
                        <h1 className="text-xl font-bold">{project?.name ?? "Project"}</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {profile?.company_name ?? "Contractor"} &middot; {invite.name} ({invite.role})
                        </p>
                    </div>
                    {contractType && (
                        <span className="text-xs font-medium bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-400">
                            {contractType.replace(/_/g, " ")}
                        </span>
                    )}
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                {/* Your name (for acknowledgment) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                        Your name (for acknowledgment records)
                    </label>
                    <input
                        type="text"
                        value={ackName}
                        onChange={e => setAckName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>

                {/* Supervisor obligations */}
                <div>
                    <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        Your Obligations ({supervisorObligations.length})
                    </h2>
                    {supervisorObligations.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No obligations assigned to you on this project.</p>
                    ) : (
                        <div className="space-y-3">
                            {supervisorObligations.map(ob => {
                                const isAcked = acked.has(ob.id);
                                return (
                                    <div key={ob.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white">{ob.label}</p>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {ob.clause_ref && (
                                                        <span className="text-xs text-slate-500">cl. {ob.clause_ref}</span>
                                                    )}
                                                    {ob.due_date && (
                                                        <span className="text-xs text-slate-500">Due: {fmtDate(ob.due_date)}</span>
                                                    )}
                                                    <StatusBadge status={ob.status} dueDate={ob.due_date} />
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                {isAcked ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                                        <Check className="w-3.5 h-3.5" /> Acknowledged
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAcknowledge(ob.id)}
                                                        disabled={acknowledging === ob.id}
                                                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {acknowledging === ob.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5" />
                                                        )}
                                                        Acknowledge
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Contractor obligations (read-only visibility) */}
                {contractorObligations.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            Contractor Obligations ({contractorObligations.length})
                        </h2>
                        <div className="space-y-2">
                            {contractorObligations.map(ob => (
                                <div key={ob.id} className="bg-slate-900/60 border border-slate-800/60 rounded-lg px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-300">{ob.label}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                {ob.clause_ref && <span className="text-xs text-slate-600">cl. {ob.clause_ref}</span>}
                                                {ob.due_date && <span className="text-xs text-slate-600">Due: {fmtDate(ob.due_date)}</span>}
                                            </div>
                                        </div>
                                        <StatusBadge status={ob.status} dueDate={ob.due_date} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-slate-600 pt-8 border-t border-slate-800">
                    <p>This portal is provided by {profile?.company_name ?? "the contractor"} via Constructa.</p>
                    <p className="mt-1">Acknowledgment records are stored for audit purposes.</p>
                </div>
            </div>
        </div>
    );
}
