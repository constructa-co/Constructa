"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { newClientId } from "@/lib/client-id";
import { useReducerStore } from "@/lib/use-reducer-store";
import { workspaceStyles, type WorkspaceStyles } from "@/lib/workspace-styles";
import { splitScope } from "@/lib/guided-brief";
import {
    ADJUSTMENT_HELP,
    EMPTY_PRICE_LINE_DRAFT,
    NEW_LINE_KEY,
    adjustmentsDraftFromEstimate,
    advancedCapabilities,
    buildAdjustments,
    currentEstimate,
    draftFromLine,
    draftLineTotal,
    estimatingReducer,
    formatGBP,
    initialEstimatingState,
    isSimpleEditable,
    removePriceLine,
    submitAdjustments,
    submitPriceLine,
    summarisePrice,
    unitOptions,
    type AdjustmentKey,
    type EstimatingServer,
    type LineOp,
    type PriceLineDraft,
    type PriceSummary,
} from "@/lib/simple-estimate";
import {
    deleteSimplePriceLineAction,
    loadAdvancedEstimatingDataAction,
    savePriceAdjustmentsAction,
    saveSimplePriceLineAction,
    updateSimplePriceLineAction,
    type AdvancedEstimatingData,
} from "./simple-actions";
import type { Estimate, EstimateLine } from "./types";
import ui from "@/components/estimating.module.css";
import PricingFocus from "@/components/pricing-focus";
import AreaQuantityAid from "@/components/area-quantity-aid";
import { areaQuantity } from "@/lib/area-quantity";
import { nextEditableSavedLine, savePriceAndChangeNext } from "@/lib/save-price-change-next";
import PricingAssistantPanel from "@/components/pricing-assistant-panel";
import BriefPriceExcerpt from "@/components/brief-price-excerpt";
import PriceWorkList, { type WorkDescriptionRange } from "@/components/price-work-list";
import LineActivity from "./line-activity";
import type { ActivitySaveResult } from "./activity-actions";
import type { ReactNode } from "react";
import { priceActivityRows } from "@/lib/price-activity-view";
import { findPriceLineIds, nextPriceLineMatch } from "@/lib/price-line-finder";
import NewPriceActivity from "@/components/new-price-activity";
import { priceActivitySuggestions } from "@/lib/price-activity-suggestions";
import SavedLineReuse from "@/components/saved-line-reuse";
import { savedLineReuseContext, prepareSavedLineReuse, type ReviewedSavedLine } from "@/lib/saved-line-reuse";
import PricingPaymentStages from "./payment-stages";
import PricingScopeNotesEditor from "./scope-notes";
import PricingOpeningEditor from "./opening-message";
import PricingFullScopeEditor from "./full-scope";
import PricingExperienceEditor from "./experience-selection";
import type { PricingExperienceSource } from "@/lib/pricing-experience";
import type { PricingFullScopeSource } from "@/lib/pricing-full-scope";
import type { PricingScopeNotesSource } from "@/lib/pricing-scope-notes";
import { createPricingAssistantSession } from "@/lib/pricing-assistant-session";
import type { PricingConversationGenerator } from "@/lib/pricing-conversation";
import { buildPricingReviewContext, prepareReviewedPriceDraft, reviewPricingSuggestion, PRICING_REVIEW_OPEN, PRICING_REVIEW_STALE, type PendingPricingReview } from "@/lib/pricing-review";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { BEFORE_PROJECT_NAVIGATION } from "@/lib/project-navigation";
import { ESTIMATE_LEAVE_WARNING, hasOpenEstimateWork } from "./estimate-navigation";

// The full BoQ workspace and its import, take-off and build-up tools are only
// downloaded when Advanced estimating is opened.
const AdvancedEstimate = dynamic(() => import("./advanced-estimate"), {
    ssr: false,
    loading: () => <p className="p-4 text-sm text-slate-300">Loading the advanced tools…</p>,
});

interface ProjectContext {
    id: string;
    name: string;
    client_name: string;
    brief_scope: string;
    brief_trade_sections?: unknown;
    payment_schedule?: unknown;
    payment_lock_reason?: string | null;
    scope_notes?: PricingScopeNotesSource;
    full_scope?: PricingFullScopeSource;
    experience?: PricingExperienceSource | null;
    proposal_introduction?: string | null;
}

type LoadAdvancedData = () => Promise<{ ok: true; data: AdvancedEstimatingData } | { ok: false; error: string }>;

interface Props {
    estimates: Estimate[];
    project: ProjectContext;
    defaultTabId?: string;
    /** Default to the real server actions; replaced only by tests and evidence capture. */
    server?: EstimatingServer;
    loadAdvancedData?: LoadAdvancedData;
    /** No default transport. A future adapter needs separate server auth, budget and data approval. */
    pricingGenerator?: PricingConversationGenerator;
}

const REAL_SERVER: EstimatingServer = {
    saveLine: saveSimplePriceLineAction,
    updateLine: updateSimplePriceLineAction,
    deleteLine: deleteSimplePriceLineAction,
    saveAdjustments: savePriceAdjustmentsAction,
};

const SCOPE_PREVIEW_LENGTH = 220;
type PriceFindState = { estimateId: string; open: boolean; query: string; activeId: string | null };
const EMPTY_PRICE_FIND: PriceFindState = { estimateId: "", open: false, query: "", activeId: null };

