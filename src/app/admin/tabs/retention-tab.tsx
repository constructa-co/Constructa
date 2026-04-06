"use client";

import type { AdminData, SubscriberRow } from "../types";
import KpiCard from "../components/kpi-card";
import CohortGrid from "../components/cohort-grid";

interface Props {
    data: AdminData;
}

function pct(n: number, d: number): string {
    if (d === 0) return "0%";
    return `${Math.round((n / d) * 100)}%`;
}

function riskReason(user: SubscriberRow): string {
    if (user.project_count === 0 && user.days_since_signup > 7) return "No projects yet";
    if (user.project_count > 0 && !user.is_active_30d) return "Gone quiet";
    return "";
}

export default function RetentionTab({ data }: Props) {
    const r = data.retention;

    const mauDelta =
        r.mauPrev > 0
            ? parseFloat((((r.mau - r.mauPrev) / r.mauPrev) * 100).toFixed(1))
            : null;

    // Activation funnel derived counts
    const signedUp = data.totalSubscribers;
    const createdProject = data.subscribers.filter((s) => s.project_count > 0).length;
    const builtEstimate = data.subscribers.filter((s) => s.estimate_count > 0).length;
    const sentProposal = data.subscribers.filter((s) => s.proposals_sent > 0).length;
    const accepted = data.subscribers.filter((s) => s.proposals_accepted > 0).length;

    const funnelSteps = [
        { label: "Signed Up", count: signedUp, prev: null },
        { label: "Created Project", count: createdProject, prev: signedUp },
        { label: "Built Estimate", count: builtEstimate, prev: createdProject },
        { label: "Sent Proposal", count: sentProposal, prev: builtEstimate },
        { label: "Accepted", count: accepted, prev: sentProposal },
    ];

    const atRiskFiltered = r.atRiskUsers.filter((u) => riskReason(u) !== "");

    const hasCohortData = r.cohorts.length >= 2;

    return (
        <div className="space-y-8">

            {/* ── 1. Activity KPI row ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Activity
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <KpiCard label="DAU" value={String(r.dau)} sublabel="Daily active users" />
                    <KpiCard label="WAU" value={String(r.wau)} sublabel="Weekly active users" />
                    <KpiCard
                        label="MAU"
                        value={String(r.mau)}
                        sublabel="Monthly active users"
                        delta={mauDelta}
                        deltaLabel="vs prev month"
                    />
                    <KpiCard
                        label="Stickiness"
                        value={`${r.stickiness.toFixed(1)}%`}
                        sublabel="DAU / MAU"
                        alert={r.stickiness < 10}
                        accent={r.stickiness > 20}
                    />
                </div>
            </section>

            {/* ── 2. Churn metrics ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Churn &amp; Activation
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard
                        label="Monthly Churn Rate"
                        value={`${r.churnRate.toFixed(1)}%`}
                        sublabel="Logo churn this month"
                        alert={r.churnRate > 5}
                        invertDelta
                    />
                    <KpiCard
                        label="Churned This Month"
                        value={String(r.churnedThisMonth)}
                        sublabel="Users lost"
                    />
                    <KpiCard
                        label="Activation Rate"
                        value={`${r.activationRate.toFixed(0)}%`}
                        sublabel="Users who created a project"
                        alert={r.activationRate < 30}
                    />
                </div>
            </section>

            {/* ── 3. Activation funnel ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Activation Funnel
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 overflow-x-auto">
                    <div className="flex items-center gap-0 min-w-max">
                        {funnelSteps.map((step, i) => {
                            const convRate =
                                step.prev !== null && step.prev > 0
                                    ? `${Math.round((step.count / step.prev) * 100)}%`
                                    : null;
                            return (
                                <div key={step.label} className="flex items-center">
                                    {/* Step box */}
                                    <div className="flex flex-col items-center gap-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg min-w-[130px] text-center">
                                        <span className="text-xs text-zinc-400 leading-tight">
                                            {step.label}
                                        </span>
                                        <span className="text-2xl font-bold text-zinc-100 leading-none">
                                            {step.count}
                                        </span>
                                        {convRate && (
                                            <span className="text-xs text-amber-400 font-medium">
                                                {convRate} from prev
                                            </span>
                                        )}
                                    </div>
                                    {/* Arrow between steps */}
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
            </section>

            {/* ── 4. At-Risk Users table ── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">⚠️</span>
                    <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                        At-Risk Users
                    </h2>
                </div>

                {atRiskFiltered.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-sm text-zinc-400">
                        ✅ No at-risk users right now
                    </div>
                ) : (
                    <div className="bg-zinc-900 border border-amber-900/40 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm min-w-max">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Company</th>
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Email</th>
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Signed Up</th>
                                    <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Days Since Signup</th>
                                    <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Projects</th>
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Last Login</th>
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Risk Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {atRiskFiltered.map((u) => (
                                    <tr
                                        key={u.id}
                                        className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                                    >
                                        <td className="px-4 py-2.5 text-zinc-200 whitespace-nowrap">
                                            {u.company_name ?? "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                                            {u.email ?? "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                                            {new Date(u.created_at).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "2-digit",
                                            })}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-300 text-right whitespace-nowrap">
                                            {u.days_since_signup}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-300 text-right whitespace-nowrap">
                                            {u.project_count}
                                        </td>
                                        <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                                            {u.last_sign_in_at
                                                ? new Date(u.last_sign_in_at).toLocaleDateString("en-GB", {
                                                      day: "numeric",
                                                      month: "short",
                                                      year: "2-digit",
                                                  })
                                                : "Never"}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300">
                                                {riskReason(u)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── 5. Cohort Retention Grid ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Cohort Retention
                </h2>
                <p className="text-xs text-zinc-500 mb-3">
                    Each row = users who signed up in that month. Cells show % still active.
                </p>

                {!hasCohortData ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-sm text-zinc-400">
                        Cohort data builds over time — check back next month
                    </div>
                ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                        <CohortGrid cohorts={r.cohorts} />
                    </div>
                )}
            </section>
        </div>
    );
}
