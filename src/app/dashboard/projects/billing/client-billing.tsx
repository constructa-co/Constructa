"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    createAfpAction,
    updateInvoiceStatusAction,
    deleteInvoiceAction,
    releaseRetentionAction,
    createMilestoneAction,
    deleteMilestoneAction,
} from "./actions";
import { toast } from "sonner";
import {
    ReceiptText, Plus, Banknote, Trash2, Calendar, Loader2,
    AlertTriangle, CheckCircle2, Clock, CalendarDays, ShieldCheck,
    ClipboardList, TrendingDown, Lock,
} from "lucide-react";
import InvoicePdfButton from "./invoice-pdf-button";

interface Invoice {
    id: string;
    invoice_number: string;
    type: "Interim" | "Final";
    amount: number;
    status: "Draft" | "Sent" | "Paid";
    created_at: string;
    due_date?: string | null;
    paid_date?: string | null;
    retention_pct?: number;
    gross_valuation?: number;
    previous_cert?: number;
    retention_held?: number;
    net_due?: number;
    period_number?: number;
    is_retention_release?: boolean;
}

interface Milestone {
    id: string;
    label: string;
    target_pct?: number | null;
    amount?: number | null;
    due_date?: string | null;
    order_index: number;
}

interface Props {
    projectId: string;
    project: any;
    originalContractSum: number;
    approvedVariationsTotal: number;
    variations: any[];
    initialInvoices: Invoice[];
    initialMilestones: Milestone[];
}

const gbp = (n: number) => `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const daysBetween = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now.getTime() - d.getTime()) / 86400000);
};

const TABS = [
    { key: "valuations",  label: "Valuations",       icon: ReceiptText },
    { key: "schedule",    label: "Payment Schedule",  icon: CalendarDays },
    { key: "retention",   label: "Retention",         icon: ShieldCheck },
    { key: "aged",        label: "Aged Debt",         icon: TrendingDown },
] as const;
type Tab = typeof TABS[number]["key"];

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        Draft: "border-slate-600 bg-slate-700/50 text-slate-300",
        Sent:  "border-blue-500/40 bg-blue-500/10 text-blue-400",
        Paid:  "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] ?? map.Draft}`}>
            {status}
        </span>
    );
}

