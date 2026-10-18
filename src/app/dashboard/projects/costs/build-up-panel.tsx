"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    addComponentAction,
    updateComponentAction,
    deleteComponentAction,
    updateLineBuiltUpRateAction,
    saveRateBuildupAction,
} from "./actions";
import type { EstimateLine, EstimateLineComponent, LabourRate, RateBuildup, CostLibraryItem } from "./types";
import ui from "@/components/estimating.module.css";

const PLANT_RATES = [
    { name: "5t excavator (day)", rate: 380, unit: "day" },
    { name: "13t excavator (day)", rate: 550, unit: "day" },
    { name: "Dumper 9t (day)", rate: 185, unit: "day" },
    { name: "Vibrating roller (day)", rate: 220, unit: "day" },
    { name: "Telehandler (day)", rate: 420, unit: "day" },
    { name: "Poker vibrator (day)", rate: 45, unit: "day" },
    { name: "Generator (day)", rate: 65, unit: "day" },
    { name: "Concrete skip (day)", rate: 35, unit: "day" },
    { name: "Skip 8yd\u00B3 (collect)", rate: 285, unit: "nr" },
    { name: "Traffic management (simple, day)", rate: 650, unit: "day" },
];

const COMP_UNITS = ["m", "m\u00B2", "m\u00B3", "nr", "item", "day", "hr", "week", "tonne", "kg"];

const TYPE_COLORS: Record<string, string> = {
    material: "bg-green-100 text-green-700",
    labour: "bg-blue-100 text-blue-700",
    plant: "bg-orange-100 text-orange-700",
    consumable: "bg-purple-100 text-purple-700",
    temp_works: "bg-yellow-100 text-yellow-700",
    subcontract: "bg-gray-100 text-gray-700",
};

