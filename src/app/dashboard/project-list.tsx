"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortKey = "name" | "client_name" | "project_type" | "status" | "value" | "proposal_sent_at" | "days_open";
type SortDir = "asc" | "desc";

function getStatusBadgeClass(status: string | null): string {
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
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface SortHeaderProps {
    label: string;
    sortKey: SortKey;
    currentSort: SortKey;
    currentDir: SortDir;
    onSort: (key: SortKey) => void;
    align?: "left" | "right";
}

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, align = "left" }: SortHeaderProps) {
    const isActive = currentSort === sortKey;
    return (
        <th
            className={`px-4 py-3 font-medium cursor-pointer select-none hover:bg-slate-100 transition-colors ${align === "right" ? "text-right" : "text-left"}`}
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-500 uppercase text-xs">
                    <tr>
                        <SortHeader label="Project Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Client" sortKey="client_name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Type" sortKey="project_type" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Value" sortKey="value" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                        <SortHeader label="Sent Date" sortKey="proposal_sent_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Days Open" sortKey="days_open" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {sorted.map((p) => {
                        const value = getValue(p);
                        const days = getDaysOpen(p.created_at);
                        return (
                            <tr
                                key={p.id}
                                className="hover:bg-slate-50 group transition-colors cursor-pointer"
                                onClick={() => {
                                    window.location.href = `/dashboard/projects/proposal?projectId=${p.id}`;
                                }}
                            >
                                <td className="px-4 py-3 font-semibold text-slate-900">
                                    {p.name}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{p.client_name || "—"}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{p.project_type || "—"}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusBadgeClass(p.status)}`}>
                                        {p.status || "Lead"}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-700 text-xs">
                                    {value ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                    {formatDate(p.proposal_sent_at)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className={`text-xs font-semibold ${days > 30 ? "text-amber-500" : "text-slate-400"}`}>
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
                            <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">
                                No projects match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
