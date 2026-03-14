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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    ReceiptText,
    Plus,
    Banknote,
    ArrowUpRight,
    Trash2,
    CheckCircle2,
    Calendar,
    Loader2,
    Calculator,
    Zap
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

export default function ClientBilling({ projectId, project, originalContractSum, approvedVariationsTotal, variations, initialInvoices }: Props) {
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // UI state
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
        if (amountType === 'percentage') {
            finalAmount = (revisedContractSum * (finalAmount / 100));
        }

        startTransition(async () => {
            try {
                await createInvoiceAction({
                    project_id: projectId,
                    invoice_number: invoiceNumber,
                    type,
                    amount: finalAmount
                });
                toast.success(`${type} Invoice Created`);
                setIsDialogOpen(false);
                setAmountValue("");
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    const handleStatusChange = (id: string, status: string) => {
        startTransition(async () => {
            try {
                await updateInvoiceStatusAction(id, status, projectId);
                toast.success(`Invoice marked as ${status}`);
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    return (
        <div className="space-y-8">
            {/* 1. FINANCIAL COMMAND SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Original Contract</div>
                    <div className="text-2xl font-black italic text-slate-900">£{originalContractSum.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    <Calculator className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-100 -rotate-12" />
                </div>
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Approved Variations</div>
                    <div className="text-2xl font-black italic text-emerald-600">+ £{approvedVariationsTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    <Zap className="absolute -bottom-2 -right-2 w-16 h-16 text-emerald-50 -rotate-12" />
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl relative overflow-hidden shadow-xl md:col-span-2 ring-4 ring-slate-900/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revised Contract Sum</div>
                            <div className="text-4xl font-black italic text-white tracking-tighter">£{revisedContractSum.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Remaining to Bill</div>
                            <div className="text-xl font-black text-blue-100">£{remainingBalance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. ACTIONS BAR */}
            <div className="flex justify-between items-center bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                        <Banknote className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Payment Valuations</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Issue interim certificates and final accounts</p>
                    </div>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 gap-2 h-11 shadow-lg shadow-blue-500/20">
                            <Plus className="w-5 h-5" />
                            Create Invoice
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black italic tracking-tighter">New Valuation</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateInvoice} className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Inv Number</Label>
                                    <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required className="bg-slate-50 border-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Inv Type</Label>
                                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                                        <SelectTrigger className="bg-slate-50 border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Interim">Interim Valuation</SelectItem>
                                            <SelectItem value="Final">Final Account</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Billing Method</Label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setAmountType('flat')}
                                        className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${amountType === 'flat' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        Flat Amount (£)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAmountType('percentage')}
                                        className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${amountType === 'percentage' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        Job Complete (%)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 p-6 bg-slate-900 rounded-2xl border border-slate-800">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    {amountType === 'flat' ? 'Amount to Bill (£)' : 'Cumulative Job Completion (%)'}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={amountValue}
                                    onChange={e => setAmountValue(e.target.value)}
                                    placeholder={amountType === 'flat' ? '0.00' : '50'}
                                    required
                                    className="h-14 bg-white/5 border-white/10 text-white text-3xl font-black italic text-center outline-none ring-0 focus-visible:ring-blue-500"
                                />
                                <div className="text-[9px] text-center text-slate-500 font-bold uppercase mt-2">
                                    Available to bill: £{remainingBalance.toLocaleString()}
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={isPending} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg">
                                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate & Post Valuation"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* 3. INVOICE HISTORY TABLE */}
            <div className="rounded-3xl border border-slate-200 shadow-2xl bg-white overflow-hidden transition-all duration-300">
                <Table>
                    <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 pl-8">Invoice</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6">Type</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-right">Amount</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-center">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-6 text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialInvoices.map((inv) => (
                            <TableRow key={inv.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100 h-24">
                                <TableCell className="pl-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-200">
                                            <ReceiptText className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 uppercase tracking-tighter text-lg">{inv.invoice_number}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {new Date(inv.created_at).toLocaleDateString('en-GB')}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`font-black text-[9px] uppercase tracking-widest border-2 ${inv.type === 'Final' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-slate-200 text-slate-600'}`}>
                                        {inv.type}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="font-mono font-black text-xl text-slate-900">£{Number(inv.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Select defaultValue={inv.status} onValueChange={(val) => handleStatusChange(inv.id, val)}>
                                        <SelectTrigger className={`h-8 w-[100px] mx-auto text-[9px] font-black uppercase tracking-widest border-2 transition-all ${inv.status === 'Paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : inv.status === 'Sent' ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Draft" className="text-[10px] font-black uppercase">Draft</SelectItem>
                                            <SelectItem value="Sent" className="text-[10px] font-black uppercase text-blue-600">Sent</SelectItem>
                                            <SelectItem value="Paid" className="text-[10px] font-black uppercase text-emerald-600">Paid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <div className="flex justify-end gap-2 opacity-10 group-hover:opacity-100 transition-opacity">
                                        <InvoicePdfButton
                                            invoice={inv}
                                            project={project}
                                            originalContractSum={originalContractSum}
                                            variations={variations}
                                        />
                                         <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => {
                                            if (confirm('Delete?')) {
                                                startTransition(async () => {
                                                    try {
                                                        await deleteInvoiceAction(inv.id, projectId);
                                                        toast.success('Invoiced removed');
                                                    } catch (err) {
                                                        toast.error('Failed to delete');
                                                    }
                                                });
                                            }
                                         }}>
                                            <Trash2 className="w-4 h-4" />
                                         </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {initialInvoices.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center opacity-30 grayscale">
                                        <div className="p-6 bg-slate-100 rounded-full mb-4">
                                            <ReceiptText className="w-12 h-12 text-slate-300" />
                                        </div>
                                        <p className="font-black uppercase tracking-widest text-xs text-slate-400 italic">No Valuation History Yet</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 4. TOTALS BAR CARD */}
            <div className="bg-slate-50 border-t-2 border-slate-900 border-dashed p-8 rounded-3xl flex justify-between items-center shadow-inner">
                <div className="flex items-center gap-10">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Job Value</div>
                        <div className="text-2xl font-black text-slate-900">£{revisedContractSum.toLocaleString()}</div>
                    </div>
                    <div className="h-10 w-px bg-slate-200" />
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Invoiced</div>
                        <div className="text-2xl font-black text-blue-600">£{totalPreviouslyInvoiced.toLocaleString()}</div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Outstanding Balance</div>
                    <div className="text-4xl font-black italic text-slate-900">£{remainingBalance.toLocaleString()}</div>
                </div>
            </div>
        </div>
    );
}
