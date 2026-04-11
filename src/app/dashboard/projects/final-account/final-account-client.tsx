"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, FileSignature, PenLine } from "lucide-react";
import { upsertFinalAccountAction, createAdjustmentAction, deleteAdjustmentAction } from "./actions";
import FinalAccountPdfButton from "./final-account-pdf-button";

// Sprint 58 P3.1 — normalise `-0` to `0` before formatting so the
// Final Account display never shows "£–0.00" / "£-0.00" for a row
// that is mathematically zero. Perplexity live-app walkthrough issue #16.
const gbp = (n: number) => {
    const v = Object.is(n, -0) || n === 0 ? 0 : Number(n);
    return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_STYLES: Record<string, string> = {
    Draft:    "border-slate-600 bg-slate-700/30 text-slate-300",
    Agreed:   "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    Disputed: "border-red-500/40 bg-red-500/10 text-red-400",
    Signed:   "border-blue-500/40 bg-blue-500/10 text-blue-400",
};

interface Props {
    projectId: string;
    project: any;
    profile: any;
    originalContractSum: number;
    variations: any[];
    invoices: any[];
    finalAccount: any;
    adjustments: any[];
}

export default function FinalAccountClient({
    projectId, project, profile, originalContractSum, variations, invoices, finalAccount, adjustments,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Adjustment dialog
    const [showAdj, setShowAdj]   = useState(false);
    const [adjDesc, setAdjDesc]   = useState("");
    const [adjType, setAdjType]   = useState<"Addition" | "Deduction">("Addition");
    const [adjAmt, setAdjAmt]     = useState("");
    const [adjNotes, setAdjNotes] = useState("");

    // Status dialog
    const [showStatus, setShowStatus] = useState(false);
    const [newStatus, setNewStatus]   = useState(finalAccount?.status ?? "Draft");
    const [agreedAmt, setAgreedAmt]   = useState(String(finalAccount?.agreed_amount ?? ""));
    const [agreedDate, setAgreedDate] = useState(finalAccount?.agreed_date ?? "");
    const [agreedRef, setAgreedRef]   = useState(finalAccount?.agreement_reference ?? "");
    const [signedDate, setSignedDate] = useState(finalAccount?.signed_date ?? "");
    const [disputeAmt, setDisputeAmt] = useState(String(finalAccount?.disputed_amount ?? ""));
    const [disputeNotes, setDisputeNotes] = useState(finalAccount?.dispute_notes ?? "");
    const [faStatus, setFaStatus] = useState(finalAccount?.status ?? "Draft");
    const [faNotes, setFaNotes]   = useState(finalAccount?.notes ?? "");
    const [showNotes, setShowNotes] = useState(false);

    const act = (fn: () => Promise<void>) =>
        startTransition(async () => { try { await fn(); router.refresh(); } catch (e: any) { toast.error(e.message); } });

    // ── Financial calculations ──────────────────────────────────────────────
    const approvedVars   = variations.filter(v => v.status === "Approved");
    const variationsTotal = approvedVars.reduce((s, v) => s + Number(v.amount), 0);
    const additionsTotal  = adjustments.filter(a => a.type === "Addition").reduce((s, a) => s + Number(a.amount), 0);
    const deductionsTotal = adjustments.filter(a => a.type === "Deduction").reduce((s, a) => s + Number(a.amount), 0);
    const adjustedContractSum = originalContractSum + variationsTotal + additionsTotal - deductionsTotal;

    const normalInvoices   = invoices.filter(i => !i.is_retention_release);
    const retRelInvoices   = invoices.filter(i => i.is_retention_release);
    const totalCertified   = normalInvoices.reduce((s, i) => s + (i.net_due || i.amount || 0), 0);
    const totalPaid        = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (i.net_due || i.amount || 0), 0);
    const totalRetHeld     = normalInvoices.reduce((s, i) => s + (i.retention_held || 0), 0);
    const totalRetReleased = retRelInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + i.amount, 0);
    const retOutstanding   = totalRetHeld - totalRetReleased;
    const balanceDue       = adjustedContractSum - totalCertified + retOutstanding;
    const finalBalance     = finalAccount?.agreed_amount != null
        ? finalAccount.agreed_amount - totalPaid
        : balanceDue - (totalPaid - totalCertified);

    const currentStatus = faStatus;

    const handleSaveStatus = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await upsertFinalAccountAction(projectId, {
                status:              newStatus,
                agreed_amount:       newStatus === "Agreed" || newStatus === "Signed" ? (parseFloat(agreedAmt) || null) : null,
                agreed_date:         agreedDate || undefined,
                signed_date:         signedDate || undefined,
                agreement_reference: agreedRef || undefined,
                disputed_amount:     newStatus === "Disputed" ? (parseFloat(disputeAmt) || 0) : 0,
                dispute_notes:       newStatus === "Disputed" ? disputeNotes : undefined,
            });
            setFaStatus(newStatus);
            toast.success("Final account updated");
            setShowStatus(false);
        });
    };

    const handleSaveNotes = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await upsertFinalAccountAction(projectId, { notes: faNotes });
            toast.success("Notes saved");
            setShowNotes(false);
        });
    };

    const handleAddAdj = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createAdjustmentAction({
                project_id:  projectId,
                description: adjDesc,
                type:        adjType,
                amount:      parseFloat(adjAmt) || 0,
                notes:       adjNotes || undefined,
                order_index: adjustments.length,
            });
            toast.success("Adjustment added");
            setShowAdj(false);
            setAdjDesc(""); setAdjType("Addition"); setAdjAmt(""); setAdjNotes("");
        });
    };

    // ── Summary rows ──────────────────────────────────────────────────────
    const rows: { label: string; value: number; indent?: boolean; bold?: boolean; separator?: boolean; colour?: string; deduction?: boolean }[] = [
        { label: "Original Contract Sum",    value: originalContractSum,  bold: true },
        { label: "Approved Variations",      value: variationsTotal,      indent: true, colour: variationsTotal >= 0 ? "text-emerald-400" : "text-red-400" },
        ...adjustments.map(a => ({
            label:  a.description,
            value:  a.type === "Addition" ? a.amount : -a.amount,
            indent: true,
            colour: a.type === "Addition" ? "text-emerald-400" : "text-red-400",
        })),
        { label: "Adjusted Contract Sum",    value: adjustedContractSum,  bold: true, separator: true },
        // Pass the positive magnitude here and let the renderer decide
        // how to display it — a zero row shows "£0.00" (not "£–0.00"),
        // a non-zero row shows "(£1,250.00)" with parentheses to
        // indicate a deduction, per UK accounting convention.
        { label: "Less: Total Certified",    value: totalCertified,       indent: true, deduction: true },
        { label: "Add: Retention Outstanding", value: retOutstanding,     indent: true, colour: retOutstanding > 0 ? "text-amber-400" : "text-slate-400" },
        { label: "Balance of Account",       value: balanceDue,           bold: true, separator: true, colour: balanceDue > 0 ? "text-white" : "text-slate-400" },
    ];

    return (
        <div className="space-y-5">
            {/* ── Status & Action Strip ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Account Status</p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_STYLES[currentStatus] ?? STATUS_STYLES.Draft}`}>
                            {currentStatus === "Signed"   && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                            {currentStatus === "Disputed" && <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                            {currentStatus}
                        </span>
                    </div>
                    {finalAccount?.agreement_reference && (
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Agreement Ref</p>
                            <p className="text-sm text-slate-300">{finalAccount.agreement_reference}</p>
                        </div>
                    )}
                    {finalAccount?.agreed_date && (
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Agreed Date</p>
                            <p className="text-sm text-slate-300">{new Date(finalAccount.agreed_date + "T00:00:00").toLocaleDateString("en-GB")}</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <FinalAccountPdfButton
                        project={project}
                        profile={profile}
                        originalContractSum={originalContractSum}
                        variations={approvedVars}
                        adjustments={adjustments}
                        invoices={invoices}
                        adjustedContractSum={adjustedContractSum}
                        totalCertified={totalCertified}
                        totalPaid={totalPaid}
                        retOutstanding={retOutstanding}
                        balanceDue={balanceDue}
                        finalAccount={finalAccount}
                    />
                    <button
                        onClick={() => { setNewStatus(faStatus); setShowNotes(true); }}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 hover:text-white transition-colors"
                    >
                        <PenLine className="w-4 h-4" />
                        Notes
                    </button>
                    <button
                        onClick={() => setShowStatus(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors"
                    >
                        <FileSignature className="w-4 h-4" />
                        Update Status
                    </button>
                </div>
            </div>

            {/* ── KPI Strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Adjusted Contract Sum",  value: gbp(adjustedContractSum), colour: "text-white" },
                    { label: "Total Certified",         value: gbp(totalCertified),      colour: "text-blue-400" },
                    { label: "Retention Outstanding",   value: gbp(retOutstanding),      colour: retOutstanding > 0 ? "text-amber-400" : "text-slate-400" },
                    { label: "Balance of Account",      value: gbp(Math.abs(balanceDue)), colour: balanceDue > 0 ? "text-emerald-400" : balanceDue < 0 ? "text-red-400" : "text-slate-400" },
                ].map(k => (
                    <div key={k.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.colour}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Disputed amount callout ── */}
            {currentStatus === "Disputed" && (finalAccount?.disputed_amount ?? 0) > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-300">Disputed Amount: {gbp(finalAccount.disputed_amount)}</p>
                        {finalAccount.dispute_notes && <p className="text-xs text-red-400/80 mt-1">{finalAccount.dispute_notes}</p>}
                    </div>
                </div>
            )}

            {/* ── Main Statement ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Final Account Statement</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Contract value, adjustments and certification</p>
                    </div>
                    <button
                        onClick={() => setShowAdj(true)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-slate-600 text-slate-300 rounded-lg text-xs font-semibold hover:border-slate-500 hover:text-white transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Adjustment
                    </button>
                </div>

                <div className="divide-y divide-slate-700/30">
                    {rows.map((row, i) => (
                        <div key={i} className={`flex items-center justify-between px-5 py-3 ${row.separator ? "bg-slate-900/30" : ""}`}>
                            <span className={`text-sm ${row.indent ? "pl-4 text-slate-400" : ""} ${row.bold ? "font-semibold text-slate-200" : "text-slate-400"}`}>
                                {row.label}
                            </span>
                            <span className={`font-mono text-sm font-semibold ${row.colour ?? (row.bold ? "text-slate-100" : "text-slate-300")}`}>
                                {row.deduction
                                    ? (row.value > 0
                                        ? `(${gbp(row.value)})`
                                        : gbp(0))
                                    : (row.value < 0
                                        ? `(${gbp(Math.abs(row.value))})`
                                        : gbp(row.value))}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Custom adjustments with delete */}
                {adjustments.length > 0 && (
                    <div className="border-t border-slate-700/50 px-5 py-3 space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Custom Adjustments</p>
                        {adjustments.map(a => (
                            <div key={a.id} className="group flex items-center justify-between py-1">
                                <div className="flex items-center gap-3">
                                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${a.type === "Addition" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                                        {a.type === "Addition" ? "+" : "−"}
                                    </span>
                                    <div>
                                        <p className="text-xs text-slate-300">{a.description}</p>
                                        {a.notes && <p className="text-[10px] text-slate-500">{a.notes}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`font-mono text-sm font-semibold ${a.type === "Addition" ? "text-emerald-400" : "text-red-400"}`}>
                                        {a.type === "Addition" ? "" : "("}{gbp(a.amount)}{a.type === "Deduction" ? ")" : ""}
                                    </span>
                                    <button
                                        onClick={() => { if (confirm("Remove adjustment?")) act(async () => { await deleteAdjustmentAction(a.id, projectId); toast.success("Removed"); }); }}
                                        className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Balance footer */}
                <div className="border-t-2 border-slate-600/50 px-5 py-5 bg-slate-900/40">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-300">Final Balance Due to Contractor</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {currentStatus === "Agreed" || currentStatus === "Signed"
                                    ? `Agreed by ${finalAccount?.agreement_reference ?? "client"}`
                                    : "Based on certified amounts — subject to agreement"
                                }
                            </p>
                        </div>
                        <p className={`text-3xl font-bold ${balanceDue > 0 ? "text-emerald-400" : balanceDue < 0 ? "text-red-400" : "text-slate-400"}`}>
                            {balanceDue < 0 ? "(" : ""}{gbp(Math.abs(balanceDue))}{balanceDue < 0 ? ")" : ""}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Approved Variations breakdown ── */}
            {approvedVars.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700/50">
                        <h2 className="text-sm font-semibold text-white">Approved Variations Schedule</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{approvedVars.length} variations incorporated into the Final Account</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                {["Ref", "Description", "Type", "Approved", "Value"].map(h => (
                                    <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "Value" ? "text-right" : "text-left"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {approvedVars.map((v, i) => (
                                <tr key={v.id} className={`border-b border-slate-700/30 ${i === approvedVars.length - 1 ? "border-0" : ""}`}>
                                    <td className="px-4 py-3 text-xs font-mono text-purple-400">{v.variation_number ?? "—"}</td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs font-semibold text-slate-200">{v.title}</p>
                                        {v.approval_reference && <p className="text-[10px] text-slate-500">Ref: {v.approval_reference}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{v.instruction_type ?? "Client Instruction"}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">
                                        {v.approval_date ? new Date(v.approval_date + "T00:00:00").toLocaleDateString("en-GB") : "—"}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono font-semibold text-sm ${Number(v.amount) < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                        {Number(v.amount) < 0 ? `(${gbp(Math.abs(Number(v.amount)))})` : gbp(Number(v.amount))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-700/50 bg-slate-900/30">
                                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-400">Total Approved Variations</td>
                                <td className={`px-4 py-3 text-right font-mono font-bold text-sm ${variationsTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {variationsTotal < 0 ? `(${gbp(Math.abs(variationsTotal))})` : gbp(variationsTotal)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* ── Certification history ── */}
            {invoices.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700/50">
                        <h2 className="text-sm font-semibold text-white">Certification History</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Applications for payment and payments received</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                {["Ref", "Date", "Gross Valuation", "Retention", "Net Certified", "Status"].map(h => (
                                    <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${["Gross Valuation", "Retention", "Net Certified"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((inv, i) => (
                                <tr key={inv.id} className={`border-b border-slate-700/30 ${i === invoices.length - 1 ? "border-0" : ""}`}>
                                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{inv.invoice_number}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(inv.created_at).toLocaleDateString("en-GB")}</td>
                                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-300">{inv.is_retention_release ? "—" : gbp(inv.gross_valuation || 0)}</td>
                                    <td className="px-4 py-3 text-right text-xs font-mono text-amber-400/80">{inv.is_retention_release ? "Release" : gbp(inv.retention_held || 0)}</td>
                                    <td className="px-4 py-3 text-right font-mono font-semibold text-sm text-slate-100">{gbp(inv.net_due || inv.amount)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${inv.status === "Paid" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : inv.status === "Sent" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-slate-700/30 border-slate-600/30 text-slate-400"}`}>{inv.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-700/50 bg-slate-900/30">
                                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-400">Total Certified / Total Paid</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-sm text-slate-100">
                                    {gbp(totalCertified)} / <span className="text-emerald-400">{gbp(totalPaid)}</span>
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* ── Internal Notes ── */}
            {finalAccount?.notes && (
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Internal Notes</p>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{finalAccount.notes}</p>
                </div>
            )}

            {/* ── ADD ADJUSTMENT DIALOG ── */}
            <Dialog open={showAdj} onOpenChange={setShowAdj}>
                <DialogContent className="sm:max-w-[420px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Add Adjustment</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddAdj} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Description</Label>
                            <Input value={adjDesc} onChange={e => setAdjDesc(e.target.value)} required placeholder="e.g. Provisional Sum — Landscaping" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Type</Label>
                                <Select value={adjType} onValueChange={(v: any) => setAdjType(v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="Addition"  className="text-emerald-400 text-xs">+ Addition</SelectItem>
                                        <SelectItem value="Deduction" className="text-red-400 text-xs">− Deduction</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Amount (£)</Label>
                                <Input type="number" step="0.01" value={adjAmt} onChange={e => setAdjAmt(e.target.value)} required placeholder="0.00" className="bg-slate-800 border-slate-700 text-white font-mono placeholder:text-slate-500" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Notes (optional)</Label>
                            <Input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} placeholder="Reason for adjustment..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Adjustment"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── UPDATE STATUS DIALOG ── */}
            <Dialog open={showStatus} onOpenChange={setShowStatus}>
                <DialogContent className="sm:max-w-[440px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Update Final Account Status</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveStatus} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Status</Label>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    {["Draft", "Agreed", "Disputed", "Signed"].map(s => (
                                        <SelectItem key={s} value={s} className="text-slate-200 text-xs">{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {(newStatus === "Agreed" || newStatus === "Signed") && (<>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-400">Agreed Amount (£)</Label>
                                    <Input type="number" step="0.01" value={agreedAmt} onChange={e => setAgreedAmt(e.target.value)} placeholder={String(adjustedContractSum.toFixed(2))} className="bg-slate-800 border-slate-700 text-white font-mono" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-400">Agreed Date</Label>
                                    <Input type="date" value={agreedDate} onChange={e => setAgreedDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Agreement Reference</Label>
                                <Input value={agreedRef} onChange={e => setAgreedRef(e.target.value)} placeholder="e.g. Email ref, letter ref" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                            </div>
                            {newStatus === "Signed" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-400">Date Signed</Label>
                                    <Input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            )}
                        </>)}

                        {newStatus === "Disputed" && (<>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Disputed Amount (£)</Label>
                                <Input type="number" step="0.01" value={disputeAmt} onChange={e => setDisputeAmt(e.target.value)} placeholder="0.00" className="bg-slate-800 border-slate-700 text-white font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Dispute Notes</Label>
                                <Textarea value={disputeNotes} onChange={e => setDisputeNotes(e.target.value)} rows={3} placeholder="Describe the disputed items..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                            </div>
                        </>)}

                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── NOTES DIALOG ── */}
            <Dialog open={showNotes} onOpenChange={setShowNotes}>
                <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Internal Notes</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveNotes} className="space-y-4 py-2">
                        <Textarea value={faNotes} onChange={e => setFaNotes(e.target.value)} rows={5} placeholder="Internal notes about this Final Account..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Notes"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
