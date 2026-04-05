"use client";

import { useState, useTransition } from "react";
import { logCostAction, deleteCostAction, updateInvoiceStatusAction, COST_TYPES, TRADE_SECTIONS } from "./actions";
import { toast } from "sonner";
import {
    PoundSterling,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Plus,
    Trash2,
    Loader2,
    CheckCircle2,
    Clock,
    SendHorizonal,
    ChevronDown,
    BarChart3,
    Receipt,
    Hammer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    budgetBySection: Array<{ section: string; budget: number }>;
    actualBySection: Array<{ section: string; actual: number }>;
    costsPosted: number;
    invoicedTotal: number;
    receivedTotal: number;
    approvedVarTotal: number;
    expenses: any[];
    invoices: any[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gbp(n: number, compact = false): string {
    if (compact) {
        if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
        if (Math.abs(n) >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
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
            <div className={`text-xl font-bold ${colours[color]}`}>{value}</div>
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
    budgetBySection,
    actualBySection,
    costsPosted,
    invoicedTotal,
    receivedTotal,
    approvedVarTotal,
    expenses,
    invoices,
}: Props) {
    const [isPending, startTransition] = useTransition();
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "costs" | "invoices">("overview");

    // Log cost form state
    const [logDesc, setLogDesc]         = useState("");
    const [logAmount, setLogAmount]     = useState("");
    const [logType, setLogType]         = useState("materials");
    const [logSection, setLogSection]   = useState("General");
    const [logDate, setLogDate]         = useState(new Date().toISOString().split("T")[0]);
    const [logSupplier, setLogSupplier] = useState("");

    // ── Computed P&L metrics ─────────────────────────────────────────────────
    const revisedContractValue = contractValue + approvedVarTotal;
    const estimatedMargin      = contractValue - totalBudgetCost;
    const estimatedMarginPct   = contractValue > 0 ? (estimatedMargin / contractValue) * 100 : 0;
    const budgetRemaining      = totalBudgetCost - costsPosted;
    const forecastMargin       = revisedContractValue - (costsPosted + Math.max(budgetRemaining, 0));
    const forecastMarginPct    = revisedContractValue > 0 ? (forecastMargin / revisedContractValue) * 100 : 0;
    const costBurnPct          = totalBudgetCost > 0 ? (costsPosted / totalBudgetCost) * 100 : 0;
    const outstandingDebt      = invoicedTotal - receivedTotal;
    const isOverBudget         = costsPosted > totalBudgetCost * 1.1; // >10% over = alert

    // ── Merge budget + actual by section ────────────────────────────────────
    const allSections = Array.from(
        new Set([...budgetBySection.map(b => b.section), ...actualBySection.map(a => a.section)])
    );
    const mergedSections = allSections.map(section => {
        const budget = budgetBySection.find(b => b.section === section)?.budget ?? 0;
        const actual = actualBySection.find(a => a.section === section)?.actual ?? 0;
        const variance = budget - actual;
        const spentPct = budget > 0 ? (actual / budget) * 100 : 0;
        return { section, budget, actual, variance, spentPct };
    }).sort((a, b) => b.budget - a.budget);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleLogCost = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(logAmount);
        if (!logDesc.trim() || isNaN(amount) || amount <= 0) {
            toast.error("Please fill in all required fields with valid values.");
            return;
        }
        startTransition(async () => {
            const result = await logCostAction({
                projectId,
                description: logDesc.trim(),
                amount,
                cost_type: logType,
                trade_section: logSection,
                expense_date: logDate,
                supplier: logSupplier.trim() || undefined,
            });
            if (result.error) {
                toast.error("Failed to log cost: " + result.error);
            } else {
                toast.success("Cost logged successfully.");
                setIsLogOpen(false);
                setLogDesc(""); setLogAmount(""); setLogSupplier("");
                setLogType("materials"); setLogSection("General");
                setLogDate(new Date().toISOString().split("T")[0]);
            }
        });
    };

    const handleDeleteCost = (id: string) => {
        startTransition(async () => {
            await deleteCostAction(id);
            toast.success("Cost entry removed.");
        });
    };

    const handleStatusChange = (id: string, status: "Draft" | "Sent" | "Paid") => {
        startTransition(async () => {
            await updateInvoiceStatusAction(id, status);
            toast.success(`Invoice marked as ${status}.`);
        });
    };

    // ── Margin colour helper ─────────────────────────────────────────────────
    const marginColor = (pctVal: number): "green" | "amber" | "red" => {
        if (pctVal >= 10) return "green";
        if (pctVal >= 0)  return "amber";
        return "red";
    };

    // ── Spend bar colour ─────────────────────────────────────────────────────
    const burnColor = (pctVal: number): "green" | "amber" | "red" => {
        if (pctVal < 80)   return "green";
        if (pctVal < 100)  return "amber";
        return "red";
    };

    return (
        <div className="space-y-6">

            {/* ── KPI Strip ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <KpiCard
                    label="Contract Value"
                    value={gbp(contractValue, true)}
                    sub={approvedVarTotal > 0 ? `+${gbp(approvedVarTotal, true)} variations` : "Original contract sum"}
                    color="blue"
                    icon={PoundSterling}
                />
                <KpiCard
                    label="Budget Cost"
                    value={gbp(totalBudgetCost, true)}
                    sub={`Est. margin ${estimatedMarginPct.toFixed(1)}%`}
                    color="slate"
                    icon={BarChart3}
                />
                <KpiCard
                    label="Estimated Margin"
                    value={gbp(estimatedMargin, true)}
                    sub={pct(estimatedMargin, contractValue) + " margin"}
                    color={marginColor(estimatedMarginPct)}
                    icon={estimatedMargin >= 0 ? TrendingUp : TrendingDown}
                />
                <KpiCard
                    label="Costs to Date"
                    value={gbp(costsPosted, true)}
                    sub={`${costBurnPct.toFixed(0)}% of budget`}
                    color={isOverBudget ? "red" : costsPosted > totalBudgetCost * 0.8 ? "amber" : "slate"}
                    icon={Hammer}
                    warn={isOverBudget}
                />
                <KpiCard
                    label="Invoiced to Date"
                    value={gbp(invoicedTotal, true)}
                    sub={`${gbp(receivedTotal, true)} received`}
                    color={outstandingDebt > 0 ? "amber" : "green"}
                    icon={Receipt}
                />
            </div>

            {/* ── Budget burn bar ──────────────────────────────────────────── */}
            {totalBudgetCost > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Budget Burn — {pct(costsPosted, totalBudgetCost)} spent</span>
                        <span className={`font-semibold ${budgetRemaining < 0 ? "text-red-400" : "text-slate-300"}`}>
                            {budgetRemaining >= 0 ? gbp(budgetRemaining, true) + " remaining" : gbp(Math.abs(budgetRemaining), true) + " over budget"}
                        </span>
                    </div>
                    <ProgressBar value={costsPosted} max={totalBudgetCost} color={burnColor(costBurnPct)} />
                    {forecastMargin !== estimatedMargin && (
                        <div className="text-[11px] text-slate-500">
                            Forecast margin at completion: <span className={`font-semibold ${forecastMarginPct >= 10 ? "text-green-400" : forecastMarginPct >= 0 ? "text-amber-400" : "text-red-400"}`}>
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
                                    const isOver = row.actual > row.budget * 1.1 && row.budget > 0;
                                    const isNearOver = row.actual > row.budget * 0.85 && row.budget > 0;
                                    return (
                                        <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3 text-slate-200 font-medium">{row.section}</td>
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
                                    );
                                })}
                            </tbody>
                            {/* Totals row */}
                            {mergedSections.length > 0 && (
                                <tfoot>
                                    <tr className="border-t border-slate-600/50 bg-slate-700/20">
                                        <td className="px-4 py-3 text-slate-300 font-bold text-xs uppercase tracking-wide">Total</td>
                                        <td className="px-4 py-3 text-right text-slate-200 font-bold font-mono text-xs">{gbp(totalBudgetCost)}</td>
                                        <td className="px-4 py-3 text-right font-bold font-mono text-xs">
                                            <span className={isOverBudget ? "text-red-400" : "text-slate-200"}>{gbp(costsPosted)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold font-mono text-xs">
                                            <span className={totalBudgetCost - costsPosted >= 0 ? "text-green-400" : "text-red-400"}>
                                                {totalBudgetCost - costsPosted >= 0 ? "+" : ""}{gbp(totalBudgetCost - costsPosted)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-mono text-slate-400">
                                            {totalBudgetCost > 0 ? `${((costsPosted / totalBudgetCost) * 100).toFixed(0)}%` : "—"}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    )}
                </div>
            )}

            {/* ── TAB: Cost Entries ─────────────────────────────────────────── */}
            {activeTab === "costs" && (
                <div className="space-y-3">
                    {/* Log Cost button */}
                    <div className="flex justify-end">
                        <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                                    <Plus className="w-4 h-4" /> Log Cost
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-100">Log Actual Cost</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleLogCost} className="space-y-4 pt-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 space-y-1.5">
                                            <Label className="text-slate-300 text-xs">Description *</Label>
                                            <Input
                                                value={logDesc}
                                                onChange={e => setLogDesc(e.target.value)}
                                                placeholder="e.g. Brickwork — Phase 1"
                                                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-300 text-xs">Amount (£) *</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={logAmount}
                                                onChange={e => setLogAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-300 text-xs">Date *</Label>
                                            <Input
                                                type="date"
                                                value={logDate}
                                                onChange={e => setLogDate(e.target.value)}
                                                className="bg-slate-800 border-slate-600 text-slate-100"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-300 text-xs">Cost Type</Label>
                                            <Select value={logType} onValueChange={setLogType}>
                                                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-600">
                                                    {COST_TYPES.map(t => (
                                                        <SelectItem key={t} value={t} className="text-slate-100 focus:bg-slate-700">
                                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-300 text-xs">Trade Section</Label>
                                            <Select value={logSection} onValueChange={setLogSection}>
                                                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-600 max-h-48">
                                                    {TRADE_SECTIONS.map(s => (
                                                        <SelectItem key={s} value={s} className="text-slate-100 focus:bg-slate-700">
                                                            {s}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-2 space-y-1.5">
                                            <Label className="text-slate-300 text-xs">Supplier / Subcontractor</Label>
                                            <Input
                                                value={logSupplier}
                                                onChange={e => setLogSupplier(e.target.value)}
                                                placeholder="Optional"
                                                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter className="pt-2">
                                        <Button
                                            type="submit"
                                            disabled={isPending}
                                            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                                        >
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                            Log Cost
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
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
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
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
                            <div className="text-lg font-bold text-blue-400">{gbp(invoicedTotal, true)}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{pct(invoicedTotal, contractValue + approvedVarTotal)} of contract</div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Received</div>
                            <div className="text-lg font-bold text-green-400">{gbp(receivedTotal, true)}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{invoicedTotal > 0 ? pct(receivedTotal, invoicedTotal) + " of invoiced" : "—"}</div>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Outstanding</div>
                            <div className={`text-lg font-bold ${(invoicedTotal - receivedTotal) > 0 ? "text-amber-400" : "text-slate-400"}`}>
                                {gbp(invoicedTotal - receivedTotal, true)}
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
