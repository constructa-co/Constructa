"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, FileCheck2, History } from "lucide-react";

export interface ProposalPublicationHistoryRow {
    id: string;
    version_number: number;
    status: "sent" | "viewed" | "acknowledged" | "accepted" | "declined" | "revoked";
    sent_at: string;
    expires_at: string;
    first_viewed_at: string | null;
    responded_at: string | null;
    responded_by: string | null;
    superseded_by: string | null;
    snapshot_hash: string;
}

function formatDate(value: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const STATUS_STYLES: Record<ProposalPublicationHistoryRow["status"], string> = {
    sent: "bg-blue-500/15 text-blue-300",
    viewed: "bg-cyan-500/15 text-cyan-300",
    acknowledged: "bg-emerald-500/15 text-emerald-300",
    accepted: "bg-emerald-500/15 text-emerald-300",
    declined: "bg-red-500/15 text-red-300",
    revoked: "bg-slate-700/60 text-slate-400",
};

export default function PublicationHistoryPanel({
    publications,
}: {
    publications: ProposalPublicationHistoryRow[];
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-slate-100"
            >
                <span className="flex items-center gap-2 font-medium">
                    <History className="h-4 w-4 text-blue-400" />
                    Published history
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                        {publications.length}
                    </span>
                </span>
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {open && (
                <div className="divide-y divide-slate-800 border-t border-slate-700/60">
                    {publications.map((publication) => (
                        <div key={publication.id} className="space-y-2 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                                    <FileCheck2 className="h-4 w-4 text-blue-400" />
                                    Version {publication.version_number}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[publication.status]}`}>
                                    {publication.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">Published {formatDate(publication.sent_at)}</p>
                            {publication.first_viewed_at && (
                                <p className="flex items-center gap-1 text-xs text-slate-400">
                                    <Eye className="h-3.5 w-3.5" /> Viewed {formatDate(publication.first_viewed_at)}
                                </p>
                            )}
                            {publication.responded_at && (
                                <p className="text-xs text-slate-400">
                                    Response recorded {formatDate(publication.responded_at)}
                                    {publication.responded_by ? ` by ${publication.responded_by}` : ""}
                                </p>
                            )}
                            <p className="font-mono text-[10px] text-slate-600" title={publication.snapshot_hash}>
                                Snapshot {publication.snapshot_hash.slice(0, 12)}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
