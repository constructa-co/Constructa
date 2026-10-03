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

export type ReadinessKey =
    | "identity"
    | "scope"
    | "contractValue"
    | "programme"
    | "payment"
    | "terms";

export type RecommendedKey =
    | "photos"
    | "caseStudies"
    | "exclusions"
    | "clarifications"
    | "closingStatement";

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

export interface StarterPhaseSeed {
    name: string;
    duration_days: number;
    duration_unit: string;
}

/**
 * True when the phases are still the seeded starter list, i.e. nothing the
 * contractor has decided. Ids and colours carry no meaning, so they are
 * ignored. Any change to a name, a duration, a duration unit or a start
 * date, or adding or removing a phase, makes it the contractor's programme.
 *
 * Starter phases are seeded with the project start date, or with no start
 * when the project had none at the time. Both count as the seeded start.
 */
export function isUntouchedStarterProgramme(
    phases: unknown[] | null | undefined,
    seeds: readonly StarterPhaseSeed[],
    projectStartDate?: string | null,
): boolean {
    if (!Array.isArray(phases) || phases.length !== seeds.length) return false;
    const seededStart = typeof projectStartDate === "string" ? projectStartDate.trim() : "";
    return phases.every((phase, index) => {
        const p = asRecord(phase);
        const seed = seeds[index];
        const start = typeof p.start_date === "string" ? p.start_date.trim() : "";
        return p.name === seed.name
            && Number(p.duration_days) === seed.duration_days
            && p.duration_unit === seed.duration_unit
            && (start === "" || start === seededStart);
    });
}

/** A payment row counts when it has a stage name and a share or amount above zero. */
export function isValidPaymentRow(row: unknown): boolean {
    const r = asRecord(row);
    if (!hasText(r.stage)) return false;
    return positiveNumber(r.percentage) > 0 || positiveNumber(r.amount) > 0;
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
            ok: phases.some((phase) => isValidProgrammePhase(phase, input.projectStartDate)),
            fix: "Add at least one stage with a name, a start date and how long it takes in Programme.",
        },
        {
            key: "payment",
            label: "Payment stages",
            ok: payments.some(isValidPaymentRow),
            fix: "Add at least one payment stage with a name and an amount or percentage.",
        },
        {
            key: "terms",
            label: "Terms",
            ok: terms.some(isVisibleTerm),
            fix: "Keep at least one term showing in Terms & Conditions.",
        },
    ];

    const recommended: ReadinessItem<RecommendedKey>[] = [
        { key: "photos", label: "Site photos", ok: input.hasPhotos === true, fix: "Add a site photo." },
        { key: "caseStudies", label: "Past jobs", ok: input.hasCaseStudies === true, fix: "Add a past job in Case Studies." },
        { key: "exclusions", label: "What's not included", ok: hasText(input.exclusions), fix: "List what's not included." },
        { key: "clarifications", label: "Clarifications", ok: hasText(input.clarifications), fix: "Add any clarifications." },
        { key: "closingStatement", label: "Closing message", ok: hasText(input.closingStatement), fix: "Add a closing message." },
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
