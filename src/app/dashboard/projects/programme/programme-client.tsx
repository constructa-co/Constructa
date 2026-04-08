"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Pencil, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { saveAsBuiltPhasesAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Phase {
    name: string;
    calculatedDays: number;
    manualDays: number | null;
    manhours: number;
    startOffset: number;          // calendar days from project start
    color?: string;
    pct_complete?: number;
    actual_start_date?: string;   // YYYY-MM-DD
    actual_finish_date?: string;  // YYYY-MM-DD
    // As-built additions
    revised_planned_finish?: string;  // YYYY-MM-DD — mid-project reschedule
    delay_reason?: string;
    delay_notes?: string;
}

const DELAY_REASONS = [
    "Weather", "Client Instruction", "Variation", "Supply Chain",
    "Design Issue", "Subcontractor", "Access / Site Conditions",
    "Force Majeure", "Other",
];

const PHASE_COLORS: Record<string, string> = {
    blue:    "#3b82f6",
    emerald: "#10b981",
    orange:  "#f97316",
    purple:  "#a855f7",
    red:     "#ef4444",
    teal:    "#14b8a6",
    indigo:  "#6366f1",
    pink:    "#ec4899",
    yellow:  "#eab308",
    cyan:    "#06b6d4",
};

// ── Date helpers ──────────────────────────────────────────────────────────────
const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};
const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86400000);
const fmtDate  = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const parseDate = (s: string) => new Date(s + "T00:00:00");

interface Props {
    projectId:     string;
    projectName:   string;
    startDate:     string | null;
    initialPhases: Phase[];
}

