"use client";

import { useState } from "react";
import { History, RotateCcw, ChevronDown, ChevronUp, Tag, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProposalVersionRow } from "./actions";
import { restoreProposalVersionAction } from "./actions";

interface Props {
    projectId: string;
    versions: ProposalVersionRow[];
    currentVersionNumber: number;
    onRestored: () => void; // called after a successful restore so parent can refresh
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function VersionHistoryPanel({ projectId, versions, currentVersionNumber, onRestored }: Props) {
    const [open, setOpen] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    if (versions.length === 0) return null;

    async function handleRestore(versionId: string, versionNumber: number) {
        if (confirmId !== versionId) {
            setConfirmId(versionId);
            return;
        }
        setConfirmId(null);
        setRestoringId(versionId);
        try {
            const res = await restoreProposalVersionAction(projectId, versionId);
            if (res.success) {
                toast.success(`Restored to v${versionNumber} — page will reload`);
                onRestored();
            } else {
                toast.error(res.error || "Restore failed");
            }
        } finally {
            setRestoringId(null);
        }
    }

    return (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
            {/* Header / toggle */}
            <button
                onClick={() => setOpen((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
            >
                <span className="flex items-center gap-2 font-medium">
                    <History className="w-4 h-4 text-amber-400" />
                    Version History
                    <span className="ml-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                        {versions.length} {versions.length === 1 ? "version" : "versions"}
                    </span>
                </span>
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {open && (
                <div className="border-t border-slate-700/60 divide-y divide-slate-800">
                    {versions.map((v) => {
                        const isCurrent = v.version_number === currentVersionNumber;
                        const isRestoring = restoringId === v.id;
                        const isConfirming = confirmId === v.id;

                        return (
                            <div
                                key={v.id}
                                className={[
                                    "flex items-start justify-between gap-3 px-4 py-3",
                                    isCurrent ? "bg-amber-950/20" : "hover:bg-slate-800/30",
                                ].join(" ")}
                            >
                                {/* Left: version info */}
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="mt-0.5 flex-shrink-0">
                                        {isCurrent ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                                                <Tag className="w-3 h-3" /> v{v.version_number}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-400">
                                                v{v.version_number}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-400">{formatDate(v.created_at)}</p>
                                        {v.notes && (
                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-300 leading-snug">
                                                <FileText className="w-3 h-3 shrink-0 text-slate-500" />
                                                <span className="truncate">{v.notes}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: restore button (only for non-current) */}
                                {!isCurrent && (
                                    <div className="flex-shrink-0">
                                        {isRestoring ? (
                                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Restoring…
                                            </span>
                                        ) : isConfirming ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-amber-400">Confirm?</span>
                                                <button
                                                    onClick={() => handleRestore(v.id, v.version_number)}
                                                    className="rounded px-2 py-0.5 text-xs font-medium bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => setConfirmId(null)}
                                                    className="rounded px-2 py-0.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleRestore(v.id, v.version_number)}
                                                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                                                title={`Restore v${v.version_number}`}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                Restore
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
