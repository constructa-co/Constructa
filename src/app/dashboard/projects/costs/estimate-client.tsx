"use client";
// v3 - extracted BuildUpPanel as standalone client component

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
import { Plus, Trash2, Check, Star, Loader2, CalendarDays, ClipboardList, FileDown } from "lucide-react";
import Link from "next/link";
import BuildUpPanel from "./build-up-panel";
import VisionTakeoff from "@/app/dashboard/foundations/vision-takeoff";
import BoQImport from "./boq-import";
import { exportBoQToExcel } from "./boq-excel-export";
import { isCapabilityEnabled } from "@/lib/launch-profile";
import type { EstimateLineComponent, EstimateLine, Estimate, CostLibraryItem, LabourRate, RateBuildup } from "./types";

interface Props {
    estimates: Estimate[];
    costLibrary: CostLibraryItem[];
    projectId: string;
    orgId: string;
    rateBuildups: RateBuildup[];
    labourRates: LabourRate[];
    preferredTrades: string[];
    defaultTabId?: string;
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

function formatGBP(n: number): string {
    return "\u00A3" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Main Component ──────────────────────────────────────

export default function EstimateClient({ estimates: initialEstimates, costLibrary, projectId, orgId, rateBuildups, labourRates, preferredTrades, defaultTabId }: Props) {
    const router = useRouter();
    const showClientBoQImport = isCapabilityEnabled("client-boq-import");
    const showDrawingTakeoff = isCapabilityEnabled("drawing-takeoff");
    const [estimates, setEstimates] = useState<Estimate[]>(() => initialEstimates);

    // Project-scoped sessionStorage key so tab selection survives navigation within the same project
    const TAB_KEY = `constructa_tab_${projectId}`;

    // Ref to hold newly-imported estimate ID across the close handler — avoids stale closure issues
    const importedEstimateIdRef = useRef<string | null>(null);

    // Tab selection priority: URL param (defaultTabId) > sessionStorage > first estimate
    const [activeTab, setActiveTabState] = useState<string>(() => {
        if (defaultTabId && initialEstimates.some((e) => e.id === defaultTabId)) {
            if (typeof window !== "undefined") sessionStorage.setItem(TAB_KEY, defaultTabId);
            return defaultTabId;
        }
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem(TAB_KEY);
            if (saved && initialEstimates.some((e) => e.id === saved)) return saved;
        }
        return initialEstimates[0]?.id || "";
    });

    // Wrapper that keeps sessionStorage in sync whenever the tab changes
    const setActiveTab = (id: string) => {
        setActiveTabState(id);
        if (typeof window !== "undefined") sessionStorage.setItem(TAB_KEY, id);
    };

    const [, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [openBuildUpPanels, setOpenBuildUpPanels] = useState<Set<string>>(new Set());
    const [showBoQImport, setShowBoQImport] = useState(false);
    const [mobileSection, setMobileSection] = useState("");

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
                    prelims_pct: result.prelims_pct ?? 10,
                    discount_pct: result.discount_pct ?? 0,
                    discount_reason: result.discount_reason ?? "",
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
        showSaving();
        updateEstimateMarginsAction(currentEstimate.id, updated.overhead_pct, updated.profit_pct, updated.risk_pct, updated.prelims_pct)
            .then((result) => {
                if (result && !result.success) {
                    toast.error(result.error ?? "Failed to save margins");
                    // P1-3 — roll the optimistic update back if the server
                    // rejected the change (most likely the project is locked).
                    setEstimates((prev) => prev.map((e) => (e.id === currentEstimate.id ? currentEstimate : e)));
                }
                showSaved();
            })
            .catch((err) => {
                console.error(err);
                toast.error("Failed to save margins");
                showSaved();
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
            .catch(console.error);
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
                toast.error(result.error);
                showSaved();
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
            toast.error(err instanceof Error ? err.message : "Failed to add line");
        }
    };

    // ─── BoQ Import handler ──────────────────────────────
    const handleBoQImported = (estimateId: string) => {
        // Store the new estimate ID in a ref — the modal hasn't closed yet so we can't navigate yet
        importedEstimateIdRef.current = estimateId;
    };

    const handleBoQClose = () => {
        setShowBoQImport(false);
        if (importedEstimateIdRef.current) {
            const id = importedEstimateIdRef.current;
            importedEstimateIdRef.current = null;
            // Use a full navigation (not router.push) so the client component fully remounts,
            // the server re-fetches the new estimate, and the useState initializer picks up defaultTabId.
            // sessionStorage is also updated by the initializer so subsequent soft-navigations work too.
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
                toast.error(result.error);
                showSaved();
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
            toast.error(err instanceof Error ? err.message : "Failed to add line");
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
                    toast.error(result.error ?? "Failed to update line");
                    router.refresh(); // re-pull authoritative state after a rejected update
                }
                showSaved();
            })
            .catch((err) => {
                console.error(err);
                toast.error("Failed to update line");
                showSaved();
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
                    toast.error(result.error ?? "Failed to delete line");
                    // Roll the optimistic delete back
                    setEstimates((prev) => prev.map((e) => (e.id === prevEstimate.id ? prevEstimate : e)));
                }
                showSaved();
            })
            .catch((err) => {
                console.error(err);
                toast.error("Failed to delete line");
                showSaved();
            });
    };

    const handleLibrarySelect = (lineId: string, itemId: string) => {
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

    // ─── CORRECT QS COST HIERARCHY ──────────────────────
    const lines = currentEstimate?.estimate_lines || [];
    // Filter out blank lines for display
    const displayLines = lines.filter(l => l.description && l.description !== "" && l.description !== "\u2014");

    const prelimsPct = currentEstimate?.prelims_pct || 0;
    const overheadPct = currentEstimate?.overhead_pct || 0;
    const profitPct = currentEstimate?.profit_pct || 0;
    const riskPct = currentEstimate?.risk_pct || 0;
    const discountPct = currentEstimate?.discount_pct || 0;

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
    const contractSumPreDiscount = adjustedTotal + profitAmount;

    // Step 7: Discount
    const discountAmount = contractSumPreDiscount * (discountPct / 100);
    const contractSum = contractSumPreDiscount - discountAmount;

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
        <>
        <div className="space-y-6">
            {/* HEADER WITH CTA */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-white">Estimating</h1>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {contractSum > 0 && (
                        <span className="text-sm text-slate-400">Contract Sum: <strong className="text-slate-200">{formatGBP(contractSum)}</strong></span>
                    )}
                    <Link href={`/dashboard/projects/schedule?projectId=${projectId}`}
                        className="hidden min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white sm:flex">
                        <CalendarDays className="w-4 h-4" />
                        View Programme
                    </Link>
                    <Link href={`/dashboard/projects/schedule?projectId=${projectId}`}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
                        <CalendarDays className="w-4 h-4" />
                        Next: Programme →
                    </Link>
                </div>
            </div>

            {/* TABS */}
            <div className="-mx-4 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {estimates.map((est) => (
                    <button
                        type="button"
                        key={est.id}
                        onClick={() => setActiveTab(est.id)}
                        className={`flex min-h-11 flex-none snap-start items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
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
                    className="flex min-h-11 flex-none snap-start items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                    <Plus className="w-4 h-4" /> New Estimate
                </button>
                {showClientBoQImport && (
                    <button
                        type="button"
                        onClick={() => setShowBoQImport(true)}
                        className="flex min-h-11 flex-none snap-start items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                    >
                        <ClipboardList className="w-4 h-4" /> Import Client BoQ
                    </button>
                )}

                {/* Save indicator */}
                <div className="ml-auto flex min-h-11 flex-none items-center gap-1.5 text-xs text-slate-500">
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
                        <div className="flex flex-col gap-3 rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex min-w-0 items-start gap-2.5">
                                <ClipboardList className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <div>
                                    <span className="text-emerald-300 text-sm font-medium">Client BoQ</span>
                                    {currentEstimate.client_boq_filename && (
                                        <span className="ml-2 break-all text-xs text-emerald-600">{currentEstimate.client_boq_filename}</span>
                                    )}
                                    <p className="text-emerald-600/80 text-xs mt-0.5">
                                        {currentEstimate.is_active
                                            ? "Active — programme will be generated from these sections."
                                            : "Not active — set as active so the programme uses these sections."}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                {!currentEstimate.is_active && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetActive(currentEstimate.id)}
                                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
                                    >
                                        <Star className="w-4 h-4" />
                                        Set as Active
                                    </button>
                                )}
                                {showClientBoQImport && (
                                    <button
                                        type="button"
                                        onClick={() => exportBoQToExcel(currentEstimate)}
                                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        Export to Excel
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ESTIMATE HEADER */}
                    <div className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5">
                        <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-3 lg:grid-cols-[minmax(200px,1fr)_repeat(5,6rem)_auto]">
                            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Estimate Name</label>
                                <input
                                    type="text"
                                    defaultValue={currentEstimate.version_name}
                                    onBlur={(e) => handleNameBlur(e.target.value)}
                                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Prelims %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.prelims_pct}
                                    onChange={(e) => handleMarginChange("prelims_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("prelims_pct", parseFloat(e.target.value) || 0)}
                                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-center text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Overhead %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.overhead_pct}
                                    onChange={(e) => handleMarginChange("overhead_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("overhead_pct", parseFloat(e.target.value) || 0)}
                                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-center text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Risk %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.risk_pct}
                                    onChange={(e) => handleMarginChange("risk_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("risk_pct", parseFloat(e.target.value) || 0)}
                                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-center text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Profit %</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.profit_pct}
                                    onChange={(e) => handleMarginChange("profit_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("profit_pct", parseFloat(e.target.value) || 0)}
                                    className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-center text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:h-10"
                                />
                            </div>
                            <div>
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
                                                    toast.error(result.error ?? "Failed to save discount");
                                                    setEstimates(prev => prev.map(est => est.id === currentEstimate.id ? { ...est, discount_pct: prevDiscount } : est));
                                                }
                                                showSaved();
                                            })
                                            .catch((err) => { console.error(err); showSaved(); });
                                    }}
                                    className="h-11 w-full rounded-lg border border-emerald-700/50 bg-emerald-500/10 px-3 text-center text-sm text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 lg:h-10"
                                />
                            </div>
                            <div className="col-span-2 flex gap-2 sm:col-span-1">
                                <button
                                    type="button"
                                    onClick={() => handleSetActive(currentEstimate.id)}
                                    className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors lg:min-h-10 ${
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
                                    aria-label="Delete estimate"
                                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 px-3 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 lg:min-h-10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {currentEstimate.discount_pct > 0 && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
                                                    toast.error(result.error ?? "Failed to save discount");
                                                }
                                                showSaved();
                                            })
                                            .catch((err) => { console.error(err); showSaved(); });
                                    }}
                                    className="h-11 flex-1 rounded-lg border border-emerald-700/50 bg-emerald-500/10 px-3 text-sm text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 lg:h-10"
                                    placeholder="e.g. Returning client, early payment, etc."
                                />
                            </div>
                        )}
                    </div>

                    {/* Vision Takeoff prompt — shown when estimate is empty */}
                    {showDrawingTakeoff && displayLines.length === 0 && (
                        <div className="mb-4 flex flex-col gap-4 rounded-xl border-2 border-dashed border-purple-500/30 bg-purple-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-medium text-slate-200">Got a drawing?</p>
                                <p className="text-sm text-slate-400">Upload a floor plan or sketch and AI extracts quantities automatically.</p>
                            </div>
                            <VisionTakeoff onAddItem={handleAddFromVision} />
                        </div>
                    )}

                    {/* ADD SECTION */}
                    <div className="flex items-end gap-2 sm:hidden">
                        <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Add section
                            <select
                                value={mobileSection}
                                onChange={(event) => setMobileSection(event.target.value)}
                                className="mt-1 h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-normal normal-case tracking-normal text-slate-200"
                            >
                                <option value="">Choose a trade section</option>
                                {TRADE_SECTIONS.map((section) => (
                                    <option key={section} value={section} disabled={!!sectionGroups[section]?.length}>
                                        {sectionGroups[section]?.length ? `${section} (added)` : section}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            disabled={!mobileSection}
                            onClick={() => {
                                if (!mobileSection) return;
                                handleAddLine(mobileSection);
                                setMobileSection("");
                            }}
                            className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Add
                        </button>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex sm:flex-wrap">
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
                        return (
                            <div key={section} className="rounded-xl border border-slate-700/50 bg-slate-800/50" style={{ overflow: "visible" }}>
                                {/* Section header */}
                                <div className="flex items-center justify-between rounded-t-xl border-b border-slate-700/50 bg-slate-900/50 px-4 py-3 sm:px-5">
                                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">{section}</h3>
                                    <span className="font-bold text-sm text-slate-100">{formatGBP(sectionTotal)}</span>
                                </div>

                                {/* Table header */}
                                {currentEstimate.is_client_boq ? (
                                    <div className="hidden grid-cols-[50px_1fr_80px_80px_100px_100px_40px] gap-2 border-b border-slate-700/50 bg-slate-900/30 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
                                        <div>Ref</div>
                                        <div>Description</div>
                                        <div className="text-center">Qty</div>
                                        <div className="text-center">Unit</div>
                                        <div className="text-right">Rate</div>
                                        <div className="text-right">Total</div>
                                        <div></div>
                                    </div>
                                ) : (
                                    <div className="hidden grid-cols-[70px_1fr_80px_80px_100px_100px_40px] gap-2 border-b border-slate-700/50 bg-slate-900/30 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
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
                                        <div className="flex flex-col border-b border-slate-700/30 md:flex-row md:items-stretch md:border-b-0">
                                            {/* Mode toggle button — hidden for client BoQ lines */}
                                            {!currentEstimate.is_client_boq && (
                                                <div className="flex items-center justify-end px-3 pt-3 md:justify-center md:border-b md:border-slate-700/30 md:px-2 md:pt-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTogglePricingMode(line.id, line.pricing_mode)}
                                                        title={line.pricing_mode === "buildup" ? "Switch to simple rate" : "Build up from first principles"}
                                                        className={`min-h-11 min-w-11 flex-shrink-0 rounded border text-xs font-bold transition-colors md:min-h-5 md:min-w-5 ${
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
                                    className="flex min-h-11 w-full items-center gap-1.5 px-5 py-2.5 text-left text-sm text-blue-400 transition-colors hover:bg-blue-500/10"
                                >
                                    <Plus className="w-4 h-4" /> Add line item
                                </button>
                            </div>
                        );
                    })}

                    {/* SUMMARY STRIP */}
                    <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900 p-4 shadow-xl sm:p-5 md:sticky md:bottom-0 md:z-20">
                        <h3 className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-4">Cost Summary</h3>
                        <div className="space-y-2">
                            <SummaryRow label="Direct Construction Cost" value={directCost} />
                            {(prelimsTotal > 0 || prelimsPct > 0) && (
                                <SummaryRow
                                    label={explicitPrelimsLines.length > 0 ? "Preliminaries (line items)" : `Preliminaries (${prelimsPct}%)`}
                                    value={prelimsTotal}
                                />
                            )}
                            <div className="border-t border-slate-700/50 pt-2 mt-2">
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
                            {discountPct > 0 && (
                                <SummaryRow label={`Discount (${discountPct}%)`} value={-discountAmount} />
                            )}
                            <div className="border-t-2 border-slate-600 pt-2 mt-2">
                                <SummaryRow label="CONTRACT SUM (exc. VAT)" value={contractSum} bold />
                            </div>
                            <SummaryRow label="VAT (20%)" value={vat} />
                            <div className="border-t border-slate-700/50 pt-2 mt-2">
                                <SummaryRow label="TOTAL inc. VAT" value={totalIncVat} bold large />
                            </div>
                        </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-8 flex justify-end">
                        <Link href={`/dashboard/projects/schedule?projectId=${projectId}`}
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 sm:w-auto">
                            <CalendarDays className="w-4 h-4" />
                            Next: Programme →
                        </Link>
                    </div>
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
    allLibrary,
    section,
    isClientBoQ,
    onUpdate,
    onDelete,
    onLibrarySelect,
}: {
    line: EstimateLine;
    allLibrary: CostLibraryItem[];
    section: string;
    isClientBoQ?: boolean;
    onUpdate: (id: string, updates: Partial<EstimateLine>) => void;
    onDelete: (id: string) => void;
    onLibrarySelect: (lineId: string, itemId: string) => void;
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

    const fieldLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:hidden";

    return (
        <div className={`grid grid-cols-2 items-end gap-3 px-3 pb-4 pt-2 transition-colors hover:bg-slate-700/20 sm:px-5 md:gap-2 md:border-b md:border-slate-700/30 md:py-2 ${
            isClientBoQ
                ? "md:grid-cols-[50px_1fr_80px_80px_100px_100px_40px]"
                : "md:grid-cols-[70px_1fr_80px_80px_100px_100px_40px]"
        }`}>
            <label className="min-w-0">
                <span className={fieldLabel}>{isClientBoQ ? "Reference" : "Type"}</span>
                {isClientBoQ ? (
                    <span className="flex min-h-11 items-center truncate rounded border border-slate-700 bg-slate-900/30 px-2 font-mono text-xs text-slate-500 md:min-h-0 md:border-0 md:bg-transparent md:px-0" title={line.client_ref || ""}>
                        {line.client_ref || "No ref"}
                    </span>
                ) : (
                    <select
                        value={line.line_type || "general"}
                        onChange={(e) => onUpdate(line.id, { line_type: e.target.value })}
                        className="h-11 w-full truncate rounded border border-slate-700 bg-slate-900/50 px-2 text-xs text-slate-400 focus:outline-none md:h-8 md:px-1"
                    >
                        {LINE_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </option>
                        ))}
                    </select>
                )}
            </label>

            <div className="relative col-span-2 min-w-0 md:col-span-1" ref={dropdownRef} style={{ overflow: "visible" }}>
                <span className={fieldLabel}>Description</span>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setShowDropdown(e.target.value.length > 0);
                    }}
                    onFocus={() => {
                        if (search.length > 0) setShowDropdown(true);
                    }}
                    onBlur={() => {
                        setTimeout(() => {
                            setShowDropdown(false);
                            if (search !== line.description) onUpdate(line.id, { description: search });
                        }, 200);
                    }}
                    placeholder="Search library or type description..."
                    className="h-11 w-full rounded border border-slate-700 bg-slate-900/50 px-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 md:h-8"
                />
                {showDropdown && filtered.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
                        {filtered.map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSearch(item.description);
                                    setShowDropdown(false);
                                    onLibrarySelect(line.id, item.id);
                                }}
                                className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-700/50"
                            >
                                <span className="min-w-0 truncate text-slate-200">
                                    <span className="mr-1.5 text-xs text-slate-500">{item.code}</span>
                                    {item.description}
                                </span>
                                <span className="ml-2 whitespace-nowrap text-xs text-slate-400">{formatGBP(item.base_rate)}/{item.unit}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <label>
                <span className={fieldLabel}>Quantity</span>
                <input
                    type="number"
                    step="0.01"
                    defaultValue={line.quantity}
                    onBlur={(e) => onUpdate(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                    className="h-11 w-full rounded border border-slate-700 bg-slate-900/50 px-2 text-center text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 md:h-8"
                />
            </label>

            <label>
                <span className={fieldLabel}>Unit</span>
                <select
                    key={line.unit}
                    defaultValue={line.unit}
                    onChange={(e) => onUpdate(line.id, { unit: e.target.value })}
                    className="h-11 w-full rounded border border-slate-700 bg-slate-900/50 px-2 text-sm text-slate-300 focus:outline-none md:h-8 md:px-1"
                >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
            </label>

            <label>
                <span className={fieldLabel}>Rate</span>
                {line.pricing_mode === "buildup" ? (
                    <span className="flex h-11 flex-col items-end justify-center rounded bg-blue-500/10 px-2 text-right text-sm font-medium leading-tight text-blue-400 md:h-8">
                        <span>{formatGBP(line.unit_rate)}</span>
                        <span className="text-[9px] text-blue-500">built up</span>
                    </span>
                ) : (
                    <input
                        key={line.unit_rate}
                        type="number"
                        step="0.01"
                        defaultValue={line.unit_rate}
                        onBlur={(e) => onUpdate(line.id, { unit_rate: parseFloat(e.target.value) || 0 })}
                        className="h-11 w-full rounded border border-slate-700 bg-slate-900/50 px-2 text-right text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 md:h-8"
                    />
                )}
            </label>

            <div>
                <span className={fieldLabel}>Total</span>
                <div className="flex h-11 items-center justify-end rounded bg-slate-900/30 px-2 text-sm font-medium text-slate-200 md:h-8 md:bg-transparent md:pr-2">
                    {formatGBP(line.line_total || 0)}
                </div>
            </div>

            <button
                type="button"
                onClick={() => onDelete(line.id)}
                aria-label={`Delete ${line.description || "line item"}`}
                className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded border border-slate-700 text-sm text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 md:col-span-1 md:h-8 md:min-h-0 md:w-8 md:border-0"
            >
                <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                <span className="md:hidden">Delete line</span>
            </button>
        </div>
    );
}

// ─── Summary Row ─────────────────────────────────────────
function SummaryRow({ label, value, bold, large }: { label: string; value: number; bold?: boolean; large?: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className={`text-sm ${bold ? "font-bold text-slate-100" : "text-slate-400"} ${large ? "text-base" : ""}`}>
                {label}
            </span>
            <span className={`${bold ? "font-bold text-white" : "text-slate-300"} ${large ? "text-lg" : "text-sm"}`}>
                {formatGBP(value)}
            </span>
        </div>
    );
}
