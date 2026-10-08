import { computeContractSum, roundMoney, toNumber } from "@/lib/financial";
import { computeProgrammePlan, planCoversEveryPhase, resolveProgrammeSource, type ProgrammePlan } from "@/lib/programme-plan";
import { isProposalResponseKind, responseWording, type ProposalResponseKind } from "@/lib/proposal-response";
import { resolveSelectedCaseStudies, type LibraryRow } from "@/lib/case-library/resolve";

/** Said when a chosen past job cannot be sent. The proposal is not published short of it. */
export const CASE_STUDY_UNSENDABLE_ERROR = "One of the past jobs you chose can't be sent. Untick it under Relevant experience, or fix it in Case Studies, then check the proposal again.";

/**
 * The response mode the database enforces. Every new publication is
 * "acknowledgement", which permits a single non-binding response and never
 * acceptance. "binding_acceptance" exists only on publications made before
 * binding acceptance was withdrawn; it is read, never written.
 */
export type ProposalResponseMode = "binding_acceptance" | "acknowledgement";

export interface ProposalPublicationProjectInput {
    id: string;
    name: string;
    project_type?: string | null;
    client_name?: string | null;
    client_address?: string | null;
    site_address?: string | null;
    start_date?: string | null;
    proposal_introduction?: string | null;
    scope_text?: string | null;
    exclusions_text?: string | null;
    clarifications_text?: string | null;
    closing_statement?: string | null;
    programme_phases?: unknown[] | null;
    gantt_phases?: unknown[] | null;
    payment_schedule?: unknown[] | null;
    site_photos?: unknown[] | null;
    selected_case_study_ids?: unknown[] | null;
}

export interface ProposalPublicationProfileInput {
    company_name?: string | null;
    logo_url?: string | null;
    phone?: string | null;
    website?: string | null;
    accreditations?: string | null;
    capability_statement?: string | null;
    years_trading?: number | null;
    specialisms?: string | null;
    insurance_details?: string | null;
    pdf_theme?: string | null;
    md_name?: string | null;
    md_message?: string | null;
    case_studies?: unknown[] | null;
}

export interface ProposalPublicationEstimateLineInput {
    id: string;
    trade_section?: string | null;
    description?: string | null;
    quantity?: number | string | null;
    unit?: string | null;
    line_total?: number | string | null;
}

export interface ProposalPublicationEstimateInput {
    id: string;
    version_name?: string | null;
    total_cost?: number | string | null;
    prelims_pct?: number | string | null;
    overhead_pct?: number | string | null;
    risk_pct?: number | string | null;
    profit_pct?: number | string | null;
    discount_pct?: number | string | null;
    estimate_lines: ProposalPublicationEstimateLineInput[];
}

export interface ProposalTermClause {
    title: string;
    body: string;
}

export interface BuildProposalPublicationInput {
    publicationId: string;
    versionNumber: number;
    sentAt: string;
    validityDays: number;
    project: ProposalPublicationProjectInput;
    profile: ProposalPublicationProfileInput;
    estimate: ProposalPublicationEstimateInput;
    termsProfileVersion: string;
    resolvedTerms: ProposalTermClause[];
    /** What the client is asked for. Binding acceptance cannot be requested. */
    responseKind: ProposalResponseKind;
    vatRate?: number;
    /** Why the rate is what it is. A reverse charge always publishes at 0%. */
    vatTreatment?: ProposalVatTreatment;
    /**
     * The contractor's own case-study library rows, when the library is in
     * use. Left out, there are none: older case studies are chosen exactly
     * as before, and a saved library tick cannot be honoured.
     */
    caseStudyLibrary?: { userId: string; rows: readonly LibraryRow[] };
}

export type ProposalVatTreatment = "standard" | "domestic_reverse_charge";

export interface ProposalCaseStudy {
    title: string;
    project_type: string | null;
    location: string | null;
    client: string | null;
    contract_value: string | null;
    duration: string | null;
    delivered: string | null;
    value_added: string | null;
    photos: string[];
}

export interface ProposalPhoto {
    url: string;
    caption: string | null;
}

