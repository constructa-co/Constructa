"use client";

import { useState } from "react";
import BarChart from "../components/bar-chart";
import type { AdminData, SubscriberRow } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPct(n: number, decimals = 1): string {
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(decimals) + "%";
}

function momGrowthLabel(current: number, prev: number): string {
    if (prev === 0) return current > 0 ? "New" : "N/A";
    const pct = ((current - prev) / prev) * 100;
    return fmtPct(pct);
}

function momGrowthColour(current: number, prev: number): string {
    if (prev === 0) return "text-zinc-500";
    const pct = ((current - prev) / prev) * 100;
    return pct >= 0 ? "text-emerald-400" : "text-red-400";
}

// ─── Status badge (mirrors subscriber table logic) ────────────────────────────
function StatusBadge({ status }: { status: SubscriberRow["activation_status"] }) {
    const map: Record<
        SubscriberRow["activation_status"],
        { label: string; className: string }
    > = {
        activated: {
            label: "Activated",
            className: "bg-emerald-900/60 text-emerald-400 border-emerald-800",
        },
        at_risk: {
            label: "At Risk",
            className: "bg-amber-900/60 text-amber-400 border-amber-800",
        },
        churned: {
            label: "Churned",
            className: "bg-red-900/60 text-red-400 border-red-800",
        },
        new: {
            label: "New",
            className: "bg-zinc-800 text-zinc-400 border-zinc-700",
        },
    };
    const { label, className } = map[status] ?? map.new;
    return (
        <span
            className={`inline-flex items-center text-[11px] font-medium border rounded px-1.5 py-0.5 leading-none ${className}`}
        >
            {label}
        </span>
    );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-zinc-300 text-sm font-semibold uppercase tracking-widest border-b border-zinc-800 pb-2">
            {children}
        </h3>
    );
}

