"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import {
    createEstimateAction,
    updateEstimateMarginsAction,
    updateEstimateNameAction,
    addLineItemAction,
    updateLineItemAction,
    deleteLineItemAction,
    setActiveEstimateAction,
    deleteEstimateAction,
    addComponentAction,
    updateComponentAction,
    deleteComponentAction,
    setPricingModeAction,
    saveRateBuildupAction,
    updateLineBuiltUpRateAction,
} from "./actions";
import { Plus, Trash2, Check, Star, Loader2, FileText } from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────
interface EstimateLineComponent {
    id: string;
    estimate_line_id: string;
    component_type: "labour" | "plant" | "material" | "consumable" | "temp_works" | "subcontract";
    description: string;
    quantity: number;
    unit: string;
    unit_rate: number;
    line_total: number;
    manhours_per_unit: number;
    total_manhours: number;
    sort_order: number;
}

interface EstimateLine {
    id: string;
    estimate_id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_rate: number;
    line_total: number;
    trade_section: string;
    line_type: string;
    cost_library_item_id?: string | null;
    mom_item_code?: string | null;
    notes?: string | null;
    pricing_mode: "simple" | "buildup";
    estimate_line_components: EstimateLineComponent[];
}

interface Estimate {
    id: string;
    project_id: string;
    version_name: string;
    overhead_pct: number;
    profit_pct: number;
    risk_pct: number;
    prelims_pct: number;
    total_cost: number;
    is_active: boolean;
    estimate_lines: EstimateLine[];
}

interface CostLibraryItem {
    id: string;
    code: string;
    description: string;
    unit: string;
    base_rate: number;
    category: string;
}

interface RateBuildup {
    id: string;
    name: string;
    unit: string;
    built_up_rate: number;
    trade_section: string;
    components: { type: string; description: string; quantity: number; unit: string; unit_rate: number; manhours_per_unit: number }[];
    total_manhours_per_unit: number;
}

interface Props {
    estimates: Estimate[];
    costLibrary: CostLibraryItem[];
    projectId: string;
    orgId: string;
    rateBuildups: RateBuildup[];
}

const TRADE_SECTIONS = [
    "Preliminaries",
    "Groundworks",
    "Concrete",
    "Drainage",
    "Utilities",
    "Surfacing",
    "Masonry",
    "Carpentry",
    "Electrical",
    "Plumbing",
    "Finishes",
    "External Works",
    "Subcontract",
    "Provisional Sums",
    "General",
];

const UNITS = ["m", "m2", "m3", "nr", "item", "day", "week", "tonne", "kg", "lm"];

const LINE_TYPES = ["general", "labour", "plant", "material", "subcontract", "consultancy"];

