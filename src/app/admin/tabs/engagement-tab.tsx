"use client";

import type { AdminData } from "../types";
import KpiCard from "../components/kpi-card";
import BarChart from "../components/bar-chart";

interface Props {
    data: AdminData;
}

function safePct(n: number, d: number): number {
    if (d === 0) return 0;
    return Math.round((n / d) * 100);
}

function fmtPct(n: number, d: number): string {
    return `${safePct(n, d)}%`;
}

export default function EngagementTab({ data }: Props) {
    const e = data.engagement;
    const f = e.proposalFunnel;

    const sendRate = safePct(f.proposalsSent, f.projects);
    const viewRate = safePct(f.proposalsViewed, f.proposalsSent);
    const acceptanceRate = safePct(f.proposalsAccepted, f.proposalsSent);

    // Funnel steps for pipeline display
    const funnelSteps = [
        { label: "Projects", count: f.projects, prev: null },
        { label: "Estimates", count: f.estimatesCreated, prev: f.projects },
        { label: "Proposals Sent", count: f.proposalsSent, prev: f.estimatesCreated },
        { label: "Viewed", count: f.proposalsViewed, prev: f.proposalsSent },
        { label: "Accepted", count: f.proposalsAccepted, prev: f.proposalsViewed },
    ];

    // Sort feature adoption by pct desc
    const sortedFeatures = [...e.featureAdoption].sort((a, b) => b.pct - a.pct);

    // Top 5 power users by project count
    const powerUsers = [...data.subscribers]
        .sort((a, b) => b.project_count - a.project_count)
        .slice(0, 5);

    return (
        <div className="space-y-8">

            {/* ── 1. Proposal funnel ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Proposal Pipeline
                </h2>

                {/* Visual funnel */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 overflow-x-auto mb-4">
                    <div className="flex items-center gap-0 min-w-max">
                        {funnelSteps.map((step, i) => {
                            const convRate =
                                step.prev !== null && step.prev > 0
                                    ? `${Math.round((step.count / step.prev) * 100)}%`
                                    : null;
                            return (
                                <div key={step.label} className="flex items-center">
                                    <div className="flex flex-col items-center gap-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg min-w-[130px] text-center">
                                        <span className="text-xs text-zinc-400 leading-tight">
                                            {step.label}
                                        </span>
                                        <span className="text-3xl font-extrabold text-zinc-100 leading-none">
                                            {step.count}
                                        </span>
                                        {convRate && (
                                            <span className="text-xs text-amber-400 font-medium">
                                                {convRate} from prev
                                            </span>
                                        )}
                                    </div>
                                    {i < funnelSteps.length - 1 && (
                                        <div className="flex items-center px-1">
                                            <div className="w-6 h-px bg-zinc-600" />
                                            <div
                                                className="w-0 h-0"
                                                style={{
                                                    borderTop: "5px solid transparent",
                                                    borderBottom: "5px solid transparent",
                                                    borderLeft: "7px solid #52525b",
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Funnel KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard
                        label="Send Rate"
                        value={`${sendRate}%`}
                        sublabel="Proposals sent / projects"
                    />
                    <KpiCard
                        label="View Rate"
                        value={`${viewRate}%`}
                        sublabel="Viewed / sent"
                    />
                    <KpiCard
                        label="Acceptance Rate"
                        value={`${acceptanceRate}%`}
                        sublabel="Accepted / sent"
                        accent={acceptanceRate > 50}
                    />
                </div>
            </section>

            {/* ── 2. Feature Adoption ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Feature Adoption
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800">
                                <th className="text-left text-zinc-400 font-medium px-4 py-2.5 w-1/3">Feature</th>
                                <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Users</th>
                                <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Adoption</th>
                                <th className="text-left text-zinc-400 font-medium px-4 py-2.5 w-1/3">Usage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFeatures.map((row) => {
                                const barColor =
                                    row.pct > 60
                                        ? "bg-amber-500"
                                        : row.pct < 30
                                        ? "bg-zinc-600"
                                        : "bg-amber-700";
                                return (
                                    <tr
                                        key={row.feature}
                                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                                    >
                                        <td className="px-4 py-2.5 text-zinc-200">
                                            <span className="mr-2">{row.icon}</span>
                                            {row.feature}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-300 text-right tabular-nums">
                                            {row.usersCount}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-300 text-right tabular-nums font-medium">
                                            {row.pct.toFixed(0)}%
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${barColor}`}
                                                    style={{ width: `${Math.min(row.pct, 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── 3. AI Usage ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    AI Usage
                </h2>
                <div className="flex flex-wrap gap-3">
                    {[
                        { icon: "🤖", label: "Briefs Generated", value: e.aiUsage.briefsGenerated },
                        { icon: "📋", label: "Contracts Reviewed by AI", value: e.aiUsage.contractsReviewed },
                        { icon: "✍️", label: "Closing Statements", value: e.aiUsage.closingStatements },
                        { icon: "⚠️", label: "Risk Registers", value: e.aiUsage.riskRegisters },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                        >
                            <span className="text-xl leading-none">{item.icon}</span>
                            <div>
                                <div className="text-xl font-bold text-zinc-100 leading-none">
                                    {item.value}
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">{item.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 4. Projects by month ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Projects Created (Last 12 Months)
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <BarChart
                        data={e.projectsByMonth.slice(-12).map((d) => ({
                            label: d.label,
                            value: d.value,
                        }))}
                        height={120}
                        color="bg-amber-500"
                    />
                </div>
            </section>

            {/* ── 5. Power Users ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Power Users
                    <span className="ml-2 text-xs normal-case font-normal text-zinc-500">
                        Top 5 by project count
                    </span>
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                        <thead>
                            <tr className="border-b border-zinc-800">
                                <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Company</th>
                                <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Projects</th>
                                <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Estimates</th>
                                <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Proposals</th>
                                <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Contracts</th>
                                <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Last Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {powerUsers.map((u, i) => (
                                <tr
                                    key={u.id}
                                    className={`border-b border-zinc-800/50 transition-colors ${
                                        i === 0
                                            ? "bg-amber-950/30 hover:bg-amber-950/50"
                                            : "hover:bg-zinc-800/30"
                                    }`}
                                >
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                        <span
                                            className={
                                                i === 0
                                                    ? "text-amber-300 font-semibold"
                                                    : "text-zinc-200"
                                            }
                                        >
                                            {u.company_name ?? u.email ?? "—"}
                                        </span>
                                        {i === 0 && (
                                            <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                                #1
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-100 text-right tabular-nums font-medium">
                                        {u.project_count}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-300 text-right tabular-nums">
                                        {u.estimate_count}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-300 text-right tabular-nums">
                                        {u.proposals_sent}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-300 text-right tabular-nums">
                                        {u.contracts_reviewed}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                                        {u.last_active
                                            ? new Date(u.last_active).toLocaleDateString("en-GB", {
                                                  day: "numeric",
                                                  month: "short",
                                                  year: "2-digit",
                                              })
                                            : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
