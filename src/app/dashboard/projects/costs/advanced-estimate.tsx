"use client";
// The full estimating workspace: bill of quantities by trade section, rate
// build-ups, cost library search, estimate versions, client BoQ import and
// drawing take-off. It is opened from the Advanced estimating disclosure on
// the simple pricing screen, which owns the estimates and the running total.

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    createEstimateAction,
    updateEstimateMarginsAction,
    updateEstimateNameAction,
    addLineItemAction,
    updateLineItemAction,
    deleteLineItemAction,
    setActiveEstimateAction,
    deleteEstimateAction,
    setPricingModeAction,
    saveDiscountAction,
} from "./actions";
import { Plus, Trash2, Check, Star, Loader2, ClipboardList, FileDown } from "lucide-react";
import BuildUpPanel from "./build-up-panel";
import VisionTakeoff from "@/app/dashboard/foundations/vision-takeoff";
import BoQImport from "./boq-import";
import { exportBoQToExcel } from "./boq-excel-export";
import { isCapabilityEnabled } from "@/lib/launch-profile";
import { formatGBP } from "@/lib/simple-estimate";
import type { EstimateLineComponent, EstimateLine, Estimate, CostLibraryItem, LabourRate, RateBuildup } from "./types";

interface Props {
    estimates: Estimate[];
    /** Updates the estimates held by the pricing screen. */
    setEstimates: (update: (estimates: Estimate[]) => Estimate[]) => void;
    activeTab: string;
    setActiveTab: (estimateId: string) => void;
    costLibrary: CostLibraryItem[];
    projectId: string;
    orgId: string;
    rateBuildups: RateBuildup[];
    labourRates: LabourRate[];
    preferredTrades: string[];
}

const TRADE_SECTIONS = [
    "Preliminaries",
    "Demolition",
    "Groundworks",
    "Concrete",
    "Drainage",
    "Utilities",
    "Surfacing",
    "Masonry",
    "Structural Steel",
    "Roofing",
    "Carpentry",
    "Windows & Doors",
    "Electrical",
    "Plumbing",
    "Heating & HVAC",
    "Drylining & Partitions",
    "Plastering",
    "Finishes",
    "External Works",
    "Subcontract",
    "Provisional Sums",
    "General",
];

const UNITS = ["m", "m2", "m3", "nr", "item", "day", "week", "tonne", "kg", "lm"];

const LINE_TYPES = ["general", "labour", "plant", "material", "subcontract", "consultancy"];

// ─── Main Component ──────────────────────────────────────

