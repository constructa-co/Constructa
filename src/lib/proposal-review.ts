/**
 * Review and Send.
 *
 * The rules and state for the proposal screen as plain functions:
 *
 *  - the draft is edited in the order the client reads it and saved as one
 *    piece; a failed save keeps every input and can be retried;
 *  - the preview is the real publication snapshot built from the draft, so
 *    it shows what the client would receive;
 *  - AI wording is held as a pending suggestion and changes nothing until
 *    the contractor applies it;
 *  - a proposal is published only when it is ready, saved and explicitly
 *    confirmed, and what happened is reported as it happened: a publication
 *    that committed is never shown as failed because its email did not send;
 *  - what is published is what was reviewed: the content the contractor
 *    confirmed is fingerprinted and the server publishes only that content.
 */

import { computeContractSum, roundMoney } from "./financial";
import { splitScope } from "./guided-brief";
import { resolveProgrammeSource } from "./programme-plan";
import {
    buildProposalPublicationSnapshot,
    sanitisePhotos,
    type ProposalPublicationEstimateInput,
    type ProposalPublicationProfileInput,
    type ProposalPublicationProjectInput,
    type ProposalPublicationSnapshot,
} from "./proposal-publication";
import { evaluateProposalReadiness, type ProposalReadiness } from "./proposal-readiness";
import { DEFAULT_RESPONSE_KIND, type ProposalResponseKind } from "./proposal-response";
import {
    PROPOSAL_TERMS_PROFILE_VERSION,
    STANDARD_PROPOSAL_TERMS,
    resolveProposalTerms,
    type ProposalTermsClause,
} from "./proposal-terms";

// ── Limits ───────────────────────────────────────────────────────────────────

export const TEXT_LIMITS = {
    introduction: 20_000,
    scope: 20_000,
    exclusions: 10_000,
    clarifications: 10_000,
    closing: 20_000,
} as const;
export const MAX_PAYMENT_STAGES = 12;
export const MAX_PHOTOS = 6;
export const MAX_TERMS = 40;
export const DEFAULT_VALIDITY_DAYS = 30;

export type WordingField = keyof typeof TEXT_LIMITS;
export const WORDING_FIELDS: readonly WordingField[] = ["introduction", "scope", "exclusions", "clarifications", "closing"];

// ── Draft ────────────────────────────────────────────────────────────────────

export interface PaymentStageDraft {
    key: string;
    stage: string;
    when: string;
    percentage: string;
}

export interface TermDraft {
    clause_number: number;
    title: string;
    body: string;
    hidden: boolean;
    custom: boolean;
}

export interface PhotoDraft {
    url: string;
    caption: string;
}

export interface ProposalDraft {
    introduction: string;
    scope: string;
    exclusions: string;
    clarifications: string;
    closing: string;
    validityDays: string;
    payments: PaymentStageDraft[];
    /**
     * Payment stages with fixed amounts, set in the earlier editor. They are
     * shown and published as they are until the contractor replaces them.
     */
    fixedPayments: unknown[] | null;
    photos: PhotoDraft[];
    caseStudyIds: string[];
    /** Null means the standard terms, unchanged. */
    terms: TermDraft[] | null;
}

export interface ReviewProject extends ProposalPublicationProjectInput {
    brief_scope?: string | null;
    contract_exclusions?: string | null;
    contract_clarifications?: string | null;
    validity_days?: number | null;
    tc_overrides?: ProposalTermsClause[] | null;
    client_email?: string | null;
    is_vat_reverse_charge?: boolean | null;
}

