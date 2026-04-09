"use client";

import { useState } from "react";
import type { AdminData } from "../types";

interface Props { data: AdminData; }

function pct(n: number | null): string {
    if (n == null) return "—";
    return n.toFixed(1) + "%";
}
function days(n: number | null): string {
    if (n == null) return "—";
    return n.toFixed(0) + "d";
}
function num(n: number): string {
    return n.toLocaleString();
}

const BAND_ORDER = ["0-50k", "50k-100k", "100k-250k", "250k-500k", "500k+"];

export default function BenchmarksTab({ data }: Props) {
    const b = data.benchmarks;
    const [filterType, setFilterType] = useState<string>("all");

    const projectTypes = Array.from(new Set(b.rows.map(r => r.project_type ?? "Unknown"))).sort();
    const filtered = filterType === "all" ? b.rows : b.rows.filter(r => (r.project_type ?? "Unknown") === filterType);

    // Sort by type then band
    const sorted = [...filtered].sort((a, b) => {
        const typeCmp = (a.project_type ?? "").localeCompare(b.project_type ?? "");
        if (typeCmp !== 0) return typeCmp;
        return BAND_ORDER.indexOf(a.contract_value_band ?? "") - BAND_ORDER.indexOf(b.contract_value_band ?? "");
    });

    function marginColour(m: number | null): string {
        if (m == null) return "text-zinc-400";
        if (m >= 15) return "text-emerald-400";
        if (m >= 5) return "text-amber-400";
        return "text-red-400";
    }

    return (
        <div className="space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Benchmark Contributions", value: num(b.totalContributions), sub: "Closed projects in dataset" },
                    { label: "Consented Contractors", value: num(b.consentedContractors), sub: "Data sharing enabled" },
                    { label: "Avg Gross Margin", value: pct(b.avgMarginAll), sub: "Across all project types" },
                    { label: "Avg Programme Delay", value: days(b.avgDelayAll), sub: "Actual vs planned duration" },
                ].map((k, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                        <p className="text-xs text-zinc-400 mb-1">{k.label}</p>
                        <p className="text-2xl font-bold text-white">{k.value}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{k.sub}</p>
                    </div>
                ))}
            </div>

            {b.totalContributions === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
                    <p className="text-zinc-400 text-sm mb-2">No benchmark data yet</p>
                    <p className="text-zinc-500 text-xs max-w-md mx-auto">
                        Benchmark rows are written automatically when a contractor archives a project and has enabled
                        data sharing in their profile settings. Data is fully anonymised — no PII is stored.
                    </p>
                </div>
            ) : (
                <>
                    {/* Filter */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-zinc-400">Filter by type:</span>
                        {["all", ...projectTypes].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    filterType === t
                                        ? "bg-amber-500/20 border-amber-600 text-amber-300"
                                        : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                {t === "all" ? "All types" : t}
                            </button>
                        ))}
                    </div>

                    {/* Benchmark table */}
                    <div className="rounded-xl border border-zinc-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                                    <th className="text-left px-4 py-3">Project Type</th>
                                    <th className="text-left px-4 py-3">Value Band</th>
                                    <th className="text-right px-4 py-3">Count</th>
                                    <th className="text-right px-4 py-3">Avg Margin %</th>
                                    <th className="text-right px-4 py-3">Var Rate %</th>
                                    <th className="text-right px-4 py-3">Avg Delay</th>
                                    <th className="text-right px-4 py-3">Subcontract %</th>
                                    <th className="text-right px-4 py-3">On Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                        <td className="px-4 py-3 text-zinc-300">{r.project_type ?? "—"}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                                                £{r.contract_value_band ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-400">{r.count}</td>
                                        <td className={`px-4 py-3 text-right font-medium ${marginColour(r.avg_gross_margin_pct)}`}>
                                            {pct(r.avg_gross_margin_pct)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-300">{pct(r.avg_variation_rate_pct)}</td>
                                        <td className={`px-4 py-3 text-right ${(r.avg_programme_delay_days ?? 0) > 14 ? "text-red-400" : (r.avg_programme_delay_days ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                                            {days(r.avg_programme_delay_days)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-300">{pct(r.avg_subcontract_cost_pct)}</td>
                                        <td className="px-4 py-3 text-right text-zinc-300">{pct(r.pct_delivered_on_time)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {sorted.length > 1 && (
                                <tfoot>
                                    <tr className="border-t border-zinc-700 text-sm font-semibold">
                                        <td colSpan={2} className="px-4 py-3 text-zinc-300">
                                            Totals / Averages ({filtered.reduce((s, r) => s + r.count, 0)} projects)
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-300">
                                            {filtered.reduce((s, r) => s + r.count, 0)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${marginColour(b.avgMarginAll)}`}>
                                            {pct(b.avgMarginAll)}
                                        </td>
                                        <td colSpan={4} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    <p className="text-xs text-zinc-600">
                        All data is anonymised at source — no company names, client names, or addresses are stored.
                        Contract values are stored as bands only. Each row represents aggregated outcomes from
                        contractors who have enabled data sharing in their profile settings.
                    </p>
                </>
            )}
        </div>
    );
}
