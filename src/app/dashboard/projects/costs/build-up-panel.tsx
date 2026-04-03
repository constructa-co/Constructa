"use client";

import { useState, useTransition } from "react";
import {
    addComponentAction,
    updateComponentAction,
    deleteComponentAction,
    updateLineBuiltUpRateAction,
    saveRateBuildupAction,
} from "./actions";
import type { EstimateLine, EstimateLineComponent, LabourRate, RateBuildup, CostLibraryItem } from "./types";

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
    onComponentsChanged: (lineId: string, components: EstimateLineComponent[], newUnitRate: number) => void;
}

export default function BuildUpPanel({
    line,
    orgId,
    labourRates,
    rateBuildups,
    materialLibrary,
    onComponentsChanged,
}: BuildUpPanelProps) {
    const [components, setComponents] = useState<EstimateLineComponent[]>(line.estimate_line_components || []);
    const [isPending, startTransition] = useTransition();

    // Per-component description state for controlled material inputs
    const [descInputs, setDescInputs] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        (line.estimate_line_components || []).forEach(c => { init[c.id] = c.description; });
        return init;
    });

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

    const componentTotal = components.reduce((s, c) => s + c.quantity * c.unit_rate, 0);
    const ratePerUnit = line.quantity > 0 ? componentTotal / line.quantity : 0;
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
            await updateComponentAction(compId, updates);
        });
    };

    const handleDelete = (compId: string) => {
        const updated = components.filter((c) => c.id !== compId);
        setComponents(updated);
        notifyParent(updated);
        startTransition(async () => {
            await deleteComponentAction(compId);
        });
    };

    const handleApplyRate = () => {
        startTransition(async () => {
            await updateLineBuiltUpRateAction(line.id, ratePerUnit);
        });
        onComponentsChanged(line.id, components, ratePerUnit);
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
        <div className="ml-10 mr-5 mb-3 border border-blue-200 rounded-lg bg-blue-50/30">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-200">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Rate Build-Up</span>
                <div className="flex items-center gap-3 text-xs text-blue-600">
                    <span>Components total: <strong>{formatGBP(componentTotal)}</strong></span>
                    <span>Built-up rate: <strong>{formatGBP(ratePerUnit)}/unit</strong></span>
                    {totalManhours > 0 && <span>Total manhours: <strong>{totalManhours.toFixed(1)}h</strong></span>}
                </div>
            </div>
            <p className="px-3 py-1 text-xs text-blue-500 bg-blue-50/50 border-b border-blue-100">
                Building up cost for: <strong>{line.description || 'this item'}</strong> ({line.quantity} {line.unit}) —
                enter costs per component. For labour, &quot;hrs/unit&quot; = manhours to complete one unit of the parent item.
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
            {components.length > 0 && (
                <div className="divide-y divide-blue-100">
                    {components.map((comp) => (
                        <div key={comp.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                            {/* Type badge */}
                            <span
                                className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 w-20 text-center ${
                                    TYPE_COLORS[comp.component_type] || "bg-gray-100 text-gray-700"
                                }`}
                            >
                                {comp.component_type.replace("_", " ")}
                            </span>

                            {/* Description — type-specific picker */}
                            {comp.component_type === "labour" ? (
                                <div className="flex-1 flex items-center gap-1">
                                    <select
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                        value={comp.description || ""}
                                        onChange={(e) => {
                                            if (e.target.value === "__custom__") {
                                                handleUpdate(comp.id, { description: "__custom__" });
                                            } else {
                                                const selected = labourRates.find((lr) => lr.role === e.target.value);
                                                if (selected) {
                                                    handleUpdate(comp.id, {
                                                        description: selected.role,
                                                        unit_rate: selected.day_rate,
                                                        unit: "day",
                                                    });
                                                } else {
                                                    handleUpdate(comp.id, { description: e.target.value });
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Select trade / staff member...</option>
                                        {Array.from(new Set(labourRates.map((lr) => lr.trade))).map((trade) => (
                                            <optgroup key={trade} label={trade}>
                                                {labourRates
                                                    .filter((lr) => lr.trade === trade)
                                                    .map((lr) => (
                                                        <option key={lr.id} value={lr.role}>
                                                            {lr.role} — £{lr.day_rate}/day (£{lr.hourly_rate?.toFixed(2)}/hr){" "}
                                                            {lr.region !== "national" ? `[${lr.region}]` : ""}
                                                        </option>
                                                    ))}
                                            </optgroup>
                                        ))}
                                        <option value="" disabled>── or type custom description ──</option>
                                        <option value="__custom__">Custom / Other...</option>
                                    </select>
                                    {(comp.description === "__custom__" ||
                                        (!labourRates.some((lr) => lr.role === comp.description) && comp.description)) && (
                                        <input
                                            className="w-32 border border-blue-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                            value={comp.description === "__custom__" ? "" : comp.description}
                                            onChange={(e) => handleUpdate(comp.id, { description: e.target.value })}
                                            placeholder="Type description..."
                                            autoFocus
                                        />
                                    )}
                                </div>
                            ) : comp.component_type === "plant" ? (
                                <div className="flex-1 flex items-center gap-1">
                                    <select
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                        value={comp.description || ""}
                                        onChange={(e) => {
                                            if (e.target.value === "__custom__") {
                                                handleUpdate(comp.id, { description: "__custom__" });
                                            } else {
                                                const selected = PLANT_RATES.find((p) => p.name === e.target.value);
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
                                        {PLANT_RATES.map((p) => (
                                            <option key={p.name} value={p.name}>
                                                {p.name} — £{p.rate}/{p.unit}
                                            </option>
                                        ))}
                                        <option value="" disabled>── or type custom description ──</option>
                                        <option value="__custom__">Custom / Other...</option>
                                    </select>
                                    {(comp.description === "__custom__" ||
                                        (!PLANT_RATES.some((p) => p.name === comp.description) && comp.description)) && (
                                        <input
                                            className="w-32 border border-blue-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
                                            value={comp.description === "__custom__" ? "" : comp.description}
                                            onChange={(e) => handleUpdate(comp.id, { description: e.target.value })}
                                            placeholder="Type description..."
                                            autoFocus
                                        />
                                    )}
                                </div>
                            ) : comp.component_type === "material" ? (
                                <>
                                    <input
                                        list={`mat-${comp.id}`}
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
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
                                        placeholder="Search materials or type description..."
                                    />
                                    <datalist id={`mat-${comp.id}`}>
                                        {rawMaterialItems.map((m) => (
                                            <option key={m.id} value={m.description}>
                                                {m.description} — £{m.base_rate}/{m.unit}
                                            </option>
                                        ))}
                                    </datalist>
                                </>
                            ) : (
                                <input
                                    className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
                                    defaultValue={comp.description}
                                    onBlur={(e) => handleUpdate(comp.id, { description: e.target.value })}
                                    placeholder="Description..."
                                />
                            )}

                            {/* Qty */}
                            <input
                                type="number"
                                className="w-14 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                value={comp.quantity}
                                onChange={(e) => handleUpdate(comp.id, { quantity: Number(e.target.value) || 0 })}
                            />

                            {/* Unit */}
                            <select
                                className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                value={comp.unit}
                                onChange={(e) => handleUpdate(comp.id, { unit: e.target.value })}
                            >
                                {COMP_UNITS.map((u) => (
                                    <option key={u}>{u}</option>
                                ))}
                            </select>

                            {/* Rate — controlled input */}
                            <input
                                type="number"
                                className="w-20 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                value={comp.unit_rate === 0 ? '' : comp.unit_rate}
                                onChange={(e) => handleUpdate(comp.id, { unit_rate: Number(e.target.value) || 0 })}
                            />

                            {/* Manhours (labour only) */}
                            {comp.component_type === "labour" && (
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] text-blue-500 font-medium mb-0.5">hrs/unit</span>
                                    <input
                                        type="number"
                                        title="Manhours per unit of the parent line item (e.g. 0.4 hrs per m³ of concrete placed)"
                                        className="w-16 text-right text-xs border border-blue-300 rounded px-1 py-0.5 bg-blue-100 text-gray-900"
                                        value={comp.manhours_per_unit}
                                        onChange={(e) => handleUpdate(comp.id, { manhours_per_unit: Number(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            {/* Total */}
                            <span className="w-20 text-right text-xs font-medium text-gray-700">
                                {formatGBP(comp.quantity * comp.unit_rate)}
                            </span>

                            {/* Delete */}
                            <button
                                type="button"
                                onClick={() => handleDelete(comp.id)}
                                className="text-red-400 hover:text-red-600 text-sm flex-shrink-0"
                            >
                                ×
                            </button>
                        </div>
                    ))}
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

            {/* Footer */}
            {components.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-t border-blue-200">
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
                        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 font-medium"
                    >
                        Apply rate ({formatGBP(ratePerUnit)}/unit) →
                    </button>
                </div>
            )}
        </div>
    );
}