export interface ReviewContext {
    project: ReviewProject;
    profile: ProposalPublicationProfileInput;
    /** The one estimate marked as used in the proposal, when there is exactly one. */
    estimate: ProposalPublicationEstimateInput | null;
    /** The version number the next publication would take. */
    nextVersion: number;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const hasFixedAmount = (row: unknown) => Number(asRecord(row).amount) > 0;

export function draftFromProject(project: ReviewProject, makeKey: () => string): ProposalDraft {
    const schedule = Array.isArray(project.payment_schedule) ? project.payment_schedule : [];
    const fixed = schedule.some(hasFixedAmount);
    // A saved stage keeps its own id, so saving again does not renumber it.
    const used = new Set<string>();
    const stageKey = (id: unknown) => {
        const key = typeof id === "string" && id && !used.has(id) ? id : makeKey();
        used.add(key);
        return key;
    };
    return {
        introduction: project.proposal_introduction ?? "",
        // A scope not yet written starts from the contractor's own brief.
        scope: project.scope_text?.trim() ? project.scope_text : splitScope(project.brief_scope ?? "").work,
        exclusions: project.exclusions_text?.trim() ? project.exclusions_text : project.contract_exclusions ?? "",
        clarifications: project.clarifications_text?.trim() ? project.clarifications_text : project.contract_clarifications ?? "",
        closing: project.closing_statement ?? "",
        validityDays: String(project.validity_days ?? DEFAULT_VALIDITY_DAYS),
        payments: fixed ? [] : schedule.map((row) => {
            const r = asRecord(row);
            return {
                key: stageKey(r.id),
                stage: typeof r.stage === "string" ? r.stage : "",
                when: typeof r.description === "string" ? r.description : "",
                percentage: Number(r.percentage) > 0 ? String(Number(r.percentage)) : "",
            };
        }),
        fixedPayments: fixed ? schedule : null,
        photos: sanitisePhotos(project.site_photos).slice(0, MAX_PHOTOS).map((photo) => ({ url: photo.url, caption: photo.caption ?? "" })),
        caseStudyIds: (Array.isArray(project.selected_case_study_ids) ? project.selected_case_study_ids : []).map(String),
        terms: Array.isArray(project.tc_overrides) && project.tc_overrides.length > 0
            ? project.tc_overrides.map((clause, index) => ({
                clause_number: Number(clause.clause_number) || index + 1,
                title: clause.title ?? "",
                body: clause.body ?? "",
                hidden: clause.hidden === true,
                custom: clause.custom === true,
            }))
            : null,
    };
}

/** What the project holds, as a draft. Used to tell whether anything is unsaved. */
export function savedDraftFromProject(project: ReviewProject, makeKey: () => string): ProposalDraft {
    return {
        ...draftFromProject(project, makeKey),
        scope: project.scope_text ?? "",
        exclusions: project.exclusions_text ?? "",
        clarifications: project.clarifications_text ?? "",
    };
}

export function standardTermDrafts(): TermDraft[] {
    return STANDARD_PROPOSAL_TERMS.map((clause) => ({
        clause_number: clause.clause_number,
        title: clause.title,
        body: clause.body,
        hidden: false,
        custom: false,
    }));
}

const comparable = (draft: ProposalDraft) => JSON.stringify([
    draft.introduction, draft.scope, draft.exclusions, draft.clarifications, draft.closing,
    draft.validityDays.trim(),
    draft.payments.map((row) => [row.stage, row.when, row.percentage.trim()]),
    draft.fixedPayments === null,
    draft.photos,
    [...draft.caseStudyIds].sort(),
    draft.terms,
]);

export function draftsEqual(a: ProposalDraft, b: ProposalDraft): boolean {
    return comparable(a) === comparable(b);
}

// ── Payment presets ──────────────────────────────────────────────────────────

/**
 * The quick ways to say how the job is paid. Each one fills in ordinary
 * payment stages, so the proposal, its PDF and the sent version treat a
 * preset exactly like stages typed by hand.
 */
export type PaymentPreset = "completion" | "deposit_balance" | "custom";

export const PAYMENT_PRESETS: ReadonlyArray<{ kind: PaymentPreset; label: string; help: string }> = [
    { kind: "completion", label: "Payment on completion", help: "The whole price when the work is finished." },
    { kind: "deposit_balance", label: "Deposit and balance", help: "A deposit on booking, the rest when the work is finished." },
    { kind: "custom", label: "Custom stages", help: "Your own stages, each with its share of the price." },
];

export const DEFAULT_DEPOSIT_PERCENT = 30;
const COMPLETION_STAGE = { stage: "Payment on completion", when: "When the work is finished" } as const;
const DEPOSIT_STAGE = { stage: "Deposit", when: "On booking" } as const;
const BALANCE_STAGE = { stage: "Balance", when: "On completion" } as const;

/** A deposit share that leaves a balance: more than 0 and less than 100, to two decimal places. */
function depositShare(raw: string): number | null {
    const share = parsePercentage(raw);
    return share !== null && share > 0 && share < 100 ? share : null;
}

/** The balance share for a deposit, as it is typed into a stage. Empty until the deposit is usable. */
export function balanceFor(depositRaw: string): string {
    const deposit = depositShare(depositRaw);
    return deposit === null ? "" : String(roundMoney(100 - deposit));
}

/**
 * The stages for a deposit and a balance. The balance is always worked out
 * from the deposit, so the two add up to the whole price. The existing
 * stages' keys are kept when the deposit is being changed, so the fields on
 * screen stay the same fields.
 */
export function depositBalancePayments(depositRaw: string, makeKey: () => string, current: readonly PaymentStageDraft[] = []): PaymentStageDraft[] {
    const kept = paymentPresetOf({ payments: current, fixedPayments: null }) === "deposit_balance" ? current : [];
    return [
        { key: kept[0]?.key ?? makeKey(), ...DEPOSIT_STAGE, percentage: depositRaw },
        { key: kept[1]?.key ?? makeKey(), ...BALANCE_STAGE, percentage: balanceFor(depositRaw) },
    ];
}

/** The stages a preset starts with. "Custom" keeps what is there, or opens one empty stage to fill in. */
export function presetPayments(preset: PaymentPreset, makeKey: () => string, current: readonly PaymentStageDraft[] = []): PaymentStageDraft[] {
    if (preset === "completion") return [{ key: makeKey(), ...COMPLETION_STAGE, percentage: "100" }];
    if (preset === "deposit_balance") return depositBalancePayments(String(DEFAULT_DEPOSIT_PERCENT), makeKey, current);
    return current.length > 0 ? [...current] : [{ key: makeKey(), stage: "", when: "", percentage: "" }];
}

/**
 * Which preset the saved or typed stages are, so the screen opens on the
 * choice the contractor made. Null when there are no stages, or when they
 * are fixed amounts from the earlier editor.
 */
export function paymentPresetOf(draft: { payments: readonly PaymentStageDraft[]; fixedPayments: unknown[] | null }): PaymentPreset | null {
    if (draft.fixedPayments) return null;
    const rows = draft.payments;
    if (rows.length === 0) return null;
    if (rows.length === 1 && rows[0].stage === COMPLETION_STAGE.stage && parsePercentage(rows[0].percentage) === 100) return "completion";
    if (rows.length === 2 && rows[0].stage === DEPOSIT_STAGE.stage && rows[1].stage === BALANCE_STAGE.stage
        && rows[1].percentage === balanceFor(rows[0].percentage)) return "deposit_balance";
    return "custom";
}

// ── Save payload ─────────────────────────────────────────────────────────────

export interface ProposalDraftPayload {
    introduction: string;
    scope: string;
    exclusions: string;
    clarifications: string;
    closing: string;
    validityDays: number;
    /** Null leaves the saved payment stages as they are. */
    paymentSchedule: Array<{ id: string; stage: string; description: string; percentage: number }> | null;
    photos: PhotoDraft[];
    caseStudyIds: string[];
    terms: ProposalTermsClause[] | null;
}

export type ReviewFieldErrors = Record<string, string>;
export const paymentStageField = (key: string) => `payment:${key}:stage`;
export const paymentShareField = (key: string) => `payment:${key}:percentage`;
export const termField = (number: number) => `term:${number}`;

function parsePercentage(raw: string): number | null {
    const cleaned = raw.trim().replace(/%$/, "").trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
    return Number(cleaned);
}

/** The payment stages the draft describes, ignoring rows left completely blank. */
function builtPayments(draft: ProposalDraft, fieldErrors: ReviewFieldErrors) {
    const rows: NonNullable<ProposalDraftPayload["paymentSchedule"]> = [];
    for (const row of draft.payments) {
        const stage = row.stage.trim();
        const when = row.when.trim();
        if (!stage && !when && !row.percentage.trim()) continue;
        if (!stage) fieldErrors[paymentStageField(row.key)] = "Name this payment stage.";
        else if (stage.length > 200) fieldErrors[paymentStageField(row.key)] = "Keep the name under 200 characters.";
        const percentage = parsePercentage(row.percentage);
        if (percentage === null || percentage <= 0 || percentage > 100) {
            fieldErrors[paymentShareField(row.key)] = "Enter a percentage between 1 and 100.";
            continue;
        }
        rows.push({ id: row.key, stage, description: when.slice(0, 1000), percentage });
    }
    const total = roundMoney(rows.reduce((sum, row) => sum + row.percentage, 0));
    if (total > 100) fieldErrors.payments = `These stages add up to ${total}%. Bring them down to 100% or less.`;
    return rows;
}

export type BuildPayloadResult =
    | { ok: true; payload: ProposalDraftPayload }
    | { ok: false; fieldErrors: ReviewFieldErrors };

export function buildProposalPayload(draft: ProposalDraft): BuildPayloadResult {
    const fieldErrors: ReviewFieldErrors = {};

    for (const field of WORDING_FIELDS) {
        if (draft[field].length > TEXT_LIMITS[field]) {
            fieldErrors[field] = `This is too long. Keep it under ${TEXT_LIMITS[field].toLocaleString("en-GB")} characters.`;
        }
    }

    const validity = draft.validityDays.trim();
    const validityDays = /^\d{1,3}$/.test(validity) ? Number(validity) : NaN;
    if (!(validityDays >= 1 && validityDays <= 365)) fieldErrors.validityDays = "Enter a number of days between 1 and 365.";

    const paymentSchedule = draft.fixedPayments ? null : builtPayments(draft, fieldErrors);

    let terms: ProposalTermsClause[] | null = null;
    if (draft.terms) {
        if (draft.terms.length > MAX_TERMS) fieldErrors.terms = `Keep to ${MAX_TERMS} terms or fewer.`;
        terms = draft.terms.map((clause) => {
            const title = clause.title.trim();
            const body = clause.body.trim();
            if (!clause.hidden && (!title || !body)) fieldErrors[termField(clause.clause_number)] = "A term needs a title and its wording, or hide it.";
            if (title.length > 500 || body.length > 10_000) fieldErrors[termField(clause.clause_number)] = "This term is too long.";
            return { clause_number: clause.clause_number, title, body, hidden: clause.hidden, custom: clause.custom };
        });
    }

    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return {
        ok: true,
        payload: {
            introduction: draft.introduction.trim(),
            scope: draft.scope.trim(),
            exclusions: draft.exclusions.trim(),
            clarifications: draft.clarifications.trim(),
            closing: draft.closing.trim(),
            validityDays,
            paymentSchedule,
            photos: draft.photos
                .filter((photo) => photo.url)
                .slice(0, MAX_PHOTOS)
                .map((photo) => ({ url: photo.url, caption: photo.caption.trim().slice(0, 300) })),
            caseStudyIds: Array.from(new Set(draft.caseStudyIds)),
            terms,
        },
    };
}

// ── The draft as the project it would publish ────────────────────────────────

/** The payment stages a draft would publish, in the stored shape. */
function draftPaymentSchedule(draft: ProposalDraft): unknown[] {
    if (draft.fixedPayments) return draft.fixedPayments;
    return builtPayments(draft, {});
}

function draftTerms(draft: ProposalDraft): ProposalTermsClause[] {
    return resolveProposalTerms(draft.terms);
}

/**
 * The project as it would stand once this draft is saved. Readiness and the
 * preview both read this, so they describe the proposal the contractor is
 * about to send, not the one last saved.
 */
export function projectWithDraft(project: ReviewProject, draft: ProposalDraft): ReviewProject {
    return {
        ...project,
        proposal_introduction: draft.introduction,
        scope_text: draft.scope,
        exclusions_text: draft.exclusions,
        clarifications_text: draft.clarifications,
        closing_statement: draft.closing,
        payment_schedule: draftPaymentSchedule(draft),
        site_photos: draft.photos,
        selected_case_study_ids: draft.caseStudyIds,
    };
}

export function contractSumOf(estimate: ProposalPublicationEstimateInput | null): number {
    return estimate ? roundMoney(computeContractSum(estimate, estimate.estimate_lines).contractSum) : 0;
}

/** What must be true before this draft can be sent, and what would improve it. */
export function reviewReadiness(context: ReviewContext, draft: ProposalDraft): ProposalReadiness {
    const project = projectWithDraft(context.project, draft);
    return evaluateProposalReadiness({
        projectName: project.name,
        clientName: project.client_name,
        scope: draft.scope,
        contractSum: contractSumOf(context.estimate),
        programmePhases: resolveProgrammeSource(project).phases,
        projectStartDate: project.start_date,
        paymentSchedule: project.payment_schedule,
        terms: draftTerms(draft),
        introduction: draft.introduction,
        aboutBusiness: context.profile.capability_statement,
        hasPhotos: draft.photos.some((photo) => photo.url),
        hasCaseStudies: draft.caseStudyIds.length > 0,
        exclusions: draft.exclusions,
        clarifications: draft.clarifications,
        closingStatement: draft.closing,
    });
}

export const PREVIEW_PUBLICATION_ID = "00000000-0000-4000-8000-000000000000";

/**
 * The snapshot this draft would publish, for the preview. It is built by the
 * same function that builds a real publication. Null only when the project
 * has no name or no estimate to price from.
 */
export function buildPreviewSnapshot(
    context: ReviewContext,
    draft: ProposalDraft,
    responseKind: ProposalResponseKind,
    now: string,
): ProposalPublicationSnapshot | null {
    if (!context.estimate) return null;
    const validity = Number(draft.validityDays);
    try {
        return buildProposalPublicationSnapshot({
            publicationId: PREVIEW_PUBLICATION_ID,
            versionNumber: context.nextVersion,
            sentAt: now,
            validityDays: Number.isInteger(validity) && validity >= 1 && validity <= 365 ? validity : DEFAULT_VALIDITY_DAYS,
            project: projectWithDraft(context.project, draft),
            profile: context.profile,
            estimate: context.estimate,
            termsProfileVersion: PROPOSAL_TERMS_PROFILE_VERSION,
            resolvedTerms: draftTerms(draft),
            responseKind,
            ...vatFor(context.project),
        }, { allowIncomplete: true });
    } catch {
        return null;
    }
}

/** VAT as the publication states it. Used by the preview and by the real publish. */
export function vatFor(project: { is_vat_reverse_charge?: boolean | null }) {
    return project.is_vat_reverse_charge === true
        ? { vatRate: 0, vatTreatment: "domestic_reverse_charge" as const }
        : { vatRate: 20, vatTreatment: "standard" as const };
}

// ── AI wording ───────────────────────────────────────────────────────────────

export interface WordingSuggestion {
    id: string;
    field: WordingField;
    text: string;
    /** The contractor's own text the suggestion was written from. */
    basedOn: string;
}

const FIGURE = /\d+(?:[.,]\d+)*/g;

/**
 * Figures in a suggestion that the contractor did not write. The assistant
 * may reword a figure the contractor stated; it may never supply one.
 */
export function addedFigures(original: string, suggestion: string): string[] {
    const normalise = (figure: string) => figure.replace(/,/g, "");
    const stated = new Set((original.match(FIGURE) ?? []).map(normalise));
    return Array.from(new Set((suggestion.match(FIGURE) ?? []).filter((figure) => !stated.has(normalise(figure)))));
}

export function isSuggestionStale(suggestion: WordingSuggestion, draft: ProposalDraft): boolean {
    return draft[suggestion.field] !== suggestion.basedOn;
}

export const AI_UNAVAILABLE_ERROR = "The assistant isn't available right now. Your own wording is unchanged and you can carry on without it.";
export const AI_ADDED_FIGURES_ERROR = "The suggestion added figures you didn't write, so it was dropped. Your own wording is unchanged.";

// ── State ────────────────────────────────────────────────────────────────────

export const DRAFT_SAVE_ERROR = "The proposal couldn't be saved. Nothing you typed has been lost. Check your connection and try again.";
export const PUBLISH_ERROR = "The proposal was not published. Nothing has been sent to the client. Try again.";
export const PUBLISH_UNKNOWN_ERROR =
    "We couldn't confirm whether the proposal was published. Check the sent versions below before you send again.";
export const DELIVERY_ERROR = "The email could not be sent. The proposal is still published; share the link yourself or try the email again.";
export const REVIEW_CHANGED_ERROR =
    "This proposal has changed since you checked it, so it was not sent. Read the preview again, then tick the box and send.";

export type DeliveryOutcome =
    | { status: "sent"; email: string }
    | { status: "failed"; email: string }
    | { status: "not_requested" };

export interface PublishedResult {
    url: string;
    versionNumber: number;
    publicationId: string;
    responseKind: ProposalResponseKind;
    delivery: DeliveryOutcome;
    /** The fingerprint of what was published. It equals the one that was reviewed. */
    contentHash: string;
}

export interface ReviewState {
    draft: ProposalDraft;
    saved: ProposalDraft;
    save: { status: "idle" | "saving" | "failed"; error: string | null };
    fieldErrors: ReviewFieldErrors;
    ai: { status: "idle" | "loading" | "failed"; field: WordingField | null; requestId: string | null; error: string | null };
    suggestion: WordingSuggestion | null;
    responseKind: ProposalResponseKind;
    /** The contractor's explicit tick that this is ready to go to the client. */
    confirmed: boolean;
    /** `changed`: refused because what would be sent is not what was reviewed. */
    send: { status: "idle" | "publishing" | "published" | "failed" | "unknown"; error: string | null; changed?: boolean };
    published: PublishedResult | null;
    delivery: { status: "idle" | "sending"; error: string | null };
}

export function initialReviewState(draft: ProposalDraft, saved: ProposalDraft): ReviewState {
    return {
        draft,
        saved,
        save: { status: "idle", error: null },
        fieldErrors: {},
        ai: { status: "idle", field: null, requestId: null, error: null },
        suggestion: null,
        // Receipt only, unless the contractor chooses otherwise for this send.
        responseKind: DEFAULT_RESPONSE_KIND,
        confirmed: false,
        send: { status: "idle", error: null },
        published: null,
        delivery: { status: "idle", error: null },
    };
}

export type ReviewAction =
    | { type: "draft/change"; patch: Partial<ProposalDraft> }
    | { type: "save/started" }
    | { type: "save/succeeded"; snapshot: ProposalDraft }
    | { type: "save/failed"; error: string; fieldErrors?: ReviewFieldErrors }
    | { type: "ai/started"; field: WordingField; requestId: string }
    | { type: "ai/succeeded"; requestId: string; suggestion: WordingSuggestion }
    | { type: "ai/failed"; requestId: string; error: string }
    | { type: "ai/dismiss" }
    | { type: "suggestion/apply" }
    | { type: "suggestion/discard" }
    | { type: "response/choose"; kind: ProposalResponseKind }
    | { type: "confirm/set"; confirmed: boolean }
    | { type: "send/started" }
    | { type: "send/published"; result: PublishedResult }
    | { type: "send/failed"; error: string; changed?: boolean }
    | { type: "send/unknown" }
    | { type: "send/reset" }
    | { type: "delivery/started" }
    | { type: "delivery/finished"; delivery: DeliveryOutcome; error: string | null };

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
    switch (action.type) {
        case "draft/change":
            return {
                ...state,
                draft: { ...state.draft, ...action.patch },
                fieldErrors: {},
                save: state.save.status === "failed" ? { status: "idle", error: null } : state.save,
                // A change after ticking the box is a different proposal: ask again.
                confirmed: false,
            };

        case "save/started":
            if (state.save.status === "saving") return state;
            return { ...state, save: { status: "saving", error: null }, fieldErrors: {} };

        case "save/succeeded":
            return { ...state, saved: action.snapshot, save: { status: "idle", error: null } };

        case "save/failed":
            return { ...state, save: { status: "failed", error: action.error }, fieldErrors: action.fieldErrors ?? {} };

        case "ai/started":
            if (state.ai.status === "loading" || state.suggestion) return state;
            return { ...state, ai: { status: "loading", field: action.field, requestId: action.requestId, error: null } };

        case "ai/succeeded":
            // A reply to a request that is no longer the current one is dropped.
            if (state.ai.requestId !== action.requestId) return state;
            return { ...state, suggestion: action.suggestion, ai: { status: "idle", field: null, requestId: null, error: null } };

        case "ai/failed":
            if (state.ai.requestId !== action.requestId) return state;
            return { ...state, ai: { status: "failed", field: state.ai.field, requestId: null, error: action.error } };

        case "ai/dismiss":
            return { ...state, ai: { status: "idle", field: null, requestId: null, error: null } };

        case "suggestion/apply": {
            const { suggestion } = state;
            // Applied only to the text it was written from. It changes the
            // draft; the normal save is what persists it.
            if (!suggestion || isSuggestionStale(suggestion, state.draft)) return state;
            return {
                ...state,
                draft: { ...state.draft, [suggestion.field]: suggestion.text },
                suggestion: null,
                confirmed: false,
            };
        }

        case "suggestion/discard":
            return { ...state, suggestion: null };

        case "response/choose":
            return { ...state, responseKind: action.kind, confirmed: false };

        case "confirm/set":
            return { ...state, confirmed: action.confirmed };

        case "send/started":
            if (state.send.status === "publishing") return state;
            return { ...state, send: { status: "publishing", error: null } };

        case "send/published":
            return {
                ...state,
                send: { status: "published", error: null },
                published: action.result,
                confirmed: false,
                delivery: {
                    status: "idle",
                    error: action.result.delivery.status === "failed" ? DELIVERY_ERROR : null,
                },
            };

        case "send/failed":
            // A proposal that changed under the contractor has to be read
            // again before it can go, so the tick comes off.
            return action.changed
                ? { ...state, send: { status: "failed", error: action.error, changed: true }, confirmed: false }
                : { ...state, send: { status: "failed", error: action.error } };

        case "send/unknown":
            return { ...state, send: { status: "unknown", error: PUBLISH_UNKNOWN_ERROR }, confirmed: false };

        case "send/reset":
            return { ...state, send: { status: "idle", error: null }, published: null, delivery: { status: "idle", error: null } };

        case "delivery/started":
            if (!state.published || state.delivery.status === "sending") return state;
            return { ...state, delivery: { status: "sending", error: null } };

        case "delivery/finished":
            if (!state.published) return state;
            return {
                ...state,
                published: { ...state.published, delivery: action.delivery },
                delivery: { status: "idle", error: action.error },
            };
    }
}

