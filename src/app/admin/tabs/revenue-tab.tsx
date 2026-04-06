"use client";

import KpiCard from "../components/kpi-card";
import BarChart from "../components/bar-chart";
import type { AdminData } from "../types";
import { PLAN_PRICE_GBP } from "../types";

function fmtGbp(n: number): string {
    return "£" + Math.round(n).toLocaleString("en-GB");
}

function fmtPct(n: number | null, decimals = 1): string {
    if (n === null) return "N/A";
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(decimals) + "%";
}

// ─── Delta badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ value, label }: { value: number | null; label: string }) {
    if (value === null)
        return (
            <span className="text-xs text-zinc-600 bg-zinc-800 rounded px-1.5 py-0.5">
                {label} N/A
            </span>
        );
    const isPositive = value >= 0;
    return (
        <span
            className={`text-xs font-medium rounded px-1.5 py-0.5 ${
                isPositive
                    ? "bg-emerald-900/50 text-emerald-400"
                    : "bg-red-900/50 text-red-400"
            }`}
        >
            {isPositive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}% {label}
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

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RevenueTab({ data }: { data: AdminData }) {
    const { revenue, costs, retention } = data;

    // Safe churn for LTV calc: if churnRate is 0 use 24mo default cap
    const safeChurnRate = retention.churnRate > 0 ? retention.churnRate / 100 : 1 / 24;
    const ltv = revenue.arpu / safeChurnRate;
    const grossMarginPerUser = PLAN_PRICE_GBP - costs.costPerUserGbp;
    const grossMarginPct = PLAN_PRICE_GBP > 0 ? (grossMarginPerUser / PLAN_PRICE_GBP) * 100 : 0;

    // Breakeven: total monthly cost / plan price
    const breakevenSubscribers =
        PLAN_PRICE_GBP > 0 ? Math.ceil(costs.totalMonthlyCostGbp / PLAN_PRICE_GBP) : null;

    // MRR waterfall chart
    const waterfallData = revenue.mrrByMonth.map((m) => ({
        label: m.label,
        value: m.mrr,
    }));

    // Growth rates: last 2 months
    const lastTwo = revenue.mrrByMonth.slice(-2);
    const currentMonth = lastTwo[1] ?? null;
    const prevMonth = lastTwo[0] ?? null;

    return (
        <div className="flex flex-col gap-8">
            {/* 1. Revenue headline strip */}
            <div className="flex flex-col gap-3">
                <SectionHeading>Revenue Overview</SectionHeading>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* MRR */}
                    <div className="bg-zinc-900 border border-amber-600/50 rounded-lg p-4 flex flex-col gap-2">
                        <span className="text-zinc-400 text-xs">MRR</span>
                        <span className="text-amber-400 text-3xl font-black leading-tight">
                            {fmtGbp(revenue.mrr)}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            <DeltaBadge value={revenue.momGrowthPct} label="MoM" />
                            <DeltaBadge value={revenue.qoqGrowthPct} label="QoQ" />
                            <DeltaBadge value={revenue.yoyGrowthPct} label="YoY" />
                        </div>
                    </div>

                    {/* ARR */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
                        <span className="text-zinc-400 text-xs">ARR</span>
                        <span className="text-zinc-100 text-3xl font-black leading-tight">
                            {fmtGbp(revenue.arr)}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            <DeltaBadge value={revenue.momGrowthPct !== null ? revenue.momGrowthPct * 12 / 12 : null} label="MoM (ann.)" />
                        </div>
                    </div>

                    {/* ARPU */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
                        <span className="text-zinc-400 text-xs">ARPU</span>
                        <span className="text-zinc-100 text-3xl font-black leading-tight">
                            {fmtGbp(revenue.arpu)}
                            <span className="text-zinc-500 text-base font-normal">/mo</span>
                        </span>
                        <span className="text-zinc-600 text-xs">Avg revenue per user</span>
                    </div>

                    {/* LTV */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
                        <span className="text-zinc-400 text-xs">LTV (est.)</span>
                        <span className="text-zinc-100 text-3xl font-black leading-tight">
                            {fmtGbp(revenue.ltv)}
                        </span>
                        <span className="text-zinc-600 text-xs">
                            ARPU ÷ {retention.churnRate > 0 ? fmtPct(retention.churnRate) + " churn" : "24mo default"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. MRR Waterfall */}
            <div className="flex flex-col gap-4">
                <SectionHeading>MRR Waterfall (12 months)</SectionHeading>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <BarChart
                        data={waterfallData}
                        height={140}
                        showValues={false}
                        formatValue={(v) => fmtGbp(v)}
                        color="bg-emerald-600"
                    />
                </div>

                {/* MRR table */}
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                    <table className="w-full text-xs min-w-[640px]">
                        <thead>
                            <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Month</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Users</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">New MRR</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Churned MRR</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Net New MRR</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Cumulative MRR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {revenue.mrrByMonth.slice().reverse().map((m, i) => (
                                <tr
                                    key={m.month}
                                    className={`border-b border-zinc-800/50 ${
                                        i === 0 ? "bg-zinc-900/80" : "bg-zinc-950 hover:bg-zinc-900/40"
                                    } transition-colors`}
                                >
                                    <td className="text-zinc-300 font-medium px-3 py-2">
                                        {m.label}
                                        {i === 0 && (
                                            <span className="ml-1.5 text-[10px] bg-amber-900/50 text-amber-400 rounded px-1 py-0.5">
                                                Current
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-zinc-300 text-right px-3 py-2">{m.cumulativeUsers}</td>
                                    <td className="text-emerald-400 text-right px-3 py-2">
                                        {m.newMrr > 0 ? fmtGbp(m.newMrr) : "—"}
                                    </td>
                                    <td className="text-red-400 text-right px-3 py-2">
                                        {m.churnedMrr > 0 ? fmtGbp(m.churnedMrr) : "—"}
                                    </td>
                                    <td
                                        className={`text-right px-3 py-2 font-medium ${
                                            m.netNewMrr >= 0 ? "text-emerald-400" : "text-red-400"
                                        }`}
                                    >
                                        {m.netNewMrr >= 0 ? "+" : ""}
                                        {fmtGbp(m.netNewMrr)}
                                    </td>
                                    <td className="text-zinc-100 font-semibold text-right px-3 py-2">
                                        {fmtGbp(m.mrr)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. Growth rates table */}
            <div className="flex flex-col gap-4">
                <SectionHeading>Growth Rates</SectionHeading>
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                    <table className="w-full text-sm min-w-[540px]">
                        <thead>
                            <tr className="bg-zinc-900 border-b border-zinc-800">
                                <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Period</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Users</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">MRR</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">MoM</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">QoQ</th>
                                <th className="text-right text-zinc-400 font-medium px-3 py-2.5">YoY</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentMonth && (
                                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                                    <td className="text-zinc-200 font-semibold px-3 py-2.5">
                                        {currentMonth.label}
                                        <span className="ml-1.5 text-[10px] bg-amber-900/50 text-amber-400 rounded px-1 py-0.5">
                                            Current
                                        </span>
                                    </td>
                                    <td className="text-zinc-300 text-right px-3 py-2.5">
                                        {currentMonth.cumulativeUsers}
                                    </td>
                                    <td className="text-zinc-300 text-right px-3 py-2.5">
                                        {fmtGbp(currentMonth.mrr)}
                                    </td>
                                    <td className="text-right px-3 py-2.5">
                                        <span
                                            className={`text-xs font-medium ${
                                                revenue.momGrowthPct !== null && revenue.momGrowthPct >= 0
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {fmtPct(revenue.momGrowthPct)}
                                        </span>
                                    </td>
                                    <td className="text-right px-3 py-2.5">
                                        <span
                                            className={`text-xs font-medium ${
                                                revenue.qoqGrowthPct !== null && revenue.qoqGrowthPct >= 0
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {fmtPct(revenue.qoqGrowthPct)}
                                        </span>
                                    </td>
                                    <td className="text-right px-3 py-2.5">
                                        <span
                                            className={`text-xs font-medium ${
                                                revenue.yoyGrowthPct !== null && revenue.yoyGrowthPct >= 0
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {fmtPct(revenue.yoyGrowthPct)}
                                        </span>
                                    </td>
                                </tr>
                            )}
                            {prevMonth && (
                                <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                                    <td className="text-zinc-300 px-3 py-2.5">{prevMonth.label}</td>
                                    <td className="text-zinc-300 text-right px-3 py-2.5">
                                        {prevMonth.cumulativeUsers}
                                    </td>
                                    <td className="text-zinc-300 text-right px-3 py-2.5">
                                        {fmtGbp(prevMonth.mrr)}
                                    </td>
                                    <td className="text-zinc-500 text-right text-xs px-3 py-2.5">N/A</td>
                                    <td className="text-zinc-500 text-right text-xs px-3 py-2.5">N/A</td>
                                    <td className="text-zinc-500 text-right text-xs px-3 py-2.5">N/A</td>
                                </tr>
                            )}
                            {!currentMonth && !prevMonth && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="text-zinc-500 text-center text-sm px-3 py-6"
                                    >
                                        No monthly revenue data yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Revenue Forecast */}
            <div className="flex flex-col gap-4">
                <SectionHeading>Revenue Forecast</SectionHeading>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                            <span className="text-amber-400 text-lg leading-none mt-0.5">📈</span>
                            <div>
                                <p className="text-zinc-200 text-sm">
                                    At current MoM growth of{" "}
                                    <span className="text-amber-400 font-bold">
                                        {revenue.momGrowthPct !== null
                                            ? fmtPct(revenue.momGrowthPct)
                                            : "N/A"}
                                    </span>
                                    , projected ARR by end of year:{" "}
                                    <span className="text-emerald-400 font-bold text-base">
                                        {fmtGbp(revenue.projectedArrEoy)}
                                    </span>
                                </p>
                                {revenue.momGrowthPct === null && (
                                    <p className="text-zinc-500 text-xs mt-1">
                                        Projected using flat growth assumption — no MoM data available
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="text-amber-400 text-lg leading-none mt-0.5">⚖️</span>
                            <div>
                                <p className="text-zinc-200 text-sm">
                                    Break-even estimate: at{" "}
                                    <span className="text-amber-400 font-bold">
                                        {fmtGbp(PLAN_PRICE_GBP)}/mo
                                    </span>{" "}
                                    plan with{" "}
                                    <span className="text-zinc-300 font-semibold">
                                        {fmtGbp(costs.totalMonthlyCostGbp)}/mo
                                    </span>{" "}
                                    costs, need{" "}
                                    <span className="text-emerald-400 font-bold text-base">
                                        {breakevenSubscribers !== null
                                            ? breakevenSubscribers
                                            : "N/A"}{" "}
                                        subscribers
                                    </span>
                                </p>
                                {breakevenSubscribers !== null && (
                                    <p className="text-zinc-500 text-xs mt-1">
                                        Calculation: {fmtGbp(costs.totalMonthlyCostGbp)} ÷{" "}
                                        {fmtGbp(PLAN_PRICE_GBP)} ={" "}
                                        {breakevenSubscribers} paying subscribers
                                        {data.totalSubscribers >= breakevenSubscribers ? (
                                            <span className="ml-1.5 text-emerald-400 font-medium">
                                                ✓ Already profitable
                                            </span>
                                        ) : (
                                            <span className="ml-1.5 text-amber-400">
                                                ({breakevenSubscribers - data.totalSubscribers} more needed)
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Unit Economics */}
            <div className="flex flex-col gap-4">
                <SectionHeading>Unit Economics</SectionHeading>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* ARPU */}
                        <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 text-xs uppercase tracking-wide">ARPU</span>
                            <span className="text-zinc-100 text-xl font-bold">
                                {fmtGbp(revenue.arpu)}
                                <span className="text-zinc-500 text-xs font-normal">/mo</span>
                            </span>
                        </div>

                        {/* LTV */}
                        <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 text-xs uppercase tracking-wide">LTV</span>
                            <span className="text-zinc-100 text-xl font-bold">{fmtGbp(ltv)}</span>
                            <span className="text-zinc-600 text-xs">
                                ARPU ÷{" "}
                                {retention.churnRate > 0
                                    ? fmtPct(retention.churnRate) + " churn"
                                    : "24mo default"}
                            </span>
                        </div>

                        {/* Gross margin per user */}
                        <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 text-xs uppercase tracking-wide">Gross Margin / User</span>
                            <span className="text-zinc-100 text-xl font-bold">
                                {fmtGbp(grossMarginPerUser)}
                            </span>
                            <span className="text-zinc-600 text-xs">
                                {fmtGbp(PLAN_PRICE_GBP)} − {fmtGbp(costs.costPerUserGbp)} ={" "}
                                {grossMarginPct.toFixed(0)}%
                            </span>
                        </div>

                        {/* LTV:CAC */}
                        <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 text-xs uppercase tracking-wide">LTV : CAC</span>
                            <span className="text-zinc-100 text-xl font-bold">
                                {data.ltvCacRatio !== null ? data.ltvCacRatio.toFixed(1) + "x" : "TBD"}
                            </span>
                            <span className="text-zinc-600 text-xs">No CAC data</span>
                        </div>

                        {/* CAC Payback */}
                        <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 text-xs uppercase tracking-wide">CAC Payback</span>
                            <span className="text-zinc-100 text-xl font-bold">
                                {data.cacPaybackMonths !== null
                                    ? data.cacPaybackMonths.toFixed(0) + " mo"
                                    : "TBD"}
                            </span>
                            <span className="text-zinc-600 text-xs">No CAC data</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
