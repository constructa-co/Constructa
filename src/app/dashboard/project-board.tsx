"use client";

import Link from "next/link";
import { useTransition } from "react";
import { updateStatusAction, markAsWonAction } from "./board-actions";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    FileText,
    Hammer,
    CheckCircle2,
    Users,
    XCircle,
    Layers,
    Trophy,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";

// Define the columns for our business pipeline
const COLUMNS = [
    { id: "Lead", label: "Leads", icon: Users, color: "bg-slate-50", darkColor: "bg-white/5", text: "text-slate-600", darkText: "text-slate-300", border: "border-slate-200", darkBorder: "border-[#2a2a2a]" },
    { id: "Estimating", label: "Estimating", icon: Clock, color: "bg-blue-50/50", darkColor: "bg-blue-500/10", text: "text-blue-600", darkText: "text-blue-400", border: "border-blue-200", darkBorder: "border-blue-500/20" },
    { id: "Proposal Sent", label: "Proposal Sent", icon: FileText, color: "bg-purple-50/50", darkColor: "bg-purple-500/10", text: "text-purple-600", darkText: "text-purple-400", border: "border-purple-200", darkBorder: "border-purple-500/20" },
    { id: "Active", label: "Active", icon: Hammer, color: "bg-emerald-50/50", darkColor: "bg-emerald-500/10", text: "text-emerald-600", darkText: "text-emerald-400", border: "border-emerald-200", darkBorder: "border-emerald-500/20" },
    { id: "Completed", label: "Completed", icon: CheckCircle2, color: "bg-zinc-50", darkColor: "bg-white/5", text: "text-zinc-600", darkText: "text-zinc-300", border: "border-zinc-200", darkBorder: "border-[#2a2a2a]" },
    { id: "Lost", label: "Lost", icon: XCircle, color: "bg-red-50/50", darkColor: "bg-red-500/10", text: "text-red-500", darkText: "text-red-400", border: "border-red-200", darkBorder: "border-red-500/20" },
];

