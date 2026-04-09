"use client";

import type { AdminData, AtRiskDetail } from "../types";

interface Props { data: AdminData; }

function fmtDate(s: string | null): string {
    if (!s) return "Never";
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function riskLabel(score: number): { label: string; cls: string } {
    if (score >= 3) return { label: "High", cls: "bg-red-900/50 text-red-300 border border-red-800" };
    if (score >= 2) return { label: "Medium", cls: "bg-amber-900/50 text-amber-300 border border-amber-800" };
    return { label: "Low", cls: "bg-blue-900/50 text-blue-300 border border-blue-800" };
}

export default function IntelligenceTab({ data }: Props) {
    const intel = data.intelligence;
    const ph = intel.platformHealth;

    const highRisk = intel.atRisk.filter(u => u.risk_score >= 3);
    const medRisk  = intel.atRisk.filter(u => u.risk_score === 2);
    const lowRisk  = intel.atRisk.filter(u => u.risk_score === 1);

    return (
        <div className="space-y-8">

            {/* ── Platform health KPIs ─────────────────────────────────────────── */}
            <div>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Platform Health</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        {
                            label: "Activation Rate",
                            value: `${ph.activationRate}%`,
                            sub: "Users who started ≥1 project",
                            colour: ph.activationRate >= 60 ? "text-emerald-400" : ph.activationRate >= 30 ? "text-amber-400" : "text-red-400",
                        },
                        {
                            label: "Proposal Conversion",
                            value: `${ph.proposalConversionRate}%`,
                            sub: "Proposals sent → accepted",
                            colour: ph.proposalConversionRate >= 40 ? "text-emerald-400" : "text-amber-400",
                        },
                        {
                            label: "Avg Time to First Project",
                            value: `${ph.avgTimeToFirstProject}d`,
                            sub: "From signup to project created",
                            colour: ph.avgTimeToFirstProject <= 3 ? "text-emerald-400" : ph.avgTimeToFirstProject <= 7 ? "text-amber-400" : "text-red-400",
                        },
                        {
                            label: "Power Users",
                            value: ph.powerUsers.toString(),
                            sub: "Users with ≥3 active projects",
                            colour: "text-white",
                        },
                    ].map((k, i) => (
                        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs text-zinc-400 mb-1">{k.label}</p>
                            <p className={`text-2xl font-bold ${k.colour}`}>{k.value}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{k.sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Feature heatmap ──────────────────────────────────────────────── */}
            <div>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Feature Usage</h2>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                                <th className="text-left px-4 py-3">Feature</th>
                                <th className="text-right px-4 py-3">Users</th>
                                <th className="px-4 py-3 w-48">Adoption</th>
                                <th className="text-right px-4 py-3">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {intel.featureHeatmap.map((f, i) => (
                                <tr key={i} className="border-b border-zinc-800/50">
                                    <td className="px-4 py-3 text-zinc-200">
                                        <span className="mr-2">{f.icon}</span>{f.feature}
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-300">{f.users}</td>
                                    <td className="px-4 py-3">
                                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    f.pct >= 60 ? "bg-emerald-500" :
                                                    f.pct >= 30 ? "bg-amber-500" :
                                                    "bg-zinc-500"
                                                }`}
                                                style={{ width: `${Math.min(f.pct, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium ${
                                        f.pct >= 60 ? "text-emerald-400" :
                                        f.pct >= 30 ? "text-amber-400" :
                                        "text-zinc-400"
                                    }`}>{f.pct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── At-risk accounts ─────────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">At-Risk Accounts</h2>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="text-red-400 font-medium">{highRisk.length} High</span>
                        <span className="text-amber-400 font-medium">{medRisk.length} Medium</span>
                        <span className="text-blue-400 font-medium">{lowRisk.length} Low</span>
                        <span>· {intel.atRisk.length} total flagged</span>
                    </div>
                </div>

                {intel.atRisk.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
                        No at-risk accounts detected — all users are active or too new to evaluate.
                    </div>
                ) : (
                    <div className="rounded-xl border border-zinc-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                                    <th className="text-left px-4 py-3">Account</th>
                                    <th className="text-left px-4 py-3 hidden md:table-cell">Risk Reason</th>
                                    <th className="text-right px-4 py-3 hidden sm:table-cell">Signed Up</th>
                                    <th className="text-right px-4 py-3 hidden sm:table-cell">Last Active</th>
                                    <th className="text-right px-4 py-3 hidden md:table-cell">Projects</th>
                                    <th className="text-right px-4 py-3">Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {intel.atRisk.slice(0, 50).map((u: AtRiskDetail) => {
                                    const { label, cls } = riskLabel(u.risk_score);
                                    return (
                                        <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                                            <td className="px-4 py-3">
                                                <p className="text-zinc-200 text-sm">{u.company_name ?? "—"}</p>
                                                <p className="text-zinc-500 text-xs">{u.email ?? "—"}</p>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">{u.risk_reason}</td>
                                            <td className="px-4 py-3 text-right text-zinc-400 text-xs hidden sm:table-cell">
                                                {fmtDate(u.created_at)}
                                                <span className="text-zinc-600 ml-1">({u.days_since_signup}d ago)</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-zinc-400 text-xs hidden sm:table-cell">{fmtDate(u.last_active)}</td>
                                            <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">{u.project_count}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {intel.atRisk.length > 50 && (
                            <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500">
                                Showing 50 of {intel.atRisk.length} at-risk accounts, sorted by risk score.
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}
