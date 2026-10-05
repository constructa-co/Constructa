/**
 * Proposal readiness — what must be true before a proposal can be published.
 *
 * Pure and deterministic so the editor, the publish handlers and the unit
 * tests all agree on one answer. Mandatory items block publication;
 * recommended items never do.
 *
 * Wording is for a trade contractor, not an estimator: say what is missing
 * and where to fix it.
 */

import { roundMoney } from "./financial";
import { computeProgrammePlan, planCoversEveryPhase } from "./programme-plan";

export { isUntouchedStarterProgramme, type StarterPhaseSeed } from "./programme-plan";

export type ReadinessKey =
    | "identity"
    | "scope"
    | "contractValue"
    | "programme"
    | "payment"
    | "terms";

export type RecommendedKey =
    | "introduction"
    | "about"
    | "photos"
    | "caseStudies"
    | "exclusions"
    | "clarifications"
    | "closingStatement"
    | "paymentCoverage";

export interface ReadinessItem<K extends string = ReadinessKey> {
    key: K;
    label: string;
    ok: boolean;
    /** Plain-language instruction shown only when the item is unresolved. */
    fix: string;
}

export interface ProposalReadinessInput {
    projectName?: string | null;
    clientName?: string | null;
    scope?: string | null;
    /** Canonical contract sum ex VAT from the active estimate. */
    contractSum?: number | null;
    /** Phases exactly as they would be published (Programme tab or legacy). */
    programmePhases?: unknown[] | null;
    /** Project start date — anchors Programme-tab phases that store an offset. */
    projectStartDate?: string | null;
    paymentSchedule?: unknown[] | null;
    /** Resolved terms as they would be published. */
    terms?: unknown[] | null;
    // Recommended — never block publication.
    introduction?: string | null;
    /** The contractor's description of their business, from the company profile. */
    aboutBusiness?: string | null;
    hasPhotos?: boolean;
    hasCaseStudies?: boolean;
    exclusions?: string | null;
    clarifications?: string | null;
    closingStatement?: string | null;
}

export interface ProposalReadiness {
    ready: boolean;
    mandatory: ReadinessItem[];
    missing: ReadinessItem[];
    recommended: ReadinessItem<RecommendedKey>[];
}