function formatGBP(n: number): string {
    return "\u00A3" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BuildUpPanelProps {
    line: EstimateLine;
    orgId: string;
    labourRates: LabourRate[];
    rateBuildups: RateBuildup[];
    materialLibrary: CostLibraryItem[];
    preferredTrades: string[];
    onComponentsChanged: (lineId: string, components: EstimateLineComponent[], previewUnitRate: number) => void;
    onRateApplied: (lineId: string, unitRate: number) => void;
}

export default function BuildUpPanel({
    line,
    orgId,
    labourRates,
    rateBuildups,
    materialLibrary,
    preferredTrades,
    onComponentsChanged,
    onRateApplied,
}: BuildUpPanelProps) {
    const [components, setComponents] = useState<EstimateLineComponent[]>(line.estimate_line_components || []);
    const [isPending, startTransition] = useTransition();
    const applyingRef = useRef(false);
    const [applyStatus, setApplyStatus] = useState<"idle" | "applying" | "applied" | "error">("idle");
    const [appliedSnapshot, setAppliedSnapshot] = useState<string | null>(null);
    const [perUnitEntry, setPerUnitEntry] = useState(false);
    const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
    const canEnterPerUnit = Number.isFinite(line.quantity) && line.quantity > 0;
    const showPerUnit = perUnitEntry && canEnterPerUnit;
    const hasQuantityErrors = showPerUnit && Object.values(quantityErrors).some(Boolean);

    // Per-component description state for controlled material inputs
    const [descInputs, setDescInputs] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        (line.estimate_line_components || []).forEach(c => { init[c.id] = c.description; });
        return init;
    });

    // Trade/category filter state for dropdowns
    const [labourTradeFilter, setLabourTradeFilter] = useState<Record<string, string>>({});
    const [materialCategoryFilter, setMaterialCategoryFilter] = useState<Record<string, string>>({});

    // Filter to raw supply items only — exclude activities (supply & fix, install etc.)
    const rawMaterialItems = materialLibrary.filter(m => {
        const desc = m.description.toLowerCase();
        const isActivity = desc.includes('supply & fix') ||
                           desc.includes('install') ||
                           desc.includes(' & fix') ||
                           desc.includes('excavat') ||
                           desc.includes('dispose') ||
                           desc.includes('place ') ||
                           desc.includes('lay ') ||
                           desc.includes('construct') ||
                           desc.includes('ground slab') ||
                           desc.includes('foundation') ||
                           desc.includes('plinth') ||
                           m.category === 'Labour';
        return !isActivity;
    });

    // Consumable items from the cost library
    const consumableItems = materialLibrary.filter(m => m.category === 'Consumables');

    // Combine hardcoded PLANT_RATES with DB plant items
    const allPlantItems = [
        ...PLANT_RATES.map(p => ({ name: p.name, rate: p.rate, unit: p.unit })),
        ...materialLibrary
            .filter(m => m.category === 'Plant')
            .map(m => ({ name: m.description, rate: m.base_rate, unit: m.unit }))
            .filter(p => !PLANT_RATES.some(pr => pr.name === p.name))
    ];

    const componentTotal = components.reduce((s, c) => s + c.quantity * c.unit_rate, 0);
    const ratePerUnit = line.quantity > 0 ? componentTotal / line.quantity : 0;
    const resourceSnapshot = JSON.stringify({ quantity: line.quantity, rate: ratePerUnit });
    const totalManhours = components
        .filter((c) => c.component_type === "labour")
        .reduce((s, c) => s + c.quantity * c.manhours_per_unit, 0);

    const notifyParent = (updatedComponents: EstimateLineComponent[]) => {
        const total = updatedComponents.reduce((s, c) => s + c.quantity * c.unit_rate, 0);
        const rate = line.quantity > 0 ? total / line.quantity : 0;
        onComponentsChanged(line.id, updatedComponents, rate);
    };

    const handleAdd = (type: string) => {
        startTransition(async () => {
            const result = await addComponentAction(line.id, {
                component_type: type,
                description: "",
                quantity: 1,
                unit: type === "labour" || type === "plant" ? "day" : "nr",
                unit_rate: 0,
                manhours_per_unit: type === "labour" ? 8 : 0,
                sort_order: components.length,
            });
            if (result) {
                setDescInputs(prev => ({ ...prev, [result.id]: '' }));
                setLabourTradeFilter(prev => ({ ...prev, [result.id]: '' }));
                setMaterialCategoryFilter(prev => ({ ...prev, [result.id]: '' }));
                const newComp: EstimateLineComponent = {
                    id: result.id,
                    estimate_line_id: line.id,
                    component_type: type as EstimateLineComponent["component_type"],
                    description: "",
                    quantity: 1,
                    unit: type === "labour" || type === "plant" ? "day" : "nr",
                    unit_rate: 0,
                    line_total: 0,
                    manhours_per_unit: type === "labour" ? 8 : 0,
                    total_manhours: type === "labour" ? 8 : 0,
                    sort_order: components.length,
                };
                const updated = [...components, newComp];
                setComponents(updated);
                notifyParent(updated);
            } else {
                alert("Failed to add component. Please try refreshing the page.");
            }
        });
    };

    const handleUpdate = (compId: string, updates: Partial<EstimateLineComponent>) => {
        const previous = components;
        if (updates.description !== undefined) {
            setDescInputs(prev => ({ ...prev, [compId]: updates.description! }));
        }
        const updated = components.map((c) => {
            if (c.id !== compId) return c;
            const merged = { ...c, ...updates };
            merged.line_total = merged.quantity * merged.unit_rate;
            merged.total_manhours = merged.quantity * merged.manhours_per_unit;
            return merged;
        });
        setComponents(updated);
        notifyParent(updated);
        startTransition(async () => {
            try {
                await updateComponentAction(compId, updates);
            } catch (error) {
                setComponents(previous);
                notifyParent(previous);
                toast.error(error instanceof Error ? error.message : "Component update was not saved");
            }
        });
    };

    const handleDelete = (compId: string) => {
        const previous = components;
        const updated = components.filter((c) => c.id !== compId);
        setComponents(updated);
        notifyParent(updated);
        startTransition(async () => {
            try {
                await deleteComponentAction(compId);
            } catch (error) {
                setComponents(previous);
                notifyParent(previous);
                toast.error(error instanceof Error ? error.message : "Component delete was not saved");
            }
        });
    };

    const handleApplyRate = () => {
        if (applyingRef.current || isPending || hasQuantityErrors) return;
        applyingRef.current = true;
        setApplyStatus("applying");
        startTransition(async () => {
            try {
                await updateLineBuiltUpRateAction(line.id, ratePerUnit);
                onRateApplied(line.id, ratePerUnit);
                setAppliedSnapshot(resourceSnapshot);
                setApplyStatus("applied");
            } catch {
                // The line update can commit before aggregate recalculation fails.
                setApplyStatus("error");
            } finally {
                applyingRef.current = false;
            }
        });
    };

    const handleSaveToLibrary = () => {
        const name = window.prompt("Name for this rate build-up:", line.description || "Built-up rate");
        if (!name) return;
        const totalMph = components
            .filter((c) => c.component_type === "labour")
            .reduce((s, c) => s + c.manhours_per_unit, 0);
        startTransition(async () => {
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
                totalMph
            );
        });
    };

    const handleLoadLibrary = (buildupId: string) => {
        const rb = rateBuildups.find((r) => r.id === buildupId);
        if (!rb) return;
        startTransition(async () => {
            const newComps: EstimateLineComponent[] = [];
            for (const comp of rb.components) {
                const result = await addComponentAction(line.id, {
                    component_type: comp.type,
                    description: comp.description,
                    quantity: comp.quantity,
                    unit: comp.unit,
                    unit_rate: comp.unit_rate,
                    manhours_per_unit: comp.manhours_per_unit || 0,
                    sort_order: newComps.length,
                });
                if (result) {
                    newComps.push({
                        id: result.id,
                        estimate_line_id: line.id,
                        component_type: comp.type as EstimateLineComponent["component_type"],
                        description: comp.description,
                        quantity: comp.quantity,
                        unit: comp.unit,
                        unit_rate: comp.unit_rate,
                        line_total: comp.quantity * comp.unit_rate,
                        manhours_per_unit: comp.manhours_per_unit || 0,
                        total_manhours: comp.quantity * (comp.manhours_per_unit || 0),
                        sort_order: newComps.length,
                    });
                }
            }
            const all = [...components, ...newComps];
            setComponents(all);
            notifyParent(all);
        });
    };

    return (
        <div className={ui.resourcePanel}>
            {/* Header */}
            <div className={ui.resourceHeader}>
                <h4 className={ui.resourceTitle}>Resource build-up</h4>
                <div className={ui.resourceTotals}>
                    <span>Components total: <strong>{formatGBP(componentTotal)}</strong></span>
                    <span>Built-up rate: <strong>{formatGBP(ratePerUnit)}/unit</strong></span>
                    <span>Current line rate: <strong>{formatGBP(line.unit_rate)}/{line.unit}</strong></span>
                    {totalManhours > 0 && <span>Total manhours: <strong>{totalManhours.toFixed(1)}h</strong></span>}
                </div>
            </div>
            <p className={ui.resourceContext}>
                Resources for <strong>{line.description || "this item"}</strong>: {line.quantity} {line.unit} of priced work.
                Each resource amount is quantity multiplied by its rate; their total is divided by the priced quantity to give the built-up unit rate.
            </p>
            <div className={ui.resourceBasis} role="group" aria-label="Resource quantity entry basis">
                <span>Enter quantities:</span>
                <button type="button" aria-pressed={!showPerUnit} onClick={() => setPerUnitEntry(false)}>Total for this line</button>
                <button type="button" aria-label="Enter resource quantities per priced unit" aria-pressed={showPerUnit}
                    disabled={!canEnterPerUnit} onClick={() => setPerUnitEntry(true)}>Per 1 {line.unit}</button>
            </div>
            <p className={ui.resourceNote}>
                Quantities are stored as totals for this line; recheck the build-up if the priced quantity changes.
                Per-unit edits save on leaving the quantity cell. Changing this view does not save or apply a rate.
                {!canEnterPerUnit && " A positive finite priced quantity is needed for per-unit entry."}
            </p>

            {/* Load from library */}
            {rateBuildups.length > 0 && components.length === 0 && (
                <div className="px-3 py-2 border-b border-blue-100">
                    <select
                        className="text-xs border border-blue-200 rounded px-2 py-1 bg-white text-blue-700 w-80"
                        onChange={(e) => {
                            if (e.target.value) handleLoadLibrary(e.target.value);
                        }}
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
            {components.length === 0 && <p className={ui.resourceNote}>No resource rows yet. Current line rate: {formatGBP(line.unit_rate)} per {line.unit}. Add only the resources you need.</p>}
            {components.length > 0 && (
                <div className={ui.resourceViewport} tabIndex={0} role="region" aria-label="Scrollable resource build-up">
                    <table className={ui.resourceTable}>
                        <caption>Resources for {line.description || "this item"} ({line.quantity} {line.unit})</caption>
                        <thead><tr>
                            <th scope="col">Type</th>
                            <th scope="col">Resource</th>
                            <th scope="col">{showPerUnit ? `Quantity per 1 ${line.unit}` : "Total quantity"}</th>
                            <th scope="col">Unit</th>
                            <th scope="col">Resource rate</th>
                            <th scope="col">Hours / resource unit</th>
                            <th scope="col">Resource total</th>
                            <th scope="col"><span className="sr-only">Remove</span></th>
                        </tr></thead>
                        <tbody>
                    {components.map((comp) => (
                        <tr key={comp.id} data-resource-row={comp.id}>
                            <td>
                            {/* Type badge */}
                            <span
                                className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 w-20 text-center ${
                                    TYPE_COLORS[comp.component_type] || "bg-gray-100 text-gray-700"
                                }`}
                            >
                                {comp.component_type.replace("_", " ")}
                            </span>

                            </td>
                            <td className={ui.resourceDescription}>
                            {/* Description — type-specific picker */}
                            {comp.component_type === "labour" ? (
                                <div className="flex-1 flex flex-col gap-1">
                                    {/* Trade filter */}
                                    <select
                                        aria-label={`Trade filter: ${comp.description || "labour"}`}
                                        className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-600"
                                        value={labourTradeFilter[comp.id] || ''}
                                        onChange={e => setLabourTradeFilter(prev => ({ ...prev, [comp.id]: e.target.value }))}
                                    >
                                        <option value="">All trades...</option>
                                        {preferredTrades.length > 0 && (
                                            <optgroup label="Your trades">
                                                {preferredTrades
                                                    .filter(t => labourRates.some(lr => lr.trade === t))
                                                    .map(trade => <option key={trade} value={trade}>{trade}</option>)
                                                }
                                            </optgroup>
                                        )}
                                        <optgroup label="All trades">
                                            {Array.from(new Set(labourRates.map(lr => lr.trade)))
                                                .filter(t => !preferredTrades.includes(t))
                                                .sort()
                                                .map(trade => <option key={trade} value={trade}>{trade}</option>)
                                            }
                                        </optgroup>
                                    </select>
                                    {/* Role picker — filtered by selected trade */}
                                    <select
                                        aria-label={`Labour role: ${comp.description || "labour"}`}
                                        className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                        value={comp.description || ''}
                                        onChange={e => {
                                            if (e.target.value === '__custom__') {
                                                handleUpdate(comp.id, { description: '__custom__' });
                                            } else {
                                                const selected = labourRates.find(lr => lr.role === e.target.value);
                                                if (selected) {
                                                    handleUpdate(comp.id, { description: selected.role, unit_rate: selected.day_rate, unit: 'day' });
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Select role...</option>
                                        {labourRates
                                            .filter(lr => !labourTradeFilter[comp.id] || lr.trade === labourTradeFilter[comp.id])
                                            .map(lr => (
                                                <option key={lr.id} value={lr.role}>
                                                    {lr.role} — £{lr.day_rate}/day
                                                </option>
                                            ))
                                        }
                                        <option value="__custom__">Custom / Other...</option>
                                    </select>
                                    {/* Custom text input */}
                                    {(comp.description === '__custom__' ||
                                        (!labourRates.some(lr => lr.role === comp.description) && comp.description && comp.description !== '__custom__')) && (
                                        <input
                                            aria-label={`Labour description: ${comp.description || "labour"}`}
                                            className="w-full border border-blue-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                            value={comp.description === '__custom__' ? '' : comp.description}
                                            onChange={e => handleUpdate(comp.id, { description: e.target.value })}
                                            placeholder="Type role or description..."
                                            autoFocus
                                        />
                                    )}
                                </div>
                            ) : comp.component_type === "plant" ? (
                                <div className="flex-1 flex items-center gap-1">
                                    <select
                                        aria-label={`Plant resource: ${comp.description || "plant"}`}
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                        value={comp.description || ""}
                                        onChange={(e) => {
                                            if (e.target.value === "__custom__") {
                                                handleUpdate(comp.id, { description: "__custom__" });
                                            } else {
                                                const selected = allPlantItems.find((p) => p.name === e.target.value);
                                                if (selected) {
                                                    handleUpdate(comp.id, {
                                                        description: selected.name,
                                                        unit_rate: selected.rate,
                                                        unit: selected.unit,
                                                    });
                                                } else {
                                                    handleUpdate(comp.id, { description: e.target.value });
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Select plant item...</option>
                                        {allPlantItems.map((p) => (
                                            <option key={p.name} value={p.name}>
                                                {p.name} — £{p.rate}/{p.unit}
                                            </option>
                                        ))}
                                        <option value="__custom__">Custom / Other...</option>
                                    </select>
                                    {(comp.description === "__custom__" ||
                                        (!allPlantItems.some((p) => p.name === comp.description) && comp.description)) && (
                                        <input
                                            aria-label={`Plant description: ${comp.description || "plant"}`}
                                            className="w-32 border border-blue-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                            value={comp.description === "__custom__" ? "" : comp.description}
                                            onChange={(e) => handleUpdate(comp.id, { description: e.target.value })}
                                            placeholder="Type description..."
                                            autoFocus
                                        />
                                    )}
                                </div>
                            ) : comp.component_type === "material" ? (
                                <div className="flex-1 flex flex-col gap-1">
                                    {/* Category filter */}
                                    <select
                                        aria-label={`Material category: ${comp.description || "material"}`}
                                        className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-600"
                                        value={materialCategoryFilter[comp.id] || ''}
                                        onChange={e => setMaterialCategoryFilter(prev => ({ ...prev, [comp.id]: e.target.value }))}
                                    >
                                        <option value="">All categories...</option>
                                        {(() => {
                                            const allCats = Array.from(new Set(rawMaterialItems.map(m => m.category))).sort();
                                            const preferredCats = allCats.filter(c => preferredTrades.includes(c));
                                            const otherCats = allCats.filter(c => !preferredTrades.includes(c));
                                            return (<>
                                                {preferredCats.length > 0 && (
                                                    <optgroup label="Your trades">
                                                        {preferredCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                    </optgroup>
                                                )}
                                                <optgroup label="All categories">
                                                    {otherCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </optgroup>
                                            </>);
                                        })()}
                                    </select>
                                    {/* Material input with datalist */}
                                    <input
                                        aria-label={`Material description: ${comp.description || "material"}`}
                                        list={`mat-${comp.id}`}
                                        className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
                                        value={descInputs[comp.id] ?? comp.description}
                                        onChange={(e) => {
                                            setDescInputs(prev => ({ ...prev, [comp.id]: e.target.value }));
                                            const match = rawMaterialItems.find(m =>
                                                m.description.toLowerCase() === e.target.value.toLowerCase()
                                            );
                                            if (match) {
                                                handleUpdate(comp.id, {
                                                    description: match.description,
                                                    unit_rate: match.base_rate,
                                                    unit: match.unit,
                                                });
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const val = e.target.value.trim();
                                            if (!val) return;
                                            const match = rawMaterialItems.find(m =>
                                                m.description.toLowerCase() === val.toLowerCase()
                                            );
                                            if (!match) {
                                                handleUpdate(comp.id, { description: val });
                                            }
                                        }}
                                        placeholder="Search or type material..."
                                    />
                                    <datalist id={`mat-${comp.id}`}>
                                        {rawMaterialItems
                                            .filter(m => !materialCategoryFilter[comp.id] || m.category === materialCategoryFilter[comp.id])
                                            .map(m => (
                                                <option key={m.id} value={m.description} />
                                            ))
                                        }
                                    </datalist>
                                </div>
                            ) : comp.component_type === "consumable" ? (
                                <div className="flex-1 flex flex-col gap-1">
                                    <input
                                        aria-label={`Consumable description: ${comp.description || "consumable"}`}
                                        list={`cons-${comp.id}`}
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
                                        value={descInputs[comp.id] ?? comp.description}
                                        onChange={e => {
                                            setDescInputs(prev => ({ ...prev, [comp.id]: e.target.value }));
                                            const match = consumableItems.find(m => m.description.toLowerCase() === e.target.value.toLowerCase());
                                            if (match) handleUpdate(comp.id, { description: match.description, unit_rate: match.base_rate, unit: match.unit });
                                        }}
                                        onBlur={e => {
                                            const val = e.target.value.trim();
                                            if (val && !consumableItems.find(m => m.description.toLowerCase() === val.toLowerCase())) {
                                                handleUpdate(comp.id, { description: val });
                                            }
                                        }}
                                        placeholder="Search consumables or type description..."
                                    />
                                    <datalist id={`cons-${comp.id}`}>
                                        {consumableItems.map(m => <option key={m.id} value={m.description} />)}
                                    </datalist>
                                </div>
                            ) : comp.component_type === "subcontract" ? (
                                <div className="flex-1 flex flex-col gap-1">
                                    <input
                                        aria-label={`Subcontract description: ${comp.description || "subcontract"}`}
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
                                        value={descInputs[comp.id] ?? comp.description}
                                        onChange={e => {
                                            setDescInputs(prev => ({ ...prev, [comp.id]: e.target.value }));
                                            handleUpdate(comp.id, { description: e.target.value });
                                        }}
                                        placeholder="Subcontractor name or description (e.g. Specialist groundworks package)..."
                                    />
                                    <span className="text-xs text-gray-400">Enter the subcontract value as the rate below</span>
                                </div>
                            ) : (
                                <input
                                    aria-label={`Resource description: ${comp.description || comp.component_type}`}
                                    className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
                                    defaultValue={comp.description}
                                    onBlur={(e) => handleUpdate(comp.id, { description: e.target.value })}
                                    placeholder="Description..."
                                />
                            )}

                            </td>
                            <td>
                            {showPerUnit ? (
                                <input
                                    key={`per-unit-${comp.id}-${line.quantity}-${comp.quantity}`}
                                    type="number" step="any"
                                    aria-label={`Quantity per 1 ${line.unit}: ${comp.description || comp.component_type}`}
                                    aria-invalid={!!quantityErrors[comp.id]}
                                    aria-describedby={quantityErrors[comp.id] ? `quantity-error-${comp.id}` : undefined}
                                    defaultValue={comp.quantity / line.quantity}
                                    onBlur={(event) => {
                                        const raw = event.target.value.trim();
                                        setQuantityErrors(previous => ({ ...previous, [comp.id]: "" }));
                                        // Do not round-trip an unchanged displayed division into a write.
                                        if (raw === String(comp.quantity / line.quantity)) return;
                                        const quantity = Number(raw) * line.quantity;
                                        const decimal = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw);
                                        if (!decimal || !Number.isFinite(quantity) || !Number.isFinite(quantity * comp.unit_rate)) {
                                            setQuantityErrors(previous => ({ ...previous, [comp.id]: "Enter a finite resource quantity; this change has not been saved." }));
                                            return;
                                        }
                                        handleUpdate(comp.id, { quantity });
                                    }}
                                />
                            ) : (
                                <input
                                    type="number"
                                    aria-label={`Total resource quantity: ${comp.description || comp.component_type}`}
                                    className="w-14 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                    value={comp.quantity}
                                    onChange={(e) => handleUpdate(comp.id, { quantity: Number(e.target.value) || 0 })}
                                />
                            )}
                            {showPerUnit && quantityErrors[comp.id] && <p role="alert" id={`quantity-error-${comp.id}`}>{quantityErrors[comp.id]}</p>}
                            </td>
                            <td>
                            {/* Unit */}
                            <select
                                aria-label={`Resource unit: ${comp.description || comp.component_type}`}
                                className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                value={comp.unit}
                                onChange={(e) => {
                                    const newUnit = e.target.value;
                                    // Auto-convert rate between hr/day/week for labour and plant
                                    if ((comp.component_type === "labour" || comp.component_type === "plant") && comp.unit_rate > 0) {
                                        const oldUnit = comp.unit;
                                        const toHourly: Record<string, number> = { hr: 1, day: 1 / 8, week: 1 / 40 };
                                        const fromHourly: Record<string, number> = { hr: 1, day: 8, week: 40 };
                                        if (toHourly[oldUnit] && fromHourly[newUnit]) {
                                            const hourlyRate = comp.unit_rate * toHourly[oldUnit];
                                            const newRate = Math.round(hourlyRate * fromHourly[newUnit] * 100) / 100;
                                            if (comp.component_type === "labour") {
                                                const newManhours = newUnit === "hr" ? 1 : newUnit === "day" ? 8 : 40;
                                                handleUpdate(comp.id, { unit: newUnit, unit_rate: newRate, manhours_per_unit: newManhours });
                                            } else {
                                                handleUpdate(comp.id, { unit: newUnit, unit_rate: newRate });
                                            }
                                            return;
                                        }
                                    }
                                    handleUpdate(comp.id, { unit: newUnit });
                                }}
                            >
                                {COMP_UNITS.map((u) => (
                                    <option key={u}>{u}</option>
                                ))}
                            </select>

                            </td>
                            <td>
                            {/* Rate — controlled input */}
                            <input
                                type="number"
                                className="w-20 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                aria-label={`Resource rate: ${comp.description || comp.component_type}`}
                                value={comp.unit_rate === 0 ? '' : comp.unit_rate}
                                onChange={(e) => handleUpdate(comp.id, { unit_rate: Number(e.target.value) || 0 })}
                            />

                            </td>
                            <td>
                            {/* Manhours (labour only) */}
                            {comp.component_type === "labour" && (
                                <div className="flex flex-col items-end">
                                    <span className="sr-only">Hours per resource unit</span>
                                    <input
                                        type="number"
                                        aria-label={`Hours per resource unit: ${comp.description || "labour"}`}
                                        title="Hours for one resource unit; multiplied by total resource quantity to calculate labour hours"
                                        className="w-16 text-right text-xs border border-blue-300 rounded px-1 py-0.5 bg-blue-100 text-gray-900"
                                        value={comp.manhours_per_unit}
                                        onChange={(e) => handleUpdate(comp.id, { manhours_per_unit: Number(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            </td>
                            <td className={ui.resourceNumeric}>
                            {/* Total */}
                            <span className="w-20 text-right text-xs font-medium text-gray-700">
                                {formatGBP(comp.quantity * comp.unit_rate)}
                            </span>

                            </td>
                            <td>
                            {/* Delete */}
                            <button
                                type="button"
                                aria-label={`Remove resource: ${comp.description || comp.component_type}`}
                                onClick={() => handleDelete(comp.id)}
                                className="text-red-400 hover:text-red-600 text-sm flex-shrink-0"
                            >
                                ×
                            </button>
                            </td>
                        </tr>
                    ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add buttons — these use LOCAL state, not parent's isPending */}
            <div className="flex items-center gap-1 px-3 py-2 flex-wrap">
                <span className="text-xs text-gray-500 mr-1">Add:</span>
                {["material", "labour", "plant", "consumable", "temp_works", "subcontract"].map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => handleAdd(type)}
                        disabled={isPending}
                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 capitalize transition-colors disabled:opacity-50"
                    >
                        + {type.replace("_", " ")}
                    </button>
                ))}
            </div>

            {components.length > 0 && (
                <p className={ui.resourceNote}>
                    Resource changes update the build-up, not the line price. Apply rate when you want to update the line price.
                </p>
            )}
            {applyStatus === "error" && (
                <p className={ui.resourceNote} role="alert"><strong>Rate not confirmed.</strong> It may have been saved. Check the line price or retry Apply rate.</p>
            )}
            {applyStatus === "applied" && (
                <p className={ui.resourceNote} role="status">
                    {appliedSnapshot === resourceSnapshot ? "Rate applied to the line price." : "Resource changes need applying. The earlier rate was applied, not these newer changes."}
                </p>
            )}
            {/* Footer */}
            {components.length > 0 && (
                <div className={ui.resourceFooter}>
                    <button
                        type="button"
                        onClick={handleSaveToLibrary}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                        Save to rate library
                    </button>
                    <button
                        type="button"
                        onClick={handleApplyRate}
                        aria-label="Apply resource rate"
                        aria-busy={applyStatus === "applying"}
                        disabled={isPending || applyStatus === "applying" || hasQuantityErrors}
                        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 font-medium"
                    >
                        {applyStatus === "applying" ? "Applying rate..." : `${applyStatus === "error" ? "Retry Apply rate" : "Apply rate"} (${formatGBP(ratePerUnit)}/unit)`} →
                    </button>
                </div>
            )}
        </div>
    );
}