export interface ProposalPublicationSnapshot {
    schema_version: 1;
    publication: {
        id: string;
        version_number: number;
        sent_at: string;
        expires_at: string;
        validity_days: number;
        response_mode: ProposalResponseMode;
    };
    project: {
        id: string;
        name: string;
        project_type: string | null;
        client_name: string | null;
        client_address: string | null;
        site_address: string | null;
        start_date: string | null;
    };
    contractor: {
        company_name: string;
        logo_url: string | null;
        phone: string | null;
        website: string | null;
        accreditations: string | null;
        capability_statement: string | null;
        years_trading: number | null;
        specialisms: string | null;
        insurance_details: string | null;
        pdf_theme: string | null;
        md_name?: string | null;
        md_message?: string | null;
    };
    content: {
        introduction: string | null;
        scope: string | null;
        exclusions: string | null;
        clarifications: string | null;
        closing_statement: string | null;
    };
    commercial: {
        currency: "GBP";
        estimate_id: string;
        estimate_version_name: string | null;
        contract_sum_ex_vat: number;
        vat_rate: number;
        vat_amount: number;
        contract_sum_inc_vat: number;
        /** Absent on publications made before it was recorded. */
        vat_treatment?: ProposalVatTreatment;
        fee_items: Array<{
            id: string;
            trade_section: string;
            description: string;
            quantity: number;
            unit: string;
            amount_ex_vat: number;
        }>;
        payment_schedule: Array<{
            id: string | null;
            stage: string;
            description: string | null;
            percentage: number;
            amount: number | null;
        }>;
    };
    programme: Array<{
        id: string | null;
        name: string;
        duration_days: number;
        duration_unit: string;
        start_offset_days: number;
        start_date: string | null;
    }>;
    terms: {
        profile_version: string;
        clauses: ProposalTermClause[];
    };
    // Everything below was added after the first publications were made.
    // It is absent on those, and they are rendered from what they do carry.
    /** The canonical programme: start, finish, length and stages. */
    programme_plan?: ProgrammePlan;
    /** What the client was asked for, with the statement they were shown. */
    response?: {
        kind: ProposalResponseKind;
        notice: string;
    };
    case_studies?: ProposalCaseStudy[];
    photos?: ProposalPhoto[];
}

export const PROGRAMME_REQUIRED_ERROR = "A start date and how long the job takes are required before send.";
export const PROGRAMME_INCOMPLETE_ERROR =
    "One or more saved programme stages has no start or no length. Fix or remove it in Programme before send.";

const FORBIDDEN_PUBLICATION_KEYS = new Set([
    "total_cost",
    "prelims_pct",
    "overhead_pct",
    "risk_pct",
    "profit_pct",
    "discount_pct",
    "unit_rate",
    "internal_cost",
    "cost_price",
    "buy_rate",
    "markup",
    "supplier",
    "margin",
    "components",
    "estimate_line_components",
]);

function requiredText(value: string, label: string, maxLength: number): string {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) {
        throw new Error(`${label} is required and must be at most ${maxLength} characters.`);
    }
    return trimmed;
}

function optionalText(value: string | null | undefined, maxLength: number): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) throw new Error(`Publication text exceeds ${maxLength} characters.`);
    return trimmed;
}

function addCalendarDays(iso: string, days: number): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid proposal sent timestamp.");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}

