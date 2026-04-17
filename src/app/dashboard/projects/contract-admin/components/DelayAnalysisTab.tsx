"use client";

/**
 * P2-6 — extracted from contract-admin-client.tsx (was lines 1171–1467).
 *
 * SCL Delay Analysis Protocol tab. Four methodologies per the Society
 * of Construction Law Delay and Disruption Protocol (2nd Edition):
 * As-Planned vs As-Built, Time Impact, Collapsed As-Built, Windows.
 * All computation lives in src/lib/delay-analysis.ts (pure functions,
 * 12 tests). This component is just the presentation layer.
 *
 * Self-contained — uses its own state entirely and takes only
 * projectId / projectName / contractType as props. No coupling to
 * the rest of the contract-admin dashboard.
 */

import { useState } from "react";
import { Loader2, Play, TrendingDown, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
    runDelayAnalysisAction,
    draftDelayNarrativeAction,
    type DelayMethodology,
} from "../actions";

const METHODOLOGIES: { value: DelayMethodology; label: string; description: string }[] = [
    { value: "as_planned_vs_as_built", label: "As-Planned vs As-Built", description: "Compares baseline finish dates to actual finish dates per phase" },
    { value: "time_impact",            label: "Time Impact Analysis",    description: "Shows how each contract event shifted the completion date" },
    { value: "collapsed_as_built",     label: "Collapsed As-Built",      description: "Removes delay events to show what completion would have been" },
    { value: "windows",                label: "Windows Analysis",        description: "Analyses delay accrual across monthly time windows" },
];

interface Props {
    projectId: string;
    projectName: string;
    contractType?: string;
}

