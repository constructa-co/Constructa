/**
 * Simple estimating.
 *
 * The default pricing screen: a short list of price lines, each either one
 * amount or a quantity and a rate, with a running total. This module holds
 * the rules and state for that screen as plain functions:
 *
 *  - a line is only added to the visible list, and the total only moves,
 *    once the server has confirmed the save;
 *  - a failed add, edit or delete keeps what was typed and can be retried;
 *  - every total comes from `computeContractSum` in `financial.ts`.
 */

import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import { computeContractSum, roundMoney, toNumber } from "./financial";
import type { LaunchProfile } from "./launch-profile";
import { getLaunchProfile, isCapabilityEnabled } from "./launch-profile";

// ── Line drafts ──────────────────────────────────────────────────────────────

export const PRICE_UNITS: readonly string[] = ["item", "m", "m2", "m3", "nr", "day", "week", "tonne", "kg", "lm"];

/** The units offered for a draft: the standard list plus the line's own unit. */
export function unitOptions(currentUnit: string): string[] {
    const unit = currentUnit.trim();
    return unit && !PRICE_UNITS.includes(unit) ? [...PRICE_UNITS, unit] : [...PRICE_UNITS];
}

/** Section used for lines added on the simple screen. */
export const SIMPLE_LINE_SECTION = "General";

export const MAX_LINE_AMOUNT = 100_000_000;
export const MAX_LINE_QUANTITY = 1_000_000;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_UNIT_LENGTH = 20;

export type PriceLineMode = "amount" | "rate";

export interface PriceLineDraft {
    description: string;
    mode: PriceLineMode;
    /** One figure for the whole line. */
    amount: string;
    quantity: string;
    unit: string;
    rate: string;
}

export const EMPTY_PRICE_LINE_DRAFT: PriceLineDraft = {
    description: "",
    mode: "amount",
    amount: "",
    quantity: "",
    unit: "m2",
    rate: "",
};

export type PriceLineField = "description" | "amount" | "quantity" | "unit" | "rate";
export type PriceLineFieldErrors = Partial<Record<PriceLineField, string>>;

/** What is sent to the server for one line. */
export interface PriceLineInput {
    description: string;
    quantity: number;
    unit: string;
    unit_rate: number;
}