export default function AdvancedEstimate({ estimates, setEstimates, activeTab, setActiveTab, costLibrary, projectId, orgId, rateBuildups, labourRates, preferredTrades }: Props) {
    const router = useRouter();
    const showClientBoQImport = isCapabilityEnabled("client-boq-import");
    const showDrawingTakeoff = isCapabilityEnabled("drawing-takeoff");

    // Ref to hold newly-imported estimate ID across the close handler — avoids stale closure issues
    const importedEstimateIdRef = useRef<string | null>(null);

    const [_isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [openBuildUpPanels, setOpenBuildUpPanels] = useState<Set<string>>(new Set());
    const [showBoQImport, setShowBoQImport] = useState(false);

    const currentEstimate = estimates.find((e) => e.id === activeTab);

    const showSaving = useCallback(() => {
        setSaveStatus("saving");
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }, []);

    const showSaved = useCallback(() => {
        setSaveStatus("saved");
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, []);

    const showSaveError = useCallback((message: string) => {
        setSaveStatus("error");
        toast.error(message);
    }, []);

    // ─── Estimate CRUD ──────────────────────────────────
    const handleCreateEstimate = () => {
        const name = `Estimate v${estimates.length + 1}`;
        startTransition(async () => {
            showSaving();
            try {
                const result = await createEstimateAction(projectId, name);
                if (!result) {
                    showSaveError("Failed to create estimate");
                    return;
                }
                const newEst: Estimate = {
                    ...result,
                    estimate_lines: [],
                    overhead_pct: result.overhead_pct ?? 10,
                    profit_pct: result.profit_pct ?? 15,
                    risk_pct: result.risk_pct ?? 0,
                    prelims_pct: result.prelims_pct ?? 10,
                    discount_pct: result.discount_pct ?? 0,
                    discount_reason: result.discount_reason ?? "",
                    total_cost: 0,
                    is_active: false,
                };
                setEstimates((prev) => [...prev, newEst]);
                setActiveTab(result.id);
                showSaved();
            } catch (error) {
                console.error(error);
                showSaveError("Failed to create estimate");
            }
        });
    };

    const handleDeleteEstimate = (estId: string) => {
        if (!confirm("Delete this estimate and all its line items?")) return;
        startTransition(async () => {
            showSaving();
            try {
                await deleteEstimateAction(estId);
                setEstimates((prev) => prev.filter((e) => e.id !== estId));
                if (activeTab === estId) {
                    const remaining = estimates.filter((e) => e.id !== estId);
                    setActiveTab(remaining[0]?.id || "");
                }
                showSaved();
            } catch (error) {
                console.error(error);
                showSaveError("Failed to delete estimate");
            }
        });
    };

    const handleSetActive = (estId: string) => {
        startTransition(async () => {
            showSaving();
            try {
                await setActiveEstimateAction(estId, projectId);
                setEstimates((prev) =>
                    prev.map((e) => ({ ...e, is_active: e.id === estId }))
                );
                showSaved();
            } catch (error) {
                console.error(error);
                showSaveError("Failed to change the active estimate");
            }
        });
    };

    // ─── Margin updates ─────────────────────────────────
    const handleMarginChange = (field: "overhead_pct" | "profit_pct" | "risk_pct" | "prelims_pct", value: number) => {
        if (!currentEstimate) return;
        const updated = { ...currentEstimate, [field]: value };
        setEstimates((prev) => prev.map((e) => (e.id === currentEstimate.id ? updated : e)));
    };
    const handleMarginBlur = (field: "overhead_pct" | "profit_pct" | "risk_pct" | "prelims_pct", value: number) => {
        if (!currentEstimate) return;
        const updated = { ...currentEstimate, [field]: value };
        setEstimates((prev) => prev.map((e) => (e.id === currentEstimate.id ? updated : e)));
        showSaving();
        updateEstimateMarginsAction(currentEstimate.id, updated.overhead_pct, updated.profit_pct, updated.risk_pct, updated.prelims_pct)
            .then((result) => {
                if (result && !result.success) {
                    // P1-3 — roll the optimistic update back if the server
                    // rejected the change (most likely the project is locked).
                    setEstimates((prev) => prev.map((e) => (e.id === currentEstimate.id ? currentEstimate : e)));
                    showSaveError(result.error ?? "Failed to save margins");
                    return;
                }
                showSaved();
            })
            .catch((err) => {
                console.error(err);
                showSaveError("Failed to save margins");
            });
    };

    const handleNameBlur = (name: string) => {
        if (!currentEstimate) return;
        setEstimates((prev) =>
            prev.map((e) => (e.id === currentEstimate.id ? { ...e, version_name: name } : e))
        );
        // Fire-and-forget server sync
        showSaving();
        updateEstimateNameAction(currentEstimate.id, name)
            .then(() => showSaved())
            .catch((error) => {
                console.error(error);
                showSaveError("Failed to save estimate name");
            });
    };

    // ─── Vision Takeoff handler ───────────────────────────
    const handleAddFromVision = async (item: { description: string; quantity: number; unit: string; unit_rate: number }) => {
        if (!currentEstimate) return;
        const section = "General";
        const tempId = crypto.randomUUID();
        const newLine: EstimateLine = {
            id: tempId,
            estimate_id: currentEstimate.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_rate: item.unit_rate,
            line_total: item.quantity * item.unit_rate,
            trade_section: section,
            line_type: "general",
            pricing_mode: "simple",
            estimate_line_components: [],
        };
        setEstimates((prev) => prev.map((e) =>
            e.id === currentEstimate.id
                ? { ...e, estimate_lines: [...e.estimate_lines, newLine] }
                : e
        ));
        showSaving();
        try {
            const result = await addLineItemAction(currentEstimate.id, section, {
                description: item.description, quantity: item.quantity, unit: item.unit, unit_rate: item.unit_rate,
                line_type: "general",
            });
            if (result?.error) {
                setEstimates((prev) => prev.map((e) => e.id === currentEstimate.id
                    ? { ...e, estimate_lines: e.estimate_lines.filter((line) => line.id !== tempId) }
                    : e));
                router.refresh();
                showSaveError(result.error);
                return;
            }
            if (result?.id) {
                setEstimates((prev) => prev.map((e) =>
                    e.id !== currentEstimate.id ? e : {
                        ...e,
                        estimate_lines: e.estimate_lines.map((l) =>
                            l.id === tempId ? { ...l, id: result.id } : l
                        ),
                    }
                ));
            }
            if (result?.warning) {
                showSaveError(result.warning);
                return;
            }
            showSaved();
        } catch (err) {
            console.error(err);
            showSaveError(err instanceof Error ? err.message : "Failed to add line");
        }
    };

    // ─── BoQ Import handler ──────────────────────────────
    const handleBoQImported = (estimateId: string, _filename: string) => {
        // Store the new estimate ID in a ref — the modal hasn't closed yet so we can't navigate yet
        importedEstimateIdRef.current = estimateId;
    };

    const handleBoQClose = () => {
        setShowBoQImport(false);
        if (importedEstimateIdRef.current) {
            const id = importedEstimateIdRef.current;
            importedEstimateIdRef.current = null;
            // Use a full navigation (not router.push) so the client component fully remounts,
            // the server re-fetches the new estimate, and the pricing screen opens on it from the tab param.
            window.location.href = `/dashboard/projects/costs?projectId=${projectId}&tab=${id}`;
        }
    };

    // ─── Line item CRUD ─────────────────────────────────
    const handleAddLine = async (section: string) => {
        if (!currentEstimate) return;
        // Validate: only add if previous line in section has a description
        const sectionLines = currentEstimate.estimate_lines.filter(l => l.trade_section === section);
        const lastLine = sectionLines[sectionLines.length - 1];
        if (lastLine && (!lastLine.description || lastLine.description === "" || lastLine.description === "\u2014")) {
            return; // Don't add another blank row
        }
        const tempId = crypto.randomUUID();
        const newLine: EstimateLine = {
            id: tempId,
            estimate_id: currentEstimate.id,
            description: "",
            quantity: 1,
            unit: "nr",
            unit_rate: 0,
            line_total: 0,
            trade_section: section,
            line_type: "general",
            pricing_mode: "simple",
            estimate_line_components: [],
        };
        // Add optimistically
        setEstimates((prev) => prev.map((e) =>
            e.id === currentEstimate.id
                ? { ...e, estimate_lines: [...e.estimate_lines, newLine] }
                : e
        ));
        // Save to server, swap temp ID with real ID
        showSaving();
        try {
            const result = await addLineItemAction(currentEstimate.id, section, {
                description: "", quantity: 1, unit: "nr", unit_rate: 0,
                line_type: "general",
            });
            if (result?.error) {
                setEstimates((prev) => prev.map((e) => e.id === currentEstimate.id
                    ? { ...e, estimate_lines: e.estimate_lines.filter((line) => line.id !== tempId) }
                    : e));
                showSaveError(result.error);
                return;
            }
            if (result?.id) {
                setEstimates((prev) => prev.map((e) =>
                    e.id !== currentEstimate.id ? e : {
                        ...e,
                        estimate_lines: e.estimate_lines.map((l) =>
                            l.id === tempId ? { ...l, id: result.id } : l
                        ),
                    }
                ));
            }
            showSaved();
        } catch (err) {
            console.error(err);
            showSaveError(err instanceof Error ? err.message : "Failed to add line");
        }
    };

    const handleUpdateLine = (lineId: string, updates: Partial<EstimateLine>) => {
        if (!currentEstimate) return;

        const line = currentEstimate.estimate_lines.find((l) => l.id === lineId);
        const qty = updates.quantity ?? line?.quantity ?? 1;
        const rate = updates.unit_rate ?? line?.unit_rate ?? 0;

        // Optimistic local update + recalc total in one pass
        setEstimates((prev) =>
            prev.map((e) => {
                if (e.id !== currentEstimate.id) return e;
                const updatedLines = e.estimate_lines.map((l) => {
                    if (l.id !== lineId) return l;
                    const updated = { ...l, ...updates };
                    if (updates.quantity !== undefined || updates.unit_rate !== undefined) {
                        updated.line_total = (updates.quantity ?? l.quantity) * (updates.unit_rate ?? l.unit_rate);
                    }
                    return updated;
                });
                const total = updatedLines.reduce((s, l) => s + (l.line_total || 0), 0);
                return { ...e, estimate_lines: updatedLines, total_cost: total };
            })
        );

        showSaving();
        updateLineItemAction(lineId, { ...updates, quantity: qty, unit_rate: rate })
            .then((result) => {
                if (result && !result.success) {
                    router.refresh(); // re-pull authoritative state after a rejected update
                    showSaveError(result.error ?? "Failed to update line");
                    return;
                }
                if (result?.warning) {
                    showSaveError(result.warning);
                    return;
                }
                showSaved();
            })
            .catch((err) => {
                console.error(err);
                showSaveError("Failed to update line");
            });
    };

    const handleDeleteLine = (lineId: string) => {
        if (!currentEstimate) return;
        // Snapshot previous state so we can roll back on server rejection.
        const prevEstimate = currentEstimate;
        setEstimates((prev) =>
            prev.map((e) => {
                if (e.id !== currentEstimate.id) return e;
                const remaining = e.estimate_lines.filter((l) => l.id !== lineId);
                const total = remaining.reduce((s, l) => s + (l.line_total || 0), 0);
                return { ...e, estimate_lines: remaining, total_cost: total };
            })
        );
        showSaving();
        deleteLineItemAction(lineId)
            .then((result) => {
                if (result && !result.success) {
                    // Roll the optimistic delete back
                    setEstimates((prev) => prev.map((e) => (e.id === prevEstimate.id ? prevEstimate : e)));
                    router.refresh();
                    showSaveError(result.error ?? "Failed to delete line");
                    return;
                }
                if (result?.warning) {
                    showSaveError(result.warning);
                    return;
                }
                showSaved();
            })
            .catch((err) => {
                console.error(err);
                showSaveError("Failed to delete line");
            });
    };

    const handleLibrarySelect = (lineId: string, itemId: string, section: string) => {
        const item = costLibrary.find((c) => c.id === itemId);
        if (!item) return;
        handleUpdateLine(lineId, {
            description: item.description,
            unit: item.unit,
            unit_rate: item.base_rate,
            cost_library_item_id: item.id,
        });
    };

    // ─── Build-Up Handlers ───────────────────────────────
    const handleTogglePricingMode = (lineId: string, currentMode: string) => {
        const newMode = currentMode === "buildup" ? "simple" : "buildup";
        // Control panel visibility
        setOpenBuildUpPanels((prev) => {
            const next = new Set(prev);
            if (newMode === "buildup") {
                next.add(lineId);
            } else {
                next.delete(lineId);
            }
            return next;
        });
        // Optimistic update — immediate, no transition
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate?.id
                    ? { ...e, estimate_lines: e.estimate_lines.map((l) => (l.id === lineId ? { ...l, pricing_mode: newMode as "simple" | "buildup" } : l)) }
                    : e
            )
        );
        // Fire-and-forget server sync — don't await, don't use transition
        setPricingModeAction(lineId, newMode as "simple" | "buildup").catch(console.error);
    };

    const handleComponentsChanged = (lineId: string, components: EstimateLineComponent[], newUnitRate: number) => {
        setEstimates((prev) =>
            prev.map((e) => {
                if (e.id !== currentEstimate?.id) return e;
                return {
                    ...e,
                    estimate_lines: e.estimate_lines.map((l) => {
                        if (l.id !== lineId) return l;
                        return {
                            ...l,
                            estimate_line_components: components,
                            unit_rate: newUnitRate,
                            line_total: l.quantity * newUnitRate,
                        };
                    }),
                };
            })
        );
    };

    const lines = currentEstimate?.estimate_lines || [];
    // Filter out blank lines for display
    const displayLines = lines.filter(l => l.description && l.description !== "" && l.description !== "\u2014");

    // Group lines by trade section (only display lines with descriptions)
    const sectionGroups: Record<string, EstimateLine[]> = {};
    lines.forEach((l) => {
        const sec = l.trade_section || "General";
        if (!sectionGroups[sec]) sectionGroups[sec] = [];
        sectionGroups[sec].push(l);
    });

    // All sections that have lines, plus keep order from TRADE_SECTIONS
    const activeSections = TRADE_SECTIONS.filter((s) => sectionGroups[s]?.length);
    // Add any custom sections not in the predefined list
    Object.keys(sectionGroups).forEach((s) => {
        if (!activeSections.includes(s)) activeSections.push(s);
    });

    return (
        <>
        <div className="space-y-6">
            {/* TABS */}
            <div className="flex items-center gap-2 flex-wrap">
                {estimates.map((est) => (
                    <button
                        type="button"
                        key={est.id}
                        onClick={() => setActiveTab(est.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            activeTab === est.id
                                ? "bg-slate-700 text-white border border-slate-600"
                                : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-200"
                        }`}
                    >
                        {est.version_name || "Estimate"}
                        {est.is_active && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={handleCreateEstimate}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1.5"
                >
                    <Plus className="w-4 h-4" /> New Estimate
                </button>
                {showClientBoQImport && (
                    <button
                        type="button"
                        onClick={() => setShowBoQImport(true)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-colors flex items-center gap-1.5"
                    >
                        <ClipboardList className="w-4 h-4" /> Import Client BoQ
                    </button>
                )}

                {/* Save indicator */}
                <div className="ml-auto text-xs text-slate-500 flex items-center gap-1.5">
                    {saveStatus === "saving" && (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                        </>
                    )}
                    {saveStatus === "saved" && (
                        <>
                            <Check className="w-3 h-3 text-emerald-400" /> Saved
                        </>
                    )}
                    {saveStatus === "error" && (
                        <span className="text-red-400">Save failed — retry</span>
                    )}
                </div>
            </div>

            {!currentEstimate ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                            <Plus className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="text-sm text-slate-500">No estimates yet</p>
                        <p className="text-xs text-slate-600">Click &quot;New Estimate&quot; to create your first Bill of Quantities.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* CLIENT BOQ BANNER */}
                    {currentEstimate.is_client_boq && (
                        <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-5 py-3">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <div>
                                    <span className="text-emerald-300 text-sm font-medium">Client BoQ</span>
                                    {currentEstimate.client_boq_filename && (
                                        <span className="text-emerald-600 text-xs ml-2">{currentEstimate.client_boq_filename}</span>
                                    )}
                                    <p className="text-emerald-600/80 text-xs mt-0.5">
                                        {currentEstimate.is_active
                                            ? "Active — programme will be generated from these sections."
                                            : "Not active — set as active so the programme uses these sections."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {!currentEstimate.is_active && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetActive(currentEstimate.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <Star className="w-4 h-4" />
                                        Set as Active
                                    </button>
                                )}
                                {showClientBoQImport && (
                                    <button
                                        type="button"
                                        onClick={() => exportBoQToExcel(currentEstimate)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        Export to Excel
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ESTIMATE HEADER */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Estimate Name</label>
                                <input
                                    type="text"
                                    defaultValue={currentEstimate.version_name}
                                    onBlur={(e) => handleNameBlur(e.target.value)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Prelims %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.prelims_pct}
                                    onChange={(e) => handleMarginChange("prelims_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("prelims_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Overhead %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.overhead_pct}
                                    onChange={(e) => handleMarginChange("overhead_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("overhead_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Risk %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.risk_pct}
                                    onChange={(e) => handleMarginChange("risk_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("risk_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Profit %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.profit_pct}
                                    onChange={(e) => handleMarginChange("profit_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("profit_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Discount %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.discount_pct}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setEstimates(prev => prev.map(est => est.id === currentEstimate.id ? { ...est, discount_pct: val } : est));
                                    }}
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const prevDiscount = currentEstimate.discount_pct;
                                        setEstimates(prev => prev.map(est => est.id === currentEstimate.id ? { ...est, discount_pct: val } : est));
                                        showSaving();
                                        saveDiscountAction(currentEstimate.id, val, currentEstimate.discount_reason || "")
                                            .then((result) => {
                                                if (result && !result.success) {
                                                    setEstimates(prev => prev.map(est => est.id === currentEstimate.id ? { ...est, discount_pct: prevDiscount } : est));
                                                    showSaveError(result.error ?? "Failed to save discount");
                                                    return;
                                                }
                                                showSaved();
                                            })
                                            .catch((err) => { console.error(err); showSaveError("Failed to save discount"); });
                                    }}
                                    className="w-full h-10 px-3 border border-emerald-700/50 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSetActive(currentEstimate.id)}
                                    className={`h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                                        currentEstimate.is_active
                                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                            : "bg-slate-700/50 text-slate-400 hover:bg-amber-500/10 hover:text-amber-400 border border-slate-600"
                                    }`}
                                >
                                    <Star className={`w-3.5 h-3.5 ${currentEstimate.is_active ? "fill-amber-400" : ""}`} />
                                    {currentEstimate.is_active ? "Active" : "Use in Proposal"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteEstimate(currentEstimate.id)}
                                    className="h-10 px-3 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {currentEstimate.discount_pct > 0 && (
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Discount Reason</label>
                                <input
                                    type="text"
                                    value={currentEstimate.discount_reason || ""}
                                    onChange={(e) => {
                                        setEstimates(prev => prev.map(est => est.id === currentEstimate.id ? { ...est, discount_reason: e.target.value } : est));
                                    }}
                                    onBlur={(e) => {
                                        showSaving();
                                        saveDiscountAction(currentEstimate.id, currentEstimate.discount_pct, e.target.value)
                                            .then((result) => {
                                                if (result && !result.success) {
                                                    showSaveError(result.error ?? "Failed to save discount");
                                                    return;
                                                }
                                                showSaved();
                                            })
                                            .catch((err) => { console.error(err); showSaveError("Failed to save discount"); });
                                    }}
                                    className="flex-1 h-10 px-3 border border-emerald-700/50 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    placeholder="e.g. Returning client, early payment, etc."
                                />
                            </div>
                        )}
                    </div>

                    {/* Vision Takeoff prompt — shown when estimate is empty */}
                    {showDrawingTakeoff && displayLines.length === 0 && (
                        <div className="mb-4 p-4 border-2 border-dashed border-purple-500/30 rounded-xl bg-purple-500/5 flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-200">Got a drawing?</p>
                                <p className="text-sm text-slate-400">Upload a floor plan or sketch and AI extracts quantities automatically.</p>
                            </div>
                            <VisionTakeoff onAddItem={handleAddFromVision} />
                        </div>
                    )}

                    {/* ADD SECTION */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Add Section:</span>
                        {TRADE_SECTIONS.map((section) => {
                            const isActive = !!sectionGroups[section]?.length;
                            return (
                                <button
                                    type="button"
                                    key={section}
                                    onClick={() => { if (!isActive) handleAddLine(section); }}
                                    disabled={isActive}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                        isActive
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 cursor-default"
                                            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 hover:border-slate-600"
                                    }`}
                                >
                                    {isActive ? "✓" : "+"} {section}
                                </button>
                            );
                        })}
                    </div>

                    {/* TRADE SECTIONS */}
                    {activeSections.map((section) => {
                        const sectionLines = sectionGroups[section] || [];
                        const sectionTotal = sectionLines.reduce((s, l) => s + (l.line_total || 0), 0);
                        const sectionLibrary = costLibrary.filter(
                            (c) => c.category === section || section === "General"
                        );

                        return (
                            <div key={section} className="bg-slate-800/50 border border-slate-700/50 rounded-xl" style={{ overflow: "visible" }}>
                                {/* Section header */}
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-900/50 border-b border-slate-700/50 rounded-t-xl">
                                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">{section}</h3>
                                    <span className="font-bold text-sm text-slate-100">{formatGBP(sectionTotal)}</span>
                                </div>

                                {/* Table header */}
                                {currentEstimate.is_client_boq ? (
                                    <div className="grid grid-cols-[50px_1fr_80px_80px_100px_100px_40px] gap-2 px-5 py-2 bg-slate-900/30 border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <div>Ref</div>
                                        <div>Description</div>
                                        <div className="text-center">Qty</div>
                                        <div className="text-center">Unit</div>
                                        <div className="text-right">Rate</div>
                                        <div className="text-right">Total</div>
                                        <div></div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[70px_1fr_80px_80px_100px_100px_40px] gap-2 px-5 py-2 bg-slate-900/30 border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <div>Type</div>
                                        <div>Description</div>
                                        <div className="text-center">Qty</div>
                                        <div className="text-center">Unit</div>
                                        <div className="text-right">Rate</div>
                                        <div className="text-right">Total</div>
                                        <div></div>
                                    </div>
                                )}

                                {/* Line items */}
                                {sectionLines.map((line) => (
                                    <div key={line.id}>
                                        <div className="flex items-stretch">
                                            {/* Mode toggle button — hidden for client BoQ lines */}
                                            {!currentEstimate.is_client_boq && (
                                                <div className="flex items-center px-2 border-b border-slate-700/30">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTogglePricingMode(line.id, line.pricing_mode)}
                                                        title={line.pricing_mode === "buildup" ? "Switch to simple rate" : "Build up from first principles"}
                                                        className={`flex-shrink-0 w-5 h-5 rounded text-xs font-bold border transition-colors ${
                                                            line.pricing_mode === "buildup"
                                                                ? "bg-blue-600 text-white border-blue-600"
                                                                : "bg-slate-700 text-slate-400 border-slate-600 hover:border-blue-500 hover:text-slate-200"
                                                        }`}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <LineItemRow
                                                    line={line}
                                                    library={sectionLibrary}
                                                    allLibrary={costLibrary}
                                                    section={section}
                                                    isClientBoQ={!!currentEstimate.is_client_boq}
                                                    onUpdate={handleUpdateLine}
                                                    onDelete={handleDeleteLine}
                                                    onLibrarySelect={handleLibrarySelect}
                                                />
                                            </div>
                                        </div>
                                        {/* Build-up panel — only shown when explicitly toggled, not on page load */}
                                        {openBuildUpPanels.has(line.id) && (
                                            <BuildUpPanel
                                                line={line}
                                                orgId={orgId}
                                                labourRates={labourRates}
                                                rateBuildups={rateBuildups}
                                                materialLibrary={costLibrary}
                                                preferredTrades={preferredTrades}
                                                onComponentsChanged={handleComponentsChanged}
                                            />
                                        )}
                                    </div>
                                ))}

                                {/* Add line button */}
                                <button
                                    type="button"
                                    onClick={() => handleAddLine(section)}
                                    className="w-full px-5 py-2.5 text-left text-sm text-blue-400 hover:bg-blue-500/10 flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add line item
                                </button>
                            </div>
                        );
                    })}

                </>
            )}
        </div>

        {/* BoQ Import Modal */}
        {showClientBoQImport && showBoQImport && (
            <BoQImport
                projectId={projectId}
                onImported={handleBoQImported}
                onClose={() => handleBoQClose()}
            />
        )}
        </>
    );
}