// ── Derived status ───────────────────────────────────────────────────────────

export function isReviewDirty(state: ReviewState): boolean {
    return !draftsEqual(state.draft, state.saved);
}

export type ReviewSaveStatus = "unsaved" | "saving" | "saved" | "failed";

export function reviewSaveStatus(state: ReviewState): ReviewSaveStatus {
    if (state.save.status === "saving") return "saving";
    if (state.save.status === "failed") return "failed";
    return isReviewDirty(state) ? "unsaved" : "saved";
}

export const REVIEW_STATUS_LABEL: Record<ReviewSaveStatus, string> = {
    unsaved: "Unsaved",
    saving: "Saving",
    saved: "Saved",
    failed: "Failed - try again",
};

export type SendBlock = "publishing" | "not-ready" | "save-failed" | "saving" | "suggestion-pending" | "not-confirmed" | null;

/** Why Send is not available right now, in the order the contractor should deal with it. */
export function sendBlock(state: ReviewState, readiness: Pick<ProposalReadiness, "ready">): SendBlock {
    if (state.send.status === "publishing") return "publishing";
    if (state.save.status === "saving") return "saving";
    if (state.save.status === "failed") return "save-failed";
    if (!readiness.ready) return "not-ready";
    if (state.suggestion) return "suggestion-pending";
    if (!state.confirmed) return "not-confirmed";
    return null;
}