export default function EstimateClient({
    estimates: initialEstimates,
    project,
    defaultTabId,
    server = REAL_SERVER,
    loadAdvancedData = loadAdvancedEstimatingDataAction,
    pricingGenerator,
}: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);

    const [state, store] = useReducerStore(estimatingReducer, () =>
        initialEstimatingState(initialEstimates, { pendingEstimateId: newClientId(), preferredEstimateId: defaultTabId }),
    );
    const estimate = currentEstimate(state);
    const lines = useMemo(() => estimate?.estimate_lines ?? [], [estimate]);
    const summary = useMemo(() => summarisePrice(estimate, lines), [estimate, lines]);
    const newOp = state.ops[NEW_LINE_KEY];
    const [priceFind, setPriceFind] = useState<PriceFindState>(EMPTY_PRICE_FIND);
    const priceFindRef = useRef(EMPTY_PRICE_FIND);
    const priceTableRef = useRef<HTMLTableElement>(null);
    const finderOpen = lines.length > 0 && priceFind.estimateId === estimate?.id && priceFind.open;
    const foundIds = finderOpen ? findPriceLineIds(lines, priceFind.query) : [];
    const foundSet = new Set(foundIds);
    const foundIndex = priceFind.activeId === null ? -1 : foundIds.indexOf(priceFind.activeId);
    const updatePriceFind = (patch: Partial<PriceFindState>) => {
        const fresh = store.getState(), current = currentEstimate(fresh);
        if (!current || current.id !== estimate?.id || fresh.advancedOpen) return;
        const previous = priceFindRef.current.estimateId === current.id ? priceFindRef.current : EMPTY_PRICE_FIND;
        const next = { ...previous, ...patch, estimateId: current.id };
        priceFindRef.current = next;
        setPriceFind(next);
    };
    const visitPriceMatch = (direction: 1 | -1) => {
        const fresh = store.getState(), current = currentEstimate(fresh), find = priceFindRef.current;
        if (!current || current.id !== estimate?.id || fresh.advancedOpen || !find.open || find.estimateId !== current.id) return;
        const id = nextPriceLineMatch(findPriceLineIds(current.estimate_lines, find.query), find.activeId, direction);
        if (id === null) return;
        // Compare attribute values rather than interpolating contractor text into a selector.
        const row = Array.from(priceTableRef.current?.querySelectorAll<HTMLTableRowElement>("[data-price-line]") ?? [])
            .find(element => element.getAttribute("data-price-line") === id);
        if (!row) return;
        updatePriceFind({ activeId: id });
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    };
    const [resourceSaveStates, setResourceSaveStates] = useState<Record<string, "saving" | "uncertain" | "draft">>({});
    const resourceSaveStatesRef = useRef<Record<string, "saving" | "uncertain" | "draft">>({});
    const resourceSaveStateChanged = (lineId: string, status: "saving" | "confirmed" | "uncertain" | "draft") => {
        const next = { ...resourceSaveStatesRef.current };
        if (status === "confirmed") delete next[lineId];
        else next[lineId] = status;
        resourceSaveStatesRef.current = next;
        setResourceSaveStates(next);
    };
    const [paymentWork, setPaymentWork] = useState(false);
    const paymentWorkRef = useRef(false);
    const paymentWorkChanged = (open: boolean) => {
        paymentWorkRef.current = open;
        setPaymentWork(open);
    };
    const [scopeNotesWork, setScopeNotesWork] = useState(false);
    const [experienceWork, setExperienceWork] = useState(false);
    const experienceWorkRef = useRef(false);
    const experienceWorkChanged = (open: boolean) => { experienceWorkRef.current = open; setExperienceWork(open); };
    const [fullScopeWork, setFullScopeWork] = useState(false);
    const fullScopeWorkRef = useRef(false);
    const fullScopeWorkChanged = (open: boolean) => { fullScopeWorkRef.current = open; setFullScopeWork(open); };
    const [openingWork, setOpeningWork] = useState(false);
    const openingWorkRef = useRef(false);
    const openingWorkChanged = (open: boolean) => { openingWorkRef.current = open; setOpeningWork(open); };
    const scopeNotesWorkRef = useRef(false);
    const scopeNotesWorkChanged = (open: boolean) => {
        scopeNotesWorkRef.current = open;
        setScopeNotesWork(open);
    };
    const [workListOpen, setWorkListOpen] = useState(false);
    const workListOpenRef = useRef(false);
    const workListChanged = (open: boolean) => {
        workListOpenRef.current = open;
        setWorkListOpen(open);
    };
    const [activityWork, setActivityWork] = useState<Record<string, "editing" | "saving" | "uncertain">>({});
    const activityWorkRef = useRef<Record<string, "editing" | "saving" | "uncertain">>({});
    const activityWorkChanged = (lineId: string, status: "editing" | "saving" | "uncertain" | "confirmed") => {
        const next = { ...activityWorkRef.current };
        if (status === "confirmed") delete next[lineId]; else next[lineId] = status;
        activityWorkRef.current = next; setActivityWork(next);
    };
    const beginActivity = (lineId: string) => {
        const fresh = store.getState(), current = currentEstimate(fresh);
        const line = current?.estimate_lines.find(item => item.id === lineId);
        if (!line || !current || !isSimpleEditable(line, current) || line.trade_section === "Preliminaries" || fresh.advancedOpen || hasOpenEstimateWork(fresh)
            || Object.keys(activityWorkRef.current).length || Object.keys(resourceSaveStatesRef.current).length
            || paymentWorkRef.current || scopeNotesWorkRef.current || experienceWorkRef.current || fullScopeWorkRef.current || openingWorkRef.current) return false;
        activityWorkChanged(lineId, "editing"); return true;
    };
    const activitySaved = (result: Extract<ActivitySaveResult, { ok: true }>, expected: string | null) => {
        const fresh = store.getState(), current = currentEstimate(fresh);
        const line = current?.estimate_lines.find(item => item.id === result.lineId);
        if (!line || !current || !isSimpleEditable(line, current) || line.trade_section === "Preliminaries" || result.section === "Preliminaries" || current.id !== result.estimateId || (line.trade_section ?? null) !== expected) return false;
        store.dispatch({ type: "estimates/replace", update: items => items.map(item => item.id !== result.estimateId ? item : {
            ...item, estimate_lines: item.estimate_lines.map(saved => saved.id === result.lineId ? { ...saved, trade_section: result.section } : saved),
        }) });
        return true;
    };
    const activityBusy = Object.keys(activityWork).length > 0;
    const hasOpenWork = hasOpenEstimateWork(state) || Object.keys(resourceSaveStates).length > 0 || paymentWork || scopeNotesWork || experienceWork || fullScopeWork || openingWork || workListOpen || activityBusy;
    const hasUnconfirmedLineChanges = Object.entries(resourceSaveStates).some(([key, status]) => key.startsWith("line:") && status === "uncertain");
    useUnsavedGuard(hasOpenWork, ESTIMATE_LEAVE_WARNING);
    useEffect(() => {
        if (!hasOpenWork) return;
        const confirmProjectChange = (event: Event) => {
            if (!window.confirm(ESTIMATE_LEAVE_WARNING)) event.preventDefault();
        };
        window.addEventListener(BEFORE_PROJECT_NAVIGATION, confirmProjectChange);
        return () => window.removeEventListener(BEFORE_PROJECT_NAVIGATION, confirmProjectChange);
    }, [hasOpenWork]);

    const [showFullScope, setShowFullScope] = useState(false);
    const [showLineDetails, setShowLineDetails] = useState(false);
    const [showActivityGroups, setShowActivityGroups] = useState(false);
    const [fullNewLineId, setFullNewLineId] = useState<string | null>(null);
    const [fullAmountLineIds, setFullAmountLineIds] = useState<Record<string, boolean>>({});
    const [nextEditFocusId, setNextEditFocusId] = useState<string | null>(null);
    const nextLineRevision = JSON.stringify(estimate);
    const showInlineNew = !!newOp && fullNewLineId !== newOp.lineId && (showLineDetails || newOp.draft.mode === "amount");
    const newLineProps = newOp ? {
        idPrefix: "new-line",
        title: lines.length ? "New price line" : "First price line",
        op: newOp, s, isDark,
        activityNames: estimate?.is_client_boq ? undefined : priceActivitySuggestions(lines, project.brief_trade_sections),
        onChange: (patch: Partial<PriceLineDraft>) => {
            store.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch });
            if (patch.mode === "rate") setShowLineDetails(true);
        },
        onCancel: () => store.dispatch({ type: "op/cancel", key: NEW_LINE_KEY }),
        onSave: () => void submitPriceLine(store, server, project.id, NEW_LINE_KEY),
        onSaveNext: () => submitPriceLine(store, server, project.id, NEW_LINE_KEY, { nextLineId: newClientId() }),
    } : null;
    const [briefDraftError, setBriefDraftError] = useState("");
    const [advanced, setAdvanced] = useState<{ status: "idle" | "loading" | "failed" | "ready"; data: AdvancedEstimatingData | null; error: string }>(
        { status: "idle", data: null, error: "" },
    );

    // Local conversation/review only: no default provider or persistence.
    const pricingAssistant = useMemo(() => createPricingAssistantSession(
        () => {
            const fresh = store.getState();
            return { project: { id: project.id, brief_scope: project.brief_scope }, estimate: currentEstimate(fresh), hasOpenWork: hasOpenEstimateWork(fresh) || fresh.advancedOpen };
        },
        (pending, index, contractorMessage) => {
            const fresh = store.getState();
            const context = buildPricingReviewContext({ id: project.id, brief_scope: project.brief_scope }, currentEstimate(fresh), contractorMessage);
            if (!context.ok) return context;
            const draft = prepareReviewedPriceDraft(pending, index, context.value, hasOpenEstimateWork(fresh) || fresh.advancedOpen);
            if (!draft.ok) return draft;
            store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: draft.value, lineId: newClientId() });
            return { ok: true };
        }, pricingGenerator,
    ), [project.id, project.brief_scope, store, pricingGenerator]);
    useEffect(() => () => pricingAssistant.detach(), [pricingAssistant]);
    useEffect(() => { pricingAssistant.refresh(); }, [pricingAssistant, state]);

    // Keep the chosen estimate version when moving between project tabs.
    const tabKey = `constructa_tab_${project.id}`;
    useEffect(() => {
        if (defaultTabId) return;
        const saved = window.sessionStorage.getItem(tabKey);
        if (saved) store.dispatch({ type: "estimate/select", estimateId: saved });
    }, [defaultTabId, store, tabKey]);
    const selectEstimate = (estimateId: string) => {
        if (Object.keys(activityWorkRef.current).length || workListOpenRef.current || scopeNotesWorkRef.current || experienceWorkRef.current || fullScopeWorkRef.current || openingWorkRef.current || paymentWorkRef.current || Object.values(resourceSaveStatesRef.current).some(status => status === "saving" || status === "draft")) return;
        const freshState = store.getState();
        if (freshState.activeEstimateId === estimateId || !freshState.estimates.some(item => item.id === estimateId) || hasOpenEstimateWork(freshState)) return;
        store.dispatch({ type: "estimate/select", estimateId });
        if (estimateId) window.sessionStorage.setItem(tabKey, estimateId);
    };

    const reuseView = useRef({ project, active: true });
    useEffect(() => {
        reuseView.current = { project, active: true };
        return () => { reuseView.current.active = false; };
    }, [project]);
    const applyInlineArea = (key: string, expected: LineOp | undefined, quantity: string) => {
        const fresh = store.getState(), current = currentEstimate(fresh);
        if (!reuseView.current.active || reuseView.current.project !== project || project.payment_lock_reason
            || !expected || fresh.ops[key] !== expected || expected.status === "saving" || expected.kind === "delete"
            || expected.draft.mode !== "rate" || expected.draft.unit !== "m2" || fresh.advancedOpen
            || current !== estimate || fresh.activeEstimateId !== state.activeEstimateId || fresh.pendingEstimateId !== state.pendingEstimateId
            || (current && (current.project_id !== project.id || current.is_client_boq))
            || Object.values(fresh.ops).some(op => op.status === "saving")
            || Object.keys(resourceSaveStatesRef.current).length || Object.keys(activityWorkRef.current).length
            || paymentWorkRef.current || scopeNotesWorkRef.current || experienceWorkRef.current || fullScopeWorkRef.current || openingWorkRef.current || workListOpenRef.current) return;
        const line = current?.estimate_lines.find(item => item.id === expected.lineId);
        if (expected.kind === "edit" && (!line || !current || !isSimpleEditable(line, current))) return;
        const checked = areaQuantity(quantity, "1");
        if (!checked.ok || checked.quantity !== quantity) return;
        store.dispatch({ type: "op/change", key, patch: { quantity } });
    };
    const saveAndChangeNext = async (lineId: string, expected: LineOp | undefined, next: EstimateLine | null) => {
        if (!estimate || !expected || !next) return;
        const allowed = () => reuseView.current.active && reuseView.current.project === project && !project.payment_lock_reason
            && Object.keys(resourceSaveStatesRef.current).length === 0 && Object.keys(activityWorkRef.current).length === 0
            && !paymentWorkRef.current && !scopeNotesWorkRef.current && !experienceWorkRef.current && !fullScopeWorkRef.current
            && !openingWorkRef.current && !workListOpenRef.current;
        const opened = await savePriceAndChangeNext(store, server, project.id,
            { estimate, lineId, op: expected, nextId: next.id, revision: nextLineRevision }, allowed);
        if (!opened || !allowed() || store.getState().ops[opened.id]?.lineId !== opened.id) return;
        setFullAmountLineIds(current => ({ ...current, [opened.id]: false }));
        setNextEditFocusId(opened.id);
        if (draftFromLine(opened).mode === "rate") setShowLineDetails(true);
    };
    const openSavedLineDraft = (reviewed: ReviewedSavedLine): { ok: true } | { ok: false; error: string } => {
        if (!reuseView.current.active) return { ok: false, error: PRICING_REVIEW_STALE };
        const fresh = store.getState();
        const context = savedLineReuseContext(reuseView.current.project, currentEstimate(fresh));
        if (!context.ok) return context;
        const blocked = !!reuseView.current.project.payment_lock_reason || fresh.advancedOpen || hasOpenEstimateWork(fresh) || Object.keys(resourceSaveStatesRef.current).length > 0
            || paymentWorkRef.current || scopeNotesWorkRef.current || experienceWorkRef.current || fullScopeWorkRef.current || openingWorkRef.current
            || workListOpenRef.current || Object.keys(activityWorkRef.current).length > 0;
        const draft = prepareSavedLineReuse(reviewed, context.value, blocked);
        if (!draft.ok) return draft;
        store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: draft.value, lineId: newClientId() });
        return { ok: true };
    };

    const openAdd = () => {
        if (Object.keys(activityWorkRef.current).length) return;
        store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: EMPTY_PRICE_LINE_DRAFT, lineId: newClientId() });
    };
    const openEdit = (line: EstimateLine) => {
        if (Object.keys(activityWorkRef.current).length) return;
        if (store.getState().ops[line.id]?.status === "saving") return;
        setNextEditFocusId(null);
        setFullAmountLineIds(current => ({ ...current, [line.id]: false }));
        store.dispatch({ type: "op/open", key: line.id, kind: "edit", draft: draftFromLine(line), lineId: line.id });
    };
    const showFullLineForm = (lineId: string) => {
        const op = store.getState().ops[lineId];
        if (!op || op.status === "saving") return;
        if (op.draft.mode === "amount") setFullAmountLineIds(current => ({ ...current, [lineId]: true }));
        else setShowLineDetails(false);
    };
    const showInlineLineForm = (lineId: string) => {
        const op = store.getState().ops[lineId];
        if (!op || op.status === "saving") return;
        setFullAmountLineIds(current => ({ ...current, [lineId]: false }));
        if (op.draft.mode === "rate") setShowLineDetails(true);
    };
    const openDelete = (line: EstimateLine) => {
        if (Object.keys(activityWorkRef.current).length) return;
        store.dispatch({ type: "op/open", key: line.id, kind: "delete", draft: draftFromLine(line), lineId: line.id });
    };

    const loadAdvanced = async () => {
        setAdvanced({ status: "loading", data: null, error: "" });
        try {
            const result = await loadAdvancedData();
            setAdvanced(result.ok
                ? { status: "ready", data: result.data, error: "" }
                : { status: "failed", data: null, error: result.error });
        } catch {
            setAdvanced({ status: "failed", data: null, error: "The advanced tools couldn't be loaded. Check your connection and try again." });
        }
    };

    const toggleAdvanced = () => {
        if (Object.keys(activityWorkRef.current).length) return;
        const opening = !state.advancedOpen;
        if (!opening && Object.values(resourceSaveStatesRef.current).some(status => status === "saving" || status === "draft")) return;
        store.dispatch({ type: "advanced/toggle" });
        if (opening && store.getState().advancedOpen && advanced.status !== "ready" && advanced.status !== "loading") void loadAdvanced();
    };

    const { work } = splitScope(project.brief_scope);
    const scope = work.trim();
    const scopeIsLong = scope.length > SCOPE_PREVIEW_LENGTH;
    const pricingContext = buildPricingReviewContext(project, estimate);
    const briefReview = pricingContext.ok ? reviewPricingSuggestion(pricingContext.value, {
        message: "", suggestions: [{ source: "briefWork", start: 0, end: pricingContext.value.work.length }],
    }) : null;
    const briefDraftBlocked = !pricingContext.ok || !briefReview?.ok || hasOpenWork || state.advancedOpen || pricingContext.value.clientBoQ;
    const briefDraftHelp = !pricingContext.ok ? pricingContext.error
        : !briefReview?.ok ? briefReview?.error
        : hasOpenWork || state.advancedOpen ? PRICING_REVIEW_OPEN
        : pricingContext.value.clientBoQ ? "Use the existing client BoQ workflow for this estimate."
        : "Copies only your work wording into an unsaved price-line draft. Review it before entering a price; no quantities or prices are filled.";
    const openReviewedBriefDraft = (pending: PendingPricingReview): { ok: true } | { ok: false; error: string } => {
        const freshState = store.getState();
        const freshContext = buildPricingReviewContext(project, currentEstimate(freshState));
        if (!freshContext.ok) return freshContext;
        const prepared = prepareReviewedPriceDraft(pending, 0, freshContext.value, hasOpenEstimateWork(freshState) || freshState.advancedOpen || Object.keys(resourceSaveStatesRef.current).length > 0 || paymentWorkRef.current || scopeNotesWorkRef.current || experienceWorkRef.current || fullScopeWorkRef.current || openingWorkRef.current || workListOpenRef.current || Object.keys(activityWorkRef.current).length > 0);
        if (!prepared.ok) return prepared;
        setBriefDraftError("");
        store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: prepared.value, lineId: newClientId() });
        return { ok: true };
    };
    const startBriefPriceDraft = () => {
        if (!briefReview?.ok) { setBriefDraftError(briefDraftHelp ?? "Review the work description first."); return; }
        const opened = openReviewedBriefDraft(briefReview.value);
        if (!opened.ok) setBriefDraftError(opened.error);
    };
    const openWorkListDraft = (source: string, range: WorkDescriptionRange, revision: string): { ok: true } | { ok: false; error: string } => {
        const freshState = store.getState();
        const base = buildPricingReviewContext(project, currentEstimate(freshState));
        if (!base.ok) return base;
        if (base.value.revision !== revision) return { ok: false, error: PRICING_REVIEW_STALE };
        const context = buildPricingReviewContext(project, currentEstimate(freshState), source);
        if (!context.ok) return context;
        const pending = reviewPricingSuggestion(context.value, { message: "", suggestions: [{ source: "contractorMessage", ...range }] });
        if (!pending.ok) return pending;
        const draft = prepareReviewedPriceDraft(pending.value, 0, context.value, hasOpenEstimateWork(freshState) || freshState.advancedOpen || Object.keys(resourceSaveStatesRef.current).length > 0 || paymentWorkRef.current || scopeNotesWorkRef.current || experienceWorkRef.current || fullScopeWorkRef.current || openingWorkRef.current || Object.keys(activityWorkRef.current).length > 0);
        if (!draft.ok) return draft;
        store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: draft.value, lineId: newClientId() });
        return { ok: true };
    };
    const briefHref = `/dashboard/projects/brief?projectId=${encodeURIComponent(project.id)}`;
    const programmeHref = `/dashboard/projects/schedule?projectId=${encodeURIComponent(project.id)}`;
    const hasLines = lines.length > 0;
    const capabilities = advancedCapabilities();
    const showAdvancedLineWarning = !state.advancedOpen && Object.keys(state.ops).length > 0;

    const advancedSection = (
            <section className={`${s.card}`} aria-labelledby="advanced-estimating-title">
                <button
                    type="button"
                    onClick={toggleAdvanced}
                    aria-expanded={state.advancedOpen}
                    disabled={activityBusy || (state.advancedOpen && Object.values(resourceSaveStates).some(status => status === "saving" || status === "draft"))}
                    aria-controls="advanced-estimating"
                    aria-describedby={showAdvancedLineWarning ? "advanced-line-warning" : undefined}
                    className={`w-full min-h-14 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left ${s.body}`}
                >
                    <span>
                        <span id="advanced-estimating-title" className={`block text-base font-bold ${s.heading}`}>Advanced estimating</span>
                        <span className={`block text-sm ${s.muted}`}>
                            Optional. Bill of quantities, rate build-ups{capabilities.some((c) => c.key === "client-boq") ? ", BoQ import" : ""} and the cost library.
                        </span>
                    </span>
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${state.advancedOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>

                {showAdvancedLineWarning && (
                    <p id="advanced-line-warning" className={`${s.noticeBox} mx-4 sm:mx-5 mb-4 p-3 text-sm`}>
                        Opening Advanced estimating closes open price-line forms without saving their changes. Save or cancel your line first.
                    </p>
                )}

                {state.advancedOpen && (
                    <div id="advanced-estimating" className="px-3 sm:px-5 pb-5 space-y-4">
                        <ul className={`text-sm list-disc pl-5 space-y-0.5 ${s.muted}`}>
                            {capabilities.map((c) => <li key={c.key}>{c.label}</li>)}
                        </ul>
                        <p className={`text-sm ${s.muted}`}>
                            The simple price list is hidden while this is open. Close Advanced estimating to go back to it. The running total below covers both.
                            This workspace is laid out for a wide screen.
                        </p>

                        {advanced.status === "loading" && (
                            <p role="status" className={`text-sm flex items-center gap-2 ${s.body}`}>
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading the cost library and rates…
                            </p>
                        )}
                        {advanced.status === "failed" && (
                            <div role="alert" className={`${s.errorBox} flex flex-wrap items-center gap-3 text-sm`}>
                                <p className="flex-1 min-w-[12rem]">{advanced.error}</p>
                                <button type="button" onClick={() => void loadAdvanced()} className={`${s.secondaryButton} min-h-11 text-sm`}>Try again</button>
                            </div>
                        )}
                        {advanced.status === "ready" && advanced.data && (
                            <div data-wide-workspace className="rounded-xl bg-[#0d0d0d] p-3 sm:p-4 overflow-x-auto">
                                <div className="min-w-[760px]">
                                    <AdvancedEstimate
                                        estimates={state.estimates}
                                        setEstimates={(update) => store.dispatch({ type: "estimates/replace", update })}
                                        activeTab={estimate?.id ?? ""}
                                        setActiveTab={selectEstimate}
                                        costLibrary={advanced.data.costLibrary}
                                        projectId={project.id}
                                        orgId={advanced.data.orgId}
                                        rateBuildups={advanced.data.rateBuildups}
                                        labourRates={advanced.data.labourRates}
                                        preferredTrades={advanced.data.preferredTrades}
                                        resourceSaveStates={resourceSaveStates}
                                        onResourceSaveStateChanged={resourceSaveStateChanged}
                                        onLineSaveStateChanged={(lineId, status) => resourceSaveStateChanged(`line:${lineId}`, status)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>
    );

    return (
        <div className={`${ui.root} space-y-5`} data-theme={isDark ? "dark" : "light"}>
            <PricingFocus revision={state} />
            <div className={ui.header}>
                <p className={ui.eyebrow}>From a clear brief to a considered price</p>
                <h1 className={`${ui.title} text-2xl sm:text-3xl font-bold ${s.heading}`}>Build the price</h1>
                <p className={`mt-1 text-base break-words ${s.muted}`}>
                    {project.name}{project.client_name ? ` for ${project.client_name}` : ""}
                </p>
                <p className={ui.intro}>Add your price lines, then check the total and any adjustments below. Start simple and add detail as you need it.</p>
            </div>

            {/* What is being priced */}
            <section className={`${s.card} p-4 sm:p-5`} aria-labelledby="pricing-context-title">
                <div className="flex items-start justify-between gap-3">
                    <h2 id="pricing-context-title" className={`text-sm font-semibold ${s.muted}`}>What you&apos;re pricing</h2>
                    <Link href={briefHref} className={`${s.quietButton} -my-2 flex-shrink-0`}>Edit brief</Link>
                </div>
                {scope ? (
                    <>
                        <p className={`mt-1 text-base whitespace-pre-wrap break-words ${s.body}`}>
                            {scopeIsLong && !showFullScope ? `${scope.slice(0, SCOPE_PREVIEW_LENGTH).trimEnd()}…` : scope}
                        </p>
                        {scopeIsLong && (
                            <button type="button" onClick={() => setShowFullScope((v) => !v)} aria-expanded={showFullScope} className={`${s.quietButton} -ml-3 mt-1`}>
                                {showFullScope ? "Show less" : "Show all"}
                            </button>
                        )}
                    </>
                ) : (
                    <p className={`mt-1 text-base ${s.muted}`}>No job description yet. Add one in the brief so the price has something to refer to.</p>
                )}
                {scope && (
                    <div className="mt-3">
                        <button type="button" data-brief-price-draft aria-describedby="brief-price-draft-help"
                            disabled={briefDraftBlocked} onClick={startBriefPriceDraft} className={s.secondaryButton}>
                            Start a price line from this brief
                        </button>
                        <p id="brief-price-draft-help" className={`mt-2 text-sm ${s.muted}`}>{briefDraftHelp}</p>
                        {briefDraftError && <p role="alert" className={`mt-2 text-sm ${s.errorText}`}>{briefDraftError}</p>}
                        {pricingContext.ok && <BriefPriceExcerpt data-brief-excerpt context={pricingContext.value}
                            blocked={hasOpenWork || state.advancedOpen || pricingContext.value.clientBoQ}
                            blockedHelp={pricingContext.value.clientBoQ ? "Use the existing client BoQ workflow for this estimate." : PRICING_REVIEW_OPEN}
                            styles={s} onOpen={openReviewedBriefDraft} />}
                    </div>
                )}
            </section>

            {project.scope_notes && <PricingScopeNotesEditor projectId={project.id} source={project.scope_notes}
                lockReason={project.payment_lock_reason ?? null} styles={s} onWorkChange={scopeNotesWorkChanged} />}
            {project.experience && <PricingExperienceEditor key={project.id} projectId={project.id} source={project.experience}
                lockReason={project.payment_lock_reason ?? null} styles={s} onWorkChange={experienceWorkChanged} />}
            {project.experience === null && <p className={s.muted}>Saved experience sources could not be read. No choices have been changed; review experience on the proposal page.</p>}
            {project.full_scope && <PricingFullScopeEditor key={project.id} projectId={project.id} source={project.full_scope}
                lockReason={project.payment_lock_reason ?? null} styles={s} onWorkChange={fullScopeWorkChanged} />}
            {project.proposal_introduction !== undefined && <PricingOpeningEditor key={project.id} projectId={project.id} source={project.proposal_introduction}
                lockReason={project.payment_lock_reason ?? null} styles={s} onWorkChange={openingWorkChanged} />}

            <PricingAssistantPanel session={pricingAssistant} blocked={hasOpenWork || state.advancedOpen || !!estimate?.is_client_boq} />

            {pricingContext.ok && <PriceWorkList data-price-work-list context={pricingContext.value} styles={s}
                blocked={hasOpenEstimateWork(state) || state.advancedOpen || Object.keys(resourceSaveStates).length > 0 || paymentWork || scopeNotesWork || experienceWork || fullScopeWork || openingWork || activityBusy || pricingContext.value.clientBoQ}
                blockedHelp={pricingContext.value.clientBoQ ? "Use the existing client BoQ workflow for this estimate." : PRICING_REVIEW_OPEN}
                onWorkChange={workListChanged} onOpen={openWorkListDraft} />}

            {/* Current version stays visible without competing with price entry. */}
            {estimate && (state.estimates.length > 1 || !estimate.is_active) && (
                <p className={ui.versionCurrent} data-current-estimate>
                    Pricing: <strong>{estimate.version_name || "Estimate"}</strong>.{" "}
                    {estimate.is_active ? "Used in the proposal." : "Alternative; not used in the proposal."}
                </p>
            )}

            {state.notice && (
                <div role="status" className={`${s.noticeBox} flex items-start gap-3 text-sm`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="flex-1">{state.notice}</p>
                    <button type="button" onClick={() => store.dispatch({ type: "notice/clear" })} className="underline font-semibold">Dismiss</button>
                </div>
            )}

            {/* Price lines */}
            {Object.values(activityWork).includes("uncertain") && <p role="alert" data-activity-save-warning className={`${s.errorBox} p-4 text-sm`}>
                An activity assignment is not confirmed and may have saved. Reload to reconcile it before making more estimating changes. This action does not change line prices or resources.
            </p>}
            {hasUnconfirmedLineChanges && <p role="alert" data-line-save-warning className={`${s.errorBox} p-4 text-sm`}>
                Some line changes are not confirmed. Displayed totals include unconfirmed line edits, not a confirmed saved estimate. Reload to reconcile the saved prices before using them.
            </p>}
            {!state.advancedOpen && (
                <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="price-lines-title">
                    <div className={ui.priceLinesHeader}>
                        <h2 id="price-lines-title" tabIndex={-1} className={`text-lg font-bold ${s.heading}`}>Price lines</h2>
                        {(hasLines || showInlineNew) && (
                            <button type="button" aria-controls="price-line-table" aria-pressed={showLineDetails}
                                onClick={() => setShowLineDetails(value => !value)} className={s.quietButton}>
                                {showLineDetails ? "Hide quantities and rates" : "Show quantities and rates"}
                            </button>
                        )}
                        {hasLines && <button type="button" aria-controls="price-line-table" aria-pressed={showActivityGroups}
                            data-price-activity-view onClick={() => setShowActivityGroups(value => !value)} className={s.quietButton}>
                            {showActivityGroups ? "Hide activity breakdown" : "Show activity breakdown"}
                        </button>}
                        {hasLines && <button type="button" aria-controls="price-line-finder" aria-expanded={finderOpen}
                            data-price-find-toggle onClick={() => updatePriceFind({ open: !finderOpen, query: "", activeId: null })} className={s.quietButton}>
                            {finderOpen ? "Close finder" : "Find price lines"}
                        </button>}
                    </div>
                    {hasLines && <SavedLineReuse key={`${project.id}:${estimate?.id}`} context={savedLineReuseContext(project, estimate)}
                        blocked={hasOpenWork || !!project.payment_lock_reason} blockReason={project.payment_lock_reason} onOpen={openSavedLineDraft} s={s} />}
                    {finderOpen && <div id="price-line-finder" className={ui.priceLineFinder}>
                        <label htmlFor="price-line-find-query" className={s.label}>Find description or activity</label>
                        <input id="price-line-find-query" aria-describedby="price-line-find-help price-line-find-count" type="search"
                            maxLength={500} autoComplete="off" value={priceFind.query} className={s.input}
                            onChange={event => updatePriceFind({ query: event.target.value, activeId: null })} />
                        <p id="price-line-find-count" role="status" aria-live="polite" className={s.muted}>
                            {!priceFind.query.trim() ? "Enter text to find existing price lines." : foundIds.length === 0 ? "No matching price lines." :
                                `${foundIds.length} matching ${foundIds.length === 1 ? "line" : "lines"}${foundIndex >= 0 ? `; current ${foundIndex + 1} of ${foundIds.length}` : "; choose Previous or Next"}.`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={!foundIds.length} className={s.secondaryButton} onClick={() => visitPriceMatch(-1)}>Previous match</button>
                            <button type="button" disabled={!foundIds.length} className={s.secondaryButton} onClick={() => visitPriceMatch(1)}>Next match</button>
                            <button type="button" disabled={!priceFind.query} className={s.quietButton} onClick={() => updatePriceFind({ query: "", activeId: null })}>Clear finder</button>
                        </div>
                        <p id="price-line-find-help" className={s.muted}>All rows stay visible and totals still include the whole estimate. Uses displayed estimate wording, not open draft wording. Typing does not move focus or save.</p>
                    </div>}
                    {showActivityGroups && hasLines && <p id="price-activity-help" className={`mt-3 text-sm ${s.muted}`}>
                        Line order is unchanged. Repeated activities continue later; each activity subtotal appears once, after its last line.
                        Subtotals add the displayed line prices only, excluding open drafts. Adjustments and VAT are in the running total below.
                    </p>}

                    {!hasLines && !newOp ? (
                        <div className="py-8 text-center" data-empty-estimate>
                            <p className={`text-lg font-semibold ${s.heading}`}>No prices yet</p>
                            <p className={`mt-1 text-base max-w-md mx-auto ${s.muted}`}>
                                Start with one figure for the whole job, or break it down line by line. You can add detail later.
                            </p>
                            <button type="button" onClick={openAdd} className={`${s.primaryButton} mt-5 w-full sm:w-auto`}>
                                <Plus className="w-5 h-5" aria-hidden="true" /> Add the first price line
                            </button>
                        </div>
                    ) : (
                        <>
                            {(hasLines || showInlineNew) && <table ref={priceTableRef} id="price-line-table" className={ui.priceLinesTable}
                                aria-describedby={showActivityGroups && hasLines ? "price-activity-help" : undefined}>
                                <caption className={ui.priceTableCaption}>Change a line to edit it. Totals update after a confirmed save.</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Work</th>
                                        {showLineDetails && <>
                                            <th scope="col">Quantity</th>
                                            <th scope="col">Unit</th>
                                            <th scope="col">Rate</th>
                                        </>}
                                        <th scope="col">Price</th>
                                        <th scope="col">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                {priceActivityRows(lines).flatMap(({ line, heading, subtotal }) => [
                                    ...(showActivityGroups && heading ? [<tr key={`activity-heading-${line.id}`} className={ui.priceActivityHeading} data-activity-heading={heading.section}>
                                        <td colSpan={showLineDetails ? 6 : 3}><strong>{heading.section}</strong>{heading.continued && <span> (continued)</span>}</td>
                                    </tr>] : []),
                                    <PriceLineRow
                                        key={line.id}
                                        line={line}
                                        editable={!!estimate && isSimpleEditable(line, estimate)}
                                        isClientBoQ={!!estimate?.is_client_boq}
                                        op={state.ops[line.id]}
                                        s={s}
                                        isDark={isDark}
                                        showDetails={showLineDetails}
                                        onEdit={() => openEdit(line)}
                                        onDelete={() => openDelete(line)}
                                        onChange={(patch) => store.dispatch({ type: "op/change", key: line.id, patch })}
                                        onUseArea={quantity => applyInlineArea(line.id, state.ops[line.id], quantity)}
                                        onCancel={() => store.dispatch({ type: "op/cancel", key: line.id })}
                                        onSave={() => void submitPriceLine(store, server, project.id, line.id)}
                                        onFullForm={() => showFullLineForm(line.id)}
                                        fullAmountForm={!!fullAmountLineIds[line.id]}
                                        onInlineForm={() => showInlineLineForm(line.id)}
                                        onConfirmDelete={() => void removePriceLine(store, server, line.id)}
                                        nextLine={nextEditableSavedLine(estimate, line.id)}
                                        nextBlocked={!!state.ops[nextEditableSavedLine(estimate, line.id)?.id ?? ""]}
                                        onSaveNext={() => saveAndChangeNext(line.id, state.ops[line.id], nextEditableSavedLine(estimate, line.id))}
                                        focusDescription={nextEditFocusId === line.id}
                                        priceBlocked={activityBusy}
                                        finderMatch={foundSet.has(line.id)} finderCurrent={foundIndex >= 0 && priceFind.activeId === line.id}
                                        activityControl={estimate && isSimpleEditable(line, estimate) && line.trade_section !== "Preliminaries" && !state.ops[line.id] ? <LineActivity
                                            lineId={line.id} estimateId={estimate.id} section={line.trade_section ?? null}
                                            choices={[...new Set(lines.map(item => item.trade_section).filter(section => section && section !== "Preliminaries"))]}
                                            styles={s} blocked={hasOpenEstimateWork(state) || Object.keys(resourceSaveStates).length > 0 || paymentWork || scopeNotesWork || experienceWork || fullScopeWork || openingWork || Object.keys(activityWork).some(id => id !== line.id)}
                                            onBegin={() => beginActivity(line.id)} onWork={status => activityWorkChanged(line.id, status)} onSaved={activitySaved} /> : null}
                                    />,
                                    ...(showActivityGroups && subtotal ? [<tr key={`activity-subtotal-${line.id}`} className={ui.priceActivitySubtotal} data-activity-subtotal={subtotal.section}>
                                        <td colSpan={showLineDetails ? 6 : 3}><div>
                                            <p><strong>{subtotal.section}: line-price subtotal</strong><span>{subtotal.lineCount} {subtotal.lineCount === 1 ? "line" : "lines"}{subtotal.blocks > 1 ? ` across ${subtotal.blocks} blocks` : ""}. Before adjustments and VAT.{(hasUnconfirmedLineChanges || Object.values(activityWork).includes("uncertain")) ? " Not confirmed." : ""}</span></p>
                                            <strong className={ui.priceActivityAmount}>{subtotal.amount === null ? "Subtotal unavailable" : formatGBP(subtotal.amount)}</strong>
                                        </div></td>
                                    </tr>] : []),
                                ])}
                                {showInlineNew && newLineProps && <InlineNewPriceLine key={newOp!.lineId} {...newLineProps}
                                    data-inline-add showDetails={showLineDetails}
                                    onUseArea={quantity => applyInlineArea(NEW_LINE_KEY, newOp, quantity)}
                                    onFullForm={() => setFullNewLineId(newOp!.lineId)} />}
                                </tbody>
                            </table>}

                            {newOp && newLineProps ? !showInlineNew && (
                                <div className={`mt-4 ${s.inset} p-4`}>
                                    <button type="button" disabled={newOp.status === "saving"} className={`${s.quietButton} mb-3`}
                                        onClick={() => { setFullNewLineId(null); if (newOp.draft.mode === "rate") setShowLineDetails(true); }}>Back to table row</button>
                                    <LineForm key={newOp.lineId} {...newLineProps} />
                                </div>
                            ) : (
                                <button type="button" disabled={activityBusy} onClick={openAdd} className={`${s.secondaryButton} mt-4 w-full sm:w-auto`}>
                                    <Plus className="w-5 h-5" aria-hidden="true" /> Add a price line
                                </button>
                            )}
                        </>
                    )}
                </section>
            )}

            {state.advancedOpen && advancedSection}

            {/* Running total. In the page flow, so it never sits over a row or a button. */}
            <TotalCard
                summary={summary}
                estimate={estimate}
                lines={lines}
                state={state.adjustments}
                s={s}
                onToggle={() => store.dispatch({ type: "adjustments/toggle" })}
                onChange={(patch) => store.dispatch({ type: "adjustments/change", patch })}
                onSave={() => void submitAdjustments(store, server)}
            />

            {project.payment_schedule !== undefined && <PricingPaymentStages projectId={project.id} schedule={project.payment_schedule}
                lockReason={project.payment_lock_reason ?? null} styles={s} onWorkChange={paymentWorkChanged} />}

            {hasLines && (
                <div className="flex justify-end">
                    <Link href={programmeHref} className={`${s.primaryButton} w-full sm:w-auto`}>
                        Next: Programme <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                </div>
            )}

            {/* Optional version selection stays out of the first-price task. */}
            {state.estimates.length > 1 && (
                <details className={ui.versionDisclosure} data-estimate-versions>
                    <summary className={ui.versionSummary}>Estimate versions</summary>
                    <div className={ui.versionBody}>
                        <p id="estimate-version-help">
                            Switch between saved versions. Save or cancel any open changes before switching. This only changes what you are viewing.
                        </p>
                        <label htmlFor="estimate-version" className={s.label}>View a saved version</label>
                        <select
                            id="estimate-version"
                            value={estimate?.id ?? ""}
                            onChange={(e) => selectEstimate(e.target.value)}
                            disabled={hasOpenWork}
                            aria-describedby="estimate-version-help"
                            className={s.input}
                        >
                            {state.estimates.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.version_name || "Estimate"}{e.is_active ? " (used in the proposal)" : ""}
                                </option>
                            ))}
                        </select>
                        <p>To add an alternative or change which version is used in the proposal, open Advanced estimating, then Estimate versions and alternatives.</p>
                    </div>
                </details>
            )}

            {/* Offered last while closed, so it does not compete with the simple list. */}
            {!state.advancedOpen && advancedSection}

            <aside className={ui.totalDock} aria-label="Estimate total kept in view" data-running-total>
                <span>Total before VAT</span>
                <strong data-in-view-contract-sum>{formatGBP(summary.contractSum)}</strong>
                <p>May include changes not yet confirmed.</p>
            </aside>
        </div>
    );
}

// ─── One price line ──────────────────────────────────────

function PriceLineRow({
    line, editable, isClientBoQ, op, s, isDark, showDetails, onEdit, onDelete, onChange, onUseArea, onCancel, onSave, onFullForm, onInlineForm, fullAmountForm = false, onConfirmDelete, nextLine, nextBlocked = false, onSaveNext, focusDescription = false, activityControl, priceBlocked = false, finderMatch = false, finderCurrent = false,
}: {
    line: EstimateLine;
    editable: boolean;
    isClientBoQ: boolean;
    op: LineOp | undefined;
    s: WorkspaceStyles;
    isDark: boolean;
    showDetails: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
    onFullForm: () => void;
    onConfirmDelete: () => void;
    nextLine?: EstimateLine | null;
    nextBlocked?: boolean;
    onSaveNext?: () => Promise<void>;
    focusDescription?: boolean;
    onInlineForm: () => void;
    fullAmountForm?: boolean;
    onUseArea: (quantity: string) => void;
    activityControl?: ReactNode;
    priceBlocked?: boolean;
    finderMatch?: boolean;
    finderCurrent?: boolean;
}) {
    const name = line.description?.trim() || "No description yet";
    const isAmount = Number(line.quantity) === 1 && (line.unit === "item" || !line.unit);
    const section = line.trade_section && line.trade_section !== "General" ? line.trade_section : "";

    if (op && op.kind === "edit") {
        if (editable && op.draft.mode === "amount" && !fullAmountForm) {
            return <InlineAmountEditor data-inline-amount-editor={line.id} line={line} op={op} s={s} showDetails={showDetails}
                finderMatch={finderMatch} finderCurrent={finderCurrent}
                nextLine={nextLine} nextBlocked={nextBlocked} onSaveNext={onSaveNext} focusDescription={focusDescription}
                onChange={onChange} onCancel={onCancel} onSave={onSave} onFullForm={onFullForm} />;
        }
        if (editable && showDetails && op.draft.mode === "rate" && !fullAmountForm) {
            return <InlineRateEditor data-inline-editor={line.id} line={line} op={op} s={s}
                finderMatch={finderMatch} finderCurrent={finderCurrent}
                nextLine={nextLine} nextBlocked={nextBlocked} onSaveNext={onSaveNext} focusDescription={focusDescription}
                onChange={onChange} onUseArea={onUseArea} onCancel={onCancel} onSave={onSave} onFullForm={onFullForm} />;
        }
        return (
            <tr className={ui.priceFormRow} data-price-line={line.id} tabIndex={-1} data-price-find-match={finderMatch || undefined} data-price-find-current={finderCurrent || undefined}><td colSpan={showDetails ? 6 : 3}>
                {fullAmountForm && <button type="button" disabled={op.status === "saving"} onClick={onInlineForm} className={`${s.quietButton} mb-3`}>Back to table row</button>}
                <LineForm idPrefix={`line-${line.id}`} title="Change this line" op={op} s={s} isDark={isDark} onChange={onChange} onCancel={onCancel} onSave={onSave} />
            </td></tr>
        );
    }

    const iconButton = `min-h-11 min-w-11 rounded-lg inline-flex items-center justify-center transition-colors ${
        isDark ? "text-slate-300 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
    }`;

    return (
        <>
        <tr data-price-line={line.id} tabIndex={-1} data-price-find-match={finderMatch || undefined} data-price-find-current={finderCurrent || undefined}>
                <td className={ui.priceLineDescription}>
                    <p className={`text-base font-semibold break-words ${line.description?.trim() ? s.body : s.muted}`}>{name}</p>
                    <p className={`text-sm ${s.muted}`}>
                        {[
                            section,
                            isAmount || showDetails ? "" : `${Number(line.quantity)} ${line.unit} × ${formatGBP(Number(line.unit_rate) || 0)}`,
                            line.pricing_mode === "buildup" ? "Rate build-up" : "",
                            isClientBoQ ? "Client BoQ" : "",
                        ].filter(Boolean).join(" · ")}
                    </p>
                    {!editable && (
                        <p className={`text-sm ${s.muted}`}>Change this line in Advanced estimating.</p>
                    )}
                    {activityControl}
                </td>
                {showDetails && (isAmount
                    ? <td colSpan={3} className={ui.priceOneAmount}>One price</td>
                    : <>
                        <td data-label="Quantity" className={ui.priceLineNumber}>{Number(line.quantity)}</td>
                        <td data-label="Unit" className={ui.priceLineUnit}>{line.unit}</td>
                        <td data-label="Rate" className={ui.priceLineNumber}>{formatGBP(Number(line.unit_rate) || 0)}</td>
                    </>)}
                <td data-label="Price" className={ui.priceLineAmount}>{formatGBP(Number(line.line_total) || 0)}</td>
                <td className={ui.priceLineActions}>
                    {!(op && op.kind === "delete") && editable && (
                        <div className="flex flex-wrap gap-1">
                            <button type="button" disabled={priceBlocked} onClick={onEdit} aria-label={`Change ${name}`} className={`${iconButton} px-2 gap-1.5 text-sm font-semibold`}>
                                <Pencil className="w-4 h-4" aria-hidden="true" /> Change
                            </button>
                            <button type="button" disabled={priceBlocked} onClick={onDelete} aria-label={`Remove ${name}`} className={`${iconButton} px-2 gap-1.5 text-sm font-semibold`}>
                                <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                            </button>
                        </div>
                    )}
                </td>
        </tr>

            {op && op.kind === "delete" && (
                <tr className={ui.priceFormRow}><td colSpan={showDetails ? 6 : 3}>
                <div role={op.status === "failed" ? "alert" : undefined} className={`mt-3 ${op.status === "failed" ? s.errorBox : s.noticeBox} space-y-3`}>
                    <p className="text-sm font-medium">
                        {op.status === "failed"
                            ? op.error
                            : `Remove this line? ${formatGBP(Number(line.line_total) || 0)} will come off your price lines.`}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button type="button" onClick={onConfirmDelete} disabled={op.status === "saving"} className={`${s.secondaryButton} min-h-11 text-sm`}>
                            {op.status === "saving"
                                ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Removing…</>
                                : op.status === "failed" ? "Try again" : "Remove line"}
                        </button>
                        <button type="button" onClick={onCancel} disabled={op.status === "saving"} className={`${s.quietButton}`}>
                            Keep it
                        </button>
                    </div>
                </div>
                </td></tr>
            )}
        </>
    );
}

function InlineAmountEditor({ line, op, s, showDetails, onChange, onCancel, onSave, onFullForm, nextLine, nextBlocked = false, onSaveNext, focusDescription = false, finderMatch = false, finderCurrent = false }: {
    "data-inline-amount-editor": string;
    line: EstimateLine;
    op: LineOp;
    s: WorkspaceStyles;
    showDetails: boolean;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
    onFullForm: () => void;
    nextLine?: EstimateLine | null;
    nextBlocked?: boolean;
    onSaveNext?: () => Promise<void>;
    focusDescription?: boolean;
    finderMatch?: boolean;
    finderCurrent?: boolean;
}) {
    const { draft, fieldErrors } = op;
    const saving = op.status === "saving";
    const prefix = `line-${line.id}`;
    const formId = `${prefix}-amount-form`;
    const total = draftLineTotal(draft);
    const field = (name: "description" | "amount", label: string) => ({
        id: `${prefix}-${name}`, form: formId, disabled: saving, "aria-label": `${label} for ${line.description || "this line"}`,
        "aria-invalid": fieldErrors[name] ? true : undefined,
        "aria-describedby": fieldErrors[name] ? `${prefix}-${name}-error` : undefined,
    });
    const error = (name: "description" | "amount") => fieldErrors[name]
        ? <p id={`${prefix}-${name}-error`} className={`mt-1 text-sm ${s.errorText}`}>{fieldErrors[name]}</p> : null;

    return <tr className={ui.priceInlineEditor} data-price-line={line.id} tabIndex={-1}
        data-price-find-match={finderMatch || undefined} data-price-find-current={finderCurrent || undefined}>
        <td className={ui.priceLineDescription}>
            <form id={formId} noValidate aria-label={`Change one price for ${line.description || "this line"}`} aria-busy={saving}
                onSubmit={event => { event.preventDefault(); onSave(); }}>
                <input {...field("description", "Work description")} value={draft.description} autoFocus={focusDescription} maxLength={500} autoComplete="off"
                    className={s.input} onChange={event => onChange({ description: event.target.value })} />
                {error("description")}
            </form>
            <p className={`mt-2 text-sm ${s.muted}`}>Draft only until Save line. One price for this work.</p>
            {op.status === "failed" && <p role="alert" className={`mt-2 text-sm ${s.errorText}`}>{op.error}</p>}
        </td>
        {showDetails && <td colSpan={3} className={ui.priceOneAmount}>One price</td>}
        <td data-label="Price" className={ui.priceLineAmount}>
            <input {...field("amount", "Price in pounds")} value={draft.amount} inputMode="decimal" autoComplete="off"
                className={s.input} onChange={event => onChange({ amount: event.target.value })} />
            {error("amount")}
            <p aria-live="polite" className={`mt-2 ${s.body}`}>Draft <strong>{total === null ? "Check entries" : formatGBP(total)}</strong></p>
            <p className={`mt-2 text-sm ${s.muted}`}>Saved {formatGBP(Number(line.line_total) || 0)}</p>
        </td>
        <td className={ui.priceLineActions}>
            <div className="flex flex-wrap gap-2">
                <button type="submit" form={formId} disabled={saving} className={s.primaryButton}>
                    {saving ? "Saving..." : op.status === "failed" ? "Try again" : "Save line"}
                </button>
                {nextLine && onSaveNext && <button type="button" disabled={saving || nextBlocked} onClick={onSaveNext} className={s.secondaryButton}>Save and change next</button>}
                <button type="button" disabled={saving} onClick={onCancel} className={s.secondaryButton}>Cancel</button>
                <button type="button" disabled={saving} onClick={onFullForm} className={s.quietButton}>Full line form</button>
            </div>
            {nextLine && onSaveNext && <p className={`mt-2 text-sm ${s.muted}`}>Next editable saved line: {nextLine.description || "No description yet"}.{nextBlocked ? " This line already has open work; finish it first." : " Opens only after this save is confirmed."}</p>}
        </td>
    </tr>;
}

function InlineRateEditor({ line, op, s, onChange, onUseArea, onCancel, onSave, onFullForm, nextLine, nextBlocked = false, onSaveNext, focusDescription = false, finderMatch = false, finderCurrent = false }: {
    "data-inline-editor": string;
    line: EstimateLine;
    op: LineOp;
    s: WorkspaceStyles;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onUseArea: (quantity: string) => void;
    onCancel: () => void;
    onSave: () => void;
    onFullForm: () => void;
    nextLine?: EstimateLine | null;
    nextBlocked?: boolean;
    onSaveNext?: () => Promise<void>;
    focusDescription?: boolean;
    finderMatch?: boolean;
    finderCurrent?: boolean;
}) {
    const { draft, fieldErrors } = op;
    const saving = op.status === "saving";
    const prefix = `line-${line.id}`;
    const formId = `${prefix}-inline-form`;
    const total = draftLineTotal(draft);
    const field = (name: "description" | "quantity" | "unit" | "rate", label: string) => ({
        id: `${prefix}-${name}`, form: formId, disabled: saving, "aria-label": `${label} for ${line.description || "this line"}`,
        "aria-invalid": fieldErrors[name] ? true : undefined,
        "aria-describedby": fieldErrors[name] ? `${prefix}-${name}-error` : undefined,
    });
    const error = (name: keyof typeof fieldErrors) => fieldErrors[name]
        ? <p id={`${prefix}-${name}-error`} className={`mt-1 text-sm ${s.errorText}`}>{fieldErrors[name]}</p> : null;

    return <tr className={ui.priceInlineEditor} data-price-line={line.id} tabIndex={-1} data-price-find-match={finderMatch || undefined} data-price-find-current={finderCurrent || undefined}>
        <td className={ui.priceLineDescription}>
            <form id={formId} noValidate aria-label={`Change quantity and rate for ${line.description || "this line"}`}
                aria-busy={saving} onSubmit={event => { event.preventDefault(); onSave(); }}>
                <input {...field("description", "Work description")} value={draft.description} autoFocus={focusDescription} maxLength={500} autoComplete="off"
                    className={s.input} onChange={event => onChange({ description: event.target.value })} />
                {error("description")}
            </form>
            <p className={`mt-2 text-sm ${s.muted}`}>Draft only until Save line. Use Tab to move between fields.</p>
            {draft.mode === "rate" && <AreaQuantityAid key={`${op.lineId}:${draft.unit}`} idPrefix={`${prefix}-area`} unit={draft.unit} disabled={saving} onUse={onUseArea} />}
            {op.status === "failed" && <p role="alert" className={`mt-2 text-sm ${s.errorText}`}>{op.error}</p>}
        </td>
        <td data-label="Quantity" className={ui.priceLineNumber}>
            <input {...field("quantity", "Quantity")} value={draft.quantity} inputMode="decimal" autoComplete="off"
                className={s.input} onChange={event => onChange({ quantity: event.target.value })} />
            {error("quantity")}
        </td>
        <td data-label="Unit" className={ui.priceLineUnit}>
            <select {...field("unit", "Unit")} value={draft.unit} className={s.input}
                onChange={event => onChange({ unit: event.target.value })}>
                {unitOptions(draft.unit).map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
            {error("unit")}
        </td>
        <td data-label="Rate" className={ui.priceLineNumber}>
            <input {...field("rate", "Rate in pounds")} value={draft.rate} inputMode="decimal" autoComplete="off"
                className={s.input} onChange={event => onChange({ rate: event.target.value })} />
            {error("rate")}
        </td>
        <td data-label="Price" className={ui.priceLineAmount}>
            <p aria-live="polite" className={s.body}>Draft <strong>{total === null ? "Check entries" : formatGBP(total)}</strong></p>
            <p className={`mt-2 text-sm ${s.muted}`}>Saved {formatGBP(Number(line.line_total) || 0)}</p>
        </td>
        <td className={ui.priceLineActions}>
            <div className="flex flex-wrap gap-2">
                <button type="submit" form={formId} disabled={saving} className={s.primaryButton}>
                    {saving ? "Saving..." : op.status === "failed" ? "Try again" : "Save line"}
                </button>
                {nextLine && onSaveNext && <button type="button" disabled={saving || nextBlocked} onClick={onSaveNext} className={s.secondaryButton}>Save and change next</button>}
                <button type="button" disabled={saving} onClick={onCancel} className={s.secondaryButton}>Cancel</button>
                <button type="button" disabled={saving} onClick={onFullForm} className={s.quietButton}>Full line form</button>
            </div>
            {nextLine && onSaveNext && <p className={`mt-2 text-sm ${s.muted}`}>Next editable saved line: {nextLine.description || "No description yet"}.{nextBlocked ? " This line already has open work; finish it first." : " Opens only after this save is confirmed."}</p>}
            <p className={`mt-2 text-sm ${s.muted}`}>Full form includes one-price entry.</p>
        </td>
    </tr>;
}

// ─── Add / change form ───────────────────────────────────

function InlineNewPriceLine({ idPrefix, title, op, s, showDetails, onChange, onUseArea, onCancel, onSave, onSaveNext, onFullForm, activityNames }: {
    "data-inline-add": boolean;
    idPrefix: string;
    title: string;
    op: LineOp;
    s: WorkspaceStyles;
    showDetails: boolean;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onUseArea: (quantity: string) => void;
    onCancel: () => void;
    onSave: () => void;
    onSaveNext?: () => void;
    onFullForm: () => void;
    activityNames?: string[];
}) {
    const { draft, fieldErrors } = op;
    const saving = op.status === "saving";
    const formId = `${idPrefix}-inline-form`;
    const total = draftLineTotal(draft);
    const field = (name: keyof typeof fieldErrors, label: string) => ({
        id: `${idPrefix}-${name}`, form: formId, disabled: saving, "aria-label": label,
        "aria-invalid": fieldErrors[name] ? true : undefined,
        "aria-describedby": fieldErrors[name] ? `${idPrefix}-${name}-error` : undefined,
    });
    const error = (name: keyof typeof fieldErrors) => fieldErrors[name]
        ? <p id={`${idPrefix}-${name}-error`} className={`mt-1 text-sm ${s.errorText}`}>{fieldErrors[name]}</p> : null;

    return <tr className={`${ui.priceInlineEditor} ${ui.priceInlineNew}`} data-new-price-line={op.lineId}
        onKeyDown={event => {
            const fieldId = (event.target as HTMLElement).id;
            if (!onSaveNext || saving || event.defaultPrevented || event.repeat || event.nativeEvent.isComposing
                || event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey
                || !["description", "amount", "quantity", "unit", "rate"].some(name => fieldId === `${idPrefix}-${name}`)) return;
            event.preventDefault(); onSaveNext();
        }}>
        <td className={ui.priceLineDescription}>
            <form id={formId} noValidate aria-label={title} aria-busy={saving}
                onSubmit={event => { event.preventDefault(); onSave(); }}>
                <label htmlFor={`${idPrefix}-description`} className={s.label}>{title}</label>
                <input {...field("description", "New work description")} value={draft.description} maxLength={500}
                    autoComplete="off" autoFocus={op.kind === "add"} className={`${s.input} mt-2`}
                    onChange={event => onChange({ description: event.target.value })} />
                {error("description")}
            </form>
            {activityNames && <NewPriceActivity id={`${idPrefix}-activity`} form={formId} value={draft.activity ?? ""}
                names={activityNames} disabled={saving} error={fieldErrors.activity} onChange={activity => onChange({ activity })} s={s} />}
            <div className={ui.newPriceMethods} role="group" aria-label="How to price the new line">
                <button type="button" disabled={saving} aria-pressed={draft.mode === "amount"} onClick={() => onChange({ mode: "amount" })}>One price</button>
                <button type="button" disabled={saving} aria-pressed={draft.mode === "rate"} onClick={() => onChange({ mode: "rate" })}>Quantity and rate</button>
            </div>
            <p className={`mt-2 text-sm ${s.muted}`}>Not saved. Tab between fields; save only when ready.</p>
            {draft.mode === "rate" && <AreaQuantityAid key={`${op.lineId}:${draft.unit}`} idPrefix={`${idPrefix}-area`} unit={draft.unit} disabled={saving} onUse={onUseArea} />}
            {op.status === "failed" && <p role="alert" className={`mt-2 text-sm ${s.errorText}`}>{op.error}</p>}
        </td>
        {showDetails && (draft.mode === "amount" ? <td colSpan={3} className={ui.priceOneAmount}>One price</td> : <>
            <td data-label="Quantity" className={ui.priceLineNumber}>
                <input {...field("quantity", "New priced quantity")} value={draft.quantity} inputMode="decimal" autoComplete="off"
                    className={s.input} onChange={event => onChange({ quantity: event.target.value })} />
                {error("quantity")}
            </td>
            <td data-label="Unit" className={ui.priceLineUnit}>
                <select {...field("unit", "New priced unit")} value={draft.unit} className={s.input} onChange={event => onChange({ unit: event.target.value })}>
                    {unitOptions(draft.unit).map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                {error("unit")}
            </td>
            <td data-label="Rate" className={ui.priceLineNumber}>
                <input {...field("rate", "New unit rate in pounds")} value={draft.rate} inputMode="decimal" autoComplete="off"
                    className={s.input} onChange={event => onChange({ rate: event.target.value })} />
                {error("rate")}
            </td>
        </>)}
        <td data-label="Price" className={ui.priceLineAmount}>
            {draft.mode === "amount" && <>
                <label className={s.label} htmlFor={`${idPrefix}-amount`}>Price (£)</label>
                <input {...field("amount", "New line price in pounds")} value={draft.amount} inputMode="decimal" autoComplete="off"
                    className={`${s.input} mt-2`} onChange={event => onChange({ amount: event.target.value })} />
                {error("amount")}
            </>}
            <p aria-live="polite" className={`mt-2 ${s.body}`}>Draft <strong>{total === null ? "Check entries" : formatGBP(total)}</strong></p>
        </td>
        <td className={ui.priceLineActions}>
            <div className="flex flex-wrap gap-2">
                <button type="submit" form={formId} disabled={saving} className={s.primaryButton}>{saving ? "Saving..." : op.status === "failed" ? "Try again" : "Save line"}</button>
                {onSaveNext && <button type="button" disabled={saving} onClick={onSaveNext} className={s.secondaryButton}>Save and add next</button>}
                <button type="button" disabled={saving} onClick={onCancel} className={s.secondaryButton}>Cancel</button>
                <button type="button" disabled={saving} onClick={onFullForm} className={s.quietButton}>Full line form</button>
            </div>
            <p className={`mt-2 text-sm ${s.muted}`}>Ctrl/Command+Enter saves and adds next. Area results stay in this draft until Save line.</p>
        </td>
    </tr>;
}

function LineForm({
    idPrefix, title, op, s, isDark, onChange, onCancel, onSave, onSaveNext, activityNames,
}: {
    idPrefix: string;
    title: string;
    op: LineOp;
    s: WorkspaceStyles;
    isDark: boolean;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
    onSaveNext?: () => void;
    activityNames?: string[];
}) {
    const { draft, fieldErrors } = op;
    const saving = op.status === "saving";
    const total = draftLineTotal(draft);

    const field = (name: keyof typeof fieldErrors) => ({
        id: `${idPrefix}-${name}`,
        disabled: saving,
        "aria-invalid": fieldErrors[name] ? true : undefined,
        "aria-describedby": fieldErrors[name] ? `${idPrefix}-${name}-error` : undefined,
    });
    const fieldError = (name: keyof typeof fieldErrors) =>
        fieldErrors[name] ? <p id={`${idPrefix}-${name}-error`} className={`mt-1.5 text-sm ${s.errorText}`}>{fieldErrors[name]}</p> : null;

    const modeButton = (mode: PriceLineDraft["mode"], label: string) => (
        <button
            type="button"
            aria-pressed={draft.mode === mode}
            disabled={saving}
            onClick={() => onChange({ mode })}
            className={`min-h-11 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                draft.mode === mode
                    ? "border-blue-500 bg-blue-600 text-white"
                    : isDark ? "border-[#3a3a3a] text-slate-200 hover:border-slate-400" : "border-gray-300 text-gray-800 hover:border-gray-500"
            }`}
        >
            {label}
        </button>
    );

    return (
        <form noValidate onSubmit={(e) => { e.preventDefault(); onSave(); }}
            onKeyDown={event => {
                const fieldId = (event.target as HTMLElement).id;
                if (!onSaveNext || saving || event.defaultPrevented || event.repeat || event.nativeEvent.isComposing
                    || event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey
                    || !["description", "amount", "quantity", "unit", "rate"].some(name => fieldId === `${idPrefix}-${name}`)) return;
                event.preventDefault();
                onSaveNext();
            }} className="space-y-4" aria-label={title}>
            <p className={`text-base font-bold ${s.heading}`}>{title}</p>
            {op.kind === "add" && activityNames && <NewPriceActivity id={`${idPrefix}-activity`} value={draft.activity ?? ""}
                names={activityNames} disabled={saving} error={fieldErrors.activity} onChange={activity => onChange({ activity })} s={s} />}

            <div>
                <label htmlFor={`${idPrefix}-description`} className={s.label}>What is this price for?</label>
                <input
                    {...field("description")}
                    value={draft.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="e.g. Bathroom refit, labour and materials"
                    autoComplete="off"
                    autoFocus={op.kind === "add"}
                    maxLength={500}
                    className={`${s.input} mt-1.5`}
                />
                {fieldError("description")}
            </div>

            <fieldset>
                <legend className={s.label}>How do you want to price it?</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {modeButton("amount", "One price")}
                    {modeButton("rate", "Quantity and rate")}
                </div>
            </fieldset>

            {draft.mode === "amount" ? (
                <div>
                    <label htmlFor={`${idPrefix}-amount`} className={s.label}>Price (£)</label>
                    <input
                        {...field("amount")}
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft.amount}
                        onChange={(e) => onChange({ amount: e.target.value })}
                        placeholder="e.g. 2500"
                        className={`${s.input} mt-1.5 sm:max-w-xs`}
                    />
                    {fieldError("amount")}
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div>
                        <label htmlFor={`${idPrefix}-quantity`} className={s.label}>Quantity</label>
                        <input
                            {...field("quantity")}
                            inputMode="decimal"
                            autoComplete="off"
                            value={draft.quantity}
                            onChange={(e) => onChange({ quantity: e.target.value })}
                            className={`${s.input} mt-1.5`}
                        />
                    </div>
                    <div>
                        <label htmlFor={`${idPrefix}-unit`} className={s.label}>Unit</label>
                        <select
                            {...field("unit")}
                            value={draft.unit}
                            onChange={(e) => onChange({ unit: e.target.value })}
                            className={`${s.input} mt-1.5 px-2`}
                        >
                            {unitOptions(draft.unit).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`${idPrefix}-rate`} className={s.label}>Rate (£)</label>
                        <input
                            {...field("rate")}
                            inputMode="decimal"
                            autoComplete="off"
                            value={draft.rate}
                            onChange={(e) => onChange({ rate: e.target.value })}
                            className={`${s.input} mt-1.5`}
                        />
                    </div>
                    <div className="col-span-3 -mt-1">
                        {fieldError("quantity")}
                        {fieldError("unit")}
                        {fieldError("rate")}
                    </div>
                    <div className="col-span-3">
                        <AreaQuantityAid key={draft.unit} idPrefix={idPrefix} unit={draft.unit} disabled={saving}
                            onUse={quantity => onChange({ quantity })} />
                    </div>
                </div>
            )}

            <p className={`text-base ${s.body}`} aria-live="polite">
                Line total: <strong className={s.heading}>{total === null ? "—" : formatGBP(total)}</strong>
            </p>

            {op.status === "failed" && (
                <div role="alert" className={`${s.errorBox} flex items-start gap-3 text-sm`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p>{op.error}</p>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
                <button type="submit" disabled={saving} className={s.primaryButton}>
                    {saving
                        ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Saving…</>
                        : op.status === "failed" ? "Try again" : "Save line"}
                </button>
                {onSaveNext && <button type="button" onClick={onSaveNext} disabled={saving} className={s.secondaryButton}>
                    Save and add next
                </button>}
                <button type="button" onClick={onCancel} disabled={saving} className={s.secondaryButton}>Cancel</button>
            </div>
            {onSaveNext && <p className={`text-sm ${s.muted}`}>
                Ctrl+Enter or Command+Enter saves this line and opens the next unpriced draft. Pricing method and unit stay selected; description, quantity and price are cleared.
            </p>}
        </form>
    );
}

// ─── Running total and price adjustments ─────────────────

const ADJUSTMENT_ORDER: AdjustmentKey[] = ["prelims", "overhead", "risk", "profit", "discount"];

function TotalCard({
    summary, estimate, lines, state, s, onToggle, onChange, onSave,
}: {
    summary: PriceSummary;
    estimate: Estimate | null;
    lines: EstimateLine[];
    state: {
        open: boolean;
        status: "idle" | "saving" | "failed";
        draft: ReturnType<typeof adjustmentsDraftFromEstimate> | null;
        error: string | null;
        fieldErrors: Partial<Record<AdjustmentKey, string>>;
    };
    s: WorkspaceStyles;
    onToggle: () => void;
    onChange: (patch: Partial<ReturnType<typeof adjustmentsDraftFromEstimate>>) => void;
    onSave: () => void;
}) {
    const draft = state.draft ?? (estimate ? adjustmentsDraftFromEstimate(estimate) : null);
    const saving = state.status === "saving";
    const built = state.draft ? buildAdjustments(state.draft) : null;
    const preview = estimate && built?.ok ? summarisePrice({ ...estimate, ...built.input }, lines) : null;
    const row = "flex items-baseline justify-between gap-3";

    return (
        <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="price-total-title" data-price-total>
            <h2 id="price-total-title" className={`text-lg font-bold ${s.heading}`}>Running total</h2>

            <dl className="mt-3 space-y-2">
                <div className={row}>
                    <dt className={`text-base ${s.body}`}>Your price lines</dt>
                    <dd className={`text-base font-semibold ${s.heading}`}>{formatGBP(summary.linesTotal)}</dd>
                </div>
                {summary.adjustments.map((a) => (
                    <div key={a.key} className={row}>
                        <dt className={`text-base ${s.muted}`}>{a.label} ({a.pct}%)</dt>
                        <dd className={`text-base ${s.body}`}>{formatGBP(a.amount)}</dd>
                    </div>
                ))}
                <div className={`${row} pt-2 border-t ${s.divider}`}>
                    <dt className={`text-base font-bold ${s.heading}`}>Total before VAT</dt>
                    <dd className={`text-xl font-bold ${s.heading}`} data-contract-sum>{formatGBP(summary.contractSum)}</dd>
                </div>
                <div className={row}>
                    <dt className={`text-sm ${s.muted}`}>VAT (20%)</dt>
                    <dd className={`text-sm ${s.muted}`}>{formatGBP(summary.vat)}</dd>
                </div>
                <div className={row}>
                    <dt className={`text-sm ${s.muted}`}>Total including VAT</dt>
                    <dd className={`text-sm font-semibold ${s.body}`}>{formatGBP(summary.totalIncVat)}</dd>
                </div>
            </dl>

            {estimate && summary.adjustments.length === 0 && (
                <p className={`mt-3 text-sm ${s.muted}`}>
                    Nothing has been added on top of your lines for overhead, risk or profit. If your prices already allow for them, leave it as it is.
                </p>
            )}

            <div className={`mt-4 rounded-xl border ${s.divider}`}>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={state.open}
                    aria-controls="price-adjustments"
                    className={`w-full min-h-12 px-4 flex items-center justify-between gap-3 text-left text-sm font-semibold ${s.body}`}
                >
                    <span className="py-2">
                        <span className="block">Price adjustments</span>
                        <span className={`block font-normal ${s.muted}`}>Preliminaries, overhead, risk, profit and discount</span>
                    </span>
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${state.open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>

                {state.open && (
                    <div id="price-adjustments" className="px-4 pb-4 space-y-4">
                        {!estimate || !draft ? (
                            <p className={`text-sm ${s.muted}`}>Add a price line first. Adjustments are percentages added on top of your lines.</p>
                        ) : (
                            <form noValidate onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-4">
                                <p className={`text-sm ${s.muted}`}>
                                    Each percentage is added on top of your lines, in this order. The client sees your price, not the overhead, risk or profit behind it.
                                </p>
                                {ADJUSTMENT_ORDER.map((key) => (
                                    <div key={key}>
                                        <label htmlFor={`adjust-${key}`} className={s.label}>{ADJUSTMENT_HELP[key].label} (%)</label>
                                        <p id={`adjust-${key}-help`} className={`mt-0.5 text-sm ${s.muted}`}>
                                            {key === "prelims" && summary.prelimsFromLines
                                                ? "You have priced preliminaries as your own lines, so this percentage is not used."
                                                : ADJUSTMENT_HELP[key].help}
                                        </p>
                                        <input
                                            id={`adjust-${key}`}
                                            aria-describedby={`adjust-${key}-help`}
                                            aria-invalid={state.fieldErrors[key] ? true : undefined}
                                            inputMode="decimal"
                                            autoComplete="off"
                                            disabled={saving}
                                            value={draft[key]}
                                            onChange={(e) => onChange({ [key]: e.target.value })}
                                            className={`${s.input} mt-1.5 max-w-[10rem]`}
                                        />
                                        {state.fieldErrors[key] && <p className={`mt-1.5 text-sm ${s.errorText}`}>{state.fieldErrors[key]}</p>}
                                    </div>
                                ))}
                                <div>
                                    <label htmlFor="adjust-discount-reason" className={s.label}>Reason for the discount</label>
                                    <p className={`mt-0.5 text-sm ${s.muted}`}>Optional. Shown to the client with the discount.</p>
                                    <input
                                        id="adjust-discount-reason"
                                        autoComplete="off"
                                        disabled={saving}
                                        maxLength={500}
                                        value={draft.discountReason}
                                        onChange={(e) => onChange({ discountReason: e.target.value })}
                                        placeholder="e.g. Returning client"
                                        className={`${s.input} mt-1.5`}
                                    />
                                </div>

                                {state.draft && preview && (
                                    <p role="status" className={`${s.noticeBox} text-sm`}>
                                        Not saved yet. With these adjustments the total before VAT would be <strong>{formatGBP(preview.contractSum)}</strong>.
                                    </p>
                                )}
                                {state.status === "failed" && (
                                    <div role="alert" className={`${s.errorBox} flex items-start gap-3 text-sm`}>
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                                        <p>{state.error}</p>
                                    </div>
                                )}

                                <button type="submit" disabled={saving || !state.draft} className={`${s.primaryButton} w-full sm:w-auto`}>
                                    {saving
                                        ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Saving…</>
                                        : state.status === "failed" ? "Try again" : state.draft ? "Save adjustments" : "No changes to save"}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
