"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, CheckCircle2, Clock, XCircle, MinusCircle, Pencil } from "lucide-react";
import { createHandoverItemAction, updateHandoverItemAction, deleteHandoverItemAction } from "./actions";

const fmtDate = (d?: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB") : "—";

const CATEGORIES = [
    "O&M Manual",
    "Warranty",
    "As-Built Drawing",
    "Test Certificate",
    "H&S File",
    "Compliance Certificate",
    "Other",
];

const STATUSES = ["Pending", "Received", "Issued", "N/A"];

const STATUS_CONFIG: Record<string, { icon: any; style: string; label: string }> = {
    Pending:  { icon: Clock,        style: "border-amber-500/40 bg-amber-500/10 text-amber-400",   label: "Pending"  },
    Received: { icon: CheckCircle2, style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", label: "Received" },
    Issued:   { icon: CheckCircle2, style: "border-blue-500/40 bg-blue-500/10 text-blue-400",      label: "Issued"   },
    "N/A":    { icon: MinusCircle,  style: "border-slate-600/40 bg-slate-600/10 text-slate-500",   label: "N/A"      },
};

const CATEGORY_COLOURS: Record<string, string> = {
    "O&M Manual":             "text-violet-400 bg-violet-500/10",
    "Warranty":               "text-emerald-400 bg-emerald-500/10",
    "As-Built Drawing":       "text-blue-400 bg-blue-500/10",
    "Test Certificate":       "text-amber-400 bg-amber-500/10",
    "H&S File":              "text-red-400 bg-red-500/10",
    "Compliance Certificate": "text-cyan-400 bg-cyan-500/10",
    "Other":                  "text-slate-400 bg-slate-500/10",
};

interface HandoverItem {
    id: string;
    category: string;
    title: string;
    description?: string;
    status: string;
    required: boolean;
    date_received?: string | null;
    issued_to?: string;
    notes?: string;
    order_index: number;
}

interface Props {
    projectId: string;
    project: any;
    initialItems: HandoverItem[];
}

export default function HandoverClient({ projectId, project, initialItems }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [filterCat, setFilterCat]       = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");

    // Add dialog
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({
        category: "Other", title: "", description: "", required: true,
    });

    // Edit dialog
    const [showEdit, setShowEdit]     = useState(false);
    const [editTarget, setEditTarget] = useState<HandoverItem | null>(null);
    const [editForm, setEditForm]     = useState<any>({});

    // Delete
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const act = (fn: () => Promise<void>) =>
        startTransition(async () => {
            try { await fn(); router.refresh(); }
            catch (e: any) { toast.error(e.message); }
        });

    // Quick status cycle on row click (Pending → Received → Issued → N/A → Pending)
    const cycleStatus = (item: HandoverItem) => {
        const cycle = ["Pending", "Received", "Issued", "N/A"];
        const next = cycle[(cycle.indexOf(item.status) + 1) % cycle.length];
        act(async () => {
            await updateHandoverItemAction(item.id, projectId, { status: next });
        });
    };

    const openEdit = (item: HandoverItem) => {
        setEditTarget(item);
        setEditForm({
            category:      item.category,
            title:         item.title,
            description:   item.description ?? "",
            status:        item.status,
            required:      item.required,
            date_received: item.date_received ?? "",
            issued_to:     item.issued_to ?? "",
            notes:         item.notes ?? "",
        });
        setShowEdit(true);
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createHandoverItemAction({
                project_id:  projectId,
                category:    addForm.category,
                title:       addForm.title,
                description: addForm.description || undefined,
                required:    addForm.required,
                order_index: initialItems.length,
            });
            toast.success("Item added");
            setShowAdd(false);
            setAddForm({ category: "Other", title: "", description: "", required: true });
        });
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        act(async () => {
            await updateHandoverItemAction(editTarget.id, projectId, {
                category:      editForm.category,
                title:         editForm.title,
                description:   editForm.description || undefined,
                status:        editForm.status,
                required:      editForm.required,
                date_received: editForm.date_received || null,
                issued_to:     editForm.issued_to || undefined,
                notes:         editForm.notes || undefined,
            });
            toast.success("Item updated");
            setShowEdit(false);
        });
    };

    const handleDelete = () => {
        if (!deleteId) return;
        act(async () => {
            await deleteHandoverItemAction(deleteId, projectId);
            toast.success("Item removed");
            setDeleteId(null);
        });
    };

    // ── Progress ──────────────────────────────────────────────────────────────
    const required   = initialItems.filter(i => i.required);
    const complete   = required.filter(i => i.status === "Received" || i.status === "Issued" || i.status === "N/A");
    const pct        = required.length > 0 ? Math.round((complete.length / required.length) * 100) : 0;
    const allReceived = initialItems.filter(i => i.status === "Received" || i.status === "Issued").length;

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = initialItems.filter(i =>
        (filterCat    === "All" || i.category === filterCat) &&
        (filterStatus === "All" || i.status   === filterStatus)
    );

    // Group by category
    const groups = CATEGORIES.filter(cat =>
        filtered.some(i => i.category === cat)
    );

    return (
        <div className="space-y-5">
            {/* ── Progress bar ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-semibold text-white">Handover Completion</p>
                        <p className="text-xs text-slate-500 mt-0.5">{complete.length} of {required.length} required items complete</p>
                    </div>
                    <span className={`text-2xl font-bold ${pct === 100 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex items-center gap-6 mt-3 text-xs text-slate-500">
                    <span><span className="text-white font-semibold">{initialItems.length}</span> total items</span>
                    <span><span className="text-emerald-400 font-semibold">{allReceived}</span> received / issued</span>
                    <span><span className="text-amber-400 font-semibold">{initialItems.filter(i => i.status === "Pending").length}</span> pending</span>
                    <span><span className="text-slate-400 font-semibold">{initialItems.filter(i => i.status === "N/A").length}</span> N/A</span>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <Select value={filterCat} onValueChange={setFilterCat}>
                    <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-slate-300 text-sm">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Categories</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300 text-sm">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex-1" />
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Item
                </button>
            </div>

            {/* ── Tip ── */}
            <p className="text-xs text-slate-500 -mt-2">Click a status badge to cycle it: Pending → Received → Issued → N/A</p>

            {/* ── Grouped checklist ── */}
            {groups.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-sm">No items match the current filters.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map(cat => {
                        const catItems = filtered.filter(i => i.category === cat);
                        const catDone  = catItems.filter(i => i.status !== "Pending").length;
                        return (
                            <div key={cat} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                                {/* Category header */}
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-900/40 border-b border-slate-700/50">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_COLOURS[cat] ?? CATEGORY_COLOURS["Other"]}`}>
                                            {cat}
                                        </span>
                                        <span className="text-xs text-slate-500">{catItems.length} items</span>
                                    </div>
                                    <span className="text-xs text-slate-400 font-semibold">{catDone}/{catItems.length} complete</span>
                                </div>

                                {/* Items */}
                                <div className="divide-y divide-slate-700/30">
                                    {catItems.map(item => {
                                        const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["Pending"];
                                        const StatusIcon = cfg.icon;
                                        return (
                                            <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-700/10 transition-colors">
                                                {/* Status badge — clickable to cycle */}
                                                <button
                                                    onClick={() => cycleStatus(item)}
                                                    disabled={isPending}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 transition-opacity hover:opacity-80 ${cfg.style}`}
                                                    title="Click to change status"
                                                >
                                                    <StatusIcon className="w-3 h-3" />
                                                    {cfg.label}
                                                </button>

                                                {/* Title & meta */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-medium ${item.status === "Pending" ? "text-white" : "text-slate-400"}`}>
                                                            {item.title}
                                                        </p>
                                                        {item.required && (
                                                            <span className="text-[10px] text-red-400/70 font-semibold">Required</span>
                                                        )}
                                                    </div>
                                                    {item.description && (
                                                        <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                                                    )}
                                                    {(item.date_received || item.issued_to) && (
                                                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                                                            {item.date_received && <span>Received: {fmtDate(item.date_received)}</span>}
                                                            {item.issued_to && <span>Issued to: {item.issued_to}</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => openEdit(item)}
                                                        className="p-1.5 rounded-md text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteId(item.id)}
                                                        className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                        title="Remove"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Add dialog ── */}
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Handover Item</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Title *</Label>
                            <Input required value={addForm.title}
                                onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Document name" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={addForm.description}
                                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={2}
                                placeholder="Optional detail" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="required-check"
                                checked={addForm.required}
                                onChange={e => setAddForm(f => ({ ...f, required: e.target.checked }))}
                                className="w-4 h-4 accent-teal-500"
                            />
                            <label htmlFor="required-check" className="text-sm text-slate-300">Required for handover</label>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setShowAdd(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 disabled:opacity-50 transition-colors">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Add Item
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Edit dialog ── */}
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Category</Label>
                                <Select value={editForm.category ?? "Other"} onValueChange={v => setEditForm((f: any) => ({ ...f, category: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select value={editForm.status ?? "Pending"} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Title *</Label>
                            <Input required value={editForm.title ?? ""}
                                onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={editForm.description ?? ""}
                                onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Date Received</Label>
                                <Input type="date" value={editForm.date_received ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, date_received: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Issued To</Label>
                                <Input value={editForm.issued_to ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, issued_to: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    placeholder="Client name or contact" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea value={editForm.notes ?? ""}
                                onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={2} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="edit-required" checked={editForm.required ?? true}
                                onChange={e => setEditForm((f: any) => ({ ...f, required: e.target.checked }))}
                                className="w-4 h-4 accent-teal-500" />
                            <label htmlFor="edit-required" className="text-sm text-slate-300">Required for handover</label>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setShowEdit(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 disabled:opacity-50 transition-colors">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Save
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Delete confirm ── */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
                    <DialogHeader><DialogTitle>Remove Item?</DialogTitle></DialogHeader>
                    <p className="text-slate-400 text-sm pt-1">This cannot be undone.</p>
                    <DialogFooter className="pt-2">
                        <button onClick={() => setDeleteId(null)}
                            className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleDelete} disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Remove
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
