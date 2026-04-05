"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    createInvoiceAction,
    updateInvoiceStatusAction,
    deleteInvoiceAction
} from "./actions";
import { toast } from "sonner";
import {
    ReceiptText,
    Plus,
    Banknote,
    Trash2,
    Calendar,
    Loader2,
} from "lucide-react";
import InvoicePdfButton from "./invoice-pdf-button";

interface Props {
    projectId: string;
    project: any;
    originalContractSum: number;
    approvedVariationsTotal: number;
    variations: any[];
    initialInvoices: any[];
}

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

function StatusSelect({ inv, onStatusChange }: { inv: any; onStatusChange: (id: string, status: string) => void }) {
    const colours: Record<string, string> = {
        Draft: 'border-slate-600 bg-slate-700/50 text-slate-300',
        Sent:  'border-blue-500/40 bg-blue-500/10 text-blue-400',
        Paid:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
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

export default function ClientBilling({ projectId, project, originalContractSum, approvedVariationsTotal, variations, initialInvoices }: Props) {
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
    const [type, setType] = useState<'Interim' | 'Final'>('Interim');
    const [amountType, setAmountType] = useState<'flat' | 'percentage'>('flat');
    const [amountValue, setAmountValue] = useState("");

    const revisedContractSum = originalContractSum + approvedVariationsTotal;
    const totalPreviouslyInvoiced = initialInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const remainingBalance = revisedContractSum - totalPreviouslyInvoiced;

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        let finalAmount = parseFloat(amountValue) || 0;
        if (amountType === 'percentage') finalAmount = revisedContractSum * (finalAmount / 100);
        startTransition(async () => {
            try {
                await createInvoiceAction({ project_id: projectId, invoice_number: invoiceNumber, type, amount: finalAmount });
                toast.success(`${type} invoice created`);
                setIsDialogOpen(false);
                setAmountValue("");
            } catch (error: any) { toast.error(error.message); }
        });
    };

    const handleStatusChange = (id: string, status: string) => {
        startTransition(async () => {
            try {
                await updateInvoiceStatusAction(id, status, projectId);
                toast.success(`Invoice marked as ${status}`);
            } catch (error: any) { toast.error(error.message); }
        });
    };

    return (
        <div className="space-y-4">
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Original Contract</p>
                    <p className="text-xl font-bold text-slate-100">{gbp(originalContractSum)}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Approved Variations</p>
                    <p className="text-xl font-bold text-emerald-400">+{gbp(approvedVariationsTotal)}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Revised Contract Sum</p>
                    <p className="text-xl font-bold text-white">{gbp(revisedContractSum)}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Remaining to Bill</p>
                    <p className={`text-xl font-bold ${remainingBalance < 0 ? 'text-red-400' : 'text-blue-400'}`}>{gbp(remainingBalance)}</p>
                </div>
            </div>

            {/* Invoice table card */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Banknote className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Payment Valuations</h2>
                            <p className="text-xs text-slate-500">Issue interim certificates and final accounts</p>
                        </div>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors">
                                <Plus className="w-4 h-4" />
                                Create Invoice
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[420px] bg-slate-900 border-slate-700 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-white">New Payment Valuation</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateInvoice} className="space-y-4 py-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-400">Invoice Number</Label>
                                        <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required className="bg-slate-800 border-slate-700 text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-400">Invoice Type</Label>
                                        <Select value={type} onValueChange={(v: any) => setType(v)}>
                                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-800 border-slate-700">
                                                <SelectItem value="Interim" className="text-slate-200">Interim Valuation</SelectItem>
                                                <SelectItem value="Final" className="text-slate-200">Final Account</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-400">Billing Method</Label>
                                    <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-lg gap-1">
                                        {[['flat', 'Flat Amount (£)'], ['percentage', 'Job Complete (%)']].map(([val, label]) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => setAmountType(val as 'flat' | 'percentage')}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${amountType === val ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-4 bg-slate-800 rounded-xl border border-slate-700">
                                    <Label className="text-xs font-medium text-slate-400">
                                        {amountType === 'flat' ? 'Amount to Bill (£)' : 'Cumulative Job Completion (%)'}
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={amountValue}
                                        onChange={e => setAmountValue(e.target.value)}
                                        placeholder={amountType === 'flat' ? '0.00' : '50'}
                                        required
                                        className="h-12 bg-slate-900 border-slate-700 text-white text-2xl font-bold text-center"
                                    />
                                    <p className="text-xs text-center text-slate-500 mt-1">
                                        Available to bill: {gbp(remainingBalance)}
                                    </p>
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate & Post Valuation"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Invoice table */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoice</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                            <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initialInvoices.map((inv, i) => (
                            <tr key={inv.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialInvoices.length - 1 ? 'border-0' : ''}`}>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                                            <ReceiptText className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-100">{inv.invoice_number}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(inv.created_at).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${inv.type === 'Final' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                                        {inv.type}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-right font-mono font-semibold text-slate-100">
                                    {gbp(Number(inv.amount))}
                                </td>
                                <td className="px-5 py-4 text-center">
                                    <StatusSelect inv={inv} onStatusChange={handleStatusChange} />
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <InvoicePdfButton invoice={inv} project={project} originalContractSum={originalContractSum} variations={variations} />
                                        <button
                                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            onClick={() => {
                                                if (confirm('Delete this invoice?')) {
                                                    startTransition(async () => {
                                                        try {
                                                            await deleteInvoiceAction(inv.id, projectId);
                                                            toast.success('Invoice removed');
                                                        } catch { toast.error('Failed to delete'); }
                                                    });
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {initialInvoices.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-5 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                            <ReceiptText className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <p className="text-sm text-slate-500">No invoices raised yet</p>
                                        <p className="text-xs text-slate-600">Use "Create Invoice" to raise your first payment application</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Totals footer */}
                <div className="border-t border-slate-700/50 px-5 py-4 flex items-center justify-between bg-slate-900/30">
                    <div className="flex items-center gap-8">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Job Value</p>
                            <p className="text-lg font-bold text-slate-100 mt-0.5">{gbp(revisedContractSum)}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-700/50" />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Invoiced</p>
                            <p className="text-lg font-bold text-blue-400 mt-0.5">{gbp(totalPreviouslyInvoiced)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outstanding Balance</p>
                        <p className={`text-2xl font-bold mt-0.5 ${remainingBalance < 0 ? 'text-red-400' : 'text-white'}`}>{gbp(remainingBalance)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
