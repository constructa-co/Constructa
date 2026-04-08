"use client";

import Link from "next/link";
import {
    TrendingUp, HardHat, Plus, ArrowRight, Clock, CheckCircle2, AlertCircle,
    AlertTriangle, FileText, CreditCard, GitBranch, RefreshCw, MessageSquare,
    Banknote, ShieldAlert, CalendarDays, Activity,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => {
    if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`;
    return `£${n.toLocaleString("en-GB")}`;
};

const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const timeAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7)  return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const today = new Date(); today.setHours(0, 0, 0, 0);

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    projects:     any[];
    profile:      any;
    estimates:    any[];
    invoices:     any[];
    variations:   any[];
    changeEvents: any[];
    rfis:         any[];
    ewns:         any[];
    userId:       string;
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, colour, icon: Icon, href }: {
    label: string; value: string; sub: string; colour: string; icon: any; href?: string;
}) {
    const inner = (
        <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 ${href ? "hover:border-slate-600 transition-colors" : ""}`}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <Icon className={`w-4 h-4 ${colour}`} />
            </div>
            <p className={`text-2xl font-bold ${colour}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Alert banner ──────────────────────────────────────────────────────────────
function AlertBanner({ colour, icon: Icon, title, children }: {
    colour: "amber" | "red" | "green" | "blue"; icon: any; title: string; children: React.ReactNode;
}) {
    const styles = {
        amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
        red:   "bg-red-500/10 border-red-500/30 text-red-300",
        green: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
        blue:  "bg-blue-500/10 border-blue-500/30 text-blue-300",
    };
    const iconStyles = {
        amber: "text-amber-400", red: "text-red-400", green: "text-emerald-400", blue: "text-blue-400",
    };
    return (
        <div className={`border rounded-xl p-4 flex items-start gap-3 ${styles[colour]}`}>
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[colour]}`} />
            <div>
                <p className="text-sm font-semibold">{title}</p>
                <div className="mt-1 space-y-0.5 text-xs opacity-80">{children}</div>
            </div>
        </div>
    );
}

