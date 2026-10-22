"use client";

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from "react";
import { updatePhasesAction, getEstimatePhasesAction, saveProgrammePhasesAction } from "./actions";
import ProgrammeAiUpdate from "./programme-ai-update";
import { toast } from "sonner";
import { createLatestWriteQueue } from "@/lib/latest-write-queue";
import {
    estimateSuggestedPhases,
    plannerCalendarDays as toCalendarDays,
    plannerDisplayPlan,
    plannerPhasesOnOpen,
    savedPlannerPhases,
    sequenceSuggestedPhases,
    type PlannerPhase,
} from "@/lib/planner-phases";

// ─── Types ──────────────────────────────────────────────────────────────────
// Working days for lengths, calendar days from the project start for offsets.
type Phase = PlannerPhase;
type ProgrammeWrite = {
    phases: Phase[];
    startDate: string;
    kind: "manual" | "auto";
    operation: symbol;
    context: string;
};
type ProgrammeSaveStatus = {
    state: "idle" | "saving" | "saved" | "error" | "uncertain";
    kind: ProgrammeWrite["kind"];
    operation: symbol | null;
    context: string;
};

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
    if (Number.isNaN(date.getTime())) throw new RangeError("Invalid time value");
    // A date-only field uses the local calendar day, not its UTC timestamp day.
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
    const [isDragging, setIsDragging] = useState(false);
    const [showLiveTracking, setShowLiveTracking] = useState(false);

    const ganttRef           = useRef<HTMLDivElement>(null);
    const dragStateRef       = useRef<DragState | null>(null);
    const lastAutoSaveInputs = useRef<{ phases: Phase[]; programmeStart: Date } | null>(null);
    // Set just before a suggestion is put on screen, so showing it is not a save.
    const skipNextAutoSave   = useRef(false);
    const autoSaveTimer      = useRef<NodeJS.Timeout | null>(null);
    const programmeStartRef  = useRef<Date | null>(null);
    // Regeneration and the existing coalesced autosave must not race each other.
    const [serializeProgrammeWrite] = useState(() => {
        let tail: Promise<unknown> | null = null;
        return <T,>(write: () => Promise<T>): Promise<T> => {
            const result = tail ? tail.then(write, write) : write();
            const settled = result.then(() => undefined, () => undefined);
            tail = settled;
            void settled.then(() => { if (tail === settled) tail = null; });
            return result;
        };
    });
    const [persistPhases] = useState(() => createLatestWriteQueue(
        (input: ProgrammeWrite) => serializeProgrammeWrite(async () => ({
            input,
            result: await updatePhasesAction(project.id, input.phases, input.startDate),
        })),
    ));

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
    const existingPhases = savedPlannerPhases((project.programme_phases ?? project.timeline_phases) as unknown);

    // The saved programme opens exactly as it was saved. Stages worked out
    // from the estimate are only ever a starting point for a job that has
    // no programme, and are not saved by being shown.
    const opening = useMemo(
        () => plannerPhasesOnOpen(existingPhases, estimate, daysPerWeek),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
    const [phases, setPhases] = useState<Phase[]>(opening.phases);
    const [isSuggestion, setIsSuggestion] = useState(opening.origin === "suggested");
    const phasesRef = useRef<Phase[]>(phases);
    useEffect(() => { phasesRef.current = phases; }, [phases]);

    // Keep programmeStartRef current so unmount flush can read it
    useEffect(() => { programmeStartRef.current = programmeStart; }, [programmeStart]);

    const regenerationContext = JSON.stringify([projectId, project, estimate, daysPerWeek, programmeStart, phases]);
    const regenerationContextRef = useRef(regenerationContext);
    const regenerationRequest = useRef<symbol | null>(null);
    const regenerationMounted = useRef(false);
    const regenerationProject = useRef(projectId);
    const confirmedRegeneration = useRef<{ phases: Phase[]; programmeStart: Date } | null>(null);
    const regenerationUncertain = useRef(false);
    const [regenerationNotice, setRegenerationNotice] = useState("");
    const [regenerationBlocked, setRegenerationBlocked] = useState(false);
    useEffect(() => { regenerationContextRef.current = regenerationContext; }, [regenerationContext]);
    useEffect(() => {
        regenerationMounted.current = true;
        regenerationProject.current = projectId;
        return () => { regenerationMounted.current = false; regenerationRequest.current = null; };
    }, [projectId]);

    const saveContext = JSON.stringify([projectId, project.id, phases, toInputDate(programmeStart)]);
    const saveContextRef = useRef(saveContext);
    const latestSaveOperation = useRef<symbol | null>(null);
    const manualSaveRequest = useRef<symbol | null>(null);
    const [saveStatus, setSaveStatus] = useState<ProgrammeSaveStatus>(() => ({
        state: "idle", kind: "auto", operation: null, context: saveContext,
    }));
    useEffect(() => { saveContextRef.current = saveContext; }, [saveContext]);

    const saveProgramme = async (kind: ProgrammeWrite["kind"], snapshot: Phase[], startDate: string) => {
        const input: ProgrammeWrite = {
            phases: snapshot, startDate, kind, operation: Symbol(kind),
            context: JSON.stringify([projectId, project.id, snapshot, startDate]),
        };
        latestSaveOperation.current = input.operation;
        setSaveStatus({ ...input, state: "saving" });
        const isCurrent = () => regenerationMounted.current && regenerationProject.current === projectId &&
            latestSaveOperation.current === input.operation && saveContextRef.current === input.context;
        try {
            const receipt = await persistPhases(input);
            // Coalesced callers receive the last attempted write, not necessarily their own.
            if (!isCurrent() || receipt.input.operation !== input.operation) return;
            if (!receipt.result.success) {
                setSaveStatus({ ...input, state: "error" });
                toast.error(receipt.result.error);
                return;
            }
            setSaveStatus({ ...input, state: "saved" });
            if (kind === "manual") toast.success("Programme saved to proposal");
            setTimeout(() => {
                if (!isCurrent()) return;
                setSaveStatus(previous => previous.operation === input.operation && previous.state === "saved"
                    ? { ...previous, state: "idle" } : previous);
            }, kind === "manual" ? 2500 : 2000);
        } catch {
            if (!isCurrent()) return;
            setSaveStatus({ ...input, state: "uncertain" });
            toast.error("Programme save was not confirmed and may already have completed. Your current stages remain on screen; review before retrying.");
        }
    };
    const currentSaveState = saveStatus.context === saveContext ? saveStatus.state : "changed";
    const saveMessage = currentSaveState === "saving"
        ? (saveStatus.kind === "manual" ? "Saving programme to proposal..." : "Auto-saving changes...")
        : currentSaveState === "saved"
            ? (saveStatus.kind === "manual" ? "Programme saved to proposal" : "Changes auto-saved")
            : currentSaveState === "error" ? "Save not confirmed. Current stages remain on screen."
                : currentSaveState === "uncertain" ? "Save uncertain: it may already have completed. Review before retrying."
                    : currentSaveState === "changed" ? "Current changes are not yet confirmed saved." : "";

    // ── Auto-save phases whenever they change (debounced 500ms) ──────────
    // 500ms is fast enough that normal navigation won't lose changes.
    // Only changed inputs save; mount-effect replay is still just opening the planner.
    useEffect(() => {
        const previous = lastAutoSaveInputs.current;
        lastAutoSaveInputs.current = { phases, programmeStart };
        if (!previous || (previous.phases === phases && previous.programmeStart === programmeStart)) {
            return;
        }
        if (skipNextAutoSave.current) {
            skipNextAutoSave.current = false;
            return;
        }
        const confirmed = confirmedRegeneration.current;
        confirmedRegeneration.current = null;
        if (confirmed?.phases === phases && confirmed.programmeStart === programmeStart) {
            return;
        }
        // From here the contractor has changed something, so it is theirs.
        setIsSuggestion(false);
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
            autoSaveTimer.current = null;
            const startDateStr = toInputDate(programmeStartRef.current || programmeStart);
            void saveProgramme("auto", phasesRef.current, startDateStr);
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
                persistPhases({
                    phases: phasesRef.current, startDate: startDateStr, kind: "auto",
                    operation: Symbol("unmount"), context: "unmount",
                }).catch(console.error);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (phases.length === 0) {
            getEstimatePhasesAction(projectId).then((serverPhases) => {
                if (!regenerationMounted.current || regenerationRequest.current ||
                    regenerationContextRef.current !== regenerationContext || confirmedRegeneration.current) return;
                if (serverPhases.length > 0) {
                    // A starting point only. It is shown, not saved: the
                    // proposal has no programme until the contractor makes one.
                    skipNextAutoSave.current = true;
                    setIsSuggestion(true);
                    setPhases(sequenceSuggestedPhases(serverPhases, daysPerWeek));
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

    const totalWeeks    = Math.max(Math.ceil(totalDays / 7), 4);
    // Bars, headers, arrows and pointer input share the displayed calendar span.
    const axisDays = totalWeeks * 7;
    const axisDaysRef = useRef(axisDays);
    useEffect(() => { axisDaysRef.current = axisDays; }, [axisDays]);

    const totalManhours = phases.reduce((s, p) => s + p.manhours, 0);
    const displayPlan = plannerDisplayPlan(toInputDate(programmeStart), phases, daysPerWeek);
    // Stage offsets are relative to the plan's first activity, not the weekly axis.
    const planAxisOffset = displayPlan
        ? (Date.parse(displayPlan.start_date) - Date.parse(toInputDate(programmeStart))) / 86_400_000
        : 0;
    const datedSpans = displayPlan?.stages.map(stage => ({
        startOffset: planAxisOffset + stage.offset_days,
        calendarDays: stage.span_days,
    }));
    // Legacy dates outside this axis keep the existing geometry rather than being clipped or rewritten.
    const useDatedSpans = datedSpans?.every(span => span.startOffset >= 0 && span.startOffset + span.calendarDays <= axisDays);
    const barSpans = phases.map((phase, index) => useDatedSpans ? datedSpans![index] : {
        startOffset: phase.startOffset,
        calendarDays: toCalendarDays(phase.manualDays ?? phase.calculatedDays, daysPerWeek),
    });
    const displayedStart = displayPlan ? new Date(displayPlan.start_date + "T00:00:00") : programmeStart;
    const projectEnd    = displayPlan ? new Date(displayPlan.end_date + "T00:00:00") : addDays(programmeStart, totalDays);
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

    // Label the whole axis with bounded calendar-week groups, always starting Monday.
    const weekHeaders = useMemo(
        () => {
            const weeksPerHeader = Math.max(1, Math.ceil(totalWeeks / 12));
            return Array.from({ length: Math.ceil(totalWeeks / weeksPerHeader) }, (_, i) => {
                const weekIndex = i * weeksPerHeader;
                const weeks = Math.min(weeksPerHeader, totalWeeks - weekIndex);
                const weekMon = addDays(programmeStart, weekIndex * 7);
                const label = weeks === 1 ? `W${weekIndex + 1}` : `W${weekIndex + 1}-W${weekIndex + weeks}`;
                return {
                    weekIndex, weeks, label, date: fmtDate(weekMon),
                    range: `${label}: ${toInputDate(weekMon)} to ${toInputDate(addDays(weekMon, weeks * 7 - 1))}`,
                };
            });
        },
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
            capturedTotalDays: axisDaysRef.current,
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
        if (isPending || manualSaveRequest.current || regenerationRequest.current ||
            !regenerationMounted.current || project.id !== projectId || saveContextRef.current !== saveContext) return;
        // Cancel any pending auto-save so we don't double-fire
        if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = null;
        }
        setIsSuggestion(false);
        const request = Symbol("manual save");
        manualSaveRequest.current = request;
        startTransition(async () => {
            try {
                await saveProgramme("manual", phases, toInputDate(programmeStart));
            } finally {
                if (manualSaveRequest.current === request) manualSaveRequest.current = null;
            }
        });
    };

    const handleRegenerate = () => {
        if (isPending || regenerationRequest.current || regenerationUncertain.current ||
            !regenerationMounted.current || regenerationContextRef.current !== regenerationContext) return;
        // This replaces the programme, so the contractor's own stages are
        // never swapped for estimate sections without them saying so.
        if (phases.length > 0 && !isSuggestion && !window.confirm(
            `Replace your ${phases.length} saved ${phases.length === 1 ? "stage" : "stages"} with stages worked out from the estimate?\n\nYour stage names, lengths and order will be lost.`,
        )) return;
        const request = Symbol("regenerate");
        regenerationRequest.current = request;
        setRegenerationNotice("");
        const isCurrent = () => regenerationMounted.current && regenerationRequest.current === request &&
            regenerationContextRef.current === regenerationContext;
        startTransition(async () => {
            let attemptedSave = false;
            try {
                const serverPhases = await getEstimatePhasesAction(projectId);
                if (!isCurrent()) return;
                if (serverPhases.length > 0) {
                    const resequenced = sequenceSuggestedPhases(serverPhases, daysPerWeek);
                    const saved = await serializeProgrammeWrite(async () => {
                        if (!isCurrent()) return false;
                        attemptedSave = true;
                        // This existing action resolves only after its guarded write; refusals throw.
                        await saveProgrammePhasesAction(projectId, resequenced);
                        return true;
                    });
                    if (!saved) return;
                    if (!isCurrent()) {
                        if (regenerationMounted.current && regenerationProject.current === projectId) {
                            setRegenerationNotice("The earlier regeneration save completed, but the programme changed meanwhile. Your newer stages remain on screen; this does not confirm they are saved.");
                        }
                        return;
                    }
                    confirmedRegeneration.current = { phases: resequenced, programmeStart };
                    setSaveStatus({
                        state: "idle", kind: "manual", operation: null,
                        context: JSON.stringify([projectId, project.id, resequenced, toInputDate(programmeStart)]),
                    });
                    setPhases(previous => previous === phases ? resequenced : previous);
                    setIsSuggestion(false);
                    toast.success("Programme regenerated from estimate and saved");
                } else {
                    const regenerated = estimateSuggestedPhases(estimate, daysPerWeek);
                    if (regenerated.length > 0) {
                        setPhases(previous => previous === phases ? regenerated : previous);
                        toast.success("Estimate stages prepared; existing programme autosave will save them");
                    } else {
                        toast.error("No manhours found — add labour components to the estimate first");
                    }
                }
            } catch {
                if (!regenerationMounted.current || regenerationProject.current !== projectId) return;
                if (attemptedSave) {
                    regenerationUncertain.current = true;
                    setRegenerationBlocked(true);
                }
                const message = attemptedSave
                    ? "Regeneration save was not confirmed and may already have saved. Your current stages remain on screen. Reload Programme before regenerating again."
                    : "Could not read estimate stages. Your current programme is unchanged.";
                setRegenerationNotice(message);
                toast.error(message);
            } finally {
                if (regenerationRequest.current === request) regenerationRequest.current = null;
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
                    {saveMessage && <span role="status" aria-live="polite" data-programme-save-state={currentSaveState}
                        className={currentSaveState === "saved" ? "text-xs text-emerald-400" : "text-xs text-slate-400"}>
                        {saveMessage}
                    </span>}
                    {phases.length > 1 && (
                        <button type="button" onClick={sequencePhases}
                            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                            Auto-sequence
                        </button>
                    )}
                    <button type="button" onClick={handleRegenerate} disabled={isPending || regenerationBlocked}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50">
                        Regenerate from estimate
                    </button>
                    <button type="button" onClick={handleSave} disabled={isPending} aria-label="Save programme to proposal"
                        title="Save this programme to the proposal. Edited stages also use the existing automatic save."
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                        Save to Proposal
                    </button>
                </div>
            </div>

            {regenerationNotice && <p role="status" className="text-sm text-amber-400">{regenerationNotice}</p>}

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
                        { label: "Duration",    value: displayPlan?.duration_label ?? `${totalDays}d`, sub: displayPlan ? `${displayPlan.working_days} working days / ${displayPlan.calendar_days} calendar days` : `${totalWeeks} calendar weeks` },
                        { label: "Start",       value: fmtDateFull(displayedStart), sub: displayPlan ? "First working day" : "Monday WC" },
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
                    {weekHeaders[0].weeks > 1 && (
                        <span>Grid columns group up to {weekHeaders[0].weeks} calendar weeks; the last column may be shorter. Weekly move and resize snapping is unchanged.</span>
                    )}
                    {criticalSet.size > 0 && <span className="text-yellow-500/80">★ Critical path</span>}
                    {phases.some((p) => (p.dependsOn || []).length > 0) && (
                        <span className="text-amber-500/70">⟶ Dependencies shown</span>
                    )}
                </div>
            )}

            {/* ── A starting point that is not yet the programme ── */}
            {isSuggestion && phases.length > 0 && (
                <p role="note" data-planner-suggestion className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    These stages are a starting point taken from your estimate. They are not saved, and your proposal does not
                    use them, until you change one or press Save to Proposal.
                </p>
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
                            {weekHeaders.map(wk => (
                                <div key={wk.weekIndex} data-planner-week-start={wk.weekIndex + 1} data-planner-week-span={wk.weeks}
                                    title={wk.range} aria-label={wk.range}
                                    className="shrink-0 min-w-0 text-center py-1.5 border-r border-slate-700/20 last:border-0" style={{ width: `${wk.weeks / totalWeeks * 100}%` }}>
                                    <div className="text-[9px] font-bold text-slate-500 leading-tight truncate">{wk.label}</div>
                                    <div className="text-[8px] text-slate-600 leading-tight truncate hidden md:block">{wk.date}</div>
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
                                const displayStage = displayPlan?.stages[idx];
                                const phaseStart = displayStage ? new Date(displayStage.start_date + "T00:00:00") : addDays(programmeStart, phase.startOffset);
                                const phaseEnd   = displayStage ? new Date(displayStage.end_date + "T00:00:00") : addDays(programmeStart, phase.startOffset + calDur);
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
                            {weekHeaders.map(wk => (
                                <div key={wk.weekIndex} data-planner-grid-week={wk.weekIndex + 1}
                                    className="absolute top-0 bottom-0 border-l border-slate-700/20"
                                    style={{ left: `${(wk.weekIndex / totalWeeks) * 100}%` }}
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
                                            refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                                            <path d="M 0 1 L 6 3.5 L 0 6 Z" fill="#f59e0b" opacity="0.85" />
                                        </marker>
                                    </defs>
                                    {phases.map((phase, sIdx) =>
                                        (phase.dependsOn || []).map((pIdx) => {
                                            if (pIdx < 0 || pIdx >= phases.length || pIdx === sIdx) return null;
                                            const predSpan = barSpans[pIdx];
                                            const x1 = ((predSpan.startOffset + predSpan.calendarDays) / axisDays) * 1000;
                                            const y1 = (pIdx + 0.5) * ROW_H;
                                            const x2 = (barSpans[sIdx].startOffset / axisDays) * 1000;
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
                                const barLeftPct  = (barSpans[idx].startOffset / axisDays) * 100;
                                const barWidthPct = (barSpans[idx].calendarDays / axisDays) * 100;
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
                                        }}
                                        onMouseDown={(e) => handleBarMouseDown(e, idx, "move")}
                                    >
                                        <div data-planner-duration={idx} className={[
                                            "relative h-full w-full min-w-0 rounded-md overflow-hidden",
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
                                            <span className="absolute inset-0 flex items-center pl-2 pr-4 text-white text-[10px] font-semibold truncate select-none pointer-events-none">
                                                {(phase.pct_complete ?? 0) > 0 ? `${phase.pct_complete}%` : `${workingDur}d`}
                                            </span>
                                        </div>
                                        {/* Interaction area and start tick never stretch the duration fill. */}
                                        <div data-planner-start-marker={idx} aria-hidden="true"
                                            className="absolute left-0 top-0 bottom-0 border-l border-white/80 pointer-events-none" />
                                        <div data-planner-move-target={idx}
                                            className="absolute inset-0 z-10"
                                            style={{ minWidth: 24 }}
                                            title={`${phase.name}: ${workingDur} working days. Drag to move; this target is not extra duration.`}
                                        />
                                        <div data-planner-resize-target={idx}
                                            className="absolute right-0 top-0 bottom-0 z-20 w-3 cursor-ew-resize flex items-center justify-center gap-px hover:outline hover:outline-1 hover:outline-slate-300 rounded-r-md"
                                            title={`Resize ${phase.name}; grip width is not duration`}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                handleBarMouseDown(e as unknown as React.MouseEvent, idx, "resize");
                                            }}
                                        >
                                            <div className="w-px h-3 bg-white/50 rounded-full" />
                                            <div className="w-px h-3 bg-white/50 rounded-full" />
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
                            Days = working days ({daysPerWeek}d/wk). Coloured bar = calendar span; ticks and grips are controls, not extra days. ★ = critical path.
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
                    displayPlan={displayPlan}
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
    phases, displayPlan, programmeStart, daysPerWeek, projectId, project, onPhasesChange,
}: {
    phases: Phase[];
    displayPlan: ReturnType<typeof plannerDisplayPlan>;
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
    // Use the same complete five-day plan as the chart, including its inclusive finish.
    // Other working weeks and invalid/partial plans keep the existing tracking fallback.
    const plannedDates = phases.map((phase, index) => {
        const stage = displayPlan?.stages[index];
        if (stage) return { start: new Date(stage.start_date + "T00:00:00"), end: new Date(stage.end_date + "T00:00:00") };
        const calDur = Math.ceil((phase.manualDays ?? phase.calculatedDays) / daysPerWeek) * 7;
        const plannedStart = new Date(programmeStart);
        plannedStart.setDate(plannedStart.getDate() + phase.startOffset);
        const plannedEnd = new Date(plannedStart);
        plannedEnd.setDate(plannedEnd.getDate() + calDur);
        return { start: plannedStart, end: plannedEnd };
    });
    const delayed = phases.filter((p, index) => {
        const plannedEnd = displayPlan ? plannedDates[index].end : new Date(programmeStart);
        if (!displayPlan) {
            const calDur = Math.ceil((p.manualDays ?? p.calculatedDays) / daysPerWeek) * 7;
            plannedEnd.setDate(plannedEnd.getDate() + p.startOffset + calDur);
        }
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
                        const { start: plannedStart, end: plannedEnd } = plannedDates[idx];
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
