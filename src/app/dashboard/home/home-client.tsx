"use client";

import Link from "next/link";
import {
    TrendingUp,
    HardHat,
    Archive,
    Plus,
    ArrowRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    LayoutDashboard,
    Calculator,
    Building2,
    FileText,
    AlertTriangle,
    CircleDot,
} from "lucide-react";

interface Project {
    id: string;
    name: string;
    client_name: string;
    status: string;
    potential_value: number;
    proposal_status: string;
    proposal_sent_at: string | null;
    proposal_accepted_at: string | null;
    created_at: string;
    updated_at: string;
    validity_days?: number;
}

interface HomeClientProps {
    projects: Project[];
    estimates: any[];
    invoices: any[];
    profile: {
        company_name?: string;
        logo_url?: string;
        capability_statement?: string;
        md_name?: string;
        md_message?: string;
        phone?: string;
        accreditations?: string;
        years_trading?: string;
    } | null;
    userId: string;
}

function fmt(n: number) {
    if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}m`;
    if (n >= 1000) return `£${(n / 1000).toFixed(0)}k`;
    return `£${n.toLocaleString()}`;
}

function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function StatusPill({ status, acceptedAt }: { status: string; acceptedAt: string | null }) {
    if (acceptedAt) return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Accepted</span>
    );
    if (status === "sent") return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Sent</span>
    );
    if (status === "viewed") return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">Viewed</span>
    );
    if (status === "declined") return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Declined</span>
    );
    return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">Draft</span>
    );
}

function ActivityDot({ status, acceptedAt }: { status: string; acceptedAt: string | null }) {
    if (acceptedAt) return <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />;
    if (status === "sent") return <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />;
    if (status === "viewed") return <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />;
    if (status === "declined") return <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />;
    return <div className="w-2 h-2 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />;
}

function profileScore(profile: HomeClientProps["profile"]): { score: number; total: number; missing: string[] } {
    const checks = [
        { label: "Company name", ok: !!(profile?.company_name) },
        { label: "Capability statement", ok: (profile?.capability_statement?.length || 0) >= 30 },
        { label: "Company logo", ok: !!(profile?.logo_url) },
        { label: "MD name", ok: !!(profile?.md_name) },
        { label: "MD message", ok: (profile?.md_message?.length || 0) >= 20 },
        { label: "Phone number", ok: !!(profile?.phone) },
        { label: "Accreditations", ok: !!(profile?.accreditations) },
    ];
    const missing = checks.filter(c => !c.ok).map(c => c.label);
    return { score: checks.filter(c => c.ok).length, total: checks.length, missing };
}

export default function HomeClient({ projects, invoices, profile }: HomeClientProps) {
    const allProjects = projects || [];

    // Pipeline = active proposals (not accepted, not closed)
    const pipelineProjects = allProjects.filter(
        (p) => p.proposal_status !== "accepted" && p.status !== "closed" && p.status !== "completed"
    );
    const pipelineValue = pipelineProjects.reduce((s, p) => s + (p.potential_value || 0), 0);

    // Active = accepted proposals / on-site
    const activeProjects = allProjects.filter(
        (p) => p.proposal_accepted_at || p.status === "active" || p.status === "won"
    );

    // Closed
    const closedProjects = allProjects.filter(
        (p) => p.status === "closed" || p.status === "completed"
    );

    // Pre-construction in progress
    const preConProjects = allProjects.filter(
        (p) => !p.proposal_accepted_at && p.status !== "closed" && p.status !== "completed" && p.status !== "won"
    );

    // Win rate (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentDecided = allProjects.filter(
        (p) =>
            new Date(p.created_at) > cutoff &&
            (p.proposal_status === "accepted" || p.proposal_status === "declined")
    );
    const won = recentDecided.filter((p) => p.proposal_status === "accepted").length;
    const winRate = recentDecided.length > 0 ? Math.round((won / recentDecided.length) * 100) : null;

    // Outstanding invoices
    const outstandingValue = (invoices || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);

    // Proposals expiring soon (sent, not accepted, within 5 days of validity)
    const expiringSoon = allProjects.filter((p) => {
        if (!p.proposal_sent_at || p.proposal_accepted_at || p.proposal_status === "declined") return false;
        if (p.proposal_status !== "sent" && p.proposal_status !== "viewed") return false;
        const sentDays = Math.floor((Date.now() - new Date(p.proposal_sent_at).getTime()) / 86400000);
        const validity = p.validity_days || 30;
        const remaining = validity - sentDays;
        return remaining >= 0 && remaining <= 5;
    });

    // Recent activity feed
    const recentActivity = [...allProjects]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 8);

    // Profile completion
    const { score: profScore, total: profTotal, missing: profMissing } = profileScore(profile);
    const profPct = Math.round((profScore / profTotal) * 100);
    const profileComplete = profScore === profTotal;

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">
                            {profile?.company_name || "Command Centre"}
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">Business overview</p>
                    </div>
                    <Link
                        href="/dashboard/projects/new"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </Link>
                </div>

                {/* Expiring soon alert */}
                {expiringSoon.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-300">
                                {expiringSoon.length === 1
                                    ? "1 proposal expiring soon"
                                    : `${expiringSoon.length} proposals expiring soon`}
                            </p>
                            <div className="mt-1 space-y-0.5">
                                {expiringSoon.map((p) => {
                                    const sentDays = Math.floor((Date.now() - new Date(p.proposal_sent_at!).getTime()) / 86400000);
                                    const remaining = (p.validity_days || 30) - sentDays;
                                    return (
                                        <Link
                                            key={p.id}
                                            href={`/dashboard/projects/proposal?projectId=${p.id}`}
                                            className="flex items-center gap-2 text-xs text-amber-400/80 hover:text-amber-300"
                                        >
                                            <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                            {p.name} — {remaining === 0 ? "expires today" : `${remaining}d remaining`}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* KPI strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        {
                            label: "Pipeline Value",
                            value: fmt(pipelineValue),
                            sub: `${pipelineProjects.length} active proposal${pipelineProjects.length !== 1 ? "s" : ""}`,
                            color: "text-blue-400",
                            bg: "bg-blue-500/10",
                            border: "border-blue-500/20",
                            Icon: TrendingUp,
                        },
                        {
                            label: "Active Projects",
                            value: activeProjects.length.toString(),
                            sub: activeProjects.length === 0 ? "none on site" : "on site / in progress",
                            color: "text-green-400",
                            bg: "bg-green-500/10",
                            border: "border-green-500/20",
                            Icon: HardHat,
                        },
                        {
                            label: "Outstanding",
                            value: outstandingValue > 0 ? fmt(outstandingValue) : "—",
                            sub: outstandingValue > 0 ? `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}` : "no open invoices",
                            color: outstandingValue > 0 ? "text-amber-400" : "text-slate-500",
                            bg: outstandingValue > 0 ? "bg-amber-500/10" : "bg-slate-800/50",
                            border: outstandingValue > 0 ? "border-amber-500/20" : "border-slate-700",
                            Icon: AlertCircle,
                        },
                        {
                            label: "Win Rate (90d)",
                            value: winRate !== null ? `${winRate}%` : "—",
                            sub: recentDecided.length > 0 ? `${won} of ${recentDecided.length} proposals` : "no proposals decided yet",
                            color: winRate !== null && winRate >= 50 ? "text-purple-400" : "text-slate-500",
                            bg: "bg-purple-500/10",
                            border: "border-purple-500/20",
                            Icon: CheckCircle2,
                        },
                    ].map(({ label, value, sub, color, bg, border, Icon }) => (
                        <div key={label} className={`${bg} border ${border} rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                    {label}
                                </span>
                                <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <div className={`text-2xl font-bold ${color}`}>{value}</div>
                            <div className="text-xs text-slate-500 mt-1">{sub}</div>
                        </div>
                    ))}
                </div>

                {/* Main grid: section cards + activity feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Section cards — 2 cols */}
                    <div className="lg:col-span-2 space-y-4">

                        {/* Company Profile card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <h2 className="font-semibold text-slate-100">Company Profile</h2>
                                </div>
                                {profileComplete ? (
                                    <span className="flex items-center gap-1 text-xs font-medium text-green-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                    </span>
                                ) : (
                                    <span className="text-xs text-amber-400 font-medium">{profScore}/{profTotal} complete</span>
                                )}
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4">
                                <div
                                    className={`h-1.5 rounded-full transition-all ${profileComplete ? "bg-green-500" : "bg-blue-500"}`}
                                    style={{ width: `${profPct}%` }}
                                />
                            </div>

                            {!profileComplete && profMissing.length > 0 && (
                                <p className="text-xs text-slate-500 mb-3">
                                    Missing: {profMissing.join(" · ")}
                                </p>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                    <div className="flex justify-between text-xs gap-4">
                                        <span className="text-slate-500">Case Studies</span>
                                        <Link href="/dashboard/settings/case-studies" className="text-blue-400 hover:underline">Manage</Link>
                                    </div>
                                    <div className="flex justify-between text-xs gap-4">
                                        <span className="text-slate-500">PDF Theme</span>
                                        <Link href="/dashboard/settings/profile" className="text-blue-400 hover:underline">Change</Link>
                                    </div>
                                </div>
                                <Link
                                    href="/dashboard/settings/profile"
                                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline font-medium"
                                >
                                    Edit profile <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* 2x2 section cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Work Winning */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                        <LayoutDashboard className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <h2 className="font-semibold text-slate-100">Work Winning</h2>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Pipeline proposals</span>
                                        <span className="font-medium text-slate-200">{pipelineProjects.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Pipeline value</span>
                                        <span className="font-medium text-blue-400">{fmt(pipelineValue)}</span>
                                    </div>
                                    {expiringSoon.length > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-amber-400">Expiring soon</span>
                                            <span className="font-medium text-amber-400">{expiringSoon.length}</span>
                                        </div>
                                    )}
                                </div>
                                <Link href="/dashboard" className="flex items-center gap-1 text-xs text-blue-400 hover:underline font-medium">
                                    View pipeline <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>

                            {/* Pre-Construction */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                                        <Calculator className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <h2 className="font-semibold text-slate-100">Pre-Construction</h2>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">In progress</span>
                                        <span className="font-medium text-slate-200">{preConProjects.length}</span>
                                    </div>
                                    <div className="text-xs text-slate-600 pt-1">
                                        Brief · Estimate · Programme · Contracts · Proposal
                                    </div>
                                </div>
                                {preConProjects[0] ? (
                                    <Link
                                        href={`/dashboard/projects/brief?projectId=${preConProjects[0].id}`}
                                        className="flex items-center gap-1 text-xs text-purple-400 hover:underline font-medium"
                                    >
                                        Continue: {preConProjects[0].name} <ArrowRight className="w-3 h-3" />
                                    </Link>
                                ) : (
                                    <Link href="/dashboard/projects/new" className="flex items-center gap-1 text-xs text-purple-400 hover:underline font-medium">
                                        Start a new project <ArrowRight className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>

                            {/* Live Projects */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                                        <HardHat className="w-4 h-4 text-green-400" />
                                    </div>
                                    <h2 className="font-semibold text-slate-100">Live Projects</h2>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">On site</span>
                                        <span className="font-medium text-slate-200">{activeProjects.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Outstanding</span>
                                        <span className={`font-medium ${outstandingValue > 0 ? "text-amber-400" : "text-slate-500"}`}>
                                            {outstandingValue > 0 ? fmt(outstandingValue) : "—"}
                                        </span>
                                    </div>
                                </div>
                                <span className="flex items-center gap-1 text-xs text-slate-600">
                                    <Clock className="w-3 h-3" /> Billing &amp; variations coming soon
                                </span>
                            </div>

                            {/* Closed Projects */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                                        <Archive className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <h2 className="font-semibold text-slate-100">Closed Projects</h2>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Completed</span>
                                        <span className="font-medium text-slate-200">{closedProjects.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Total delivered</span>
                                        <span className="font-medium text-slate-300">
                                            {fmt(closedProjects.reduce((s, p) => s + (p.potential_value || 0), 0))}
                                        </span>
                                    </div>
                                </div>
                                <span className="flex items-center gap-1 text-xs text-slate-600">
                                    <Clock className="w-3 h-3" /> Archive &amp; final accounts coming soon
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Activity feed */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                        <h2 className="font-semibold text-slate-100 mb-1 flex items-center gap-2">
                            <CircleDot className="w-4 h-4 text-slate-400" />
                            Recent Activity
                        </h2>
                        <p className="text-xs text-slate-500 mb-4">Last updated projects</p>

                        <div className="space-y-1">
                            {recentActivity.length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-sm text-slate-500">No projects yet.</p>
                                    <Link href="/dashboard/projects/new" className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                                        Create your first →
                                    </Link>
                                </div>
                            ) : (
                                recentActivity.map((p) => (
                                    <Link
                                        key={p.id}
                                        href={`/dashboard/projects/proposal?projectId=${p.id}`}
                                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-800/60 transition group"
                                    >
                                        <ActivityDot status={p.proposal_status} acceptedAt={p.proposal_accepted_at} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-slate-200 truncate group-hover:text-white">
                                                    {p.name}
                                                </span>
                                                <StatusPill status={p.proposal_status} acceptedAt={p.proposal_accepted_at} />
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {p.client_name} · {timeAgo(p.updated_at)}
                                                {p.potential_value > 0 && ` · ${fmt(p.potential_value)}`}
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>

                        {allProjects.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                <Link
                                    href="/dashboard"
                                    className="text-xs text-blue-400 hover:underline font-medium flex items-center gap-1"
                                >
                                    View full pipeline <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}
                    </div>

                </div>

                {/* Quick actions footer strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "New Project", href: "/dashboard/projects/new", Icon: Plus, color: "text-blue-400" },
                        { label: "View Pipeline", href: "/dashboard", Icon: LayoutDashboard, color: "text-slate-300" },
                        { label: "Cost Library", href: "/dashboard/library", Icon: Calculator, color: "text-slate-300" },
                        { label: "Edit Profile", href: "/dashboard/settings/profile", Icon: FileText, color: "text-slate-300" },
                    ].map(({ label, href, Icon, color }) => (
                        <Link
                            key={label}
                            href={href}
                            className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/70 rounded-lg px-4 py-3 text-sm font-medium transition-colors group"
                        >
                            <Icon className={`w-4 h-4 ${color} group-hover:text-white transition-colors`} />
                            <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
                        </Link>
                    ))}
                </div>

            </div>
        </div>
    );
}