// ─── Line Item Row ───────────────────────────────────────
function LineItemRow({
    line,
    library,
    allLibrary,
    section,
    isClientBoQ,
    onUpdate,
    onDelete,
    onLibrarySelect,
}: {
    line: EstimateLine;
    library: CostLibraryItem[];
    allLibrary: CostLibraryItem[];
    section: string;
    isClientBoQ?: boolean;
    onUpdate: (id: string, updates: Partial<EstimateLine>) => void;
    onDelete: (id: string) => void;
    onLibrarySelect: (lineId: string, itemId: string, section: string) => void;
}) {
    const [search, setSearch] = useState(line.description || "");
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Use all library items for search, but prioritize section matches
    const filtered = search.length > 0
        ? allLibrary
            .filter((c) => {
                const q = search.toLowerCase();
                return (
                    c.description.toLowerCase().includes(q) ||
                    c.code.toLowerCase().includes(q) ||
                    c.category.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                // Section matches first
                const aMatch = a.category === section ? 0 : 1;
                const bMatch = b.category === section ? 0 : 1;
                return aMatch - bMatch;
            })
            .slice(0, 15)
        : [];

    return (
        <div className={`grid gap-2 px-5 py-2 border-b border-slate-700/30 items-center hover:bg-slate-700/20 transition-colors ${
            isClientBoQ
                ? "grid-cols-[50px_1fr_80px_80px_100px_100px_40px]"
                : "grid-cols-[70px_1fr_80px_80px_100px_100px_40px]"
        }`}>
            {/* Client ref (BoQ) or line type badge (standard) */}
            {isClientBoQ ? (
                <span className="text-slate-500 text-xs font-mono truncate" title={line.client_ref || ""}>
                    {line.client_ref || ""}
                </span>
            ) : (
                <select
                    value={line.line_type || "general"}
                    onChange={(e) => onUpdate(line.id, { line_type: e.target.value })}
                    className="h-8 px-1 border border-slate-700 rounded text-xs text-slate-400 bg-slate-900/50 truncate focus:outline-none"
                >
                    {LINE_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                    ))}
                </select>
            )}

            {/* Description with library search — free-text supported */}
            <div className="relative" ref={dropdownRef} style={{ overflow: "visible" }}>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (e.target.value.length > 0) {
                            setShowDropdown(true);
                        } else {
                            setShowDropdown(false);
                        }
                    }}
                    onFocus={() => {
                        if (search.length > 0) setShowDropdown(true);
                    }}
                    onBlur={() => {
                        // Delay so click on dropdown registers
                        setTimeout(() => {
                            setShowDropdown(false);
                            // Free-text mode: keep whatever was typed
                            if (search !== line.description) {
                                onUpdate(line.id, { description: search });
                            }
                        }, 200);
                    }}
                    placeholder="Search library or type description..."
                    className="w-full h-8 px-2 border border-slate-700 rounded text-sm text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600"
                />
                {showDropdown && filtered.length > 0 && (
                    <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {filtered.map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSearch(item.description);
                                    setShowDropdown(false);
                                    onLibrarySelect(line.id, item.id, section);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-700/50 flex items-center justify-between text-sm transition-colors"
                            >
                                <span className="text-slate-200 truncate">
                                    <span className="text-slate-500 text-xs mr-1.5">{item.code}</span>
                                    {item.description}
                                </span>
                                <span className="text-slate-400 text-xs ml-2 whitespace-nowrap">
                                    {formatGBP(item.base_rate)}/{item.unit}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Qty */}
            <input
                type="number"
                step="0.01"
                defaultValue={line.quantity}
                onBlur={(e) => onUpdate(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                className="h-8 px-2 border border-slate-700 rounded text-sm text-center text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />

            {/* Unit */}
            <select
                key={line.unit}
                defaultValue={line.unit}
                onChange={(e) => onUpdate(line.id, { unit: e.target.value })}
                className="h-8 px-1 border border-slate-700 rounded text-sm text-slate-300 bg-slate-900/50 focus:outline-none"
            >
                {UNITS.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>

            {/* Rate */}
            {line.pricing_mode === "buildup" ? (
                <div className="h-8 px-2 rounded text-sm text-right font-medium text-blue-400 bg-blue-500/10 flex flex-col items-end justify-center leading-tight">
                    <span>{formatGBP(line.unit_rate)}</span>
                    <span className="text-[9px] text-blue-500">built up</span>
                </div>
            ) : (
                <input
                    key={line.unit_rate}
                    type="number"
                    step="0.01"
                    defaultValue={line.unit_rate}
                    onBlur={(e) => onUpdate(line.id, { unit_rate: parseFloat(e.target.value) || 0 })}
                    className="h-8 px-2 border border-slate-700 rounded text-sm text-right text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
            )}

            {/* Total (readonly) */}
            <div className="text-sm font-medium text-slate-200 text-right pr-2">
                {formatGBP(line.line_total || 0)}
            </div>

            {/* Delete */}
            <button
                type="button"
                onClick={() => onDelete(line.id)}
                className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
