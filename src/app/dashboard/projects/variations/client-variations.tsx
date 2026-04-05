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
import { Textarea } from "@/components/ui/textarea";
import {
    createVariationAction,
    updateVariationStatusAction,
    deleteVariationAction
} from "./actions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    CheckCircle2,
    Clock,
    Trash2,
    Loader2,
    GitBranch
} from "lucide-react";

interface Props {
    projectId: string;
    initialVariations: any[];
}

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        'Draft':            'bg-slate-500/15 text-slate-400 border-slate-500/20',
        'Pending Approval': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
        'Approved':         'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        'Rejected':         'bg-red-500/15 text-red-400 border-red-500/20',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
            {status}
        </span>
    );
}

export default function ClientVariations({ projectId, initialVariations }: Props) {
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");

    const totalApproved = initialVariations
        .filter(v => v.status === 'Approved')
        .reduce((sum, v) => sum + Number(v.amount), 0);

    const handleLogVariation = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            try {
                await createVariationAction({ project_id: projectId, title, description, amount: parseFloat(amount) || 0 });
                toast.success("Variation logged");
                setIsDialogOpen(false);
                setTitle(""); setDescription(""); setAmount("");
            } catch (error: any) { toast.error(error.message); }
        });
    };

    const handleStatusChange = (id: string, status: string) => {
        startTransition(async () => {
            try {
                await updateVariationStatusAction(id, status, projectId);
                toast.success(`Variation ${status}`);
            } catch (error: any) { toast.error(error.message); }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Delete this variation?")) return;
        startTransition(async () => {
            try {
                await deleteVariationAction(id, projectId);
                toast.success("Variation deleted");
            } catch (error: any) { toast.error(error.message); }
        });
    };

    return (
        <div className="space-y-4">
            {/* Summary KPI */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Logged</p>
                    <p className="text-2xl font-bold text-slate-100 mt-1">{initialVariations.length}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Approved</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {initialVariations.filter(v => v.status === 'Approved').length}
                    </p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Approved Value</p>
                    <p className="text-2xl font-bold text-white mt-1">{gbp(totalApproved)}</p>
                </div>
            </div>

            {/* Variations log card */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <GitBranch className="h-4 w-4 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Variations Log</h2>
                            <p className="text-xs text-slate-500">Log and track all scope changes</p>
                        </div>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors">
                                <Plus className="w-4 h-4" />
                                Log New Variation
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-white">Record Scope Change</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleLogVariation} className="space-y-4 py-2">
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
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-400">Description</Label>
                                    <Textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Detailed reason for change..."
                                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-400">Value (£)</Label>
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
                                    <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Variation"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Variation</th>
                            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initialVariations.map((v, i) => (
                            <tr key={v.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialVariations.length - 1 ? 'border-0' : ''}`}>
                                <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                                    {new Date(v.created_at).toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-5 py-4">
                                    <div className="font-semibold text-slate-100">{v.title}</div>
                                    {v.description && <div className="text-xs text-slate-500 mt-0.5">{v.description}</div>}
                                </td>
                                <td className="px-5 py-4">
                                    <StatusBadge status={v.status} />
                                </td>
                                <td className="px-5 py-4 text-right font-mono font-semibold text-slate-100">
                                    {gbp(Number(v.amount))}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {v.status !== 'Approved' && (
                                            <button
                                                onClick={() => handleStatusChange(v.id, 'Approved')}
                                                className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                                title="Approve"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(v.id)}
                                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {initialVariations.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-5 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                            <GitBranch className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <p className="text-sm text-slate-500">No variations logged for this project</p>
                                        <p className="text-xs text-slate-600">Use "Log New Variation" to record scope changes</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