// ── Project status badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const s: Record<string, string> = {
        active:      "bg-emerald-500/15 text-emerald-400",
        lead:        "bg-slate-700 text-slate-400",
        estimating:  "bg-blue-500/15 text-blue-400",
        proposal_sent: "bg-purple-500/15 text-purple-400",
        completed:   "bg-slate-700 text-slate-500",
        lost:        "bg-red-500/15 text-red-400",
    };
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s[status] ?? s.lead}`}>
            {status?.replace(/_/g, " ") ?? "lead"}
        </span>
    );
}

// ── Programme delay calc ──────────────────────────────────────────────────────
function getProjectProgrammeDelay(project: any): number {
    const phases: any[] = project.programme_phases ?? [];
    if (!phases.length || !project.start_date) return 0;
    const start = new Date(project.start_date + "T00:00:00");
    let maxDelay = 0;
    for (const ph of phases) {
        const baseDays = ph.manualDays ?? ph.calculatedDays ?? 0;
        const baselineFinish = new Date(start.getTime() + (ph.startOffset + baseDays) * 86400000);
        const revised = ph.revised_planned_finish ? new Date(ph.revised_planned_finish + "T00:00:00") : null;
        const actual  = ph.actual_finish_date ? new Date(ph.actual_finish_date + "T00:00:00") : null;
        const planned = revised ?? baselineFinish;
        if (actual) {
            const delay = Math.round((actual.getTime() - planned.getTime()) / 86400000);
            if (delay > maxDelay) maxDelay = delay;
        }
    }
    return maxDelay;
}

export default function HomeClient({ projects, profile, estimates, invoices, variations, changeEvents, rfis, ewns }: Props) {

    // ── Project categories ────────────────────────────────────────────────────
    const activeProjects  = projects.filter(p => p.status === "active");
    const pipelineProjects = projects.filter(p => ["lead","estimating","proposal_sent"].includes(p.status));
    const closedProjects  = projects.filter(p => ["completed","lost"].includes(p.status));
    const pipelineValue   = pipelineProjects.reduce((s, p) => s + (p.potential_value || 0), 0);

    // ── Win rate (90d) ────────────────────────────────────────────────────────
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const decided = projects.filter(p =>
        new Date(p.created_at) > cutoff &&
        (p.proposal_status === "accepted" || p.proposal_status === "declined")
    );
    const won = decided.filter(p => p.proposal_status === "accepted").length;
    const winRate = decided.length > 0 ? Math.round((won / decided.length) * 100) : null;

    // ── Invoice KPIs ──────────────────────────────────────────────────────────
    const normalInvoices   = invoices.filter(i => !i.is_retention_release);
    const sentInvoices     = invoices.filter(i => i.status === "Sent" && !i.is_retention_release);
    const totalOutstanding = sentInvoices.reduce((s, i) => s + (i.net_due ?? i.amount ?? 0), 0);
    const overdueInvoices  = sentInvoices.filter(i => i.due_date && new Date(i.due_date + "T00:00:00") < today);
    const totalOverdue     = overdueInvoices.reduce((s, i) => s + (i.net_due ?? i.amount ?? 0), 0);
    const totalRetHeld     = normalInvoices.reduce((s, i) => s + (i.retention_held ?? 0), 0);
    const retReleased      = invoices.filter(i => i.is_retention_release && i.status === "Paid").reduce((s, i) => s + (i.amount ?? 0), 0);
    const retOutstanding   = totalRetHeld - retReleased;

    // ── Variations ────────────────────────────────────────────────────────────
    const pendingVars      = variations.filter(v => v.status === "Pending Approval");
    const pendingVarValue  = pendingVars.reduce((s, v) => s + Math.abs(v.amount || 0), 0);

    // ── Change events ─────────────────────────────────────────────────────────
    const openCEs          = changeEvents.filter(c => !["Agreed","Rejected","Withdrawn"].includes(c.status));
    const ceExposure       = openCEs.reduce((s, c) => s + (c.value_claimed || 0), 0);

    // ── RFIs ──────────────────────────────────────────────────────────────────
    const openRfis         = rfis.filter(r => r.status !== "Closed");
    const overdueRfis      = openRfis.filter(r => r.date_due && new Date(r.date_due + "T00:00:00") < today);

    // ── EWNs ──────────────────────────────────────────────────────────────────
    const openEwns         = ewns.filter(e => e.status !== "Closed");
    const ewnExposure      = openEwns.reduce((s, e) => s + (e.potential_cost_impact || 0), 0);

    // ── Proposals: expiring / recently accepted / viewed ─────────────────────
    const recentlyAccepted = projects.filter(p =>
        p.proposal_accepted_at && (Date.now() - new Date(p.proposal_accepted_at).getTime()) < 7 * 86400000
    );
    const recentlyViewed = projects.filter(p =>
        p.proposal_status === "viewed" && (Date.now() - new Date(p.updated_at).getTime()) < 48 * 3600000
    );
    const expiringSoon = projects.filter(p => {
        if (!p.proposal_sent_at || p.proposal_accepted_at || p.proposal_status === "declined") return false;
        if (!["sent","viewed"].includes(p.proposal_status)) return false;
        const sentDays = Math.floor((Date.now() - new Date(p.proposal_sent_at).getTime()) / 86400000);
        const remaining = (p.validity_days || 30) - sentDays;
        return remaining >= 0 && remaining <= 5;
    });

    // ── Per-active-project data ───────────────────────────────────────────────
    const activeProjectsWithData = activeProjects.map(p => {
        const projInvoices    = invoices.filter(i => i.project_id === p.id && !i.is_retention_release);
        const projOutstanding = projInvoices.filter(i => i.status === "Sent").reduce((s, i) => s + (i.net_due ?? i.amount ?? 0), 0);
        const projOverdue     = projInvoices.filter(i => i.status === "Sent" && i.due_date && new Date(i.due_date + "T00:00:00") < today).length;
        const projPendingVars = variations.filter(v => v.project_id === p.id && v.status === "Pending Approval").length;
        const projOpenRfis    = rfis.filter(r => r.project_id === p.id && r.status !== "Closed").length;
        const projOpenCEs     = changeEvents.filter(c => c.project_id === p.id && !["Agreed","Rejected","Withdrawn"].includes(c.status)).length;
        const progDelay       = getProjectProgrammeDelay(p);

        // Contract value from active estimate
        const est = estimates.find(e => e.project_id === p.id);
        let contractValue = p.potential_value ?? 0;
        if (est) {
            const base = est.total_cost || 0;
            const overhead = base * ((est.overhead_pct || 0) / 100);
            const risk     = (base + overhead) * 0.05;
            const profit   = (base + overhead + risk) * ((est.profit_pct || 0) / 100);
            const gross    = base + overhead + risk + profit;
            contractValue  = Math.round((gross - gross * ((est.discount_pct || 0) / 100)) * 100) / 100 || contractValue;
        }

        return { ...p, projOutstanding, projOverdue, projPendingVars, projOpenRfis, projOpenCEs, progDelay, contractValue };
    });

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto space-y-5">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {profile?.company_name ?? "Dashboard"}
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                    </div>
                    <Link href="/dashboard/projects/new"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                        <Plus className="w-4 h-4" />
                        New Project
                    </Link>
                </div>

                {/* ── Alert banners ── */}
                {recentlyAccepted.length > 0 && (
                    <AlertBanner colour="green" icon={CheckCircle2} title={`${recentlyAccepted.length === 1 ? "Proposal accepted!" : `${recentlyAccepted.length} proposals accepted this week`}`}>
                        {recentlyAccepted.map(p => (
                            <Link key={p.id} href={`/dashboard/projects/overview?projectId=${p.id}`} className="flex items-center gap-1.5 hover:opacity-100 opacity-90">
                                <ArrowRight className="w-3 h-3" /> {p.name}{p.potential_value > 0 ? ` · ${fmt(p.potential_value)}` : ""} — set up billing & programme
                            </Link>
                        ))}
                    </AlertBanner>
                )}

                {overdueInvoices.length > 0 && (
                    <AlertBanner colour="red" icon={AlertCircle} title={`${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} — ${fmt(totalOverdue)} outstanding`}>
                        {overdueInvoices.slice(0, 3).map(i => {
                            const proj = projects.find(p => p.id === i.project_id);
                            const days = Math.round((today.getTime() - new Date(i.due_date + "T00:00:00").getTime()) / 86400000);
                            return (
                                <Link key={i.id} href={`/dashboard/projects/billing?projectId=${i.project_id}`} className="flex items-center gap-1.5 hover:opacity-100 opacity-90">
                                    <ArrowRight className="w-3 h-3" /> {proj?.name ?? "Unknown"} · {fmt(i.net_due ?? i.amount ?? 0)} · {days}d overdue
                                </Link>
                            );
                        })}
                    </AlertBanner>
                )}

                {overdueRfis.length > 0 && (
                    <AlertBanner colour="amber" icon={MessageSquare} title={`${overdueRfis.length} overdue RFI${overdueRfis.length > 1 ? "s" : ""} awaiting response`}>
                        {overdueRfis.slice(0, 3).map(r => {
                            const proj = projects.find(p => p.id === r.project_id);
                            return (
                                <Link key={r.id} href={`/dashboard/projects/communications?projectId=${r.project_id}`} className="flex items-center gap-1.5 hover:opacity-100 opacity-90">
                                    <ArrowRight className="w-3 h-3" /> {r.reference} · {proj?.name ?? ""} — due {fmtDate(r.date_due)}
                                </Link>
                            );
                        })}
                    </AlertBanner>
                )}

                {recentlyViewed.length > 0 && (
                    <AlertBanner colour="blue" icon={AlertCircle} title={`${recentlyViewed.length === 1 ? "A client has viewed your proposal" : `${recentlyViewed.length} proposals viewed recently`} — follow up now`}>
                        {recentlyViewed.map(p => (
                            <Link key={p.id} href={`/dashboard/projects/proposal?projectId=${p.id}`} className="flex items-center gap-1.5 hover:opacity-100 opacity-90">
                                <ArrowRight className="w-3 h-3" /> {p.name} — {p.client_name}
                            </Link>
                        ))}
                    </AlertBanner>
                )}

                {expiringSoon.length > 0 && (
                    <AlertBanner colour="amber" icon={AlertTriangle} title={`${expiringSoon.length} proposal${expiringSoon.length > 1 ? "s" : ""} expiring soon`}>
                        {expiringSoon.map(p => {
                            const sentDays = Math.floor((Date.now() - new Date(p.proposal_sent_at).getTime()) / 86400000);
                            const remaining = (p.validity_days || 30) - sentDays;
                            return (
                                <Link key={p.id} href={`/dashboard/projects/proposal?projectId=${p.id}`} className="flex items-center gap-1.5 hover:opacity-100 opacity-90">
                                    <ArrowRight className="w-3 h-3" /> {p.name} — {remaining === 0 ? "expires today" : `${remaining}d remaining`}
                                </Link>
                            );
                        })}
                    </AlertBanner>
                )}

                {/* ── KPI strip row 1: financial ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard label="Pipeline Value"    value={fmt(pipelineValue)}   sub={`${pipelineProjects.length} active proposals`} colour="text-blue-400"    icon={TrendingUp}  href="/dashboard" />
                    <KpiCard label="Active Projects"   value={String(activeProjects.length)} sub={activeProjects.length === 0 ? "none on site" : "on site"} colour="text-emerald-400" icon={HardHat} />
                    <KpiCard label="Certified Outstanding" value={totalOutstanding > 0 ? fmt(totalOutstanding) : "—"} sub={totalOutstanding > 0 ? `${sentInvoices.length} sent invoice${sentInvoices.length !== 1 ? "s" : ""}` : "all invoices paid"} colour={totalOutstanding > 0 ? "text-amber-400" : "text-slate-500"} icon={CreditCard} />
                    <KpiCard label="Retention Held"   value={retOutstanding > 0 ? fmt(retOutstanding) : "—"} sub={retOutstanding > 0 ? "across all projects" : "none outstanding"} colour={retOutstanding > 0 ? "text-orange-400" : "text-slate-500"} icon={Banknote} />
                </div>

                {/* ── KPI strip row 2: project health ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard label="Pending Variations" value={pendingVarValue > 0 ? fmt(pendingVarValue) : String(pendingVars.length)} sub={`${pendingVars.length} awaiting approval`} colour={pendingVars.length > 0 ? "text-violet-400" : "text-slate-500"} icon={GitBranch} />
                    <KpiCard label="CE Exposure"        value={ceExposure > 0 ? fmt(ceExposure) : "—"} sub={`${openCEs.length} open change event${openCEs.length !== 1 ? "s" : ""}`} colour={ceExposure > 0 ? "text-red-400" : "text-slate-500"} icon={ShieldAlert} />
                    <KpiCard label="Open RFIs"          value={String(openRfis.length)} sub={overdueRfis.length > 0 ? `${overdueRfis.length} overdue` : "none overdue"} colour={overdueRfis.length > 0 ? "text-red-400" : openRfis.length > 0 ? "text-amber-400" : "text-slate-500"} icon={MessageSquare} />
                    <KpiCard label="Win Rate (90d)"     value={winRate !== null ? `${winRate}%` : "—"} sub={decided.length > 0 ? `${won} of ${decided.length} decided` : "no data yet"} colour={winRate !== null && winRate >= 50 ? "text-purple-400" : "text-slate-500"} icon={CheckCircle2} />
                </div>

                {/* ── Main content: active projects + right panel ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Active projects table */}
                    <div className="lg:col-span-2 space-y-4">

                        {/* Active projects */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <HardHat className="w-4 h-4 text-emerald-400" />
                                    <h2 className="text-sm font-semibold text-white">Active Projects</h2>
                                </div>
                                <span className="text-xs text-slate-500">{activeProjects.length} on site</span>
                            </div>

                            {activeProjectsWithData.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <p className="text-slate-500 text-sm">No active projects yet.</p>
                                    <Link href="/dashboard" className="text-xs text-blue-400 hover:underline mt-1 inline-block">View pipeline →</Link>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-700/30">
                                    {activeProjectsWithData.map(p => (
                                        <div key={p.id} className="px-5 py-4 hover:bg-slate-700/10 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Link href={`/dashboard/projects/overview?projectId=${p.id}`}
                                                            className="text-sm font-semibold text-white hover:text-blue-300 transition-colors truncate">
                                                            {p.name}
                                                        </Link>
                                                        <StatusBadge status={p.status} />
                                                        {p.progDelay > 0 && (
                                                            <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                                                +{p.progDelay}d delay
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">{p.client_name}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    {p.projOutstanding > 0 ? (
                                                        <>
                                                            <p className="text-sm font-semibold text-amber-400">{fmt(p.projOutstanding)}</p>
                                                            <p className="text-[11px] text-slate-500">outstanding</p>
                                                        </>
                                                    ) : (
                                                        <p className="text-xs text-slate-600">—</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Per-project alert chips */}
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                {p.projOverdue > 0 && (
                                                    <Link href={`/dashboard/projects/billing?projectId=${p.id}`}
                                                        className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-colors">
                                                        <AlertCircle className="w-2.5 h-2.5" /> {p.projOverdue} overdue
                                                    </Link>
                                                )}
                                                {p.projPendingVars > 0 && (
                                                    <Link href={`/dashboard/projects/variations?projectId=${p.id}`}
                                                        className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full hover:bg-violet-500/20 transition-colors">
                                                        <GitBranch className="w-2.5 h-2.5" /> {p.projPendingVars} variation{p.projPendingVars > 1 ? "s" : ""}
                                                    </Link>
                                                )}
                                                {p.projOpenRfis > 0 && (
                                                    <Link href={`/dashboard/projects/communications?projectId=${p.id}`}
                                                        className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full hover:bg-amber-500/20 transition-colors">
                                                        <MessageSquare className="w-2.5 h-2.5" /> {p.projOpenRfis} RFI{p.projOpenRfis > 1 ? "s" : ""}
                                                    </Link>
                                                )}
                                                {p.projOpenCEs > 0 && (
                                                    <Link href={`/dashboard/projects/change-management?projectId=${p.id}`}
                                                        className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-colors">
                                                        <ShieldAlert className="w-2.5 h-2.5" /> {p.projOpenCEs} CE{p.projOpenCEs > 1 ? "s" : ""}
                                                    </Link>
                                                )}
                                                {/* Quick links */}
                                                <div className="ml-auto flex items-center gap-1">
                                                    {[
                                                        { icon: Activity,  href: `/dashboard/projects/overview?projectId=${p.id}`,     title: "Overview" },
                                                        { icon: CreditCard,href: `/dashboard/projects/billing?projectId=${p.id}`,      title: "Billing" },
                                                        { icon: CalendarDays, href: `/dashboard/projects/programme?projectId=${p.id}`, title: "Programme" },
                                                    ].map(({ icon: Icon, href, title }) => (
                                                        <Link key={title} href={href} title={title}
                                                            className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
                                                            <Icon className="w-3.5 h-3.5" />
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pipeline summary */}
                        {pipelineProjects.length > 0 && (
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-400" />
                                        <h2 className="text-sm font-semibold text-white">Pipeline</h2>
                                    </div>
                                    <Link href="/dashboard" className="text-xs text-blue-400 hover:underline">View all →</Link>
                                </div>
                                <div className="divide-y divide-slate-700/30">
                                    {pipelineProjects.slice(0, 5).map(p => (
                                        <Link key={p.id} href={`/dashboard/projects/proposal?projectId=${p.id}`}
                                            className="flex items-center justify-between px-5 py-3 hover:bg-slate-700/10 transition-colors group">
                                            <div>
                                                <p className="text-sm font-medium text-slate-200 group-hover:text-white">{p.name}</p>
                                                <p className="text-xs text-slate-500">{p.client_name} · {timeAgo(p.updated_at)}</p>
                                            </div>
                                            <div className="text-right">
                                                {p.potential_value > 0 && <p className="text-sm font-semibold text-blue-400">{fmt(p.potential_value)}</p>}
                                                <StatusBadge status={p.proposal_status ?? p.status} />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right panel */}
                    <div className="space-y-4">

                        {/* Financial snapshot */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Banknote className="w-4 h-4 text-amber-400" />
                                Financial Snapshot
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { label: "Total certified outstanding", value: fmt(totalOutstanding), colour: totalOutstanding > 0 ? "text-amber-400" : "text-slate-500", href: undefined },
                                    { label: "Overdue invoices", value: totalOverdue > 0 ? fmt(totalOverdue) : "—", colour: totalOverdue > 0 ? "text-red-400" : "text-slate-500", href: undefined },
                                    { label: "Retention held", value: retOutstanding > 0 ? fmt(retOutstanding) : "—", colour: retOutstanding > 0 ? "text-orange-400" : "text-slate-500", href: undefined },
                                    { label: "CE exposure (claimed)", value: ceExposure > 0 ? fmt(ceExposure) : "—", colour: ceExposure > 0 ? "text-red-400" : "text-slate-500", href: undefined },
                                    { label: "EWN exposure", value: ewnExposure > 0 ? fmt(ewnExposure) : "—", colour: ewnExposure > 0 ? "text-amber-400" : "text-slate-500", href: undefined },
                                ].map(({ label, value, colour }) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">{label}</span>
                                        <span className={`text-sm font-semibold ${colour}`}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
                            <div className="space-y-1.5">
                                {[
                                    { label: "New Project",        href: "/dashboard/projects/new",      icon: Plus,         colour: "text-blue-400" },
                                    { label: "View Pipeline",      href: "/dashboard",                    icon: TrendingUp,   colour: "text-blue-400" },
                                    { label: "Billing & Invoices", href: "/dashboard/projects/billing",  icon: CreditCard,   colour: "text-amber-400" },
                                    { label: "Variations",         href: "/dashboard/projects/variations",icon: GitBranch,   colour: "text-violet-400" },
                                    { label: "Change Management",  href: "/dashboard/projects/change-management", icon: RefreshCw, colour: "text-red-400" },
                                    { label: "Communications",     href: "/dashboard/projects/communications", icon: MessageSquare, colour: "text-cyan-400" },
                                    { label: "Final Accounts",     href: "/dashboard/projects/final-account", icon: FileText, colour: "text-slate-400" },
                                ].map(({ label, href, icon: Icon, colour }) => (
                                    <Link key={label} href={href}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors group">
                                        <Icon className={`w-3.5 h-3.5 ${colour} group-hover:scale-110 transition-transform`} />
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Closed projects summary */}
                        {closedProjects.length > 0 && (
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-500" />
                                    Closed Projects
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Completed</span>
                                        <span className="text-slate-300 font-semibold">{closedProjects.filter(p => p.status === "completed").length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Total delivered</span>
                                        <span className="text-slate-300 font-semibold">{fmt(closedProjects.reduce((s, p) => s + (p.potential_value || 0), 0))}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
