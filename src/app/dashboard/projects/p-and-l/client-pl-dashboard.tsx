"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCostAction, updateInvoiceStatusAction } from "./actions";
import { COST_TYPES, TRADE_SECTIONS } from "./constants";
import LogCostSheet from "./log-cost-sheet";
import { toast } from "sonner";
import {
    PoundSterling,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Plus,
    Trash2,
    Loader2,
    ChevronRight,
    BarChart3,
    Receipt,
    Hammer,
    ShieldAlert,
    GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
    projectId: string;
    project: any;
    contractValue: number;
    totalBudgetCost: number;
    riskAmt: number;
    riskPct: number;
    budgetBySection: Array<{ section: string; budget: number }>;
    actualBySection: Array<{ section: string; actual: number }>;
    costsPosted: number;
    invoicedTotal: number;
    receivedTotal: number;
    approvedVarTotal: number;
    expenses: any[];
    invoices: any[];
    staffCatalogue: any[];
    plantCatalogue: any[];
    estimateLines: any[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gbp(n: number, compact = false): string {
    if (compact) {
        if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
        if (Math.abs(n) >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`;
        return `£${n.toFixed(0)}`;
    }
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(part: number, whole: number): string {
    if (!whole) return "0.0%";
    return ((part / whole) * 100).toFixed(1) + "%";
}

function fmtDate(d: string): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function costTypeLabel(t: string): string {
    const labels: Record<string, string> = {
        labour: "Labour", materials: "Materials", plant: "Plant",
        subcontract: "Subcontract", overhead: "Overhead", prelims: "Prelims", other: "Other",
    };
    return labels[t] ?? t;
}

function costTypeBadgeColor(t: string): string {
    const colors: Record<string, string> = {
        labour:      "bg-blue-500/15 text-blue-400",
        materials:   "bg-orange-500/15 text-orange-400",
        plant:       "bg-yellow-500/15 text-yellow-400",
        subcontract: "bg-purple-500/15 text-purple-400",
        overhead:    "bg-slate-500/15 text-slate-400",
        prelims:     "bg-teal-500/15 text-teal-400",
        other:       "bg-slate-500/15 text-slate-400",
    };
    return colors[t] ?? "bg-slate-500/15 text-slate-400";
}

function statusBadge(status: string) {
    if (status === "Paid")
        return <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-[10px]">Paid</Badge>;
    if (status === "Sent")
        return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[10px]">Sent</Badge>;
    return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/20 text-[10px]">Draft</Badge>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
    label, value, sub, color = "slate", icon: Icon, warn,
}: {
    label: string;
    value: string;
    sub?: string;
    color?: "slate" | "green" | "red" | "blue" | "amber";
    icon: React.ElementType;
    warn?: boolean;
}) {
    const colours = {
        slate: "text-slate-100",
        green: "text-green-400",
        red:   "text-red-400",
        blue:  "text-blue-400",
        amber: "text-amber-400",
    };
    return (
        <div className={`bg-slate-800/50 border rounded-xl p-4 flex flex-col gap-2 ${warn ? "border-amber-500/40" : "border-slate-700/50"}`}>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${colours[color]}`} />
            </div>
            <div className={`text-xl font-bold tabular-nums ${colours[color]}`}>{value}</div>
            {sub && <div className="text-xs text-slate-500">{sub}</div>}
            {warn && (
                <div className="flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertTriangle className="w-3 h-3" /> Over budget
                </div>
            )}
        </div>
    );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: "green" | "amber" | "red" }) {
    const pctVal = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const bg = { green: "bg-green-500", amber: "bg-amber-400", red: "bg-red-500" }[color];
    return (
        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${bg}`} style={{ width: `${pctVal}%` }} />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClientPLDashboard({
    projectId,
    contractValue,
    totalBudgetCost,
    riskAmt,
    riskPct,
    budgetBySection,
    actualBySection,
    costsPosted,
    invoicedTotal,
    receivedTotal,
    approvedVarTotal,
    expenses,
    invoices,
    staffCatalogue,
    plantCatalogue,
    estimateLines,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isLogOpen, setIsLogOpen]   = useState(false);
    const [activeTab, setActiveTab]   = useState<"overview" | "costs" | "invoices">("overview");

    // Drill-down expand state (by trade section name)
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // ── Computed P&L metrics ─────────────────────────────────────────────────
    const revisedContractValue = contractValue + approvedVarTotal;
    const totalBudgetWithRisk  = totalBudgetCost + riskAmt;
    const estimatedMargin      = contractValue - totalBudgetCost;
    const estimatedMarginPct   = contractValue > 0 ? (estimatedMargin / contractValue) * 100 : 0;
    const budgetRemaining      = totalBudgetWithRisk - costsPosted;
    const forecastMargin       = revisedContractValue - (costsPosted + Math.max(budgetRemaining, 0));
    const forecastMarginPct    = revisedContractValue > 0 ? (forecastMargin / revisedContractValue) * 100 : 0;
    const costBurnPct          = totalBudgetWithRisk > 0 ? (costsPosted / totalBudgetWithRisk) * 100 : 0;
    const outstandingDebt      = invoicedTotal - receivedTotal;
    const isOverBudget         = costsPosted > totalBudgetWithRisk * 1.1;

    // ── Build drill-down: actual costs by section → cost_type ────────────────
    const actualByCostType = new Map<string, Map<string, number>>();
    for (const exp of expenses) {
        const section  = (exp.trade_section as string) || "General";
        const costType = (exp.cost_type as string)     || "other";
        if (!actualByCostType.has(section)) actualByCostType.set(section, new Map());
        const typeMap = actualByCostType.get(section)!;
        typeMap.set(costType, (typeMap.get(costType) ?? 0) + Number(exp.amount));
    }

    // ── Merge budget + actual by section ────────────────────────────────────
    const allSections = Array.from(
        new Set([...budgetBySection.map(b => b.section), ...actualBySection.map(a => a.section)])
    );
    const mergedSections = allSections.map(section => {
        const budget   = budgetBySection.find(b => b.section === section)?.budget ?? 0;
        const actual   = actualBySection.find(a => a.section === section)?.actual ?? 0;
        const variance = budget - actual;
        const spentPct = budget > 0 ? (actual / budget) * 100 : 0;
        return { section, budget, actual, variance, spentPct };
    }).sort((a, b) => b.budget - a.budget);

    // ── Toggle drill-down row ────────────────────────────────────────────────
    const toggleDrillDown = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section); else next.add(section);
            return next;
        });
    };

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleDeleteCost = (id: string) => {
        startTransition(async () => {
            await deleteCostAction(id);
            toast.success("Cost entry removed.");
            router.refresh();
        });
    };

    const handleStatusChange = (id: string, status: "Draft" | "Sent" | "Paid") => {
        startTransition(async () => {
            await updateInvoiceStatusAction(id, status);
            toast.success(`Invoice marked as ${status}.`);
            router.refresh();
        });
    };

    // ── Colour helpers ───────────────────────────────────────────────────────
    const marginColor = (pctVal: number): "green" | "amber" | "red" => {
        if (pctVal >= 10) return "green";
        if (pctVal >= 0)  return "amber";
        return "red";
    };
    const burnColor = (pctVal: number): "green" | "amber" | "red" => {
        if (pctVal < 80)  return "green";
        if (pctVal < 100) return "amber";
        return "red";
    };

    return (
        <div className="space-y-6">

            {/* ── KPI Strip ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <KpiCard
                    label="Contract Value"
                    value={gbp(contractValue)}
                    sub={approvedVarTotal > 0 ? `+${gbp(approvedVarTotal, true)} variations` : "Original contract sum"}
                    color="blue"
                    icon={PoundSterling}
                />
                <KpiCard
                    label="Budget Cost"
                    value={gbp(totalBudgetCost)}
                    sub={riskAmt > 0 ? `+${gbp(riskAmt, true)} risk (${riskPct}%)` : `Est. margin ${estimatedMarginPct.toFixed(1)}%`}
                    color="slate"
                    icon={BarChart3}
                />
                <KpiCard
                    label="Estimated Margin"
                    value={gbp(estimatedMargin)}
                    sub={pct(estimatedMargin, contractValue) + " margin"}
                    color={marginColor(estimatedMarginPct)}
                    icon={estimatedMargin >= 0 ? TrendingUp : TrendingDown}
                />
                <KpiCard
                    label="Costs to Date"
                    value={gbp(costsPosted)}
                    sub={`${costBurnPct.toFixed(0)}% of budget`}
                    color={isOverBudget ? "red" : costsPosted > totalBudgetWithRisk * 0.8 ? "amber" : "slate"}
                    icon={Hammer}
                    warn={isOverBudget}
                />
                <KpiCard
                    label="Invoiced to Date"
                    value={gbp(invoicedTotal)}
                    sub={`${gbp(receivedTotal, true)} received`}
                    color={outstandingDebt > 0 ? "amber" : "green"}
                    icon={Receipt}
                />
            </div>

            {/* ── Budget burn bar ──────────────────────────────────────────── */}
            {totalBudgetWithRisk > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">
                            Budget Burn — {pct(costsPosted, totalBudgetWithRisk)} spent
                            {riskAmt > 0 && <span className="text-slate-500"> (incl. {gbp(riskAmt, true)} risk allowance)</span>}
                        </span>
                        <span className={`font-semibold ${budgetRemaining < 0 ? "text-red-400" : "text-slate-300"}`}>
                            {budgetRemaining >= 0
                                ? gbp(budgetRemaining, true) + " remaining"
                                : gbp(Math.abs(budgetRemaining), true) + " over budget"}
                        </span>
                    </div>
                    <ProgressBar value={costsPosted} max={totalBudgetWithRisk} color={burnColor(costBurnPct)} />
                    {forecastMargin !== estimatedMargin && (
                        <div className="text-[11px] text-slate-500">
                            Forecast margin at completion:{" "}
                            <span className={`font-semibold ${forecastMarginPct >= 10 ? "text-green-400" : forecastMarginPct >= 0 ? "text-amber-400" : "text-red-400"}`}>
                                {gbp(forecastMargin, true)} ({forecastMarginPct.toFixed(1)}%)
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab navigation ───────────────────────────────────────────── */}
            <div className="flex gap-0 border-b border-slate-700/50">
                {(["overview", "costs", "invoices"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2.5 text-sm font-medium border-b-2 capitalize transition-colors ${
                            activeTab === tab
                                ? "border-blue-500 text-blue-400"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        {tab === "overview" ? "Budget vs Actual" : tab === "costs" ? "Cost Entries" : "Invoices"}
                    </button>
                ))}
            </div>

            {/* ── TAB: Budget vs Actual ─────────────────────────────────────── */}
            {activeTab === "overview" && (
                <div className="space-y-3">
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 px-1">
                        <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Click any row to drill down by cost type</span>
                        {riskAmt > 0 && <span className="flex items-center gap-1 text-amber-400/70"><ShieldAlert className="w-3 h-3" /> Risk allowance shown separately</span>}
                        {approvedVarTotal > 0 && <span className="flex items-center gap-1 text-green-400/70"><GitBranch className="w-3 h-3" /> Approved variations included</span>}
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        {mergedSections.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                No estimate data yet. Build your estimate to see budget breakdowns here.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trade Section</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actual</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Variance</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">% Spent</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mergedSections.map((row, i) => {
                                        const isOver     = row.actual > row.budget * 1.1 && row.budget > 0;
                                        const isNearOver = row.actual > row.budget * 0.85 && row.budget > 0;
                                        const isExpanded = expandedSections.has(row.section);
                                        const typeBreakdown = actualByCostType.get(row.section);
                                        const hasBreakdown  = typeBreakdown && typeBreakdown.size > 0;

                                        return (
                                            <React.Fragment key={row.section}>
                                                {/* Main section row */}
                                                <tr
                                                    onClick={() => hasBreakdown && toggleDrillDown(row.section)}
                                                    className={`border-b border-slate-700/30 transition-colors ${hasBreakdown ? "cursor-pointer hover:bg-slate-700/20" : "hover:bg-slate-700/10"}`}
                                                >
                                                    <td className="px-4 py-3 text-slate-200 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {hasBreakdown ? (
                                                                <ChevronRight className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                            ) : (
                                                                <span className="w-3.5 h-3.5 flex-shrink-0" />
                                                            )}
                                                            {row.section}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-300 font-mono text-xs">{row.budget > 0 ? gbp(row.budget) : "—"}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-xs">
                                                        <span className={row.actual > 0 ? (isOver ? "text-red-400" : "text-slate-300") : "text-slate-600"}>
                                                            {row.actual > 0 ? gbp(row.actual) : "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-xs">
                                                        {row.budget > 0 || row.actual > 0 ? (
                                                            <span className={row.variance >= 0 ? "text-green-400" : "text-red-400"}>
                                                                {row.variance >= 0 ? "+" : ""}{gbp(row.variance)}
                                                            </span>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1">
                                                                <ProgressBar
                                                                    value={row.actual}
                                                                    max={row.budget || row.actual}
                                                                    color={isOver ? "red" : isNearOver ? "amber" : "green"}
                                                                />
                                                            </div>
                                                            <span className={`text-[10px] font-mono w-10 text-right ${isOver ? "text-red-400" : "text-slate-400"}`}>
                                                                {row.budget > 0 ? `${row.spentPct.toFixed(0)}%` : "—"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Drill-down: cost type breakdown */}
                                                {isExpanded && hasBreakdown && (
                                                    <tr className="border-b border-slate-700/20 bg-slate-900/40">
                                                        <td colSpan={5} className="px-4 py-0">
                                                            <div className="py-2 space-y-0.5 pl-6">
                                                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] font-semibold uppercase tracking-wider text-slate-600 pb-1">
                                                                    <span>Cost Type</span>
                                                                    <span className="text-right">Amount</span>
                                                                    <span className="text-right w-16">of section</span>
                                                                </div>
                                                                {Array.from(typeBreakdown!.entries())
                                                                    .sort((a, b) => b[1] - a[1])
                                                                    .map(([type, amount]) => (
                                                                        <div key={type} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-0.5">
                                                                            <span className="flex items-center gap-2">
                                                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${costTypeBadgeColor(type)}`}>
                                                                                    {costTypeLabel(type)}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-right font-mono text-xs text-slate-300">{gbp(amount)}</span>
                                                                            <span className="text-right font-mono text-[10px] text-slate-500 w-16">
                                                                                {row.actual > 0 ? pct(amount, row.actual) : "—"}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* Risk Allowance row */}
                                    {riskAmt > 0 && (
                                        <tr className="border-b border-slate-700/30 bg-amber-400/5">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
                                                    <span className="text-amber-400/80 font-medium text-sm">Risk Allowance</span>
                                                    <span className="text-[10px] text-amber-400/50">({riskPct}% of cost)</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 pl-6 mt-0.5">Unrealised risk flows to margin at completion</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-amber-400/80 font-mono text-xs">{gbp(riskAmt)}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs">—</td>
                                            <td className="px-4 py-3 text-right text-amber-400/80 font-mono text-xs">+{gbp(riskAmt)}</td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500">Contingency</td>
                                        </tr>
                                    )}

                                    {/* Approved Variations row */}
                                    {approvedVarTotal > 0 && (
                                        <tr className="border-b border-slate-700/30 bg-green-400/5">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <GitBranch className="w-3.5 h-3.5 text-green-400/70 flex-shrink-0" />
                                                    <span className="text-green-400/80 font-medium text-sm">Approved Variations</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 pl-6 mt-0.5">Increases revised contract value to {gbp(revisedContractValue, true)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-green-400/80 font-mono text-xs">+{gbp(approvedVarTotal)}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs">—</td>
                                            <td className="px-4 py-3 text-right text-green-400/80 font-mono text-xs">+{gbp(approvedVarTotal)}</td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500">Revenue uplift</td>
                                        </tr>
                                    )}
                                </tbody>

                                {/* Totals row */}
                                {mergedSections.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t border-slate-600/50 bg-slate-700/20">
                                            <td className="px-4 py-3 text-slate-300 font-bold text-xs uppercase tracking-wide">
                                                Total Budget
                                                {riskAmt > 0 && <span className="text-slate-500 font-normal normal-case"> (incl. risk)</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-200 font-bold font-mono text-xs">{gbp(totalBudgetWithRisk)}</td>
                                            <td className="px-4 py-3 text-right font-bold font-mono text-xs">
                                                <span className={isOverBudget ? "text-red-400" : "text-slate-200"}>{gbp(costsPosted)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold font-mono text-xs">
                                                <span className={totalBudgetWithRisk - costsPosted >= 0 ? "text-green-400" : "text-red-400"}>
                                                    {totalBudgetWithRisk - costsPosted >= 0 ? "+" : ""}{gbp(totalBudgetWithRisk - costsPosted)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-mono text-slate-400">
                                                {totalBudgetWithRisk > 0 ? `${((costsPosted / totalBudgetWithRisk) * 100).toFixed(0)}%` : "—"}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── TAB: Cost Entries ─────────────────────────────────────────── */}
            {activeTab === "costs" && (
                <div className="space-y-3">
                    {/* Log Cost button */}
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            onClick={() => setIsLogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                        >
                            <Plus className="w-4 h-4" /> Log Cost
                        </Button>
                        <LogCostSheet
                            projectId={projectId}
                            isOpen={isLogOpen}
                            onClose={() => setIsLogOpen(false)}
                            onSuccess={() => router.refresh()}
                            staffCatalogue={staffCatalogue}
                            plantCatalogue={plantCatalogue}
                            totalCostsToDate={costsPosted}
                            estimateLines={estimateLines}
                        />
                    </div>

                    {/* Costs table */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        {expenses.length === 0 ? (
                            <div className="p-10 text-center">
                                <Hammer className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm font-medium">No costs logged yet</p>
                                <p className="text-slate-600 text-xs mt-1">Use "Log Cost" to record actual expenditure against this project.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Section</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Supplier</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map((exp: any) => (
                                        <tr key={exp.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(exp.expense_date)}</td>
                                            <td className="px-4 py-3 text-slate-200">{exp.description}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${costTypeBadgeColor(exp.cost_type || "other")}`}>
                                                    {costTypeLabel(exp.cost_type || "other")}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{exp.trade_section || "General"}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{exp.supplier || "—"}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-200 font-semibold">{gbp(Number(exp.amount))}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDeleteCost(exp.id)}
                                                    disabled={isPending}
                                                    className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-600/50 bg-slate-700/20">
                                        <td colSpan={5} className="px-4 py-3 text-slate-400 font-bold text-xs uppercase tracking-wide">Total Costs Posted</td>
                                        <td className="px-4 py-3 text-right font-bold font-mono text-xs text-slate-100">{gbp(costsPosted)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── TAB: Invoices ─────────────────────────────────────────────── */}
            {activeTab === "invoices" && (
                <div className="space-y-3">
                    {/* Summary strip */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Invoiced</div>
                            <div className="text-lg font-bold text-blue-400 tabular-nums">{gbp(invoicedTotal)}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{pct(invoicedTotal, revisedContractValue)} of contract</div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Received</div>
                            <div className="text-lg font-bold text-green-400 tabular-nums">{gbp(receivedTotal)}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{invoicedTotal > 0 ? pct(receivedTotal, invoicedTotal) + " of invoiced" : "—"}</div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Outstanding</div>
                            <div className={`text-lg font-bold tabular-nums ${outstandingDebt > 0 ? "text-amber-400" : "text-slate-400"}`}>
                                {gbp(outstandingDebt)}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">awaiting payment</div>
                        </div>
                    </div>

                    {/* Invoices table */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        {invoices.length === 0 ? (
                            <div className="p-10 text-center">
                                <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm font-medium">No invoices raised yet</p>
                                <p className="text-slate-600 text-xs mt-1">
                                    Raise invoices from the{" "}
                                    <a href={`/dashboard/projects/billing?projectId=${projectId}`} className="text-blue-400 hover:underline">
                                        Billing & Invoicing
                                    </a>{" "}
                                    page.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoice #</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Update</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv: any) => (
                                        <tr key={inv.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3 text-slate-200 font-mono text-xs font-semibold">{inv.invoice_number}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{inv.type}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(inv.created_at)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-200 font-semibold">{gbp(Number(inv.amount))}</td>
                                            <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                                            <td className="px-4 py-3">
                                                <Select
                                                    value={inv.status}
                                                    onValueChange={(val) => handleStatusChange(inv.id, val as "Draft" | "Sent" | "Paid")}
                                                    disabled={isPending}
                                                >
                                                    <SelectTrigger className="h-7 w-28 bg-slate-700/50 border-slate-600 text-slate-300 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-800 border-slate-600">
                                                        <SelectItem value="Draft" className="text-slate-200 text-xs focus:bg-slate-700">Draft</SelectItem>
                                                        <SelectItem value="Sent" className="text-slate-200 text-xs focus:bg-slate-700">Sent</SelectItem>
                                                        <SelectItem value="Paid" className="text-slate-200 text-xs focus:bg-slate-700">Paid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
