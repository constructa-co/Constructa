"use client";

import { useState, useTransition, useMemo } from "react";
import { updatePhasesAction, getEstimatePhasesAction, saveProgrammePhasesAction } from "./actions";

// ─── Types ──────────────────────────────────────────────
interface Phase {
    name: string;
    calculatedDays: number;
    manualDays: number | null;
    manhours: number;
    startOffset: number; // days from project start
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

const SECTION_COLORS = [
    "bg-blue-500",
    "bg-green-500",
    "bg-orange-500",
    "bg-purple-500",
    "bg-red-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-cyan-500",
];

function formatGBP(n: number): string {
    return "\u00A3" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Build phases from estimate manhours ────────────────
function buildPhasesFromEstimate(estimate: Estimate | null, existingPhases?: Phase[]): Phase[] {
    if (!estimate) return existingPhases || [];

    // Group manhours by trade section
    const sectionManhours: Record<string, number> = {};
    (estimate.estimate_lines || []).forEach((line) => {
        const section = line.trade_section || "General";
        const lineManHours = (line.estimate_line_components || []).reduce(
            (sum, c) => sum + (c.total_manhours || 0),
            0
        );
        // Multiply by parent line quantity for total manhours for this line
        const totalForLine = lineManHours * (line.quantity || 1);
        sectionManhours[section] = (sectionManhours[section] || 0) + totalForLine;
    });

    // Build phases — use existing manual overrides if available
    const existingMap = new Map<string, Phase>();
    (existingPhases || []).forEach((p) => existingMap.set(p.name, p));

    const sections = Object.keys(sectionManhours).filter((s) => sectionManhours[s] > 0);
    if (sections.length === 0 && existingPhases && existingPhases.length > 0) return existingPhases;

    let offset = 0;
    return sections.map((section) => {
        const manhours = sectionManhours[section];
        // 1 operative, 8hr day
        const calculatedDays = Math.ceil(manhours / 8);
        const existing = existingMap.get(section);
        const manualDays = existing?.manualDays ?? null;
        const duration = manualDays ?? calculatedDays;

        const phase: Phase = {
            name: section,
            calculatedDays,
            manualDays,
            manhours,
            startOffset: offset,
        };
        offset += duration;
        return phase;
    });
}

// ─── Main Component ─────────────────────────────────────
export default function ClientSchedulePage({ project, estimate, projectId }: Props) {
    const [isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    const existingPhases = (project.programme_phases as Phase[] | undefined) || (project.timeline_phases as Phase[] | undefined);
    const initialPhases = useMemo(
        () => buildPhasesFromEstimate(estimate, existingPhases),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [estimate, project.programme_phases, project.timeline_phases]
    );

    const [phases, setPhases] = useState<Phase[]>(initialPhases);

    const projectStart = project.start_date ? new Date(project.start_date) : new Date();

    // Total project duration
    const totalDays = phases.reduce((sum, p) => {
        const dur = p.manualDays ?? p.calculatedDays;
        return Math.max(sum, p.startOffset + dur);
    }, 0);
    const totalWeeks = Math.ceil(totalDays / 7) || 1;

    // Week headers
    const weekHeaders = Array.from({ length: totalWeeks }, (_, i) => {
        const weekStart = addDays(projectStart, i * 7);
        return formatDate(weekStart);
    });

    const handleManualDuration = (index: number, value: string) => {
        const days = value === "" ? null : parseInt(value);
        setPhases((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], manualDays: days };
            // Recalculate offsets
            let offset = 0;
            for (let i = 0; i < updated.length; i++) {
                updated[i] = { ...updated[i], startOffset: offset };
                offset += updated[i].manualDays ?? updated[i].calculatedDays;
            }
            return updated;
        });
    };

    const handleRegenerate = () => {
        startTransition(async () => {
            const serverPhases = await getEstimatePhasesAction(projectId);
            if (serverPhases.length > 0) {
                setPhases(serverPhases);
                await saveProgrammePhasesAction(projectId, serverPhases);
            } else {
                // Fallback to local computation
                const regenerated = buildPhasesFromEstimate(estimate, undefined);
                setPhases(regenerated);
            }
        });
    };

    const handleSave = () => {
        startTransition(async () => {
            setSaveStatus("saving");
            await updatePhasesAction(project.id, phases);
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
        });
    };

    const addPhase = () => {
        const newPhase: Phase = {
            name: "New Phase",
            calculatedDays: 5,
            manualDays: null,
            manhours: 0,
            startOffset: phases.reduce((max, p) => Math.max(max, p.startOffset + (p.manualDays ?? p.calculatedDays)), 0),
        };
        setPhases(prev => [...prev, newPhase]);
    };

    const updatePhaseName = (index: number, name: string) => {
        setPhases(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], name };
            return updated;
        });
    };

    const deletePhase = (index: number) => {
        setPhases(prev => {
            const updated = prev.filter((_, i) => i !== index);
            // Recalculate offsets
            let offset = 0;
            for (let i = 0; i < updated.length; i++) {
                updated[i] = { ...updated[i], startOffset: offset };
                offset += updated[i].manualDays ?? updated[i].calculatedDays;
            }
            return updated;
        });
    };

    const totalManhours = phases.reduce((sum, p) => sum + p.manhours, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Programme</h1>
                    <p className="text-sm text-slate-500">
                        {project.name} — {estimate ? `From: ${estimate.version_name}` : "No active estimate"}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {saveStatus === "saving" && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
                    {saveStatus === "saved" && <span className="text-xs text-green-500">Saved</span>}
                    <button
                        onClick={handleRegenerate}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        Regenerate from estimate
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                        Save to Proposal
                    </button>
                </div>
            </div>

            {/* Info */}
            {totalManhours > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-6 text-sm text-blue-700">
                    <span>Total manhours: <strong>{totalManhours.toFixed(0)}h</strong></span>
                    <span>Total duration: <strong>{totalDays} days</strong> ({totalWeeks} weeks)</span>
                    <span>Start: <strong>{formatDate(projectStart)}</strong></span>
                    <span>End: <strong>{formatDate(addDays(projectStart, totalDays))}</strong></span>
                </div>
            )}

            {phases.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <p className="text-lg mb-2">No programme phases</p>
                    <p className="text-sm">
                        {estimate
                            ? "Add labour components with manhours to your estimate lines to auto-generate a programme."
                            : "Set an estimate as active to generate the programme."}
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {/* Week headers */}
                    <div className="flex border-b border-slate-200">
                        <div className="w-64 flex-shrink-0 bg-slate-50 px-4 py-2 border-r border-slate-200">
                            <span className="text-xs font-bold uppercase text-slate-500">Phase / Trade</span>
                        </div>
                        <div className="w-20 flex-shrink-0 bg-slate-50 px-2 py-2 border-r border-slate-200 text-center">
                            <span className="text-xs font-bold uppercase text-slate-500">Days</span>
                        </div>
                        <div className="w-20 flex-shrink-0 bg-slate-50 px-2 py-2 border-r border-slate-200 text-center">
                            <span className="text-xs font-bold uppercase text-slate-500">Override</span>
                        </div>
                        <div className="flex-1 bg-slate-50 flex">
                            {weekHeaders.map((wk, i) => (
                                <div
                                    key={i}
                                    className="flex-1 text-center text-[10px] text-slate-500 font-medium py-2 border-r border-slate-100 last:border-0"
                                    style={{ minWidth: 40 }}
                                >
                                    {wk}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Phase rows */}
                    {phases.map((phase, idx) => {
                        const duration = phase.manualDays ?? phase.calculatedDays;
                        const barLeft = totalDays > 0 ? (phase.startOffset / totalDays) * 100 : 0;
                        const barWidth = totalDays > 0 ? Math.max((duration / totalDays) * 100, 1) : 0;
                        const color = SECTION_COLORS[idx % SECTION_COLORS.length];
                        const phaseStart = addDays(projectStart, phase.startOffset);
                        const phaseEnd = addDays(projectStart, phase.startOffset + duration);

                        return (
                            <div key={idx} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                {/* Phase name */}
                                <div className="w-64 flex-shrink-0 px-4 py-3 border-r border-slate-100">
                                    <input
                                        className="font-medium text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 outline-none w-full"
                                        value={phase.name}
                                        onChange={e => updatePhaseName(idx, e.target.value)}
                                    />
                                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                        <span>{formatDate(phaseStart)} – {formatDate(phaseEnd)}</span>
                                        {phase.manhours > 0 && <span>{phase.manhours.toFixed(0)}h</span>}
                                        <button
                                            type="button"
                                            onClick={() => deletePhase(idx)}
                                            className="text-red-400 hover:text-red-600 ml-auto"
                                            title="Remove phase"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                {/* Calculated duration */}
                                <div className="w-20 flex-shrink-0 px-2 py-3 border-r border-slate-100 text-center text-sm text-slate-600">
                                    {phase.calculatedDays}d
                                </div>

                                {/* Manual override */}
                                <div className="w-20 flex-shrink-0 px-2 py-3 border-r border-slate-100 flex items-center justify-center">
                                    <input
                                        type="number"
                                        className="w-14 h-7 px-1 text-center text-xs border border-slate-200 rounded bg-white text-slate-700"
                                        value={phase.manualDays ?? ""}
                                        onChange={(e) => handleManualDuration(idx, e.target.value)}
                                        placeholder="—"
                                    />
                                </div>

                                {/* Gantt bar */}
                                <div className="flex-1 relative py-3 px-1">
                                    <div className="relative h-7 bg-slate-100 rounded overflow-hidden">
                                        <div
                                            className={`absolute h-full ${color} rounded opacity-90 text-white text-[10px] flex items-center justify-center whitespace-nowrap transition-all duration-300`}
                                            style={{
                                                left: `${barLeft}%`,
                                                width: `${barWidth}%`,
                                            }}
                                        >
                                            {duration}d
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Phase button */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={addPhase}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                >
                    + Add Phase
                </button>
            </div>

            {/* Note */}
            <p className="text-xs text-slate-400">
                Durations calculated from estimated manhours (1 operative, 8hr day). Adjust manually if needed.
            </p>
        </div>
    );
}
