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
    Plus,
    Hammer,
    CheckCircle2,
    XCircle,
    Clock,
    Trash2,
    Loader2
} from "lucide-react";

interface Props {
    projectId: string;
    initialVariations: any[];
}

export default function ClientVariations({ projectId, initialVariations }: Props) {
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");

    const handleLogVariation = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            try {
                await createVariationAction({
                    project_id: projectId,
                    title,
                    description,
                    amount: parseFloat(amount) || 0
                });
                toast.success("Variation logged!");
                setIsDialogOpen(false);
                setTitle("");
                setDescription("");
                setAmount("");
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    const handleStatusChange = (id: string, status: string) => {
        startTransition(async () => {
            try {
                await updateVariationStatusAction(id, status, projectId);
                toast.success(`Variation ${status}`);
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Delete this variation?")) return;
        startTransition(async () => {
            try {
                await deleteVariationAction(id, projectId);
                toast.success("Variation deleted");
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Draft': return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">DRAFT</Badge>;
            case 'Pending Approval': return <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50">PENDING</Badge>;
            case 'Approved': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">APPROVED</Badge>;
            case 'Rejected': return <Badge variant="destructive">REJECTED</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Hammer className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Variations Log</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Manage additions & credits</p>
                    </div>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-900 text-white hover:bg-slate-800 font-black gap-2">
                            <Plus className="w-4 h-4" />
                            Log New Variation
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black italic">Record Scope Change</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleLogVariation} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Variation Title</Label>
                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Extra sockets in Kitchen" required className="bg-slate-50 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Description</Label>
                                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed reason for change..." className="bg-slate-50 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Value (£)</Label>
                                <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className="bg-slate-50 border-slate-200 font-mono font-bold" />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Variation"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-2xl border border-slate-200 shadow-xl bg-white overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Variation Description</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialVariations.map((v) => (
                            <TableRow key={v.id} className="group transition-colors border-slate-100">
                                <TableCell className="text-xs font-bold text-slate-400">
                                    {new Date(v.created_at).toLocaleDateString('en-GB')}
                                </TableCell>
                                <TableCell>
                                    <div className="font-black text-slate-900 uppercase tracking-tight">{v.title}</div>
                                    <div className="text-[10px] text-slate-500 leading-none mt-1">{v.description || "No description provided."}</div>
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(v.status)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-black text-slate-900">
                                    £{v.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end items-center gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                                        {v.status !== 'Approved' && (
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50" onClick={() => handleStatusChange(v.id, 'Approved')}>
                                                <CheckCircle2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:bg-slate-100" onClick={() => handleDelete(v.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {initialVariations.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic text-sm">
                                    No variations logged for this project.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-2xl">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Approved Variations</h3>
                    <div className="text-3xl font-black italic">
                        £{initialVariations
                            .filter(v => v.status === 'Approved')
                            .reduce((sum, v) => sum + v.amount, 0)
                            .toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="p-3 bg-white/10 rounded-xl border border-white/5">
                    <Clock className="w-8 h-8 text-slate-400" />
                </div>
            </div>
        </div>
    );
}
