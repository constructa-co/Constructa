"use client";

import Link from "next/link";
import { useTransition } from "react";
import { updateStatusAction } from "./board-actions";
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
} from "lucide-react";

// Define the columns for our business pipeline
const COLUMNS = [
    { id: "Lead", label: "Leads", icon: Users, color: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
    { id: "Estimating", label: "Estimating", icon: Clock, color: "bg-blue-50/50", text: "text-blue-600", border: "border-blue-200" },
    { id: "Proposal Sent", label: "Proposal Sent", icon: FileText, color: "bg-purple-50/50", text: "text-purple-600", border: "border-purple-200" },
    { id: "Active", label: "Active", icon: Hammer, color: "bg-emerald-50/50", text: "text-emerald-600", border: "border-emerald-200" },
    { id: "Completed", label: "Completed", icon: CheckCircle2, color: "bg-zinc-50", text: "text-zinc-600", border: "border-zinc-200" },
    { id: "Lost", label: "Lost", icon: XCircle, color: "bg-red-50/50", text: "text-red-500", border: "border-red-200" },
];

const PROJECT_TYPE_COLORS: Record<string, string> = {
    "Residential": "bg-blue-100 text-blue-700",
    "Commercial": "bg-violet-100 text-violet-700",
    "Industrial": "bg-orange-100 text-orange-700",
    "Refurbishment": "bg-amber-100 text-amber-700",
    "New Build": "bg-emerald-100 text-emerald-700",
    "Civil": "bg-cyan-100 text-cyan-700",
    "Fit Out": "bg-pink-100 text-pink-700",
};

function getTypeBadgeClass(type: string | null): string {
    if (!type) return "bg-slate-100 text-slate-600";
    return PROJECT_TYPE_COLORS[type] || "bg-slate-100 text-slate-600";
}

function getDaysInStage(createdAt: string | null): number {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ProjectBoard({ projects, financials }: { projects: any[], financials: any }) {
    const [isPending, startTransition] = useTransition();

    const handleStatusChange = (projectId: string, newStatus: string) => {
        startTransition(async () => {
            await updateStatusAction(projectId, newStatus);
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 h-full items-start min-w-[900px]">
            {COLUMNS.map(col => {
                const items = projects.filter(p => (p.status || "Lead") === col.id);
                const colTotal = items.reduce((sum, p) => sum + (p.potential_value || financials[p.id] || 0), 0);

                return (
                    <div key={col.id} className="flex flex-col h-full gap-3">
                        {/* COLUMN HEADER */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${col.color} ${col.text}`}>
                                        <col.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="font-bold text-xs text-slate-900 tracking-tight">{col.label}</h3>
                                </div>
                                <Badge variant="secondary" className="bg-white border text-[10px] font-black">{items.length}</Badge>
                            </div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                £{colTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        {/* CARDS LIST */}
                        <div className={`flex-1 rounded-2xl border-2 border-dashed ${col.border} ${col.color} p-2.5 space-y-3 transition-colors min-h-[400px]`}>
                            {items.map(p => {
                                const days = getDaysInStage(p.created_at);
                                const value = p.potential_value || financials[p.id] || 0;
                                return (
                                    <Card key={p.id} className="group border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                        <CardContent className="p-3 space-y-3">
                                            {/* HEADER */}
                                            <div className="flex items-start justify-between gap-1">
                                                <Link href={`/dashboard/foundations?projectId=${p.id}`} className="block flex-1 min-w-0">
                                                    <div className="font-bold text-slate-900 text-xs leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate">
                                                        {p.name}
                                                    </div>
                                                    <div className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
                                                        {p.client_name || "Unknown Client"}
                                                    </div>
                                                </Link>
                                            </div>

                                            {/* PROJECT TYPE BADGE */}
                                            {p.project_type && (
                                                <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${getTypeBadgeClass(p.project_type)}`}>
                                                    {p.project_type}
                                                </span>
                                            )}

                                            {/* VALUE & DAYS */}
                                            <div className="flex items-center justify-between py-2 border-y border-slate-100">
                                                <span className="font-mono font-black text-xs text-slate-900">
                                                    {value ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "£—"}
                                                </span>
                                                <span className={`text-[9px] font-bold ${days > 30 ? "text-amber-500" : "text-slate-400"}`}>
                                                    {days}d
                                                </span>
                                            </div>

                                            {/* STATUS SELECTOR */}
                                            <Select
                                                defaultValue={p.status || "Lead"}
                                                onValueChange={(val) => handleStatusChange(p.id, val)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className="h-7 text-[10px] font-bold border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
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

                                            {/* QUICK LINKS */}
                                            <div className="flex items-center gap-3 pt-1 border-t border-slate-50">
                                                <Link href={`/dashboard/projects/proposal?projectId=${p.id}`} className="text-[9px] font-black uppercase text-purple-600 hover:underline tracking-widest">
                                                    📝 Proposal
                                                </Link>
                                                <Link href={`/dashboard/projects/costs?projectId=${p.id}`} className="text-[9px] font-black uppercase text-green-600 hover:underline tracking-widest">
                                                    💰 Costs
                                                </Link>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {items.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-6 opacity-40">
                                    <div className="p-3 bg-white rounded-full shadow-inner border border-slate-100">
                                        <Layers className="w-5 h-5 text-slate-300" />
                                    </div>
                                    <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
