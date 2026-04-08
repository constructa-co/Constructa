"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createVariationAction, updateVariationStatusAction, deleteVariationAction } from "./actions";
import { toast } from "sonner";
import {
    Plus, CheckCircle2, XCircle, Trash2, Loader2, GitBranch,
    Clock, AlertTriangle, TrendingUp,
} from "lucide-react";
import VariationPdfButton from "./variation-pdf-button";

interface Variation {
    id: string;
    variation_number?: string;
    title: string;
    description?: string;
    amount: number;
    status: "Draft" | "Pending Approval" | "Approved" | "Rejected";
    created_at: string;
    instruction_type?: string;
    trade_section?: string;
    instructed_by?: string;
    date_instructed?: string;
    approval_date?: string;
    approval_reference?: string;
    rejection_reason?: string;
}

interface Props {
    projectId: string;
    project: any;
    initialVariations: Variation[];
}

const gbp = (n: number) => `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

const INSTRUCTION_TYPES = [
    "Client Instruction",
    "Architect's Instruction",
    "Site Instruction",
    "Daywork",
    "Provisional Sum Adjustment",
    "Omission",
    "Engineer's Instruction",
];

const STATUS_STYLES: Record<string, string> = {
    "Draft":            "border-slate-600 bg-slate-700/50 text-slate-300",
    "Pending Approval": "border-amber-500/40 bg-amber-500/10 text-amber-400",
    "Approved":         "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    "Rejected":         "border-red-500/40 bg-red-500/10 text-red-400",
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[status] ?? STATUS_STYLES.Draft}`}>
            {status}
        </span>
    );
}

