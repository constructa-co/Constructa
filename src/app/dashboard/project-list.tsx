"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

type SortKey = "name" | "client_name" | "project_type" | "status" | "value" | "proposal_sent_at" | "days_open";
type SortDir = "asc" | "desc";

function getStatusBadgeClass(status: string | null, isDark: boolean): string {
    if (isDark) {
        switch (status) {
            case "Lead":
                return "bg-white/5 text-[#a0a0a0] border-[#2a2a2a]";
            case "Estimating":
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "Proposal Sent":
                return "bg-purple-500/10 text-purple-400 border-purple-500/20";
            case "Active":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "Won":
                return "bg-green-500/10 text-green-400 border-green-500/20";
            case "Completed":
                return "bg-white/5 text-[#a0a0a0] border-[#2a2a2a]";
            case "Lost":
                return "bg-red-500/10 text-red-400 border-red-500/20";
            default:
                return "bg-white/5 text-[#a0a0a0] border-[#2a2a2a]";
        }
    }
    switch (status) {
        case "Lead":
            return "bg-slate-50 text-slate-500 border-slate-200";
        case "Estimating":
            return "bg-blue-50 text-blue-600 border-blue-200";
        case "Proposal Sent":
            return "bg-purple-50 text-purple-600 border-purple-200";
        case "Active":
            return "bg-emerald-50 text-emerald-600 border-emerald-200";
        case "Won":
            return "bg-green-50 text-green-600 border-green-200";
        case "Completed":
            return "bg-zinc-50 text-zinc-600 border-zinc-200";
        case "Lost":
            return "bg-red-50 text-red-600 border-red-200";
        default:
            return "bg-slate-50 text-slate-500 border-slate-200";
    }
}

function getDaysOpen(createdAt: string | null): number {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface SortHeaderProps {
    label: string;
    sortKey: SortKey;
    currentSort: SortKey;
    currentDir: SortDir;
    onSort: (key: SortKey) => void;
    align?: "left" | "right";
    isDark: boolean;
}

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, align = "left", isDark }: SortHeaderProps) {
    const isActive = currentSort === sortKey;
    return (
        <th
            className={`px-4 py-3 font-medium cursor-pointer select-none transition-colors ${
                align === "right" ? "text-right" : "text-left"
            } ${isDark ? "hover:bg-[#1a1a1a]" : "hover:bg-gray-100"}`}
            onClick={() => onSort(sortKey)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {isActive ? (
                    currentDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
            </span>
        </th>
    );
}

export default function ProjectList({ projects, financials }: { projects: any[], financials: any }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const getValue = (p: any): number => p.potential_value || financials[p.id] || 0;

    const sorted = [...projects].sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";

        switch (sortKey) {
            case "name":
                aVal = (a.name || "").toLowerCase();
                bVal = (b.name || "").toLowerCase();
                break;
            case "client_name":
                aVal = (a.client_name || "").toLowerCase();
                bVal = (b.client_name || "").toLowerCase();
                break;
            case "project_type":
                aVal = (a.project_type || "").toLowerCase();
                bVal = (b.project_type || "").toLowerCase();
                break;
            case "status":
                aVal = (a.status || "Lead").toLowerCase();
                bVal = (b.status || "Lead").toLowerCase();
                break;
            case "value":
                aVal = getValue(a);
                bVal = getValue(b);
                break;
            case "proposal_sent_at":
                aVal = a.proposal_sent_at ? new Date(a.proposal_sent_at).getTime() : 0;
                bVal = b.proposal_sent_at ? new Date(b.proposal_sent_at).getTime() : 0;
                break;
            case "days_open":
                aVal = getDaysOpen(a.created_at);
                bVal = getDaysOpen(b.created_at);
                break;
        }

        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
    });

    return (
        <div className={`rounded-xl border overflow-hidden ${
            isDark
                ? "bg-[#1a1a1a] border-[#2a2a2a]"
                : "bg-white border-gray-200 shadow-sm"
        }`}>
            <table className="w-full text-sm text-left">
                <thead className={`border-b uppercase text-xs ${
                    isDark
                        ? "bg-[#0d0d0d] text-[#a0a0a0] border-[#2a2a2a]"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                }`}>
                    <tr>
                        <SortHeader label="Project Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} isDark={isDark} />
                        <SortHeader label="Client" sortKey="client_name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} isDark={isDark} />
                        <SortHeader label="Type" sortKey="project_type" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} isDark={isDark} />
                        <SortHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} isDark={isDark} />
                        <SortHeader label="Value" sortKey="value" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" isDark={isDark} />
                        <SortHeader label="Sent Date" sortKey="proposal_sent_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} isDark={isDark} />
                        <SortHeader label="Days Open" sortKey="days_open" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" isDark={isDark} />
                        <th className={`px-4 py-3 font-medium text-right ${isDark ? "text-[#a0a0a0]" : ""}`}>Actions</th>
                    </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-[#2a2a2a]" : "divide-gray-100"}`}>
                    {sorted.map((p) => {
                        const value = getValue(p);
                        const days = getDaysOpen(p.created_at);
                        return (
                            <tr
                                key={p.id}
                                className={`group transition-colors cursor-pointer ${
                                    isDark ? "hover:bg-[#0d0d0d]" : "hover:bg-gray-50"
                                }`}
                                onClick={() => {
                                    window.location.href = `/dashboard/projects/proposal?projectId=${p.id}`;
                                }}
                            >
                                <td className={`px-4 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                    {p.name}
                                </td>
                                <td className={`px-4 py-3 ${isDark ? "text-[#a0a0a0]" : "text-gray-600"}`}>{p.client_name || "\u2014"}</td>
                                <td className={`px-4 py-3 text-xs ${isDark ? "text-[#a0a0a0]" : "text-gray-500"}`}>{p.project_type || "\u2014"}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusBadgeClass(p.status, isDark)}`}>
                                        {p.status || "Lead"}
                                    </span>
                                </td>
                                <td className={`px-4 py-3 text-right font-mono text-xs ${isDark ? "text-[#a0a0a0]" : "text-gray-700"}`}>
                                    {value ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "\u2014"}
                                </td>
                                <td className={`px-4 py-3 text-xs ${isDark ? "text-[#a0a0a0]" : "text-gray-500"}`}>
                                    {formatDate(p.proposal_sent_at)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className={`text-xs font-semibold ${days > 30 ? "text-amber-500" : isDark ? "text-[#a0a0a0]" : "text-gray-400"}`}>
                                        {days}d
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                    <Link
                                        href={`/dashboard/projects/proposal?projectId=${p.id}`}
                                        className="text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                        Proposal →
                                    </Link>
                                </td>
                            </tr>
                        );
                    })}
                    {sorted.length === 0 && (
                        <tr>
                            <td colSpan={8} className={`p-8 text-center text-sm ${isDark ? "text-[#a0a0a0]" : "text-gray-400"}`}>
                                No projects match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
