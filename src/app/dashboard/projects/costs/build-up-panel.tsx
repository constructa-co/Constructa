"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
const COMPONENT_TYPES = ["material", "labour", "plant", "consumable", "temp_works", "subcontract", "consultancy"];
type ResourceDraft = { token: number; context: string; type: string; description: string; quantity: string; unit: string; rate: string; hours: string; basis: "total" | "per-unit"; pricedQuantity: number; pricedUnit: string };
type ResourceNumberField = "unit_rate" | "quantity" | "manhours_per_unit";
type NumberDraft = { token: number; context: string; id: string; field: ResourceNumberField | "description"; value: string };
const RESOURCE_NUMBER_LABELS = { unit_rate: "rate", quantity: "quantity", manhours_per_unit: "hours" };

function isFreeformResource(type: string) {
    return type === "subcontract" || type === "consultancy" || type === "temp_works";
}

function resourceNameLabel(type: string) {
    return type === "temp_works" ? "temporary works" : type;
}

function validResourceNumber(component: EstimateLineComponent, field: ResourceNumberField, value: number) {
    const updated = { ...component, [field]: value };
    return Number.isFinite(updated.quantity * updated.unit_rate) && Number.isFinite(updated.quantity * updated.manhours_per_unit);
}

function resourceNumberValue(raw: string): number | null {
    const value = raw.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function resourceDraftQuantity(draft: ResourceDraft): number | null {
    if (!draft.quantity.trim()) return null;
    const entered = Number(draft.quantity);
    if (!Number.isFinite(entered) || entered < 0) return null;
    if (draft.basis === "total") return entered;
    if (resourceNumberValue(draft.quantity) === null || !Number.isFinite(draft.pricedQuantity) || draft.pricedQuantity <= 0) return null;
    const total = entered * draft.pricedQuantity;
    // Refuse, rather than round, a conversion that cannot fit existing NUMERIC(12,4) storage.
    return Number.isFinite(total) && total < 100_000_000 && Number(total.toFixed(4)) === total ? total : null;
}

function resourceDraftValues(draft: ResourceDraft) {
    const numbers = [draft.quantity, draft.rate, draft.hours];
    if (!draft.description.trim() || !COMP_UNITS.includes(draft.unit) || !numbers.every(value => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0)) return null;
    const quantity = resourceDraftQuantity(draft);
    if (quantity === null) return null;
    const [, unit_rate, manhours_per_unit] = numbers.map(Number);
    if (!Number.isFinite(quantity * unit_rate) || !Number.isFinite(quantity * manhours_per_unit)) return null;
    return { component_type: draft.type, description: draft.description, quantity, unit: draft.unit, unit_rate, manhours_per_unit };
}

const TYPE_COLORS: Record<string, string> = {
    material: "bg-green-100 text-green-700",
    labour: "bg-blue-100 text-blue-700",
    plant: "bg-orange-100 text-orange-700",
    consumable: "bg-purple-100 text-purple-700",
    temp_works: "bg-yellow-100 text-yellow-700",
    subcontract: "bg-gray-100 text-gray-700",
    consultancy: "bg-gray-100 text-gray-700",
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
    onRateApplied: (lineId: string, unitRate: number, quantity: number, lineTotal: number) => void;
    saveBlocked?: boolean;
    priceSavePending?: boolean;
    canApplyRate?: () => boolean;
    onApplyPendingChanged?: (lineId: string, pending: boolean) => void;
    onSaveStateChanged?: (lineId: string, state: "saving" | "confirmed" | "uncertain") => void;
    librarySaveState?: "saving" | "uncertain";
    onLibrarySaveStateChanged?: (lineId: string, state: "saving" | "confirmed" | "uncertain") => void;
    onDraftChanged?: (lineId: string, open: boolean) => void;
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
    saveBlocked = false,
    priceSavePending = false,
    canApplyRate,
    onApplyPendingChanged,
    onSaveStateChanged,
    librarySaveState,
    onLibrarySaveStateChanged,
    onDraftChanged,
}: BuildUpPanelProps) {
    const [components, setComponents] = useState<EstimateLineComponent[]>(line.estimate_line_components || []);
    const componentsRef = useRef(line.estimate_line_components || []);
    const resourceQueueRef = useRef<Promise<void>>(Promise.resolve());
    const resourcePendingRef = useRef(0);
    const resourceUncertainRef = useRef(saveBlocked);
    const resourceVersionsRef = useRef<Record<string, number>>({});
    const [resourceStatus, setResourceStatus] = useState<"idle" | "saving" | "confirmed" | "uncertain">("idle");
    const resourcesBlocked = saveBlocked || resourceStatus === "uncertain";
    const [isPending, startTransition] = useTransition();
    const applyingRef = useRef(false);
    const librarySavingRef = useRef(false);
    const libraryUncertainRef = useRef(librarySaveState === "uncertain");
    const [libraryStatus, setLibraryStatus] = useState<"idle" | "saving" | "confirmed" | "uncertain">("idle");
    const [libraryCopy, setLibraryCopy] = useState<{ name: string; snapshot: string } | null>(null);
    const [libraryReview, setLibraryReview] = useState<{ id: string; source: string; context: string } | null>(null);
    const libraryReviewRef = useRef<typeof libraryReview>(null);
    const libraryActiveRef = useRef(true);
    const [resourceDraft, setResourceDraft] = useState<ResourceDraft | null>(null);
    const resourceDraftRef = useRef<ResourceDraft | null>(null);
    const [resourceContinuation, setResourceContinuation] = useState<ResourceDraft | null>(null);
    const resourceContinuationRef = useRef<ResourceDraft | null>(null);
    const [numberDraft, setNumberDraft] = useState<NumberDraft | null>(null);
    const numberDraftRef = useRef<NumberDraft | null>(null);
    const draftSequence = useRef(0);
    const libraryUncertain = librarySaveState === "uncertain" || libraryStatus === "uncertain";
    const libraryPending = librarySaveState === "saving" || libraryStatus === "saving";
    const librarySnapshot = JSON.stringify({ unit: line.unit, trade_section: line.trade_section, quantity: line.quantity, components });
    const [applyStatus, setApplyStatus] = useState<"idle" | "applying" | "applied" | "error">("idle");
    const [appliedSnapshot, setAppliedSnapshot] = useState<string | null>(null);
    const [perUnitEntry, setPerUnitEntry] = useState(false);
    const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
    const [reviewedBasis, setReviewedBasis] = useState<string | null>(null);
    const reviewedBasisRef = useRef<string | null>(null);
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
    const basisSnapshot = JSON.stringify({ id: line.id, quantity: line.quantity, unit: line.unit, components });
    const basisReviewed = reviewedBasis === basisSnapshot;
    const reviewBlocked = isPending || applyStatus === "applying" || libraryPending || hasQuantityErrors || resourceStatus === "saving" || resourcesBlocked || priceSavePending;
    const libraryContext = JSON.stringify({ orgId, id: line.id, estimate: line.estimate_id, quantity: line.quantity, unit: line.unit, components, savedComponents: line.estimate_line_components });
    const latestLibrary = useRef({ context: libraryContext, sources: rateBuildups, blocked: reviewBlocked });
    useEffect(() => {
        latestLibrary.current = { context: libraryContext, sources: rateBuildups, blocked: reviewBlocked };
    }, [libraryContext, rateBuildups, reviewBlocked]);
    useEffect(() => {
        libraryActiveRef.current = true;
        return () => { libraryActiveRef.current = false; };
    }, []);
    const reviewedLibrarySource = rateBuildups.find(source => source.id === libraryReview?.id);
    const libraryReviewCurrent = !!libraryReview && libraryReview.context === libraryContext && JSON.stringify(reviewedLibrarySource) === libraryReview.source;
    const continuationFresh = !!resourceContinuation && resourceContinuation.context === libraryContext && !reviewBlocked;
    const shownResourceDraft = continuationFresh ? resourceContinuation : resourceDraft;
    const draftValues = shownResourceDraft ? resourceDraftValues(shownResourceDraft) : null;
    const draftQuantity = shownResourceDraft ? resourceDraftQuantity(shownResourceDraft) : null;
    const draftCurrent = shownResourceDraft?.context === libraryContext && (!resourceContinuation || continuationFresh);
    const numberDraftValue = numberDraft ? resourceNumberValue(numberDraft.value) : null;
    const numberDraftCurrent = numberDraft?.context === libraryContext;
    const totalManhours = components
        .filter((c) => c.component_type === "labour")
        .reduce((s, c) => s + c.quantity * c.manhours_per_unit, 0);

    const notifyParent = (updatedComponents: EstimateLineComponent[]) => {
        const total = updatedComponents.reduce((s, c) => s + c.quantity * c.unit_rate, 0);
        const rate = line.quantity > 0 ? total / line.quantity : 0;
        onComponentsChanged(line.id, updatedComponents, rate);
    };

    const publishComponents = (updated: EstimateLineComponent[]) => {
        libraryReviewRef.current = null;
        setLibraryReview(null);
        reviewedBasisRef.current = null;
        setReviewedBasis(null);
        componentsRef.current = updated;
        setComponents(updated);
        notifyParent(updated);
    };

    // Ordered writes prevent an older response from becoming the final saved edit.
    // On uncertainty, retain local edits but stop the queue and block price Apply.
    const saveResources = (write: () => Promise<void>) => {
        resourcePendingRef.current += 1;
        setResourceStatus("saving");
        onSaveStateChanged?.(line.id, "saving");
        const execute = async () => {
            if (resourceUncertainRef.current) return;
            try {
                await write();
            } catch {
                resourceUncertainRef.current = true;
                setResourceStatus("uncertain");
                onSaveStateChanged?.(line.id, "uncertain");
                toast.error("Resource save not confirmed. Some changes may already have saved. Reload the estimate to reconcile resources before applying a rate.");
            }
        };
        const request = resourcePendingRef.current === 1 ? execute() : resourceQueueRef.current.then(execute);
        resourceQueueRef.current = request;
        startTransition(async () => {
            await request;
            resourcePendingRef.current -= 1;
            if (resourcePendingRef.current === 0 && !resourceUncertainRef.current) {
                setResourceStatus("confirmed");
                onSaveStateChanged?.(line.id, "confirmed");
            }
        });
    };

    const handleAdd = (type: string) => {
        if (libraryContext !== latestLibrary.current.context || numberDraftRef.current || !libraryActiveRef.current || resourceDraftRef.current || latestLibrary.current.blocked || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false || !COMPONENT_TYPES.includes(type)) return;
        const draft: ResourceDraft = { token: ++draftSequence.current, context: latestLibrary.current.context, type, description: "", quantity: "", unit: "", rate: "", hours: "", basis: "total", pricedQuantity: line.quantity, pricedUnit: line.unit };
        resourceDraftRef.current = draft;
        setResourceDraft(draft);
        libraryReviewRef.current = null;
        setLibraryReview(null);
        onDraftChanged?.(line.id, true);
    };

    const currentResourceDraft = () => {
        const next = resourceContinuationRef.current;
        if (!next) return resourceDraftRef.current;
        return next.context === latestLibrary.current.context && !latestLibrary.current.blocked ? next : null;
    };

    const editResourceDraft = (token: number, field: "description" | "quantity" | "unit" | "rate" | "hours", value: string) => {
        const draft = currentResourceDraft();
        if (!libraryActiveRef.current || !draft || draft.token !== token || draft.context !== latestLibrary.current.context || latestLibrary.current.blocked || resourcePendingRef.current > 0 || resourceUncertainRef.current || canApplyRate?.() === false) return;
        const updated = { ...draft, [field]: value };
        resourceContinuationRef.current = null;
        setResourceContinuation(null);
        resourceDraftRef.current = updated;
        setResourceDraft(updated);
    };

    const changeResourceBasis = (token: number, basis: string) => {
        const draft = currentResourceDraft();
        if (!libraryActiveRef.current || !draft || draft.token !== token || draft.context !== latestLibrary.current.context || latestLibrary.current.blocked || resourcePendingRef.current > 0 || resourceUncertainRef.current || canApplyRate?.() === false) return;
        if (basis !== "total" && basis !== "per-unit") return;
        if (basis === "per-unit" && (!Number.isFinite(draft.pricedQuantity) || draft.pricedQuantity <= 0)) return;
        const updated: ResourceDraft = { ...draft, basis };
        resourceContinuationRef.current = null;
        setResourceContinuation(null);
        resourceDraftRef.current = updated;
        setResourceDraft(updated);
    };

    const saveResourceDraft = (token: number, reviewedDraft: ResourceDraft, addAnother = false) => {
        const draft = currentResourceDraft();
        if (!libraryActiveRef.current || !draft || draft !== reviewedDraft || draft.token !== token || latestLibrary.current.context !== draft.context || latestLibrary.current.blocked || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false) return;
        const values = resourceDraftValues(draft);
        if (!values) return;
        saveResources(async () => {
            const result = await addComponentAction(line.id, {
                ...values,
                sort_order: componentsRef.current.length,
            });
            if (!result?.id || result.estimate_line_id !== line.id || !libraryActiveRef.current || latestLibrary.current.context !== draft.context) throw new Error("Resource addition not confirmed for this draft");
            if (draft.basis === "per-unit" && (result.quantity !== values.quantity || result.component_type !== values.component_type || result.unit !== values.unit)) throw new Error("Per-unit resource quantity not confirmed");
            if (addAnother && (result.component_type !== draft.type || componentsRef.current.some(row => row.id === result.id) || canApplyRate?.() === false)) throw new Error("Resource continuation not confirmed");
            setDescInputs(prev => ({ ...prev, [result.id]: result.description }));
            setLabourTradeFilter(prev => ({ ...prev, [result.id]: '' }));
            setMaterialCategoryFilter(prev => ({ ...prev, [result.id]: '' }));
            const updated = [...componentsRef.current, result];
            publishComponents(updated);
            if (addAnother) {
                // Only our exact acknowledged row array may open the next blank draft.
                const next: ResourceDraft = {
                    token: ++draftSequence.current,
                    context: JSON.stringify({ orgId, id: line.id, estimate: line.estimate_id, quantity: line.quantity, unit: line.unit, components: updated, savedComponents: updated }),
                    type: draft.type, description: "", quantity: "", unit: "", rate: "", hours: "",
                    basis: "total", pricedQuantity: line.quantity, pricedUnit: line.unit,
                };
                resourceContinuationRef.current = next;
                setResourceContinuation(next);
            } else {
                resourceContinuationRef.current = null;
                setResourceContinuation(null);
                resourceDraftRef.current = null;
                setResourceDraft(null);
                onDraftChanged?.(line.id, false);
            }
        });
    };

    const editResourceNumber = (id: string, value: string, field: ResourceNumberField | "description" = "unit_rate") => {
        if (!libraryActiveRef.current || resourceDraftRef.current || latestLibrary.current.blocked || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false) return;
        if (field === "description" && (libraryContext !== latestLibrary.current.context || !componentsRef.current.some(row => row.id === id && isFreeformResource(row.component_type)))) return;
        if (numberDraftRef.current && (numberDraftRef.current.id !== id || numberDraftRef.current.field !== field)) return;
        if (!componentsRef.current.some(component => component.id === id)) return;
        const draft = numberDraftRef.current ? { ...numberDraftRef.current, value } : { id, field, value, context: latestLibrary.current.context, token: ++draftSequence.current };
        const opening = !numberDraftRef.current;
        numberDraftRef.current = draft;
        setNumberDraft(draft);
        reviewedBasisRef.current = null;
        setReviewedBasis(null);
        if (opening) onDraftChanged?.(line.id, true);
    };

    const closeNumberDraft = () => {
        numberDraftRef.current = null;
        setNumberDraft(null);
        onDraftChanged?.(line.id, false);
    };

    const saveResourceNumber = (token: number) => {
        const draft = numberDraftRef.current;
        if (!libraryActiveRef.current || !draft || draft.token !== token || draft.context !== latestLibrary.current.context || latestLibrary.current.blocked || resourceDraftRef.current || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false) return;
        if (draft.field === "description") return;
        const value = resourceNumberValue(draft.value);
        const component = componentsRef.current.find(row => row.id === draft.id);
        if (value === null || !component || !validResourceNumber(component, draft.field, value)) return;
        if (value === component[draft.field]) { closeNumberDraft(); return; }
        saveResources(async () => {
            const saved = await updateComponentAction(draft.id, { [draft.field]: value });
            if (!saved || saved.id !== draft.id || saved.estimate_line_id !== line.id || !libraryActiveRef.current || latestLibrary.current.context !== draft.context) throw new Error("Resource number save not confirmed for this draft");
            publishComponents(componentsRef.current.map(row => row.id === saved.id ? saved : row));
            closeNumberDraft();
        });
    };

    const saveResourceName = (token: number) => {
        const draft = numberDraftRef.current;
        if (!libraryActiveRef.current || !draft || draft.field !== "description" || draft.token !== token || draft.context !== latestLibrary.current.context || latestLibrary.current.blocked || resourceDraftRef.current || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false) return;
        const component = componentsRef.current.find(row => row.id === draft.id && isFreeformResource(row.component_type));
        if (!component) return;
        if (draft.value === component.description) { closeNumberDraft(); return; }
        saveResources(async () => {
            const saved = await updateComponentAction(draft.id, { description: draft.value });
            if (!saved || saved.id !== draft.id || saved.estimate_line_id !== line.id || saved.component_type !== component.component_type || saved.description !== draft.value || !libraryActiveRef.current || latestLibrary.current.context !== draft.context) throw new Error("Resource name save not confirmed for this draft");
            publishComponents(componentsRef.current.map(row => row.id === saved.id ? saved : row));
            closeNumberDraft();
        });
    };

    const numberDraftControls = (component: EstimateLineComponent, field: ResourceNumberField) => {
        if (!numberDraft || numberDraft.id !== component.id || numberDraft.field !== field) return null;
        const label = RESOURCE_NUMBER_LABELS[field];
        return <div className={ui.resourceRateDraft}>
            <p>{field === "unit_rate" ? "Rate not saved. Resource totals still use the saved rate." : `Resource ${label} not saved. Totals and labour hours still use the saved values.`}</p>
            {numberDraftValue === null && <p role="alert">Enter finite resource {label}; blank or incomplete text is not zero.</p>}
            {!numberDraftCurrent && <p role="alert">The line or resources changed. Your text is retained; check the saved values before starting again.</p>}
            <button type="button" aria-label={`Save resource ${label}: ${component.description || component.component_type}`} disabled={!numberDraftCurrent || numberDraftValue === null || !validResourceNumber(component, field, numberDraftValue ?? 0) || reviewBlocked} onClick={() => saveResourceNumber(numberDraft.token)}>Save {label}</button>
            <button type="button" aria-label={`Cancel resource ${label}: ${component.description || component.component_type}`} disabled={resourceStatus === "saving"} onClick={() => {
                if (!libraryActiveRef.current || resourcePendingRef.current > 0 || numberDraftRef.current?.token !== numberDraft.token) return;
                closeNumberDraft();
            }}>Cancel {label}</button>
        </div>;
    };

    const handleUpdate = (compId: string, updates: Partial<EstimateLineComponent>) => {
        if (numberDraftRef.current || resourceDraftRef.current || librarySavingRef.current || saveBlocked || priceSavePending || resourceUncertainRef.current) return;
        const previous = componentsRef.current;
        if (!previous.some(component => component.id === compId)) return;
        const version = (resourceVersionsRef.current[compId] || 0) + 1;
        resourceVersionsRef.current[compId] = version;
        if (updates.description !== undefined) {
            setDescInputs(prev => ({ ...prev, [compId]: updates.description! }));
        }
        const updated = previous.map((c) => {
            if (c.id !== compId) return c;
            const merged = { ...c, ...updates };
            merged.line_total = merged.quantity * merged.unit_rate;
            merged.total_manhours = merged.quantity * merged.manhours_per_unit;
            return merged;
        });
        publishComponents(updated);
        saveResources(async () => {
            const saved = await updateComponentAction(compId, updates);
            if (resourceVersionsRef.current[compId] === version) {
                publishComponents(componentsRef.current.map(component => component.id === compId ? saved : component));
            }
        });
    };

    const handleDelete = (compId: string) => {
        if (numberDraftRef.current || resourceDraftRef.current || librarySavingRef.current || saveBlocked || priceSavePending || resourceUncertainRef.current) return;
        const previous = componentsRef.current;
        if (!previous.some(component => component.id === compId)) return;
        resourceVersionsRef.current[compId] = (resourceVersionsRef.current[compId] || 0) + 1;
        const updated = components.filter((c) => c.id !== compId);
        publishComponents(updated);
        saveResources(async () => { await deleteComponentAction(compId); });
    };

    const handleApplyRate = () => {
        if (numberDraftRef.current || resourceDraftRef.current || librarySavingRef.current || applyingRef.current || isPending || hasQuantityErrors || saveBlocked || priceSavePending || resourceUncertainRef.current || resourcePendingRef.current > 0) return;
        if (reviewedBasisRef.current !== basisSnapshot) return;
        if (canApplyRate && !canApplyRate()) return;
        applyingRef.current = true;
        onApplyPendingChanged?.(line.id, true);
        setApplyStatus("applying");
        startTransition(async () => {
            try {
                const saved = await updateLineBuiltUpRateAction(line.id, ratePerUnit, line.quantity);
                onRateApplied(line.id, saved.unitRate, saved.quantity, saved.lineTotal);
                setAppliedSnapshot(resourceSnapshot);
                setApplyStatus("applied");
            } catch {
                // The line update can commit before aggregate recalculation fails.
                setApplyStatus("error");
            } finally {
                applyingRef.current = false;
                onApplyPendingChanged?.(line.id, false);
            }
        });
    };

    const handleSaveToLibrary = () => {
        if (numberDraftRef.current || resourceDraftRef.current || librarySavingRef.current || libraryUncertainRef.current || librarySaveState || applyingRef.current || isPending || hasQuantityErrors || saveBlocked || priceSavePending || resourceUncertainRef.current || resourcePendingRef.current > 0) return;
        const name = window.prompt("Name for this rate build-up:", line.description || "Built-up rate")?.trim();
        if (!name) return;
        const submitted = componentsRef.current.map(c => ({
            type: c.component_type, description: c.description, quantity: c.quantity,
            unit: c.unit, unit_rate: c.unit_rate, manhours_per_unit: c.manhours_per_unit,
        }));
        const submittedRate = line.quantity > 0 ? submitted.reduce((sum, c) => sum + c.quantity * c.unit_rate, 0) / line.quantity : 0;
        const totalMph = submitted
            .filter((c) => c.type === "labour")
            .reduce((s, c) => s + c.manhours_per_unit, 0);
        const snapshot = JSON.stringify({ unit: line.unit, trade_section: line.trade_section, quantity: line.quantity, components: componentsRef.current });
        librarySavingRef.current = true;
        setLibraryStatus("saving");
        onLibrarySaveStateChanged?.(line.id, "saving");
        startTransition(async () => {
            try {
                const saved = await saveRateBuildupAction(orgId, name, line.unit, line.trade_section, submitted, submittedRate, totalMph);
                if (!saved?.id || saved.name !== name) throw new Error("Library copy not confirmed");
                setLibraryCopy({ name: saved.name, snapshot });
                setLibraryStatus("confirmed");
                onLibrarySaveStateChanged?.(line.id, "confirmed");
            } catch {
                libraryUncertainRef.current = true;
                setLibraryStatus("uncertain");
                onLibrarySaveStateChanged?.(line.id, "uncertain");
            } finally {
                librarySavingRef.current = false;
            }
        });
    };

    const handleLoadLibrary = (buildupId: string) => {
        if (numberDraftRef.current || resourceDraftRef.current || !libraryActiveRef.current || latestLibrary.current.blocked || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false) return;
        const rb = latestLibrary.current.sources.find((r) => r.id === buildupId);
        if (!rb) return;
        const review = { id: rb.id, source: JSON.stringify(rb), context: latestLibrary.current.context };
        libraryReviewRef.current = review;
        setLibraryReview(review);
    };

    const handleAddReviewedResource = (index: number) => {
        const review = libraryReviewRef.current;
        const fresh = latestLibrary.current;
        if (numberDraftRef.current || resourceDraftRef.current || !libraryActiveRef.current || !review || review !== libraryReview || fresh.blocked || librarySavingRef.current || applyingRef.current || resourceUncertainRef.current || resourcePendingRef.current > 0 || canApplyRate?.() === false) return;
        const rb = fresh.sources.find(source => source.id === review.id);
        if (fresh.context !== review.context || !rb || JSON.stringify(rb) !== review.source) return;
        const comp = rb.components[index];
        if (!comp || ![comp.quantity, comp.unit_rate, comp.manhours_per_unit].every(Number.isFinite)) return;
        // Consume this review before starting the single insert; never replay a lost acknowledgement.
        libraryReviewRef.current = null;
        saveResources(async () => {
            const result = await addComponentAction(line.id, {
                component_type: comp.type,
                description: comp.description,
                quantity: comp.quantity,
                unit: comp.unit,
                unit_rate: comp.unit_rate,
                manhours_per_unit: comp.manhours_per_unit,
                sort_order: componentsRef.current.length,
            });
            if (!result || result.estimate_line_id !== line.id || !result.id) throw new Error("Library resource addition not confirmed");
            if (!libraryActiveRef.current || latestLibrary.current.context !== review.context) throw new Error("Library resource context changed before confirmation");
            publishComponents([...componentsRef.current, result]);
        });
    };

    return (
        <div className={ui.resourcePanel}>
            {resourcesBlocked ? (
                <p className={ui.resourceNote} role="alert"><strong>Resource save not confirmed.</strong> Some changes may already have saved. Local edits are retained here, but Apply is blocked. Reload the estimate to reconcile saved resources.</p>
            ) : priceSavePending ? (
                <p className={ui.resourceNote} role="status">Saving the priced quantity or line details. Resource editing and Apply are paused until the line save is confirmed. Resource totals are not rescaled.</p>
            ) : resourceStatus === "saving" ? (
                <p className={ui.resourceNote} role="status">Saving resources. Apply will be available when every resource save is confirmed.</p>
            ) : resourceStatus === "confirmed" ? (
                <p className={ui.resourceNote} role="status">Resource saves confirmed. The line price changes only when you Apply rate.</p>
            ) : null}
            {libraryPending && <p className={ui.resourceNote} role="status">Saving build-up copy to rate library. Resource editing is paused until the request finishes.</p>}
            {libraryUncertain && <p className={ui.resourceNote} role="alert"><strong>Library save not confirmed.</strong> The copy may already have saved. Reload and check the rate library before saving another copy. This does not change the line price.</p>}
            {libraryStatus === "confirmed" && libraryCopy && <p className={ui.resourceNote} role="status">Build-up copy saved to rate library: <strong>{libraryCopy.name}</strong>. This does not apply a line rate.{libraryCopy.snapshot !== librarySnapshot && " Resources or priced quantity have changed since that copy; newer changes are not saved to the library."}</p>}
            <fieldset disabled={resourcesBlocked || priceSavePending || libraryPending} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} aria-label="Resource build-up controls">
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
            {(resourceDraft?.type === "consultancy" || components.some(component => component.component_type === "consultancy") || (libraryReviewCurrent && reviewedLibrarySource?.components.some(component => component.type === "consultancy"))) &&
                <p className={ui.resourceNote} data-consultancy-note>Consultancy is costed separately from labour and is not counted in labour-only totals. Existing planner suggestions can use stored resource hours; review those suggestions separately. Saving a resource does not create or change a programme.</p>}
            <div className={ui.resourceBasis} role="group" aria-label="Resource quantity entry basis">
                <span>Enter quantities:</span>
                <button type="button" aria-pressed={!showPerUnit} disabled={!!numberDraft} onClick={() => { if (!numberDraftRef.current) setPerUnitEntry(false); }}>Total for this line</button>
                <button type="button" aria-label="Enter resource quantities per priced unit" aria-pressed={showPerUnit}
                    disabled={!canEnterPerUnit || !!numberDraft} onClick={() => { if (!numberDraftRef.current) setPerUnitEntry(true); }}>Per 1 {line.unit}</button>
            </div>
            <p className={ui.resourceNote}>
                Quantities are stored as totals for this line; recheck the build-up if the priced quantity changes.
                Per-unit edits save on leaving the quantity cell. Changing this view does not save or apply a rate.
                {!canEnterPerUnit && " A positive finite priced quantity is needed for per-unit entry."}
            </p>

            {/* Load from library */}
            {rateBuildups.length > 0 && (
                <details className={`${ui.resourceNote} ${ui.resourceLibrary}`}>
                    <summary>Review a rate-library resource</summary>
                    <p>Choose a saved build-up, then add one resource at a time. Stored quantities are totals from the original line, not a per-unit recipe. Nothing is rescaled for this line ({line.quantity} {line.unit}). Adding a resource does not apply a line rate.</p>
                    <select
                        aria-label="Build-up to review"
                        disabled={reviewBlocked || !!resourceDraft || !!numberDraft}
                        value={libraryReview?.id || ""}
                        onChange={(e) => {
                            if (e.target.value) handleLoadLibrary(e.target.value);
                        }}
                    >
                        <option value="">Choose a build-up to review...</option>
                        {rateBuildups.map((rb) => (
                            <option key={rb.id} value={rb.id}>
                                {rb.name} ({rb.unit})
                            </option>
                        ))}
                    </select>
                    {libraryReview && !libraryReviewCurrent && <p role="status">The line or library changed. Choose the build-up again to review its current resources.</p>}
                    {libraryReviewCurrent && reviewedLibrarySource && <div data-library-resource-review>
                        <p><strong>{reviewedLibrarySource.name}</strong> · Original priced unit: {reviewedLibrarySource.unit}. Review each stored resource for this job before adding it.</p>
                        <ol>
                            {reviewedLibrarySource.components.map((comp, index) => <li key={index}>
                                <strong>{comp.description || "Unnamed resource"}</strong> ({comp.type})
                                <p>Total quantity: {Number.isFinite(comp.quantity) ? comp.quantity : "Unavailable"} {comp.unit}. Resource rate: {Number.isFinite(comp.unit_rate) ? comp.unit_rate : "Unavailable"} per {comp.unit}. Hours per resource unit: {Number.isFinite(comp.manhours_per_unit) ? comp.manhours_per_unit : "Unavailable"}.</p>
                                <button type="button" aria-label={`Add reviewed resource ${index + 1}: ${comp.description || "Unnamed resource"}`}
                                    disabled={reviewBlocked || !!resourceDraft || !!numberDraft || ![comp.quantity, comp.unit_rate, comp.manhours_per_unit].every(Number.isFinite)}
                                    onClick={() => handleAddReviewedResource(index)}>Add this resource</button>
                            </li>)}
                        </ol>
                        {reviewedLibrarySource.components.length === 0 && <p>No saved resource rows in this build-up.</p>}
                    </div>}
                    {libraryReview && <button type="button" disabled={resourceStatus === "saving"}
                        onClick={() => {
                            if (resourcePendingRef.current > 0) return;
                            libraryReviewRef.current = null;
                            setLibraryReview(null);
                        }}>Cancel library review</button>}
                </details>
            )}

            {/* Component rows */}
            {components.length === 0 && <p className={ui.resourceNote}>No resource rows yet. Current line rate: {formatGBP(line.unit_rate)} per {line.unit}. Add only the resources you need.</p>}
            {components.length > 0 && <fieldset disabled={!!resourceDraft} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-label="Saved resources">
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
                            <fieldset disabled={!!numberDraft && (numberDraft.id !== comp.id || numberDraft.field !== "description")} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
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
                                            className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
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
                                            className="w-32 border border-gray-200 rounded px-1 py-0.5 bg-white text-xs text-gray-900"
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
                            ) : isFreeformResource(comp.component_type) ? (
                                <div className="flex-1 flex flex-col gap-1">
                                    <input
                                        aria-label={`${comp.component_type === "subcontract" ? "Subcontract" : "Resource"} description: ${comp.description || comp.component_type}`}
                                        className="flex-1 border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900 text-xs"
                                        value={numberDraft?.id === comp.id && numberDraft.field === "description" ? numberDraft.value : comp.description}
                                        disabled={reviewBlocked}
                                        onChange={e => editResourceNumber(comp.id, e.target.value, "description")}
                                        placeholder={comp.component_type === "subcontract" ? "Subcontractor name or description (e.g. Specialist groundworks package)..." : "Resource name or description..."}
                                    />
                                    {comp.component_type === "subcontract" && <span className="text-xs text-gray-400">Enter the subcontract value as the rate below</span>}
                                    {numberDraft?.id === comp.id && numberDraft.field === "description" && <div className={ui.resourceRateDraft} data-subcontract-name-draft={comp.component_type === "subcontract" ? true : undefined} data-resource-name-draft>
                                        <p>{comp.component_type === "subcontract" ? "Subcontract" : comp.component_type === "consultancy" ? "Consultancy" : "Temporary works"} name not saved. The saved resource keeps its confirmed name until acknowledgement. Existing library copies are unchanged. This does not apply a line rate.</p>
                                        {!numberDraftCurrent && <p role="alert">The line or resources changed. Your text is retained; check the saved values before starting again.</p>}
                                        <button type="button" aria-label={`Save ${resourceNameLabel(comp.component_type)} name: ${comp.description || comp.component_type}`} disabled={!numberDraftCurrent || reviewBlocked} onClick={() => saveResourceName(numberDraft.token)}>Save name</button>
                                        <button type="button" aria-label={`Cancel ${resourceNameLabel(comp.component_type)} name: ${comp.description || comp.component_type}`} disabled={resourceStatus === "saving" || resourcesBlocked} onClick={() => {
                                            if (!libraryActiveRef.current || resourcePendingRef.current > 0 || resourceUncertainRef.current || numberDraftRef.current?.token !== numberDraft.token) return;
                                            closeNumberDraft();
                                        }}>Cancel name</button>
                                    </div>}
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

                            </fieldset>
                            </td>
                            <td>
                            {showPerUnit ? (
                                <input
                                    key={`per-unit-${comp.id}-${line.quantity}-${comp.quantity}`}
                                    type="number" step="any"
                                    disabled={!!numberDraft}
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
                                    disabled={!!numberDraft && (numberDraft.id !== comp.id || numberDraft.field !== "quantity") || reviewBlocked}
                                    className="w-14 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                    value={numberDraft?.id === comp.id && numberDraft.field === "quantity" ? numberDraft.value : comp.quantity}
                                    aria-invalid={numberDraft?.id === comp.id && numberDraft.field === "quantity" && numberDraftValue === null}
                                    onChange={(e) => editResourceNumber(comp.id, e.target.value, "quantity")}
                                />
                            )}
                            {!showPerUnit && numberDraftControls(comp, "quantity")}
                            {showPerUnit && quantityErrors[comp.id] && <p role="alert" id={`quantity-error-${comp.id}`}>{quantityErrors[comp.id]}</p>}
                            </td>
                            <td>
                            {/* Unit */}
                            <select
                                aria-label={`Resource unit: ${comp.description || comp.component_type}`}
                                disabled={!!numberDraft}
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
                            {/* A raw rate draft never changes the saved row until explicit confirmation. */}
                            <input
                                type="number"
                                className="w-20 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                aria-label={`Resource rate: ${comp.description || comp.component_type}`}
                                value={numberDraft?.id === comp.id && numberDraft.field === "unit_rate" ? numberDraft.value : comp.unit_rate}
                                disabled={!!numberDraft && (numberDraft.id !== comp.id || numberDraft.field !== "unit_rate") || reviewBlocked}
                                aria-invalid={numberDraft?.id === comp.id && numberDraft.field === "unit_rate" && numberDraftValue === null}
                                onChange={(e) => editResourceNumber(comp.id, e.target.value)}
                            />
                            {numberDraftControls(comp, "unit_rate")}

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
                                        className="w-16 text-right text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-900"
                                        value={numberDraft?.id === comp.id && numberDraft.field === "manhours_per_unit" ? numberDraft.value : comp.manhours_per_unit}
                                        disabled={!!numberDraft && (numberDraft.id !== comp.id || numberDraft.field !== "manhours_per_unit") || reviewBlocked}
                                        aria-invalid={numberDraft?.id === comp.id && numberDraft.field === "manhours_per_unit" && numberDraftValue === null}
                                        onChange={(e) => editResourceNumber(comp.id, e.target.value, "manhours_per_unit")}
                                    />
                                    {numberDraftControls(comp, "manhours_per_unit")}
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
                                disabled={!!numberDraft}
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
            </fieldset>}

            {/* Add buttons — these use LOCAL state, not parent's isPending */}
            <div className="flex items-center gap-1 px-3 py-2 flex-wrap">
                <span className="text-xs text-gray-500 mr-1">Add:</span>
                {COMPONENT_TYPES.map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => handleAdd(type)}
                        disabled={reviewBlocked || !!resourceDraft || !!numberDraft}
                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 capitalize transition-colors disabled:opacity-50"
                    >
                        + {type.replace("_", " ")}
                    </button>
                ))}
            </div>

            {shownResourceDraft && <section className={ui.resourceDraft} aria-label="Unsaved resource draft">
                <h5>New {shownResourceDraft.type.replace("_", " ")} resource <span>{resourceContinuation && !continuationFresh ? "Saved input retained; continuation not ready" : "Not saved"}</span></h5>
                <p>Choose total quantity for this line or quantity per priced unit ({shownResourceDraft.pricedQuantity} {shownResourceDraft.pricedUnit}). Changing basis keeps your typed number; review the total before Save. No rate or hours have been assumed. Enter 0 explicitly where appropriate. Save resource adds this row only; Apply rate remains separate.</p>
                {resourceContinuation && !continuationFresh && <p role="status">The resource was confirmed. Its inputs are retained until this estimate supplies the exact confirmed resources and the parent save gates are clear. Another draft will not open on a changed source.</p>}
                {!draftCurrent && <p role="alert">The line changed. Your draft is retained, but cannot be saved against a different basis. Check the line before cancelling and starting a new draft.</p>}
                <fieldset disabled={reviewBlocked || !draftCurrent} aria-label="New resource values">
                    <label>Quantity basis<select aria-label="New resource quantity basis" value={shownResourceDraft.basis} onChange={e => changeResourceBasis(shownResourceDraft.token, e.target.value)}><option value="total">Total for this line</option><option value="per-unit" disabled={!Number.isFinite(shownResourceDraft.pricedQuantity) || shownResourceDraft.pricedQuantity <= 0}>Per 1 {shownResourceDraft.pricedUnit}</option></select></label>
                    <label>Resource name<input aria-label="New resource name" value={shownResourceDraft.description} onChange={e => editResourceDraft(shownResourceDraft.token, "description", e.target.value)} /></label>
                    <label>{shownResourceDraft.basis === "per-unit" ? `Quantity per 1 ${shownResourceDraft.pricedUnit}` : "Total quantity"}<input aria-label={shownResourceDraft.basis === "per-unit" ? "New resource per-unit quantity" : "New resource total quantity"} type="number" min="0" step="any" value={shownResourceDraft.quantity} onChange={e => editResourceDraft(shownResourceDraft.token, "quantity", e.target.value)} /></label>
                    <label>Resource unit<select aria-label="New resource unit" value={shownResourceDraft.unit} onChange={e => editResourceDraft(shownResourceDraft.token, "unit", e.target.value)}><option value="">Choose a unit</option>{COMP_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                    <label>Resource rate<input aria-label="New resource rate" type="number" min="0" step="any" value={shownResourceDraft.rate} onChange={e => editResourceDraft(shownResourceDraft.token, "rate", e.target.value)} /></label>
                    <label>Hours per resource unit<input aria-label="New resource hours" type="number" min="0" step="any" value={shownResourceDraft.hours} onChange={e => editResourceDraft(shownResourceDraft.token, "hours", e.target.value)} /></label>
                </fieldset>
                {shownResourceDraft.basis === "per-unit" && <p>Entered quantity: {shownResourceDraft.quantity || "Not entered"} {shownResourceDraft.unit} per 1 {shownResourceDraft.pricedUnit}. Total for {shownResourceDraft.pricedQuantity} {shownResourceDraft.pricedUnit}: {draftQuantity === null ? "Unavailable" : `${draftQuantity} ${shownResourceDraft.unit}`}. Only this total is saved; no per-unit recipe or automatic future rescaling is retained.</p>}
                {shownResourceDraft.basis === "per-unit" && shownResourceDraft.quantity.trim() && draftQuantity === null && <p role="alert">This per-unit total cannot be stored unchanged in the existing quantity range and four-decimal precision. No rounding is applied. Review the quantity or use total entry.</p>}
                <p>{draftValues ? `Draft resource total: ${formatGBP(draftValues.quantity * draftValues.unit_rate)}` : "Name the resource, choose its unit and enter finite non-negative quantity, rate and hours (including any zeros) before saving."}</p>
                <button type="button" aria-label="Save new resource" disabled={!draftCurrent || !draftValues || reviewBlocked} onClick={() => saveResourceDraft(shownResourceDraft.token, shownResourceDraft)}>Save resource</button>
                <button type="button" aria-label="Save resource and add another" disabled={!draftCurrent || !draftValues || reviewBlocked} onClick={() => saveResourceDraft(shownResourceDraft.token, shownResourceDraft, true)}>Save resource and add another {resourceNameLabel(shownResourceDraft.type)}</button>
                <button type="button" aria-label="Cancel new resource" disabled={!!resourceContinuation && !continuationFresh || resourceStatus === "saving" || shownResourceDraft.basis === "per-unit" && resourceStatus === "uncertain"} onClick={() => {
                    const current = currentResourceDraft();
                    if (!libraryActiveRef.current || !current || resourcePendingRef.current > 0 || current.token !== shownResourceDraft.token || current.basis === "per-unit" && resourceUncertainRef.current) return;
                    resourceContinuationRef.current = null;
                    setResourceContinuation(null);
                    resourceDraftRef.current = null;
                    setResourceDraft(null);
                    onDraftChanged?.(line.id, false);
                }}>Cancel resource</button>
            </section>}

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
            {components.length > 0 && (
                <div className={ui.resourceNote}>
                    <p><strong>Review total resources before Apply.</strong> Check that these total resource quantities cover {line.quantity} {line.unit} of priced work. Changing the priced quantity never rescales the resources automatically.</p>
                    <label>
                        <input type="checkbox" aria-label="Confirm total resources for this priced quantity"
                            checked={basisReviewed} disabled={reviewBlocked || !!resourceDraft || !!numberDraft}
                            onChange={event => {
                                if (numberDraftRef.current || resourceDraftRef.current || librarySavingRef.current || applyingRef.current || isPending || hasQuantityErrors || saveBlocked || priceSavePending || resourceUncertainRef.current || resourcePendingRef.current > 0) return;
                                const reviewed = event.target.checked ? basisSnapshot : null;
                                reviewedBasisRef.current = reviewed;
                                setReviewedBasis(reviewed);
                            }} />{" "}
                        I have checked the total resources for {line.quantity} {line.unit}.
                    </label>
                    <p>{basisReviewed ? "Reviewed for these displayed values. Apply rate is still a separate save." : "Review is needed before Apply. This check is not stored. Review again whenever the displayed quantity, unit or resources differ from the values you checked, and whenever this panel reopens."}</p>
                </div>
            )}
            {/* Footer */}
            {components.length > 0 && (
                <div className={ui.resourceFooter}>
                    <button
                        type="button"
                        onClick={handleSaveToLibrary}
                        aria-label="Save build-up copy to rate library"
                        aria-busy={libraryPending}
                        disabled={!!numberDraft || !!resourceDraft || isPending || libraryPending || libraryUncertain || applyStatus === "applying" || hasQuantityErrors || resourceStatus === "saving" || resourcesBlocked || priceSavePending}
                        className="text-xs text-emerald-700 hover:text-emerald-800 underline"
                    >
                        Save to rate library
                    </button>
                    <button
                        type="button"
                        onClick={handleApplyRate}
                        aria-label="Apply resource rate"
                        aria-busy={applyStatus === "applying"}
                        disabled={!!numberDraft || !!resourceDraft || !basisReviewed || isPending || applyStatus === "applying" || hasQuantityErrors || resourceStatus === "saving" || resourcesBlocked || priceSavePending}
                        className="bg-[#c9efcf] text-[#182c1b] text-xs px-3 py-1.5 rounded hover:bg-[#e0f9e3] font-medium"
                    >
                        {applyStatus === "applying" ? "Applying rate..." : `${applyStatus === "error" ? "Retry Apply rate" : "Apply rate"} (${formatGBP(ratePerUnit)}/unit)`} →
                    </button>
                </div>
            )}
            </fieldset>
        </div>
    );
}