/** Plain digits with optional decimals. No sign, exponent or hex forms. */
function parseDecimal(raw: string, maxDecimals: number): number | null {
    const cleaned = raw.trim().replace(/[£,\s]/g, "");
    if (!new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`).test(cleaned)) return null;
    return Number(cleaned);
}

export function lineTotal(quantity: number, unitRate: number): number {
    return roundMoney(quantity * unitRate);
}

/** The total a draft would have, or null while it is incomplete or invalid. */
export function draftLineTotal(draft: PriceLineDraft): number | null {
    const built = buildPriceLine({ ...draft, description: draft.description || "-" });
    return built.ok ? lineTotal(built.line.quantity, built.line.unit_rate) : null;
}

export type BuildPriceLineResult =
    | { ok: true; line: PriceLineInput }
    | { ok: false; fieldErrors: PriceLineFieldErrors };

/**
 * Validates a draft. One amount is stored as 1 item at that rate, so both
 * ways of pricing are the same kind of line and use the same arithmetic.
 */
export function buildPriceLine(draft: PriceLineDraft): BuildPriceLineResult {
    const fieldErrors: PriceLineFieldErrors = {};
    const description = draft.description.trim();
    if (!description) fieldErrors.description = "Say what this price is for.";
    else if (description.length > MAX_DESCRIPTION_LENGTH) fieldErrors.description = "Keep the description under 500 characters.";

    if (draft.mode === "amount") {
        const amount = parseDecimal(draft.amount, 2);
        if (amount === null) fieldErrors.amount = "Enter the price as a number, for example 2500.";
        else if (amount <= 0) fieldErrors.amount = "Enter a price above £0.";
        else if (amount > MAX_LINE_AMOUNT) fieldErrors.amount = "That price is too large.";
        if (Object.keys(fieldErrors).length > 0 || amount === null) return { ok: false, fieldErrors };
        return { ok: true, line: { description, quantity: 1, unit: "item", unit_rate: amount } };
    }

    const quantity = parseDecimal(draft.quantity, 3);
    const rate = parseDecimal(draft.rate, 2);
    if (quantity === null) fieldErrors.quantity = "Enter the quantity as a number.";
    else if (quantity <= 0) fieldErrors.quantity = "Enter a quantity above 0.";
    else if (quantity > MAX_LINE_QUANTITY) fieldErrors.quantity = "That quantity is too large.";
    if (rate === null) fieldErrors.rate = "Enter the rate as a number.";
    else if (rate <= 0) fieldErrors.rate = "Enter a rate above £0.";
    const unit = draft.unit.trim();
    if (!unit || unit.length > MAX_UNIT_LENGTH) fieldErrors.unit = "Choose a unit.";
    if (quantity !== null && rate !== null && lineTotal(quantity, rate) > MAX_LINE_AMOUNT) {
        fieldErrors.rate = "That line total is too large.";
    }
    if (Object.keys(fieldErrors).length > 0 || quantity === null || rate === null) return { ok: false, fieldErrors };
    return { ok: true, line: { description, quantity, unit, unit_rate: rate } };
}

const plain = (n: number): string => (Number.isFinite(n) && n !== 0 ? String(n) : "");

/** Opens an existing line for editing in the form it was most likely entered. */
export function draftFromLine(line: Pick<EstimateLine, "description" | "quantity" | "unit" | "unit_rate">): PriceLineDraft {
    const quantity = toNumber(line.quantity);
    const rate = toNumber(line.unit_rate);
    const isAmount = quantity === 1 && (line.unit === "item" || !line.unit);
    return {
        description: line.description || "",
        mode: isAmount ? "amount" : "rate",
        amount: isAmount ? plain(rate) : "",
        quantity: isAmount ? "" : plain(quantity),
        // A unit from the advanced workspace or an imported BoQ is kept as it is.
        unit: line.unit || "item",
        rate: isAmount ? "" : plain(rate),
    };
}

/** Lines priced through a rate build-up or a client BoQ are edited in Advanced estimating. */
export function isSimpleEditable(line: EstimateLine, estimate: Pick<Estimate, "is_client_boq">): boolean {
    return line.pricing_mode !== "buildup" && !estimate.is_client_boq;
}

// ── Totals ───────────────────────────────────────────────────────────────────

export const VAT_RATE = 0.2;

export type AdjustmentKey = "prelims" | "overhead" | "risk" | "profit" | "discount";

export interface AdjustmentRow {
    key: AdjustmentKey;
    label: string;
    pct: number;
    /** Signed: the discount is negative. */
    amount: number;
}

export interface PriceSummary {
    /** Sum of the contractor's own price lines. */
    linesTotal: number;
    adjustments: AdjustmentRow[];
    adjustmentsTotal: number;
    /** Canonical contract sum, before VAT. */
    contractSum: number;
    vat: number;
    totalIncVat: number;
    /** True when preliminaries come from the contractor's own lines, not a percentage. */
    prelimsFromLines: boolean;
}

type EstimatePercentages = Pick<Estimate, "prelims_pct" | "overhead_pct" | "risk_pct" | "profit_pct" | "discount_pct" | "total_cost">;

/**
 * The running total. Every figure is read from the canonical contract-sum
 * breakdown; nothing is recalculated here beyond VAT on the result.
 */
export function summarisePrice(
    estimate: EstimatePercentages | null,
    lines: Pick<EstimateLine, "trade_section" | "line_total">[],
): PriceSummary {
    const percentages = estimate ?? { prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, total_cost: 0 };
    const sum = computeContractSum(percentages, lines);
    const prelimsFromLines = lines.some((l) => l.trade_section === "Preliminaries");

    const linesTotal = prelimsFromLines ? sum.totalConstructionCost : sum.totalConstructionCost - sum.prelimsTotal;
    const adjustments: AdjustmentRow[] = [];
    const push = (key: AdjustmentKey, label: string, pct: number, amount: number) => {
        if (pct > 0) adjustments.push({ key, label, pct, amount: roundMoney(amount) });
    };
    if (!prelimsFromLines) push("prelims", "Preliminaries", toNumber(percentages.prelims_pct), sum.prelimsTotal);
    push("overhead", "Overhead", toNumber(percentages.overhead_pct), sum.overheadAmount);
    push("risk", "Risk", toNumber(percentages.risk_pct), sum.riskAmount);
    push("profit", "Profit", toNumber(percentages.profit_pct), sum.profitAmount);
    push("discount", "Discount", toNumber(percentages.discount_pct), -sum.discountAmount);

    const contractSum = roundMoney(sum.contractSum);
    const vat = roundMoney(contractSum * VAT_RATE);
    return {
        linesTotal: roundMoney(linesTotal),
        adjustments,
        adjustmentsTotal: roundMoney(contractSum - linesTotal),
        contractSum,
        vat,
        totalIncVat: roundMoney(contractSum + vat),
        prelimsFromLines,
    };
}

export function formatGBP(n: number): string {
    const sign = n < 0 ? "-" : "";
    return `${sign}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Price adjustments ────────────────────────────────────────────────────────

export interface AdjustmentsDraft {
    prelims: string;
    overhead: string;
    risk: string;
    profit: string;
    discount: string;
    discountReason: string;
}

export interface AdjustmentsInput {
    prelims_pct: number;
    overhead_pct: number;
    risk_pct: number;
    profit_pct: number;
    discount_pct: number;
    discount_reason: string;
}

export const ADJUSTMENT_HELP: Record<AdjustmentKey, { label: string; help: string }> = {
    prelims: { label: "Preliminaries", help: "Site running costs such as skips, welfare, scaffolding and supervision, if you have not priced them as lines." },
    overhead: { label: "Overhead", help: "What it costs to run the business: van, insurance, office, phone." },
    risk: { label: "Risk", help: "An allowance for things that might not go to plan." },
    profit: { label: "Profit", help: "What you want to make on the job." },
    discount: { label: "Discount", help: "Taken off the total at the end." },
};

const pctText = (value: number | string | null | undefined): string => String(toNumber(value));

export function adjustmentsDraftFromEstimate(estimate: Estimate): AdjustmentsDraft {
    return {
        prelims: pctText(estimate.prelims_pct),
        overhead: pctText(estimate.overhead_pct),
        risk: pctText(estimate.risk_pct),
        profit: pctText(estimate.profit_pct),
        discount: pctText(estimate.discount_pct),
        discountReason: estimate.discount_reason || "",
    };
}

export type BuildAdjustmentsResult =
    | { ok: true; input: AdjustmentsInput }
    | { ok: false; fieldErrors: Partial<Record<AdjustmentKey, string>> };

export function buildAdjustments(draft: AdjustmentsDraft): BuildAdjustmentsResult {
    const fieldErrors: Partial<Record<AdjustmentKey, string>> = {};
    const read = (key: AdjustmentKey): number => {
        const raw = draft[key].trim();
        const value = raw === "" ? 0 : parseDecimal(raw.replace(/%/g, ""), 2);
        if (value === null || value > 100) {
            fieldErrors[key] = "Enter a percentage between 0 and 100.";
            return 0;
        }
        return value;
    };
    const input: AdjustmentsInput = {
        prelims_pct: read("prelims"),
        overhead_pct: read("overhead"),
        risk_pct: read("risk"),
        profit_pct: read("profit"),
        discount_pct: read("discount"),
        discount_reason: draft.discountReason.trim().slice(0, 500),
    };
    return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, input };
}

// ── Advanced capability list ─────────────────────────────────────────────────

export interface AdvancedCapability {
    key: "boq" | "build-ups" | "cost-library" | "versions" | "client-boq" | "drawing-takeoff";
    label: string;
}

/** What the Advanced estimating disclosure offers under a launch profile. */
export function advancedCapabilities(profile: LaunchProfile = getLaunchProfile()): AdvancedCapability[] {
    const list: AdvancedCapability[] = [
        { key: "boq", label: "Full bill of quantities by trade section" },
        { key: "build-ups", label: "Rate build-ups from labour, plant and materials" },
        { key: "cost-library", label: "Cost library search" },
        { key: "versions", label: "More than one version of the estimate" },
    ];
    if (isCapabilityEnabled("client-boq-import", profile)) list.push({ key: "client-boq", label: "Client BoQ import and Excel export" });
    if (isCapabilityEnabled("drawing-takeoff", profile)) list.push({ key: "drawing-takeoff", label: "Drawing take-off" });
    return list;
}

// ── State ────────────────────────────────────────────────────────────────────

export const NEW_LINE_KEY = "new";

export const LINE_SAVE_ERROR =
    "This line wasn't saved. What you typed is still here. Check your connection and try again.";
export const LINE_DELETE_ERROR = "This line wasn't removed. Check your connection and try again.";
export const ADJUSTMENTS_SAVE_ERROR =
    "The adjustments weren't saved, so the total has not changed. Check your connection and try again.";

export interface LineOp {
    kind: "add" | "edit" | "delete";
    status: "editing" | "saving" | "failed";
    draft: PriceLineDraft;
    /** For a new line: the id it will be saved under, reused on every retry. */
    lineId: string;
    error: string | null;
    fieldErrors: PriceLineFieldErrors;
}

export interface EstimatingState {
    estimates: Estimate[];
    activeEstimateId: string;
    /** Id the first estimate will be created under, reused on every retry. */
    pendingEstimateId: string;
    ops: Record<string, LineOp>;
    adjustments: {
        open: boolean;
        status: "idle" | "saving" | "failed";
        draft: AdjustmentsDraft | null;
        error: string | null;
        fieldErrors: Partial<Record<AdjustmentKey, string>>;
    };
    advancedOpen: boolean;
    /** Shown after the last save, e.g. a stored-total refresh warning. */
    notice: string | null;
}

/** Opens on the estimate the proposal uses, unless one was asked for by id. */
export function pickInitialEstimateId(estimates: Estimate[], preferredId?: string | null): string {
    if (preferredId && estimates.some((e) => e.id === preferredId)) return preferredId;
    return (estimates.find((e) => e.is_active) ?? estimates[0])?.id ?? "";
}

export function initialEstimatingState(
    estimates: Estimate[],
    options: { pendingEstimateId: string; preferredEstimateId?: string | null },
): EstimatingState {
    return {
        estimates,
        activeEstimateId: pickInitialEstimateId(estimates, options.preferredEstimateId),
        pendingEstimateId: options.pendingEstimateId,
        ops: {},
        adjustments: { open: false, status: "idle", draft: null, error: null, fieldErrors: {} },
        advancedOpen: false,
        notice: null,
    };
}

export function currentEstimate(state: EstimatingState): Estimate | null {
    return state.estimates.find((e) => e.id === state.activeEstimateId) ?? null;
}

export function currentSummary(state: EstimatingState): PriceSummary {
    const estimate = currentEstimate(state);
    return summarisePrice(estimate, estimate?.estimate_lines ?? []);
}

export type EstimatingAction =
    | { type: "op/open"; key: string; kind: LineOp["kind"]; draft: PriceLineDraft; lineId: string }
    | { type: "op/change"; key: string; patch: Partial<PriceLineDraft> }
    | { type: "op/cancel"; key: string }
    | { type: "op/saving"; key: string }
    | { type: "op/failed"; key: string; error: string | null; fieldErrors?: PriceLineFieldErrors }
    | { type: "line/saved"; key: string; estimateId: string; createdEstimate: Estimate | null; line: EstimateLine; notice?: string | null }
    | { type: "line/removed"; key: string; estimateId: string; lineId: string; notice?: string | null }
    | { type: "estimate/select"; estimateId: string }
    | { type: "estimates/replace"; update: (estimates: Estimate[]) => Estimate[] }
    | { type: "adjustments/toggle" }
    | { type: "adjustments/change"; patch: Partial<AdjustmentsDraft> }
    | { type: "adjustments/saving" }
    | { type: "adjustments/failed"; error: string | null; fieldErrors?: Partial<Record<AdjustmentKey, string>> }
    | { type: "adjustments/saved"; estimateId: string; input: AdjustmentsInput }
    | { type: "advanced/toggle" }
    | { type: "notice/clear" };

function withoutOp(ops: Record<string, LineOp>, key: string): Record<string, LineOp> {
    const next = { ...ops };
    delete next[key];
    return next;
}

function storedTotal(lines: EstimateLine[]): number {
    return roundMoney(lines.reduce((sum, l) => sum + toNumber(l.line_total), 0));
}

export function estimatingReducer(state: EstimatingState, action: EstimatingAction): EstimatingState {
    switch (action.type) {
        case "op/open":
            if (state.ops[action.key]?.status === "saving") return state;
            return {
                ...state,
                notice: null,
                ops: {
                    ...state.ops,
                    [action.key]: { kind: action.kind, status: "editing", draft: action.draft, lineId: action.lineId, error: null, fieldErrors: {} },
                },
            };

        case "op/change": {
            const op = state.ops[action.key];
            if (!op || op.status === "saving") return state;
            const fieldErrors = { ...op.fieldErrors };
            (Object.keys(action.patch) as (keyof PriceLineDraft)[]).forEach((field) => {
                if (field !== "mode") delete fieldErrors[field];
            });
            return { ...state, ops: { ...state.ops, [action.key]: { ...op, draft: { ...op.draft, ...action.patch }, fieldErrors } } };
        }

        case "op/cancel":
            if (state.ops[action.key]?.status === "saving") return state;
            return { ...state, ops: withoutOp(state.ops, action.key) };

        case "op/saving": {
            const op = state.ops[action.key];
            if (!op || op.status === "saving") return state;
            return { ...state, ops: { ...state.ops, [action.key]: { ...op, status: "saving", error: null, fieldErrors: {} } } };
        }

        case "op/failed": {
            // The draft is kept exactly as typed; the estimates are untouched.
            const op = state.ops[action.key];
            if (!op) return state;
            return {
                ...state,
                ops: {
                    ...state.ops,
                    [action.key]: {
                        ...op,
                        status: action.error ? "failed" : "editing",
                        error: action.error,
                        fieldErrors: action.fieldErrors ?? {},
                    },
                },
            };
        }

        case "line/saved": {
            const known = state.estimates.some((e) => e.id === action.estimateId);
            const base = known || !action.createdEstimate ? state.estimates : [...state.estimates, action.createdEstimate];
            const estimates = base.map((e) => {
                if (e.id !== action.estimateId) return e;
                const exists = e.estimate_lines.some((l) => l.id === action.line.id);
                const lines = exists
                    ? e.estimate_lines.map((l) => (l.id === action.line.id ? { ...l, ...action.line } : l))
                    : [...e.estimate_lines, action.line];
                return { ...e, estimate_lines: lines, total_cost: storedTotal(lines) };
            });
            return {
                ...state,
                estimates,
                activeEstimateId: state.activeEstimateId || action.estimateId,
                ops: withoutOp(state.ops, action.key),
                notice: action.notice ?? null,
            };
        }

        case "line/removed": {
            const estimates = state.estimates.map((e) => {
                if (e.id !== action.estimateId) return e;
                const lines = e.estimate_lines.filter((l) => l.id !== action.lineId);
                return { ...e, estimate_lines: lines, total_cost: storedTotal(lines) };
            });
            return { ...state, estimates, ops: withoutOp(state.ops, action.key), notice: action.notice ?? null };
        }

        case "estimate/select":
            if (!state.estimates.some((e) => e.id === action.estimateId)) return state;
            return {
                ...state,
                activeEstimateId: action.estimateId,
                ops: {},
                adjustments: { ...state.adjustments, status: "idle", draft: null, error: null, fieldErrors: {} },
            };

        case "estimates/replace": {
            const estimates = action.update(state.estimates);
            const stillThere = estimates.some((e) => e.id === state.activeEstimateId);
            return { ...state, estimates, activeEstimateId: stillThere ? state.activeEstimateId : pickInitialEstimateId(estimates) };
        }

        case "adjustments/toggle":
            if (state.adjustments.status === "saving") return state;
            return { ...state, adjustments: { ...state.adjustments, open: !state.adjustments.open } };

        case "adjustments/change": {
            if (state.adjustments.status === "saving") return state;
            const estimate = currentEstimate(state);
            if (!estimate) return state;
            const draft = { ...(state.adjustments.draft ?? adjustmentsDraftFromEstimate(estimate)), ...action.patch };
            return { ...state, adjustments: { ...state.adjustments, draft, status: "idle", error: null, fieldErrors: {} } };
        }

        case "adjustments/saving":
            return { ...state, adjustments: { ...state.adjustments, status: "saving", error: null, fieldErrors: {} } };

        case "adjustments/failed":
            // The estimate keeps its saved percentages, so the total does not move.
            return {
                ...state,
                adjustments: {
                    ...state.adjustments,
                    status: action.error ? "failed" : "idle",
                    error: action.error,
                    fieldErrors: action.fieldErrors ?? {},
                },
            };

        case "adjustments/saved":
            return {
                ...state,
                estimates: state.estimates.map((e) => (e.id === action.estimateId ? { ...e, ...action.input } : e)),
                adjustments: { ...state.adjustments, status: "idle", draft: null, error: null, fieldErrors: {} },
            };

        case "advanced/toggle":
            // Open line edits belong to the simple list; they are closed
            // rather than left behind the advanced workspace.
            if (Object.values(state.ops).some((op) => op.status === "saving")) return state;
            return { ...state, advancedOpen: !state.advancedOpen, ops: {} };

        case "notice/clear":
            return { ...state, notice: null };
    }
}

// ── Server contracts and controllers ─────────────────────────────────────────

export interface SavePriceLineRequest {
    projectId: string;
    /** Null when the project has no estimate yet. */
    estimateId: string | null;
    /** Id to create the first estimate under. */
    newEstimateId: string;
    lineId: string;
    line: PriceLineInput;
}

export type SavePriceLineResult =
    | { ok: true; estimateId: string; createdEstimate: Estimate | null; line: EstimateLine; warning?: string }
    | { ok: false; error: string };

export type UpdatePriceLineResult = { ok: true; line: Pick<EstimateLine, "id" | "description" | "quantity" | "unit" | "unit_rate" | "line_total">; warning?: string } | { ok: false; error: string };
export type SimpleResult = { ok: true; warning?: string } | { ok: false; error: string };

export interface EstimatingStore {
    getState: () => EstimatingState;
    dispatch: (action: EstimatingAction) => void;
}

export interface EstimatingServer {
    saveLine: (request: SavePriceLineRequest) => Promise<SavePriceLineResult>;
    updateLine: (estimateId: string, lineId: string, line: PriceLineInput) => Promise<UpdatePriceLineResult>;
    deleteLine: (estimateId: string, lineId: string) => Promise<SimpleResult>;
    saveAdjustments: (estimateId: string, input: AdjustmentsInput) => Promise<SimpleResult>;
}

/** Saves the add or edit that is open under `key`. Returns true once saved. */
export async function submitPriceLine(
    store: EstimatingStore,
    server: Pick<EstimatingServer, "saveLine" | "updateLine">,
    projectId: string,
    key: string,
): Promise<boolean> {
    const state = store.getState();
    const op = state.ops[key];
    if (!op || op.status === "saving" || op.kind === "delete") return false;

    const built = buildPriceLine(op.draft);
    if (!built.ok) {
        store.dispatch({ type: "op/failed", key, error: null, fieldErrors: built.fieldErrors });
        return false;
    }

    const estimate = currentEstimate(state);
    store.dispatch({ type: "op/saving", key });
    try {
        if (op.kind === "add") {
            const result = await server.saveLine({
                projectId,
                estimateId: estimate?.id ?? null,
                newEstimateId: state.pendingEstimateId,
                lineId: op.lineId,
                line: built.line,
            });
            if (!result.ok) {
                store.dispatch({ type: "op/failed", key, error: result.error || LINE_SAVE_ERROR });
                return false;
            }
            store.dispatch({
                type: "line/saved",
                key,
                estimateId: result.estimateId,
                createdEstimate: result.createdEstimate,
                line: result.line,
                notice: result.warning ?? null,
            });
            return true;
        }

        if (!estimate) {
            store.dispatch({ type: "op/failed", key, error: LINE_SAVE_ERROR });
            return false;
        }
        const existing = estimate.estimate_lines.find((l) => l.id === op.lineId);
        const result = await server.updateLine(estimate.id, op.lineId, built.line);
        if (!result.ok || !existing) {
            store.dispatch({ type: "op/failed", key, error: (!result.ok && result.error) || LINE_SAVE_ERROR });
            return false;
        }
        store.dispatch({
            type: "line/saved",
            key,
            estimateId: estimate.id,
            createdEstimate: null,
            line: { ...existing, ...result.line },
            notice: result.warning ?? null,
        });
        return true;
    } catch {
        store.dispatch({ type: "op/failed", key, error: LINE_SAVE_ERROR });
        return false;
    }
}

/** Removes a line the contractor has confirmed they want gone. */
export async function removePriceLine(
    store: EstimatingStore,
    server: Pick<EstimatingServer, "deleteLine">,
    lineId: string,
): Promise<boolean> {
    const state = store.getState();
    const estimate = currentEstimate(state);
    const op = state.ops[lineId];
    if (!estimate || !op || op.kind !== "delete" || op.status === "saving") return false;

    store.dispatch({ type: "op/saving", key: lineId });
    try {
        const result = await server.deleteLine(estimate.id, lineId);
        if (!result.ok) {
            store.dispatch({ type: "op/failed", key: lineId, error: result.error || LINE_DELETE_ERROR });
            return false;
        }
        store.dispatch({ type: "line/removed", key: lineId, estimateId: estimate.id, lineId, notice: result.warning ?? null });
        return true;
    } catch {
        store.dispatch({ type: "op/failed", key: lineId, error: LINE_DELETE_ERROR });
        return false;
    }
}

export async function submitAdjustments(
    store: EstimatingStore,
    server: Pick<EstimatingServer, "saveAdjustments">,
): Promise<boolean> {
    const state = store.getState();
    const estimate = currentEstimate(state);
    if (!estimate || !state.adjustments.draft || state.adjustments.status === "saving") return false;

    const built = buildAdjustments(state.adjustments.draft);
    if (!built.ok) {
        store.dispatch({ type: "adjustments/failed", error: null, fieldErrors: built.fieldErrors });
        return false;
    }

    store.dispatch({ type: "adjustments/saving" });
    try {
        const result = await server.saveAdjustments(estimate.id, built.input);
        if (!result.ok) {
            store.dispatch({ type: "adjustments/failed", error: result.error || ADJUSTMENTS_SAVE_ERROR });
            return false;
        }
        store.dispatch({ type: "adjustments/saved", estimateId: estimate.id, input: built.input });
        return true;
    } catch {
        store.dispatch({ type: "adjustments/failed", error: ADJUSTMENTS_SAVE_ERROR });
        return false;
    }
}
