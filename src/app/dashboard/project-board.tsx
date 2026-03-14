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
    LayoutDashboard,
    MoreHorizontal,
    ArrowRight,
    Clock,
    FileText,
    Hammer,
    CheckCircle2,
    Users
} from "lucide-react";

// Define the columns for our business pipeline
const COLUMNS = [
    { id: "Lead", label: "Leads", icon: Users, color: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
    { id: "Estimating", label: "Estimating", icon: Clock, color: "bg-blue-50/50", text: "text-blue-600", border: "border-blue-200" },
    { id: "Proposal Sent", label: "Proposal", icon: FileText, color: "bg-purple-50/50", text: "text-purple-600", border: "border-purple-200" },
    { id: "Active", label: "Active", icon: Hammer, color: "bg-emerald-50/50", text: "text-emerald-600", border: "border-emerald-200" },
    { id: "Completed", label: "Completed", icon: CheckCircle2, color: "bg-zinc-50", text: "text-zinc-600", border: "border-zinc-200" }
];

export default function ProjectBoard({ projects, financials }: { projects: any[], financials: any }) {
    const [isPending, startTransition] = useTransition();

    const handleStatusChange = (projectId: string, newStatus: string) => {
        startTransition(async () => {
            await updateStatusAction(projectId, newStatus);
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 h-full items-start">
            {COLUMNS.map(col => {
                const items = projects.filter(p => (p.status || 'Lead') === col.id);
                const colTotal = items.reduce((sum, p) => sum + (financials[p.id] || 0), 0);

                return (
                    <div key={col.id} className="flex flex-col h-full min-h-[600px] gap-4">
                        {/* COLUMN HEADER */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${col.color} ${col.text}`}>
                                        <col.icon className="w-4 h-4" />
                                    </div>
                                    <h3 className="font-bold text-sm text-slate-900 tracking-tight">{col.label}</h3>
                                </div>
                                <Badge variant="secondary" className="bg-white border text-[10px] font-black">{items.length}</Badge>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                £{colTotal.toLocaleString('en-GB', { maximumFractionDigits: 0 })} Total
                            </div>
                        </div>

                        {/* CARDS LIST */}
                        <div className={`flex-1 rounded-2xl border-2 border-dashed ${col.border} ${col.color} p-3 space-y-4 transition-colors`}>
                            {items.map(p => (
                                <Card key={p.id} className="group border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                    <CardContent className="p-4 space-y-4">
                                        {/* HEADER */}
                                        <div className="flex items-start justify-between">
                                            <Link href={`/dashboard/foundations?projectId=${p.id}`} className="block flex-1 group">
                                                <div className="font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate">
                                                    {p.name}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                                    {p.client_name || "Unknown Client"}
                                                </div>
                                            </Link>
                                            <Link href={`/dashboard/projects/costs?projectId=${p.id}`} className="p-1 px-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors">
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>

                                        {/* TOTAL VALUE */}
                                        <div className="flex items-center justify-between py-3 border-y border-slate-50 border-dashed">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Est. Value</span>
                                            <span className="font-mono font-black text-sm text-slate-900">
                                                {financials[p.id] ? `£${financials[p.id].toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '£0'}
                                            </span>
                                        </div>

                                        {/* STATUS SELECTOR */}
                                        <div className="pt-1">
                                            <Select
                                                defaultValue={p.status || "Lead"}
                                                onValueChange={(val) => handleStatusChange(p.id, val)}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className="h-8 text-[11px] font-bold border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
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
                                        </div>

                                        {/* QUICK LINKS */}
                                        <div className="flex items-center gap-4 pt-1 border-t border-slate-50 mt-4">
                                            <Link href={`/dashboard/foundations?projectId=${p.id}`} className="text-[9px] font-black uppercase text-blue-600 hover:underline tracking-widest">Pricing</Link>
                                            <Link href={`/dashboard/projects/proposal?projectId=${p.id}`} className="text-[9px] font-black uppercase text-purple-600 hover:underline tracking-widest">Proposal</Link>
                                            <Link href={`/dashboard/projects/contracts?projectId=${p.id}`} className="text-[9px] font-black uppercase text-slate-400 hover:underline tracking-widest">Legal</Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {items.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-8 opacity-40 grayscale">
                                    <div className="p-3 bg-white rounded-full shadow-inner border border-slate-100">
                                        <col.icon className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