function formatGBP(n: number): string {
    return "\u00A3" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Main Component ──────────────────────────────────────
export default function EstimateClient({ estimates: initialEstimates, costLibrary, projectId, orgId, rateBuildups }: Props) {
    const [estimates, setEstimates] = useState<Estimate[]>(initialEstimates);
    const [activeTab, setActiveTab] = useState<string>(estimates[0]?.id || "");
    const [isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentEstimate = estimates.find((e) => e.id === activeTab);

    const showSaving = useCallback(() => {
        setSaveStatus("saving");
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }, []);

    const showSaved = useCallback(() => {
        setSaveStatus("saved");
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, []);

    // ─── Estimate CRUD ──────────────────────────────────
    const handleCreateEstimate = () => {
        const name = `Estimate v${estimates.length + 1}`;
        startTransition(async () => {
            showSaving();
            const result = await createEstimateAction(projectId, name);
            if (result) {
                const newEst: Estimate = {
                    ...result,
                    estimate_lines: [],
                    overhead_pct: result.overhead_pct ?? 10,
                    profit_pct: result.profit_pct ?? 15,
                    risk_pct: result.risk_pct ?? 0,
                    prelims_pct: result.prelims_pct ?? 0,
                    total_cost: 0,
                    is_active: false,
                };
                setEstimates((prev) => [...prev, newEst]);
                setActiveTab(result.id);
            }
            showSaved();
        });
    };

    const handleDeleteEstimate = (estId: string) => {
        if (!confirm("Delete this estimate and all its line items?")) return;
        startTransition(async () => {
            showSaving();
            await deleteEstimateAction(estId);
            setEstimates((prev) => prev.filter((e) => e.id !== estId));
            if (activeTab === estId) {
                const remaining = estimates.filter((e) => e.id !== estId);
                setActiveTab(remaining[0]?.id || "");
            }
            showSaved();
        });
    };

    const handleSetActive = (estId: string) => {
        startTransition(async () => {
            showSaving();
            await setActiveEstimateAction(estId, projectId);
            setEstimates((prev) =>
                prev.map((e) => ({ ...e, is_active: e.id === estId }))
            );
            showSaved();
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
        startTransition(async () => {
            showSaving();
            await updateEstimateMarginsAction(currentEstimate.id, updated.overhead_pct, updated.profit_pct, updated.risk_pct, updated.prelims_pct);
            showSaved();
        });
    };

    const handleNameBlur = (name: string) => {
        if (!currentEstimate) return;
        setEstimates((prev) =>
            prev.map((e) => (e.id === currentEstimate.id ? { ...e, version_name: name } : e))
        );
        startTransition(async () => {
            showSaving();
            await updateEstimateNameAction(currentEstimate.id, name);
            showSaved();
        });
    };

    // ─── Line item CRUD ─────────────────────────────────
    const handleAddLine = (section: string) => {
        if (!currentEstimate) return;
        // Validate: only add if previous line in section has a description
        const sectionLines = currentEstimate.estimate_lines.filter(l => l.trade_section === section);
        const lastLine = sectionLines[sectionLines.length - 1];
        if (lastLine && (!lastLine.description || lastLine.description === "" || lastLine.description === "\u2014")) {
            return; // Don't add another blank row
        }
        startTransition(async () => {
            showSaving();
            const result = await addLineItemAction(currentEstimate.id, section, {
                description: "",
                quantity: 1,
                unit: "nr",
                unit_rate: 0,
                line_type: "general",
            });
            if (result) {
                setEstimates((prev) =>
                    prev.map((e) =>
                        e.id === currentEstimate.id
                            ? { ...e, estimate_lines: [...e.estimate_lines, { ...result, trade_section: section, line_type: result.line_type || "general" }] }
                            : e
                    )
                );
            }
            showSaved();
        });
    };

    const handleUpdateLine = (lineId: string, updates: Partial<EstimateLine>) => {
        if (!currentEstimate) return;

        // Optimistic local update
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate.id
                    ? {
                          ...e,
                          estimate_lines: e.estimate_lines.map((l) => {
                              if (l.id !== lineId) return l;
                              const updated = { ...l, ...updates };
                              if (updates.quantity !== undefined || updates.unit_rate !== undefined) {
                                  updated.line_total = (updates.quantity ?? l.quantity) * (updates.unit_rate ?? l.unit_rate);
                              }
                              return updated;
                          }),
                      }
                    : e
            )
        );

        startTransition(async () => {
            showSaving();
            const line = currentEstimate.estimate_lines.find((l) => l.id === lineId);
            const qty = updates.quantity ?? line?.quantity ?? 1;
            const rate = updates.unit_rate ?? line?.unit_rate ?? 0;
            await updateLineItemAction(lineId, { ...updates, quantity: qty, unit_rate: rate });
            // Recalc local total_cost
            setEstimates((prev) =>
                prev.map((e) => {
                    if (e.id !== currentEstimate.id) return e;
                    const total = e.estimate_lines.reduce((s, l) => s + (l.line_total || 0), 0);
                    return { ...e, total_cost: total };
                })
            );
            showSaved();
        });
    };

    const handleDeleteLine = (lineId: string) => {
        if (!currentEstimate) return;
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate.id
                    ? { ...e, estimate_lines: e.estimate_lines.filter((l) => l.id !== lineId) }
                    : e
            )
        );
        startTransition(async () => {
            showSaving();
            await deleteLineItemAction(lineId);
            setEstimates((prev) =>
                prev.map((e) => {
                    if (e.id !== currentEstimate.id) return e;
                    const total = e.estimate_lines.reduce((s, l) => s + (l.line_total || 0), 0);
                    return { ...e, total_cost: total };
                })
            );
            showSaved();
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
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate?.id
                    ? { ...e, estimate_lines: e.estimate_lines.map((l) => (l.id === lineId ? { ...l, pricing_mode: newMode as "simple" | "buildup" } : l)) }
                    : e
            )
        );
        startTransition(async () => {
            await setPricingModeAction(lineId, newMode as "simple" | "buildup");
        });
    };

    const handleAddComponent = (lineId: string, componentType: string) => {
        startTransition(async () => {
            showSaving();
            const result = await addComponentAction(lineId, {
                component_type: componentType,
                description: "",
                quantity: 1,
                unit: componentType === "labour" || componentType === "plant" ? "day" : "nr",
                unit_rate: 0,
                manhours_per_unit: componentType === "labour" ? 8 : 0,
                sort_order: 0,
            });
            if (result) {
                setEstimates((prev) =>
                    prev.map((e) =>
                        e.id === currentEstimate?.id
                            ? {
                                  ...e,
                                  estimate_lines: e.estimate_lines.map((l) =>
                                      l.id === lineId
                                          ? {
                                                ...l,
                                                estimate_line_components: [
                                                    ...(l.estimate_line_components || []),
                                                    {
                                                        id: result.id,
                                                        estimate_line_id: lineId,
                                                        component_type: componentType as EstimateLineComponent["component_type"],
                                                        description: "",
                                                        quantity: 1,
                                                        unit: componentType === "labour" || componentType === "plant" ? "day" : "nr",
                                                        unit_rate: 0,
                                                        line_total: 0,
                                                        manhours_per_unit: componentType === "labour" ? 8 : 0,
                                                        total_manhours: 0,
                                                        sort_order: 0,
                                                    },
                                                ],
                                            }
                                          : l
                                  ),
                              }
                            : e
                    )
                );
            }
            showSaved();
        });
    };

    const handleUpdateComponent = (componentId: string, updates: Partial<EstimateLineComponent>) => {
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate?.id
                    ? {
                          ...e,
                          estimate_lines: e.estimate_lines.map((l) => ({
                              ...l,
                              estimate_line_components: (l.estimate_line_components || []).map((c) =>
                                  c.id === componentId
                                      ? { ...c, ...updates, line_total: (updates.quantity ?? c.quantity) * (updates.unit_rate ?? c.unit_rate) }
                                      : c
                              ),
                          })),
                      }
                    : e
            )
        );
        startTransition(async () => {
            await updateComponentAction(componentId, updates);
        });
    };

    const handleDeleteComponent = (componentId: string) => {
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate?.id
                    ? {
                          ...e,
                          estimate_lines: e.estimate_lines.map((l) => ({
                              ...l,
                              estimate_line_components: (l.estimate_line_components || []).filter((c) => c.id !== componentId),
                          })),
                      }
                    : e
            )
        );
        startTransition(async () => {
            await deleteComponentAction(componentId);
        });
    };

    const handleUpdateBuiltUpRate = (lineId: string, ratePerUnit: number) => {
        handleUpdateLine(lineId, { unit_rate: ratePerUnit });
        startTransition(async () => {
            await updateLineBuiltUpRateAction(lineId, ratePerUnit);
        });
    };

    const handleSaveToLibrary = (line: EstimateLine) => {
        const components = line.estimate_line_components || [];
        const componentTotal = components.reduce((s, c) => s + (c.line_total || 0), 0);
        const ratePerUnit = line.quantity > 0 ? componentTotal / line.quantity : 0;
        const totalManhoursPerUnit = components
            .filter((c) => c.component_type === "labour")
            .reduce((s, c) => s + (c.manhours_per_unit || 0), 0);

        const name = prompt("Save as (name for this built-up rate):", line.description || "Built-up rate");
        if (!name) return;

        startTransition(async () => {
            showSaving();
            await saveRateBuildupAction(
                orgId,
                name,
                line.unit,
                line.trade_section,
                components.map((c) => ({
                    type: c.component_type,
                    description: c.description,
                    quantity: c.quantity,
                    unit: c.unit,
                    unit_rate: c.unit_rate,
                    manhours_per_unit: c.manhours_per_unit,
                })),
                ratePerUnit,
                totalManhoursPerUnit
            );
            showSaved();
        });
    };

    const handleLoadFromLibrary = (lineId: string, buildupId: string) => {
        const rb = rateBuildups.find((r) => r.id === buildupId);
        if (!rb) return;
        // Add each component from the library template
        rb.components.forEach((comp) => {
            startTransition(async () => {
                showSaving();
                const result = await addComponentAction(lineId, {
                    component_type: comp.type,
                    description: comp.description,
                    quantity: comp.quantity,
                    unit: comp.unit,
                    unit_rate: comp.unit_rate,
                    manhours_per_unit: comp.manhours_per_unit,
                    sort_order: 0,
                });
                if (result) {
                    setEstimates((prev) =>
                        prev.map((e) =>
                            e.id === currentEstimate?.id
                                ? {
                                      ...e,
                                      estimate_lines: e.estimate_lines.map((l) =>
                                          l.id === lineId
                                              ? {
                                                    ...l,
                                                    estimate_line_components: [
                                                        ...(l.estimate_line_components || []),
                                                        {
                                                            id: result.id,
                                                            estimate_line_id: lineId,
                                                            component_type: comp.type as EstimateLineComponent["component_type"],
                                                            description: comp.description,
                                                            quantity: comp.quantity,
                                                            unit: comp.unit,
                                                            unit_rate: comp.unit_rate,
                                                            line_total: comp.quantity * comp.unit_rate,
                                                            manhours_per_unit: comp.manhours_per_unit,
                                                            total_manhours: comp.quantity * comp.manhours_per_unit,
                                                            sort_order: 0,
                                                        },
                                                    ],
                                                }
                                              : l
                                      ),
                                  }
                                : e
                        )
                    );
                }
                showSaved();
            });
        });
    };

    // ─── CORRECT QS COST HIERARCHY ──────────────────────
    const lines = currentEstimate?.estimate_lines || [];
    // Filter out blank lines for display
    const displayLines = lines.filter(l => l.description && l.description !== "" && l.description !== "\u2014");

    const prelimsPct = currentEstimate?.prelims_pct || 0;
    const overheadPct = currentEstimate?.overhead_pct || 0;
    const profitPct = currentEstimate?.profit_pct || 0;
    const riskPct = currentEstimate?.risk_pct || 0;

    // Step 1: Direct Construction Cost = sum of all line item totals (excluding Preliminaries section)
    const directCost = lines
        .filter(l => l.trade_section !== "Preliminaries" && l.line_total > 0)
        .reduce((sum, l) => sum + l.line_total, 0);

    // Step 2: Prelims = either explicit Prelims section lines OR prelims_pct % of direct cost
    const explicitPrelimsLines = lines.filter(l => l.trade_section === "Preliminaries");
    const explicitPrelimsTotal = explicitPrelimsLines.reduce((sum, l) => sum + l.line_total, 0);
    const prelimsFromPct = directCost * (prelimsPct / 100);
    const prelimsTotal = explicitPrelimsLines.length > 0 ? explicitPrelimsTotal : prelimsFromPct;

    // Step 3: Total Construction Cost
    const totalConstructionCost = directCost + prelimsTotal;

    // Step 4: Overhead applied to Total Construction Cost
    const overheadAmount = totalConstructionCost * (overheadPct / 100);
    const costPlusOverhead = totalConstructionCost + overheadAmount;

    // Step 5: Risk applied to (Construction Cost + Overhead)
    const riskAmount = costPlusOverhead * (riskPct / 100);
    const adjustedTotal = costPlusOverhead + riskAmount;

    // Step 6: Profit applied to Adjusted Total
    const profitAmount = adjustedTotal * (profitPct / 100);
    const contractSum = adjustedTotal + profitAmount;

    const vat = contractSum * 0.2;
    const totalIncVat = contractSum + vat;

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
        <div className="space-y-6">
            {/* HEADER WITH CTA */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Estimating</h1>
                <div className="flex items-center gap-3">
                    {contractSum > 0 && (
                        <span className="text-sm text-gray-500">Contract Sum: <strong>{formatGBP(contractSum)}</strong></span>
                    )}
                    <Link href={`/dashboard/projects/proposal?projectId=${projectId}`}
                        className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-700 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Next: Build Proposal →
                    </Link>
                </div>
            </div>

            {/* TABS */}
            <div className="flex items-center gap-2 flex-wrap">
                {estimates.map((est) => (
                    <button
                        key={est.id}
                        onClick={() => setActiveTab(est.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            activeTab === est.id
                                ? "bg-slate-900 text-white shadow-md"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        {est.version_name || "Estimate"}
                        {est.is_active && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                    </button>
                ))}
                <button
                    onClick={handleCreateEstimate}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
                >
                    <Plus className="w-4 h-4" /> New Estimate
                </button>

                {/* Save indicator */}
                <div className="ml-auto text-xs text-slate-400 flex items-center gap-1.5">
                    {saveStatus === "saving" && (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                        </>
                    )}
                    {saveStatus === "saved" && (
                        <>
                            <Check className="w-3 h-3 text-green-500" /> Saved
                        </>
                    )}
                </div>
            </div>

            {!currentEstimate ? (
                <div className="text-center py-20 text-slate-400">
                    <p className="text-lg mb-2">No estimates yet</p>
                    <p className="text-sm">Click &quot;New Estimate&quot; to create your first Bill of Quantities.</p>
                </div>
            ) : (
                <>
                    {/* ESTIMATE HEADER */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Estimate Name</label>
                                <input
                                    type="text"
                                    defaultValue={currentEstimate.version_name}
                                    onBlur={(e) => handleNameBlur(e.target.value)}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Prelims %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.prelims_pct}
                                    onChange={(e) => handleMarginChange("prelims_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("prelims_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-slate-900 text-sm text-center"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Overhead %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.overhead_pct}
                                    onChange={(e) => handleMarginChange("overhead_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("overhead_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-slate-900 text-sm text-center"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Risk %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.risk_pct}
                                    onChange={(e) => handleMarginChange("risk_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("risk_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-slate-900 text-sm text-center"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Profit %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.profit_pct}
                                    onChange={(e) => handleMarginChange("profit_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("profit_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-slate-900 text-sm text-center"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSetActive(currentEstimate.id)}
                                    className={`h-10 px-4 rounded-md text-sm font-medium flex items-center gap-1.5 ${
                                        currentEstimate.is_active
                                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                                            : "bg-slate-100 text-slate-600 hover:bg-amber-50 border border-slate-200"
                                    }`}
                                >
                                    <Star className={`w-3.5 h-3.5 ${currentEstimate.is_active ? "fill-amber-500" : ""}`} />
                                    {currentEstimate.is_active ? "Active" : "Use in Proposal"}
                                </button>
                                <button
                                    onClick={() => handleDeleteEstimate(currentEstimate.id)}
                                    className="h-10 px-3 rounded-md text-red-500 hover:bg-red-50 border border-slate-200"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ADD SECTION */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase text-slate-500">Add Section:</span>
                        {TRADE_SECTIONS.filter((s) => !sectionGroups[s]?.length).map((section) => (
                            <button
                                key={section}
                                onClick={() => handleAddLine(section)}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            >
                                + {section}
                            </button>
                        ))}
                    </div>

                    {/* TRADE SECTIONS */}
                    {activeSections.map((section) => {
                        const sectionLines = sectionGroups[section] || [];
                        const sectionTotal = sectionLines.reduce((s, l) => s + (l.line_total || 0), 0);
                        const sectionLibrary = costLibrary.filter(
                            (c) => c.category === section || section === "General"
                        );

                        return (
                            <div key={section} className="bg-white border border-slate-200 rounded-xl" style={{ overflow: "visible" }}>
                                {/* Section header */}
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white rounded-t-xl">
                                    <h3 className="font-bold text-sm uppercase tracking-wide">{section}</h3>
                                    <span className="font-bold text-sm">{formatGBP(sectionTotal)}</span>
                                </div>

                                {/* Table header */}
                                <div className="grid grid-cols-[70px_1fr_80px_80px_100px_100px_40px] gap-2 px-5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                                    <div>Type</div>
                                    <div>Description</div>
                                    <div className="text-center">Qty</div>
                                    <div className="text-center">Unit</div>
                                    <div className="text-right">Rate</div>
                                    <div className="text-right">Total</div>
                                    <div></div>
                                </div>

                                {/* Line items */}
                                {sectionLines.map((line) => (
                                    <div key={line.id}>
                                        <div className="flex items-stretch">
                                            {/* Mode toggle button */}
                                            <div className="flex items-center px-2 border-b border-slate-100">
                                                <button
                                                    onClick={() => handleTogglePricingMode(line.id, line.pricing_mode)}
                                                    title={line.pricing_mode === "buildup" ? "Switch to simple rate" : "Build up from first principles"}
                                                    className={`flex-shrink-0 w-5 h-5 rounded text-xs font-bold border transition-colors ${
                                                        line.pricing_mode === "buildup"
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : "bg-white text-gray-400 border-gray-300 hover:border-blue-400"
                                                    }`}
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <div className="flex-1">
                                                <LineItemRow
                                                    line={line}
                                                    library={sectionLibrary}
                                                    allLibrary={costLibrary}
                                                    section={section}
                                                    onUpdate={handleUpdateLine}
                                                    onDelete={handleDeleteLine}
                                                    onLibrarySelect={handleLibrarySelect}
                                                />
                                            </div>
                                        </div>
                                        {/* Build-up panel */}
                                        {line.pricing_mode === "buildup" && (
                                            <BuildUpPanel
                                                line={line}
                                                rateBuildups={rateBuildups}
                                                onAddComponent={handleAddComponent}
                                                onUpdateComponent={handleUpdateComponent}
                                                onDeleteComponent={handleDeleteComponent}
                                                onSaveToLibrary={handleSaveToLibrary}
                                                onUpdateBuiltUpRate={handleUpdateBuiltUpRate}
                                                onLoadFromLibrary={handleLoadFromLibrary}
                                            />
                                        )}
                                    </div>
                                ))}

                                {/* Add line button */}
                                <button
                                    onClick={() => handleAddLine(section)}
                                    className="w-full px-5 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add line item
                                </button>
                            </div>
                        );
                    })}

                    {/* SUMMARY STRIP */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 sticky bottom-0 shadow-lg">
                        <h3 className="font-bold text-sm uppercase tracking-wide text-slate-500 mb-4">Cost Summary</h3>
                        <div className="space-y-2">
                            <SummaryRow label="Direct Construction Cost" value={directCost} />
                            {(prelimsTotal > 0 || prelimsPct > 0) && (
                                <SummaryRow
                                    label={explicitPrelimsLines.length > 0 ? "Preliminaries (line items)" : `Preliminaries (${prelimsPct}%)`}
                                    value={prelimsTotal}
                                />
                            )}
                            <div className="border-t border-slate-200 pt-2 mt-2">
                                <SummaryRow label="Total Construction Cost" value={totalConstructionCost} bold />
                            </div>
                            {overheadPct > 0 && (
                                <SummaryRow label={`Overhead (${overheadPct}%)`} value={overheadAmount} />
                            )}
                            {riskPct > 0 && (
                                <SummaryRow label={`Risk (${riskPct}%)`} value={riskAmount} />
                            )}
                            {profitPct > 0 && (
                                <SummaryRow label={`Profit (${profitPct}%)`} value={profitAmount} />
                            )}
                            <div className="border-t-2 border-slate-900 pt-2 mt-2">
                                <SummaryRow label="CONTRACT SUM (exc. VAT)" value={contractSum} bold />
                            </div>
                            <SummaryRow label="VAT (20%)" value={vat} />
                            <div className="border-t border-slate-200 pt-2 mt-2">
                                <SummaryRow label="TOTAL inc. VAT" value={totalIncVat} bold large />
                            </div>
                        </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-8 flex justify-end">
                        <Link href={`/dashboard/projects/proposal?projectId=${projectId}`}
                            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-gray-700 flex items-center gap-2">
                            Next: Build Proposal →
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Line Item Row ───────────────────────────────────────
function LineItemRow({
    line,
    library,
    allLibrary,
    section,
    onUpdate,
    onDelete,
    onLibrarySelect,
}: {
    line: EstimateLine;
    library: CostLibraryItem[];
    allLibrary: CostLibraryItem[];
    section: string;
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
        <div className="grid grid-cols-[70px_1fr_80px_80px_100px_100px_40px] gap-2 px-5 py-2 border-b border-slate-100 items-center hover:bg-slate-50/50">
            {/* Line type badge */}
            <select
                value={line.line_type || "general"}
                onChange={(e) => onUpdate(line.id, { line_type: e.target.value })}
                className="h-8 px-1 border border-slate-200 rounded text-xs text-slate-600 bg-white truncate"
            >
                {LINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                ))}
            </select>

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
                    className="w-full h-8 px-2 border border-slate-200 rounded text-sm text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                {showDropdown && filtered.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {filtered.map((item) => (
                            <button
                                key={item.id}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSearch(item.description);
                                    setShowDropdown(false);
                                    onLibrarySelect(line.id, item.id, section);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between text-sm"
                            >
                                <span className="text-slate-900 truncate">
                                    <span className="text-slate-400 text-xs mr-1.5">{item.code}</span>
                                    {item.description}
                                </span>
                                <span className="text-slate-500 text-xs ml-2 whitespace-nowrap">
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
                className="h-8 px-2 border border-slate-200 rounded text-sm text-center text-slate-900"
            />

            {/* Unit */}
            <select
                defaultValue={line.unit}
                onChange={(e) => onUpdate(line.id, { unit: e.target.value })}
                className="h-8 px-1 border border-slate-200 rounded text-sm text-slate-900 bg-white"
            >
                {UNITS.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>

            {/* Rate */}
            {line.pricing_mode === "buildup" ? (
                <div className="h-8 px-2 rounded text-sm text-right font-medium text-blue-700 bg-blue-50 flex flex-col items-end justify-center leading-tight">
                    <span>{formatGBP(line.unit_rate)}</span>
                    <span className="text-[9px] text-blue-400">built up</span>
                </div>
            ) : (
                <input
                    type="number"
                    step="0.01"
                    defaultValue={line.unit_rate}
                    onBlur={(e) => onUpdate(line.id, { unit_rate: parseFloat(e.target.value) || 0 })}
                    className="h-8 px-2 border border-slate-200 rounded text-sm text-right text-slate-900"
                />
            )}

            {/* Total (readonly) */}
            <div className="text-sm font-medium text-slate-900 text-right pr-2">
                {formatGBP(line.line_total || 0)}
            </div>

            {/* Delete */}
            <button
                onClick={() => onDelete(line.id)}
                className="h-8 w-8 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── Build-Up Panel ─────────────────────────────────────
function BuildUpPanel({
    line,
    rateBuildups,
    onAddComponent,
    onUpdateComponent,
    onDeleteComponent,
    onSaveToLibrary,
    onUpdateBuiltUpRate,
    onLoadFromLibrary,
}: {
    line: EstimateLine;
    rateBuildups: RateBuildup[];
    onAddComponent: (lineId: string, componentType: string) => void;
    onUpdateComponent: (componentId: string, updates: Partial<EstimateLineComponent>) => void;
    onDeleteComponent: (componentId: string) => void;
    onSaveToLibrary: (line: EstimateLine) => void;
    onUpdateBuiltUpRate: (lineId: string, ratePerUnit: number) => void;
    onLoadFromLibrary: (lineId: string, buildupId: string) => void;
}) {
    const COMPONENT_TYPE_COLORS: Record<string, string> = {
        material: "bg-green-100 text-green-700",
        labour: "bg-blue-100 text-blue-700",
        plant: "bg-orange-100 text-orange-700",
        consumable: "bg-purple-100 text-purple-700",
        temp_works: "bg-yellow-100 text-yellow-700",
        subcontract: "bg-gray-100 text-gray-700",
    };

    const COMP_UNITS = ["m", "m\u00B2", "m\u00B3", "nr", "item", "day", "hr", "week", "tonne", "kg"];

    const components = line.estimate_line_components || [];
    const componentTotal = components.reduce((s, c) => s + (c.line_total || 0), 0);
    const ratePerUnit = line.quantity > 0 ? componentTotal / line.quantity : 0;
    const totalManhours = components.reduce((s, c) => s + (c.total_manhours || 0), 0);

    return (
        <div className="ml-10 mr-5 mb-3 border border-blue-200 rounded-lg bg-blue-50/30 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-200">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Rate Build-Up</span>
                <div className="flex items-center gap-3 text-xs text-blue-600">
                    <span>Components total: <strong>{formatGBP(componentTotal)}</strong></span>
                    <span>Rate/unit: <strong>{formatGBP(ratePerUnit)}</strong></span>
                    {totalManhours > 0 && <span>Manhours: <strong>{totalManhours.toFixed(1)}h</strong></span>}
                </div>
            </div>

            {/* Load from library */}
            {rateBuildups.length > 0 && components.length === 0 && (
                <div className="px-3 py-2 border-b border-blue-100">
                    <select
                        className="text-xs border border-blue-200 rounded px-2 py-1 bg-white text-blue-700"
                        onChange={(e) => e.target.value && onLoadFromLibrary(line.id, e.target.value)}
                        defaultValue=""
                    >
                        <option value="">Load from rate library...</option>
                        {rateBuildups.map((rb) => (
                            <option key={rb.id} value={rb.id}>
                                {rb.name} — {formatGBP(rb.built_up_rate)}/{rb.unit}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Component rows */}
            <div className="divide-y divide-blue-100">
                {components.map((comp) => (
                    <div key={comp.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        {/* Type badge */}
                        <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 w-20 text-center ${
                                COMPONENT_TYPE_COLORS[comp.component_type] || "bg-gray-100 text-gray-700"
                            }`}
                        >
                            {comp.component_type}
                        </span>
                        {/* Description */}
                        <input
                            className="flex-1 border border-transparent hover:border-blue-200 rounded px-1 py-0.5 bg-transparent text-gray-700 text-xs"
                            defaultValue={comp.description}
                            onBlur={(e) => onUpdateComponent(comp.id, { description: e.target.value })}
                            placeholder="Description..."
                        />
                        {/* Qty */}
                        <input
                            type="number"
                            className="w-16 border border-transparent hover:border-blue-200 rounded px-1 py-0.5 bg-transparent text-right text-xs"
                            defaultValue={comp.quantity}
                            onBlur={(e) => onUpdateComponent(comp.id, { quantity: Number(e.target.value) })}
                        />
                        {/* Unit */}
                        <select
                            className="w-14 border border-transparent hover:border-blue-200 rounded px-1 py-0.5 bg-transparent text-xs"
                            defaultValue={comp.unit}
                            onChange={(e) => onUpdateComponent(comp.id, { unit: e.target.value })}
                        >
                            {COMP_UNITS.map((u) => (
                                <option key={u}>{u}</option>
                            ))}
                        </select>
                        {/* Rate */}
                        <input
                            type="number"
                            className="w-20 border border-transparent hover:border-blue-200 rounded px-1 py-0.5 bg-transparent text-right text-xs"
                            defaultValue={comp.unit_rate}
                            onBlur={(e) => onUpdateComponent(comp.id, { unit_rate: Number(e.target.value) })}
                        />
                        {/* Manhours (labour only) */}
                        {comp.component_type === "labour" && (
                            <input
                                type="number"
                                title="Manhours per parent unit"
                                className="w-16 border border-transparent hover:border-blue-200 rounded px-1 py-0.5 bg-blue-100 text-right text-xs"
                                defaultValue={comp.manhours_per_unit}
                                onBlur={(e) => onUpdateComponent(comp.id, { manhours_per_unit: Number(e.target.value) })}
                                placeholder="hrs/unit"
                            />
                        )}
                        {/* Total */}
                        <span className="w-20 text-right text-xs font-medium text-gray-700">
                            {formatGBP(comp.line_total || 0)}
                        </span>
                        {/* Delete */}
                        <button onClick={() => onDeleteComponent(comp.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-sm">
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* Add component row */}
            <AddComponentRow onAdd={(type) => onAddComponent(line.id, type)} />

            {/* Footer: apply rate + save to library */}
            {components.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-t border-blue-200">
                    <button
                        onClick={() => onSaveToLibrary(line)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                        Save to rate library
                    </button>
                    <button
                        onClick={() => onUpdateBuiltUpRate(line.id, ratePerUnit)}
                        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 font-medium"
                    >
                        Apply rate ({formatGBP(ratePerUnit)}/unit)
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Add Component Row ──────────────────────────────────
function AddComponentRow({ onAdd }: { onAdd: (type: string) => void }) {
    const types = ["material", "labour", "plant", "consumable", "temp_works", "subcontract"];
    return (
        <div className="flex items-center gap-1 px-3 py-2">
            <span className="text-xs text-gray-500 mr-1">Add:</span>
            {types.map((type) => (
                <button
                    key={type}
                    onClick={() => onAdd(type)}
                    className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 capitalize"
                >
                    + {type.replace("_", " ")}
                </button>
            ))}
        </div>
    );
}

// ─── Summary Row ─────────────────────────────────────────
function SummaryRow({ label, value, bold, large }: { label: string; value: number; bold?: boolean; large?: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className={`text-sm ${bold ? "font-bold text-slate-900" : "text-slate-600"} ${large ? "text-base" : ""}`}>
                {label}
            </span>
            <span className={`${bold ? "font-bold text-slate-900" : "text-slate-700"} ${large ? "text-lg" : "text-sm"}`}>
                {formatGBP(value)}
            </span>
        </div>
    );
}