export default function ClientVariations({ projectId, project, initialVariations }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Create form state
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle]               = useState("");
    const [description, setDescription]   = useState("");
    const [amount, setAmount]             = useState("");
    const [instrType, setInstrType]       = useState("Client Instruction");
    const [tradeSection, setTradeSection] = useState("");
    const [instructedBy, setInstructedBy] = useState("");
    const [dateInstructed, setDateInstructed] = useState("");

    // Approve/Reject dialog state
    const [actionVariation, setActionVariation] = useState<Variation | null>(null);
    const [actionType, setActionType]           = useState<"approve" | "reject" | null>(null);
    const [approvalRef, setApprovalRef]         = useState("");
    const [rejectionReason, setRejectionReason] = useState("");

    // Filter
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Computed totals
    const approved       = initialVariations.filter(v => v.status === "Approved");
    const pending        = initialVariations.filter(v => v.status === "Pending Approval");
    const rejected       = initialVariations.filter(v => v.status === "Rejected");
    const approvedTotal  = approved.reduce((s, v) => s + Number(v.amount), 0);
    const pendingTotal   = pending.reduce((s, v) => s + Number(v.amount), 0);

    const filtered = statusFilter === "all"
        ? initialVariations
        : initialVariations.filter(v => v.status === statusFilter);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            try {
                await createVariationAction({
                    project_id:     projectId,
                    title,
                    description,
                    amount:         parseFloat(amount) || 0,
                    instruction_type: instrType,
                    trade_section:  tradeSection || undefined,
                    instructed_by:  instructedBy || undefined,
                    date_instructed: dateInstructed || undefined,
                });
                toast.success("Variation logged");
                setShowCreate(false);
                setTitle(""); setDescription(""); setAmount("");
                setInstrType("Client Instruction"); setTradeSection("");
                setInstructedBy(""); setDateInstructed("");
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    const handleApproveReject = (e: React.FormEvent) => {
        e.preventDefault();
        if (!actionVariation || !actionType) return;
        const status = actionType === "approve" ? "Approved" : "Rejected";
        startTransition(async () => {
            try {
                await updateVariationStatusAction(actionVariation.id, status, projectId, {
                    approval_reference: approvalRef || undefined,
                    rejection_reason:   rejectionReason || undefined,
                });
                toast.success(`Variation ${status.toLowerCase()}`);
                setActionVariation(null); setActionType(null);
                setApprovalRef(""); setRejectionReason("");
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    const handleSubmitForApproval = (v: Variation) => {
        startTransition(async () => {
            try {
                await updateVariationStatusAction(v.id, "Pending Approval", projectId);
                toast.success("Submitted for approval");
                router.refresh();
            } catch (err: any) { toast.error(err.message); }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Delete this variation?")) return;
        startTransition(async () => {
            try {
                await deleteVariationAction(id, projectId);
                toast.success("Variation deleted");
                router.refresh();
            } catch { toast.error("Failed to delete"); }
        });
    };

    return (
        <div className="space-y-5">
            {/* ── KPI STRIP ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Logged</p>
                    <p className="text-2xl font-bold text-slate-100">{initialVariations.length}</p>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/70 mb-1">Pending Approval</p>
                    <p className="text-2xl font-bold text-amber-400">{gbp(pendingTotal)}</p>
                    <p className="text-xs text-amber-400/60 mt-0.5">{pending.length} variation{pending.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/70 mb-1">Approved Value</p>
                    <p className="text-2xl font-bold text-emerald-400">{gbp(approvedTotal)}</p>
                    <p className="text-xs text-emerald-400/60 mt-0.5">{approved.length} approved</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500/70 mb-1">Rejected</p>
                    <p className="text-2xl font-bold text-red-400">{rejected.length}</p>
                    <p className="text-xs text-red-400/60 mt-0.5">
                        {rejected.length > 0 ? gbp(rejected.reduce((s, v) => s + Number(v.amount), 0)) : "—"}
                    </p>
                </div>
            </div>

            {/* ── FINAL ACCOUNT SUMMARY ── */}
            {approvedTotal > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <div>
                            <p className="text-sm font-semibold text-white">Contract Sum Impact</p>
                            <p className="text-xs text-slate-500 mt-0.5">Approved variations adjust the final account</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-8 text-right">
                        <div>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Approved Variations</p>
                            <p className="text-lg font-bold text-emerald-400">+{gbp(approvedTotal)}</p>
                        </div>
                        {pendingTotal > 0 && (
                            <>
                                <div className="h-8 w-px bg-slate-700/50" />
                                <div>
                                    <p className="text-[11px] text-slate-500 uppercase tracking-wider">Pending</p>
                                    <p className="text-lg font-bold text-amber-400">+{gbp(pendingTotal)}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── VARIATIONS LOG ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <GitBranch className="h-4 w-4 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Variations Log</h2>
                            <p className="text-xs text-slate-500">All scope changes for this project</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Status filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-8 w-40 text-xs bg-slate-800 border-slate-700 text-slate-300">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="all"             className="text-slate-200 text-xs">All Statuses</SelectItem>
                                <SelectItem value="Draft"           className="text-slate-200 text-xs">Draft</SelectItem>
                                <SelectItem value="Pending Approval" className="text-amber-400 text-xs">Pending Approval</SelectItem>
                                <SelectItem value="Approved"        className="text-emerald-400 text-xs">Approved</SelectItem>
                                <SelectItem value="Rejected"        className="text-red-400 text-xs">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Log Variation
                        </button>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            {["Ref", "Title", "Type / Section", "Instructed", "Status", "Amount", ""].map(h => (
                                <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "Amount" ? "text-right" : h === "" ? "text-right" : "text-left"}`}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((v, i) => (
                            <tr key={v.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}>
                                {/* Ref */}
                                <td className="px-4 py-3">
                                    <span className="text-xs font-mono font-semibold text-purple-400">
                                        {v.variation_number ?? "—"}
                                    </span>
                                    <p className="text-[10px] text-slate-600 mt-0.5">{new Date(v.created_at).toLocaleDateString("en-GB")}</p>
                                </td>
                                {/* Title */}
                                <td className="px-4 py-3 max-w-[200px]">
                                    <p className="font-semibold text-slate-100 text-sm">{v.title}</p>
                                    {v.description && (
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{v.description}</p>
                                    )}
                                    {v.approval_reference && (
                                        <p className="text-[10px] text-emerald-400 mt-0.5">Ref: {v.approval_reference}</p>
                                    )}
                                    {v.rejection_reason && (
                                        <p className="text-[10px] text-red-400 mt-0.5 line-clamp-1">{v.rejection_reason}</p>
                                    )}
                                </td>
                                {/* Type / Section */}
                                <td className="px-4 py-3">
                                    <p className="text-xs text-slate-300">{v.instruction_type ?? "Client Instruction"}</p>
                                    {v.trade_section && <p className="text-[10px] text-slate-500 mt-0.5">{v.trade_section}</p>}
                                </td>
                                {/* Instructed */}
                                <td className="px-4 py-3">
                                    {v.instructed_by && <p className="text-xs text-slate-300">{v.instructed_by}</p>}
                                    {v.date_instructed && (
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {new Date(v.date_instructed).toLocaleDateString("en-GB")}
                                        </p>
                                    )}
                                    {!v.instructed_by && !v.date_instructed && <span className="text-xs text-slate-600">—</span>}
                                </td>
                                {/* Status */}
                                <td className="px-4 py-3">
                                    <StatusBadge status={v.status} />
                                </td>
                                {/* Amount */}
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
                                    {v.amount < 0
                                        ? <span className="text-red-400">({gbp(Math.abs(Number(v.amount)))})</span>
                                        : gbp(Number(v.amount))
                                    }
                                </td>
                                {/* Actions */}
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <VariationPdfButton variation={v} project={project} />
                                        {v.status === "Draft" && (
                                            <button
                                                onClick={() => handleSubmitForApproval(v)}
                                                className="h-7 px-2 flex items-center gap-1 rounded-md text-amber-400 hover:bg-amber-500/10 text-[11px] font-semibold transition-colors"
                                                title="Submit for approval"
                                            >
                                                <Clock className="w-3.5 h-3.5" />
                                                Submit
                                            </button>
                                        )}
                                        {v.status === "Pending Approval" && (
                                            <>
                                                <button
                                                    onClick={() => { setActionVariation(v); setActionType("approve"); }}
                                                    className="h-7 px-2 flex items-center gap-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-semibold transition-colors"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => { setActionVariation(v); setActionType("reject"); }}
                                                    className="h-7 px-2 flex items-center gap-1 rounded-md text-red-400 hover:bg-red-500/10 text-[11px] font-semibold transition-colors"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleDelete(v.id)}
                                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-5 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                            <GitBranch className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            {statusFilter === "all" ? "No variations logged yet" : `No ${statusFilter.toLowerCase()} variations`}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Footer totals */}
                {filtered.length > 0 && (
                    <div className="border-t border-slate-700/50 px-5 py-3 bg-slate-900/30 flex justify-end">
                        <p className="text-sm font-bold text-slate-100">
                            {statusFilter === "all" ? "Approved total: " : `${statusFilter} total: `}
                            <span className="text-emerald-400">
                                {gbp(filtered.filter(v => v.status === "Approved").reduce((s, v) => s + Number(v.amount), 0))}
                            </span>
                        </p>
                    </div>
                )}
            </div>

            {/* ── CREATE VARIATION DIALOG ── */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white">Log New Variation</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Variation Title</Label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Extra sockets in kitchen"
                                required
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Instruction Type</Label>
                                <Select value={instrType} onValueChange={setInstrType}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        {INSTRUCTION_TYPES.map(t => (
                                            <SelectItem key={t} value={t} className="text-slate-200 text-xs">{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Trade / Section</Label>
                                <Input
                                    value={tradeSection}
                                    onChange={e => setTradeSection(e.target.value)}
                                    placeholder="e.g. Electrical"
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Instructed By</Label>
                                <Input
                                    value={instructedBy}
                                    onChange={e => setInstructedBy(e.target.value)}
                                    placeholder="e.g. John Smith (Client)"
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-400">Date Instructed</Label>
                                <Input
                                    type="date"
                                    value={dateInstructed}
                                    onChange={e => setDateInstructed(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Description</Label>
                            <Textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Scope of change, reason, materials affected..."
                                rows={3}
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-400">Value (£) — use negative for omissions</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                required
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                            />
                        </div>

                        <DialogFooter>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Variation"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── APPROVE / REJECT DIALOG ── */}
            <Dialog open={!!actionVariation} onOpenChange={open => { if (!open) { setActionVariation(null); setActionType(null); } }}>
                <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white">
                            {actionType === "approve" ? "Approve Variation" : "Reject Variation"}
                        </DialogTitle>
                    </DialogHeader>
                    {actionVariation && (
                        <form onSubmit={handleApproveReject} className="space-y-4 py-2">
                            <div className={`rounded-xl p-3 border text-sm ${actionType === "approve" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300" : "bg-red-500/5 border-red-500/20 text-red-300"}`}>
                                <p className="font-semibold">{actionVariation.variation_number} — {actionVariation.title}</p>
                                <p className="text-xs mt-0.5 opacity-70">{gbp(Number(actionVariation.amount))}</p>
                            </div>

                            {actionType === "approve" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-400">Client Approval Reference (optional)</Label>
                                    <Input
                                        value={approvalRef}
                                        onChange={e => setApprovalRef(e.target.value)}
                                        placeholder="e.g. Email ref, PO number, WhatsApp message"
                                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                    />
                                </div>
                            )}

                            {actionType === "reject" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-400">Reason for Rejection</Label>
                                    <Textarea
                                        value={rejectionReason}
                                        onChange={e => setRejectionReason(e.target.value)}
                                        placeholder="Explain why this variation was not approved..."
                                        rows={3}
                                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                    />
                                </div>
                            )}

                            <DialogFooter>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className={`w-full h-11 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
                                >
                                    {isPending
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : actionType === "approve"
                                            ? <><CheckCircle2 className="w-4 h-4" /> Confirm Approval</>
                                            : <><XCircle className="w-4 h-4" /> Confirm Rejection</>
                                    }
                                </button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
