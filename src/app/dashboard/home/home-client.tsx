"use client";

import Link from "next/link";
import {
    TrendingUp,
    HardHat,
    Archive,
    Plus,
    ArrowRight,
    Clock,
    CheckCircle,
    AlertCircle,
    LayoutDashboard,
    Calculator,
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
}

interface HomeClientProps {
    projects: Project[];
    estimates: any[];
    invoices: any[];
    profile: { company_name: string } | null;
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
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
    });
}

export default function HomeClient({
    projects,
    estimates,
    invoices,
    profile,
}: HomeClientProps) {
    const allProjects = projects || [];

    // Pipeline = all non-accepted proposals
    const pipelineProjects = allProjects.filter(
        (p) => p.proposal_status !== "accepted" && p.status !== "closed"
    );
    const pipelineValue = pipelineProjects.reduce(
        (s, p) => s + (p.potential_value || 0),
        0
    );

    // Active projects = accepted proposals
    const activeProjects = allProjects.filter(
        (p) => p.proposal_accepted_at || p.status === "active"
    );

    // Pre-construction = has a proposal being drafted
    const preConProjects = allProjects.filter(
        (p) =>
            !p.proposal_accepted_at &&
            p.status !== "closed" &&
            p.status !== "won"
    );

    // Closed projects
    const closedProjects = allProjects.filter(
        (p) => p.status === "closed" || p.status === "completed"
    );

    // Win rate (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentSent = allProjects.filter(
        (p) =>
            new Date(p.created_at) > cutoff &&
            (p.proposal_status === "accepted" ||
                p.proposal_status === "sent" ||
                p.proposal_status === "declined")
    );
    const won = recentSent.filter(
        (p) => p.proposal_status === "accepted"
    ).length;
    const winRate =
        recentSent.length > 0
            ? Math.round((won / recentSent.length) * 100)
            : 0;

    // Outstanding invoices
    const outstandingInvoices = invoices || [];
    const outstandingValue = outstandingInvoices.reduce(
        (s: number, i: any) => s + (i.amount || 0),
        0
    );

    // Recent activity (last 6 updated projects)
    const recentActivity = [...allProjects]
        .sort(
            (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime()
        )
        .slice(0, 6);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {profile?.company_name || "Your Business"}
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        Business overview
                    </p>
                </div>
                <Link
                    href="/dashboard/projects/new"
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
                >
                    <Plus className="w-4 h-4" />
                    New Project
                </Link>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    {
                        label: "Pipeline Value",
                        value: fmt(pipelineValue),
                        sub: `${pipelineProjects.length} proposals`,
                        color: "text-blue-600",
                        icon: TrendingUp,
                    },
                    {
                        label: "Active Projects",
                        value: activeProjects.length.toString(),
                        sub: "on site / in progress",
                        color: "text-green-600",
                        icon: HardHat,
                    },
                    {
                        label: "Outstanding Invoices",
                        value:
                            outstandingValue > 0
                                ? fmt(outstandingValue)
                                : "£0",
                        sub: `${outstandingInvoices.length} invoices`,
                        color:
                            outstandingValue > 0
                                ? "text-amber-600"
                                : "text-gray-400",
                        icon: AlertCircle,
                    },
                    {
                        label: "Win Rate (90d)",
                        value: `${winRate}%`,
                        sub: `${won} of ${recentSent.length} proposals`,
                        color: "text-purple-600",
                        icon: CheckCircle,
                    },
                ].map(({ label, value, sub, color, icon: Icon }) => (
                    <div
                        key={label}
                        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {label}
                            </span>
                            <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className={`text-2xl font-bold ${color}`}>
                            {value}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{sub}</div>
                    </div>
                ))}
            </div>

            {/* Section Cards + Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Section cards — left 2 cols */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Work Winning */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                <LayoutDashboard className="w-4 h-4 text-blue-600" />
                            </div>
                            <h2 className="font-semibold text-gray-900">
                                Work Winning
                            </h2>
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Active proposals
                                </span>
                                <span className="font-medium">
                                    {pipelineProjects.length}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Pipeline value
                                </span>
                                <span className="font-medium text-blue-600">
                                    {fmt(pipelineValue)}
                                </span>
                            </div>
                        </div>
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                        >
                            View pipeline{" "}
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>

                    {/* Pre-Construction */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                <Calculator className="w-4 h-4 text-purple-600" />
                            </div>
                            <h2 className="font-semibold text-gray-900">
                                Pre-Construction
                            </h2>
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    In progress
                                </span>
                                <span className="font-medium">
                                    {preConProjects.length}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Stages</span>
                                <span className="font-medium text-gray-400 text-xs">
                                    Brief · Estimate · Programme · Contracts ·
                                    Proposal
                                </span>
                            </div>
                        </div>
                        {preConProjects[0] && (
                            <Link
                                href={`/dashboard/projects/brief?projectId=${preConProjects[0].id}`}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:underline font-medium"
                            >
                                Continue: {preConProjects[0].name}{" "}
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        )}
                    </div>

                    {/* Live Projects */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                <HardHat className="w-4 h-4 text-green-600" />
                            </div>
                            <h2 className="font-semibold text-gray-900">
                                Live Projects
                            </h2>
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">On site</span>
                                <span className="font-medium">
                                    {activeProjects.length}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Modules</span>
                                <span className="font-medium text-gray-400 text-xs">
                                    Billing · Variations · Costs
                                </span>
                            </div>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" /> Billing &amp;
                            variations coming soon
                        </span>
                    </div>

                    {/* Closed Projects */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                                <Archive className="w-4 h-4 text-gray-500" />
                            </div>
                            <h2 className="font-semibold text-gray-900">
                                Closed Projects
                            </h2>
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Completed
                                </span>
                                <span className="font-medium">
                                    {closedProjects.length}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Total delivered
                                </span>
                                <span className="font-medium">
                                    {fmt(
                                        closedProjects.reduce(
                                            (s, p) =>
                                                s + (p.potential_value || 0),
                                            0
                                        )
                                    )}
                                </span>
                            </div>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" /> Archive &amp; records
                            coming soon
                        </span>
                    </div>
                </div>

                {/* Activity feed — right col */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        Recent Activity
                    </h2>
                    <div className="space-y-3">
                        {recentActivity.length === 0 ? (
                            <p className="text-sm text-gray-400">
                                No projects yet.{" "}
                                <Link
                                    href="/dashboard/projects/new"
                                    className="text-blue-600 hover:underline"
                                >
                                    Create your first →
                                </Link>
                            </p>
                        ) : (
                            recentActivity.map((p) => (
                                <Link
                                    key={p.id}
                                    href={`/dashboard/projects/brief?projectId=${p.id}`}
                                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition group"
                                >
                                    <div
                                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                            p.proposal_accepted_at
                                                ? "bg-green-500"
                                                : p.proposal_status === "sent"
                                                  ? "bg-blue-500"
                                                  : "bg-gray-300"
                                        }`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                            {p.name}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {p.client_name} ·{" "}
                                            {timeAgo(p.updated_at)}
                                        </div>
                                    </div>
                                    {p.potential_value > 0 && (
                                        <div className="text-xs font-medium text-gray-500 flex-shrink-0">
                                            {fmt(p.potential_value)}
                                        </div>
                                    )}
                                </Link>
                            ))
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <Link
                            href="/dashboard"
                            className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
                        >
                            View full pipeline{" "}
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