function buildFeeItems(
    estimate: ProposalPublicationEstimateInput,
    contractSum: number,
): ProposalPublicationSnapshot["commercial"]["fee_items"] {
    const breakdown = computeContractSum(estimate, estimate.estimate_lines);
    const multiplier = breakdown.ohRiskProfitMultiplier;
    const sourceItems = estimate.estimate_lines
        .filter((line) => toNumber(line.line_total) > 0)
        .map((line) => ({
            id: line.id,
            trade_section: optionalText(line.trade_section, 200) ?? "General",
            description: optionalText(line.description, 1000) ?? "Works",
            quantity: toNumber(line.quantity),
            unit: optionalText(line.unit, 50) ?? "item",
            amount_ex_vat: roundMoney(toNumber(line.line_total) * multiplier),
        }));

    const hasExplicitPrelims = estimate.estimate_lines.some(
        (line) => (line.trade_section ?? "") === "Preliminaries",
    );
    if (!hasExplicitPrelims && breakdown.prelimsTotal > 0) {
        sourceItems.push({
            id: `preliminaries-${estimate.id}`,
            trade_section: "Preliminaries",
            description: "Project preliminaries",
            quantity: 1,
            unit: "sum",
            amount_ex_vat: roundMoney(breakdown.prelimsTotal * multiplier),
        });
    }

    if (sourceItems.length > 0) {
        const itemTotal = roundMoney(sourceItems.reduce((sum, line) => sum + line.amount_ex_vat, 0));
        const residual = roundMoney(contractSum - itemTotal);
        sourceItems[sourceItems.length - 1].amount_ex_vat = roundMoney(
            sourceItems[sourceItems.length - 1].amount_ex_vat + residual,
        );
    }

    return sourceItems;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function sanitisePaymentSchedule(value: unknown[] | null | undefined): ProposalPublicationSnapshot["commercial"]["payment_schedule"] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 100).map((entry, index) => {
        const row = asRecord(entry);
        return {
            id: optionalText(typeof row.id === "string" ? row.id : null, 100),
            stage: requiredText(typeof row.stage === "string" ? row.stage : `Stage ${index + 1}`, "Payment stage", 200),
            description: optionalText(typeof row.description === "string" ? row.description : null, 1000),
            percentage: Math.max(0, Math.min(100, toNumber(row.percentage as number | string | null))),
            amount: row.amount == null
                ? null
                : roundMoney(Math.max(0, toNumber(row.amount as number | string | null))),
        };
    });
}

/**
 * The stage list kept beside the canonical plan. It is written from the plan
 * itself, so the two can never describe different programmes: the same
 * stages, in the same order, with the same names and dates. Readers made
 * before the plan existed use this list; everything since uses the plan.
 */
function stageListFromPlan(plan: ProgrammePlan | null): ProposalPublicationSnapshot["programme"] {
    if (!plan) return [];
    return plan.stages.map((stage) => ({
        id: null,
        name: stage.name,
        duration_days: stage.working_days,
        duration_unit: "Days",
        start_offset_days: stage.offset_days,
        start_date: stage.start_date,
    }));
}

/**
 * A link that is safe to load as an image on a public page: https, or plain
 * http on this machine during development. Anything else is dropped.
 */
export function safeImageUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 2000) return null;
    try {
        const url = new URL(trimmed);
        const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        if (url.username || url.password) return null;
        return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.toString() : null;
    } catch {
        return null;
    }
}

function textField(row: Record<string, unknown>, key: string, maxLength: number): string | null {
    const value = row[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * The past jobs the contractor chose for this proposal, as they wrote them.
 * A case study is included only when it is ticked; nothing is added or
 * reworded, and one without a title is left out.
 */
export function selectCaseStudies(all: unknown[] | null | undefined, selected: unknown[] | null | undefined): ProposalCaseStudy[] {
    if (!Array.isArray(all) || !Array.isArray(selected) || selected.length === 0) return [];
    const chosen = new Set(selected.map((id) => String(id)));
    return all
        .map((entry, index) => ({ row: asRecord(entry), index }))
        .filter(({ row, index }) => chosen.has(String(index)) || (typeof row.id === "string" && chosen.has(row.id)))
        .map(({ row }) => ({
            title: textField(row, "projectName", 200) ?? "",
            project_type: textField(row, "projectType", 200),
            location: textField(row, "location", 200),
            client: textField(row, "client", 200),
            contract_value: textField(row, "contractValue", 50),
            duration: textField(row, "programmeDuration", 100),
            delivered: textField(row, "whatWeDelivered", 5000),
            value_added: textField(row, "valueAdded", 5000),
            photos: (Array.isArray(row.photos) ? row.photos : [])
                .map(safeImageUrl)
                .filter((url): url is string => url !== null)
                .slice(0, 3),
        }))
        .filter((study) => study.title !== "")
        .slice(0, 6);
}

/** Site photographs with the contractor's own captions. No caption is supplied for them. */
export function sanitisePhotos(value: unknown[] | null | undefined): ProposalPhoto[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            const row = typeof entry === "string" ? { url: entry } : asRecord(entry);
            const url = safeImageUrl(row.url);
            return url ? { url, caption: textField(row, "caption", 300) } : null;
        })
        .filter((photo): photo is ProposalPhoto => photo !== null)
        .slice(0, 12);
}

