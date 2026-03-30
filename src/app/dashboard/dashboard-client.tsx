"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
    Briefcase,
    Send,
    Trophy,
    Hammer,
    TrendingUp,
    PoundSterling,
    Search,
    LayoutGrid,
    List,
    Users,
    BarChart3,
} from "lucide-react";
import ProjectBoard from "./project-board";
import ProjectList from "./project-list";

type Period = "week" | "month" | "quarter" | "year";

interface Metrics {
    totalPipelineValue: number;
    proposalsSent: number;
    wonThisMonth: number;
    activeJobs: number;
    winRate: number;
    totalRevenueSigned: number;
}

interface Props {
    projects: any[];
    financials: Record<string, number>;
    metrics: Metrics;
    companyName: string;
}

function formatCurrency(value: number): string {
    if (value >= 1_000_000) {
        return `£${(value / 1_000_000).toFixed(1)}m`;
    }
    if (value >= 1_000) {
        return `£${(value / 1_000).toFixed(0)}k`;
    }
    return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

function getPeriodRange(period: Period): { start: Date; end: Date; label: string } {
    const now = new Date();
    let start: Date;
    let end: Date;
    let label: string;

    switch (period) {
        case "week": {
            const dayOfWeek = now.getDay(); // 0 = Sunday
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
            end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
            label = "This Week";
            break;
        }
        case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            label = "This Month";
            break;
        case "quarter": {
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
            end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
            label = "This Quarter";
            break;
        }
        case "year":
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            label = "This Year";
            break;
    }

    return { start, end, label };
}

function calculateMetrics(projects: any[], financials: Record<string, number>, period: Period): Metrics {
    const { start, end } = getPeriodRange(period);

    const inPeriod = (dateStr: string | null | undefined) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= start && d <= end;
    };

    const totalPipelineValue = projects
        .filter(p => p.status !== "Lost" && p.status !== "Completed")
        .filter(p => inPeriod(p.created_at))
        .reduce((sum, p) => sum + (p.potential_value || financials[p.id] || 0), 0);

    const proposalsSent = projects.filter(p => inPeriod(p.proposal_sent_at)).length;

    const wonInPeriod = projects.filter(p => inPeriod(p.proposal_accepted_at));
    const wonThisMonth = wonInPeriod.length;

    const activeJobs = projects.filter(p => p.status === "Active" || p.status === "Won").length;

    const accepted = projects.filter(p => p.proposal_accepted_at != null).length;
    const allProposalsSent = projects.filter(p => p.proposal_sent_at != null).length;
    const winRate = allProposalsSent > 0 ? Math.round((accepted / allProposalsSent) * 100) : 0;

    const totalRevenueSigned = wonInPeriod
        .reduce((sum, p) => sum + (p.potential_value || financials[p.id] || 0), 0);

    return {
        totalPipelineValue,
        proposalsSent,
        wonThisMonth,
        activeJobs,
        winRate,
        totalRevenueSigned,
    };
}

const STATUS_OPTIONS = ["Lead", "Estimating", "Proposal Sent", "Active", "Won", "Completed", "Lost"];

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
];