function hasText(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function positiveNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function isValidDate(value: unknown): boolean {
    return hasText(value) && !Number.isNaN(new Date(value as string).getTime());
}

/**
 * A phase counts when it has a name, a positive duration and a start date.
 * Programme-tab phases store a day offset from the project start date, so
 * they are dated only when the project itself has a start date.
 */
export function isValidProgrammePhase(phase: unknown, projectStartDate?: string | null): boolean {
    const p = asRecord(phase);
    if (!hasText(p.name)) return false;

    const duration = p.manualDays != null
        ? positiveNumber(p.manualDays)
        : positiveNumber(p.calculatedDays) || positiveNumber(p.duration_days);
    if (duration <= 0) return false;

    if (isValidDate(p.start_date)) return true;
    const offset = p.startOffset == null ? 0 : Number(p.startOffset);
    return isValidDate(projectStartDate) && Number.isFinite(offset) && offset >= 0;
}

/** A payment row counts when it has a stage name and a share or amount above zero. */
export function isValidPaymentRow(row: unknown): boolean {
    const r = asRecord(row);
    if (!hasText(r.stage)) return false;
    return positiveNumber(r.percentage) > 0 || positiveNumber(r.amount) > 0;
}

/**
 * What the payment stages add up to, as a share of the price. A stage with
 * its own amount counts as that amount; a percentage stage as that share.
 */
export function paymentCoverage(rows: unknown[] | null | undefined, contractSum: number | null | undefined): number | null {
    const total = positiveNumber(contractSum);
    const valid = (Array.isArray(rows) ? rows : []).filter(isValidPaymentRow).map(asRecord);
    if (valid.length === 0 || total <= 0) return null;
    const amount = valid.reduce((sum, row) => {
        const fixed = positiveNumber(row.amount);
        return sum + (fixed > 0 ? fixed : (total * positiveNumber(row.percentage)) / 100);
    }, 0);
    return roundMoney((amount / total) * 100);
}

function isVisibleTerm(clause: unknown): boolean {
    const c = asRecord(clause);
    return c.hidden !== true && hasText(c.body);
}

export function evaluateProposalReadiness(input: ProposalReadinessInput): ProposalReadiness {
    const hasProject = hasText(input.projectName);
    const hasClient = hasText(input.clientName);
    const phases = Array.isArray(input.programmePhases) ? input.programmePhases : [];
    const payments = Array.isArray(input.paymentSchedule) ? input.paymentSchedule : [];
    const terms = Array.isArray(input.terms) ? input.terms : [];
    // The proposal shows a start, a finish and a length, and every stage the
    // contractor saved. All of it comes from the one programme calculation,
    // so that must produce an answer that leaves no saved stage out: a stage
    // with no name, start or length blocks sending rather than being dropped
    // or given an invented name.
    const unusablePhases = phases.filter((phase) => !isValidProgrammePhase(phase, input.projectStartDate)).length;
    const hasProgramme = phases.length > 0
        && unusablePhases === 0
        && planCoversEveryPhase(computeProgrammePlan(input.projectStartDate, phases), phases);
    const hasStart = isValidDate(input.projectStartDate) || phases.some((phase) => isValidDate(asRecord(phase).start_date));
    const coverage = paymentCoverage(payments, input.contractSum);
    const paymentsExceedPrice = coverage !== null && coverage > 100.01;

    const mandatory: ReadinessItem[] = [
        {
            key: "identity",
            label: "Job and client name",
            ok: hasProject && hasClient,
            fix: !hasProject && !hasClient
                ? "Add the job name and the client's name in project details."
                : !hasProject
                    ? "Add the job name in project details."
                    : "Add the client's name in project details.",
        },
        {
            key: "scope",
            label: "What you're doing",
            ok: hasText(input.scope),
            fix: "Write what work you're doing in Scope of Works.",
        },
        {
            key: "contractValue",
            label: "Price",
            ok: positiveNumber(input.contractSum) > 0,
            fix: "Price the job in Estimates. The total must be more than £0.",
        },
        {
            key: "programme",
            label: "Programme",
            ok: hasProgramme,
            fix: phases.length === 0 || !hasStart
                ? "Add the start date and how long the job takes in Programme."
                : unusablePhases === 1
                    ? "One of your programme stages has no name or no length. Fix or remove it in Programme."
                    : unusablePhases > 1
                        ? "Some of your programme stages have no name or no length. Fix or remove them in Programme."
                        : "One of your programme stages cannot be dated. Check its start and length in Programme.",
        },
        {
            key: "payment",
            label: "Payment stages",
            ok: payments.some(isValidPaymentRow) && !paymentsExceedPrice,
            fix: paymentsExceedPrice
                ? `Your payment stages add up to ${coverage}% of the price. Bring them down to 100% or less.`
                : "Choose how you are paid: on completion, a deposit and balance, or your own stages.",
        },
        {
            key: "terms",
            label: "Terms",
            ok: terms.some(isVisibleTerm),
            fix: "Keep at least one term showing in Terms & Conditions.",
        },
    ];

    const recommended: ReadinessItem<RecommendedKey>[] = [
        { key: "introduction", label: "Opening message", ok: hasText(input.introduction), fix: "Write a short opening message to the client." },
        { key: "about", label: "About your business", ok: hasText(input.aboutBusiness), fix: "Describe your business in your company profile." },
        { key: "photos", label: "Site photos", ok: input.hasPhotos === true, fix: "Add a site photo." },
        { key: "caseStudies", label: "Past jobs", ok: input.hasCaseStudies === true, fix: "Choose a past job to show, or add one in Case Studies." },
        { key: "exclusions", label: "What's not included", ok: hasText(input.exclusions), fix: "List what's not included." },
        { key: "clarifications", label: "Clarifications", ok: hasText(input.clarifications), fix: "Add any clarifications." },
        { key: "closingStatement", label: "Closing message", ok: hasText(input.closingStatement), fix: "Add a closing message." },
        {
            key: "paymentCoverage",
            label: "Payment stages cover the whole price",
            ok: coverage === null || coverage >= 99.99,
            fix: `Your payment stages cover ${coverage ?? 0}% of the price. Add stages until they reach 100%.`,
        },
    ];

    const missing = mandatory.filter((item) => !item.ok);
    return { ready: missing.length === 0, mandatory, missing, recommended };
}

// ── Publish gate ───────────────────────────────────────────────────────────

export type ProposalSaveState = "idle" | "saving" | "saved" | "error";

export type PublishBlockReason = "publishing" | "save-failed" | "saving" | "not-ready";

export interface PublishGate {
    blocked: boolean;
    reason: PublishBlockReason | null;
    /** Why sending is blocked and what to do about it. Null when clear to send. */
    message: string | null;
}

/**
 * Whether the on-screen explanation is shown. While a publication is in
 * flight the buttons carry their own busy label, so nothing is rendered and
 * nothing may point at it with aria-describedby.
 */
export function showsPublishBlockReason(gate: Pick<PublishGate, "blocked" | "reason">): boolean {
    return gate.blocked && gate.reason !== "publishing";
}

export function getPublishGate(input: {
    saveState: ProposalSaveState;
    /** A manual save is in flight. */
    saving?: boolean;
    /** A publication is already in flight. */
    publishing?: boolean;
    readiness: Pick<ProposalReadiness, "ready" | "missing">;
}): PublishGate {
    if (input.publishing) {
        return { blocked: true, reason: "publishing", message: "Sending now. Please wait." };
    }
    if (input.saveState === "error") {
        return {
            blocked: true,
            reason: "save-failed",
            message: "Your last changes did not save. Press Retry save, then send.",
        };
    }
    if (input.saving || input.saveState === "saving") {
        return { blocked: true, reason: "saving", message: "Saving your changes. You can send in a moment." };
    }
    if (!input.readiness.ready) {
        const count = input.readiness.missing.length;
        return {
            blocked: true,
            reason: "not-ready",
            message: `Finish ${count} ${count === 1 ? "item" : "items"} above before you send.`,
        };
    }
    return { blocked: false, reason: null, message: null };
}
