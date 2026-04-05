"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    PoundSterling,
    Hammer,
    Receipt,
    Clock,
    TrendingUp,
    GitBranch,
    CreditCard,
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    ArrowLeft,
    Plus,
    Scale,
    ChevronDown,
} from "lucide-react";
import { logCostAction, updateInvoiceStatusAction } from "../projects/p-and-l/actions";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CostEntry {
    id: string;
    description: string;
    amount: number;
    expense_date: string | null;
    cost_type: string | null;
    trade_section: string | null;
}

interface Invoice {
    id: string;
    invoice_number: string | null;
    type: string | null;
    amount: number;
    status: string;
    created_at: string;
}

interface Variation {
    id: string;
    title: string;
    amount: number;
    status: string;
    created_at: string;
}

interface Props {
    projectId: string;
    project: {
        id: string;
        name: string;
        client_name?: string | null;
        site_address?: string | null;
        start_date?: string | null;
        project_type?: string | null;
    };
    contractValue: number;
    budgetCost: number;
    costsPosted: number;
    invoicedTotal: number;
    receivedTotal: number;
    approvedVarTotal: number;
    budgetBurnPct: number;
    completionPct: number;
    estimatedMarginPct: number;
    costs: CostEntry[];
    invoices: Invoice[];
    variations: Variation[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gbp(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`;
    if (Math.abs(n) >= 1_000) return `£${(n / 1_000).toFixed(1)}k`;
    return `£${n.toFixed(0)}`;
}

function ragStatus(budgetBurnPct: number, costsPosted: number, invoicedTotal: number) {
    if (budgetBurnPct > 110) return { label: "Over Budget", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", icon: AlertTriangle };
    if (budgetBurnPct > 85) return { label: "At Risk", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: AlertTriangle };
    if (costsPosted > 0 || invoicedTotal > 0) return { label: "On Track", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", icon: CheckCircle2 };
    return { label: "Not Started", color: "text-slate-400", bg: "bg-slate-400/10 border-slate-400/20", icon: CircleDot };
}

function statusBadge(status: string) {
    const map: Record<string, string> = {
        Paid: "bg-green-400/15 text-green-400",
        Sent: "bg-blue-400/15 text-blue-400",
        Draft: "bg-slate-600/50 text-slate-400",
        Approved: "bg-green-400/15 text-green-400",
        Pending: "bg-amber-400/15 text-amber-400",
        Rejected: "bg-red-400/15 text-red-400",
    };
    return map[status] ?? "bg-slate-600/50 text-slate-400";
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
    return (
        <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
    );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = "slate" }: {
    label: string; value: string; sub?: string; icon: React.ElementType;
    color?: "slate" | "blue" | "green" | "amber" | "red";
}) {
    const c = { slate: "text-slate-100", blue: "text-blue-400", green: "text-green-400", amber: "text-amber-400", red: "text-red-400" };
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${c[color]}`} />
            </div>
            <div className={`text-xl font-bold ${c[color]}`}>{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
    );
}

// ── Add Cost Mini-Form ────────────────────────────────────────────────────────
function AddCostForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [costType, setCostType] = useState("materials");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!desc || !amount) return;
        startTransition(async () => {
            await logCostAction({
                projectId,
                description: desc,
                amount: parseFloat(amount),
                cost_type: costType,
                trade_section: "General",
                expense_date: date,
            });
            router.refresh();
            onDone();
        });
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Log a Cost</h3>
            <div className="grid grid-cols-2 gap-2">
                <input
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Description"
                    required
                    className="col-span-2 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Amount (£)"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <select
                    value={costType}
                    onChange={e => setCostType(e.target.value)}
                    className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                    {["labour", "materials", "plant", "subcontract", "overhead", "other"].map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                </select>
                <input
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    type="date"
                    className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
            </div>
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isPending ? "Saving…" : "Log Cost"}
                </button>
                <button type="button" onClick={onDone} className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    Cancel
                </button>
            </div>
        </form>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProjectLiveClient({
    projectId, project, contractValue, budgetCost, costsPosted,
    invoicedTotal, receivedTotal, approvedVarTotal,
    budgetBurnPct, completionPct, estimatedMarginPct,
    costs, invoices, variations,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showAddCost, setShowAddCost] = useState(false);
    const rag = ragStatus(budgetBurnPct, costsPosted, invoicedTotal);
    const RagIcon = rag.icon;
    const outstandingAmt = invoicedTotal - receivedTotal;
    const revisedValue = contractValue + approvedVarTotal;

    const handleInvoiceStatus = (id: string, status: string) => {
        startTransition(async () => {
            await updateInvoiceStatusAction(id, status as any);
            router.refresh();
        });
    };

    return (
        <div className="space-y-6">

            {/* ── Project header ───────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${rag.bg} ${rag.color}`}>
                            <RagIcon className="w-3.5 h-3.5" />
                            {rag.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                        {project.client_name && <span>{project.client_name}</span>}
                        {project.project_type && <span>· {project.project_type}</span>}
                        {project.site_address && <span>· {project.site_address}</span>}
                        {project.start_date && (
                            <span>· Started {new Date(project.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        )}
                    </div>
                </div>
                <Link href="/dashboard/live" className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors flex-shrink-0">
                    <ArrowLeft className="w-3.5 h-3.5" /> All Projects
                </Link>
            </div>

            {/* ── KPI Strip ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Contract Value" value={gbp(contractValue)} sub={approvedVarTotal > 0 ? `+${gbp(approvedVarTotal)} variations` : undefined} icon={PoundSterling} color="blue" />
                <KpiCard label="Costs to Date" value={gbp(costsPosted)} sub={budgetCost > 0 ? `${budgetBurnPct.toFixed(0)}% of ${gbp(budgetCost)} budget` : "No budget set"} icon={Hammer} color={budgetBurnPct > 110 ? "red" : budgetBurnPct > 85 ? "amber" : "slate"} />
                <KpiCard label="Invoiced" value={gbp(invoicedTotal)} sub={revisedValue > 0 ? `${completionPct.toFixed(0)}% complete` : undefined} icon={Receipt} color="blue" />
                <KpiCard label="Outstanding" value={gbp(outstandingAmt)} sub="Invoiced not yet paid" icon={Clock} color={outstandingAmt > 0 ? "amber" : "slate"} />
            </div>

            {/* ── Progress bars ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-400 uppercase tracking-wide">Budget Burn</span>
                        <span className={budgetBurnPct > 110 ? "text-red-400 font-bold" : budgetBurnPct > 85 ? "text-amber-400 font-bold" : "text-slate-300"}>
                            {gbp(costsPosted)} / {gbp(budgetCost)}
                        </span>
                    </div>
                    <ProgressBar pct={budgetBurnPct} color={budgetBurnPct > 110 ? "bg-red-500" : budgetBurnPct > 85 ? "bg-amber-400" : "bg-green-500"} />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{budgetBurnPct.toFixed(1)}% of budget used</span>
                        {budgetCost > costsPosted && <span>{gbp(budgetCost - costsPosted)} remaining</span>}
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-400 uppercase tracking-wide">Completion</span>
                        <span className="text-slate-300">{gbp(invoicedTotal)} / {gbp(revisedValue || contractValue)}</span>
                    </div>
                    <ProgressBar pct={completionPct} color="bg-blue-500" />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{completionPct.toFixed(1)}% invoiced</span>
                        <span className={estimatedMarginPct >= 15 ? "text-green-400" : estimatedMarginPct >= 8 ? "text-amber-400" : "text-orange-400"}>
                            {estimatedMarginPct.toFixed(1)}% est. margin
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Module quick links ────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/projects/p-and-l?projectId=${projectId}`} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:text-blue-400 hover:border-blue-500/30 transition-all">
                    <TrendingUp className="w-3.5 h-3.5" /> Job P&L
                </Link>
                <Link href={`/dashboard/projects/billing?projectId=${projectId}`} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:text-blue-400 hover:border-blue-500/30 transition-all">
                    <CreditCard className="w-3.5 h-3.5" /> Billing
                </Link>
                <Link href={`/dashboard/projects/variations?projectId=${projectId}`} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:text-blue-400 hover:border-blue-500/30 transition-all">
                    <GitBranch className="w-3.5 h-3.5" /> Variations
                </Link>
                <Link href={`/dashboard/projects/contracts?projectId=${projectId}`} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:text-slate-200 hover:border-slate-600 transition-all">
                    <Scale className="w-3.5 h-3.5" /> Contracts
                </Link>
            </div>

            {/* ── Cost Entries ──────────────────────────────────────────── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                    <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Hammer className="w-4 h-4 text-slate-400" /> Costs Posted
                        <span className="text-[11px] font-normal text-slate-500">({costs.length})</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAddCost(!showAddCost)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 text-xs font-medium rounded-lg transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Log Cost
                        </button>
                        <Link href={`/dashboard/projects/p-and-l?projectId=${projectId}`} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">
                            Full P&L →
                        </Link>
                    </div>
                </div>
                {showAddCost && (
                    <div className="p-4 border-b border-slate-700/30">
                        <AddCostForm projectId={projectId} onDone={() => setShowAddCost(false)} />
                    </div>
                )}
                {costs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">No costs posted yet</div>
                ) : (
                    <div className="divide-y divide-slate-700/20">
                        {costs.slice(0, 8).map(c => (
                            <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/2 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-slate-200 truncate">{c.description}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                        {c.cost_type && <span className="capitalize">{c.cost_type}</span>}
                                        {c.expense_date && <span>· {new Date(c.expense_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-semibold text-slate-300 ml-3">£{Number(c.amount).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
                            </div>
                        ))}
                        {costs.length > 8 && (
                            <div className="px-4 py-2 text-center">
                                <Link href={`/dashboard/projects/p-and-l?projectId=${projectId}`} className="text-[11px] text-blue-500 hover:text-blue-400">
                                    View all {costs.length} cost entries →
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Invoices ──────────────────────────────────────────────── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                    <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" /> Invoices
                        <span className="text-[11px] font-normal text-slate-500">({invoices.length})</span>
                    </h2>
                    <Link href={`/dashboard/projects/billing?projectId=${projectId}`} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">
                        Manage →
                    </Link>
                </div>
                {invoices.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">No invoices yet</div>
                ) : (
                    <div className="divide-y divide-slate-700/20">
                        {invoices.slice(0, 6).map(inv => (
                            <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-slate-200">
                                        {inv.invoice_number ?? inv.type ?? "Invoice"} · {inv.type}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                    <span className="text-xs font-mono font-semibold text-slate-300">£{Number(inv.amount).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
                                    <select
                                        value={inv.status}
                                        onChange={e => handleInvoiceStatus(inv.id, e.target.value)}
                                        disabled={isPending}
                                        className={`text-[10px] font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none ${statusBadge(inv.status)}`}
                                    >
                                        {["Draft", "Sent", "Paid"].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Variations ────────────────────────────────────────────── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                    <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-slate-400" /> Variations
                        <span className="text-[11px] font-normal text-slate-500">({variations.length})</span>
                        {approvedVarTotal > 0 && (
                            <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                                +{gbp(approvedVarTotal)} approved
                            </span>
                        )}
                    </h2>
                    <Link href={`/dashboard/projects/variations?projectId=${projectId}`} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">
                        Manage →
                    </Link>
                </div>
                {variations.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">No variations logged</div>
                ) : (
                    <div className="divide-y divide-slate-700/20">
                        {variations.slice(0, 5).map(v => (
                            <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-slate-200 truncate">{v.title}</div>
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                    <span className="text-xs font-mono font-semibold text-slate-300">£{Number(v.amount).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(v.status)}`}>{v.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