export function assertProposalPublicationIsClientSafe(value: unknown): void {
    const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (!node || typeof node !== "object") return;
        for (const [key, child] of Object.entries(node)) {
            if (FORBIDDEN_PUBLICATION_KEYS.has(key)) {
                throw new Error(`Client publication contains forbidden field: ${key}`);
            }
            visit(child);
        }
    };
    visit(value);
}

export function buildProposalPublicationSnapshot(
    input: BuildProposalPublicationInput,
    /**
     * `allowIncomplete` builds a draft preview while the price or programme
     * is still missing. It is never used to publish.
     */
    options: { allowIncomplete?: boolean } = {},
): ProposalPublicationSnapshot {
    if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) {
        throw new Error("Publication version must be a positive integer.");
    }

    // Always through the one resolver, with or without a library. With no
    // library tick saved this is exactly the older selection. A library tick
    // that cannot be honoured stops a real publication; it is never dropped.
    const chosenCaseStudies = resolveSelectedCaseStudies({
        userId: input.caseStudyLibrary?.userId ?? "",
        olderStored: input.profile.case_studies,
        libraryRows: input.caseStudyLibrary?.rows ?? [],
        selected: input.project.selected_case_study_ids,
    });
    if (!chosenCaseStudies.sendable && !options.allowIncomplete) throw new Error(CASE_STUDY_UNSENDABLE_ERROR);
    if (!Number.isInteger(input.validityDays) || input.validityDays < 1 || input.validityDays > 365) {
        throw new Error("Proposal validity must be between 1 and 365 days.");
    }
    const vatRate = input.vatRate ?? 0;
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
        throw new Error("VAT rate must be between 0 and 100.");
    }
    if (input.vatTreatment === "domestic_reverse_charge" && vatRate !== 0) {
        throw new Error("A reverse-charge proposal cannot charge VAT.");
    }
    if (input.resolvedTerms.length === 0) throw new Error("Resolved proposal terms are required.");
    if (!isProposalResponseKind(input.responseKind)) {
        throw new Error("Choose how the client responds: confirm receipt, or a non-binding intention to proceed.");
    }

    const breakdown = computeContractSum(input.estimate, input.estimate.estimate_lines);
    const contractSumExVat = roundMoney(breakdown.contractSum);
    if (contractSumExVat <= 0 && !options.allowIncomplete) {
        throw new Error("A positive canonical contract sum is required before send.");
    }
    const vatAmount = roundMoney(contractSumExVat * vatRate / 100);

    const programmeSource = resolveProgrammeSource(input.project);
    const programmePlan = computeProgrammePlan(input.project.start_date, programmeSource.phases);
    if (!programmePlan && !options.allowIncomplete) throw new Error(PROGRAMME_REQUIRED_ERROR);
    // A stage the contractor saved is never left out of what is sent.
    if (programmePlan && !options.allowIncomplete && !planCoversEveryPhase(programmePlan, programmeSource.phases)) {
        throw new Error(PROGRAMME_INCOMPLETE_ERROR);
    }

    const snapshot: ProposalPublicationSnapshot = {
        schema_version: 1,
        publication: {
            id: requiredText(input.publicationId, "Publication id", 100),
            version_number: input.versionNumber,
            sent_at: new Date(input.sentAt).toISOString(),
            expires_at: addCalendarDays(input.sentAt, input.validityDays),
            validity_days: input.validityDays,
            // Fixed: the database then permits one non-binding response and
            // refuses acceptance. What is asked for is in `response` below.
            response_mode: "acknowledgement",
        },
        project: {
            id: requiredText(input.project.id, "Project id", 100),
            name: requiredText(input.project.name, "Project name", 200),
            project_type: optionalText(input.project.project_type, 100),
            client_name: optionalText(input.project.client_name, 200),
            client_address: optionalText(input.project.client_address, 500),
            site_address: optionalText(input.project.site_address, 500),
            start_date: optionalText(input.project.start_date, 20),
        },
        contractor: {
            company_name: requiredText(input.profile.company_name ?? "The Contractor", "Company name", 200),
            logo_url: optionalText(input.profile.logo_url, 2000),
            phone: optionalText(input.profile.phone, 100),
            website: optionalText(input.profile.website, 2000),
            accreditations: optionalText(input.profile.accreditations, 5000),
            capability_statement: optionalText(input.profile.capability_statement, 20000),
            years_trading: input.profile.years_trading ?? null,
            specialisms: optionalText(input.profile.specialisms, 5000),
            insurance_details: optionalText(input.profile.insurance_details, 5000),
            pdf_theme: optionalText(input.profile.pdf_theme, 100),
            md_name: optionalText(input.profile.md_name, 200),
            md_message: optionalText(input.profile.md_message, 5000),
        },
        content: {
            introduction: optionalText(input.project.proposal_introduction, 20000),
            scope: optionalText(input.project.scope_text, 50000),
            exclusions: optionalText(input.project.exclusions_text, 20000),
            clarifications: optionalText(input.project.clarifications_text, 20000),
            closing_statement: optionalText(input.project.closing_statement, 20000),
        },
        commercial: {
            currency: "GBP",
            estimate_id: requiredText(input.estimate.id, "Estimate id", 100),
            estimate_version_name: optionalText(input.estimate.version_name, 200),
            contract_sum_ex_vat: contractSumExVat,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            contract_sum_inc_vat: roundMoney(contractSumExVat + vatAmount),
            ...(input.vatTreatment ? { vat_treatment: input.vatTreatment } : {}),
            fee_items: buildFeeItems(input.estimate, contractSumExVat),
            payment_schedule: sanitisePaymentSchedule(input.project.payment_schedule),
        },
        programme: stageListFromPlan(programmePlan),
        terms: {
            profile_version: requiredText(input.termsProfileVersion, "Terms profile version", 100),
            clauses: input.resolvedTerms.map((clause) => ({
                title: requiredText(clause.title, "Term title", 500),
                body: requiredText(clause.body, "Term body", 10000),
            })),
        },
        ...(programmePlan ? { programme_plan: programmePlan } : {}),
        response: {
            kind: input.responseKind,
            notice: responseWording(input.responseKind).notice,
        },
        case_studies: chosenCaseStudies.studies,
        photos: sanitisePhotos(input.project.site_photos),
    };

    assertProposalPublicationIsClientSafe(snapshot);
    return snapshot;
}

