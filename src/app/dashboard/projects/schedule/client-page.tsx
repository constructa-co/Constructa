"use client";

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from "react";
import { updatePhasesAction, getEstimatePhasesAction, saveProgrammePhasesAction } from "./actions";
import ProgrammeAiUpdate from "./programme-ai-update";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Phase {
    name: string;
    calculatedDays: number;   // working days derived from manhours
    manualDays: number | null; // working days user override
    manhours: number;
    startOffset: number;       // calendar days from project start (always multiple of 7)
    color?: string;
    dependsOn?: number[];      // indices of predecessor phases
    // Sprint 31 — Live Tracking
    pct_complete?: number;         // 0–100
    actual_start_date?: string;    // YYYY-MM-DD
    actual_finish_date?: string;   // YYYY-MM-DD
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

const ROW_H  = 52;
const BAR_H  = 30;
const BAR_PAD = (ROW_H - BAR_H) / 2;
const DEFAULT_DPW = 5; // default working days per week

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert working days → calendar days, rounded up to whole weeks. */
function toCalendarDays(workingDays: number, daysPerWeek: number): number {
    if (daysPerWeek >= 7) return workingDays;
    return Math.ceil(workingDays / daysPerWeek) * 7;
}

/** Snap a date forward to the nearest Monday (stays if already Monday). */
function snapToMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon, …6=Sat
    if (day === 1) return d;
    const daysToAdd = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysToAdd);
    return d;
}

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

function toInputDate(date: Date): string {
    // YYYY-MM-DD for <input type="date">
    return date.toISOString().split("T")[0];
}

// ─── Build phases from estimate manhours ────────────────────────────────────
function buildPhasesFromEstimate(
    estimate: Estimate | null,
    existingPhases?: Phase[],
    daysPerWeek: number = DEFAULT_DPW
): Phase[] {
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
        const calculatedDays = Math.max(Math.ceil(manhours / 8), 1); // working days
        const existing = existingMap.get(section);
        const manualDays = existing?.manualDays ?? null;
        const duration = manualDays ?? calculatedDays; // working days
        const phase: Phase = {
            name: section,
            calculatedDays,
            manualDays,
            manhours,
            startOffset: existing?.startOffset ?? offset,
            color: existing?.color,
            dependsOn: existing?.dependsOn,
        };
        offset += toCalendarDays(duration, daysPerWeek); // advance by calendar days
        return phase;
    });
}

