"use client";

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from "react";
import { updatePhasesAction, getEstimatePhasesAction, saveProgrammePhasesAction } from "./actions";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Phase {
    name: string;
    calculatedDays: number;
    manualDays: number | null;
    manhours: number;
    startOffset: number;   // days from project start
    color?: string;
    dependsOn?: number[];  // indices of predecessor phases
}

interface EstimateLineComponent {
    component_type: string;
    total_manhours: number;
}

interface EstimateLine {
    trade_section: string;
    quantity: number;
    estimate_line_components: EstimateLineComponent[];
}

interface Estimate {
    id: string;
    version_name: string;
    estimate_lines: EstimateLine[];
}

interface Props {
    project: {
        id: string;
        name: string;
        start_date?: string;
        timeline_phases?: Phase[];
        programme_phases?: Phase[];
    };
    estimate: Estimate | null;
    projectId: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const PHASE_COLORS = [
    { key: "blue",    bg: "bg-blue-500" },
    { key: "emerald", bg: "bg-emerald-500" },
    { key: "orange",  bg: "bg-orange-500" },
    { key: "purple",  bg: "bg-purple-500" },
    { key: "red",     bg: "bg-red-500" },
    { key: "teal",    bg: "bg-teal-500" },
    { key: "indigo",  bg: "bg-indigo-500" },
    { key: "pink",    bg: "bg-pink-500" },
    { key: "yellow",  bg: "bg-yellow-500" },
    { key: "cyan",    bg: "bg-cyan-500" },
];

const ROW_H  = 52;   // px — height of each phase row
const BAR_H  = 30;   // px — height of each Gantt bar
const BAR_PAD = (ROW_H - BAR_H) / 2;  // vertical centering

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function fmtDate(date: Date): string {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDateFull(date: Date): string {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

// ─── Build phases from estimate manhours ────────────────────────────────────
function buildPhasesFromEstimate(estimate: Estimate | null, existingPhases?: Phase[]): Phase[] {
    if (!estimate) return existingPhases || [];

    const sectionManhours: Record<string, number> = {};
    (estimate.estimate_lines || []).forEach((line) => {
        const section = line.trade_section || "General";
        const lineManHours = (line.estimate_line_components || []).reduce(
            (sum, c) => sum + (c.total_manhours || 0), 0
        );
        sectionManhours[section] = (sectionManhours[section] || 0) + lineManHours * (line.quantity || 1);
    });

    const existingMap = new Map<string, Phase>();
    (existingPhases || []).forEach((p) => existingMap.set(p.name, p));

    const sections = Object.keys(sectionManhours).filter((s) => sectionManhours[s] > 0);
    if (sections.length === 0 && existingPhases && existingPhases.length > 0) return existingPhases;

    let offset = 0;
    return sections.map((section) => {
        const manhours = sectionManhours[section];
        const calculatedDays = Math.max(Math.ceil(manhours / 8), 1);
        const existing = existingMap.get(section);
        const manualDays = existing?.manualDays ?? null;
        const duration = manualDays ?? calculatedDays;
        const phase: Phase = {
            name: section,
            calculatedDays,
            manualDays,
            manhours,
            startOffset: existing?.startOffset ?? offset,
            color: existing?.color,
            dependsOn: existing?.dependsOn,
        };
        offset += duration;
        return phase;
    });
}

// ─── Drag types ──────────────────────────────────────────────────────────────
type DragType = "move" | "resize";
interface DragState {
    type: DragType;
    phaseIndex: number;
    startClientX: number;
    originalValue: number;    // startOffset (move) or duration (resize)
    trackWidth: number;
    capturedTotalDays: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientSchedulePage({ project, estimate, projectId }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [isDragging, setIsDragging] = useState(false);

    const ganttRef      = useRef<HTMLDivElement>(null);
    const dragStateRef  = useRef<DragState | null>(null);

    const existingPhases = (project.programme_phases as Phase[] | undefined)
                        || (project.timeline_phases  as Phase[] | undefined);

    const initialPhases = useMemo(
        () => buildPhasesFromEstimate(estimate, existingPhases),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
    const [phases, setPhases] = useState<Phase[]>(initialPhases);
    const phasesRef = useRef<Phase[]>(phases);
    useEffect(() => { phasesRef.current = phases; }, [phases]);

    // Auto-load from server if empty
    useEffect(() => {
        if (phases.length === 0) {
            getEstimatePhasesAction(projectId).then((serverPhases) => {
                if (serverPhases.length > 0) {
                    setPhases(serverPhases);
                    saveProgrammePhasesAction(projectId, serverPhases);
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Computed values ───────────────────────────────────────────────────────
    const projectStart = project.start_date ? new Date(project.start_date) : new Date();

    const totalDays = useMemo(() => {
        const max = phases.reduce((m, p) => {
            const dur = p.manualDays ?? p.calculatedDays;
            return Math.max(m, p.startOffset + dur);
        }, 0);
        return Math.max(max, 7);
    }, [phases]);

    const totalDaysRef = useRef(totalDays);
    useEffect(() => { totalDaysRef.current = totalDays; }, [totalDays]);

    const totalWeeks   = Math.max(Math.ceil(totalDays / 7), 4);
    const totalManhours = phases.reduce((s, p) => s + p.manhours, 0);
    const projectEnd   = addDays(projectStart, totalDays);
    const totalHeight  = phases.length * ROW_H;

    // Critical path: any phase whose end >= totalDays - 6 (within the last week)
    const criticalSet = useMemo(() => {
        const s = new Set<number>();
        phases.forEach((p, i) => {
            if (p.startOffset + (p.manualDays ?? p.calculatedDays) >= totalDays - 6) s.add(i);
        });
        return s;
    }, [phases, totalDays]);

    // Week headers
    const weekHeaders = useMemo(
        () => Array.from({ length: Math.min(totalWeeks, 52) }, (_, i) => ({
            label: `W${i + 1}`,
            date: fmtDate(addDays(projectStart, i * 7)),
        })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [totalWeeks, project.start_date]
    );

    // ── Drag system ───────────────────────────────────────────────────────────
    const handleBarMouseDown = useCallback((
        e: React.MouseEvent,
        idx: number,
        type: DragType
    ) => {
        e.preventDefault();
        e.stopPropagation();
        const track = ganttRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const phase = phasesRef.current[idx];
        dragStateRef.current = {
            type,
            phaseIndex: idx,
            startClientX: e.clientX,
            originalValue: type === "move"
                ? phase.startOffset
                : (phase.manualDays ?? phase.calculatedDays),
            trackWidth: rect.width,
            capturedTotalDays: totalDaysRef.current,
        };
        setIsDragging(true);
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            const drag = dragStateRef.current;
            if (!drag) return;
            const deltaX      = e.clientX - drag.startClientX;
            const pxPerDay    = drag.trackWidth / drag.capturedTotalDays;
            const deltaDays   = deltaX / pxPerDay;

            if (drag.type === "move") {
                const snapped = Math.max(0, Math.round((drag.originalValue + deltaDays) / 7) * 7);
                setPhases((prev) => {
                    const u = [...prev];
                    u[drag.phaseIndex] = { ...u[drag.phaseIndex], startOffset: snapped };
                    return u;
                });
            } else {
                const snapped = Math.max(7, Math.round((drag.originalValue + deltaDays) / 7) * 7);
                setPhases((prev) => {
                    const u = [...prev];
                    u[drag.phaseIndex] = { ...u[drag.phaseIndex], manualDays: snapped };
                    return u;
                });
            }
        };

        const onMouseUp = () => {
            if (dragStateRef.current) {
                dragStateRef.current = null;
                setIsDragging(false);
            }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
    }, []);

    // ── Phase mutations ───────────────────────────────────────────────────────
    const updatePhaseName = (idx: number, name: string) =>
        setPhases((prev) => { const u = [...prev]; u[idx] = { ...u[idx], name }; return u; });

    const handleManualDuration = (idx: number, val: string) => {
        const days = val === "" ? null : parseInt(val, 10);
        if (days !== null && (isNaN(days) || days < 1)) return;
        setPhases((prev) => { const u = [...prev]; u[idx] = { ...u[idx], manualDays: days }; return u; });
    };

    const handleSetDependency = (idx: number, val: string) => {
        const depIdx = val === "" ? -1 : parseInt(val, 10);
        setPhases((prev) => {
            const u = [...prev];
            u[idx] = { ...u[idx], dependsOn: depIdx >= 0 ? [depIdx] : [] };
            // Auto-snap successor to start exactly when predecessor finishes
            if (depIdx >= 0 && depIdx < prev.length) {
                const pred = u[depIdx];
                const predEnd = pred.startOffset + (pred.manualDays ?? pred.calculatedDays);
                u[idx] = { ...u[idx], startOffset: predEnd };
            }
            return u;
        });
    };

    const deletePhase = (idx: number) =>
        setPhases((prev) =>
            prev
                .filter((_, i) => i !== idx)
                .map((p) => ({
                    ...p,
                    dependsOn: (p.dependsOn || [])
                        .filter((d) => d !== idx)
                        .map((d) => (d > idx ? d - 1 : d)),
                }))
        );

    const addPhase = () => {
        const maxEnd = phases.reduce(
            (m, p) => Math.max(m, p.startOffset + (p.manualDays ?? p.calculatedDays)), 0
        );
        setPhases((prev) => [
            ...prev,
            { name: "New Phase", calculatedDays: 14, manualDays: 14, manhours: 0, startOffset: maxEnd },
        ]);
    };

    const sequencePhases = () => {
        setPhases((prev) => {
            let offset = 0;
            return prev.map((p) => {
                const phase = { ...p, startOffset: offset };
                offset += p.manualDays ?? p.calculatedDays;
                return phase;
            });
        });
        toast.success("Phases sequenced with no gaps");
    };

    // ── Save / Regenerate ─────────────────────────────────────────────────────
    const handleSave = () => {
        startTransition(async () => {
            setSaveStatus("saving");
            await updatePhasesAction(project.id, phases);
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2500);
        });
    };

    const handleRegenerate = () => {
        startTransition(async () => {
            const serverPhases = await getEstimatePhasesAction(projectId);
            if (serverPhases.length > 0) {
                setPhases(serverPhases);
                await saveProgrammePhasesAction(projectId, serverPhases);
                toast.success("Programme regenerated from estimate");
            } else {
                const regenerated = buildPhasesFromEstimate(estimate, undefined);
                if (regenerated.length > 0) {
                    setPhases(regenerated);
                    toast.success("Programme regenerated");
                } else {
                    toast.error("No manhours found in estimate — add labour components first");
                }
            }
        });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Programme</h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {project.name}
                            {estimate ? ` · ${estimate.version_name}` : " · No active estimate"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {saveStatus === "saving" && (
                        <span className="text-xs text-slate-400 animate-pulse">Saving…</span>
                    )}
                    {saveStatus === "saved" && (
                        <span className="text-xs text-emerald-400">✓ Saved to proposal</span>
                    )}
                    {phases.length > 1 && (
                        <button
                            type="button"
                            onClick={sequencePhases}
                            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            Auto-sequence
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleRegenerate}
                        disabled={isPending}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Regenerate from estimate
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                        Save to Proposal
                    </button>
                </div>
            </div>

            {/* ── Summary strip ── */}
            {phases.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Duration", value: `${totalDays}d`, sub: `${totalWeeks} weeks` },
                        { label: "Start", value: fmtDateFull(projectStart), sub: "Project start" },
                        { label: "Completion", value: fmtDateFull(projectEnd), sub: "Estimated" },
                        {
                            label: "Manhours",
                            value: totalManhours > 0 ? `${Math.round(totalManhours)}h` : "—",
                            sub: totalManhours > 0 ? `${Math.round(totalManhours / 8)}d labour` : "No manhours",
                        },
                    ].map(({ label, value, sub }) => (
                        <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
                            <p className="text-base font-bold text-white">{value}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Drag hint ── */}
            {phases.length > 0 && (
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                        Drag bar to move · Drag right edge to resize · Snaps to week
                    </span>
                    {criticalSet.size > 0 && (
                        <span className="flex items-center gap-1 text-yellow-500/80">
                            <span>★</span> Critical path
                        </span>
                    )}
                    {phases.some((p) => p.dependsOn?.length) && (
                        <span className="flex items-center gap-1 text-amber-500/70">
                            <span>⟶</span> Dependencies shown
                        </span>
                    )}
                </div>
            )}

            {/* ── Empty state ── */}
            {phases.length === 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                            <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-300">No programme phases yet</p>
                        <p className="text-xs text-slate-500 max-w-xs">
                            {estimate
                                ? "Add labour components with manhours to your estimate lines, then click Regenerate."
                                : "Set an estimate as active to auto-generate the programme."}
                        </p>
                        <button
                            type="button"
                            onClick={addPhase}
                            className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-colors"
                        >
                            + Add phase manually
                        </button>
                    </div>
                </div>
            )}

            {/* ── Gantt ── */}
            {phases.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">

                    {/* Column headers */}
                    <div className="flex border-b border-slate-700/50 bg-slate-900/40">
                        <div className="w-[216px] shrink-0 border-r border-slate-700/50 px-3 py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phase / Trade</span>
                        </div>
                        <div className="w-14 shrink-0 border-r border-slate-700/50 text-center py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Calc</span>
                        </div>
                        <div className="w-16 shrink-0 border-r border-slate-700/50 text-center py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Days</span>
                        </div>
                        <div className="w-[108px] shrink-0 border-r border-slate-700/50 text-center py-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Starts After</span>
                        </div>
                        {/* Week labels */}
                        <div className="flex-1 flex">
                            {weekHeaders.map((wk, i) => (
                                <div
                                    key={i}
                                    className="flex-1 text-center py-1.5 border-r border-slate-700/20 last:border-0"
                                    style={{ minWidth: 28 }}
                                >
                                    <div className="text-[9px] font-bold text-slate-500 leading-tight">{wk.label}</div>
                                    <div className="text-[8px] text-slate-600 leading-tight hidden md:block">{wk.date}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body: left control panel + Gantt track */}
                    <div className="flex">

                        {/* Left panel */}
                        <div className="shrink-0 border-r border-slate-700/50">
                            {phases.map((phase, idx) => {
                                const duration   = phase.manualDays ?? phase.calculatedDays;
                                const phaseStart = addDays(projectStart, phase.startOffset);
                                const phaseEnd   = addDays(projectStart, phase.startOffset + duration);
                                const isCritical = criticalSet.has(idx);
                                const colorDef   = PHASE_COLORS[idx % PHASE_COLORS.length];
                                const predIdx    = phase.dependsOn?.[0];

                                return (
                                    <div
                                        key={idx}
                                        className="flex border-b border-slate-700/30 last:border-0 hover:bg-slate-700/10 transition-colors"
                                        style={{ height: ROW_H }}
                                    >
                                        {/* Name + dates */}
                                        <div className="w-[216px] px-3 flex flex-col justify-center border-r border-slate-700/30">
                                            <div className="flex items-center gap-1.5">
                                                <div
                                                    className={`w-2 h-2 rounded-full shrink-0 ${colorDef.bg}${isCritical ? " ring-1 ring-offset-1 ring-offset-slate-900 ring-yellow-400" : ""}`}
                                                />
                                                <input
                                                    className="flex-1 min-w-0 font-medium text-sm text-slate-100 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 outline-none truncate"
                                                    value={phase.name}
                                                    onChange={(e) => updatePhaseName(idx, e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => deletePhase(idx)}
                                                    className="shrink-0 w-4 text-slate-600 hover:text-red-400 transition-colors text-lg leading-none"
                                                    title="Remove phase"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className="text-[9px] text-slate-500 pl-[14px] mt-0.5 flex items-center gap-1.5">
                                                <span>{fmtDate(phaseStart)} – {fmtDate(phaseEnd)}</span>
                                                {phase.manhours > 0 && <span>· {Math.round(phase.manhours)}h</span>}
                                                {isCritical && <span className="text-yellow-500">★</span>}
                                            </div>
                                        </div>

                                        {/* Calc days */}
                                        <div className="w-14 flex items-center justify-center border-r border-slate-700/30 text-xs text-slate-400">
                                            {phase.calculatedDays}d
                                        </div>

                                        {/* Manual override */}
                                        <div className="w-16 flex items-center justify-center border-r border-slate-700/30">
                                            <input
                                                type="number"
                                                min={1}
                                                className="w-12 h-7 px-1 text-center text-xs border border-slate-700 rounded bg-slate-900/50 text-slate-100 focus:outline-none focus:border-blue-500/50"
                                                value={phase.manualDays ?? ""}
                                                onChange={(e) => handleManualDuration(idx, e.target.value)}
                                                placeholder="—"
                                            />
                                        </div>

                                        {/* Starts After (dependency) */}
                                        <div className="w-[108px] flex items-center justify-center border-r border-slate-700/30 px-1.5">
                                            <select
                                                className="w-full h-7 px-1 text-[11px] border border-slate-700 rounded bg-slate-900/50 text-slate-300 focus:outline-none focus:border-blue-500/50"
                                                value={predIdx !== undefined && predIdx >= 0 ? predIdx : ""}
                                                onChange={(e) => handleSetDependency(idx, e.target.value)}
                                            >
                                                <option value="">None</option>
                                                {phases.map((p, i) =>
                                                    i !== idx ? (
                                                        <option key={i} value={i}>
                                                            {i + 1}. {p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name}
                                                        </option>
                                                    ) : null
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Gantt track (single relative container) ── */}
                        <div
                            ref={ganttRef}
                            className={`flex-1 relative overflow-hidden select-none${isDragging ? " cursor-grabbing" : ""}`}
                            style={{ height: totalHeight }}
                        >
                            {/* Alternating row stripes + horizontal grid */}
                            {phases.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`absolute left-0 right-0 border-b border-slate-700/30${idx % 2 === 1 ? " bg-slate-900/20" : ""}`}
                                    style={{ top: idx * ROW_H, height: ROW_H }}
                                />
                            ))}

                            {/* Vertical week grid lines */}
                            {weekHeaders.map((_, w) => (
                                <div
                                    key={w}
                                    className="absolute top-0 bottom-0 border-l border-slate-700/20"
                                    style={{ left: `${(w / totalWeeks) * 100}%` }}
                                />
                            ))}

                            {/* ── SVG dependency arrows ── */}
                            {phases.some((p) => (p.dependsOn || []).length > 0) && (
                                <svg
                                    className="absolute inset-0 pointer-events-none"
                                    viewBox={`0 0 1000 ${totalHeight}`}
                                    preserveAspectRatio="none"
                                    style={{ width: "100%", height: "100%" }}
                                >
                                    <defs>
                                        <marker
                                            id="dep-arrow"
                                            markerWidth="7"
                                            markerHeight="7"
                                            refX="3.5"
                                            refY="3.5"
                                            orient="auto"
                                            markerUnits="userSpaceOnUse"
                                        >
                                            <path d="M 0 1 L 6 3.5 L 0 6 Z" fill="#f59e0b" opacity="0.85" />
                                        </marker>
                                    </defs>
                                    {phases.map((phase, sIdx) =>
                                        (phase.dependsOn || []).map((pIdx) => {
                                            if (pIdx < 0 || pIdx >= phases.length || pIdx === sIdx) return null;
                                            const pred    = phases[pIdx];
                                            const predDur = pred.manualDays ?? pred.calculatedDays;
                                            const x1 = Math.min(((pred.startOffset + predDur) / totalDays) * 1000, 995);
                                            const y1 = (pIdx + 0.5) * ROW_H;
                                            const x2 = Math.max((phase.startOffset / totalDays) * 1000, 5);
                                            const y2 = (sIdx + 0.5) * ROW_H;
                                            const cx = (x1 + x2) / 2;
                                            return (
                                                <path
                                                    key={`${pIdx}-${sIdx}`}
                                                    d={`M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`}
                                                    stroke="#f59e0b"
                                                    strokeWidth="1.5"
                                                    fill="none"
                                                    opacity="0.7"
                                                    strokeDasharray="4 3"
                                                    markerEnd="url(#dep-arrow)"
                                                />
                                            );
                                        })
                                    )}
                                </svg>
                            )}

                            {/* ── Phase bars ── */}
                            {phases.map((phase, idx) => {
                                const duration    = phase.manualDays ?? phase.calculatedDays;
                                const barLeftPct  = (phase.startOffset / totalDays) * 100;
                                const barWidthPct = Math.max((duration / totalDays) * 100, 1.5);
                                const colorDef    = PHASE_COLORS[idx % PHASE_COLORS.length];
                                const isCritical  = criticalSet.has(idx);
                                const isActive    = isDragging && dragStateRef.current?.phaseIndex === idx;

                                return (
                                    <div
                                        key={idx}
                                        className={`absolute flex items-center${isActive ? " cursor-grabbing z-20" : " cursor-grab z-10"}`}
                                        style={{
                                            top: idx * ROW_H + BAR_PAD,
                                            height: BAR_H,
                                            left: `${barLeftPct}%`,
                                            width: `${barWidthPct}%`,
                                            minWidth: 24,
                                        }}
                                        onMouseDown={(e) => handleBarMouseDown(e, idx, "move")}
                                    >
                                        <div
                                            className={[
                                                "relative h-full w-full rounded-md flex items-center pl-2 pr-4 overflow-hidden",
                                                colorDef.bg,
                                                isCritical
                                                    ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900"
                                                    : "",
                                                isActive
                                                    ? "opacity-80 shadow-xl"
                                                    : "opacity-90 hover:opacity-100 shadow-sm",
                                            ].join(" ")}
                                        >
                                            <span className="text-white text-[10px] font-semibold truncate select-none">
                                                {duration}d
                                            </span>

                                            {/* Resize handle — right edge */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center gap-px hover:bg-black/20 rounded-r-md"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    handleBarMouseDown(
                                                        e as unknown as React.MouseEvent,
                                                        idx,
                                                        "resize"
                                                    );
                                                }}
                                            >
                                                <div className="w-px h-3 bg-white/50 rounded-full" />
                                                <div className="w-px h-3 bg-white/50 rounded-full" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Phase / Note ── */}
            {phases.length > 0 && (
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={addPhase}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/50 border border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                    >
                        + Add Phase
                    </button>
                    <p className="text-[11px] text-slate-500">
                        Durations from estimate manhours (1 operative, 8 hr/day). ★ = on critical path.
                    </p>
                </div>
            )}
        </div>
    );
}
