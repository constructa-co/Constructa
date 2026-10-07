"use client";

import { useEffect, useMemo, useState } from "react";
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
}

type LoadAdvancedData = () => Promise<{ ok: true; data: AdvancedEstimatingData } | { ok: false; error: string }>;

interface Props {
    estimates: Estimate[];
    project: ProjectContext;
    defaultTabId?: string;
    /** Default to the real server actions; replaced only by tests and evidence capture. */
    server?: EstimatingServer;
    loadAdvancedData?: LoadAdvancedData;
}

const REAL_SERVER: EstimatingServer = {
    saveLine: saveSimplePriceLineAction,
    updateLine: updateSimplePriceLineAction,
    deleteLine: deleteSimplePriceLineAction,
    saveAdjustments: savePriceAdjustmentsAction,
};

const SCOPE_PREVIEW_LENGTH = 220;

export default function EstimateClient({
    estimates: initialEstimates,
    project,
    defaultTabId,
    server = REAL_SERVER,
    loadAdvancedData = loadAdvancedEstimatingDataAction,
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

    const [showFullScope, setShowFullScope] = useState(false);
    const [advanced, setAdvanced] = useState<{ status: "idle" | "loading" | "failed" | "ready"; data: AdvancedEstimatingData | null; error: string }>(
        { status: "idle", data: null, error: "" },
    );

    // Keep the chosen estimate version when moving between project tabs.
    const tabKey = `constructa_tab_${project.id}`;
    useEffect(() => {
        if (defaultTabId) return;
        const saved = window.sessionStorage.getItem(tabKey);
        if (saved) store.dispatch({ type: "estimate/select", estimateId: saved });
    }, [defaultTabId, store, tabKey]);
    const selectEstimate = (estimateId: string) => {
        store.dispatch({ type: "estimate/select", estimateId });
        if (estimateId) window.sessionStorage.setItem(tabKey, estimateId);
    };

    const openAdd = () =>
        store.dispatch({ type: "op/open", key: NEW_LINE_KEY, kind: "add", draft: EMPTY_PRICE_LINE_DRAFT, lineId: newClientId() });
    const openEdit = (line: EstimateLine) =>
        store.dispatch({ type: "op/open", key: line.id, kind: "edit", draft: draftFromLine(line), lineId: line.id });
    const openDelete = (line: EstimateLine) =>
        store.dispatch({ type: "op/open", key: line.id, kind: "delete", draft: draftFromLine(line), lineId: line.id });

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
        const opening = !state.advancedOpen;
        store.dispatch({ type: "advanced/toggle" });
        if (opening && store.getState().advancedOpen && advanced.status !== "ready" && advanced.status !== "loading") void loadAdvanced();
    };

    const { work } = splitScope(project.brief_scope);
    const scope = work.trim();
    const scopeIsLong = scope.length > SCOPE_PREVIEW_LENGTH;
    const briefHref = `/dashboard/projects/brief?projectId=${encodeURIComponent(project.id)}`;
    const programmeHref = `/dashboard/projects/schedule?projectId=${encodeURIComponent(project.id)}`;
    const hasLines = lines.length > 0;
    const capabilities = advancedCapabilities();

    const advancedSection = (
            <section className={`${s.card}`} aria-labelledby="advanced-estimating-title">
                <button
                    type="button"
                    onClick={toggleAdvanced}
                    aria-expanded={state.advancedOpen}
                    aria-controls="advanced-estimating"
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
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>
    );

    return (
        <div className="space-y-5">
            <div>
                <h1 className={`text-2xl sm:text-3xl font-bold ${s.heading}`}>Build the price</h1>
                <p className={`mt-1 text-base break-words ${s.muted}`}>
                    {project.name}{project.client_name ? ` for ${project.client_name}` : ""}
                </p>
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
            </section>

            {state.estimates.length > 1 && (
                <div className={`${s.card} p-4 sm:p-5`}>
                    <label htmlFor="estimate-version" className={s.label}>Estimate version</label>
                    <select
                        id="estimate-version"
                        value={estimate?.id ?? ""}
                        onChange={(e) => selectEstimate(e.target.value)}
                        className={`${s.input} mt-2`}
                    >
                        {state.estimates.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.version_name || "Estimate"}{e.is_active ? " (used in the proposal)" : ""}
                            </option>
                        ))}
                    </select>
                    {estimate && !estimate.is_active && (
                        <p className={`mt-2 text-sm ${s.muted}`}>
                            This version is not the one used in the proposal. Change which one is used under Advanced estimating.
                        </p>
                    )}
                </div>
            )}

            {state.notice && (
                <div role="status" className={`${s.noticeBox} flex items-start gap-3 text-sm`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="flex-1">{state.notice}</p>
                    <button type="button" onClick={() => store.dispatch({ type: "notice/clear" })} className="underline font-semibold">Dismiss</button>
                </div>
            )}

            {/* Price lines */}
            {!state.advancedOpen && (
                <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="price-lines-title">
                    <h2 id="price-lines-title" className={`text-lg font-bold ${s.heading}`}>Price lines</h2>

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
                            <ul className={`mt-3 divide-y ${isDark ? "divide-[#2a2a2a]" : "divide-gray-200"}`}>
                                {lines.map((line) => (
                                    <PriceLineRow
                                        key={line.id}
                                        line={line}
                                        editable={!!estimate && isSimpleEditable(line, estimate)}
                                        isClientBoQ={!!estimate?.is_client_boq}
                                        op={state.ops[line.id]}
                                        s={s}
                                        isDark={isDark}
                                        onEdit={() => openEdit(line)}
                                        onDelete={() => openDelete(line)}
                                        onChange={(patch) => store.dispatch({ type: "op/change", key: line.id, patch })}
                                        onCancel={() => store.dispatch({ type: "op/cancel", key: line.id })}
                                        onSave={() => void submitPriceLine(store, server, project.id, line.id)}
                                        onConfirmDelete={() => void removePriceLine(store, server, line.id)}
                                    />
                                ))}
                            </ul>

                            {newOp ? (
                                <div className={`mt-4 ${s.inset} p-4`}>
                                    <LineForm
                                        idPrefix="new-line"
                                        title={hasLines ? "New price line" : "First price line"}
                                        op={newOp}
                                        s={s}
                                        isDark={isDark}
                                        onChange={(patch) => store.dispatch({ type: "op/change", key: NEW_LINE_KEY, patch })}
                                        onCancel={() => store.dispatch({ type: "op/cancel", key: NEW_LINE_KEY })}
                                        onSave={() => void submitPriceLine(store, server, project.id, NEW_LINE_KEY)}
                                    />
                                </div>
                            ) : (
                                <button type="button" onClick={openAdd} className={`${s.secondaryButton} mt-4 w-full sm:w-auto`}>
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

            {hasLines && (
                <div className="flex justify-end">
                    <Link href={programmeHref} className={`${s.primaryButton} w-full sm:w-auto`}>
                        Next: Programme <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                </div>
            )}

            {/* Offered last while closed, so it does not compete with the simple list. */}
            {!state.advancedOpen && advancedSection}
        </div>
    );
}

// ─── One price line ──────────────────────────────────────

function PriceLineRow({
    line, editable, isClientBoQ, op, s, isDark, onEdit, onDelete, onChange, onCancel, onSave, onConfirmDelete,
}: {
    line: EstimateLine;
    editable: boolean;
    isClientBoQ: boolean;
    op: LineOp | undefined;
    s: WorkspaceStyles;
    isDark: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
    onConfirmDelete: () => void;
}) {
    const name = line.description?.trim() || "No description yet";
    const isAmount = Number(line.quantity) === 1 && (line.unit === "item" || !line.unit);
    const section = line.trade_section && line.trade_section !== "General" ? line.trade_section : "";

    if (op && op.kind === "edit") {
        return (
            <li className="py-4">
                <LineForm idPrefix={`line-${line.id}`} title="Change this line" op={op} s={s} isDark={isDark} onChange={onChange} onCancel={onCancel} onSave={onSave} />
            </li>
        );
    }

    const iconButton = `min-h-11 min-w-11 rounded-lg inline-flex items-center justify-center transition-colors ${
        isDark ? "text-slate-300 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
    }`;

    return (
        <li className="py-3" data-price-line={line.id}>
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-base font-semibold break-words ${line.description?.trim() ? s.body : s.muted}`}>{name}</p>
                    <p className={`text-sm ${s.muted}`}>
                        {[
                            section,
                            isAmount ? "" : `${Number(line.quantity)} ${line.unit} × ${formatGBP(Number(line.unit_rate) || 0)}`,
                            line.pricing_mode === "buildup" ? "Rate build-up" : "",
                            isClientBoQ ? "Client BoQ" : "",
                        ].filter(Boolean).join(" · ")}
                    </p>
                    {!editable && (
                        <p className={`text-sm ${s.muted}`}>Change this line in Advanced estimating.</p>
                    )}
                </div>
                <p className={`text-base font-bold whitespace-nowrap pt-0.5 ${s.heading}`}>{formatGBP(Number(line.line_total) || 0)}</p>
            </div>

            {op && op.kind === "delete" ? (
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
            ) : editable && (
                <div className="mt-1 -ml-2 flex gap-1">
                    <button type="button" onClick={onEdit} aria-label={`Change ${name}`} className={`${iconButton} px-2 gap-1.5 text-sm font-semibold`}>
                        <Pencil className="w-4 h-4" aria-hidden="true" /> Change
                    </button>
                    <button type="button" onClick={onDelete} aria-label={`Remove ${name}`} className={`${iconButton} px-2 gap-1.5 text-sm font-semibold`}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                    </button>
                </div>
            )}
        </li>
    );
}

// ─── Add / change form ───────────────────────────────────

function LineForm({
    idPrefix, title, op, s, isDark, onChange, onCancel, onSave,
}: {
    idPrefix: string;
    title: string;
    op: LineOp;
    s: WorkspaceStyles;
    isDark: boolean;
    onChange: (patch: Partial<PriceLineDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
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
        <form noValidate onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-4" aria-label={title}>
            <p className={`text-base font-bold ${s.heading}`}>{title}</p>

            <div>
                <label htmlFor={`${idPrefix}-description`} className={s.label}>What is this price for?</label>
                <input
                    {...field("description")}
                    value={draft.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="e.g. Bathroom refit, labour and materials"
                    autoComplete="off"
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
                <button type="button" onClick={onCancel} disabled={saving} className={s.secondaryButton}>Cancel</button>
            </div>
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