// ─── Drag types ──────────────────────────────────────────────────────────────
type DragType = "move" | "resize";
interface DragState {
    type: DragType;
    phaseIndex: number;
    startClientX: number;
    originalValue: number;
    trackWidth: number;
    capturedTotalDays: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientSchedulePage({ project, estimate, projectId }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [isDragging, setIsDragging] = useState(false);
    const [showLiveTracking, setShowLiveTracking] = useState(false);

    const ganttRef           = useRef<HTMLDivElement>(null);
    const dragStateRef       = useRef<DragState | null>(null);
    const isInitialMount     = useRef(true);
    const autoSaveTimer      = useRef<NodeJS.Timeout | null>(null);
    const programmeStartRef  = useRef<Date | null>(null);

    // ── Working week (persisted in localStorage per project) ──────────────
    const DPW_KEY = `prog_dpw_${projectId}`;
    const [daysPerWeek, setDaysPerWeek] = useState<number>(() => {
        if (typeof window !== "undefined") {
            const s = localStorage.getItem(DPW_KEY);
            return s ? parseInt(s, 10) : DEFAULT_DPW;
        }
        return DEFAULT_DPW;
    });

    const handleSetDaysPerWeek = (n: number) => {
        setDaysPerWeek(n);
        if (typeof window !== "undefined") localStorage.setItem(DPW_KEY, String(n));
    };

    // ── Programme start date (always a Monday) ────────────────────────────
    const [programmeStart, setProgrammeStart] = useState<Date>(() => {
        const base = project.start_date ? new Date(project.start_date + "T00:00:00") : new Date();
        return snapToMonday(base);
    });

    const handleStartDateChange = (value: string) => {
        if (!value) return;
        const d = new Date(value + "T00:00:00");
        setProgrammeStart(snapToMonday(d));
    };

    // ── Phases ────────────────────────────────────────────────────────────
    // E2E-P0-3 — defensive shape-guard. programme_phases is JSONB so it
    // could be null, an empty array, a proper Phase[], or (from legacy
    // migration data or a hand-edited row) malformed. Filter to only
    // objects that at minimum have a `name` field. Everything downstream
    // assumes Phase shape so a malformed entry previously crashed the
    // entire Gantt render. (timeline_phases is a ghost column — no such
    // column exists on projects. Kept in the fallback chain so legacy
    // selects elsewhere don't regress silently.)
    const rawPhases = (project.programme_phases ?? project.timeline_phases) as unknown;
    const existingPhases: Phase[] = Array.isArray(rawPhases)
        ? rawPhases.filter(
              (p): p is Phase =>
                  p !== null &&
                  typeof p === "object" &&
                  typeof (p as { name?: unknown }).name === "string",
          )
        : [];

    const initialPhases = useMemo(
        () => buildPhasesFromEstimate(estimate, existingPhases, daysPerWeek),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
    const [phases, setPhases] = useState<Phase[]>(initialPhases);
    const phasesRef = useRef<Phase[]>(phases);
    useEffect(() => { phasesRef.current = phases; }, [phases]);

    // Keep programmeStartRef current so unmount flush can read it
    useEffect(() => { programmeStartRef.current = programmeStart; }, [programmeStart]);

    // ── Auto-save phases whenever they change (debounced 500ms) ──────────
    // 500ms is fast enough that normal navigation won't lose changes.
    // Skips the initial mount so we don't save on first render.
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
            autoSaveTimer.current = null;
            const startDateStr = toInputDate(programmeStartRef.current || programmeStart);
            updatePhasesAction(project.id, phasesRef.current, startDateStr)
                .then(() => {
                    setSaveStatus("saved");
                    setTimeout(() => setSaveStatus("idle"), 2000);
                })
                .catch(console.error);
        }, 500);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phases, programmeStart]);

    // ── Flush unsaved changes immediately when navigating away ────────────
    useEffect(() => {
        return () => {
            if (autoSaveTimer.current) {
                clearTimeout(autoSaveTimer.current);
                autoSaveTimer.current = null;
                const startDateStr = toInputDate(programmeStartRef.current || new Date());
                // Fire-and-forget — best-effort save on unmount
                updatePhasesAction(project.id, phasesRef.current, startDateStr).catch(console.error);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (phases.length === 0) {
            getEstimatePhasesAction(projectId).then((serverPhases) => {
                if (serverPhases.length > 0) {
                    // Re-sequence server phases with current daysPerWeek
                    let offset = 0;
                    const resequenced = serverPhases.map((p) => {
                        const phase = { ...p, startOffset: offset };
                        offset += toCalendarDays(p.manualDays ?? p.calculatedDays, daysPerWeek);
                        return phase;
                    });
                    setPhases(resequenced);
                    saveProgrammePhasesAction(projectId, resequenced);
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Computed values ───────────────────────────────────────────────────
    const totalDays = useMemo(() => {
        const max = phases.reduce((m, p) => {
            const calDur = toCalendarDays(p.manualDays ?? p.calculatedDays, daysPerWeek);
            return Math.max(m, p.startOffset + calDur);
        }, 0);
        return Math.max(max, 7);
    }, [phases, daysPerWeek]);

    const totalDaysRef = useRef(totalDays);
    useEffect(() => { totalDaysRef.current = totalDays; }, [totalDays]);

    const totalWeeks    = Math.max(Math.ceil(totalDays / 7), 4);
    const totalManhours = phases.reduce((s, p) => s + p.manhours, 0);
    const projectEnd    = addDays(programmeStart, totalDays);
    const totalHeight   = phases.length * ROW_H;

    // Critical path: phases ending within the last calendar week
    const criticalSet = useMemo(() => {
        const s = new Set<number>();
        phases.forEach((p, i) => {
            const end = p.startOffset + toCalendarDays(p.manualDays ?? p.calculatedDays, daysPerWeek);
            if (end >= totalDays - 6) s.add(i);
        });
        return s;
    }, [phases, totalDays, daysPerWeek]);

    // Week headers — always Monday dates
    const weekHeaders = useMemo(
        () => Array.from({ length: Math.min(totalWeeks, 52) }, (_, i) => {
            const weekMon = addDays(programmeStart, i * 7);
            return { label: `W${i + 1}`, date: fmtDate(weekMon) };
        }),
        [totalWeeks, programmeStart]
    );

    // ── Drag system ───────────────────────────────────────────────────────
    const handleBarMouseDown = useCallback((e: React.MouseEvent, idx: number, type: DragType) => {
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
            const deltaX   = e.clientX - drag.startClientX;
            const pxPerDay = drag.trackWidth / drag.capturedTotalDays;
            const deltaDays = deltaX / pxPerDay;

            if (drag.type === "move") {
                // Move: snap to 7-day (calendar week) grid
                const snapped = Math.max(0, Math.round((drag.originalValue + deltaDays) / 7) * 7);
                setPhases((prev) => {
                    const u = [...prev];
                    u[drag.phaseIndex] = { ...u[drag.phaseIndex], startOffset: snapped };
                    return u;
                });
            } else {
                // Resize: snap to 1 working-week increments
                const dpw = daysPerWeek; // closed over
                const rawWorking = drag.originalValue + (deltaDays / (7 / dpw));
                const snappedWorking = Math.max(dpw, Math.round(rawWorking / dpw) * dpw);
                setPhases((prev) => {
                    const u = [...prev];
                    u[drag.phaseIndex] = { ...u[drag.phaseIndex], manualDays: snappedWorking };
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
    }, [daysPerWeek]);

    // ── Phase mutations ───────────────────────────────────────────────────
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
            // Snap successor to start exactly when predecessor finishes
            if (depIdx >= 0 && depIdx < prev.length) {
                const pred = u[depIdx];
                const predEnd = pred.startOffset + toCalendarDays(pred.manualDays ?? pred.calculatedDays, daysPerWeek);
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
            (m, p) => Math.max(m, p.startOffset + toCalendarDays(p.manualDays ?? p.calculatedDays, daysPerWeek)), 0
        );
        setPhases((prev) => [
            ...prev,
            { name: "New Phase", calculatedDays: daysPerWeek, manualDays: daysPerWeek, manhours: 0, startOffset: maxEnd },
        ]);
    };

    const sequencePhases = () => {
        setPhases((prev) => {
            let offset = 0;
            return prev.map((p) => {
                const phase = { ...p, startOffset: offset };
                offset += toCalendarDays(p.manualDays ?? p.calculatedDays, daysPerWeek);
                return phase;
            });
        });
        toast.success("Phases sequenced with no gaps");
    };

    // ── Save / Regenerate ─────────────────────────────────────────────────
    const handleSave = () => {
        // Cancel any pending auto-save so we don't double-fire
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        startTransition(async () => {
            setSaveStatus("saving");
            const startDateStr = toInputDate(programmeStart);
            await updatePhasesAction(project.id, phases, startDateStr);
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2500);
            toast.success("Programme saved to proposal");
        });
    };

    const handleRegenerate = () => {
        startTransition(async () => {
            const serverPhases = await getEstimatePhasesAction(projectId);
            if (serverPhases.length > 0) {
                // Re-sequence using current daysPerWeek
                let offset = 0;
                const resequenced = serverPhases.map((p) => {
                    const phase = { ...p, startOffset: offset };
                    offset += toCalendarDays(p.manualDays ?? p.calculatedDays, daysPerWeek);
                    return phase;
                });
                setPhases(resequenced);
                await saveProgrammePhasesAction(projectId, resequenced);
                toast.success("Programme regenerated from estimate");
            } else {
                const regenerated = buildPhasesFromEstimate(estimate, undefined, daysPerWeek);
                if (regenerated.length > 0) {
                    setPhases(regenerated);
                    toast.success("Programme regenerated");
                } else {
                    toast.error("No manhours found — add labour components to the estimate first");
                }
            }
        });
    };

    // ── Render ────────────────────────────────────────────────────────────
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
                            {project.name}{estimate ? ` · ${estimate.version_name}` : " · No active estimate"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {saveStatus === "saving" && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
                    {saveStatus === "saved"  && <span className="text-xs text-emerald-400">✓ Auto-saved</span>}
                    {phases.length > 1 && (
                        <button type="button" onClick={sequencePhases}
                            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                            Auto-sequence
                        </button>
                    )}
                    <button type="button" onClick={handleRegenerate} disabled={isPending}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50">
                        Regenerate from estimate
                    </button>
                    <button type="button" onClick={handleSave} disabled={isPending}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                        Save to Proposal
                    </button>
                </div>
            </div>

            {/* ── Programme settings (start date + working week) ── */}
            <div className="flex items-center gap-4 flex-wrap bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
                {/* Start date */}
                <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Start date</span>
                    <div className="relative">
                        <input
                            type="date"
                            className="h-8 pl-3 pr-2 text-xs border border-slate-700 rounded-lg bg-slate-900/60 text-slate-200 focus:outline-none focus:border-blue-500/60 cursor-pointer"
                            value={toInputDate(programmeStart)}
                            onChange={(e) => handleStartDateChange(e.target.value)}
                        />
                    </div>
                    <span className="text-[10px] text-slate-600">
                        Mon {fmtDate(programmeStart)}
                    </span>
                </div>

                <div className="h-4 border-l border-slate-700/60 hidden sm:block" />

                {/* Working week */}
                <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Working week</span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-700">
                        {[4, 5, 6, 7].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => handleSetDaysPerWeek(n)}
                                className={[
                                    "px-3 py-1.5 text-xs font-semibold border-r border-slate-700 last:border-0 transition-colors",
                                    daysPerWeek === n
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
                                ].join(" ")}
                            >
                                {n}d
                            </button>
                        ))}
                    </div>
                    <span className="text-[10px] text-slate-600">
                        {daysPerWeek === 5 ? "Mon–Fri" : daysPerWeek === 6 ? "Mon–Sat" : daysPerWeek === 4 ? "Mon–Thu" : "7 days"}
                    </span>
                </div>
            </div>

            {/* ── Summary strip ── */}
            {phases.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Duration",    value: `${totalDays}d`, sub: `${totalWeeks} calendar weeks` },
                        { label: "Start",       value: fmtDateFull(programmeStart), sub: `Monday WC` },
                        { label: "Completion",  value: fmtDateFull(projectEnd), sub: "Estimated" },
                        {
                            label: "Manhours",
                            value: totalManhours > 0 ? `${Math.round(totalManhours)}h` : "—",
                            sub: totalManhours > 0 ? `${Math.round(totalManhours / 8)} working days` : "No manhours",
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
                <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                    <span>Drag bar to move · Drag right edge to resize · Snaps to week</span>
                    {criticalSet.size > 0 && <span className="text-yellow-500/80">★ Critical path</span>}
                    {phases.some((p) => (p.dependsOn || []).length > 0) && (
                        <span className="text-amber-500/70">⟶ Dependencies shown</span>
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
                                ? "Add labour components with manhours to estimate lines, then click Regenerate."
                                : "Set an estimate as active to auto-generate the programme."}
                        </p>
                        <button type="button" onClick={addPhase}
                            className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-colors">
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
                        <div className="flex-1 flex">
                            {weekHeaders.map((wk, i) => (
                                <div key={i} className="flex-1 text-center py-1.5 border-r border-slate-700/20 last:border-0" style={{ minWidth: 28 }}>
                                    <div className="text-[9px] font-bold text-slate-500 leading-tight">{wk.label}</div>
                                    <div className="text-[8px] text-slate-600 leading-tight hidden md:block">{wk.date}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex">

                        {/* Left panel */}
                        <div className="shrink-0 border-r border-slate-700/50">
                            {phases.map((phase, idx) => {
                                const workingDur = phase.manualDays ?? phase.calculatedDays;
                                const calDur     = toCalendarDays(workingDur, daysPerWeek);
                                const phaseStart = addDays(programmeStart, phase.startOffset);
                                const phaseEnd   = addDays(programmeStart, phase.startOffset + calDur);
                                const isCritical = criticalSet.has(idx);
                                const colorDef   = PHASE_COLORS[idx % PHASE_COLORS.length];
                                const predIdx    = phase.dependsOn?.[0];

                                return (
                                    <div key={idx} className="flex border-b border-slate-700/30 last:border-0 hover:bg-slate-700/10 transition-colors" style={{ height: ROW_H }}>

                                        {/* Name + dates */}
                                        <div className="w-[216px] px-3 flex flex-col justify-center border-r border-slate-700/30">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${colorDef.bg}${isCritical ? " ring-1 ring-offset-1 ring-offset-slate-900 ring-yellow-400" : ""}`} />
                                                <input
                                                    className="flex-1 min-w-0 font-medium text-sm text-slate-100 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 outline-none truncate"
                                                    value={phase.name}
                                                    onChange={(e) => updatePhaseName(idx, e.target.value)}
                                                />
                                                <button type="button" onClick={() => deletePhase(idx)}
                                                    className="shrink-0 w-4 text-slate-600 hover:text-red-400 transition-colors text-lg leading-none" title="Remove phase">
                                                    ×
                                                </button>
                                            </div>
                                            <div className="text-[9px] text-slate-500 pl-[14px] mt-0.5 flex items-center gap-1.5">
                                                <span>{fmtDate(phaseStart)} – {fmtDate(phaseEnd)}</span>
                                                {phase.manhours > 0 && <span>· {Math.round(phase.manhours)}h</span>}
                                                {isCritical && <span className="text-yellow-500">★</span>}
                                            </div>
                                        </div>

                                        {/* Calc days (working) */}
                                        <div className="w-14 flex items-center justify-center border-r border-slate-700/30 text-xs text-slate-400">
                                            {phase.calculatedDays}d
                                        </div>

                                        {/* Manual override (working days) */}
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

                                        {/* Starts After */}
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

                        {/* ── Gantt track ── */}
                        <div
                            ref={ganttRef}
                            className={`flex-1 relative overflow-hidden select-none${isDragging ? " cursor-grabbing" : ""}`}
                            style={{ height: totalHeight }}
                        >
                            {/* Alternating row stripes */}
                            {phases.map((_, idx) => (
                                <div key={idx}
                                    className={`absolute left-0 right-0 border-b border-slate-700/30${idx % 2 === 1 ? " bg-slate-900/20" : ""}`}
                                    style={{ top: idx * ROW_H, height: ROW_H }}
                                />
                            ))}

                            {/* Vertical week grid lines */}
                            {weekHeaders.map((_, w) => (
                                <div key={w}
                                    className="absolute top-0 bottom-0 border-l border-slate-700/20"
                                    style={{ left: `${(w / totalWeeks) * 100}%` }}
                                />
                            ))}

                            {/* SVG dependency arrows */}
                            {phases.some((p) => (p.dependsOn || []).length > 0) && (
                                <svg className="absolute inset-0 pointer-events-none"
                                    viewBox={`0 0 1000 ${totalHeight}`}
                                    preserveAspectRatio="none"
                                    style={{ width: "100%", height: "100%" }}>
                                    <defs>
                                        <marker id="dep-arrow" markerWidth="7" markerHeight="7"
                                            refX="3.5" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                                            <path d="M 0 1 L 6 3.5 L 0 6 Z" fill="#f59e0b" opacity="0.85" />
                                        </marker>
                                    </defs>
                                    {phases.map((phase, sIdx) =>
                                        (phase.dependsOn || []).map((pIdx) => {
                                            if (pIdx < 0 || pIdx >= phases.length || pIdx === sIdx) return null;
                                            const pred    = phases[pIdx];
                                            const predDur = toCalendarDays(pred.manualDays ?? pred.calculatedDays, daysPerWeek);
                                            const x1 = Math.min(((pred.startOffset + predDur) / totalDays) * 1000, 995);
                                            const y1 = (pIdx + 0.5) * ROW_H;
                                            const x2 = Math.max((phase.startOffset / totalDays) * 1000, 5);
                                            const y2 = (sIdx + 0.5) * ROW_H;
                                            const cx = (x1 + x2) / 2;
                                            return (
                                                <path key={`${pIdx}-${sIdx}`}
                                                    d={`M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`}
                                                    stroke="#f59e0b" strokeWidth="1.5" fill="none"
                                                    opacity="0.7" strokeDasharray="4 3"
                                                    markerEnd="url(#dep-arrow)"
                                                />
                                            );
                                        })
                                    )}
                                </svg>
                            )}

                            {/* Phase bars */}
                            {phases.map((phase, idx) => {
                                const workingDur  = phase.manualDays ?? phase.calculatedDays;
                                const calDur      = toCalendarDays(workingDur, daysPerWeek);
                                const barLeftPct  = (phase.startOffset / totalDays) * 100;
                                const barWidthPct = Math.max((calDur / totalDays) * 100, 1.5);
                                const colorDef    = PHASE_COLORS[idx % PHASE_COLORS.length];
                                const isCritical  = criticalSet.has(idx);
                                const isActive    = isDragging && dragStateRef.current?.phaseIndex === idx;

                                return (
                                    <div key={idx}
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
                                        <div className={[
                                            "relative h-full w-full rounded-md flex items-center pl-2 pr-4 overflow-hidden",
                                            colorDef.bg,
                                            isCritical ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900" : "",
                                            isActive ? "opacity-80 shadow-xl" : "opacity-90 hover:opacity-100 shadow-sm",
                                        ].join(" ")}>
                                            {/* % complete overlay */}
                                            {(phase.pct_complete ?? 0) > 0 && (
                                                <div
                                                    className="absolute bottom-0 left-0 h-1.5 bg-white/40 rounded-b-md"
                                                    style={{ width: `${phase.pct_complete}%` }}
                                                />
                                            )}
                                            <span className="text-white text-[10px] font-semibold truncate select-none">
                                                {(phase.pct_complete ?? 0) > 0 ? `${phase.pct_complete}%` : `${workingDur}d`}
                                            </span>
                                            {/* Resize handle */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center gap-px hover:bg-black/20 rounded-r-md"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    handleBarMouseDown(e as unknown as React.MouseEvent, idx, "resize");
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
                    <button type="button" onClick={addPhase}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/50 border border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                        + Add Phase
                    </button>
                    <div className="flex items-center gap-3">
                        <p className="text-[11px] text-slate-500">
                            Days = working days ({daysPerWeek}d/wk). Bar width = calendar span. ★ = critical path.
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowLiveTracking(v => !v)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${showLiveTracking ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400" : "bg-slate-800/50 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"}`}
                        >
                            {showLiveTracking ? "▲ Hide Live Tracking" : "▼ Live Tracking"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Live Tracking Panel (Sprint 31) ── */}
            {showLiveTracking && phases.length > 0 && (
                <LiveTrackingPanel
                    phases={phases}
                    programmeStart={programmeStart}
                    daysPerWeek={daysPerWeek}
                    projectId={projectId}
                    project={project}
                    onPhasesChange={setPhases}
                />
            )}
        </div>
    );
}

// ─── Live Tracking Panel ──────────────────────────────────────────────────────
function LiveTrackingPanel({
    phases, programmeStart, daysPerWeek, projectId, project, onPhasesChange,
}: {
    phases: Phase[];
    programmeStart: Date;
    daysPerWeek: number;
    projectId: string;
    project: Props["project"];
    onPhasesChange: (phases: Phase[]) => void;
}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overallPct = phases.length > 0
        ? Math.round(phases.reduce((s, p) => s + (p.pct_complete ?? 0), 0) / phases.length)
        : 0;
    const complete = phases.filter(p => (p.pct_complete ?? 0) === 100).length;
    const inProgress = phases.filter(p => (p.pct_complete ?? 0) > 0 && (p.pct_complete ?? 0) < 100).length;
    const delayed = phases.filter(p => {
        const calDur = Math.ceil((p.manualDays ?? p.calculatedDays) / daysPerWeek) * 7;
        const plannedEnd = new Date(programmeStart);
        plannedEnd.setDate(plannedEnd.getDate() + p.startOffset + calDur);
        return plannedEnd < today && (p.pct_complete ?? 0) < 100;
    }).length;

    const handlePctChange = (idx: number, pct: number) => {
        onPhasesChange(phases.map((p, i) => i === idx ? { ...p, pct_complete: pct } : p));
    };
    const handleActualDate = (idx: number, field: "actual_start_date" | "actual_finish_date", val: string) => {
        onPhasesChange(phases.map((p, i) => i === idx ? { ...p, [field]: val || undefined } : p));
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Live Programme Tracking</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Update % complete and actual dates — saves automatically with the Gantt</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Overall</p>
                            <p className={`text-xl font-bold ${overallPct === 100 ? "text-emerald-400" : overallPct > 0 ? "text-blue-400" : "text-slate-400"}`}>{overallPct}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Complete</p>
                            <p className="text-xl font-bold text-emerald-400">{complete}</p>
                        </div>
                        {inProgress > 0 && (
                            <div className="text-right">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider">In Progress</p>
                                <p className="text-xl font-bold text-blue-400">{inProgress}</p>
                            </div>
                        )}
                        {delayed > 0 && (
                            <div className="text-right">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Delayed</p>
                                <p className="text-xl font-bold text-red-400">{delayed}</p>
                            </div>
                        )}
                    </div>
                </div>
                {/* Overall progress bar */}
                <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${overallPct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${overallPct}%` }}
                    />
                </div>
            </div>

            {/* Phase table */}
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-700/50">
                        {["Phase", "Planned Dates", "% Complete", "Actual Start", "Actual Finish", "Status"].map(h => (
                            <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "% Complete" ? "text-center" : "text-left"}`}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {phases.map((phase, idx) => {
                        const calDur = Math.ceil((phase.manualDays ?? phase.calculatedDays) / daysPerWeek) * 7;
                        const plannedStart = new Date(programmeStart);
                        plannedStart.setDate(plannedStart.getDate() + phase.startOffset);
                        const plannedEnd = new Date(plannedStart);
                        plannedEnd.setDate(plannedEnd.getDate() + calDur);
                        const pct = phase.pct_complete ?? 0;
                        const isDelayed = plannedEnd < today && pct < 100;
                        const isComplete = pct === 100;
                        const isInProgress = pct > 0 && pct < 100;
                        const notStarted = pct === 0;

                        const statusLabel = isComplete ? "Complete" : isDelayed ? "Delayed" : isInProgress ? "In Progress" : "Not Started";
                        const statusClass = isComplete
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : isDelayed
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : isInProgress
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                    : "bg-slate-700/30 border-slate-600/30 text-slate-500";

                        const colorDef = ["bg-blue-500","bg-emerald-500","bg-orange-500","bg-purple-500","bg-red-500","bg-teal-500","bg-indigo-500","bg-pink-500","bg-yellow-500","bg-cyan-500"];

                        return (
                            <tr key={idx} className={`border-b border-slate-700/30 hover:bg-slate-700/10 transition-colors ${idx === phases.length - 1 ? "border-0" : ""}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colorDef[idx % colorDef.length]}`} />
                                        <span className="text-sm font-semibold text-slate-100">{phase.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-xs text-slate-400">
                                        {plannedStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                        {" → "}
                                        {plannedEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    </p>
                                    <p className="text-[10px] text-slate-600 mt-0.5">{phase.manualDays ?? phase.calculatedDays}d working</p>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={5}
                                            value={pct}
                                            onChange={e => handlePctChange(idx, parseInt(e.target.value))}
                                            className="w-24 h-1.5 accent-blue-500"
                                        />
                                        <span className={`text-xs font-bold w-8 ${isComplete ? "text-emerald-400" : isDelayed ? "text-red-400" : "text-slate-300"}`}>{pct}%</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="date"
                                        value={phase.actual_start_date ?? ""}
                                        onChange={e => handleActualDate(idx, "actual_start_date", e.target.value)}
                                        className="h-7 px-2 text-xs bg-slate-900/50 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500/50"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="date"
                                        value={phase.actual_finish_date ?? ""}
                                        onChange={e => handleActualDate(idx, "actual_finish_date", e.target.value)}
                                        className="h-7 px-2 text-xs bg-slate-900/50 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500/50"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusClass}`}>
                                        {statusLabel}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* AI Update section */}
            <div className="border-t border-slate-700/50 p-5">
                <ProgrammeAiUpdate projectId={projectId} projectName={project.name} />
            </div>
        </div>
    );
}
