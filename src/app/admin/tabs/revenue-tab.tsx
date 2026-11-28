"use client";

import type { AdminData } from "../types";
import {
    gbpOrUnavailable,
    NO_VERIFIED_BILLING_DETAIL,
    NO_VERIFIED_BILLING_LABEL,
    NO_VERIFIED_BILLING_NOTE,
} from "../revenue";

// D124 N5.1: this tab used to price every signup at an assumed plan price and
// show the result as MRR, ARR, ARPU, LTV, a waterfall, growth rates, a
// forecast, unit economics and breakeven. None of that was revenue. Revenue now
// comes only from verified billing data; until it exists, those figures read
// "Unavailable" and only the costs actually recorded are shown.

function fmtGbp(n: number): string {
    return "£" + Math.round(n).toLocaleString("en-GB");
}

function fmtGbpPence(n: number): string {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null): string {
    if (n === null) return NO_VERIFIED_BILLING_LABEL;
    return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-zinc-300 text-sm font-semibold uppercase tracking-widest border-b border-zinc-800 pb-2">
            {children}
        </h3>
    );
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
            <span className="text-zinc-400 text-xs">{label}</span>
            <span className="text-zinc-100 text-2xl font-black leading-tight">{value}</span>
            <span className="text-zinc-600 text-xs">{sub}</span>
        </div>
    );
}

export default function RevenueTab({ data }: { data: AdminData }) {
    const { revenue, costs, totalSubscribers } = data;
    const unverified = revenue.status === "no_verified_billing";
    const revenueSub = unverified ? "No verified billing data" : "";

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
                <SectionHeading>Revenue Overview</SectionHeading>
                {unverified && (
                    <div
                        role="status"
                        data-admin-revenue-unavailable
                        className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
                    >
                        <p className="font-semibold">{NO_VERIFIED_BILLING_NOTE}</p>
                        <p className="text-amber-200/80 mt-1">{NO_VERIFIED_BILLING_DETAIL}</p>
                    </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Figure label="MRR" value={gbpOrUnavailable(revenue.mrr, fmtGbp)} sub={revenueSub} />
                    <Figure label="ARR" value={gbpOrUnavailable(revenue.arr, fmtGbp)} sub={revenueSub} />
                    <Figure label="ARPU" value={gbpOrUnavailable(revenue.arpu, fmtGbp)} sub={revenueSub} />
                    <Figure label="LTV (est.)" value={gbpOrUnavailable(revenue.ltv, fmtGbp)} sub={revenueSub} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Figure label="MoM revenue growth" value={fmtPct(revenue.momGrowthPct)} sub={revenueSub} />
                    <Figure label="QoQ revenue growth" value={fmtPct(revenue.qoqGrowthPct)} sub={revenueSub} />
                    <Figure label="YoY revenue growth" value={fmtPct(revenue.yoyGrowthPct)} sub={revenueSub} />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <SectionHeading>Recorded costs</SectionHeading>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Figure
                        label="Platform cost this month"
                        value={fmtGbp(costs.totalMonthlyCostGbp)}
                        sub="Manual cost entries plus OpenAI month to date"
                    />
                    <Figure
                        label="Signed-up accounts"
                        value={String(totalSubscribers)}
                        sub="Accounts, not paying customers"
                    />
                    <Figure
                        label="Cost per account"
                        value={fmtGbpPence(costs.costPerUserGbp)}
                        sub="Platform cost ÷ signed-up accounts"
                    />
                </div>
                <p className="text-zinc-500 text-xs">
                    Gross margin, breakeven, forecasts and unit economics need verified revenue and show as{" "}
                    {NO_VERIFIED_BILLING_LABEL.toLowerCase()} until it exists.
                </p>
            </div>
        </div>
    );
}
