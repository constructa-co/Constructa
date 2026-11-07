"use client";
// The full estimating workspace: bill of quantities by trade section, rate
// build-ups, cost library search, estimate versions, client BoQ import and
// drawing take-off. It is opened from the Advanced estimating disclosure on
// the simple pricing screen, which owns the estimates and the running total.

import { useState, useTransition, useRef, useCallback, useId, useEffect } from "react";
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
import { formatGBP, parseAdvancedQuantityDraft, type AdvancedRunningTotalDraft } from "@/lib/simple-estimate";
import { computeAdvancedRunningTotalDraft } from "@/lib/advanced-running-total-draft";
import ui from "@/components/estimating.module.css";
import type { EstimateLineComponent, EstimateLine, Estimate, CostLibraryItem, LabourRate, RateBuildup } from "./types";
import { savePriceLineActivityAction } from "./activity-actions";
import { workspaceStyles } from "@/lib/workspace-styles";
import type { ComponentProps } from "react";

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
    resourceSaveStates?: Record<string, "saving" | "uncertain" | "draft">;
    onResourceSaveStateChanged?: (lineId: string, state: "saving" | "confirmed" | "uncertain" | "draft") => void;
    onLineSaveStateChanged?: (lineId: string, state: "saving" | "confirmed" | "uncertain") => void;
    onRunningTotalDraftChange?: (draft: AdvancedRunningTotalDraft | null) => void;
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
type CatalogueReview = { line: EstimateLine; item: CostLibraryItem; context: string };
type QuantityDraft = { line: EstimateLine; raw: string; context: string };
type RateDraft = QuantityDraft & { projectId: string; orgId: string };
type UnitDraft = RateDraft;
type DescriptionDraft = RateDraft;
type LineTypeDraft = RateDraft;
type AddLineReceipt = { key: string; token: object; estimateId: string; section: string; context: string; phase: "saving" | "confirmed" | "unconfirmed"; message: string; returnedId?: string };
type DeleteLineReceipt = { line: EstimateLine; context: string; phase: "saving" | "confirmed" | "unconfirmed"; message: string };
type ActivityReview = { line: EstimateLine; context: string; projectId: string; orgId: string; raw: string; phase: "editing" | "saving" | "uncertain"; message: string };
const activityStyles = workspaceStyles(true);
function AdvancedLineActivity({ lineId, section, choices, blocked, helpText, review, onBegin, onChange, onSave, onCancel }: {
    lineId: string; section: string | null; choices: string[]; blocked: boolean; helpText: string;
    review?: ActivityReview; onBegin: () => boolean; onChange: (raw: string) => void;
    onSave: () => Promise<void>; onCancel: () => void;
}) {
    if (!review) return <button type="button" data-line-activity={lineId} disabled={blocked}
        className={`${activityStyles.quietButton} mt-1 text-sm`} onClick={() => { if (!blocked) onBegin(); }}>
        Activity: {section || "General"} · Change
    </button>;
    const prefix = `line-activity-${lineId}`;
    const name = review.raw.trim();
    return <div className={`${activityStyles.inset} mt-3 min-w-0 p-3`} data-line-activity-editor={lineId}>
        <label htmlFor={prefix} className={`block text-sm font-semibold ${activityStyles.body}`}>Work activity for this line</label>
        <input id={prefix} list={`${prefix}-choices`} type="text" value={review.raw} disabled={blocked || review.phase !== "editing"}
            className={`${activityStyles.input} mt-2 w-full min-w-0 text-base`} aria-describedby={`${prefix}-help`}
            onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
            onChange={event => { if (!blocked) onChange(event.currentTarget.value); }} />
        <datalist id={`${prefix}-choices`}>{choices.map(choice => <option key={choice} value={choice} />)}</datalist>
        <p id={`${prefix}-help`} className={`mt-2 text-sm ${activityStyles.muted}`}>{helpText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={activityStyles.secondaryButton} disabled={blocked || review.phase !== "editing" || !name || name.length > 100}
                onClick={() => void onSave()}>{review.phase === "saving" ? "Saving activity…" : "Save activity"}</button>
            <button type="button" className={activityStyles.quietButton} disabled={blocked || review.phase !== "editing"} onClick={onCancel}>Cancel</button>
        </div>
        {name.length > 100 && <p role="alert" className={`mt-2 text-sm ${activityStyles.errorText}`}>Keep the activity within 100 characters. Nothing is truncated.</p>}
        {review.message && <p role="alert" className={`mt-2 break-words text-sm ${activityStyles.errorText}`}>{review.message}</p>}
    </div>;
}
// ─── Main Component ──────────────────────────────────────

export default function AdvancedEstimate({ estimates, setEstimates, activeTab, setActiveTab, costLibrary, projectId, orgId, rateBuildups, labourRates, preferredTrades, resourceSaveStates, onResourceSaveStateChanged, onLineSaveStateChanged, onRunningTotalDraftChange }: Props) {
    const router = useRouter();
    const showClientBoQImport = isCapabilityEnabled("client-boq-import");
    const showDrawingTakeoff = isCapabilityEnabled("drawing-takeoff");

    // Ref to hold newly-imported estimate ID across the close handler — avoids stale closure issues
    const importedEstimateIdRef = useRef<string | null>(null);

    const [_isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [openBuildUpPanels, setOpenBuildUpPanels] = useState<Set<string>>(new Set());
    const [uncertainResourceLines, setUncertainResourceLines] = useState<Set<string>>(new Set());
    const [pendingResourceLines, setPendingResourceLines] = useState<Set<string>>(new Set());
    const pendingResourceLinesRef = useRef(new Set<string>());
    const resourceUncertainRef = useRef(new Set<string>());
    const [draftResourceLines, setDraftResourceLines] = useState<Set<string>>(new Set());
    const draftResourceLinesRef = useRef(new Set<string>());
    const lineQueuesRef = useRef<Record<string, Promise<void>>>({});
    const linePendingRef = useRef<Record<string, number>>({});
    const lineSequenceRef = useRef(0);
    const lineLatestRef = useRef<Record<string, number>>({});
    const lineFieldVersionsRef = useRef<Record<string, Partial<Record<keyof EstimateLine, number>>>>({});
    const lineUncertainRef = useRef(new Set<string>());
    const [uncertainLineSaves, setUncertainLineSaves] = useState<Set<string>>(new Set());
    const [pendingLineSaves, setPendingLineSaves] = useState<Set<string>>(new Set());
    const applyingResourceLinesRef = useRef(new Set<string>());
    const [applyingResourceLines, setApplyingResourceLines] = useState<Set<string>>(new Set());
    const [showBoQImport, setShowBoQImport] = useState(false);

    const currentEstimate = estimates.find((e) => e.id === activeTab);

    const catalogueContext = JSON.stringify([projectId, orgId, activeTab, currentEstimate, costLibrary]);
    const catalogueView = useRef({ context: catalogueContext, resourceSaveStates });
    const catalogueMounted = useRef(false);
    const catalogueReviewRef = useRef<CatalogueReview | null>(null);
    const catalogueConsumed = useRef<CatalogueReview | null>(null);
    const [catalogueReview, setCatalogueReview] = useState<CatalogueReview | null>(null);
    const [cataloguePending, setCataloguePending] = useState(false);
    const [catalogueMessage, setCatalogueMessage] = useState("");
    const quantityDraftRef = useRef<QuantityDraft | null>(null);
    const quantityConsumed = useRef<QuantityDraft | null>(null);
    const [quantityDraft, setQuantityDraft] = useState<QuantityDraft | null>(null);
    const [quantityPending, setQuantityPending] = useState(false);
    const [quantityMessage, setQuantityMessage] = useState("");
    const lineTypeDraftRef = useRef<LineTypeDraft | null>(null);
    const lineTypeConsumed = useRef<LineTypeDraft | null>(null);
    const [lineTypeDraft, setLineTypeDraft] = useState<LineTypeDraft | null>(null);
    const [lineTypePending, setLineTypePending] = useState(false);
    const [lineTypeMessage, setLineTypeMessage] = useState("");
    const descriptionDraftRef = useRef<DescriptionDraft | null>(null);
    const descriptionConsumed = useRef<DescriptionDraft | null>(null);
    const [descriptionDraft, setDescriptionDraft] = useState<DescriptionDraft | null>(null);
    const [descriptionPending, setDescriptionPending] = useState(false);
    const [descriptionMessage, setDescriptionMessage] = useState("");
    const unitDraftRef = useRef<UnitDraft | null>(null);
    const unitConsumed = useRef<UnitDraft | null>(null);
    const [unitDraft, setUnitDraft] = useState<UnitDraft | null>(null);
    const [unitPending, setUnitPending] = useState(false);
    const [unitMessage, setUnitMessage] = useState("");
    const rateDraftRef = useRef<RateDraft | null>(null);
    const rateConsumed = useRef<RateDraft | null>(null);
    const [rateDraft, setRateDraft] = useState<RateDraft | null>(null);
    const [ratePending, setRatePending] = useState(false);
    const [rateMessage, setRateMessage] = useState("");
    const activityReviewRef = useRef<ActivityReview | null>(null);
    const [activityReview, setActivityReview] = useState<ActivityReview | null>(null);
    useEffect(() => { catalogueView.current = { context: catalogueContext, resourceSaveStates }; }, [catalogueContext, resourceSaveStates]);
    useEffect(() => {
        catalogueMounted.current = true;
        return () => { catalogueMounted.current = false; };
    }, []);

    useEffect(() => {
        if (!onRunningTotalDraftChange || !currentEstimate) return;
        const moneyDraftLineId = quantityDraft?.line.id ?? rateDraft?.line.id;
        const extraResourceDraft = [...draftResourceLines].some((id) => id !== moneyDraftLineId);
        const resourceBlocked =
            pendingResourceLines.size > 0 ||
            applyingResourceLines.size > 0 ||
            uncertainResourceLines.size > 0 ||
            extraResourceDraft ||
            Object.entries(resourceSaveStates ?? {}).some(
                ([key, status]) =>
                    (status === "uncertain" || status === "saving") &&
                    !key.startsWith("quantity:") &&
                    !key.startsWith("rate:"),
            );
        const linePending = Object.values(linePendingRef.current).some((count) => count > 0);
        onRunningTotalDraftChange(
            computeAdvancedRunningTotalDraft({
                estimateId: activeTab,
                contextToken: catalogueContext,
                isClientBoQ: !!currentEstimate.is_client_boq,
                quantityDraft: quantityDraftRef.current,
                rateDraft: rateDraftRef.current,
                quantityPending,
                quantityConsumed: quantityConsumed.current !== null,
                ratePending,
                rateConsumed: rateConsumed.current !== null,
                quantityMessage,
                rateMessage,
                hasOtherDraftWork: !!(
                    lineTypeDraft ||
                    descriptionDraft ||
                    unitDraft ||
                    activityReview ||
                    catalogueReview
                ),
                hasPendingOrUncertainLineWork:
                    pendingLineSaves.size > 0 || uncertainLineSaves.size > 0 || linePending,
                hasBlockingResourceWork: resourceBlocked,
            }),
        );
    }, [
        onRunningTotalDraftChange,
        currentEstimate,
        activeTab,
        catalogueContext,
        quantityDraft,
        rateDraft,
        quantityPending,
        ratePending,
        quantityMessage,
        rateMessage,
        lineTypeDraft,
        descriptionDraft,
        unitDraft,
        activityReview,
        catalogueReview,
        pendingLineSaves,
        uncertainLineSaves,
        draftResourceLines,
        pendingResourceLines,
        applyingResourceLines,
        uncertainResourceLines,
        resourceSaveStates,
    ]);

    const addReceiptsRef = useRef(new Map<string, AddLineReceipt>());
    const [addReceipts, setAddReceipts] = useState<AddLineReceipt[]>([]);
    const confirmedAddRowsRef = useRef(new Map<string, EstimateLine>());
    const addingSectionsRef = useRef(new Set<string>());
    const deleteReceiptRef = useRef<DeleteLineReceipt | null>(null);
    const [deleteReceipt, setDeleteReceipt] = useState<DeleteLineReceipt | null>(null);
    const deleteBlocked = () => (!!deleteReceiptRef.current && deleteReceiptRef.current.phase !== "confirmed") ||
        Object.keys(catalogueView.current.resourceSaveStates ?? {}).some(key => key.startsWith("delete:"));
    const retainedDeletes = Object.entries(resourceSaveStates ?? {}).filter(([key]) => key.startsWith("delete:"));
    const deleteWorkOpen = (!!deleteReceipt && deleteReceipt.phase !== "confirmed") || retainedDeletes.length > 0;

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
        if (deleteBlocked()) return;
        if (lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current || quantityDraftRef.current || draftResourceLinesRef.current.size > 0) return;
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
        if (deleteBlocked()) return;
        if (lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current || quantityDraftRef.current || draftResourceLinesRef.current.size > 0) return;
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
        if (deleteBlocked()) return;
        if (lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current || catalogueReviewRef.current || quantityDraftRef.current) return;
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
        if (deleteBlocked()) return;
        if (!currentEstimate) return;
        const updated = { ...currentEstimate, [field]: value };
        setEstimates((prev) => prev.map((e) => (e.id === currentEstimate.id ? updated : e)));
    };
    const handleMarginBlur = (field: "overhead_pct" | "profit_pct" | "risk_pct" | "prelims_pct", value: number) => {
        if (deleteBlocked()) return;
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
        if (deleteBlocked()) return;
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
        if (deleteBlocked()) return;
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
    const addKey = (estimateId: string, section: string) => JSON.stringify([estimateId, section]);
    const addLedgerClear = () => Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, state]) =>
        [...addReceiptsRef.current.values()].some(receipt => key === `add:${receipt.key}` && receipt.estimateId === currentEstimate?.id &&
            ((state === "saving" && (receipt.phase === "saving" || receipt.phase === "confirmed")) || (state === "uncertain" && receipt.phase === "unconfirmed"))));
    const publishAddReceipt = (receipt: AddLineReceipt) => {
        if (!catalogueMounted.current) return;
        addReceiptsRef.current.set(receipt.key, receipt);
        setAddReceipts([...addReceiptsRef.current.values()]);
    };
    const addSourceFresh = (receipt: AddLineReceipt) => {
        if (!catalogueMounted.current || addReceiptsRef.current.get(receipt.key)?.token !== receipt.token || !addLedgerClear()) return false;
        const reviewed = JSON.parse(receipt.context) as [string, string, string, Estimate, CostLibraryItem[]];
        const latest = JSON.parse(catalogueView.current.context) as [string, string, string, Estimate | null, CostLibraryItem[]];
        if (!latest[3]) return false;
        const baseline = reviewed[3].estimate_lines;
        const rows = latest[3].estimate_lines;
        if (rows.length < baseline.length) return false;
        // Only exact, appended rows from other confirmed adds may extend this source.
        const extra = rows.slice(baseline.length);
        const baselineIds = new Set(baseline.map(row => row.id));
        const approved = [...confirmedAddRowsRef.current.values()].filter(row => row.estimate_id === receipt.estimateId && !baselineIds.has(row.id));
        if (new Set(rows.map(row => row.id)).size !== rows.length ||
            extra.some((row, index) => JSON.stringify(approved[index]) !== JSON.stringify(row))) return false;
        latest[3] = { ...latest[3], estimate_lines: rows.slice(0, baseline.length) };
        return JSON.stringify(latest) === receipt.context;
    };
    const handleAddLine = async (section: string) => {
        if (deleteBlocked()) return;
        if (currentEstimate?.is_client_boq || section === "Preliminaries") { await handleAddSpecialLine(section); return; }
        if (!catalogueMounted.current || !currentEstimate || currentEstimate.project_id !== projectId || catalogueView.current.context !== catalogueContext ||
            lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current ||
            quantityDraftRef.current || catalogueReviewRef.current || draftResourceLinesRef.current.size || pendingResourceLinesRef.current.size ||
            applyingResourceLinesRef.current.size || lineUncertainRef.current.size || Object.values(linePendingRef.current).some(count => count > 0) || !addLedgerClear()) return;
        const key = addKey(currentEstimate.id, section);
        const previous = addReceiptsRef.current.get(key);
        if (addingSectionsRef.current.has(section) || (previous && previous.phase !== "confirmed")) return;
        const sectionLines = currentEstimate.estimate_lines.filter(line => line.trade_section === section);
        const lastLine = sectionLines[sectionLines.length - 1];
        if (lastLine && (!lastLine.description || lastLine.description === "" || lastLine.description === "\u2014")) return;
        const receipt: AddLineReceipt = { key, token: {}, estimateId: currentEstimate.id, section, context: catalogueContext,
            phase: "saving", message: "Adding one blank line. Awaiting acknowledgement; no row is shown yet." };
        publishAddReceipt(receipt); addingSectionsRef.current.add(section);
        onResourceSaveStateChanged?.(`add:${key}`, "saving");
        const unconfirmed = (message: string, returnedId?: string) => {
            if (!catalogueMounted.current || addReceiptsRef.current.get(key)?.token !== receipt.token) return;
            publishAddReceipt({ ...receipt, phase: "unconfirmed", returnedId,
                message: message + " The row may already exist remotely. Reload to reconcile before adding to this activity again; no retry starts automatically." });
            onResourceSaveStateChanged?.(`add:${key}`, "uncertain");
        };
        try {
            const result = await addLineItemAction(receipt.estimateId, section, {
                description: "", quantity: 1, unit: "nr", unit_rate: 0, line_type: "general",
            });
            if (!catalogueMounted.current) return;
            const id = typeof result?.id === "string" && result.id.trim() ? result.id : undefined;
            if (!addSourceFresh(receipt) || result?.error || result?.warning || !id ||
                confirmedAddRowsRef.current.has(id) || currentEstimate.estimate_lines.some(line => line.id === id)) {
                unconfirmed(result?.error || result?.warning || "The add response or reviewed source was not fully confirmed.", id);
                if (result?.error) toast.error(result.error);
                return;
            }
            const newLine: EstimateLine = { id, estimate_id: receipt.estimateId, description: "", quantity: 1, unit: "nr", unit_rate: 0,
                line_total: 0, trade_section: section, line_type: "general", pricing_mode: "simple", estimate_line_components: [] };
            confirmedAddRowsRef.current.set(id, newLine);
            setEstimates(previous => previous.map(estimate => estimate.id === receipt.estimateId
                ? { ...estimate, estimate_lines: [...estimate.estimate_lines, newLine] } : estimate));
            publishAddReceipt({ ...receipt, phase: "confirmed", returnedId: id, message: "Blank line added after acknowledgement. Enter its description, quantity and rate." });
            onResourceSaveStateChanged?.(`add:${key}`, "confirmed");
        } catch {
            unconfirmed("The add acknowledgement was lost or rejected.");
        } finally { addingSectionsRef.current.delete(section); }
    };

    const handleAddSpecialLine = async (section: string) => {
        if (!currentEstimate) return;
        // Validate: only add if previous line in section has a description
        const sectionLines = currentEstimate.estimate_lines.filter(l => l.trade_section === section);
        const lastLine = sectionLines[sectionLines.length - 1];
        if (lastLine && (!lastLine.description || lastLine.description === "" || lastLine.description === "\u2014")) {
            return; // Don't add another blank row
        }
        // The row is shown only once the server has confirmed it, and one add
        // runs per section at a time. A row shown earlier under a temporary
        // id could be typed into before it existed: those edits were refused
        // by the server but stayed on screen and in the running total.
        if (addingSectionsRef.current.has(section)) return;
        addingSectionsRef.current.add(section);
        const estimateId = currentEstimate.id;
        showSaving();
        try {
            const result = await addLineItemAction(estimateId, section, {
                description: "", quantity: 1, unit: "nr", unit_rate: 0,
                line_type: "general",
            });
            if (result?.error || !result?.id) {
                showSaveError(result?.error ?? "Failed to add line");
                return;
            }
            const newLine: EstimateLine = {
                id: result.id,
                estimate_id: estimateId,
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
            setEstimates((prev) => prev.map((e) =>
                e.id === estimateId
                    ? { ...e, estimate_lines: [...e.estimate_lines, newLine] }
                    : e
            ));
            showSaved();
        } catch (err) {
            console.error(err);
            showSaveError(err instanceof Error ? err.message : "Failed to add line");
        } finally {
            addingSectionsRef.current.delete(section);
        }
    };

    const handleUpdateLine = (lineId: string, updates: Partial<EstimateLine>) => {
        if (!currentEstimate) return;
        if (deleteBlocked()) return;
        if (lineTypeDraftRef.current?.line.id === lineId || descriptionDraftRef.current?.line.id === lineId || unitDraftRef.current?.line.id === lineId || rateDraftRef.current?.line.id === lineId || activityReviewRef.current?.line.id === lineId || quantityDraftRef.current?.line.id === lineId || draftResourceLinesRef.current.has(lineId)) return;
        if ((updates.quantity !== undefined || updates.unit_rate !== undefined) && applyingResourceLinesRef.current.has(lineId)) {
            showSaveError("Wait for the resource rate application to finish before changing the priced quantity or rate.");
            return;
        }
        if (lineUncertainRef.current.has(lineId) || resourceSaveStates?.[`line:${lineId}`] === "uncertain") {
            showSaveError("Reload the estimate to reconcile this line before editing it again.");
            return;
        }
        const sequence = ++lineSequenceRef.current;
        lineLatestRef.current[lineId] = sequence;
        const versions = lineFieldVersionsRef.current[lineId] ?? {};
        for (const key of Object.keys(updates) as (keyof EstimateLine)[]) versions[key] = sequence;
        if (updates.quantity !== undefined || updates.unit_rate !== undefined) versions.line_total = sequence;
        lineFieldVersionsRef.current[lineId] = versions;

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
        linePendingRef.current[lineId] = (linePendingRef.current[lineId] || 0) + 1;
        setPendingLineSaves(previous => new Set(previous).add(lineId));
        onLineSaveStateChanged?.(lineId, "saving");
        const uncertain = (message: string) => {
            lineUncertainRef.current.add(lineId);
            setUncertainLineSaves(previous => new Set(previous).add(lineId));
            onLineSaveStateChanged?.(lineId, "uncertain");
            showSaveError(message);
        };
        const write = async () => {
            try {
                if (lineUncertainRef.current.has(lineId)) return;
                // Send only deliberate fields. The server owns the saved counterpart.
                const result = await updateLineItemAction(lineId, updates);
                if (!result?.success || result.line?.id !== lineId) {
                    uncertain(result?.error ?? "The line save was not confirmed and may already have saved. Reload before retrying.");
                    return;
                }
                const currentVersions = lineFieldVersionsRef.current[lineId];
                const confirmed = Object.fromEntries(Object.entries(result.line).filter(([key]) =>
                    (currentVersions?.[key as keyof EstimateLine] ?? 0) <= sequence));
                setEstimates(previous => previous.map(estimate => {
                    if (estimate.id !== currentEstimate.id) return estimate;
                    const savedLines = estimate.estimate_lines.map(line => line.id === lineId ? { ...line, ...confirmed } : line);
                    return { ...estimate, estimate_lines: savedLines, total_cost: savedLines.reduce((sum, line) => sum + (line.line_total || 0), 0) };
                }));
                if (lineLatestRef.current[lineId] === sequence) {
                    if (result.warning) showSaveError(result.warning);
                    else if (Object.values(linePendingRef.current).reduce((sum, count) => sum + count, 0) === 1 && lineUncertainRef.current.size === 0) showSaved();
                }
            } catch {
                uncertain("The line save was not confirmed and may already have saved. Reload before retrying.");
            } finally {
                linePendingRef.current[lineId] -= 1;
                if (linePendingRef.current[lineId] === 0) {
                    setPendingLineSaves(previous => { const next = new Set(previous); next.delete(lineId); return next; });
                    if (!lineUncertainRef.current.has(lineId)) onLineSaveStateChanged?.(lineId, "confirmed");
                }
            }
        };
        lineQueuesRef.current[lineId] = linePendingRef.current[lineId] === 1
            ? write() : lineQueuesRef.current[lineId].then(write);
    };

    const handleDeleteLine = async (lineId: string) => {
        if (deleteBlocked() || deleteReceiptRef.current?.context === catalogueContext) return;
        const line = currentEstimate?.estimate_lines.find(row => row.id === lineId);
        if (!line || !currentEstimate) return;
        const draftsClear = () => !lineTypeDraftRef.current && !descriptionDraftRef.current && !unitDraftRef.current &&
            !rateDraftRef.current && !activityReviewRef.current && !quantityDraftRef.current && !catalogueReviewRef.current &&
            !draftResourceLinesRef.current.size && !pendingResourceLinesRef.current.size && !applyingResourceLinesRef.current.size && !resourceUncertainRef.current.size;
        if (!catalogueMounted.current || deleteBlocked() || currentEstimate.project_id !== projectId || line.estimate_id !== currentEstimate.id ||
            catalogueView.current.context !== catalogueContext || !draftsClear() || !addLedgerClear() ||
            [...addReceiptsRef.current.values()].some(receipt => receipt.phase === "saving" || receipt.phase === "unconfirmed") ||
            lineUncertainRef.current.size || Object.values(linePendingRef.current).some(count => count > 0) ||
            currentEstimate.estimate_lines.filter(row => row.id === lineId).length !== 1) return;
        const reviewedEstimate = (JSON.parse(catalogueContext) as [string, string, string, Estimate])[3];
        const receipt: DeleteLineReceipt = { line: reviewedEstimate.estimate_lines.find(row => row.id === lineId)!, context: catalogueContext, phase: "saving",
            message: "Removing this line. Its confirmed row and totals remain visible while acknowledgement is pending." };
        deleteReceiptRef.current = receipt; setDeleteReceipt(receipt);
        linePendingRef.current[lineId] = 1;
        setPendingLineSaves(previous => new Set(previous).add(lineId));
        onResourceSaveStateChanged?.(`delete:${lineId}`, "saving");
        const unconfirmed = (message: string) => {
            if (!catalogueMounted.current || deleteReceiptRef.current !== receipt) return;
            const retained = { ...receipt, phase: "unconfirmed" as const,
                message: message + " The line may already be deleted remotely. Current work is retained; reload to reconcile before further changes. No delete retry or refresh starts automatically." };
            deleteReceiptRef.current = retained; setDeleteReceipt(retained);
            lineUncertainRef.current.add(lineId);
            setUncertainLineSaves(previous => new Set(previous).add(lineId));
            onResourceSaveStateChanged?.(`delete:${lineId}`, "uncertain");
        };
        try {
            const result = await deleteLineItemAction(lineId);
            if (!catalogueMounted.current) return;
            const fresh = deleteReceiptRef.current === receipt && catalogueView.current.context === receipt.context && draftsClear() &&
                Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, state]) =>
                    key === `delete:${lineId}` && state === "saving");
            if (result?.success !== true || result.error || result.warning || !fresh) {
                unconfirmed(result?.error || result?.warning || "The delete response or reviewed source was not fully confirmed."); return;
            }
            // The pricing screen dispatches this updater synchronously against its latest reducer-store state.
            let removed = false;
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== reviewedEstimate.id || JSON.stringify(estimate) !== JSON.stringify(reviewedEstimate)) return estimate;
                const remaining = estimate.estimate_lines.filter(row => row.id !== lineId);
                removed = true;
                return { ...estimate, estimate_lines: remaining, total_cost: remaining.reduce((sum, row) => sum + (row.line_total || 0), 0) };
            }));
            if (!removed) { unconfirmed("Newer current work prevents applying the delete acknowledgement."); return; }
            const confirmed = { ...receipt, phase: "confirmed" as const, message: "Line removed after acknowledgement against the unchanged reviewed estimate." };
            deleteReceiptRef.current = confirmed; setDeleteReceipt(confirmed);
            onResourceSaveStateChanged?.(`delete:${lineId}`, "confirmed");
        } catch { unconfirmed("The delete acknowledgement was lost or rejected."); }
        finally {
            linePendingRef.current[lineId] = 0;
            if (catalogueMounted.current) setPendingLineSaves(previous => { const next = new Set(previous); next.delete(lineId); return next; });
        }
    };

    const handleLibrarySelect = (lineId: string, itemId: string, section: string) => {
        if (deleteBlocked()) return;
        if (!catalogueMounted.current || lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current || quantityDraftRef.current || catalogueReviewRef.current || catalogueView.current.context !== catalogueContext ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).length || draftResourceLinesRef.current.size) return;
        const item = costLibrary.find((c) => c.id === itemId);
        const line = currentEstimate?.estimate_lines.find(row => row.id === lineId);
        if (!item || !line || currentEstimate?.project_id !== projectId || currentEstimate.is_client_boq ||
            line.estimate_id !== currentEstimate.id || line.trade_section !== section || section === "Preliminaries" || line.pricing_mode !== "simple" ||
            linePendingRef.current[lineId] > 0 || lineUncertainRef.current.has(lineId) || pendingResourceLinesRef.current.has(lineId) || applyingResourceLinesRef.current.has(lineId) ||
            typeof item.description !== "string" || typeof item.unit !== "string" || !Number.isFinite(item.base_rate) ||
            !Number.isFinite(line.quantity) || !Number.isFinite(line.quantity * item.base_rate)) return;
        const review = { line, item, context: catalogueContext };
        catalogueReviewRef.current = review;
        catalogueConsumed.current = null;
        setCatalogueReview(review); setCatalogueMessage("");
        draftResourceLinesRef.current.add(lineId);
        setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`catalogue:${lineId}`, "draft");
    };

    const closeCatalogueReview = (review: CatalogueReview) => {
        if (!catalogueMounted.current || catalogueReviewRef.current !== review || catalogueConsumed.current === review) return;
        catalogueReviewRef.current = null; setCatalogueReview(null); setCatalogueMessage("");
        draftResourceLinesRef.current.delete(review.line.id);
        setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`catalogue:${review.line.id}`, "confirmed");
    };
    const saveCatalogueReview = async (review: CatalogueReview) => {
        const id = review.line.id;
        const fresh = () => catalogueMounted.current && catalogueReviewRef.current === review &&
            catalogueView.current.context === review.context &&
            Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, status]) =>
                (key === `catalogue:${id}` && status === "draft") ||
                (key === `line:${id}` && status === "saving" && catalogueConsumed.current === review));
        if (catalogueConsumed.current === review || !fresh() || linePendingRef.current[id] > 0 || lineUncertainRef.current.has(id) ||
            pendingResourceLinesRef.current.has(id) || applyingResourceLinesRef.current.has(id)) {
            if (catalogueMounted.current && catalogueReviewRef.current === review && catalogueConsumed.current !== review) setCatalogueMessage("The reviewed source or line changed. Cancel and review the current values before saving.");
            return;
        }
        catalogueConsumed.current = review;
        setCataloguePending(true); showSaving();
        linePendingRef.current[id] = 1;
        setPendingLineSaves(previous => new Set(previous).add(id));
        onLineSaveStateChanged?.(id, "saving");
        const uncertain = () => {
            if (!catalogueMounted.current || catalogueReviewRef.current !== review) return;
            lineUncertainRef.current.add(id);
            setUncertainLineSaves(previous => new Set(previous).add(id));
            onLineSaveStateChanged?.(id, "uncertain");
            setCatalogueMessage("The catalogue save was not fully confirmed and may already have saved. The reviewed choice is retained. Reload to reconcile before retrying.");
            showSaveError("Catalogue save not fully confirmed; reload before retrying.");
        };
        try {
            const updates: Partial<EstimateLine> = {
                description: review.item.description, unit: review.item.unit, unit_rate: review.item.base_rate,
                cost_library_item_id: review.item.id,
            };
            const result = await updateLineItemAction(id, updates);
            const saved = result?.line;
            if (!fresh() || !result?.success || !saved || saved.id !== id || saved.description !== review.item.description ||
                saved.unit !== review.item.unit || saved.unit_rate !== review.item.base_rate || saved.cost_library_item_id !== review.item.id ||
                saved.quantity !== review.line.quantity || typeof saved.line_total !== "number" || !Number.isFinite(saved.line_total)) {
                uncertain(); return;
            }
            // Publish only the acknowledged fields; preserve every other line and resource.
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== review.line.estimate_id) return estimate;
                const rows = estimate.estimate_lines.map(line => line.id === id && JSON.stringify(line) === JSON.stringify(review.line)
                    ? { ...line, description: saved.description!, unit: saved.unit!, unit_rate: saved.unit_rate!, cost_library_item_id: saved.cost_library_item_id, line_total: saved.line_total! }
                    : line);
                return { ...estimate, estimate_lines: rows, total_cost: rows.reduce((sum, line) => sum + (line.line_total || 0), 0) };
            }));
            if (result.warning) { uncertain(); return; }
            catalogueConsumed.current = null;
            closeCatalogueReview(review); onLineSaveStateChanged?.(id, "confirmed"); showSaved();
        } catch { uncertain(); }
        finally {
            linePendingRef.current[id] = 0;
            if (catalogueMounted.current) {
                setCataloguePending(false);
                setPendingLineSaves(previous => { const next = new Set(previous); next.delete(id); return next; });
            }
        }
    };

    const editQuantityDraft = (line: EstimateLine, raw: string, expected?: QuantityDraft) => {
        if (deleteBlocked()) return;
        if (!catalogueMounted.current || lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current || catalogueView.current.context !== catalogueContext || catalogueReviewRef.current ||
            quantityDraftRef.current !== (expected ?? null) || quantityConsumed.current || linePendingRef.current[line.id] > 0 ||
            lineUncertainRef.current.has(line.id) || pendingResourceLinesRef.current.has(line.id) || applyingResourceLinesRef.current.has(line.id)) return;
        const current = currentEstimate?.estimate_lines.find(item => item.id === line.id);
        if (!current || currentEstimate?.project_id !== projectId || currentEstimate.is_client_boq || current.estimate_id !== currentEstimate.id ||
            current.pricing_mode !== "simple" || current.trade_section === "Preliminaries" || JSON.stringify(current) !== JSON.stringify(line) ||
            (expected && expected.context !== catalogueContext) ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).some(key => key !== `quantity:${line.id}`) ||
            (!expected && draftResourceLinesRef.current.size > 0)) return;
        const draft = expected ? { ...expected, raw } : { line, raw, context: catalogueContext };
        quantityDraftRef.current = draft; setQuantityDraft(draft); setQuantityMessage("");
        if (!expected) {
            draftResourceLinesRef.current.add(line.id);
            setDraftResourceLines(new Set(draftResourceLinesRef.current));
            onResourceSaveStateChanged?.(`quantity:${line.id}`, "draft");
        }
    };
    const cancelQuantityDraft = (draft: QuantityDraft) => {
        if (!catalogueMounted.current || quantityDraftRef.current !== draft || quantityConsumed.current === draft) return;
        quantityDraftRef.current = null; setQuantityDraft(null); setQuantityMessage("");
        draftResourceLinesRef.current.delete(draft.line.id);
        setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`quantity:${draft.line.id}`, "confirmed");
    };
    const saveQuantityDraft = async (draft: QuantityDraft) => {
        const id = draft.line.id;
        const fresh = () => catalogueMounted.current && quantityDraftRef.current === draft && catalogueView.current.context === draft.context &&
            Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, status]) =>
                (key === `quantity:${id}` && status === "draft") ||
                (key === `line:${id}` && status === "saving" && quantityConsumed.current === draft));
        const quantity = parseAdvancedQuantityDraft(draft.raw);
        if (quantityConsumed.current || !fresh() || quantity === null || !Number.isFinite(quantity * draft.line.unit_rate) ||
            linePendingRef.current[id] > 0 || lineUncertainRef.current.has(id) || pendingResourceLinesRef.current.has(id) || applyingResourceLinesRef.current.has(id)) {
            if (catalogueMounted.current && quantityDraftRef.current === draft && !quantityConsumed.current && !fresh()) setQuantityMessage("The line or source changed. Your quantity text is retained; Cancel and review the saved values before starting again.");
            return;
        }
        if (quantity === draft.line.quantity) { cancelQuantityDraft(draft); return; }
        quantityConsumed.current = draft; setQuantityPending(true); showSaving();
        linePendingRef.current[id] = 1;
        setPendingLineSaves(previous => new Set(previous).add(id));
        onLineSaveStateChanged?.(id, "saving");
        const uncertain = () => {
            if (!catalogueMounted.current || quantityDraftRef.current !== draft) return;
            lineUncertainRef.current.add(id); setUncertainLineSaves(previous => new Set(previous).add(id));
            onLineSaveStateChanged?.(id, "uncertain");
            setQuantityMessage("Quantity save was not fully confirmed and may already have saved. Your text is retained. Reload to reconcile before retrying.");
            showSaveError("Quantity save not fully confirmed; reload before retrying.");
        };
        try {
            const result = await updateLineItemAction(id, { quantity });
            const saved = result?.line;
            if (!fresh() || !result?.success || !saved || saved.id !== id || saved.unit_rate !== draft.line.unit_rate ||
                typeof saved.quantity !== "number" || !Number.isFinite(saved.quantity) || typeof saved.line_total !== "number" || !Number.isFinite(saved.line_total)) {
                uncertain(); return;
            }
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== draft.line.estimate_id) return estimate;
                const rows = estimate.estimate_lines.map(line => line.id === id && JSON.stringify(line) === JSON.stringify(draft.line)
                    ? { ...line, quantity: saved.quantity!, unit_rate: saved.unit_rate!, line_total: saved.line_total! } : line);
                return { ...estimate, estimate_lines: rows, total_cost: rows.reduce((sum, line) => sum + (line.line_total || 0), 0) };
            }));
            if (result.warning) { uncertain(); return; }
            quantityConsumed.current = null; cancelQuantityDraft(draft);
            onLineSaveStateChanged?.(id, "confirmed"); showSaved();
        } catch { uncertain(); }
        finally {
            linePendingRef.current[id] = 0;
            if (catalogueMounted.current) {
                setQuantityPending(false);
                setPendingLineSaves(previous => { const next = new Set(previous); next.delete(id); return next; });
            }
        }
    };

    const editRateDraft = (line: EstimateLine, raw: string, expected?: RateDraft) => {
        if (deleteBlocked()) return;
        if (!catalogueMounted.current || lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || activityReviewRef.current || quantityDraftRef.current || catalogueReviewRef.current ||
            catalogueView.current.context !== catalogueContext || rateDraftRef.current !== (expected ?? null) || rateConsumed.current ||
            linePendingRef.current[line.id] > 0 || lineUncertainRef.current.has(line.id) || pendingResourceLinesRef.current.has(line.id) || applyingResourceLinesRef.current.has(line.id)) return;
        const current = currentEstimate?.estimate_lines.find(item => item.id === line.id);
        if (!current || currentEstimate?.project_id !== projectId || currentEstimate.is_client_boq || current.estimate_id !== currentEstimate.id ||
            current.pricing_mode !== "simple" || current.trade_section === "Preliminaries" || JSON.stringify(current) !== JSON.stringify(line) ||
            (expected && expected.context !== catalogueContext) ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).some(key => key !== `rate:${line.id}`) ||
            (!expected && draftResourceLinesRef.current.size > 0)) return;
        const draft = expected ? { ...expected, raw } : { line, raw, context: catalogueContext, projectId, orgId };
        rateDraftRef.current = draft; setRateDraft(draft); setRateMessage("");
        if (!expected) {
            draftResourceLinesRef.current.add(line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
            onResourceSaveStateChanged?.(`rate:${line.id}`, "draft");
        }
    };
    const cancelRateDraft = (draft: RateDraft) => {
        if (!catalogueMounted.current || rateDraftRef.current !== draft || rateConsumed.current === draft) return;
        rateDraftRef.current = null; setRateDraft(null); setRateMessage("");
        draftResourceLinesRef.current.delete(draft.line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`rate:${draft.line.id}`, "confirmed");
    };
    const saveRateDraft = async (draft: RateDraft) => {
        const id = draft.line.id;
        const fresh = () => catalogueMounted.current && rateDraftRef.current === draft && catalogueView.current.context === draft.context &&
            Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, status]) =>
                (key === `rate:${id}` && status === "draft") ||
                (key === `line:${id}` && status === "saving" && rateConsumed.current === draft));
        const rate = parseAdvancedQuantityDraft(draft.raw);
        if (rateConsumed.current || !fresh() || rate === null || !Number.isFinite(draft.line.quantity * rate) ||
            linePendingRef.current[id] > 0 || lineUncertainRef.current.has(id) || pendingResourceLinesRef.current.has(id) || applyingResourceLinesRef.current.has(id)) {
            if (catalogueMounted.current && rateDraftRef.current === draft && !rateConsumed.current && !fresh()) setRateMessage("The line or source changed. Your rate text is retained; Cancel and review the saved values before starting again.");
            return;
        }
        if (rate === draft.line.unit_rate) { cancelRateDraft(draft); return; }
        rateConsumed.current = draft; setRatePending(true); showSaving();
        linePendingRef.current[id] = 1; setPendingLineSaves(previous => new Set(previous).add(id));
        onLineSaveStateChanged?.(id, "saving");
        const uncertain = () => {
            if (!catalogueMounted.current || rateDraftRef.current !== draft) return;
            lineUncertainRef.current.add(id); setUncertainLineSaves(previous => new Set(previous).add(id));
            onLineSaveStateChanged?.(id, "uncertain");
            setRateMessage("Rate save was not fully confirmed and may already have saved. Your exact text is retained. Reload to reconcile before retrying.");
            showSaveError("Rate save not fully confirmed; reload before retrying.");
        };
        try {
            const result = await updateLineItemAction(id, { unit_rate: rate });
            const saved = result?.line;
            if (!fresh() || !result?.success || result.warning || !saved || saved.id !== id || saved.quantity !== draft.line.quantity ||
                typeof saved.unit_rate !== "number" || !Number.isFinite(saved.unit_rate) || typeof saved.line_total !== "number" || !Number.isFinite(saved.line_total)) {
                uncertain(); return;
            }
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== draft.line.estimate_id) return estimate;
                const rows = estimate.estimate_lines.map(line => line.id === id && JSON.stringify(line) === JSON.stringify(draft.line)
                    ? { ...line, quantity: saved.quantity!, unit_rate: saved.unit_rate!, line_total: saved.line_total! } : line);
                return { ...estimate, estimate_lines: rows, total_cost: rows.reduce((sum, line) => sum + (line.line_total || 0), 0) };
            }));
            rateConsumed.current = null; cancelRateDraft(draft);
            onLineSaveStateChanged?.(id, "confirmed"); showSaved();
        } catch { uncertain(); }
        finally {
            linePendingRef.current[id] = 0;
            if (catalogueMounted.current) {
                setRatePending(false);
                setPendingLineSaves(previous => { const next = new Set(previous); next.delete(id); return next; });
            }
        }
    };

    const editUnitDraft = (line: EstimateLine, raw: string, expected?: UnitDraft) => {
        if (deleteBlocked()) return;
        if (!catalogueMounted.current || lineTypeDraftRef.current || descriptionDraftRef.current || rateDraftRef.current || activityReviewRef.current || quantityDraftRef.current || catalogueReviewRef.current ||
            catalogueView.current.context !== catalogueContext || unitDraftRef.current !== (expected ?? null) || unitConsumed.current ||
            linePendingRef.current[line.id] > 0 || lineUncertainRef.current.has(line.id) || pendingResourceLinesRef.current.has(line.id) || applyingResourceLinesRef.current.has(line.id)) return;
        const current = currentEstimate?.estimate_lines.find(item => item.id === line.id);
        if ((!UNITS.includes(raw) && raw !== line.unit) || !current || currentEstimate?.project_id !== projectId || currentEstimate.is_client_boq || current.estimate_id !== currentEstimate.id ||
            current.pricing_mode !== "simple" || current.trade_section === "Preliminaries" || JSON.stringify(current) !== JSON.stringify(line) ||
            (expected && expected.context !== catalogueContext) ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).some(key => key !== `unit:${line.id}`) ||
            (!expected && draftResourceLinesRef.current.size > 0)) return;
        const draft = expected ? { ...expected, raw } : { line, raw, context: catalogueContext, projectId, orgId };
        unitDraftRef.current = draft; setUnitDraft(draft); setUnitMessage("");
        if (!expected) {
            draftResourceLinesRef.current.add(line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
            onResourceSaveStateChanged?.(`unit:${line.id}`, "draft");
        }
    };
    const cancelUnitDraft = (draft: UnitDraft) => {
        if (!catalogueMounted.current || unitDraftRef.current !== draft || unitConsumed.current === draft) return;
        unitDraftRef.current = null; setUnitDraft(null); setUnitMessage("");
        draftResourceLinesRef.current.delete(draft.line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`unit:${draft.line.id}`, "confirmed");
    };
    const saveUnitDraft = async (draft: UnitDraft) => {
        const id = draft.line.id;
        const fresh = () => catalogueMounted.current && unitDraftRef.current === draft && catalogueView.current.context === draft.context &&
            Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, status]) =>
                (key === `unit:${id}` && status === "draft") ||
                (key === `line:${id}` && status === "saving" && unitConsumed.current === draft));
        const unit = draft.raw;
        if (unitConsumed.current || !fresh() || (!UNITS.includes(unit) && unit !== draft.line.unit) ||
            linePendingRef.current[id] > 0 || lineUncertainRef.current.has(id) || pendingResourceLinesRef.current.has(id) || applyingResourceLinesRef.current.has(id)) {
            if (catalogueMounted.current && unitDraftRef.current === draft && !unitConsumed.current && !fresh()) setUnitMessage("The line or source changed. Your unit choice is retained; Cancel and review the saved values before starting again.");
            return;
        }
        if (unit === draft.line.unit) { cancelUnitDraft(draft); return; }
        unitConsumed.current = draft; setUnitPending(true); showSaving();
        linePendingRef.current[id] = 1; setPendingLineSaves(previous => new Set(previous).add(id));
        onLineSaveStateChanged?.(id, "saving");
        const uncertain = () => {
            if (!catalogueMounted.current || unitDraftRef.current !== draft) return;
            lineUncertainRef.current.add(id); setUncertainLineSaves(previous => new Set(previous).add(id));
            onLineSaveStateChanged?.(id, "uncertain");
            setUnitMessage("Unit save was not fully confirmed and may already have saved. Your exact unit choice is retained. Reload to reconcile before retrying.");
            showSaveError("Unit save not fully confirmed; reload before retrying.");
        };
        try {
            const result = await updateLineItemAction(id, { unit });
            const saved = result?.line;
            if (!fresh() || !result?.success || result.warning || !saved || saved.id !== id || saved.unit !== unit) {
                uncertain(); return;
            }
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== draft.line.estimate_id) return estimate;
                const rows = estimate.estimate_lines.map(line => line.id === id && JSON.stringify(line) === JSON.stringify(draft.line)
                    ? { ...line, unit } : line);
                return { ...estimate, estimate_lines: rows };
            }));
            unitConsumed.current = null; cancelUnitDraft(draft);
            onLineSaveStateChanged?.(id, "confirmed"); showSaved();
        } catch { uncertain(); }
        finally {
            linePendingRef.current[id] = 0;
            if (catalogueMounted.current) {
                setUnitPending(false);
                setPendingLineSaves(previous => { const next = new Set(previous); next.delete(id); return next; });
            }
        }
    };

    const editDescriptionDraft = (line: EstimateLine, raw: string, expected?: DescriptionDraft) => {
        if (deleteBlocked()) return;
        if (!catalogueMounted.current || lineTypeDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current || quantityDraftRef.current || catalogueReviewRef.current ||
            catalogueView.current.context !== catalogueContext || descriptionDraftRef.current !== (expected ?? null) || descriptionConsumed.current ||
            linePendingRef.current[line.id] > 0 || lineUncertainRef.current.has(line.id) || pendingResourceLinesRef.current.has(line.id) || applyingResourceLinesRef.current.has(line.id)) return;
        const current = currentEstimate?.estimate_lines.find(item => item.id === line.id);
        if (!current || currentEstimate?.project_id !== projectId || currentEstimate.is_client_boq || current.estimate_id !== currentEstimate.id ||
            current.pricing_mode !== "simple" || current.trade_section === "Preliminaries" || JSON.stringify(current) !== JSON.stringify(line) ||
            (expected && expected.context !== catalogueContext) ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).some(key => key !== `description:${line.id}`) ||
            (!expected && draftResourceLinesRef.current.size > 0)) return;
        const draft = expected ? { ...expected, raw } : { line, raw, context: catalogueContext, projectId, orgId };
        descriptionDraftRef.current = draft; setDescriptionDraft(draft); setDescriptionMessage("");
        if (!expected) {
            draftResourceLinesRef.current.add(line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
            onResourceSaveStateChanged?.(`description:${line.id}`, "draft");
        }
    };
    const cancelDescriptionDraft = (draft: DescriptionDraft) => {
        if (!catalogueMounted.current || descriptionDraftRef.current !== draft || descriptionConsumed.current === draft) return;
        descriptionDraftRef.current = null; setDescriptionDraft(null); setDescriptionMessage("");
        draftResourceLinesRef.current.delete(draft.line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`description:${draft.line.id}`, "confirmed");
    };
    const saveDescriptionDraft = async (draft: DescriptionDraft) => {
        const id = draft.line.id;
        const fresh = () => catalogueMounted.current && descriptionDraftRef.current === draft && catalogueView.current.context === draft.context &&
            Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, status]) =>
                (key === `description:${id}` && status === "draft") ||
                (key === `line:${id}` && status === "saving" && descriptionConsumed.current === draft));
        const description = draft.raw;
        if (descriptionConsumed.current || !fresh() ||
            linePendingRef.current[id] > 0 || lineUncertainRef.current.has(id) || pendingResourceLinesRef.current.has(id) || applyingResourceLinesRef.current.has(id)) {
            if (catalogueMounted.current && descriptionDraftRef.current === draft && !descriptionConsumed.current && !fresh()) setDescriptionMessage("The line or source changed. Your wording is retained; Cancel and review the saved values before starting again.");
            return;
        }
        if (description === draft.line.description) { cancelDescriptionDraft(draft); return; }
        descriptionConsumed.current = draft; setDescriptionPending(true); showSaving();
        linePendingRef.current[id] = 1; setPendingLineSaves(previous => new Set(previous).add(id));
        onLineSaveStateChanged?.(id, "saving");
        const uncertain = () => {
            if (!catalogueMounted.current || descriptionDraftRef.current !== draft) return;
            lineUncertainRef.current.add(id); setUncertainLineSaves(previous => new Set(previous).add(id));
            onLineSaveStateChanged?.(id, "uncertain");
            setDescriptionMessage("Description save was not fully confirmed and may already have saved. Your exact wording is retained. Reload to reconcile before retrying.");
            showSaveError("Description save not fully confirmed; reload before retrying.");
        };
        try {
            const result = await updateLineItemAction(id, { description });
            const saved = result?.line;
            if (!fresh() || !result?.success || result.warning || !saved || saved.id !== id || saved.description !== description) {
                uncertain(); return;
            }
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== draft.line.estimate_id) return estimate;
                const rows = estimate.estimate_lines.map(line => line.id === id && JSON.stringify(line) === JSON.stringify(draft.line)
                    ? { ...line, description } : line);
                return { ...estimate, estimate_lines: rows };
            }));
            descriptionConsumed.current = null; cancelDescriptionDraft(draft);
            onLineSaveStateChanged?.(id, "confirmed"); showSaved();
        } catch { uncertain(); }
        finally {
            linePendingRef.current[id] = 0;
            if (catalogueMounted.current) {
                setDescriptionPending(false);
                setPendingLineSaves(previous => { const next = new Set(previous); next.delete(id); return next; });
            }
        }
    };

    const editLineTypeDraft = (line: EstimateLine, raw: string, expected?: LineTypeDraft) => {
        if (deleteBlocked()) return;
        if (!catalogueMounted.current || unitDraftRef.current || descriptionDraftRef.current || rateDraftRef.current || activityReviewRef.current || quantityDraftRef.current || catalogueReviewRef.current ||
            catalogueView.current.context !== catalogueContext || lineTypeDraftRef.current !== (expected ?? null) || lineTypeConsumed.current ||
            linePendingRef.current[line.id] > 0 || lineUncertainRef.current.has(line.id) || pendingResourceLinesRef.current.has(line.id) || applyingResourceLinesRef.current.has(line.id)) return;
        const current = currentEstimate?.estimate_lines.find(item => item.id === line.id);
        if (typeof line.line_type !== "string" || (!LINE_TYPES.includes(raw) && raw !== line.line_type) || !current || currentEstimate?.project_id !== projectId || currentEstimate.is_client_boq || current.estimate_id !== currentEstimate.id ||
            current.pricing_mode !== "simple" || current.trade_section === "Preliminaries" || JSON.stringify(current) !== JSON.stringify(line) ||
            (expected && expected.context !== catalogueContext) ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).some(key => key !== `line-type:${line.id}`) ||
            (!expected && draftResourceLinesRef.current.size > 0)) return;
        const draft = expected ? { ...expected, raw } : { line, raw, context: catalogueContext, projectId, orgId };
        lineTypeDraftRef.current = draft; setLineTypeDraft(draft); setLineTypeMessage("");
        if (!expected) {
            draftResourceLinesRef.current.add(line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
            onResourceSaveStateChanged?.(`line-type:${line.id}`, "draft");
        }
    };
    const cancelLineTypeDraft = (draft: LineTypeDraft) => {
        if (!catalogueMounted.current || lineTypeDraftRef.current !== draft || lineTypeConsumed.current === draft) return;
        lineTypeDraftRef.current = null; setLineTypeDraft(null); setLineTypeMessage("");
        draftResourceLinesRef.current.delete(draft.line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`line-type:${draft.line.id}`, "confirmed");
    };
    const saveLineTypeDraft = async (draft: LineTypeDraft) => {
        const id = draft.line.id;
        const fresh = () => catalogueMounted.current && lineTypeDraftRef.current === draft && catalogueView.current.context === draft.context &&
            Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, status]) =>
                (key === `line-type:${id}` && status === "draft") ||
                (key === `line:${id}` && status === "saving" && lineTypeConsumed.current === draft));
        const lineType = draft.raw;
        if (lineTypeConsumed.current || !fresh() || (!LINE_TYPES.includes(lineType) && lineType !== draft.line.line_type) ||
            linePendingRef.current[id] > 0 || lineUncertainRef.current.has(id) || pendingResourceLinesRef.current.has(id) || applyingResourceLinesRef.current.has(id)) {
            if (catalogueMounted.current && lineTypeDraftRef.current === draft && !lineTypeConsumed.current && !fresh()) setLineTypeMessage("The line or source changed. Your line-type choice is retained; Cancel and review the saved values before starting again.");
            return;
        }
        if (lineType === draft.line.line_type) { cancelLineTypeDraft(draft); return; }
        lineTypeConsumed.current = draft; setLineTypePending(true); showSaving();
        linePendingRef.current[id] = 1; setPendingLineSaves(previous => new Set(previous).add(id));
        onLineSaveStateChanged?.(id, "saving");
        const uncertain = () => {
            if (!catalogueMounted.current || lineTypeDraftRef.current !== draft) return;
            lineUncertainRef.current.add(id); setUncertainLineSaves(previous => new Set(previous).add(id));
            onLineSaveStateChanged?.(id, "uncertain");
            setLineTypeMessage("Line type save was not fully confirmed and may already have saved. Your exact line-type choice is retained. Reload to reconcile before retrying.");
            showSaveError("Line type save not fully confirmed; reload before retrying.");
        };
        try {
            const result = await updateLineItemAction(id, { line_type: lineType });
            const saved = result?.line;
            if (!fresh() || !result?.success || result.warning || !saved || saved.id !== id || saved.line_type !== lineType) {
                uncertain(); return;
            }
            setEstimates(previous => previous.map(estimate => {
                if (estimate.id !== draft.line.estimate_id) return estimate;
                const rows = estimate.estimate_lines.map(line => line.id === id && JSON.stringify(line) === JSON.stringify(draft.line)
                    ? { ...line, line_type: lineType } : line);
                return { ...estimate, estimate_lines: rows };
            }));
            lineTypeConsumed.current = null; cancelLineTypeDraft(draft);
            onLineSaveStateChanged?.(id, "confirmed"); showSaved();
        } catch { uncertain(); }
        finally {
            linePendingRef.current[id] = 0;
            if (catalogueMounted.current) {
                setLineTypePending(false);
                setPendingLineSaves(previous => { const next = new Set(previous); next.delete(id); return next; });
            }
        }
    };

    const beginActivityReview = (line: EstimateLine) => {
        if (deleteBlocked()) return false;
        if (!catalogueMounted.current || catalogueView.current.context !== catalogueContext || lineTypeDraftRef.current || descriptionDraftRef.current || unitDraftRef.current || rateDraftRef.current || activityReviewRef.current ||
            quantityDraftRef.current || catalogueReviewRef.current || draftResourceLinesRef.current.size || addingSectionsRef.current.size ||
            Object.keys(catalogueView.current.resourceSaveStates ?? {}).length || Object.values(linePendingRef.current).some(count => count > 0) ||
            lineUncertainRef.current.size || pendingResourceLinesRef.current.size || applyingResourceLinesRef.current.size ||
            !currentEstimate || currentEstimate.project_id !== projectId || currentEstimate.is_client_boq ||
            line.estimate_id !== currentEstimate.id || line.pricing_mode !== "simple" || line.trade_section === "Preliminaries" ||
            !currentEstimate.estimate_lines.includes(line)) return false;
        const review: ActivityReview = { line, context: catalogueContext, projectId, orgId, raw: line.trade_section ?? "", phase: "editing", message: "" };
        activityReviewRef.current = review; setActivityReview(review);
        draftResourceLinesRef.current.add(line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`activity:${line.id}`, "draft");
        return true;
    };
    const activityFresh = (review: ActivityReview) => catalogueMounted.current && activityReviewRef.current === review &&
        catalogueView.current.context === review.context &&
        Object.entries(catalogueView.current.resourceSaveStates ?? {}).every(([key, state]) =>
            key === `activity:${review.line.id}` && (state === "draft" || (state === "saving" && review.phase === "saving")));
    const publishActivityReview = (review: ActivityReview, next: ActivityReview) => {
        if (!catalogueMounted.current || activityReviewRef.current !== review) return;
        activityReviewRef.current = next; setActivityReview(next);
        onResourceSaveStateChanged?.(`activity:${review.line.id}`, next.phase === "editing" ? "draft" : next.phase);
    };
    const closeActivityReview = (review: ActivityReview, confirmed = false) => {
        if (!catalogueMounted.current || activityReviewRef.current !== review || (!confirmed && review.phase !== "editing")) return;
        activityReviewRef.current = null; setActivityReview(null);
        draftResourceLinesRef.current.delete(review.line.id); setDraftResourceLines(new Set(draftResourceLinesRef.current));
        onResourceSaveStateChanged?.(`activity:${review.line.id}`, "confirmed");
    };
    const editActivityReview = (review: ActivityReview, raw: string) => {
        if (review.phase !== "editing" || !activityFresh(review)) return;
        publishActivityReview(review, { ...review, raw, message: "" });
    };
    const saveActivity = async (review: ActivityReview) => {
        if (!catalogueMounted.current || activityReviewRef.current !== review || review.phase !== "editing") return;
        if (!activityFresh(review) || linePendingRef.current[review.line.id] > 0 || pendingResourceLinesRef.current.has(review.line.id) || applyingResourceLinesRef.current.has(review.line.id)) {
            publishActivityReview(review, { ...review, message: "The line or estimate changed. Your text is retained. Cancel and review the current activity before saving." }); return;
        }
        const section = review.raw.trim();
        if (!section || section.length > 100) return;
        const pending: ActivityReview = { ...review, phase: "saving", message: "" };
        publishActivityReview(review, pending);
        const uncertain = () => publishActivityReview(pending, { ...pending, phase: "uncertain", message: "The activity may have saved. Your exact text is retained. Reload to reconcile it before retrying." });
        try {
            const result = await savePriceLineActivityAction({ lineId: review.line.id, estimateId: review.line.estimate_id,
                expectedSection: review.line.trade_section ?? null, section });
            if (!catalogueMounted.current || activityReviewRef.current !== pending) return;
            if (!activityFresh(pending)) { uncertain(); return; }
            if (!result.ok) {
                if (result.uncertain) uncertain();
                else publishActivityReview(pending, { ...pending, phase: "editing", message: result.error });
                return;
            }
            if (result.lineId !== review.line.id || result.estimateId !== review.line.estimate_id || result.section !== section || result.section === "Preliminaries") { uncertain(); return; }
            setEstimates(previous => previous.map(estimate => estimate.id !== result.estimateId ? estimate : {
                ...estimate, estimate_lines: estimate.estimate_lines.map(line => line.id === result.lineId && JSON.stringify(line) === JSON.stringify(review.line)
                    ? { ...line, trade_section: result.section } : line),
            }));
            closeActivityReview(pending, true);
        } catch { uncertain(); }
    };

    // ─── Build-Up Handlers ───────────────────────────────
    const handleTogglePricingMode = (lineId: string, currentMode: string) => {
        if (deleteBlocked()) return;
        if (lineTypeDraftRef.current?.line.id === lineId || descriptionDraftRef.current?.line.id === lineId || unitDraftRef.current?.line.id === lineId || rateDraftRef.current?.line.id === lineId || activityReviewRef.current?.line.id === lineId || quantityDraftRef.current?.line.id === lineId || draftResourceLinesRef.current.has(lineId)) return;
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

    const handleComponentsChanged = (lineId: string, components: EstimateLineComponent[]) => {
        if (deleteBlocked()) return;
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
                        };
                    }),
                };
            })
        );
    };

    const handleRateApplied = (lineId: string, unitRate: number, quantity: number, lineTotal: number) => {
        if (deleteBlocked()) return;
        setEstimates(previous => previous.map(estimate => {
            if (estimate.id !== currentEstimate?.id) return estimate;
            const updatedLines = estimate.estimate_lines.map(line => line.id === lineId && line.quantity === quantity
                ? { ...line, unit_rate: unitRate, line_total: lineTotal }
                : line);
            return { ...estimate, estimate_lines: updatedLines, total_cost: updatedLines.reduce((sum, line) => sum + (line.line_total || 0), 0) };
        }));
    };

    const lines = currentEstimate?.estimate_lines || [];
    const activityInView = !!activityReview && activityReview.projectId === projectId && activityReview.orgId === orgId &&
        currentEstimate?.project_id === projectId && currentEstimate.id === activityReview.line.estimate_id &&
        lines.some(line => line.id === activityReview.line.id && line.estimate_id === activityReview.line.estimate_id);
    const rateInView = !!rateDraft && rateDraft.projectId === projectId && rateDraft.orgId === orgId &&
        currentEstimate?.project_id === projectId && currentEstimate.id === rateDraft.line.estimate_id &&
        lines.some(line => line.id === rateDraft.line.id && line.estimate_id === rateDraft.line.estimate_id);
    const unitInView = !!unitDraft && unitDraft.projectId === projectId && unitDraft.orgId === orgId &&
        currentEstimate?.project_id === projectId && currentEstimate.id === unitDraft.line.estimate_id &&
        lines.some(line => line.id === unitDraft.line.id && line.estimate_id === unitDraft.line.estimate_id);
    const lineTypeInView = !!lineTypeDraft && lineTypeDraft.projectId === projectId && lineTypeDraft.orgId === orgId &&
        currentEstimate?.project_id === projectId && currentEstimate.id === lineTypeDraft.line.estimate_id &&
        lines.some(line => line.id === lineTypeDraft.line.id && line.estimate_id === lineTypeDraft.line.estimate_id);
    const descriptionInView = !!descriptionDraft && descriptionDraft.projectId === projectId && descriptionDraft.orgId === orgId &&
        currentEstimate?.project_id === projectId && currentEstimate.id === descriptionDraft.line.estimate_id &&
        lines.some(line => line.id === descriptionDraft.line.id && line.estimate_id === descriptionDraft.line.estimate_id);
    // Filter out blank lines for display
    const displayLines = lines.filter(l => l.description && l.description !== "" && l.description !== "\u2014");

    // Group lines by trade section (only display lines with descriptions)
    // Contractor names must not collide with inherited object keys.
    const sectionGroups: Record<string, EstimateLine[]> = Object.create(null);
    lines.forEach((l) => {
        // Keep the open editor mounted if an external activity change moves its row.
        const sec = (activityReview?.line.id === l.id ? activityReview.line.trade_section : l.trade_section) || "General";
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
            {!deleteReceipt && retainedDeletes.length > 0 && <section aria-label="Retained removal reconciliation" className="rounded-xl border border-amber-700 p-4 space-y-2 text-sm text-slate-200">
                <p>A previous Remove is pending or unconfirmed and may already have deleted the row remotely. Current work stays read-only; reload to reconcile. No retry or refresh starts automatically.</p>
                {retainedDeletes.map(([key, state]) => <p key={key}>Row identity: {key.slice("delete:".length)}. Retained acknowledgement: {state}.</p>)}
            </section>}
            {deleteReceipt && <section aria-label="Remove line acknowledgement" data-delete-phase={deleteReceipt.phase} className="rounded-xl border border-slate-700 p-4 space-y-2 text-sm text-slate-200">
                <p className="font-semibold">Remove line status</p>
                <p>Reviewed line: {deleteReceipt.line.description}. Activity: {deleteReceipt.line.trade_section || "General"}.</p>
                <p>Row identity: {deleteReceipt.line.id}. Estimate: {deleteReceipt.line.estimate_id}.</p>
                <p role="status">{deleteReceipt.message}</p>
            </section>}
            {addReceipts.length > 0 && <section aria-label="Add line acknowledgements" className="rounded-xl border border-slate-700 p-4 space-y-2 text-sm text-slate-200">
                <p className="font-semibold">Add line status</p>
                {addReceipts.map(receipt => <div key={receipt.key} data-add-receipt={receipt.key} data-add-phase={receipt.phase} role="status">
                    <p>Activity: {receipt.section}. Estimate: {receipt.estimateId}.</p>
                    <p>{receipt.message}</p>
                    {receipt.returnedId && <p>Returned row identity: {receipt.returnedId}</p>}
                </div>)}
            </section>}
            {lineTypeDraft && !lineTypeInView && <section data-retained-line-type={lineTypeDraft.line.id} aria-label="Retained line-type review" className="rounded-xl border border-amber-700 p-4 space-y-3 text-sm text-slate-200">
                <h3 className="font-semibold">Line-type choice retained</h3>
                <p>The reviewed line or estimate is not available here. The exact choice stays read-only; no row is recreated and no save or retry starts.</p>
                <p>Reviewed line: {lineTypeDraft.line.description}. Saved type: {JSON.stringify(lineTypeDraft.line.line_type)}.</p>
                <label className="block">Retained line type<input aria-label="Retained line type" readOnly value={lineTypeDraft.raw} className={`${activityStyles.input} mt-2 w-full`} /></label>
                <p role="status">{lineTypePending ? "The original type save awaits acknowledgement and may already have saved." : lineTypeMessage || "This choice has not been saved."}</p>
                <button type="button" disabled={lineTypePending || uncertainLineSaves.has(lineTypeDraft.line.id)} className={activityStyles.quietButton} onClick={() => cancelLineTypeDraft(lineTypeDraft)}>Cancel retained line-type review</button>
            </section>}
            {descriptionDraft && !descriptionInView && <section data-retained-description={descriptionDraft.line.id} aria-label="Retained description draft" className="rounded-xl border border-amber-700 p-4 space-y-3 text-sm text-slate-200">
                <h3 className="font-semibold">Description draft retained</h3>
                <p>The reviewed line or estimate is not available here. Exact wording stays read-only; no row is recreated and no save or retry starts.</p>
                <p>Reviewed line: {descriptionDraft.line.description}</p>
                <label className="block">Retained description<textarea aria-label="Retained description" readOnly value={descriptionDraft.raw} className={`${activityStyles.input} mt-2 w-full`} /></label>
                <p role="status">{descriptionPending ? "The original description save awaits acknowledgement and may already have saved." : descriptionMessage || "This wording has not been saved."}</p>
                <button type="button" disabled={descriptionPending || uncertainLineSaves.has(descriptionDraft.line.id)} className={activityStyles.quietButton} onClick={() => cancelDescriptionDraft(descriptionDraft)}>Cancel retained description draft</button>
            </section>}
            {unitDraft && !unitInView && <section data-retained-unit={unitDraft.line.id} aria-label="Retained unit draft" className="rounded-xl border border-amber-700 p-4 space-y-3 text-sm text-slate-200">
                <h3 className="font-semibold">Unit draft retained</h3>
                <p>The reviewed line or estimate is not available in this view. Your exact unit choice is retained, read-only. No row is recreated and no save or retry starts.</p>
                <p>Reviewed line: {unitDraft.line.description}. Saved unit: {JSON.stringify(unitDraft.line.unit)}.</p>
                <label className="block">Retained unit choice<input aria-label="Retained unit choice" readOnly value={unitDraft.raw} className={`${activityStyles.input} mt-2 w-full`} /></label>
                <p role="status">{unitPending ? "The original unit save is still awaiting acknowledgement and may already have saved." : unitMessage || "This unit draft has not been saved."}</p>
                <button type="button" disabled={unitPending || uncertainLineSaves.has(unitDraft.line.id)} className={activityStyles.quietButton} onClick={() => cancelUnitDraft(unitDraft)}>Cancel retained unit draft</button>
            </section>}
            {rateDraft && !rateInView && <section data-retained-rate={rateDraft.line.id} aria-label="Retained rate draft" className="rounded-xl border border-amber-700 p-4 space-y-3 text-sm text-slate-200">
                <h3 className="font-semibold">Rate draft retained</h3>
                <p>The reviewed line or estimate is not available in this view. Your exact rate text is retained, read-only. No row is recreated and no save or retry starts.</p>
                <p>Reviewed line: {rateDraft.line.description}. Saved rate: GBP {String(rateDraft.line.unit_rate)}.</p>
                <label className="block">Retained rate text<input aria-label="Retained rate text" readOnly value={rateDraft.raw} className={`${activityStyles.input} mt-2 w-full`} /></label>
                <p role="status">{ratePending ? "The original rate save is still awaiting acknowledgement and may already have saved." : rateMessage || "This rate draft has not been saved."}</p>
                <button type="button" disabled={ratePending || uncertainLineSaves.has(rateDraft.line.id)} className={activityStyles.quietButton} onClick={() => cancelRateDraft(rateDraft)}>Cancel retained rate draft</button>
            </section>}
            {activityReview && !activityInView && <section data-retained-activity={activityReview.line.id} aria-label="Retained activity draft" className="rounded-xl border border-amber-700 p-4 space-y-3 text-sm text-slate-200">
                <h3 className="font-semibold">Activity draft retained</h3>
                <p>The reviewed line or estimate is not available in this view. Your exact text is kept here, read-only. No missing row is recreated and no save or retry is started.</p>
                <p>Reviewed line: {activityReview.line.description}</p>
                <label className="block">Retained activity text<textarea aria-label="Retained activity text" readOnly value={activityReview.raw} className={`${activityStyles.input} mt-2 w-full`} /></label>
                <p role="status">{activityReview.phase === "saving" ? "The original save is still awaiting acknowledgement. It may already have saved." : activityReview.phase === "uncertain" ? "Save not confirmed. Reload to reconcile before retrying." : "This draft has not been saved. Cancel discards only this activity draft."}</p>
                <button type="button" className={activityStyles.quietButton} disabled={activityReview.phase !== "editing"} onClick={() => closeActivityReview(activityReview)}>Cancel retained activity draft</button>
                {activityReview.message && <p role="alert">{activityReview.message}</p>}
            </section>}
            {/* VERSION MANAGEMENT */}
            {currentEstimate && (
                <p className={ui.versionCurrent} data-advanced-current-estimate>
                    {estimates.length > 1 ? <>Pricing: <strong>{currentEstimate.version_name || "Estimate"}</strong>.{" "}</> : "Current estimate. "}
                    {currentEstimate.is_active ? "Used in the proposal." : "Alternative; not used in the proposal."}
                </p>
            )}
            {estimates.length > 0 && (
                <details className={ui.versionDisclosure} data-advanced-estimate-versions>
                    <summary className={ui.versionSummary}>Estimate versions and alternatives</summary>
                    <div className={ui.versionBody}>
                        <p>Optional. Keep a separate price for another option. Adding an alternative starts an empty estimate; it does not copy or replace this one.</p>
                        <div className={ui.versionTabs}>
                {estimates.map((est) => (
                    <button
                        type="button"
                        key={est.id}
                        aria-pressed={activeTab === est.id}
                        disabled={draftResourceLines.size > 0}
                        onClick={() => { if (!lineTypeDraftRef.current && !descriptionDraftRef.current && !unitDraftRef.current && !rateDraftRef.current && !activityReviewRef.current && !quantityDraftRef.current && draftResourceLinesRef.current.size === 0) setActiveTab(est.id); }}
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
                                disabled={draftResourceLines.size > 0}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--price-accent)] text-[var(--price-accent-text)] transition-colors flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Add an alternative
                            </button>
                        </div>
                        {currentEstimate && (
                            <div className="space-y-3">
                            <div className={ui.versionName}>
                                <label htmlFor={`estimate-name-${currentEstimate.id}`} className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Version name</label>
                                <input
                                    key={currentEstimate.id}
                                    id={`estimate-name-${currentEstimate.id}`}
                                    aria-label="Estimate Name"
                                    type="text"
                                    defaultValue={currentEstimate.version_name}
                                    onBlur={(e) => handleNameBlur(e.target.value)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                                <p>Changing the name saves when you leave the field. Selecting a version to view does not change which one is used in the proposal.</p>
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
                                    disabled={draftResourceLines.size > 0}
                                    aria-label="Delete this estimate"
                                    className="h-10 px-3 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            </div>
                        )}
                    </div>
                </details>
            )}
            <div className="flex items-center gap-2 flex-wrap">
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
                <div className="ml-auto text-xs text-slate-400 flex items-center gap-1.5">
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
                        <span className="text-red-400">{uncertainLineSaves.size > 0 ? "Line save not confirmed - reload to reconcile" : "Save failed — retry"}</span>
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
                        <p className="text-xs text-slate-600">Start detailed pricing to build a bill of quantities, or close Advanced estimating to return to simple price lines.</p>
                        <button type="button" onClick={handleCreateEstimate} className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--price-accent)] text-[var(--price-accent-text)]">Start detailed pricing</button>
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
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Prelims %</label>
                                <input
                                    aria-label="Prelims %"
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.prelims_pct}
                                    onChange={(e) => handleMarginChange("prelims_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("prelims_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Overhead %</label>
                                <input
                                    aria-label="Overhead %"
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.overhead_pct}
                                    onChange={(e) => handleMarginChange("overhead_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("overhead_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Risk %</label>
                                <input
                                    aria-label="Risk %"
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.risk_pct}
                                    onChange={(e) => handleMarginChange("risk_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("risk_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Profit %</label>
                                <input
                                    aria-label="Profit %"
                                    type="number"
                                    step="0.5"
                                    value={currentEstimate.profit_pct}
                                    onChange={(e) => handleMarginChange("profit_pct", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleMarginBlur("profit_pct", parseFloat(e.target.value) || 0)}
                                    className="w-full h-10 px-3 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-100 text-sm text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Discount %</label>
                                <input
                                    aria-label="Discount %"
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
                        </div>
                        {currentEstimate.discount_pct > 0 && (
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Discount Reason</label>
                                <input
                                    aria-label="Discount Reason"
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

                    <EstimateActivityEntry
                        key={currentEstimate.id}
                        activeSections={activeSections}
                        commonNames={TRADE_SECTIONS}
                        onAddActivity={handleAddLine}
                        blockedNames={addReceipts.filter(receipt => receipt.estimateId === currentEstimate.id && receipt.phase !== "confirmed").map(receipt => receipt.section)}
                    />

                    {/* TRADE SECTIONS */}
                    {activeSections.map((section) => {
                        const sectionLines = sectionGroups[section] || [];
                        const sectionTotal = sectionLines.reduce((s, l) => s + (l.line_total || 0), 0);
                        const sectionLibrary = costLibrary.filter(
                            (c) => c.category === section || section === "General"
                        );

                        return (
                            <div key={section} role="group" aria-label={section} className="bg-slate-800/50 border border-slate-700/50 rounded-xl" style={{ overflow: "visible" }}>
                                {/* Section header */}
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-900/50 border-b border-slate-700/50 rounded-t-xl">
                                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">{section}</h3>
                                    <span className="font-bold text-sm text-slate-100">{formatGBP(sectionTotal)}</span>
                                </div>

                                {/* Table header */}
                                {currentEstimate.is_client_boq ? (
                                    <div className="grid grid-cols-[50px_1fr_80px_80px_100px_100px_40px] gap-2 px-5 py-2 bg-slate-900/30 border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        <div>Ref</div>
                                        <div>Description</div>
                                        <div className="text-center">Qty</div>
                                        <div className="text-center">Unit</div>
                                        <div className="text-right">Rate</div>
                                        <div className="text-right">Total</div>
                                        <div></div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[70px_1fr_80px_80px_100px_100px_40px] gap-2 px-5 py-2 bg-slate-900/30 border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                                                        data-resource-disclosure={line.id}
                                                        aria-label={`View resources: ${line.description || "unnamed line"}`}
                                                        aria-expanded={openBuildUpPanels.has(line.id)}
                                                        disabled={lineTypeDraft?.line.id === line.id || descriptionDraft?.line.id === line.id || unitDraft?.line.id === line.id || rateDraft?.line.id === line.id || activityReview?.line.id === line.id || quantityDraft?.line.id === line.id || draftResourceLines.has(line.id) || pendingResourceLines.has(line.id)}
                                                        onClick={() => {
                                                            if (lineTypeDraftRef.current?.line.id === line.id || descriptionDraftRef.current?.line.id === line.id || unitDraftRef.current?.line.id === line.id || rateDraftRef.current?.line.id === line.id || activityReviewRef.current?.line.id === line.id || quantityDraftRef.current?.line.id === line.id || draftResourceLinesRef.current.has(line.id) || pendingResourceLinesRef.current.has(line.id)) return;
                                                            setOpenBuildUpPanels(previous => {
                                                            const next = new Set(previous);
                                                            if (next.has(line.id)) next.delete(line.id); else next.add(line.id);
                                                            return next;
                                                            });
                                                        }}
                                                        title={openBuildUpPanels.has(line.id) ? "Close resources" : "View resources"}
                                                        className={`flex-shrink-0 w-5 h-5 rounded text-xs font-bold border transition-colors ${
                                                            openBuildUpPanels.has(line.id)
                                                                ? "bg-emerald-200 text-emerald-950 border-emerald-200"
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
                                                    saveBlocked={deleteWorkOpen || lineTypeDraft?.line.id === line.id || descriptionDraft?.line.id === line.id || unitDraft?.line.id === line.id || rateDraft?.line.id === line.id || activityReview?.line.id === line.id || quantityDraft?.line.id === line.id || draftResourceLines.has(line.id) || uncertainLineSaves.has(line.id) || resourceSaveStates?.[`line:${line.id}`] === "uncertain" || applyingResourceLines.has(line.id)}
                                                    savePending={pendingLineSaves.has(line.id) || pendingResourceLines.has(line.id) || applyingResourceLines.has(line.id)}
                                                    onUpdate={handleUpdateLine}
                                                    onDelete={handleDeleteLine}
                                                    onLibrarySelect={handleLibrarySelect}
                                                    quantityDraft={quantityDraft?.line.id === line.id ? quantityDraft : undefined}
                                                    quantityPending={quantityPending || !!lineTypeDraft || !!descriptionDraft || !!unitDraft || !!rateDraft || (!!quantityDraft && quantityDraft.line.id !== line.id)}
                                                    quantityConsumed={!!quantityDraft && uncertainLineSaves.has(line.id)}
                                                    quantityMessage={quantityDraft?.line.id === line.id ? quantityMessage : ""}
                                                    onQuantityChange={editQuantityDraft}
                                                    onQuantitySave={saveQuantityDraft}
                                                    onQuantityCancel={cancelQuantityDraft}
                                                    rateDraft={rateInView && rateDraft?.line.id === line.id ? rateDraft : undefined}
                                                    ratePending={ratePending || !!lineTypeDraft || !!descriptionDraft || !!unitDraft || (!!rateDraft && rateDraft.line.id !== line.id)}
                                                    rateConsumed={!!rateDraft && uncertainLineSaves.has(line.id)}
                                                    rateMessage={rateDraft?.line.id === line.id ? rateMessage : ""}
                                                    onRateChange={editRateDraft}
                                                    onRateSave={saveRateDraft}
                                                    onRateCancel={cancelRateDraft}
                                                    unitDraft={unitInView && unitDraft?.line.id === line.id ? unitDraft : undefined}
                                                    unitPending={unitPending || !!lineTypeDraft || !!descriptionDraft || (!!unitDraft && unitDraft.line.id !== line.id)}
                                                    unitConsumed={!!unitDraft && uncertainLineSaves.has(line.id)}
                                                    unitMessage={unitDraft?.line.id === line.id ? unitMessage : ""}
                                                    onUnitChange={editUnitDraft}
                                                    onUnitSave={saveUnitDraft}
                                                    onUnitCancel={cancelUnitDraft}
                                                    descriptionDraft={descriptionInView && descriptionDraft?.line.id === line.id ? descriptionDraft : undefined}
                                                    descriptionPending={descriptionPending || !!lineTypeDraft || (!!descriptionDraft && descriptionDraft.line.id !== line.id)}
                                                    descriptionConsumed={!!descriptionDraft && uncertainLineSaves.has(line.id)}
                                                    descriptionMessage={descriptionDraft?.line.id === line.id ? descriptionMessage : ""}
                                                    onDescriptionChange={editDescriptionDraft}
                                                    onDescriptionSave={saveDescriptionDraft}
                                                    onDescriptionCancel={cancelDescriptionDraft}
                                                    lineTypeDraft={lineTypeInView && lineTypeDraft?.line.id === line.id ? lineTypeDraft : undefined}
                                                    lineTypePending={lineTypePending || (!!lineTypeDraft && lineTypeDraft.line.id !== line.id)}
                                                    lineTypeConsumed={!!lineTypeDraft && uncertainLineSaves.has(line.id)}
                                                    lineTypeMessage={lineTypeDraft?.line.id === line.id ? lineTypeMessage : ""}
                                                    onLineTypeChange={editLineTypeDraft}
                                                    onLineTypeSave={saveLineTypeDraft}
                                                    onLineTypeCancel={cancelLineTypeDraft}
                                                    activityOpen={activityInView && activityReview?.line.id === line.id}
                                                    activity={activityReview?.line.id === line.id || (!currentEstimate.is_client_boq && line.pricing_mode === "simple" && section !== "Preliminaries") ? {
                                                        lineId: line.id, section: line.trade_section ?? null,
                                                        choices: [...new Set(lines.map(row => row.trade_section || "General"))].filter(name => name !== "Preliminaries" && name.trim().length > 0 && name.length <= 100),
                                                        review: activityInView && activityReview?.line.id === line.id ? activityReview : undefined,
                                                        blocked: !(activityInView && activityReview?.line.id === line.id) && (!!activityReview || Object.keys(resourceSaveStates ?? {}).length > 0),
                                                        onBegin: () => beginActivityReview(line),
                                                        onChange: raw => { if (activityReview) editActivityReview(activityReview, raw); },
                                                        onSave: async () => { if (activityReview) await saveActivity(activityReview); },
                                                        onCancel: () => { if (activityReview) closeActivityReview(activityReview); },
                                                        helpText: "Use your own activity name or a current estimate activity, up to 100 characters. Only this line's activity changes; its price and resources stay unchanged. Client BoQ, built-up and Preliminaries lines are not assigned by this control.",
                                                    } : undefined}
                                                />
                                                {activityReview?.line.id === line.id && line.trade_section !== activityReview.line.trade_section && <p role="status" className="px-5 py-2 text-sm text-amber-200">The saved activity changed. This review stays in its original group to retain your text; Cancel and review the current activity before saving.</p>}
                                                {catalogueReview?.line.id === line.id && <section data-catalogue-review={line.id} aria-label="Review catalogue rate" className="m-3 rounded-lg border border-emerald-700 p-4 space-y-2 text-sm text-slate-200">
                                                    <h4 className="font-semibold">Review catalogue rate before saving</h4>
                                                    <p>{catalogueReview.item.code}: {catalogueReview.item.description}</p>
                                                    <p>Stored unit: {catalogueReview.item.unit}. Stored rate: GBP {String(catalogueReview.item.base_rate)}. Retained line quantity: {String(catalogueReview.line.quantity)}.</p>
                                                    <p>Only this line&apos;s description, unit and rate change. No quantity conversion, resources or activity are copied. Current confirmed line total: GBP {String(catalogueReview.line.line_total)}.</p>
                                                    <button type="button" disabled={cataloguePending || !!catalogueMessage} onClick={() => void saveCatalogueReview(catalogueReview)} className="rounded border border-emerald-700 px-3 py-2">Save catalogue choice</button>
                                                    <button type="button" disabled={cataloguePending || uncertainLineSaves.has(line.id)} onClick={() => closeCatalogueReview(catalogueReview)} className="rounded border border-slate-600 px-3 py-2">Cancel catalogue review</button>
                                                    {catalogueMessage && <p role="status">{catalogueMessage}</p>}
                                                </section>}
                                                {(uncertainLineSaves.has(line.id) || resourceSaveStates?.[`line:${line.id}`] === "uncertain") && <p role="alert" className="px-5 py-3 text-sm text-red-200">Line save not confirmed. Some changes may already have saved. Reload the estimate to reconcile this line before editing or applying resources.</p>}
                                            </div>
                                        </div>
                                        {/* Build-up panel — only shown when explicitly toggled, not on page load */}
                                        {openBuildUpPanels.has(line.id) && (
                                            <div>
                                                <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs text-slate-300">
                                                    <button type="button"
                                                        onClick={() => handleTogglePricingMode(line.id, line.pricing_mode)}
                                                        title={line.pricing_mode === "buildup" ? "Switch to simple rate" : "Build up from first principles"}
                                                        className="rounded border border-emerald-700 px-3 py-2 text-emerald-200">
                                                        {line.pricing_mode === "buildup" ? "Use an all-in rate" : "Use a built-up rate"}
                                                    </button>
                                                    <span>Viewing resources does not change pricing mode. Resource edits and Apply rate keep their existing save actions.</span>
                                                </div>
                                            <BuildUpPanel
                                                line={line}
                                                orgId={orgId}
                                                labourRates={labourRates}
                                                rateBuildups={rateBuildups}
                                                materialLibrary={costLibrary}
                                                preferredTrades={preferredTrades}
                                                onComponentsChanged={handleComponentsChanged}
                                                onDraftChanged={(lineId, open) => {
                                                    if (open) draftResourceLinesRef.current.add(lineId);
                                                    else draftResourceLinesRef.current.delete(lineId);
                                                    setDraftResourceLines(new Set(draftResourceLinesRef.current));
                                                    onResourceSaveStateChanged?.(`draft:${lineId}`, open ? "draft" : "confirmed");
                                                }}
                                                onRateApplied={handleRateApplied}
                                                saveBlocked={deleteWorkOpen || lineTypeDraft?.line.id === line.id || descriptionDraft?.line.id === line.id || unitDraft?.line.id === line.id || rateDraft?.line.id === line.id || activityReview?.line.id === line.id || quantityDraft?.line.id === line.id || catalogueReview?.line.id === line.id || uncertainResourceLines.has(line.id) || resourceSaveStates?.[line.id] === "uncertain" || uncertainLineSaves.has(line.id) || resourceSaveStates?.[`line:${line.id}`] === "uncertain"}
                                                priceSavePending={pendingLineSaves.has(line.id)}
                                                canApplyRate={() => !deleteBlocked() && lineTypeDraftRef.current?.line.id !== line.id && descriptionDraftRef.current?.line.id !== line.id && unitDraftRef.current?.line.id !== line.id && rateDraftRef.current?.line.id !== line.id && activityReviewRef.current?.line.id !== line.id && quantityDraftRef.current?.line.id !== line.id && catalogueReviewRef.current?.line.id !== line.id && !(linePendingRef.current[line.id] > 0) && !lineUncertainRef.current.has(line.id) && resourceSaveStates?.[`line:${line.id}`] !== "uncertain"}
                                                onApplyPendingChanged={(lineId, pending) => {
                                                    if (pending) applyingResourceLinesRef.current.add(lineId);
                                                    else applyingResourceLinesRef.current.delete(lineId);
                                                    setApplyingResourceLines(new Set(applyingResourceLinesRef.current));
                                                    onResourceSaveStateChanged?.(`apply:${lineId}`, pending ? "saving" : "confirmed");
                                                }}
                                                librarySaveState={resourceSaveStates?.[`library:${line.id}`] === "saving" ? "saving" : resourceSaveStates?.[`library:${line.id}`] === "uncertain" ? "uncertain" : undefined}
                                                onLibrarySaveStateChanged={(lineId, state) => {
                                                    if (state === "uncertain") resourceUncertainRef.current.add(lineId);
                                                    onResourceSaveStateChanged?.(`library:${lineId}`, state);
                                                    if (state === "saving") pendingResourceLinesRef.current.add(lineId);
                                                    else pendingResourceLinesRef.current.delete(lineId);
                                                    setPendingResourceLines(new Set(pendingResourceLinesRef.current));
                                                }}
                                                onSaveStateChanged={(lineId, state) => {
                                                    if (state === "uncertain") resourceUncertainRef.current.add(lineId);
                                                    onResourceSaveStateChanged?.(lineId, state);
                                                    if (state === "saving") pendingResourceLinesRef.current.add(lineId);
                                                    else pendingResourceLinesRef.current.delete(lineId);
                                                    setPendingResourceLines(new Set(pendingResourceLinesRef.current));
                                                    if (state === "uncertain") setUncertainResourceLines(previous => new Set(previous).add(lineId));
                                                }}
                                            />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Add line button */}
                                <button
                                    type="button"
                                    onClick={() => handleAddLine(section)}
                                    disabled={addReceipts.some(receipt => receipt.estimateId === currentEstimate.id && receipt.section === section && receipt.phase !== "confirmed")}
                                    className="w-full px-5 py-2.5 text-left text-sm text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5 transition-colors"
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

export function EstimateActivityEntry({ activeSections, commonNames, onAddActivity, blockedNames = [] }: {
    activeSections: string[];
    commonNames: readonly string[];
    onAddActivity: (name: string) => Promise<void>;
    blockedNames?: string[];
}) {
    const [name, setName] = useState("");
    const id = useId();
    const activity = name.trim();
    const alreadyPresent = activeSections.includes(activity);

    return (
        <form className={ui.activityEntry} onSubmit={event => {
            event.preventDefault();
            if (!activity || alreadyPresent || blockedNames.includes(activity)) return;
            void onAddActivity(activity);
        }}>
            <div className={ui.activityFields}>
                <label htmlFor={id}>Add a work activity</label>
                <p id={`${id}-help`}>Name the work for this job, then price its items below. Only add activities you need.</p>
                <div className={ui.activityInputRow}>
                    <input id={id} value={name} onChange={event => setName(event.target.value)}
                        aria-describedby={`${id}-help ${id}-status`} required
                        placeholder="e.g. Preparation and protection" />
                    <button type="submit" disabled={!activity || alreadyPresent || blockedNames.includes(activity)}>Add activity</button>
                </div>
                <p id={`${id}-status`} role="status">{blockedNames.includes(activity) ? "This add is awaiting acknowledgement or reconciliation. See Add line status; no retry starts." : alreadyPresent
                    ? "This activity is already below. Use Add line item in that activity."
                    : "Adding creates a blank price line. Enter its description, quantity and rate; Constructa calculates the amount."}</p>
            </div>
            <details>
                <summary>Choose a common activity name</summary>
                <label>
                    Common names are optional, not a list of required work.
                    <select aria-label="Common activity name" value="" onChange={event => setName(event.target.value)}>
                        <option value="" disabled>Choose a name</option>
                        {commonNames.map(common => <option key={common} value={common} disabled={activeSections.includes(common)}>{common}</option>)}
                    </select>
                </label>
            </details>
        </form>
    );
}

// ─── Line Item Row ───────────────────────────────────────
function LineItemRow({
    line,
    library,
    allLibrary,
    section,
    isClientBoQ,
    saveBlocked = false,
    savePending = false,
    onUpdate,
    onDelete,
    onLibrarySelect,
    quantityDraft, quantityPending = false, quantityConsumed = false, quantityMessage = "",
    onQuantityChange, onQuantitySave, onQuantityCancel,
    rateDraft, ratePending = false, rateConsumed = false, rateMessage = "",
    onRateChange, onRateSave, onRateCancel,
    unitDraft, unitPending = false, unitConsumed = false, unitMessage = "",
    onUnitChange, onUnitSave, onUnitCancel,
    descriptionDraft, descriptionPending = false, descriptionConsumed = false, descriptionMessage = "",
    onDescriptionChange, onDescriptionSave, onDescriptionCancel,
    lineTypeDraft, lineTypePending = false, lineTypeConsumed = false, lineTypeMessage = "",
    onLineTypeChange, onLineTypeSave, onLineTypeCancel,
    activity,
    activityOpen = false,
}: {
    line: EstimateLine;
    library: CostLibraryItem[];
    allLibrary: CostLibraryItem[];
    section: string;
    isClientBoQ?: boolean;
    saveBlocked?: boolean;
    savePending?: boolean;
    onUpdate: (id: string, updates: Partial<EstimateLine>) => void;
    onDelete: (id: string) => void;
    onLibrarySelect: (lineId: string, itemId: string, section: string) => void;
    quantityDraft?: QuantityDraft;
    quantityPending?: boolean;
    quantityConsumed?: boolean;
    quantityMessage?: string;
    onQuantityChange: (line: EstimateLine, raw: string, expected?: QuantityDraft) => void;
    onQuantitySave: (draft: QuantityDraft) => Promise<void>;
    onQuantityCancel: (draft: QuantityDraft) => void;
    rateDraft?: RateDraft;
    ratePending?: boolean;
    rateConsumed?: boolean;
    rateMessage?: string;
    onRateChange: (line: EstimateLine, raw: string, expected?: RateDraft) => void;
    onRateSave: (draft: RateDraft) => Promise<void>;
    onRateCancel: (draft: RateDraft) => void;
    unitDraft?: UnitDraft;
    unitPending?: boolean;
    unitConsumed?: boolean;
    unitMessage?: string;
    onUnitChange: (line: EstimateLine, unit: string, expected?: UnitDraft) => void;
    onUnitSave: (draft: UnitDraft) => Promise<void>;
    onUnitCancel: (draft: UnitDraft) => void;
    descriptionDraft?: DescriptionDraft;
    descriptionPending?: boolean;
    descriptionConsumed?: boolean;
    descriptionMessage?: string;
    onDescriptionChange: (line: EstimateLine, raw: string, expected?: DescriptionDraft) => void;
    onDescriptionSave: (draft: DescriptionDraft) => Promise<void>;
    onDescriptionCancel: (draft: DescriptionDraft) => void;
    lineTypeDraft?: LineTypeDraft;
    lineTypePending?: boolean;
    lineTypeConsumed?: boolean;
    lineTypeMessage?: string;
    onLineTypeChange: (line: EstimateLine, choice: string, expected?: LineTypeDraft) => void;
    onLineTypeSave: (draft: LineTypeDraft) => Promise<void>;
    onLineTypeCancel: (draft: LineTypeDraft) => void;
    activity?: ComponentProps<typeof AdvancedLineActivity>;
    activityOpen?: boolean;
}) {
    const ordinaryDescription = !isClientBoQ && line.pricing_mode === "simple" && section !== "Preliminaries";
    const [searchDraft, setSearchDraft] = useState({ source: line.description, value: line.description || "" });
    const search = searchDraft.source === line.description ? searchDraft.value : line.description;
    const proposedQuantity = quantityDraft ? parseAdvancedQuantityDraft(quantityDraft.raw) : null;
    const quantityValid = proposedQuantity !== null && Number.isFinite(proposedQuantity * line.unit_rate);
    const proposedRate = rateDraft ? parseAdvancedQuantityDraft(rateDraft.raw) : null;
    const rateValid = proposedRate !== null && Number.isFinite(line.quantity * proposedRate);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const blurEpoch = useRef(0);
    const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowMounted = useRef(false);
    const rowView = useRef({ line, searchDraft, saveBlocked, savePending });
    useEffect(() => { rowView.current = { line, searchDraft, saveBlocked, savePending }; }, [line, searchDraft, saveBlocked, savePending]);
    useEffect(() => {
        rowMounted.current = true;
        return () => {
            rowMounted.current = false;
            if (blurTimer.current) clearTimeout(blurTimer.current);
        };
    }, []);

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
            {lineTypeDraft || ordinaryDescription ? <div className="space-y-1" data-line-type-draft={lineTypeDraft ? line.id : undefined}>
                <select aria-label="Line type" value={lineTypeDraft?.raw ?? (typeof line.line_type === "string" ? line.line_type : "")}
                    disabled={savePending || lineTypePending || lineTypeConsumed || (saveBlocked && !lineTypeDraft) || (!lineTypeDraft && search !== line.description) || typeof line.line_type !== "string"}
                    onChange={event => {
                        if (!rowMounted.current || rowView.current.searchDraft !== searchDraft || search !== line.description) return;
                        onLineTypeChange(line, event.target.value, lineTypeDraft);
                    }} className="w-full h-8 px-1 border border-slate-700 rounded text-xs text-slate-400 bg-slate-900/50">
                    {!LINE_TYPES.includes(line.line_type) && <option value={typeof line.line_type === "string" ? line.line_type : ""}>Saved: {JSON.stringify(line.line_type) ?? "not supplied"}</option>}
                    {lineTypeDraft && !LINE_TYPES.includes(lineTypeDraft.raw) && lineTypeDraft.raw !== line.line_type && <option value={lineTypeDraft.raw}>Reviewed: {JSON.stringify(lineTypeDraft.raw)}</option>}
                    {LINE_TYPES.map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                </select>
                {typeof line.line_type !== "string" && <p role="status" className="text-xs">The stored type is not text. Review this source before changing it.</p>}
                {lineTypeDraft && <>
                    <p className="text-xs text-slate-400">Saved type: {JSON.stringify(lineTypeDraft.line.line_type)}. Chosen: {JSON.stringify(lineTypeDraft.raw)}. This changes only the line label, not its priced quantity, unit, rate, resources, activity or totals.</p>
                    <button type="button" disabled={lineTypePending || lineTypeConsumed || !!lineTypeMessage} onClick={() => void onLineTypeSave(lineTypeDraft)} className="text-xs underline">Save line type</button>
                    <button type="button" disabled={lineTypePending || lineTypeConsumed} onClick={() => onLineTypeCancel(lineTypeDraft)} className="text-xs underline">Cancel line type</button>
                    {lineTypeMessage && <p role="status" className="text-xs text-amber-200">{lineTypeMessage}</p>}
                </>}
            </div> : isClientBoQ ? (
                <span className="text-slate-500 text-xs font-mono truncate" title={line.client_ref || ""}>
                    {line.client_ref || ""}
                </span>
            ) : (
                <select
                    value={line.line_type || "general"}
                    disabled={saveBlocked}
                    onChange={(e) => onUpdate(line.id, { line_type: e.target.value })}
                    aria-label="Line type"
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
                {descriptionDraft || ordinaryDescription ? <div className="space-y-1" data-description-draft={descriptionDraft ? line.id : undefined}>
                    <input type="text" aria-label="Description" value={descriptionDraft?.raw ?? line.description}
                        disabled={savePending || descriptionPending || descriptionConsumed || (saveBlocked && !descriptionDraft)}
                        onChange={event => {
                            if (!rowMounted.current || rowView.current.searchDraft !== searchDraft || JSON.stringify(rowView.current.line) !== JSON.stringify(line)) return;
                            blurEpoch.current++;
                            if (blurTimer.current) clearTimeout(blurTimer.current);
                            setShowDropdown(false);
                            onDescriptionChange(line, event.target.value, descriptionDraft);
                        }}
                        className="w-full h-8 px-2 border border-slate-700 rounded text-sm text-slate-100 bg-slate-900/50" />
                    {descriptionDraft && <>
                        <p className="text-xs text-slate-400">Draft wording only. Saved: {JSON.stringify(descriptionDraft.line.description)}. Prices, activity and resources stay unchanged.</p>
                        <button type="button" disabled={descriptionPending || descriptionConsumed || !!descriptionMessage} onClick={() => void onDescriptionSave(descriptionDraft)} className="text-xs underline">Save description</button>
                        <button type="button" disabled={descriptionPending || descriptionConsumed} onClick={() => onDescriptionCancel(descriptionDraft)} className="text-xs underline">Cancel description</button>
                        {descriptionMessage && <p role="status" className="text-xs text-amber-200">{descriptionMessage}</p>}
                    </>}
                </div> : <>
                <input
                    type="text"
                    disabled={saveBlocked}
                    value={search}
                    onChange={(e) => {
                        blurEpoch.current++;
                        setSearchDraft({ source: line.description, value: e.target.value });
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
                        const epoch = blurEpoch.current;
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        blurTimer.current = setTimeout(() => {
                            if (!rowMounted.current || blurEpoch.current !== epoch || rowView.current.searchDraft !== searchDraft || rowView.current.saveBlocked || rowView.current.savePending || JSON.stringify(rowView.current.line) !== JSON.stringify(line)) return;
                            setShowDropdown(false);
                            // Free-text mode: keep whatever was typed
                            if (!ordinaryDescription && search !== line.description) {
                                onUpdate(line.id, { description: search });
                            }
                        }, 200);
                    }}
                    placeholder={ordinaryDescription ? "Search catalogue only; no wording save" : "Search library or type description..."}
                    aria-label={ordinaryDescription ? "Search catalogue" : "Description"}
                    className="w-full h-8 px-2 border border-slate-700 rounded text-sm text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-slate-600"
                />
                </>}
                {ordinaryDescription && <details className="mt-1" onToggle={event => {
                    if (rowMounted.current && !event.currentTarget.open) setShowDropdown(false);
                }}>
                    <summary className="text-xs text-slate-400">Find catalogue rate</summary>
                    <p className="text-xs text-slate-400">Search only. Choose an actual item to review its rate separately; search text never saves wording.</p>
                <input
                    type="text"
                    disabled={saveBlocked}
                    value={search}
                    onChange={(e) => {
                        blurEpoch.current++;
                        setSearchDraft({ source: line.description, value: e.target.value });
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
                        const epoch = blurEpoch.current;
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        blurTimer.current = setTimeout(() => {
                            if (!rowMounted.current || blurEpoch.current !== epoch || rowView.current.searchDraft !== searchDraft || rowView.current.saveBlocked || rowView.current.savePending || JSON.stringify(rowView.current.line) !== JSON.stringify(line)) return;
                            setShowDropdown(false);
                            // Free-text mode: keep whatever was typed
                            if (!ordinaryDescription && search !== line.description) {
                                onUpdate(line.id, { description: search });
                            }
                        }, 200);
                    }}
                    placeholder={ordinaryDescription ? "Search catalogue only; no wording save" : "Search library or type description..."}
                    aria-label={ordinaryDescription ? "Search catalogue" : "Description"}
                    className="w-full h-8 px-2 border border-slate-700 rounded text-sm text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-slate-600"
                />
                </details>}
                {activity && <AdvancedLineActivity {...activity} blocked={activity.blocked || (!activityOpen && (saveBlocked || savePending || search !== line.description))}
                    onBegin={() => {
                        if (!rowMounted.current || search !== line.description || rowView.current.searchDraft !== searchDraft || rowView.current.saveBlocked || rowView.current.savePending) return false;
                        blurEpoch.current++;
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        setShowDropdown(false);
                        return activity.onBegin();
                    }} />}
                {showDropdown && filtered.length > 0 && (
                    <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {filtered.map((item) => (
                            <button
                                type="button"
                                disabled={saveBlocked || savePending || isClientBoQ || line.pricing_mode !== "simple" || section === "Preliminaries"}
                                title="Review a catalogue rate for a simple non-BoQ line; quantities are not converted."
                                key={item.id}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                }}
                                onFocus={() => {
                                    blurEpoch.current++;
                                    if (blurTimer.current) clearTimeout(blurTimer.current);
                                }}
                                onClick={() => {
                                    blurEpoch.current++;
                                    if (blurTimer.current) clearTimeout(blurTimer.current);
                                    setSearchDraft(current => ({ ...current }));
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
            {quantityDraft || (!isClientBoQ && line.pricing_mode === "simple" && section !== "Preliminaries") ? <div className="space-y-1" data-quantity-draft={quantityDraft ? line.id : undefined}>
                <input type="text" inputMode="decimal" aria-label="Quantity"
                    disabled={savePending || quantityPending || quantityConsumed || (saveBlocked && !quantityDraft) || (!quantityDraft && search !== line.description)}
                    value={quantityDraft?.raw ?? String(line.quantity)}
                    aria-invalid={quantityDraft ? !quantityValid : undefined}
                    onChange={event => {
                        if (!rowMounted.current || rowView.current.searchDraft !== searchDraft || search !== line.description) return;
                        onQuantityChange(line, event.target.value, quantityDraft);
                    }}
                    className="w-full h-8 px-2 border border-slate-700 rounded text-sm text-center text-slate-100 bg-slate-900/50" />
                {quantityDraft && <>
                    <p className="text-[10px] text-slate-400">Saved: {String(line.quantity)}</p>
                    <button type="button" disabled={quantityPending || quantityConsumed || !quantityValid || !!quantityMessage} onClick={() => void onQuantitySave(quantityDraft)} className="text-xs underline">Save quantity</button>
                    <button type="button" disabled={quantityPending || quantityConsumed} onClick={() => onQuantityCancel(quantityDraft)} className="text-xs underline">Cancel quantity</button>
                    {!quantityValid && <p role="alert" className="text-xs">Enter a finite quantity and total; blank or incomplete text is not zero.</p>}
                    {quantityMessage && <p role="status" className="text-xs">{quantityMessage}</p>}
                </>}
            </div> :
            <input
                type="number"
                key={line.quantity}
                disabled={saveBlocked}
                step="0.01"
                defaultValue={line.quantity}
                onBlur={(e) => onUpdate(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                aria-label="Quantity"
                className="h-8 px-2 border border-slate-700 rounded text-sm text-center text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />}

            {/* Unit */}
            {unitDraft || (!isClientBoQ && line.pricing_mode === "simple" && section !== "Preliminaries") ? <div className="space-y-1" data-unit-draft={unitDraft ? line.id : undefined}>
                <select aria-label="Unit" value={unitDraft?.raw ?? line.unit}
                    disabled={savePending || unitPending || unitConsumed || (saveBlocked && !unitDraft) || (!unitDraft && search !== line.description)}
                    onChange={event => {
                        if (!rowMounted.current || rowView.current.searchDraft !== searchDraft || search !== line.description) return;
                        onUnitChange(line, event.target.value, unitDraft);
                    }}
                    className="w-full h-8 px-1 border border-slate-700 rounded text-sm text-slate-300 bg-slate-900/50">
                    {!UNITS.includes(line.unit) && <option value={line.unit}>Saved: {JSON.stringify(line.unit)}</option>}
                    {unitDraft && !UNITS.includes(unitDraft.raw) && unitDraft.raw !== line.unit && <option value={unitDraft.raw}>Reviewed: {JSON.stringify(unitDraft.raw)}</option>}
                    {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                {unitDraft && <>
                    <p className="text-xs text-slate-400">Saved unit: {JSON.stringify(unitDraft.line.unit)}. Chosen unit: {JSON.stringify(unitDraft.raw)}. Quantity: {String(unitDraft.line.quantity)}; rate: GBP {String(unitDraft.line.unit_rate)}. No quantity, rate or resource conversion occurs. Totals stay unchanged.</p>
                    <button type="button" disabled={unitPending || unitConsumed || !!unitMessage} onClick={() => void onUnitSave(unitDraft)} className="text-xs underline">Save unit</button>
                    <button type="button" disabled={unitPending || unitConsumed} onClick={() => onUnitCancel(unitDraft)} className="text-xs underline">Cancel unit</button>
                    {unitMessage && <p role="status" className="text-xs text-amber-200">{unitMessage}</p>}
                </>}
            </div> :
            <select
                key={line.unit}
                disabled={saveBlocked}
                defaultValue={line.unit}
                onChange={(e) => onUpdate(line.id, { unit: e.target.value })}
                aria-label="Unit"
                className="h-8 px-1 border border-slate-700 rounded text-sm text-slate-300 bg-slate-900/50 focus:outline-none"
            >
                {UNITS.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>}

            {/* Rate */}
            {rateDraft || (!isClientBoQ && line.pricing_mode === "simple" && section !== "Preliminaries") ? <div className="space-y-1" data-rate-draft={rateDraft ? line.id : undefined}>
                <input type="text" inputMode="decimal" aria-label="Rate (£)"
                    disabled={savePending || ratePending || rateConsumed || (saveBlocked && !rateDraft) || (!rateDraft && search !== line.description)}
                    value={rateDraft?.raw ?? String(line.unit_rate)} aria-invalid={rateDraft ? !rateValid : undefined}
                    onChange={event => {
                        if (!rowMounted.current || rowView.current.searchDraft !== searchDraft || search !== line.description) return;
                        onRateChange(line, event.target.value, rateDraft);
                    }}
                    className="w-full h-8 px-2 border border-slate-700 rounded text-sm text-right text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                {rateDraft && <>
                    <p className="text-xs text-slate-400">Draft rate only. Saved: GBP {String(line.unit_rate)}. Quantity: {String(line.quantity)}. Total remains confirmed until Save is acknowledged.</p>
                    <button type="button" disabled={ratePending || rateConsumed || !rateValid || !!rateMessage} onClick={() => void onRateSave(rateDraft)} className="text-xs underline">Save rate</button>
                    <button type="button" disabled={ratePending || rateConsumed} onClick={() => onRateCancel(rateDraft)} className="text-xs underline">Cancel rate</button>
                    {!rateValid && <p role="alert" className="text-xs text-red-200">Enter a finite rate and total. Blank or intermediate text is not saved.</p>}
                    {rateMessage && <p role="status" className="text-xs text-amber-200">{rateMessage}</p>}
                </>}
            </div> : line.pricing_mode === "buildup" ? (
                <div className="h-8 px-2 rounded text-sm text-right font-medium text-blue-400 bg-blue-500/10 flex flex-col items-end justify-center leading-tight">
                    <span>{formatGBP(line.unit_rate)}</span>
                    <span className="text-[9px] text-blue-500">built up</span>
                </div>
            ) : (
                <input
                    key={line.unit_rate}
                    disabled={saveBlocked}
                    type="number"
                    step="0.01"
                    defaultValue={line.unit_rate}
                    onBlur={(e) => onUpdate(line.id, { unit_rate: parseFloat(e.target.value) || 0 })}
                    aria-label="Rate (£)"
                    className="h-8 px-2 border border-slate-700 rounded text-sm text-right text-slate-100 bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                disabled={saveBlocked || savePending}
                aria-label="Remove line"
                className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