export function DelayAnalysisTab({ projectId, projectName, contractType }: Props) {
    const [methodology, setMethodology] = useState<DelayMethodology>("as_planned_vs_as_built");
    const [windowDays, setWindowDays] = useState(28);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const [narrative, setNarrative] = useState<string | null>(null);
    const [drafting, setDrafting] = useState(false);

    const handleRun = async () => {
        setRunning(true); setResults(null); setNarrative(null);
        try {
            const res = await runDelayAnalysisAction({
                projectId,
                methodology,
                title: `${METHODOLOGIES.find(m => m.value === methodology)?.label ?? methodology} — ${new Date().toLocaleDateString("en-GB")}`,
                windowSizeDays: methodology === "windows" ? windowDays : undefined,
            });
            if (res.success) {
                setResults(res.results);
                setAnalysisId(res.analysisId ?? null);
                toast.success("Delay analysis complete");
            } else {
                toast.error(res.error ?? "Analysis failed");
            }
        } catch { toast.error("Analysis failed"); }
        finally { setRunning(false); }
    };

    const handleNarrative = async () => {
        if (!analysisId || !results) return;
        setDrafting(true);
        try {
            const res = await draftDelayNarrativeAction({
                analysisId, projectId, contractType, methodology, results, projectName,
            });
            if (res.success) { setNarrative(res.narrative ?? null); toast.success("Narrative drafted"); }
            else { toast.error(res.error ?? "Narrative failed"); }
        } catch { toast.error("Narrative failed"); }
        finally { setDrafting(false); }
    };

    return (
        <div className="space-y-5">
            {/* Methodology selector */}
            <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-blue-400" />
                    SCL Delay Analysis Protocol
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                    Select a methodology per the Society of Construction Law Delay and Disruption Protocol (2nd Edition).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {METHODOLOGIES.map(m => (
                        <button
                            key={m.value}
                            onClick={() => setMethodology(m.value)}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                                methodology === m.value
                                    ? "border-blue-500/50 bg-blue-600/10"
                                    : "border-white/10 bg-white/3 hover:border-white/20"
                            }`}
                        >
                            <p className={`text-sm font-medium ${methodology === m.value ? "text-blue-300" : "text-white"}`}>{m.label}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{m.description}</p>
                        </button>
                    ))}
                </div>

                {methodology === "windows" && (
                    <div className="flex items-center gap-3 mb-4">
                        <label className="text-xs text-slate-500">Window size (days):</label>
                        <input
                            type="number" value={windowDays} onChange={e => setWindowDays(Number(e.target.value) || 28)}
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                        />
                    </div>
                )}

                <button
                    onClick={handleRun} disabled={running}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {running ? "Analysing..." : "Run Analysis"}
                </button>
            </div>

            {/* Results */}
            {results && (
                <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-white">Results</h3>

                    {/* As-Planned vs As-Built */}
                    {results.methodology === "as_planned_vs_as_built" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase">Planned Duration</p>
                                    <p className="text-lg font-bold text-white">{results.totalPlannedDuration}d</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase">Actual Duration</p>
                                    <p className="text-lg font-bold text-white">{results.totalActualDuration}d</p>
                                </div>
                                <div className="bg-red-900/20 rounded-lg p-3">
                                    <p className="text-[10px] text-red-400 uppercase">Total Delay</p>
                                    <p className="text-lg font-bold text-red-400">{results.totalProjectDelay}d</p>
                                </div>
                            </div>
                            {Object.keys(results.delaySummaryByCategory || {}).length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-2">Delay by Category</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(results.delaySummaryByCategory).map(([cat, days]) => (
                                            <span key={cat} className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                                                <span className="text-slate-400">{cat}:</span>{" "}
                                                <span className="text-white font-semibold">{days as number}d</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 text-slate-500">
                                            <th className="text-left py-2 px-2">Phase</th>
                                            <th className="text-left py-2 px-2">Planned</th>
                                            <th className="text-left py-2 px-2">Actual</th>
                                            <th className="text-right py-2 px-2">Delay</th>
                                            <th className="text-left py-2 px-2">Cause</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(results.phases ?? []).map((p: any, i: number) => (
                                            <tr key={i} className="border-b border-white/5">
                                                <td className="py-2 px-2 text-white">{p.phaseName}</td>
                                                <td className="py-2 px-2 text-slate-400">{p.plannedStart} → {p.plannedFinish}</td>
                                                <td className="py-2 px-2 text-slate-400">{p.actualStart ?? "—"} → {p.actualFinish ?? "—"}</td>
                                                <td className={`py-2 px-2 text-right font-semibold ${p.delayDays > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                                    {p.delayDays > 0 ? `+${p.delayDays}d` : "On time"}
                                                </td>
                                                <td className="py-2 px-2 text-slate-500">{p.delayCategory ?? p.delayReason ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Time Impact */}
                    {results.methodology === "time_impact" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase">Baseline Completion</p>
                                    <p className="text-sm font-bold text-white">{results.baselineCompletion}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase">Adjusted Completion</p>
                                    <p className="text-sm font-bold text-white">{results.adjustedCompletion}</p>
                                </div>
                                <div className="bg-red-900/20 rounded-lg p-3">
                                    <p className="text-[10px] text-red-400 uppercase">Cumulative Impact</p>
                                    <p className="text-lg font-bold text-red-400">{results.cumulativeImpact}d</p>
                                </div>
                            </div>
                            <table className="w-full text-xs">
                                <thead><tr className="border-b border-white/10 text-slate-500">
                                    <th className="text-left py-2 px-2">Event</th>
                                    <th className="text-left py-2 px-2">Date</th>
                                    <th className="text-right py-2 px-2">Days</th>
                                    <th className="text-left py-2 px-2">Pre</th>
                                    <th className="text-left py-2 px-2">Post</th>
                                </tr></thead>
                                <tbody>{(results.events ?? []).map((e: any, i: number) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="py-2 px-2 text-white">{e.eventRef ? `${e.eventRef} — ` : ""}{e.eventTitle}</td>
                                        <td className="py-2 px-2 text-slate-400">{e.dateRaised}</td>
                                        <td className="py-2 px-2 text-right font-semibold text-red-400">+{e.impactDays}d</td>
                                        <td className="py-2 px-2 text-slate-400">{e.preEventCompletion}</td>
                                        <td className="py-2 px-2 text-slate-400">{e.postEventCompletion}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}

                    {/* Collapsed As-Built */}
                    {results.methodology === "collapsed_as_built" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase">As-Built Completion</p>
                                    <p className="text-sm font-bold text-white">{results.asBuiltCompletion}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase">Collapsed Completion</p>
                                    <p className="text-sm font-bold text-white">{results.collapsedCompletion}</p>
                                </div>
                                <div className="bg-emerald-900/20 rounded-lg p-3">
                                    <p className="text-[10px] text-emerald-400 uppercase">Recoverable Days</p>
                                    <p className="text-lg font-bold text-emerald-400">{results.totalRecoverableDays}d</p>
                                </div>
                            </div>
                            <table className="w-full text-xs">
                                <thead><tr className="border-b border-white/10 text-slate-500">
                                    <th className="text-left py-2 px-2">Event Removed</th>
                                    <th className="text-right py-2 px-2">Days Recovered</th>
                                    <th className="text-left py-2 px-2">Resulting Completion</th>
                                </tr></thead>
                                <tbody>{(results.steps ?? []).map((s: any, i: number) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="py-2 px-2 text-white">{s.eventTitle}</td>
                                        <td className="py-2 px-2 text-right font-semibold text-emerald-400">-{s.daysRecovered}d</td>
                                        <td className="py-2 px-2 text-slate-400">{s.resultingCompletion}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}

                    {/* Windows */}
                    {results.methodology === "windows" && (
                        <div className="space-y-3">
                            <div className="bg-red-900/20 rounded-lg p-3 inline-block">
                                <p className="text-[10px] text-red-400 uppercase">Total Delay</p>
                                <p className="text-lg font-bold text-red-400">{results.totalDelay}d</p>
                            </div>
                            <table className="w-full text-xs">
                                <thead><tr className="border-b border-white/10 text-slate-500">
                                    <th className="text-left py-2 px-2">Window</th>
                                    <th className="text-left py-2 px-2">Period</th>
                                    <th className="text-right py-2 px-2">Planned</th>
                                    <th className="text-right py-2 px-2">Actual</th>
                                    <th className="text-right py-2 px-2">Delay</th>
                                    <th className="text-left py-2 px-2">Cause</th>
                                </tr></thead>
                                <tbody>{(results.windows ?? []).map((w: any, i: number) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="py-2 px-2 text-white">W{w.windowNumber}</td>
                                        <td className="py-2 px-2 text-slate-400">{w.startDate} → {w.endDate}</td>
                                        <td className="py-2 px-2 text-right text-slate-400">{w.plannedProgress}d</td>
                                        <td className="py-2 px-2 text-right text-slate-400">{w.actualProgress}d</td>
                                        <td className={`py-2 px-2 text-right font-semibold ${w.delayAccrued > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                            {w.delayAccrued > 0 ? `+${w.delayAccrued}d` : "—"}
                                        </td>
                                        <td className="py-2 px-2 text-slate-500">{w.dominantCause ?? "—"}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}

                    {/* Generate narrative */}
                    <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                        <button
                            onClick={handleNarrative} disabled={drafting}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            {drafting ? "Drafting..." : "Generate AI Narrative"}
                        </button>
                    </div>

                    {narrative && (
                        <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                            <h4 className="text-sm font-semibold text-white mb-3">AI-Generated Delay Narrative</h4>
                            <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                                {narrative}
                            </div>
                            <button
                                onClick={() => { navigator.clipboard.writeText(narrative); toast.success("Copied"); }}
                                className="mt-3 text-xs text-blue-400 hover:text-blue-300"
                            >
                                Copy to clipboard
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
