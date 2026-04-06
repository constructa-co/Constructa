"use client";

import KpiCard from "../components/kpi-card";
import BarChart from "../components/bar-chart";
import type { AdminData } from "../types";
import { PLAN_PRICE_GBP } from "../types";

function fmtGbp(n: number): string {
    return "£" + Math.round(n).toLocaleString("en-GB");
}

function fmtPct(n: number, decimals = 1): string {
    return n.toFixed(decimals) + "%";
}

// ─── Alert strip ──────────────────────────────────────────────────────────────
function AlertStrip({ data }: { data: AdminData }) {
    const issues: string[] = [];

    if (data.retention.churnRate > 5) {
        issues.push(`Churn at ${fmtPct(data.retention.churnRate)} (>5%)`);
    }
    if (data.retention.activationRate < 30) {
        issues.push(`Activation rate at ${fmtPct(data.retention.activationRate)} (<30%)`);
    }
    if (data.ruleOf40Score !== null && data.ruleOf40Score < 20) {
        issues.push(`Rule of 40 score is ${data.ruleOf40Score} (<20)`);
    }
    if (data.signupsThisWeek === 0) {
        issues.push("No signups this week");
    }

    if (issues.length === 0) {
        return (
            <div className="flex items-center gap-2 bg-emerald-950 border border-emerald-800 rounded-lg px-4 py-3">
                <span className="text-emerald-400 font-semibold text-sm">✅ All systems healthy</span>
            </div>
        );
    }

    return (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400 font-semibold text-sm">
                    ⚠️ {issues.length} {issues.length === 1 ? "issue needs" : "issues need"} attention
                </span>
            </div>
            <ul className="flex flex-col gap-0.5">
                {issues.map((issue, i) => (
                    <li key={i} className="text-red-300 text-xs flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                        {issue}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Rule of 40 hero ──────────────────────────────────────────────────────────
function RuleOf40Hero({ data }: { data: AdminData }) {
    const score = data.ruleOf40Score;
    const growthPct = data.revenue.momGrowthPct ?? 0;
    const marginPct = data.costs.grossMarginPct;

    const scoreColour =
        score === null
            ? "text-zinc-400"
            : score >= 40
            ? "text-emerald-400"
            : score >= 20
            ? "text-amber-400"
            : "text-red-400";

    const borderColour =
        score === null
            ? "border-zinc-800"
            : score >= 40
            ? "border-emerald-700"
            : score >= 20
            ? "border-amber-600"
            : "border-red-700";

    return (
        <div
            className={`relative overflow-hidden rounded-xl border ${borderColour} bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6`}
        >
            {/* Background glow */}
            <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                        Rule of 40
                    </span>
                    <div className={`text-6xl font-black leading-none ${scoreColour}`}>
                        {score === null ? "N/A" : score}
                    </div>
                    <p className="text-zinc-400 text-sm mt-1">
                        Growth rate + Gross margin ≥ 40 = healthy SaaS
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                    <div className="bg-zinc-800/80 rounded-lg px-4 py-3 flex items-center gap-2 text-sm font-mono">
                        <span className="text-zinc-400">Growth:</span>
                        <span className="text-amber-400 font-bold">
                            {growthPct != null ? fmtPct(growthPct) : "N/A"}
                        </span>
                        <span className="text-zinc-600">+</span>
                        <span className="text-zinc-400">Margin:</span>
                        <span className="text-amber-400 font-bold">{fmtPct(marginPct)}</span>
                        <span className="text-zinc-600">=</span>
                        <span className={`font-extrabold ${scoreColour}`}>
                            {score === null ? "N/A" : score}
                        </span>
                    </div>
                    <span className="text-xs text-zinc-600">
                        {score === null
                            ? "Score unavailable — no revenue data yet"
                            : score >= 40
                            ? "Excellent — top-quartile SaaS performance"
                            : score >= 20
                            ? "Acceptable — room to improve growth or margin"
                            : "Below benchmark — focus on growth and cost efficiency"}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Quick stat cell ──────────────────────────────────────────────────────────
function QuickStat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-zinc-500 text-xs">{label}</span>
            <span className="text-zinc-100 text-lg font-bold leading-tight">{value}</span>
        </div>
    );
}

// ─── Investor KPI card ────────────────────────────────────────────────────────
function InvestorKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-zinc-500 text-xs uppercase tracking-wide leading-tight">{label}</span>
            <span className="text-zinc-100 text-xl font-bold leading-tight">{value}</span>
            {sub && <span className="text-zinc-600 text-xs">{sub}</span>}
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function OverviewTab({ data }: { data: AdminData }) {
    const { revenue, retention, costs } = data;

    // Spark data: last 6 months MRR values
    const mrrSparkData = revenue.mrrByMonth
        .slice(-6)
        .map((m) => m.mrr);

    // MAU delta %
    const mauDelta =
        retention.mauPrev > 0
            ? ((retention.mau - retention.mauPrev) / retention.mauPrev) * 100
            : null;

    // Revenue bar chart data
    const revenueChartData = revenue.mrrByMonth.map((m) => ({
        label: m.label,
        value: m.mrr,
    }));

    // Signup bar chart data
    const signupChartData = data.monthlySignups.map((d) => ({
        label: d.label,
        value: d.value,
    }));

    return (
        <div className="flex flex-col gap-6">
            {/* 1. Alert strip */}
            <AlertStrip data={data} />

            {/* 2. Rule of 40 hero */}
            <RuleOf40Hero data={data} />

            {/* 3. KPI grid — 2×4 / 4×2 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    label="MRR"
                    value={fmtGbp(revenue.mrr)}
                    delta={revenue.momGrowthPct}
                    deltaLabel="MoM"
                    sparkData={mrrSparkData}
                    accent={true}
                    sublabel="Monthly recurring revenue"
                />
                <KpiCard
                    label="ARR"
                    value={fmtGbp(revenue.arr)}
                    sublabel="Annualised recurring revenue"
                />
                <KpiCard
                    label="Active Users (MAU)"
                    value={String(retention.mau)}
                    delta={mauDelta}
                    deltaLabel="MoM"
                    sublabel="30-day active"
                />
                <KpiCard
                    label="Activation Rate"
                    value={fmtPct(retention.activationRate)}
                    sublabel="Created a project"
                    alert={retention.activationRate < 30}
                />
                <KpiCard
                    label="Monthly Churn"
                    value={fmtPct(retention.churnRate)}
                    invertDelta={true}
                    sublabel="Logo churn"
                    alert={retention.churnRate > 5}
                />
                <KpiCard
                    label="ARPU"
                    value={fmtGbp(revenue.arpu) + "/mo"}
                    sublabel="Avg revenue per user"
                />
                <KpiCard
                    label="LTV (est.)"
                    value={fmtGbp(revenue.ltv)}
                    sublabel="Lifetime value estimate"
                />
                <KpiCard
                    label="Stickiness"
                    value={fmtPct(retention.stickiness)}
                    sublabel="DAU ÷ MAU"
                    alert={retention.stickiness < 10}
                />
            </div>

            {/* 4. Three-column quick stats */}
            <div className="grid grid-cols-3 gap-3">
                {/* Today */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Today</span>
                    <QuickStat label="New signups" value={data.signupsToday} />
                    <QuickStat label="DAU" value={retention.dau} />
                </div>

                {/* This week */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">This Week</span>
                    <QuickStat label="New signups" value={data.signupsThisWeek} />
                    <QuickStat label="WAU" value={retention.wau} />
                </div>

                {/* This month */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">This Month</span>
                    <QuickStat label="New signups" value={data.signupsThisMonth} />
                    <QuickStat label="MAU" value={retention.mau} />
                    <QuickStat label="MRR" value={fmtGbp(revenue.mrr)} />
                </div>
            </div>

            {/* 5. Mini charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
                    <span className="text-zinc-300 text-sm font-semibold">Signup Trend (12mo)</span>
                    <BarChart
                        data={signupChartData}
                        height={80}
                        showValues={false}
                    />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
                    <span className="text-zinc-300 text-sm font-semibold">Revenue Trend (12mo)</span>
                    <BarChart
                        data={revenueChartData}
                        height={80}
                        showValues={false}
                        formatValue={(v) => fmtGbp(v)}
                        color="bg-emerald-600"
                    />
                </div>
            </div>

            {/* 6. Investor KPI row */}
            <div className="flex flex-col gap-2">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">Investor KPIs</span>
                <div className="flex flex-col sm:flex-row gap-3">
                    <InvestorKpi
                        label="LTV : CAC"
                        value={data.ltvCacRatio !== null ? data.ltvCacRatio.toFixed(1) + "x" : "TBD"}
                        sub={data.ltvCacRatio === null ? "No CAC data yet" : undefined}
                    />
                    <InvestorKpi
                        label="CAC Payback"
                        value={
                            data.cacPaybackMonths !== null
                                ? data.cacPaybackMonths.toFixed(0) + " mo"
                                : "TBD"
                        }
                        sub={data.cacPaybackMonths === null ? "No CAC data yet" : undefined}
                    />
                    <InvestorKpi
                        label="Burn Multiple"
                        value={
                            data.burnMultiple !== null ? data.burnMultiple.toFixed(2) + "x" : "TBD"
                        }
                        sub={data.burnMultiple === null ? "No burn data yet" : undefined}
                    />
                    <InvestorKpi
                        label="Rule of 40"
                        value={data.ruleOf40Score !== null ? String(data.ruleOf40Score) : "N/A"}
                        sub={
                            data.ruleOf40Score !== null
                                ? data.ruleOf40Score >= 40
                                    ? "Excellent"
                                    : data.ruleOf40Score >= 20
                                    ? "Acceptable"
                                    : "Below benchmark"
                                : "Insufficient data"
                        }
                    />
                </div>
            </div>
        </div>
    );
}
