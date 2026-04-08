"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Star, Sparkles, Copy, Pencil } from "lucide-react";
import {
    upsertLessonsLearnedAction,
    createLessonItemAction,
    updateLessonItemAction,
    deleteLessonItemAction,
    generateLessonsNarrativeAction,
} from "./actions";

const TYPES = ["Went Well", "Improvement", "Risk", "Opportunity"];
const CATEGORIES = [
    "Commercial", "Programme", "Design", "Site Operations",
    "Client Relations", "Health & Safety", "Subcontractors", "Other",
];
const IMPACTS  = ["Low", "Medium", "High"];
const FIN_OUTCOMES  = ["Under Budget", "On Budget", "Over Budget"];
const PROG_OUTCOMES = ["Early", "On Time", "Delayed"];

const TYPE_CONFIG: Record<string, { colour: string; dot: string }> = {
    "Went Well":   { colour: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
    "Improvement": { colour: "text-amber-400 bg-amber-500/10 border-amber-500/30",       dot: "bg-amber-400"   },
    "Risk":        { colour: "text-red-400 bg-red-500/10 border-red-500/30",              dot: "bg-red-400"     },
    "Opportunity": { colour: "text-blue-400 bg-blue-500/10 border-blue-500/30",           dot: "bg-blue-400"    },
};

const IMPACT_COLOUR: Record<string, string> = {
    Low:    "text-slate-400",
    Medium: "text-amber-400",
    High:   "text-red-400",
};

interface LessonItem {
    id: string;
    type: string;
    category: string;
    title: string;
    detail?: string;
    impact: string;
    action_required: boolean;
    action_owner?: string;
    order_index: number;
}

interface Review {
    overall_rating?:      number | null;
    client_satisfaction?: number | null;
    financial_outcome?:   string;
    programme_outcome?:   string;
    summary?:             string;
    ai_narrative?:        string;
}

interface Props {
    projectId: string;
    project:   any;
    review:    Review | null;
    initialItems: LessonItem[];
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button"
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="transition-transform hover:scale-110"
                >
                    <Star className={`w-6 h-6 ${n <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />
                </button>
            ))}
        </div>
    );
}

const BLANK_ITEM = {
    type: "Went Well", category: "Other", title: "", detail: "",
    impact: "Medium", action_required: false, action_owner: "",
};

export default function LessonsClient({ projectId, project, review, initialItems }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isGenerating, setIsGenerating] = useState(false);

    // Review state
    const [overallRating,  setOverallRating]  = useState(review?.overall_rating ?? 0);
    const [clientRating,   setClientRating]   = useState(review?.client_satisfaction ?? 0);
    const [finOutcome,     setFinOutcome]     = useState(review?.financial_outcome ?? "");
    const [progOutcome,    setProgOutcome]    = useState(review?.programme_outcome ?? "");
    const [summary,        setSummary]        = useState(review?.summary ?? "");
    const [aiNarrative,    setAiNarrative]    = useState(review?.ai_narrative ?? "");
    const [reviewSaved,    setReviewSaved]    = useState(false);

    // Filter
    const [filterType,    setFilterType]    = useState("All");
    const [filterCat,     setFilterCat]     = useState("All");

    // Add dialog
    const [showAdd,  setShowAdd]  = useState(false);
    const [addForm,  setAddForm]  = useState({ ...BLANK_ITEM });

    // Edit dialog
    const [showEdit,    setShowEdit]    = useState(false);
    const [editTarget,  setEditTarget]  = useState<LessonItem | null>(null);
    const [editForm,    setEditForm]    = useState<any>({});

    // Delete
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const act = (fn: () => Promise<void>) =>
        startTransition(async () => {
            try { await fn(); router.refresh(); }
            catch (e: any) { toast.error(e.message); }
        });

    const handleSaveReview = () => {
        act(async () => {
            await upsertLessonsLearnedAction(projectId, {
                overall_rating:      overallRating || null,
                client_satisfaction: clientRating  || null,
                financial_outcome:   finOutcome    || undefined,
                programme_outcome:   progOutcome   || undefined,
                summary:             summary        || undefined,
            });
            setReviewSaved(true);
            setTimeout(() => setReviewSaved(false), 2000);
            toast.success("Review saved");
        });
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const text = await generateLessonsNarrativeAction(projectId);
            setAiNarrative(text);
            toast.success("Narrative generated");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createLessonItemAction({
                project_id:      projectId,
                type:            addForm.type,
                category:        addForm.category,
                title:           addForm.title,
                detail:          addForm.detail || undefined,
                impact:          addForm.impact,
                action_required: addForm.action_required,
                action_owner:    addForm.action_owner || undefined,
                order_index:     initialItems.length,
            });
            toast.success("Lesson added");
            setShowAdd(false);
            setAddForm({ ...BLANK_ITEM });
        });
    };

    const openEdit = (item: LessonItem) => {
        setEditTarget(item);
        setEditForm({
            type:            item.type,
            category:        item.category,
            title:           item.title,
            detail:          item.detail ?? "",
            impact:          item.impact,
            action_required: item.action_required,
            action_owner:    item.action_owner ?? "",
        });
        setShowEdit(true);
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        act(async () => {
            await updateLessonItemAction(editTarget.id, projectId, {
                type:            editForm.type,
                category:        editForm.category,
                title:           editForm.title,
                detail:          editForm.detail || undefined,
                impact:          editForm.impact,
                action_required: editForm.action_required,
                action_owner:    editForm.action_owner || undefined,
            });
            toast.success("Lesson updated");
            setShowEdit(false);
        });
    };

    const handleDelete = () => {
        if (!deleteId) return;
        act(async () => {
            await deleteLessonItemAction(deleteId, projectId);
            toast.success("Lesson removed");
            setDeleteId(null);
        });
    };

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const filtered = initialItems.filter(i =>
        (filterType === "All" || i.type     === filterType) &&
        (filterCat  === "All" || i.category === filterCat)
    );
    const actions = initialItems.filter(i => i.action_required);

    // ── Item form fields (shared between add/edit dialogs) ────────────────────
    const ItemFormFields = ({ form, setForm }: { form: any; setForm: (fn: (f: any) => any) => void }) => (
        <>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white" placeholder="Brief summary of the lesson" />
            </div>
            <div className="space-y-1.5">
                <Label>Detail</Label>
                <Textarea value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white resize-none" rows={3}
                    placeholder="What happened? What was the impact? What should change?" />
            </div>
            <div className="space-y-1.5">
                <Label>Impact</Label>
                <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{IMPACTS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="action-req" checked={form.action_required}
                        onChange={e => setForm((f: any) => ({ ...f, action_required: e.target.checked }))}
                        className="w-4 h-4 accent-orange-500" />
                    <label htmlFor="action-req" className="text-sm text-slate-300">Action required</label>
                </div>
                {form.action_required && (
                    <Input value={form.action_owner} onChange={e => setForm((f: any) => ({ ...f, action_owner: e.target.value }))}
                        className="bg-slate-800 border-slate-700 text-white"
                        placeholder="Action owner (name or role)" />
                )}
            </div>
        </>
    );

    return (
        <div className="space-y-6">
            {/* ── Review scorecard ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-5">
                <p className="text-sm font-semibold text-white">Project Review</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Project Rating</p>
                        <StarRating value={overallRating} onChange={setOverallRating} />
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client Satisfaction</p>
                        <StarRating value={clientRating} onChange={setClientRating} />
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Financial Outcome</p>
                        <Select value={finOutcome} onValueChange={setFinOutcome}>
                            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                                {FIN_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Programme Outcome</p>
                        <Select value={progOutcome} onValueChange={setProgOutcome}>
                            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                                {PROG_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project Summary</p>
                    <Textarea value={summary} onChange={e => setSummary(e.target.value)}
                        className="bg-slate-900 border-slate-700 text-white resize-none" rows={3}
                        placeholder="Brief narrative of how the project went overall…" />
                </div>

                <div className="flex justify-end">
                    <button onClick={handleSaveReview} disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-500 disabled:opacity-50 transition-colors">
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {reviewSaved ? "Saved!" : "Save Review"}
                    </button>
                </div>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Lessons",   value: String(initialItems.length),                                   sub: "logged" },
                    { label: "Went Well",       value: String(initialItems.filter(i => i.type === "Went Well").length),   sub: "items", colour: "text-emerald-400" },
                    { label: "Improvements",    value: String(initialItems.filter(i => i.type === "Improvement").length), sub: "items", colour: "text-amber-400" },
                    { label: "Actions",         value: String(actions.length),                                         sub: "required", colour: actions.length > 0 ? "text-red-400" : "text-slate-400" },
                ].map(({ label, value, sub, colour }) => (
                    <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
                        <p className={`text-2xl font-bold ${colour ?? "text-white"}`}>{value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-300 text-sm">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Types</SelectItem>
                        {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterCat} onValueChange={setFilterCat}>
                    <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-300 text-sm">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Categories</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex-1" />
                <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-500 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add Lesson
                </button>
            </div>

            {/* ── Lesson items ── */}
            {filtered.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-sm">No lessons logged yet.</p>
                    <p className="text-slate-500 text-xs mt-1">Add what went well, what to improve, risks identified, and opportunities for next time.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(item => {
                        const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG["Went Well"];
                        return (
                            <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-4 flex items-start gap-4">
                                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.colour}`}>
                                            {item.type}
                                        </span>
                                        <span className="text-[11px] text-slate-500">{item.category}</span>
                                        <span className={`text-[11px] font-semibold ${IMPACT_COLOUR[item.impact] ?? "text-slate-400"}`}>{item.impact} impact</span>
                                        {item.action_required && (
                                            <span className="text-[11px] text-red-400 font-semibold">
                                                Action{item.action_owner ? `: ${item.action_owner}` : " required"}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-white mt-1">{item.title}</p>
                                    {item.detail && (
                                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.detail}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => openEdit(item)}
                                        className="p-1.5 rounded-md text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setDeleteId(item.id)}
                                        className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Actions required summary ── */}
            {actions.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-400 mb-3">Actions Required ({actions.length})</p>
                    <div className="space-y-1.5">
                        {actions.map(a => (
                            <div key={a.id} className="flex items-start gap-2 text-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                                <span className="text-slate-300">{a.title}</span>
                                {a.action_owner && <span className="text-slate-500 flex-shrink-0">— {a.action_owner}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── AI narrative ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">AI Lessons Narrative</p>
                        <p className="text-xs text-slate-500 mt-0.5">Auto-generated summary based on your review data and lesson items</p>
                    </div>
                    <button onClick={handleGenerate} disabled={isGenerating || initialItems.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 transition-colors">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isGenerating ? "Generating…" : aiNarrative ? "Regenerate" : "Generate"}
                    </button>
                </div>

                {aiNarrative ? (
                    <div className="bg-slate-900/60 rounded-lg p-4">
                        <div className="flex justify-end mb-2">
                            <button onClick={() => { navigator.clipboard.writeText(aiNarrative); toast.success("Copied"); }}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                <Copy className="w-3 h-3" />
                                Copy
                            </button>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{aiNarrative}</p>
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 italic">
                        {initialItems.length === 0
                            ? "Add at least one lesson item before generating the narrative."
                            : "Click Generate to create an AI-written narrative from your lessons."}
                    </p>
                )}
            </div>

            {/* ── Add dialog ── */}
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add Lesson</DialogTitle></DialogHeader>
                    <form onSubmit={handleAdd} className="space-y-4 pt-2">
                        <ItemFormFields form={addForm} setForm={setAddForm as any} />
                        <DialogFooter>
                            <button type="button" onClick={() => setShowAdd(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-500 disabled:opacity-50 transition-colors">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Add Lesson
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Edit dialog ── */}
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Lesson</DialogTitle></DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4 pt-2">
                        <ItemFormFields form={editForm} setForm={setEditForm as any} />
                        <DialogFooter>
                            <button type="button" onClick={() => setShowEdit(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-500 disabled:opacity-50 transition-colors">
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
                    <DialogHeader><DialogTitle>Remove Lesson?</DialogTitle></DialogHeader>
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