// ─── Period toggle button ─────────────────────────────────────────────────────
function PeriodBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                active
                    ? "bg-amber-500 text-zinc-950"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
        >
            {children}
        </button>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function GrowthTab({ data }: { data: AdminData }) {
    const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");

    // ── 1. KPI headline counts ────────────────────────────────────────────────
    // Prior-period equivalents for deltas
    const prevWeekSignups =
        data.weeklySignups.length >= 2
            ? data.weeklySignups[data.weeklySignups.length - 2]?.value ?? 0
            : 0;
    const prevMonthSignups = data.signupsPrevMonth;
    const prevQuarterSignups = 0; // not in AdminData, show N/A
    const prevYearSignups = 0;    // not in AdminData, show N/A

    function deltaLabel(current: number, prev: number): string | null {
        if (prev === 0) return null;
        const pct = ((current - prev) / prev) * 100;
        return fmtPct(pct);
    }

    function deltaColour(current: number, prev: number): string {
        if (prev === 0) return "text-zinc-500";
        return current >= prev ? "text-emerald-400" : "text-red-400";
    }

    // ── 2. Trend chart data ───────────────────────────────────────────────────
    const chartData = {
        daily: data.dailySignups,
        weekly: data.weeklySignups,
        monthly: data.monthlySignups,
    }[period].map((d) => ({ label: d.label, value: d.value }));

    const periodLabel = { daily: "day", weekly: "week", monthly: "month" }[period];

    // ── 3. Growth rate table — last 6 months ─────────────────────────────────
    const last6 = data.monthlySignups.slice(-6);
    // Build cumulative counts from all monthly data
    const allMonthly = data.monthlySignups;
    const cumulativeByMonth: Record<string, number> = {};
    let running = 0;
    for (const m of allMonthly) {
        running += m.value;
        cumulativeByMonth[m.key] = running;
    }

    // ── 4. Plausible funnel ───────────────────────────────────────────────────
    const plausible = data.website;

    // ── 5. Newest subscribers (last 10) ──────────────────────────────────────
    const newest10 = [...data.subscribers]
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 10);

    function timeAgo(isoDate: string): string {
        const ms = Date.now() - new Date(isoDate).getTime();
        const days = Math.floor(ms / 86400000);
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo ago`;
        return `${Math.floor(days / 365)}y ago`;
    }

    return (
        <div className="flex flex-col gap-8">
            {/* 1. Signup headline KPIs */}
            <div className="flex flex-col gap-3">
                <SectionHeading>Signup Counts</SectionHeading>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Today */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
                        <span className="text-zinc-500 text-xs uppercase tracking-wide">Today</span>
                        <span className="text-zinc-100 text-2xl font-bold">{data.signupsToday}</span>
                        <span className="text-zinc-600 text-xs">signups</span>
                    </div>

                    {/* This Week */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
                        <span className="text-zinc-500 text-xs uppercase tracking-wide">This Week</span>
                        <span className="text-zinc-100 text-2xl font-bold">{data.signupsThisWeek}</span>
                        {(() => {
                            const d = deltaLabel(data.signupsThisWeek, prevWeekSignups);
                            return d ? (
                                <span
                                    className={`text-xs font-medium ${deltaColour(data.signupsThisWeek, prevWeekSignups)}`}
                                >
                                    {d} vs last week
                                </span>
                            ) : (
                                <span className="text-zinc-600 text-xs">signups</span>
                            );
                        })()}
                    </div>

                    {/* This Month */}
                    <div className="bg-zinc-900 border border-amber-600/40 rounded-lg p-3 flex flex-col gap-1">
                        <span className="text-zinc-500 text-xs uppercase tracking-wide">This Month</span>
                        <span className="text-amber-400 text-2xl font-bold">{data.signupsThisMonth}</span>
                        {(() => {
                            const d = deltaLabel(data.signupsThisMonth, prevMonthSignups);
                            return d ? (
                                <span
                                    className={`text-xs font-medium ${deltaColour(data.signupsThisMonth, prevMonthSignups)}`}
                                >
                                    {d} vs last month
                                </span>
                            ) : (
                                <span className="text-zinc-600 text-xs">signups</span>
                            );
                        })()}
                    </div>

                    {/* This Quarter */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
                        <span className="text-zinc-500 text-xs uppercase tracking-wide">This Quarter</span>
                        <span className="text-zinc-100 text-2xl font-bold">{data.signupsThisQuarter}</span>
                        <span className="text-zinc-600 text-xs">signups</span>
                    </div>

                    {/* This Year */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
                        <span className="text-zinc-500 text-xs uppercase tracking-wide">This Year</span>
                        <span className="text-zinc-100 text-2xl font-bold">{data.signupsThisYear}</span>
                        <span className="text-zinc-600 text-xs">signups</span>
                    </div>
                </div>
            </div>

            {/* 2. Trend chart with toggle */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <SectionHeading>Signup Trend</SectionHeading>
                    <div className="flex items-center gap-1.5">
                        <PeriodBtn active={period === "daily"} onClick={() => setPeriod("daily")}>
                            Daily 30d
                        </PeriodBtn>
                        <PeriodBtn active={period === "weekly"} onClick={() => setPeriod("weekly")}>
                            Weekly 12wk
                        </PeriodBtn>
                        <PeriodBtn active={period === "monthly"} onClick={() => setPeriod("monthly")}>
                            Monthly 13mo
                        </PeriodBtn>
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
                    <span className="text-zinc-500 text-xs">
                        New signups per {periodLabel}
                    </span>
                    <BarChart
                        data={chartData}
                        height={160}
                        showValues={false}
                    />
                </div>
            </div>

            {/* 3. Growth rate table — last 6 months */}
            <div className="flex flex-col gap-4">
                <SectionHeading>Monthly Growth (Last 6 Months)</SectionHeading>
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                    <table className="w-full text-sm min-w-[380px]">
                        <thead>
                            <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Month</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">New Signups</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Cumulative</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">MoM Growth</th>
                            </tr>
                        </thead>
                        <tbody>
                            {last6.slice().reverse().map((month, idx, arr) => {
                                const prevInSlice = arr[idx + 1];
                                const cumulative = cumulativeByMonth[month.key] ?? "—";
                                return (
                                    <tr
                                        key={month.key}
                                        className={`border-b border-zinc-800/50 ${
                                            idx === 0 ? "bg-zinc-900/50" : "hover:bg-zinc-900/30"
                                        } transition-colors`}
                                    >
                                        <td className="text-zinc-200 font-medium px-3 py-2.5">
                                            {month.label}
                                            {idx === 0 && (
                                                <span className="ml-1.5 text-[10px] bg-amber-900/50 text-amber-400 rounded px-1 py-0.5">
                                                    Current
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-zinc-300 text-right px-3 py-2.5">{month.value}</td>
                                        <td className="text-zinc-300 text-right px-3 py-2.5">{cumulative}</td>
                                        <td className="text-right px-3 py-2.5">
                                            {prevInSlice ? (
                                                <span
                                                    className={`text-xs font-medium ${momGrowthColour(
                                                        month.value,
                                                        prevInSlice.value
                                                    )}`}
                                                >
                                                    {momGrowthLabel(month.value, prevInSlice.value)}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600 text-xs">N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {last6.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="text-zinc-500 text-center text-sm px-3 py-6"
                                    >
                                        No monthly signup data yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Acquisition funnel */}
            <div className="flex flex-col gap-4">
                <SectionHeading>Acquisition Funnel</SectionHeading>
                {plausible.available ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
                            {/* Visitors */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-400 text-xs uppercase tracking-wide">Visitors (30d)</span>
                                <span className="text-zinc-100 text-3xl font-black">
                                    {plausible.visitors30d.toLocaleString()}
                                </span>
                            </div>

                            {/* Arrow + conversion */}
                            <div className="flex flex-col items-center gap-0.5 px-2">
                                <span
                                    className={`text-xs font-semibold ${
                                        plausible.signupConversionRate >= 2
                                            ? "text-emerald-400"
                                            : plausible.signupConversionRate >= 0.5
                                            ? "text-amber-400"
                                            : "text-red-400"
                                    }`}
                                >
                                    {plausible.signupConversionRate.toFixed(2)}%
                                </span>
                                <span className="text-zinc-600 text-lg">→</span>
                            </div>

                            {/* Signups */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-400 text-xs uppercase tracking-wide">Signups (30d)</span>
                                <span className="text-zinc-100 text-3xl font-black">
                                    {data.signupsThisMonth}
                                </span>
                            </div>

                            {/* Arrow */}
                            <div className="flex flex-col items-center gap-0.5 px-2">
                                {data.signupsThisMonth > 0 ? (
                                    <span className="text-xs font-semibold text-amber-400">
                                        {((data.retention.activationRate) ).toFixed(0)}%
                                    </span>
                                ) : (
                                    <span className="text-zinc-600 text-xs">—</span>
                                )}
                                <span className="text-zinc-600 text-lg">→</span>
                            </div>

                            {/* Activated */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-400 text-xs uppercase tracking-wide">Activated</span>
                                <span className="text-zinc-100 text-3xl font-black">
                                    {Math.round(
                                        (data.totalSubscribers * data.retention.activationRate) / 100
                                    )}
                                </span>
                                <span className="text-zinc-600 text-xs">created a project</span>
                            </div>

                            {/* Arrow */}
                            <div className="flex flex-col items-center gap-0.5 px-2">
                                {data.totalSubscribers > 0 ? (
                                    <span className="text-xs font-semibold text-amber-400">
                                        {data.totalProposalsSent > 0
                                            ? (
                                                (data.totalProposalsSent /
                                                    Math.max(data.totalSubscribers, 1)) *
                                                100
                                            ).toFixed(0) + "%"
                                            : "0%"}
                                    </span>
                                ) : (
                                    <span className="text-zinc-600 text-xs">—</span>
                                )}
                                <span className="text-zinc-600 text-lg">→</span>
                            </div>

                            {/* Sent proposal */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-400 text-xs uppercase tracking-wide">Sent Proposal</span>
                                <span className="text-zinc-100 text-3xl font-black">
                                    {data.totalProposalsSent}
                                </span>
                            </div>
                        </div>

                        {/* Bounce rate / session duration footnote */}
                        <div className="flex gap-4 mt-4 pt-4 border-t border-zinc-800">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-zinc-500 text-xs">Bounce Rate</span>
                                <span className="text-zinc-300 text-sm font-semibold">
                                    {plausible.bounceRate.toFixed(0)}%
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-zinc-500 text-xs">Avg Visit Duration</span>
                                <span className="text-zinc-300 text-sm font-semibold">
                                    {Math.floor(plausible.visitDuration / 60)}m{" "}
                                    {plausible.visitDuration % 60}s
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-zinc-500 text-xs">Page Views (30d)</span>
                                <span className="text-zinc-300 text-sm font-semibold">
                                    {plausible.pageviews30d.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-amber-400 text-lg">📊</span>
                            <span className="text-zinc-300 text-sm font-semibold">
                                Connect Plausible API to see visitor funnel
                            </span>
                        </div>
                        <p className="text-zinc-500 text-sm">
                            To enable the full acquisition funnel (Visitors → Signups → Activated → Proposal sent), connect your Plausible Analytics account.
                        </p>
                        <ol className="flex flex-col gap-1.5 text-zinc-500 text-xs list-decimal list-inside">
                            <li>
                                Add{" "}
                                <code className="bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 font-mono">
                                    PLAUSIBLE_API_KEY
                                </code>{" "}
                                and{" "}
                                <code className="bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 font-mono">
                                    PLAUSIBLE_DOMAIN
                                </code>{" "}
                                to your environment variables
                            </li>
                            <li>
                                Ensure your site is tracked at{" "}
                                <span className="text-zinc-400">plausible.io</span>
                            </li>
                            <li>Redeploy — the funnel will appear automatically</li>
                        </ol>
                        {/* Partial funnel — show what we do have */}
                        <div className="mt-2 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-500 text-xs uppercase tracking-wide">Signups (30d)</span>
                                <span className="text-zinc-100 text-2xl font-bold">{data.signupsThisMonth}</span>
                            </div>
                            <span className="text-zinc-600 text-lg px-2">→</span>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-500 text-xs uppercase tracking-wide">Activated</span>
                                <span className="text-zinc-100 text-2xl font-bold">
                                    {Math.round(
                                        (data.totalSubscribers * data.retention.activationRate) / 100
                                    )}
                                </span>
                            </div>
                            <span className="text-zinc-600 text-lg px-2">→</span>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-zinc-500 text-xs uppercase tracking-wide">Sent Proposal</span>
                                <span className="text-zinc-100 text-2xl font-bold">{data.totalProposalsSent}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Newest subscribers */}
            <div className="flex flex-col gap-4">
                <SectionHeading>New Subscribers (Last 10)</SectionHeading>
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                    <table className="w-full text-sm min-w-[540px]">
                        <thead>
                            <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Company</th>
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Email</th>
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Signed Up</th>
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Country</th>
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newest10.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="text-zinc-500 text-center text-sm px-3 py-8"
                                    >
                                        No subscribers yet
                                    </td>
                                </tr>
                            ) : (
                                newest10.map((sub) => (
                                    <tr
                                        key={sub.id}
                                        className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors"
                                    >
                                        <td className="px-3 py-2.5">
                                            <span className="text-zinc-200 font-medium">
                                                {sub.company_name ?? (
                                                    <span className="text-zinc-600 italic">No company</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-zinc-400 text-xs font-mono">
                                                {sub.email ?? (
                                                    <span className="text-zinc-600 italic not-italic">—</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-zinc-300 text-xs">
                                                {timeAgo(sub.created_at)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-zinc-400 text-xs">
                                                {sub.country ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge status={sub.activation_status} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