export const SEND_BLOCK_MESSAGE: Record<Exclude<SendBlock, null>, string> = {
    publishing: "Sending now. Please wait.",
    saving: "Saving your changes. You can send in a moment.",
    "save-failed": "Your last changes did not save. Save them, then send.",
    "not-ready": "Finish the required items above before you send.",
    "suggestion-pending": "Apply or discard the suggested wording before you send.",
    "not-confirmed": "Tick the box to confirm this proposal is ready to go to your client.",
};

// ── Controllers ──────────────────────────────────────────────────────────────

export interface ReviewStore {
    getState: () => ReviewState;
    dispatch: (action: ReviewAction) => void;
}

type Outcome<T> = Promise<({ success: true } & T) | { success: false; error: string; changed?: boolean }>;

export type SaveProposalDraft = (payload: ProposalDraftPayload) => Outcome<object>;
export type AskWording = (field: WordingField, text: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
export type PublishProposal = (input: {
    responseKind: ProposalResponseKind;
    deliverByEmail: boolean;
    /** The fingerprint of the content the contractor confirmed. */
    reviewedContent: string;
}) => Outcome<Omit<PublishedResult, "responseKind">>;
export type RetryDelivery = (input: { publicationId: string; url: string }) => Outcome<{ delivery: DeliveryOutcome }>;

export type DraftSaveOutcome = "saved" | "failed" | "invalid" | "busy";

/** Saves the draft as it stands. A failed save never clears or replaces it. */
export async function saveDraft(store: ReviewStore, save: SaveProposalDraft): Promise<DraftSaveOutcome> {
    const state = store.getState();
    if (state.save.status === "saving") return "busy";

    const built = buildProposalPayload(state.draft);
    if (!built.ok) {
        store.dispatch({ type: "save/failed", error: "Fix the highlighted details, then save.", fieldErrors: built.fieldErrors });
        return "invalid";
    }

    const snapshot = state.draft;
    store.dispatch({ type: "save/started" });
    try {
        const result = await save(built.payload);
        if (result.success) {
            store.dispatch({ type: "save/succeeded", snapshot });
            return "saved";
        }
        store.dispatch({ type: "save/failed", error: result.error || DRAFT_SAVE_ERROR });
        return "failed";
    } catch {
        store.dispatch({ type: "save/failed", error: DRAFT_SAVE_ERROR });
        return "failed";
    }
}

/**
 * Asks for clearer wording of one field. Never changes the draft: the reply
 * waits as a pending suggestion. A reply that adds a figure the contractor
 * did not write is dropped.
 */
export async function requestWording(store: ReviewStore, ask: AskWording, field: WordingField, requestId: string): Promise<void> {
    const before = store.getState();
    const text = before.draft[field];
    if (!text.trim() || before.ai.status === "loading" || before.suggestion) return;

    store.dispatch({ type: "ai/started", field, requestId });
    try {
        const reply = await ask(field, text);
        if (!reply.ok) {
            store.dispatch({ type: "ai/failed", requestId, error: reply.error || AI_UNAVAILABLE_ERROR });
            return;
        }
        const suggested = reply.text.trim().slice(0, TEXT_LIMITS[field]);
        if (!suggested) {
            store.dispatch({ type: "ai/failed", requestId, error: AI_UNAVAILABLE_ERROR });
            return;
        }
        if (addedFigures(text, suggested).length > 0) {
            store.dispatch({ type: "ai/failed", requestId, error: AI_ADDED_FIGURES_ERROR });
            return;
        }
        store.dispatch({ type: "ai/succeeded", requestId, suggestion: { id: requestId, field, text: suggested, basedOn: text } });
    } catch {
        store.dispatch({ type: "ai/failed", requestId, error: AI_UNAVAILABLE_ERROR });
    }
}

export type SendOutcome = "published" | "blocked" | "save-failed" | "failed" | "unknown";

/**
 * Publishes the proposal. It goes ahead only when the draft is ready and the
 * contractor has confirmed. Anything unsaved is saved first, so what is
 * published is what is on screen. The outcome is reported as it happened:
 *  - a refusal means nothing was published;
 *  - a lost reply means we do not know, and says so;
 *  - once published, a failed email is reported as a failed email only.
 */
export async function sendProposal(
    store: ReviewStore,
    deps: {
        save: SaveProposalDraft;
        publish: PublishProposal;
        readiness: () => Pick<ProposalReadiness, "ready">;
        deliverByEmail: boolean;
        /**
         * The fingerprint of the proposal as it stands on screen now, or null
         * when there is nothing that could be sent. Read after any save, so
         * it describes exactly what the contractor confirmed.
         */
        reviewedContent: () => Promise<string | null>;
    },
): Promise<SendOutcome> {
    if (sendBlock(store.getState(), deps.readiness()) !== null) return "blocked";

    if (isReviewDirty(store.getState())) {
        const saved = await saveDraft(store, deps.save);
        if (saved !== "saved") return "save-failed";
        // Typing during the save leaves newer text unsaved and unconfirmed.
        if (isReviewDirty(store.getState()) || sendBlock(store.getState(), deps.readiness()) !== null) return "blocked";
    }

    const { responseKind } = store.getState();
    store.dispatch({ type: "send/started" });

    // Worked out before anything is asked of the server, so failing here is
    // plainly "not sent" and never "we could not tell".
    let reviewedContent: string | null = null;
    try {
        reviewedContent = await deps.reviewedContent();
    } catch {
        reviewedContent = null;
    }
    if (!reviewedContent) {
        store.dispatch({ type: "send/failed", error: PUBLISH_ERROR });
        return "failed";
    }

    try {
        const result = await deps.publish({ responseKind, deliverByEmail: deps.deliverByEmail, reviewedContent });
        if (!result.success) {
            store.dispatch({ type: "send/failed", error: result.error || PUBLISH_ERROR, changed: result.changed === true });
            return "failed";
        }
        store.dispatch({
            type: "send/published",
            result: {
                url: result.url,
                versionNumber: result.versionNumber,
                publicationId: result.publicationId,
                responseKind,
                delivery: result.delivery,
                contentHash: result.contentHash,
            },
        });
        return "published";
    } catch {
        store.dispatch({ type: "send/unknown" });
        return "unknown";
    }
}

/** Tries the client email again for a proposal that is already published. */
export async function retryDelivery(store: ReviewStore, retry: RetryDelivery): Promise<void> {
    const { published, delivery } = store.getState();
    if (!published || published.delivery.status !== "failed" || delivery.status === "sending") return;
    const failed = published.delivery;

    store.dispatch({ type: "delivery/started" });
    try {
        const result = await retry({ publicationId: published.publicationId, url: published.url });
        if (result.success) {
            store.dispatch({
                type: "delivery/finished",
                delivery: result.delivery,
                error: result.delivery.status === "failed" ? DELIVERY_ERROR : null,
            });
        } else {
            store.dispatch({ type: "delivery/finished", delivery: failed, error: result.error || DELIVERY_ERROR });
        }
    } catch {
        store.dispatch({ type: "delivery/finished", delivery: failed, error: DELIVERY_ERROR });
    }
}
