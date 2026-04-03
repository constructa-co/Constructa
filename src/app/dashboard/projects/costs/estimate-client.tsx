"use client";
// v3 - extracted BuildUpPanel as standalone client component

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
    setPricingModeAction,
} from "./actions";
import { Plus, Trash2, Check, Star, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import BuildUpPanel from "./build-up-panel";
import type { EstimateLineComponent, EstimateLine, Estimate, CostLibraryItem, LabourRate, RateBuildup } from "./types";

interface Props {
    estimates: Estimate[];
    costLibrary: CostLibraryItem[];
    projectId: string;
    orgId: string;
    rateBuildups: RateBuildup[];
    labourRates: LabourRate[];
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
export default function EstimateClient({ estimates: initialEstimates, costLibrary, projectId, orgId, rateBuildups, labourRates }: Props) {
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
        // Fire-and-forget server sync
        showSaving();
        updateEstimateMarginsAction(currentEstimate.id, updated.overhead_pct, updated.profit_pct, updated.risk_pct, updated.prelims_pct)
            .then(() => showSaved())
            .catch(console.error);
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
            .catch(console.error);
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
        }
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

        // Recalc local total_cost immediately
        setEstimates((prev) =>
            prev.map((e) => {
                if (e.id !== currentEstimate.id) return e;
                const total = e.estimate_lines.reduce((s, l) => s + (l.line_total || 0), 0);
                return { ...e, total_cost: total };
            })
        );

        // Fire-and-forget server sync
        showSaving();
        const line = currentEstimate.estimate_lines.find((l) => l.id === lineId);
        const qty = updates.quantity ?? line?.quantity ?? 1;
        const rate = updates.unit_rate ?? line?.unit_rate ?? 0;
        updateLineItemAction(lineId, { ...updates, quantity: qty, unit_rate: rate })
            .then(() => showSaved())
            .catch(console.error);
    };

    const handleDeleteLine = (lineId: string) => {
        if (!currentEstimate) return;
        // Optimistic delete
        setEstimates((prev) =>
            prev.map((e) =>
                e.id === currentEstimate.id
                    ? { ...e, estimate_lines: e.estimate_lines.filter((l) => l.id !== lineId) }
                    : e
            )
        );
        // Recalc local total immediately
        setEstimates((prev) =>
            prev.map((e) => {
                if (e.id !== currentEstimate.id) return e;
                const total = e.estimate_lines.reduce((s, l) => s + (l.line_total || 0), 0);
                return { ...e, total_cost: total };
            })
        );
        // Fire-and-forget server sync
        showSaving();
        deleteLineItemAction(lineId)
            .then(() => showSaved())
            .catch(console.error);
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
                        type="button"
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
                    type="button"
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
                                    type="button"
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
                                    type="button"
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
                                type="button"
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
                                                    type="button"
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
                                        {/* Build-up panel — standalone client component with own state */}
                                        {line.pricing_mode === "buildup" && (
                                            <BuildUpPanel
                                                line={line}
                                                orgId={orgId}
                                                labourRates={labourRates}
                                                rateBuildups={rateBuildups}
                                                materialLibrary={costLibrary}
                                                onComponentsChanged={handleComponentsChanged}
                                            />
                                        )}
                                    </div>
                                ))}

                                {/* Add line button */}
                                <button
                                    type="button"
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
                                type="button"
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
                type="button"
                onClick={() => onDelete(line.id)}
                className="h-8 w-8 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
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
