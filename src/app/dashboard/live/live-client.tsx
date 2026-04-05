"use client";

import { useState } from "react";
import Link from "next/link";
import {
    PoundSterling,
    Hammer,
    Receipt,
    Clock,
    TrendingUp,
    TrendingDown,
    BarChart3,
    CreditCard,
    GitBranch,
    Search,
    Plus,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    CircleDot,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProjectRow {
    id: string;
    name: string;
    client_name?: string | null;
    project_type?: string | null;
    site_address?: string | null;
    proposal_status?: string | null;
    start_date?: string | null;
    updated_at?: string | null;
    contractValue: number;
    budgetCost: number;
    revisedValue: number;
    costsPosted: number;
    invoicedTotal: number;
    receivedTotal: number;
    approvedVariations: number;
    estimatedMarginPct: number;
    completionPct: number;
    budgetBurnPct: number;
    hasActivity: boolean;
}

interface Props {
    projects: ProjectRow[];
    totalContractValue: number;
    totalCosts: number;
    totalInvoiced: number;
    totalOutstanding: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gbp(n: number, compact = false): string {
    if (compact) {
        if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
        if (Math.abs(n) >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`;
        return `£${n.toFixed(0)}`;
    }
    return "£" + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function timeAgo(date: string | null | undefined): string {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7)  return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// RAG status based on budget burn & margin
function ragStatus(p: ProjectRow): { label: string; color: string; icon: React.ElementType } {
    if (p.budgetBurnPct > 110) return { label: "Over Budget",  color: "text-red-400",   icon: AlertTriangle };
    if (p.budgetBurnPct > 85)  return { label: "At Risk",      color: "text-amber-400", icon: AlertTriangle };
    if (p.costsPosted > 0 || p.invoicedTotal > 0) return { label: "On Track", color: "text-green-400", icon: CheckCircle2 };
    return { label: "Not Started", color: "text-slate-400", icon: CircleDot };
}

function ProgressMini({ pct, color }: { pct: number; color: string }) {
    return (
        <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
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

type FilterKey = "all" | "active" | "accepted";

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveProjectsClient({ projects, totalContractValue, totalCosts, totalInvoiced, totalOutstanding }: Props) {
    const [query, setQuery]   = useState("");
    const [filter, setFilter] = useState<FilterKey>("all");

    const filtered = projects.filter(p => {
        const matchSearch = query.length === 0 ||
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.client_name ?? "").toLowerCase().includes(query.toLowerCase());
        const matchFilter =
            filter === "all" ? true :
            filter === "accepted" ? p.proposal_status === "accepted" :
            p.hasActivity;
        return matchSearch && matchFilter;
    });

    return (
        <div className="space-y-6">

            {/* ── Portfolio KPIs ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Portfolio Value"  value={gbp(totalContractValue, true)}  sub={`${projects.length} projects`}    icon={PoundSterling} color="blue" />
                <KpiCard label="Costs to Date"    value={gbp(totalCosts, true)}           sub="Actual spend logged"              icon={Hammer} />
                <KpiCard label="Invoiced"         value={gbp(totalInvoiced, true)}        sub="All applications"                 icon={Receipt} color="blue" />
                <KpiCard label="Outstanding"      value={gbp(totalOutstanding, true)}     sub="Invoiced not yet paid"            icon={Clock} color={totalOutstanding > 0 ? "amber" : "slate"} />
            </div>

            {/* ── Filter + Search bar ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Filter pills */}
                <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
                    {([["all", "All"], ["accepted", "Accepted"], ["active", "Has Activity"]] as [FilterKey, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === key ? "bg-slate-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {/* Search */}
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search projects…"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <Link
                    href="/dashboard/projects/new"
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> New Project
                </Link>
            </div>

            {/* ── Project cards ────────────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                    No projects match your filter. <button onClick={() => { setFilter("all"); setQuery(""); }} className="text-blue-400 hover:underline">Clear filters</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(proj => {
                        const rag = ragStatus(proj);
                        const RagIcon = rag.icon;
                        const outstandingAmt = proj.invoicedTotal - proj.receivedTotal;
                        return (
                            <div key={proj.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors">
                                {/* Top row */}
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <span className="font-semibold text-slate-100">{proj.name}</span>
                                            <span className={`flex items-center gap-1 text-[10px] font-semibold ${rag.color}`}>
                                                <RagIcon className="w-3 h-3" /> {rag.label}
                                            </span>
                                            {proj.approvedVariations > 0 && (
                                                <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                                                    +{gbp(proj.approvedVariations, true)} variations
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            {proj.client_name && <span>{proj.client_name}</span>}
                                            {proj.project_type && <span>· {proj.project_type}</span>}
                                            {proj.start_date && <span>· Started {new Date(proj.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                                            {proj.updated_at && <span>· {timeAgo(proj.updated_at)}</span>}
                                        </div>
                                    </div>
                                    {/* Contract value */}
                                    {proj.contractValue > 0 && (
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-lg font-bold text-slate-100">{gbp(proj.contractValue, true)}</div>
                                            <div className="text-[10px] text-slate-500">contract value</div>
                                        </div>
                                    )}
                                </div>

                                {/* Financial metrics grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Costs Posted</div>
                                        <div className={`text-sm font-semibold font-mono ${proj.budgetBurnPct > 110 ? "text-red-400" : "text-slate-200"}`}>
                                            {proj.costsPosted > 0 ? gbp(proj.costsPosted, true) : "—"}
                                        </div>
                                        {proj.budgetCost > 0 && (
                                            <ProgressMini pct={proj.budgetBurnPct} color={proj.budgetBurnPct > 110 ? "bg-red-500" : proj.budgetBurnPct > 85 ? "bg-amber-400" : "bg-green-500"} />
                                        )}
                                        {proj.budgetCost > 0 && (
                                            <div className="text-[10px] text-slate-600 mt-0.5">{proj.budgetBurnPct.toFixed(0)}% of {gbp(proj.budgetCost, true)} budget</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Invoiced</div>
                                        <div className="text-sm font-semibold font-mono text-blue-400">
                                            {proj.invoicedTotal > 0 ? gbp(proj.invoicedTotal, true) : "—"}
                                        </div>
                                        {proj.revisedValue > 0 && (
                                            <ProgressMini pct={proj.completionPct} color="bg-blue-500" />
                                        )}
                                        {proj.revisedValue > 0 && (
                                            <div className="text-[10px] text-slate-600 mt-0.5">{proj.completionPct.toFixed(0)}% complete</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Received</div>
                                        <div className="text-sm font-semibold font-mono text-green-400">
                                            {proj.receivedTotal > 0 ? gbp(proj.receivedTotal, true) : "—"}
                                        </div>
                                        {outstandingAmt > 0 && (
                                            <div className="text-[10px] text-amber-400 mt-0.5">{gbp(outstandingAmt, true)} outstanding</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Est. Margin</div>
                                        <div className={`text-sm font-semibold ${proj.estimatedMarginPct >= 15 ? "text-green-400" : proj.estimatedMarginPct >= 8 ? "text-amber-400" : proj.estimatedMarginPct > 0 ? "text-orange-400" : "text-slate-500"}`}>
                                            {proj.contractValue > 0 ? `${proj.estimatedMarginPct.toFixed(1)}%` : "—"}
                                        </div>
                                    </div>
                                </div>

                                {/* Action links */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-700/30">
                                    <Link
                                        href={`/dashboard/live?projectId=${proj.id}`}
                                        className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded-md hover:bg-blue-400/10"
                                    >
                                        Live View <ArrowRight className="w-3 h-3" />
                                    </Link>
                                    <span className="text-slate-700">|</span>
                                    <Link
                                        href={`/dashboard/projects/p-and-l?projectId=${proj.id}`}
                                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 transition-colors px-2 py-1 rounded-md hover:bg-blue-400/10"
                                    >
                                        <TrendingUp className="w-3 h-3" /> P&L
                                    </Link>
                                    <Link
                                        href={`/dashboard/projects/billing?projectId=${proj.id}`}
                                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 transition-colors px-2 py-1 rounded-md hover:bg-blue-400/10"
                                    >
                                        <CreditCard className="w-3 h-3" /> Billing
                                    </Link>
                                    <Link
                                        href={`/dashboard/projects/variations?projectId=${proj.id}`}
                                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 transition-colors px-2 py-1 rounded-md hover:bg-blue-400/10"
                                    >
                                        <GitBranch className="w-3 h-3" /> Variations
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer summary */}
            {filtered.length > 0 && (
                <p className="text-center text-xs text-slate-600">
                    Showing {filtered.length} of {projects.length} projects ·{" "}
                    <Link href="/dashboard/projects/p-and-l" className="text-blue-500 hover:text-blue-400 transition-colors">
                        View Global P&L →
                    </Link>
                </p>
            )}
        </div>
    );
}