const PROJECT_TYPE_COLORS: Record<string, { light: string; dark: string }> = {
    "Residential": { light: "bg-blue-100 text-blue-700", dark: "bg-blue-500/20 text-blue-300" },
    "Commercial": { light: "bg-violet-100 text-violet-700", dark: "bg-violet-500/20 text-violet-300" },
    "Industrial": { light: "bg-orange-100 text-orange-700", dark: "bg-orange-500/20 text-orange-300" },
    "Refurbishment": { light: "bg-amber-100 text-amber-700", dark: "bg-amber-500/20 text-amber-300" },
    "New Build": { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-500/20 text-emerald-300" },
    "Civil": { light: "bg-cyan-100 text-cyan-700", dark: "bg-cyan-500/20 text-cyan-300" },
    "Fit Out": { light: "bg-pink-100 text-pink-700", dark: "bg-pink-500/20 text-pink-300" },
};

function getTypeBadgeClass(type: string | null, isDark: boolean): string {
    if (!type) return isDark ? "bg-white/10 text-[#a0a0a0]" : "bg-slate-100 text-slate-600";
    const colors = PROJECT_TYPE_COLORS[type];
    if (!colors) return isDark ? "bg-white/10 text-[#a0a0a0]" : "bg-slate-100 text-slate-600";
    return isDark ? colors.dark : colors.light;
}

function getDaysInStage(createdAt: string | null): number {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ProjectBoard({ projects, financials }: { projects: any[], financials: any }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [isPending, startTransition] = useTransition();

    const handleStatusChange = (projectId: string, newStatus: string) => {
        startTransition(async () => {
            await updateStatusAction(projectId, newStatus);
        });
    };

    const handleMarkAsWon = (projectId: string) => {
        startTransition(async () => {
            await markAsWonAction(projectId);
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 h-full items-start min-w-[900px]">
            {COLUMNS.map(col => {
                const items = projects.filter(p => (p.status || "Lead") === col.id);
                const colTotal = items.reduce((sum, p) => sum + (p.potential_value || financials[p.id] || 0), 0);

                return (
                    <div key={col.id} className="flex flex-col h-[calc(100vh-280px)] gap-3">
                        {/* COLUMN HEADER */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${isDark ? col.darkColor : col.color} ${isDark ? col.darkText : col.text}`}>
                                        <col.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className={`font-bold text-xs tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>{col.label}</h3>
                                </div>
                                <Badge variant="secondary" className={`text-[10px] font-black ${
                                    isDark ? "bg-[#1a1a1a] border-[#2a2a2a] text-white" : "bg-white border text-gray-900"
                                }`}>{items.length}</Badge>
                            </div>
                            <div className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isDark ? "text-[#a0a0a0]" : "text-gray-400"}`}>
                                £{colTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        {/* CARDS LIST */}
                        <div className={`flex-1 overflow-y-auto rounded-2xl border-2 border-dashed p-2.5 space-y-3 transition-colors scrollbar-thin ${
                            isDark
                                ? `${col.darkBorder} ${col.darkColor} scrollbar-thumb-[#2a2a2a]`
                                : `${col.border} ${col.color} scrollbar-thumb-slate-200`
                        }`}>
                            {items.map(p => {
                                const days = getDaysInStage(p.created_at);
                                const value = p.potential_value || financials[p.id] || 0;
                                return (
                                    <Card key={p.id} className={`group overflow-hidden transition-all duration-200 ${
                                        isDark
                                            ? "border-[#2a2a2a] bg-[#1a1a1a] shadow-sm hover:shadow-lg hover:shadow-black/20"
                                            : "border-gray-200 bg-white shadow-sm hover:shadow-md"
                                    }`}>
                                        <CardContent className="p-3 space-y-3">
                                            {/* HEADER */}
                                            <div className="flex items-start justify-between gap-1">
                                                <Link href={`/dashboard/foundations?projectId=${p.id}`} className="block flex-1 min-w-0">
                                                    <div className={`font-bold text-xs leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate ${
                                                        isDark ? "text-white" : "text-gray-900"
                                                    }`}>
                                                        {p.name}
                                                    </div>
                                                    <div className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? "text-[#a0a0a0]" : "text-gray-400"}`}>
                                                        {p.client_name || "Unknown Client"}
                                                    </div>
                                                </Link>
                                            </div>

                                            {/* PROJECT TYPE BADGE */}
                                            {p.project_type && (
                                                <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${getTypeBadgeClass(p.project_type, isDark)}`}>
                                                    {p.project_type}
                                                </span>
                                            )}

                                            {/* VALUE & DAYS */}
                                            <div className={`flex items-center justify-between py-2 border-y ${isDark ? "border-[#2a2a2a]" : "border-gray-100"}`}>
                                                <span className={`font-mono font-black text-xs ${isDark ? "text-white" : "text-gray-900"}`}>
                                                    {value ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "£—"}
                                                </span>
                                                <span className={`text-[9px] font-bold ${days > 30 ? "text-amber-500" : isDark ? "text-[#a0a0a0]" : "text-gray-400"}`}>
                                                    {days}d
                                                </span>
                                            </div>

                                            {/* STATUS SELECTOR */}
                                            <Select
                                                defaultValue={p.status || "Lead"}
                                                onValueChange={(val) => handleStatusChange(p.id, val)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className={`h-7 text-[10px] font-bold transition-colors ${
                                                    isDark
                                                        ? "border-[#2a2a2a] bg-[#0d0d0d] text-white hover:bg-[#1a1a1a]"
                                                        : "border-gray-100 bg-gray-50/50 hover:bg-gray-50"
                                                }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {COLUMNS.map(c => (
                                                        <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {/* MARK AS WON — show on Estimating / Proposal Sent */}
                                            {(p.status === "Estimating" || p.status === "Proposal Sent" || (!p.status)) && (
                                                <button
                                                    onClick={() => handleMarkAsWon(p.id)}
                                                    disabled={isPending}
                                                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${
                                                        isDark
                                                            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                                    } disabled:opacity-50`}
                                                >
                                                    <Trophy className="w-3 h-3" />
                                                    Mark as Won
                                                </button>
                                            )}

                                            {/* QUICK LINKS */}
                                            <div className={`flex items-center gap-3 pt-1 border-t ${isDark ? "border-[#2a2a2a]" : "border-gray-50"}`}>
                                                <Link href={`/dashboard/projects/proposal?projectId=${p.id}`} className="text-[9px] font-black uppercase text-purple-600 hover:underline tracking-widest">
                                                    Proposal
                                                </Link>
                                                <Link href={`/dashboard/projects/costs?projectId=${p.id}`} className="text-[9px] font-black uppercase text-green-600 hover:underline tracking-widest">
                                                    Costs
                                                </Link>
                                                {p.status === "Active" && (
                                                    <Link href={`/dashboard/projects/p-and-l?projectId=${p.id}`} className="text-[9px] font-black uppercase text-blue-500 hover:underline tracking-widest ml-auto">
                                                        P&amp;L →
                                                    </Link>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {items.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-6 opacity-40">
                                    <div className={`p-3 rounded-full shadow-inner ${
                                        isDark ? "bg-[#1a1a1a] border border-[#2a2a2a]" : "bg-white border border-gray-100"
                                    }`}>
                                        <Layers className={`w-5 h-5 ${isDark ? "text-[#a0a0a0]" : "text-gray-300"}`} />
                                    </div>
                                    <p className={`mt-2 text-[9px] font-black uppercase tracking-widest ${isDark ? "text-[#a0a0a0]" : "text-gray-400"}`}>Empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