function canonicalise(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalise);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalise(child)]),
    );
}

export function canonicalProposalPublicationJson(snapshot: ProposalPublicationSnapshot): string {
    return JSON.stringify(canonicalise(snapshot));
}

export async function hashProposalPublication(snapshot: ProposalPublicationSnapshot): Promise<string> {
    const bytes = new TextEncoder().encode(canonicalProposalPublicationJson(snapshot));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * A fingerprint of what a proposal says: every word, figure, date and term
 * the client reads. It leaves out only the three things that must differ
 * between a draft and the version sent from it: the publication's id, the
 * moment it was sent and the moment it expires.
 *
 * The contractor's preview and pre-send PDF are built from a draft snapshot;
 * the version sent is built again on the server from what is saved. When the
 * two fingerprints are equal, what was sent is what was reviewed. The server
 * refuses to publish when they are not.
 */
export async function hashProposalContent(snapshot: ProposalPublicationSnapshot): Promise<string> {
    const { version_number, validity_days, response_mode } = snapshot.publication;
    const content = { ...snapshot, publication: { version_number, validity_days, response_mode } };
    const bytes = new TextEncoder().encode(JSON.stringify(canonicalise(content)));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A content fingerprint short enough to read and compare by eye: "3FA9-C1D2". */
export function contentCheckCode(contentHash: string): string {
    const code = contentHash.slice(0, 8).toUpperCase();
    return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function hashProposalAccessToken(token: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(token)) {
        throw new Error("Proposal access token must contain 32 random bytes encoded as hex.");
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