function StatusSelect({ inv, onStatusChange }: { inv: Invoice; onStatusChange: (id: string, status: string) => void }) {
    const colours: Record<string, string> = {
        Draft: "border-slate-600 bg-slate-700/50 text-slate-300",
        Sent:  "border-blue-500/40 bg-blue-500/10 text-blue-400",
        Paid:  "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    };
    return (
        <Select defaultValue={inv.status} onValueChange={val => onStatusChange(inv.id, val)}>
            <SelectTrigger className={`h-8 w-24 text-xs font-semibold border rounded-lg ${colours[inv.status] ?? colours.Draft}`}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="Draft" className="text-slate-300 text-xs">Draft</SelectItem>
                <SelectItem value="Sent"  className="text-blue-400 text-xs">Sent</SelectItem>
                <SelectItem value="Paid"  className="text-emerald-400 text-xs">Paid</SelectItem>
            </SelectContent>
        </Select>
    );
}

export default function ClientBilling({
    projectId, project, originalContractSum, approvedVariationsTotal,
    variations, initialInvoices, initialMilestones,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<Tab>("valuations");

    // AfP dialog state
    const [showAfp, setShowAfp] = useState(false);
    const [afpType, setAfpType] = useState<"Interim" | "Final">("Interim");
    const [retentionPct, setRetentionPct] = useState("5");
    const [grossValuation, setGrossValuation] = useState("");
    const [dueDate, setDueDate] = useState("");

    // Milestone dialog state
    const [showMilestone, setShowMilestone] = useState(false);
    const [msLabel, setMsLabel] = useState("");
    const [msPct, setMsPct] = useState("");
    const [msDue, setMsDue] = useState("");

    // Retention release dialog
    const [showRetRelease, setShowRetRelease] = useState(false);
    const [retReleaseAmt, setRetReleaseAmt] = useState("");
    const [retReleaseDue, setRetReleaseDue] = useState("");

    const revisedContractSum = originalContractSum + approvedVariationsTotal;

    // Compute totals from invoices (excluding retention releases from normal calcs)
    const normalInvoices = initialInvoices.filter(i => !i.is_retention_release);
    const retRelInvoices = initialInvoices.filter(i => i.is_retention_release);
    const totalGrossValuation = normalInvoices.length > 0
        ? Math.max(...normalInvoices.map(i => i.gross_valuation || 0))
        : 0;
    const totalNetInvoiced = normalInvoices.reduce((s, i) => s + (i.net_due || i.amount || 0), 0);
    const totalRetentionHeld = normalInvoices.reduce((s, i) => s + (i.retention_held || 0), 0);
    const totalRetentionReleased = retRelInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + i.amount, 0);
    const retentionOutstanding = totalRetentionHeld - totalRetentionReleased;
    const totalPaid = initialInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + (i.net_due || i.amount), 0);
    const totalOutstanding = initialInvoices.filter(i => i.status === "Sent").reduce((s, i) => s + (i.net_due || i.amount), 0);
    const remainingToValuate = revisedContractSum - totalGrossValuation;

    const nextPeriod = normalInvoices.length + 1;
    const prevCert = normalInvoices.length > 0
        ? Math.max(...normalInvoices.map(i => i.gross_valuation || 0))
        : 0;

    // Aged debt bands
    const sentInvoices = initialInvoices.filter(i => i.status === "Sent" && i.due_date);
    const bands = {
        current:  sentInvoices.filter(i => daysBetween(i.due_date!) <= 0),
        d30:      sentInvoices.filter(i => daysBetween(i.due_date!) > 0 && daysBetween(i.due_date!) <= 30),
        d60:      sentInvoices.filter(i => daysBetween(i.due_date!) > 30 && daysBetween(i.due_date!) <= 60),
        d90:      sentInvoices.filter(i => daysBetween(i.due_date!) > 60 && daysBetween(i.due_date!) <= 90),
        over90:   sentInvoices.filter(i => daysBetween(i.due_date!) > 90),
    };
    const bandTotal = (arr: Invoice[]) => arr.reduce((s, i) => s + (i.net_due || i.amount), 0);

    const handleCreateAfp = (e: React.FormEvent) => {
        e.preventDefault();
        const gross = parseFloat(grossValuation) || 0;
        startTransition(async () => {
            try {
                await createAfpAction({
                    project_id: projectId,
                    invoice_number: `AFP-${nextPeriod.toString().padStart(3, "0")}`,
                    type: afpType,
                    period_number: nextPeriod,
                    gross_valuation: gross,
                    previous_cert: prevCert,
                    retention_pct: parseFloat(retentionPct) || 5,
                    due_date: dueDate || undefined,
                });
                toast.success("Application for Payment created");
                setShowAfp(false);
                setGrossValuation("");
                setDueDate("");
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    const handleStatusChange = (id: string, status: string) => {
        startTransition(async () => {
            try {
                await updateInvoiceStatusAction(id, status, projectId);
                toast.success(`Marked as ${status}`);
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Delete this invoice?")) return;
        startTransition(async () => {
            try {
                await deleteInvoiceAction(id, projectId);
                toast.success("Invoice removed");
                router.refresh();
            } catch { toast.error("Failed to delete"); }
        });
    };

    const handleAddMilestone = (e: React.FormEvent) => {
        e.preventDefault();
        const pct = parseFloat(msPct);
        startTransition(async () => {
            try {
                await createMilestoneAction({
                    project_id: projectId,
                    label: msLabel,
                    target_pct: isNaN(pct) ? undefined : pct,
                    amount: isNaN(pct) ? undefined : Math.round(revisedContractSum * pct / 100 * 100) / 100,
                    due_date: msDue || undefined,
                    order_index: initialMilestones.length,
                });
                toast.success("Milestone added");
                setShowMilestone(false);
                setMsLabel(""); setMsPct(""); setMsDue("");
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    const handleReleaseRetention = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            try {
                await releaseRetentionAction({
                    project_id: projectId,
                    invoice_number: `RET-${String(retRelInvoices.length + 1).padStart(2, "0")}`,
                    amount: parseFloat(retReleaseAmt) || 0,
                    due_date: retReleaseDue || undefined,
                });
                toast.success("Retention release invoice created");
                setShowRetRelease(false);
                setRetReleaseAmt(""); setRetReleaseDue("");
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    // ── Gross valuation calc preview ──
    const grossNum = parseFloat(grossValuation) || 0;
    const retPctNum = parseFloat(retentionPct) || 5;
    const grossThisCert = grossNum - prevCert;
    const retHeld = grossNum * (retPctNum / 100);
    const netDue = grossThisCert - retHeld;

    return (
        <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Revised Contract Sum", value: gbp(revisedContractSum), colour: "text-slate-100" },
                    { label: "Gross Certified to Date", value: gbp(totalGrossValuation), colour: "text-blue-400" },
                    { label: "Net Invoiced (after retention)", value: gbp(totalNetInvoiced), colour: "text-white" },
                    { label: "Remaining to Valuate", value: gbp(Math.max(0, remainingToValuate)), colour: remainingToValuate < 0 ? "text-red-400" : "text-emerald-400" },
                ].map(k => (
                    <div key={k.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.colour}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="flex border-b border-slate-700/50">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                                activeTab === key
                                    ? "border-blue-500 text-blue-400 bg-blue-500/5"
                                    : "border-transparent text-slate-500 hover:text-slate-300"
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── VALUATIONS TAB ── */}
                {activeTab === "valuations" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Applications for Payment</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Gross valuation → less previous cert → less retention = net due</p>
                            </div>
                            <button
                                onClick={() => setShowAfp(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New AFP
                            </button>
                        </div>

                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    {["AFP", "Period", "Gross Valuation", "Less Prev Cert", "Retention", "Net Due", "Due Date", "Status", ""].map(h => (
                                        <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "Net Due" || h === "Gross Valuation" || h === "Less Prev Cert" || h === "Retention" ? "text-right" : h === "Status" ? "text-center" : h === "" ? "text-right" : "text-left"}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {initialInvoices.map((inv, i) => {
                                    const overdue = inv.status === "Sent" && inv.due_date && daysBetween(inv.due_date) > 0;
                                    return (
                                        <tr key={inv.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialInvoices.length - 1 ? "border-0" : ""}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {inv.is_retention_release
                                                        ? <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                        : <ReceiptText className="w-3.5 h-3.5 text-slate-400" />
                                                    }
                                                    <span className="font-semibold text-slate-100 text-xs">{inv.invoice_number}</span>
                                                    {inv.is_retention_release && (
                                                        <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded px-1">Ret. Release</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-600 ml-5">{new Date(inv.created_at).toLocaleDateString("en-GB")}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400">
                                                {inv.is_retention_release ? "—" : `No. ${inv.period_number ?? "—"}`}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-mono text-slate-300">
                                                {inv.is_retention_release ? "—" : gbp(inv.gross_valuation || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
                                                {inv.is_retention_release ? "—" : gbp(inv.previous_cert || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-mono text-amber-400/80">
                                                {inv.is_retention_release ? "Released" : gbp(inv.retention_held || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-100 text-sm">
                                                {gbp(inv.net_due || inv.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {inv.due_date ? (
                                                    <div className="flex items-center gap-1">
                                                        {overdue && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                                        <span className={`text-xs ${overdue ? "text-red-400 font-semibold" : "text-slate-400"}`}>
                                                            {new Date(inv.due_date).toLocaleDateString("en-GB")}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <StatusSelect inv={inv} onStatusChange={handleStatusChange} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <InvoicePdfButton invoice={inv} project={project} originalContractSum={originalContractSum} variations={variations} />
                                                    <button
                                                        onClick={() => handleDelete(inv.id)}
                                                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {initialInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                                    <ReceiptText className="h-6 w-6 text-slate-500" />
                                                </div>
                                                <p className="text-sm text-slate-500">No applications raised yet</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Footer */}
                        <div className="border-t border-slate-700/50 px-5 py-4 flex items-center justify-between bg-slate-900/30">
                            <div className="flex items-center gap-8">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Paid</p>
                                    <p className="text-lg font-bold text-emerald-400 mt-0.5">{gbp(totalPaid)}</p>
                                </div>
                                <div className="h-8 w-px bg-slate-700/50" />
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outstanding</p>
                                    <p className="text-lg font-bold text-blue-400 mt-0.5">{gbp(totalOutstanding)}</p>
                                </div>
                                <div className="h-8 w-px bg-slate-700/50" />
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Retention Held</p>
                                    <p className="text-lg font-bold text-amber-400 mt-0.5">{gbp(retentionOutstanding)}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remaining to Valuate</p>
                                <p className={`text-2xl font-bold mt-0.5 ${remainingToValuate < 0 ? "text-red-400" : "text-white"}`}>
                                    {gbp(Math.max(0, remainingToValuate))}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PAYMENT SCHEDULE TAB ── */}
                {activeTab === "schedule" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Payment Schedule</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Define expected payment milestones for this project</p>
                            </div>
                            <button
                                onClick={() => setShowMilestone(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Milestone
                            </button>
                        </div>

                        <div className="divide-y divide-slate-700/30">
                            {initialMilestones.length === 0 && (
                                <div className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                            <CalendarDays className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <p className="text-sm text-slate-500">No milestones set</p>
                                        <p className="text-xs text-slate-600">Add milestones to plan your payment schedule</p>
                                    </div>
                                </div>
                            )}
                            {initialMilestones.map((ms, i) => {
                                const msAmount = ms.amount ?? (ms.target_pct ? revisedContractSum * ms.target_pct / 100 : null);
                                const overdue = ms.due_date && new Date(ms.due_date) < new Date();
                                return (
                                    <div key={ms.id} className="group flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${overdue ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-slate-700/50 text-slate-400 border border-slate-600/50"}`}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-100">{ms.label}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    {ms.target_pct && <span className="text-xs text-slate-500">{ms.target_pct}% of contract</span>}
                                                    {ms.due_date && (
                                                        <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-400" : "text-slate-500"}`}>
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(ms.due_date).toLocaleDateString("en-GB")}
                                                            {overdue && " — overdue"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {msAmount !== null && (
                                                <p className="text-base font-bold text-slate-100">{gbp(msAmount)}</p>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (!confirm("Delete this milestone?")) return;
                                                    startTransition(async () => {
                                                        try {
                                                            await deleteMilestoneAction(ms.id, projectId);
                                                            toast.success("Milestone removed");
                                                            router.refresh();
                                                        } catch { toast.error("Failed"); }
                                                    });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Schedule total footer */}
                        {initialMilestones.length > 0 && (
                            <div className="border-t border-slate-700/50 px-5 py-4 bg-slate-900/30 flex justify-between items-center">
                                <p className="text-xs text-slate-500">
                                    {initialMilestones.length} milestone{initialMilestones.length !== 1 ? "s" : ""} planned
                                </p>
                                <p className="text-sm font-semibold text-slate-300">
                                    Scheduled: {gbp(initialMilestones.reduce((s, ms) => s + (ms.amount ?? (ms.target_pct ? revisedContractSum * ms.target_pct / 100 : 0)), 0))}
                                    <span className="text-xs text-slate-500 ml-2">of {gbp(revisedContractSum)}</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── RETENTION TAB ── */}
                {activeTab === "retention" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Retention Ledger</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Track retention deducted and released across all applications</p>
                            </div>
                            {retentionOutstanding > 0 && (
                                <button
                                    onClick={() => { setRetReleaseAmt(String(Math.round(retentionOutstanding * 50) / 100)); setShowRetRelease(true); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 transition-colors"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Release Retention
                                </button>
                            )}
                        </div>

                        {/* Summary cards */}
                        <div className="grid grid-cols-3 gap-4 p-5">
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/70 mb-1">Total Retention Deducted</p>
                                <p className="text-2xl font-bold text-amber-400">{gbp(totalRetentionHeld)}</p>
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/70 mb-1">Released to Date</p>
                                <p className="text-2xl font-bold text-emerald-400">{gbp(totalRetentionReleased)}</p>
                            </div>
                            <div className={`rounded-xl p-4 border ${retentionOutstanding > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-800/50 border-slate-700/50"}`}>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Retention Outstanding</p>
                                <p className={`text-2xl font-bold ${retentionOutstanding > 0 ? "text-amber-400" : "text-slate-400"}`}>{gbp(retentionOutstanding)}</p>
                            </div>
                        </div>

                        {/* Per-invoice retention table */}
                        <table className="w-full text-sm border-t border-slate-700/50">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    {["AFP", "Gross Valuation", "Retention %", "Retention Held", "Status"].map(h => (
                                        <th key={h} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "Status" ? "text-center" : h !== "AFP" ? "text-right" : "text-left"}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {normalInvoices.map((inv, i) => (
                                    <tr key={inv.id} className={`border-b border-slate-700/30 ${i === normalInvoices.length - 1 ? "border-0" : ""}`}>
                                        <td className="px-5 py-3 text-xs font-semibold text-slate-300">{inv.invoice_number}</td>
                                        <td className="px-5 py-3 text-right text-xs font-mono text-slate-400">{gbp(inv.gross_valuation || 0)}</td>
                                        <td className="px-5 py-3 text-right text-xs text-slate-400">{inv.retention_pct ?? 5}%</td>
                                        <td className="px-5 py-3 text-right text-xs font-mono font-semibold text-amber-400">{gbp(inv.retention_held || 0)}</td>
                                        <td className="px-5 py-3 text-center"><StatusBadge status={inv.status} /></td>
                                    </tr>
                                ))}
                                {retRelInvoices.map((inv, i) => (
                                    <tr key={inv.id} className="border-b border-slate-700/30">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-emerald-400">{inv.invoice_number}</span>
                                                <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded px-1">Release</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-right text-xs font-mono text-slate-400">—</td>
                                        <td className="px-5 py-3 text-right text-xs text-slate-400">—</td>
                                        <td className="px-5 py-3 text-right text-xs font-mono font-semibold text-emerald-400">({gbp(inv.amount)})</td>
                                        <td className="px-5 py-3 text-center"><StatusBadge status={inv.status} /></td>
                                    </tr>
                                ))}
                                {normalInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                                            No applications for payment yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── AGED DEBT TAB ── */}
                {activeTab === "aged" && (
                    <div>
                        <div className="px-5 py-4 border-b border-slate-700/50">
                            <h2 className="text-sm font-semibold text-white">Aged Debt Analysis</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Outstanding invoices by days overdue (Sent status only)</p>
                        </div>

                        {/* Aged bands */}
                        <div className="grid grid-cols-5 gap-0 border-b border-slate-700/50">
                            {[
                                { label: "Current / Not Due", invoices: bands.current, colour: "text-emerald-400", bg: "bg-emerald-500/5" },
                                { label: "1–30 Days",         invoices: bands.d30,     colour: "text-blue-400",    bg: "" },
                                { label: "31–60 Days",        invoices: bands.d60,     colour: "text-amber-400",   bg: "" },
                                { label: "61–90 Days",        invoices: bands.d90,     colour: "text-orange-400",  bg: "" },
                                { label: "90+ Days",          invoices: bands.over90,  colour: "text-red-400",     bg: "bg-red-500/5" },
                            ].map(band => (
                                <div key={band.label} className={`p-5 border-r border-slate-700/50 last:border-0 ${band.bg}`}>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{band.label}</p>
                                    <p className={`text-2xl font-bold ${band.colour}`}>{gbp(bandTotal(band.invoices))}</p>
                                    <p className="text-xs text-slate-600 mt-1">{band.invoices.length} invoice{band.invoices.length !== 1 ? "s" : ""}</p>
                                </div>
                            ))}
                        </div>

                        {/* Overdue detail list */}
                        <div className="divide-y divide-slate-700/30">
                            {sentInvoices.length === 0 && (
                                <div className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                                        <p className="text-sm text-slate-400 font-semibold">No outstanding invoices</p>
                                        <p className="text-xs text-slate-600">All invoices are either paid or in draft</p>
                                    </div>
                                </div>
                            )}
                            {sentInvoices
                                .sort((a, b) => (b.due_date! > a.due_date! ? 1 : -1))
                                .map(inv => {
                                    const days = daysBetween(inv.due_date!);
                                    const overdue = days > 0;
                                    return (
                                        <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${overdue ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                                                    {overdue ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-blue-400" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-100">{inv.invoice_number}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Due: {new Date(inv.due_date!).toLocaleDateString("en-GB")}
                                                        {overdue
                                                            ? <span className="text-red-400 ml-2 font-semibold">{days} days overdue</span>
                                                            : <span className="text-emerald-400 ml-2">due in {Math.abs(days)} days</span>
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <p className="text-base font-bold text-slate-100">{gbp(inv.net_due || inv.amount)}</p>
                                                <StatusSelect inv={inv} onStatusChange={handleStatusChange} />
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>

                        {sentInvoices.length > 0 && (
                            <div className="border-t border-slate-700/50 px-5 py-4 bg-slate-900/30 flex justify-between items-center">
                                <p className="text-xs text-slate-500">{sentInvoices.length} outstanding invoice{sentInvoices.length !== 1 ? "s" : ""}</p>
                                <p className="text-sm font-bold text-slate-100">Total Outstanding: {gbp(bandTotal(sentInvoices))}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── AFP DIALOG ── */}
            <Dialog open={showAfp} onOpenChange={setShowAfp}>
                <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white">
                            Application for Payment — No. {nextPeriod}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateAfp} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Type</Label>
                                <Select value={afpType} onValueChange={(v: any) => setAfpType(v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="Interim" className="text-slate-200">Interim</SelectItem>
                                        <SelectItem value="Final"   className="text-slate-200">Final Account</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Retention %</Label>
                                <Input
                                    type="number" step="0.5" min="0" max="10"
                                    value={retentionPct}
                                    onChange={e => setRetentionPct(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Gross Valuation to Date (£)</Label>
                            <Input
                                type="number" step="0.01" placeholder="0.00"
                                value={grossValuation}
                                onChange={e => setGrossValuation(e.target.value)}
                                required
                                className="h-12 bg-slate-800 border-slate-700 text-white text-xl font-bold"
                            />
                            <p className="text-xs text-slate-600">Total value of work completed to date on the job</p>
                        </div>

                        {/* Live calc breakdown */}
                        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between text-slate-400">
                                <span>Gross valuation to date</span>
                                <span className="font-mono">{gbp(grossNum)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Less previous certificate</span>
                                <span className="font-mono">({gbp(prevCert)})</span>
                            </div>
                            <div className="flex justify-between text-slate-300 border-t border-slate-700/50 pt-2">
                                <span>Gross this certificate</span>
                                <span className="font-mono">{gbp(grossThisCert)}</span>
                            </div>
                            <div className="flex justify-between text-amber-400/80">
                                <span>Less retention ({retPctNum}%)</span>
                                <span className="font-mono">({gbp(retHeld)})</span>
                            </div>
                            <div className="flex justify-between text-white font-bold border-t border-slate-700/50 pt-2 text-base">
                                <span>Net due this certificate</span>
                                <span className="font-mono">{gbp(netDue)}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Payment Due Date</Label>
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Post AFP — Net Due ${gbp(netDue)}`}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── MILESTONE DIALOG ── */}
            <Dialog open={showMilestone} onOpenChange={setShowMilestone}>
                <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white">Add Payment Milestone</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddMilestone} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Milestone Label</Label>
                            <Input
                                placeholder="e.g. Practical Completion"
                                value={msLabel}
                                onChange={e => setMsLabel(e.target.value)}
                                required
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">% of Contract</Label>
                                <Input
                                    type="number" step="1" min="0" max="100"
                                    placeholder="e.g. 25"
                                    value={msPct}
                                    onChange={e => setMsPct(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                                {msPct && !isNaN(parseFloat(msPct)) && (
                                    <p className="text-xs text-slate-500">{gbp(revisedContractSum * parseFloat(msPct) / 100)}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Due Date</Label>
                                <Input
                                    type="date"
                                    value={msDue}
                                    onChange={e => setMsDue(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Milestone"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── RETENTION RELEASE DIALOG ── */}
            <Dialog open={showRetRelease} onOpenChange={setShowRetRelease}>
                <DialogContent className="sm:max-w-[380px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white">Release Retention</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleReleaseRetention} className="space-y-4 py-2">
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
                            <p>Total retention held: <strong>{gbp(totalRetentionHeld)}</strong></p>
                            <p className="mt-1 text-xs text-amber-400/70">Typically 50% released at Practical Completion, 50% at end of Defects Liability Period</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Amount to Release (£)</Label>
                            <Input
                                type="number" step="0.01"
                                value={retReleaseAmt}
                                onChange={e => setRetReleaseAmt(e.target.value)}
                                required
                                className="h-12 bg-slate-800 border-slate-700 text-white text-xl font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Due Date</Label>
                            <Input
                                type="date"
                                value={retReleaseDue}
                                onChange={e => setRetReleaseDue(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isPending} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold h-11">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Retention Release Invoice"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
