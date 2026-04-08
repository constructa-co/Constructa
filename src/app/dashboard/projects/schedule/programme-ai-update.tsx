"use client";

import { useState, useTransition } from "react";
import { generateWeeklyUpdateAction, getProgrammeUpdatesAction } from "./actions";
import { Loader2, Sparkles, ChevronDown, ChevronUp, Copy, CheckCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
    projectId: string;
    projectName: string;
}

export default function ProgrammeAiUpdate({ projectId, projectName }: Props) {
    const [isPending, startTransition] = useTransition();
    const [narrative, setNarrative]   = useState<string | null>(null);
    const [history, setHistory]       = useState<{ id: string; narrative: string; created_at: string }[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [copied, setCopied]         = useState(false);

    const handleGenerate = () => {
        startTransition(async () => {
            try {
                const text = await generateWeeklyUpdateAction(projectId);
                setNarrative(text);
                toast.success("Weekly update generated");
            } catch (err: any) {
                toast.error(err.message || "Failed to generate update");
            }
        });
    };

    const handleLoadHistory = async () => {
        if (showHistory) { setShowHistory(false); return; }
        const data = await getProgrammeUpdatesAction(projectId);
        setHistory(data);
        setShowHistory(true);
    };

    const handleCopy = async () => {
        if (!narrative) return;
        await navigator.clipboard.writeText(narrative);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        AI Weekly Progress Update
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Generates a professional update email based on your phase progress above</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleLoadHistory}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-400 border border-slate-700 rounded-lg hover:text-slate-200 hover:border-slate-500 transition-colors flex items-center gap-1"
                    >
                        History
                        {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                        {isPending
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                            : <><Sparkles className="w-4 h-4" /> Generate Update</>
                        }
                    </button>
                </div>
            </div>

            {/* Generated narrative */}
            {narrative && (
                <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Weekly Progress Update — {projectName}</p>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-400 border border-slate-700 rounded-lg hover:text-slate-200 hover:border-slate-500 transition-colors"
                        >
                            {copied ? <><CheckCheck className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </button>
                    </div>
                    <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {narrative}
                    </div>
                </div>
            )}

            {/* History panel */}
            {showHistory && (
                <div className="space-y-3">
                    {history.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">No previous updates generated</p>
                    )}
                    {history.map(h => (
                        <div key={h.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
                            <p className="text-[11px] text-slate-500 mb-2">
                                {new Date(h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{h.narrative}</p>
                            <button
                                onClick={() => { setNarrative(h.narrative); setShowHistory(false); }}
                                className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                            >
                                View full →
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