export default function ProgrammeClient({ projectId, projectName, startDate, initialPhases }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [phases, setPhases] = useState<Phase[]>(initialPhases);

    // Edit dialog
    const [editIdx,    setEditIdx]    = useState<number | null>(null);
    const [editForm,   setEditForm]   = useState<Partial<Phase>>({});
    const [showEdit,   setShowEdit]   = useState(false);

    const act = (fn: () => Promise<void>) =>
        startTransition(async () => {
            try { await fn(); router.refresh(); }
            catch (e: any) { toast.error(e.message); }
        });

    const openEdit = (idx: number) => {
        const ph = phases[idx];
        setEditIdx(idx);
        setEditForm({
            actual_start_date:      ph.actual_start_date ?? "",
            actual_finish_date:     ph.actual_finish_date ?? "",
            revised_planned_finish: ph.revised_planned_finish ?? "",
            pct_complete:           ph.pct_complete ?? 0,
            delay_reason:           ph.delay_reason ?? "",
            delay_notes:            ph.delay_notes ?? "",
        });
        setShowEdit(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (editIdx === null) return;
        const updated = phases.map((ph, i) =>
            i === editIdx ? {
                ...ph,
                actual_start_date:      editForm.actual_start_date      || undefined,
                actual_finish_date:     editForm.actual_finish_date      || undefined,
                revised_planned_finish: editForm.revised_planned_finish  || undefined,
                pct_complete:           editForm.pct_complete ?? ph.pct_complete,
                delay_reason:           editForm.delay_reason            || undefined,
                delay_notes:            editForm.delay_notes             || undefined,
            } : ph
        );
        setPhases(updated);
        act(async () => {
            await saveAsBuiltPhasesAction(projectId, updated);
            toast.success("Phase updated");
        });
        setShowEdit(false);
    };

    // ── Computed phase data ───────────────────────────────────────────────────
    const projectStart = useMemo(() =>
        startDate ? parseDate(startDate) : new Date(),
    [startDate]);

    const today = new Date();

    const computed = useMemo(() => phases.map(ph => {
        const baseDays        = ph.manualDays ?? ph.calculatedDays ?? 1;
        const baselineStart   = addDays(projectStart, ph.startOffset);
        const baselineFinish  = addDays(baselineStart, baseDays);
        const revisedFinish   = ph.revised_planned_finish ? parseDate(ph.revised_planned_finish) : null;
        const actualStart     = ph.actual_start_date  ? parseDate(ph.actual_start_date)  : null;
        const actualFinish    = ph.actual_finish_date ? parseDate(ph.actual_finish_date) : null;
        const pct             = ph.pct_complete ?? 0;

        // Delay: compare actual finish (or forecast) to baseline (or revised) finish
        const plannedFinish   = revisedFinish ?? baselineFinish;
        let delayDays: number | null = null;
        if (actualFinish) {
            delayDays = diffDays(actualFinish, plannedFinish);
        } else if (pct > 0 && pct < 100 && actualStart) {
            // Estimate forecast finish based on progress rate
            const elapsed     = diffDays(today, actualStart);
            const forecastTotal = pct > 0 ? Math.round(elapsed / (pct / 100)) : baseDays;
            const forecastFinish = addDays(actualStart, forecastTotal);
            delayDays = diffDays(forecastFinish, plannedFinish);
        }

        const status = (() => {
            if (pct >= 100 || actualFinish) {
                if (delayDays !== null && delayDays > 0) return "Complete-Late";
                return "Complete";
            }
            if (pct > 0 || actualStart) return "In Progress";
            if (today > baselineFinish) return "Not Started-Overdue";
            if (today >= baselineStart) return "Not Started-Due";
            return "Not Started";
        })();

        return { ph, baseDays, baselineStart, baselineFinish, revisedFinish, actualStart, actualFinish, pct, delayDays, status, plannedFinish };
    }), [phases, projectStart, today]);

    // ── Gantt date range ──────────────────────────────────────────────────────
    const { ganttStart, totalDays } = useMemo(() => {
        if (computed.length === 0) return { ganttStart: projectStart, totalDays: 90 };
        const allDates = computed.flatMap(c => [
            c.baselineStart, c.baselineFinish,
            ...(c.actualStart  ? [c.actualStart]  : []),
            ...(c.actualFinish ? [c.actualFinish] : []),
            ...(c.revisedFinish ? [c.revisedFinish] : []),
        ]);
        const minD = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxD = new Date(Math.max(...allDates.map(d => d.getTime())));
        // pad 1 week each side
        const gs = addDays(minD, -7);
        const ge = addDays(maxD,  7);
        return { ganttStart: gs, totalDays: Math.max(diffDays(ge, gs), 30) };
    }, [computed, projectStart]);

    const pct2x = (d: Date) => `${Math.max(0, Math.min(100, (diffDays(d, ganttStart) / totalDays) * 100))}%`;
    const dur2w = (start: Date, end: Date) => `${Math.max(0.5, (diffDays(end, start) / totalDays) * 100)}%`;

    // ── Month labels ──────────────────────────────────────────────────────────
    const monthLabels = useMemo(() => {
        const labels: { label: string; left: string }[] = [];
        const cur = new Date(ganttStart);
        cur.setDate(1);
        while (cur <= addDays(ganttStart, totalDays)) {
            const left = pct2x(cur);
            labels.push({ label: cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), left });
            cur.setMonth(cur.getMonth() + 1);
        }
        return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ganttStart, totalDays]);

    // ── Summary stats ─────────────────────────────────────────────────────────
    const totalDelayDays   = computed.reduce((s, c) => s + Math.max(0, c.delayDays ?? 0), 0);
    const phasesDelayed    = computed.filter(c => (c.delayDays ?? 0) > 0).length;
    const phasesComplete   = computed.filter(c => c.status.startsWith("Complete")).length;
    const overallPct       = computed.length > 0
        ? Math.round(computed.reduce((s, c) => s + c.pct, 0) / computed.length)
        : 0;

    const baselineCompletion  = computed.length > 0
        ? fmtDate(computed.reduce((latest, c) => c.baselineFinish > latest ? c.baselineFinish : latest, computed[0].baselineFinish))
        : "—";
    const forecastCompletion  = (() => {
        if (computed.length === 0) return "—";
        const last = computed.reduce((latest, c) => {
            const end = c.actualFinish ?? c.revisedFinish ?? c.baselineFinish;
            return end > latest ? end : latest;
        }, computed[0].actualFinish ?? computed[0].baselineFinish);
        return fmtDate(last);
    })();

    if (phases.length === 0) {
        return (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-16 text-center">
                <p className="text-slate-400 text-sm">No programme phases found.</p>
                <p className="text-slate-500 text-xs mt-1">
                    Build the programme in the{" "}
                    <a href={`/dashboard/projects/schedule?projectId=${projectId}`} className="text-sky-400 hover:underline">Schedule</a>
                    {" "}module first, then track as-built progress here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Overall Progress</p>
                    <p className="text-2xl font-bold text-white">{overallPct}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">{phasesComplete} of {phases.length} phases done</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Baseline Completion</p>
                    <p className="text-lg font-bold text-slate-300">{baselineCompletion}</p>
                    <p className="text-xs text-slate-500 mt-0.5">original planned</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Forecast Completion</p>
                    <p className={`text-lg font-bold ${totalDelayDays > 0 ? "text-amber-400" : "text-emerald-400"}`}>{forecastCompletion}</p>
                    <p className="text-xs text-slate-500 mt-0.5">current forecast</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Programme Delay</p>
                    <p className={`text-2xl font-bold ${totalDelayDays > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {totalDelayDays > 0 ? `+${totalDelayDays}d` : "On Track"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{phasesDelayed} phase{phasesDelayed !== 1 ? "s" : ""} delayed</p>
                </div>
            </div>

            {/* ── Legend ── */}
            <div className="flex items-center gap-6 text-xs text-slate-400 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-3 rounded bg-slate-600/80" />
                    <span>Baseline (planned)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-3 rounded bg-sky-500" />
                    <span>Actual / forecast</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-3 rounded border border-dashed border-amber-500/60 bg-amber-500/10" />
                    <span>Revised planned</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="w-px h-4 bg-sky-400/60" />
                    <span className="text-sky-400">Today</span>
                </div>
            </div>

            {/* ── Gantt ── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Month header */}
                <div className="relative h-8 border-b border-slate-700/50 bg-slate-900/40">
                    {monthLabels.map(({ label, left }, i) => (
                        <span key={i} className="absolute top-1.5 text-[10px] text-slate-500 font-medium"
                            style={{ left }}>
                            {label}
                        </span>
                    ))}
                    {/* Today line header */}
                    <div className="absolute top-0 bottom-0 w-px bg-sky-400/40"
                        style={{ left: pct2x(today) }} />
                </div>

                {/* Phase rows */}
                <div className="divide-y divide-slate-700/30">
                    {computed.map(({ ph, baseDays, baselineStart, baselineFinish, revisedFinish, actualStart, actualFinish, pct, delayDays, status, plannedFinish }, idx) => {
                        const phColor = PHASE_COLORS[ph.color ?? "blue"] ?? "#3b82f6";
                        const isDelayed   = (delayDays ?? 0) > 0;
                        const isEarly     = (delayDays ?? 0) < 0;
                        const hasActual   = actualStart !== null;

                        const StatusIcon = status.startsWith("Complete") ? CheckCircle2
                            : status === "In Progress" ? TrendingUp
                            : status.includes("Overdue") ? AlertTriangle
                            : Clock;

                        const statusColour = status.startsWith("Complete")
                            ? isDelayed ? "text-amber-400" : "text-emerald-400"
                            : status === "In Progress" ? "text-sky-400"
                            : status.includes("Overdue") ? "text-red-400"
                            : "text-slate-500";

                        return (
                            <div key={idx} className="flex items-stretch hover:bg-slate-700/10 transition-colors group">
                                {/* Phase name column */}
                                <div className="w-48 flex-shrink-0 px-4 py-3 flex items-center gap-2 border-r border-slate-700/30">
                                    <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${statusColour}`} />
                                    <span className="text-xs font-medium text-slate-300 truncate">{ph.name}</span>
                                </div>

                                {/* Gantt area */}
                                <div className="relative flex-1 py-2.5 min-h-[56px]">
                                    {/* Today line */}
                                    <div className="absolute top-0 bottom-0 w-px bg-sky-400/20 z-10"
                                        style={{ left: pct2x(today) }} />

                                    {/* Baseline bar */}
                                    <div className="absolute h-3 rounded bg-slate-600/70 top-2"
                                        style={{ left: pct2x(baselineStart), width: dur2w(baselineStart, baselineFinish) }}
                                        title={`Baseline: ${fmtDate(baselineStart)} → ${fmtDate(baselineFinish)} (${baseDays}d)`}
                                    />

                                    {/* Revised planned finish marker */}
                                    {revisedFinish && (
                                        <div className="absolute h-3 rounded-r border-2 border-dashed border-amber-500/70 bg-amber-500/10 top-2"
                                            style={{ left: pct2x(baselineStart), width: dur2w(baselineStart, revisedFinish) }}
                                            title={`Revised planned finish: ${fmtDate(revisedFinish)}`}
                                        />
                                    )}

                                    {/* Actual bar */}
                                    {hasActual && (
                                        <div className="absolute h-3 rounded top-7 overflow-hidden"
                                            style={{
                                                left:             pct2x(actualStart!),
                                                width:            dur2w(actualStart!, actualFinish ?? today),
                                                backgroundColor:  phColor,
                                                opacity:          0.85,
                                            }}
                                            title={`Actual: ${fmtDate(actualStart!)} → ${actualFinish ? fmtDate(actualFinish) : "In progress"}`}
                                        >
                                            {/* % complete fill */}
                                            {!actualFinish && pct > 0 && (
                                                <div className="absolute inset-y-0 left-0 bg-white/20 rounded"
                                                    style={{ width: `${pct}%` }} />
                                            )}
                                        </div>
                                    )}

                                    {/* % label on actual bar */}
                                    {hasActual && !actualFinish && pct > 0 && (
                                        <div className="absolute top-6 text-[9px] font-bold text-white/90"
                                            style={{ left: `calc(${pct2x(actualStart!)} + 4px)` }}>
                                            {pct}%
                                        </div>
                                    )}
                                </div>

                                {/* Right info column */}
                                <div className="w-40 flex-shrink-0 px-3 py-2.5 border-l border-slate-700/30 flex flex-col justify-center gap-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500">Baseline</span>
                                        <span className="text-[10px] text-slate-400">{baseDays}d</span>
                                    </div>
                                    {hasActual && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500">Actual</span>
                                            <span className="text-[10px] text-slate-400">
                                                {actualFinish
                                                    ? `${diffDays(actualFinish, actualStart!)}d`
                                                    : `${diffDays(today, actualStart!)}d+`}
                                            </span>
                                        </div>
                                    )}
                                    {delayDays !== null && Math.abs(delayDays) > 0 && (
                                        <div className={`text-[10px] font-bold ${isDelayed ? "text-red-400" : "text-emerald-400"}`}>
                                            {isDelayed ? `+${delayDays}d late` : `${Math.abs(delayDays)}d early`}
                                        </div>
                                    )}
                                    {ph.delay_reason && (
                                        <div className="text-[9px] text-amber-400/70 truncate" title={ph.delay_reason}>
                                            {ph.delay_reason}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => openEdit(idx)}
                                        className="mt-1 flex items-center gap-1 text-[10px] text-slate-600 hover:text-sky-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Pencil className="w-2.5 h-2.5" />
                                        Edit
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Delay summary table ── */}
            {phasesDelayed > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-red-500/20">
                        <p className="text-sm font-semibold text-red-400">Delay Summary</p>
                    </div>
                    <div className="divide-y divide-red-500/10">
                        {computed.filter(c => (c.delayDays ?? 0) > 0).map(({ ph, delayDays }, i) => (
                            <div key={i} className="flex items-center gap-4 px-5 py-3 text-sm">
                                <span className="flex-1 text-slate-300">{ph.name}</span>
                                {ph.delay_reason && (
                                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{ph.delay_reason}</span>
                                )}
                                <span className="text-red-400 font-semibold flex-shrink-0">+{delayDays}d</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Edit dialog ── */}
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editIdx !== null ? phases[editIdx]?.name : "Edit Phase"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>% Complete</Label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range" min={0} max={100} step={5}
                                    value={editForm.pct_complete ?? 0}
                                    onChange={e => setEditForm(f => ({ ...f, pct_complete: parseInt(e.target.value) }))}
                                    className="flex-1 accent-sky-500"
                                />
                                <span className="w-10 text-right text-sm text-white font-semibold">
                                    {editForm.pct_complete ?? 0}%
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Actual Start</Label>
                                <Input type="date" value={editForm.actual_start_date ?? ""}
                                    onChange={e => setEditForm(f => ({ ...f, actual_start_date: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Actual Finish</Label>
                                <Input type="date" value={editForm.actual_finish_date ?? ""}
                                    onChange={e => setEditForm(f => ({ ...f, actual_finish_date: e.target.value }))}
                                    className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Revised Planned Finish</Label>
                            <Input type="date" value={editForm.revised_planned_finish ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, revised_planned_finish: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white" />
                            <p className="text-[11px] text-slate-500">Set if the planned finish date has been rescheduled mid-project</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Delay Reason</Label>
                            <Select
                                value={editForm.delay_reason ?? ""}
                                onValueChange={v => setEditForm((f: any) => ({ ...f, delay_reason: v }))}
                            >
                                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                    <SelectValue placeholder="Select reason…" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">— None —</SelectItem>
                                    {DELAY_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea value={editForm.delay_notes ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, delay_notes: e.target.value }))}
                                className="bg-slate-800 border-slate-700 text-white resize-none" rows={2}
                                placeholder="Detail on cause and impact…" />
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setShowEdit(false)}
                                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-500 disabled:opacity-50 transition-colors">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Save
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