export default function DashboardClient({ projects, financials, metrics: serverMetrics, companyName }: Props) {
    const [view, setView] = useState<"board" | "list">("board");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [period, setPeriod] = useState<Period>("month");

    // Unique project types from data
    const projectTypes = useMemo(() => {
        const types = Array.from(new Set(projects.map(p => p.project_type).filter(Boolean)));
        return types.sort();
    }, [projects]);

    // Filtered projects for pipeline board (all projects regardless of period)
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const searchLower = search.toLowerCase();
            const matchesSearch =
                !search ||
                (p.name || "").toLowerCase().includes(searchLower) ||
                (p.client_name || "").toLowerCase().includes(searchLower);
            const matchesType = typeFilter === "all" || p.project_type === typeFilter;
            const matchesStatus = statusFilter === "all" || (p.status || "Lead") === statusFilter;
            return matchesSearch && matchesType && matchesStatus;
        });
    }, [projects, search, typeFilter, statusFilter]);

    // KPI metrics calculated based on the selected period
    const metrics = useMemo(() => calculateMetrics(projects, financials, period), [projects, financials, period]);

    const periodLabel = getPeriodRange(period).label;

    const kpiCards = [
        {
            icon: Briefcase,
            label: "Pipeline Value",
            value: formatCurrency(metrics.totalPipelineValue),
            subtitle: "Open opportunities",
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-100",
        },
        {
            icon: Send,
            label: "Proposals Sent",
            value: metrics.proposalsSent.toString(),
            subtitle: "Awaiting client decision",
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            borderColor: "border-purple-100",
        },
        {
            icon: Trophy,
            label: "Projects Won",
            value: metrics.wonThisMonth.toString(),
            subtitle: "Accepted proposals",
            color: "text-green-600",
            bgColor: "bg-green-50",
            borderColor: "border-green-100",
        },
        {
            icon: Hammer,
            label: "Active Jobs",
            value: metrics.activeJobs.toString(),
            subtitle: "Currently on site",
            color: "text-amber-600",
            bgColor: "bg-amber-50",
            borderColor: "border-amber-100",
        },
        {
            icon: TrendingUp,
            label: "Win Rate",
            value: `${metrics.winRate}%`,
            subtitle: "Proposals accepted",
            color: "text-teal-600",
            bgColor: "bg-teal-50",
            borderColor: "border-teal-100",
        },
        {
            icon: PoundSterling,
            label: "Revenue Signed",
            value: formatCurrency(metrics.totalRevenueSigned),
            subtitle: "Contracted value",
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
            borderColor: "border-emerald-100",
        },
    ];

    return (
        <div className="pt-8 px-8 pb-12 space-y-8">

            {/* SECTION A — Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {getGreeting()}, {companyName}
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Here&apos;s your pipeline overview for today</p>
                </div>
                <Link
                    href="/dashboard/projects/new"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-colors"
                >
                    + New Project
                </Link>
            </div>

            {/* SECTION B — KPI Strip with period selector */}
            <div className="space-y-3">
                {/* Period selector header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-600">
                        Performance — <span className="text-slate-900">{periodLabel}</span>
                    </h2>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriod(opt.value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                    period === opt.value
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                    {kpiCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.label}
                                className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow`}
                            >
                                <div className={`w-9 h-9 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${card.color}`} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 leading-none">
                                        {card.value}
                                    </div>
                                    <div className="text-xs font-semibold text-slate-600 mt-1">
                                        {card.label}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                        {card.subtitle}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECTION C — Search & Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by client or project name..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Project Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Types</option>
                        {projectTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Stages</option>
                        {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setView("board")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                view === "board"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Board
                        </button>
                        <button
                            onClick={() => setView("list")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                view === "list"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            <List className="w-3.5 h-3.5" />
                            List
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION D — Pipeline Board or List */}
            <div className="overflow-x-auto pb-2">
                {view === "board" ? (
                    <ProjectBoard projects={filteredProjects} financials={financials} />
                ) : (
                    <ProjectList projects={filteredProjects} financials={financials} />
                )}
            </div>

            {/* SECTION E — Bottom Placeholder Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resource Management */}
                <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <Users className="w-6 h-6 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-400">Resource Management</h3>
                        <p className="text-sm text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                            Labour allocation, plant scheduling and subcontractor management — coming in a future update.
                        </p>
                    </div>
                    <button
                        disabled
                        className="text-xs font-medium text-slate-400 border border-slate-200 rounded-lg px-4 py-2 cursor-not-allowed opacity-50"
                    >
                        Notify me
                    </button>
                </div>

                {/* Financial Dashboard */}
                <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-400">Financial Dashboard</h3>
                        <p className="text-sm text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                            P&amp;L by project, cash flow, margin analysis and management accounts — coming in a future update.
                        </p>
                    </div>
                    <button
                        disabled
                        className="text-xs font-medium text-slate-400 border border-slate-200 rounded-lg px-4 py-2 cursor-not-allowed opacity-50"
                    >
                        Notify me
                    </button>
                </div>
            </div>
        </div>
    );
}
