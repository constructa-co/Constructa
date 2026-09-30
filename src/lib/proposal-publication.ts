import { computeContractSum, roundMoney, toNumber } from "@/lib/financial";

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
    responseMode: ProposalResponseMode;
    vatRate?: number;
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
}

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

function sanitiseProgramme(value: unknown[] | null | undefined): ProposalPublicationSnapshot["programme"] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 200).map((entry, index) => {
        const phase = asRecord(entry);
        const manualDays = phase.manualDays == null ? null : toNumber(phase.manualDays as number | string | null);
        const calculatedDays = toNumber(phase.calculatedDays as number | string | null);
        const legacyDays = toNumber(phase.duration_days as number | string | null);
        const durationDays = (manualDays ?? calculatedDays) || legacyDays || 1;
        return {
            id: optionalText(typeof phase.id === "string" ? phase.id : null, 100),
            name: requiredText(typeof phase.name === "string" ? phase.name : `Phase ${index + 1}`, "Programme phase", 200),
            duration_days: Math.max(1, Math.min(3650, durationDays)),
            duration_unit: optionalText(typeof phase.duration_unit === "string" ? phase.duration_unit : null, 50) ?? "Days",
            start_offset_days: Math.max(0, Math.min(36500, toNumber(phase.startOffset as number | string | null))),
            start_date: optionalText(typeof phase.start_date === "string" ? phase.start_date : null, 20),
        };
    });
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
): ProposalPublicationSnapshot {
    if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) {
        throw new Error("Publication version must be a positive integer.");
    }
    if (!Number.isInteger(input.validityDays) || input.validityDays < 1 || input.validityDays > 365) {
        throw new Error("Proposal validity must be between 1 and 365 days.");
    }
    const vatRate = input.vatRate ?? 0;
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
        throw new Error("VAT rate must be between 0 and 100.");
    }
    if (input.resolvedTerms.length === 0) throw new Error("Resolved proposal terms are required.");

    const breakdown = computeContractSum(input.estimate, input.estimate.estimate_lines);
    const contractSumExVat = roundMoney(breakdown.contractSum);
    if (contractSumExVat <= 0) throw new Error("A positive canonical contract sum is required before send.");
    const vatAmount = roundMoney(contractSumExVat * vatRate / 100);

    const snapshot: ProposalPublicationSnapshot = {
        schema_version: 1,
        publication: {
            id: requiredText(input.publicationId, "Publication id", 100),
            version_number: input.versionNumber,
            sent_at: new Date(input.sentAt).toISOString(),
            expires_at: addCalendarDays(input.sentAt, input.validityDays),
            validity_days: input.validityDays,
            response_mode: input.responseMode,
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
            fee_items: buildFeeItems(input.estimate, contractSumExVat),
            payment_schedule: sanitisePaymentSchedule(input.project.payment_schedule),
        },
        programme: sanitiseProgramme(
            (Array.isArray(input.project.programme_phases) && input.project.programme_phases.length > 0)
                ? input.project.programme_phases
                : input.project.gantt_phases,
        ),
        terms: {
            profile_version: requiredText(input.termsProfileVersion, "Terms profile version", 100),
            clauses: input.resolvedTerms.map((clause) => ({
                title: requiredText(clause.title, "Term title", 500),
                body: requiredText(clause.body, "Term body", 10000),
            })),
        },
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

export async function hashProposalAccessToken(token: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(token)) {
        throw new Error("Proposal access token must contain 32 random bytes encoded as hex.");
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
