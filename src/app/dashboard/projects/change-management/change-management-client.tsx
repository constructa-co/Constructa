"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { createChangeEventAction, updateChangeEventAction, deleteChangeEventAction } from "./actions";

const gbp = (n: number | null | undefined) =>
    n == null ? "—" : `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB") : "—";

const TYPES = [
    "Compensation Event",
    "Extension of Time",
    "Contract Notice",
    "Loss & Expense",
    "Provisional Sum Instruction",
    "Variation Order",
    "Early Warning",
    "Other",
];

const ISSUED_BY = ["Us", "Client", "Architect", "Engineer", "Project Manager", "Other"];

const STATUSES = ["Draft", "Notified", "Submitted", "Assessed", "Agreed", "Rejected", "Withdrawn"];

const STATUS_STYLES: Record<string, string> = {
    Draft:     "border-slate-600 bg-slate-700/30 text-slate-300",
    Notified:  "border-amber-500/40 bg-amber-500/10 text-amber-400",
    Submitted: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    Assessed:  "border-violet-500/40 bg-violet-500/10 text-violet-400",
    Agreed:    "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    Rejected:  "border-red-500/40 bg-red-500/10 text-red-400",
    Withdrawn: "border-slate-600/40 bg-slate-600/10 text-slate-500",
};

const TYPE_STYLES: Record<string, string> = {
    "Compensation Event":       "text-violet-400 bg-violet-500/10",
    "Extension of Time":        "text-blue-400 bg-blue-500/10",
    "Contract Notice":          "text-amber-400 bg-amber-500/10",
    "Loss & Expense":           "text-red-400 bg-red-500/10",
    "Provisional Sum Instruction": "text-cyan-400 bg-cyan-500/10",
    "Variation Order":          "text-emerald-400 bg-emerald-500/10",
    "Early Warning":            "text-orange-400 bg-orange-500/10",
    "Other":                    "text-slate-400 bg-slate-500/10",
};

interface ChangeEvent {
    id: string;
    reference: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    issued_by: string;
    clause_reference?: string;
    value_claimed: number;
    value_agreed?: number | null;
    time_claimed_days: number;
    time_agreed_days?: number | null;
    date_notified?: string | null;
    date_submitted?: string | null;
    date_assessed?: string | null;
    date_agreed?: string | null;
    notes?: string;
    created_at: string;
}

interface Props {
    projectId: string;
    project: any;
    initialEvents: ChangeEvent[];
}

const BLANK = {
    title: "", description: "", type: "Compensation Event", issued_by: "Us",
    clause_reference: "", value_claimed: "", time_claimed_days: "",
    date_notified: "", notes: "",
};

export default function ChangeManagementClient({ projectId, project, initialEvents }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [events, setEvents] = useState<ChangeEvent[]>(initialEvents);
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterType, setFilterType]     = useState("All");
    const [expandedId, setExpandedId]     = useState<string | null>(null);

    // Create dialog
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ ...BLANK });

    // Edit/status dialog
    const [showEdit, setShowEdit]     = useState(false);
    const [editTarget, setEditTarget] = useState<ChangeEvent | null>(null);
    const [editForm, setEditForm]     = useState<any>({});

    // Delete confirm
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const act = (fn: () => Promise<void>) =>
        startTransition(async () => {
            try { await fn(); router.refresh(); }
            catch (e: any) { toast.error(e.message); }
        });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createChangeEventAction({
                project_id:        projectId,
                title:             form.title,
                description:       form.description || undefined,
                type:              form.type,
                issued_by:         form.issued_by,
                clause_reference:  form.clause_reference || undefined,
                value_claimed:     parseFloat(form.value_claimed) || 0,
                time_claimed_days: parseInt(form.time_claimed_days) || 0,
                date_notified:     form.date_notified || undefined,
                notes:             form.notes || undefined,
            });
            toast.success("Change event created");
            setShowCreate(false);
            setForm({ ...BLANK });
        });
    };

    const openEdit = (ev: ChangeEvent) => {
        setEditTarget(ev);
        setEditForm({
            title:             ev.title,
            description:       ev.description ?? "",
            type:              ev.type,
            status:            ev.status,
            issued_by:         ev.issued_by,
            clause_reference:  ev.clause_reference ?? "",
            value_claimed:     String(ev.value_claimed),
            value_agreed:      ev.value_agreed != null ? String(ev.value_agreed) : "",
            time_claimed_days: String(ev.time_claimed_days),
            time_agreed_days:  ev.time_agreed_days != null ? String(ev.time_agreed_days) : "",
            date_notified:     ev.date_notified ?? "",
            date_submitted:    ev.date_submitted ?? "",
            date_assessed:     ev.date_assessed ?? "",
            date_agreed:       ev.date_agreed ?? "",
            notes:             ev.notes ?? "",
        });
        setShowEdit(true);
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        act(async () => {
            await updateChangeEventAction(editTarget.id, projectId, {
                title:             editForm.title,
                description:       editForm.description || undefined,
                type:              editForm.type,
                status:            editForm.status,
                issued_by:         editForm.issued_by,
                clause_reference:  editForm.clause_reference || undefined,
                value_claimed:     parseFloat(editForm.value_claimed) || 0,
                value_agreed:      editForm.value_agreed !== "" ? parseFloat(editForm.value_agreed) : null,
                time_claimed_days: parseInt(editForm.time_claimed_days) || 0,
                time_agreed_days:  editForm.time_agreed_days !== "" ? parseInt(editForm.time_agreed_days) : null,
                date_notified:     editForm.date_notified || undefined,
                date_submitted:    editForm.date_submitted || undefined,
                date_assessed:     editForm.date_assessed || undefined,
                date_agreed:       editForm.date_agreed || undefined,
                notes:             editForm.notes || undefined,
            });
            toast.success("Change event updated");
            setShowEdit(false);
            setEditTarget(null);
        });
    };

    const handleDelete = () => {
        if (!deleteId) return;
        act(async () => {
            await deleteChangeEventAction(deleteId, projectId);
            toast.success("Change event deleted");
            setDeleteId(null);
        });
    };

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const open      = events.filter(e => !["Agreed","Rejected","Withdrawn"].includes(e.status));
    const agreed    = events.filter(e => e.status === "Agreed");
    const totalClaimed = events.reduce((s, e) => s + (e.value_claimed || 0), 0);
    const totalAgreed  = agreed.reduce((s, e) => s + (e.value_agreed || 0), 0);
    const totalTimeClaimed = events.reduce((s, e) => s + (e.time_claimed_days || 0), 0);
    const totalTimeAgreed  = agreed.reduce((s, e) => s + (e.time_agreed_days || 0), 0);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = events.filter(e =>
        (filterStatus === "All" || e.status === filterStatus) &&
        (filterType   === "All" || e.type   === filterType)
    );

    return (
        <div className="space-y-5">
            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Events",     value: String(events.length),       sub: `${open.length} open` },
                    { label: "Total Claimed",    value: gbp(totalClaimed),           sub: `${events.length} events` },
                    { label: "Agreed Value",     value: gbp(totalAgreed),            sub: `${agreed.length} agreed`, colour: "text-emerald-400" },
                    { label: "Time Impact",      value: `${totalTimeClaimed}d`,      sub: totalTimeAgreed ? `${totalTimeAgreed}d agreed` : "claimed", colour: "text-amber-400" },
                ].map(({ label, value, sub, colour }) => (
                    <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
                        <p className={`text-2xl font-bold text-white ${colour ?? ""}`}>{value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-300 text-sm">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-52 bg-slate-800 border-slate-700 text-slate-300 text-sm">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Types</SelectItem>
                        {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex-1" />
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Change Event
                </button>
            </div>

            {/* ── Events list ── */}
            {filtered.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-sm">No change events yet.</p>
                    <p className="text-slate-500 text-xs mt-1">Log compensation events, EOT claims, and contract notices here.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(ev => {
                        const isExpanded = expandedId === ev.id;
                        return (
                            <div key={ev.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                                {/* Row header */}
                                <div
                                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                                >
                                    <div className="w-20 flex-shrink-0">
                                        <span className="text-xs font-mono font-bold text-violet-400">{ev.reference}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{ev.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${TYPE_STYLES[ev.type] ?? TYPE_STYLES["Other"]}`}>
                                                {ev.type}
                                            </span>
                                            <span className="text-[11px] text-slate-500">Issued by: {ev.issued_by}</span>
                                            {ev.clause_reference && (
                                                <span className="text-[11px] text-slate-600">Cl. {ev.clause_reference}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right flex-shrink-0 hidden sm:block">
                                        <p className="text-sm font-semibold text-white">{gbp(ev.value_claimed)}</p>
                                        {ev.value_agreed != null && (
                                            <p className="text-xs text-emerald-400">Agreed: {gbp(ev.value_agreed)}</p>
                                        )}
                                    </div>

                                    {ev.time_claimed_days > 0 && (
                                        <div className="text-right flex-shrink-0 hidden md:block w-16">
                                            <p className="text-sm font-semibold text-amber-400">{ev.time_claimed_days}d</p>
                                            <p className="text-[11px] text-slate-500">time</p>
                                        </div>
                                    )}

                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${STATUS_STYLES[ev.status] ?? STATUS_STYLES["Draft"]}`}>
                                        {ev.status}
                                    </span>

                                    {isExpanded
                                        ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                        : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                    }
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="border-t border-slate-700/50 px-5 py-4 space-y-4">
                                        {ev.description && (
                                            <p className="text-sm text-slate-300 leading-relaxed">{ev.description}</p>
                                        )}

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            {[
                                                { label: "Date Notified",  value: fmtDate(ev.date_notified) },
                                                { label: "Date Submitted", value: fmtDate(ev.date_submitted) },
                                                { label: "Date Assessed",  value: fmtDate(ev.date_assessed) },
                                                { label: "Date Agreed",    value: fmtDate(ev.date_agreed) },
                                            ].map(({ label, value }) => (
                                                <div key={label}>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
                                                    <p className="text-slate-300">{value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Value Claimed</p>
                                                <p className="text-white font-semibold">{gbp(ev.value_claimed)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Value Agreed</p>
                                                <p className={ev.value_agreed != null ? "text-emerald-400 font-semibold" : "text-slate-500"}>{gbp(ev.value_agreed)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Time Claimed</p>
                                                <p className="text-amber-400 font-semibold">{ev.time_claimed_days > 0 ? `${ev.time_claimed_days} days` : "—"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Time Agreed</p>
                                                <p className={ev.time_agreed_days != null ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                                                    {ev.time_agreed_days != null ? `${ev.time_agreed_days} days` : "—"}
                                                </p>
                                            </div>
                                        </div>

                                        {ev.notes && (
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Notes</p>
                                                <p className="text-xs text-slate-400 leading-relaxed">{ev.notes}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                onClick={() => openEdit(ev)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-600 text-slate-300 rounded-lg text-xs font-semibold hover:border-violet-500 hover:text-violet-300 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => setDeleteId(ev.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 text-slate-500 rounded-lg text-xs font-semibold hover:border-red-500/50 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Create dialog ── */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Change Event</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Title *</Label>
                            <Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white" placeholder="Brief description of the change" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Issued By</Label>
                                <Select value={form.issued_by} onValueChange={v => setForm(f => ({ ...f, issued_by: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ISSUED_BY.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Value Claimed (£)</Label>
                                <Input type="number" step="0.01" value={form.value_claimed}
                                    onChange={e => setForm(f => ({ ...f, value_claimed: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" placeholder="0.00" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Time Claimed (days)</Label>
                                <Input type="number" value={form.time_claimed_days}
                                    onChange={e => setForm(f => ({ ...f, time_claimed_days: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" placeholder="0" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Contract Clause</Label>
                                <Input value={form.clause_reference}
                                    onChange={e => setForm(f => ({ ...f, clause_reference: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" placeholder="e.g. Cl. 60.1(1)" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Date Notified</Label>
                                <Input type="date" value={form.date_notified}
                                    onChange={e => setForm(f => ({ ...f, date_notified: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={3}
                                placeholder="Describe the change, its cause and effect…" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={2}
                                placeholder="Internal notes, correspondence refs…" />
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setShowCreate(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 transition-colors">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Create Event
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Edit dialog ── */}
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit — {editTarget?.reference}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Title *</Label>
                            <Input required value={editForm.title ?? ""}
                                onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <Select value={editForm.type ?? "Compensation Event"} onValueChange={v => setEditForm((f: any) => ({ ...f, type: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select value={editForm.status ?? "Draft"} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Issued By</Label>
                                <Select value={editForm.issued_by ?? "Us"} onValueChange={v => setEditForm((f: any) => ({ ...f, issued_by: v }))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ISSUED_BY.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Contract Clause</Label>
                                <Input value={editForm.clause_reference ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, clause_reference: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" placeholder="e.g. Cl. 60.1(1)" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Value Claimed (£)</Label>
                                <Input type="number" step="0.01" value={editForm.value_claimed ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, value_claimed: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Value Agreed (£)</Label>
                                <Input type="number" step="0.01" value={editForm.value_agreed ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, value_agreed: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" placeholder="Leave blank if not yet agreed" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Time Claimed (days)</Label>
                                <Input type="number" value={editForm.time_claimed_days ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, time_claimed_days: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Time Agreed (days)</Label>
                                <Input type="number" value={editForm.time_agreed_days ?? ""}
                                    onChange={e => setEditForm((f: any) => ({ ...f, time_agreed_days: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" placeholder="Leave blank if not yet agreed" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(["date_notified", "date_submitted", "date_assessed", "date_agreed"] as const).map(field => (
                                <div key={field} className="space-y-1.5">
                                    <Label>{field.replace("date_", "Date ").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</Label>
                                    <Input type="date" value={editForm[field] ?? ""}
                                        onChange={e => setEditForm((f: any) => ({ ...f, [field]: e.target.value }))}
                                        className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={editForm.description ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={3} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea value={editForm.notes ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={2} />
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setShowEdit(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 transition-colors">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Save Changes
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Delete confirm dialog ── */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Change Event?</DialogTitle>
                    </DialogHeader>
                    <p className="text-slate-400 text-sm pt-1">This cannot be undone.</p>
                    <DialogFooter className="pt-2">
                        <button onClick={() => setDeleteId(null)}
                            className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleDelete} disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Delete
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
