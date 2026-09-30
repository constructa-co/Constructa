/**
 * Constructa — Proposal PDF orchestrator.
 *
 * Assembles the full proposal document by calling each section builder
 * in sequence. Replaces the monolithic 1,922-line buildProposalPDF
 * function that previously lived inside proposal-pdf-button.tsx.
 *
 * All theme and money formatting is now delegated to the canonical
 * shared modules (`pdf-theme.ts`, `pdf-money.ts`), so drift between
 * the proposal PDF and other generators is structurally prevented.
 */

import jsPDF from "jspdf";
import { getPdfTheme } from "@/lib/pdf/pdf-theme";
import { computeContractSum as canonicalComputeContractSum } from "@/lib/financial";
import type { ProposalPublicationSnapshot } from "@/lib/proposal-publication";

import {
    type ProposalContext,
    resetSectionCounter,
    normaliseAddress,
    formatDate,
} from "./proposal-sections/helpers";

import { renderCoverPage } from "./proposal-sections/cover-page";
import { renderAboutUs } from "./proposal-sections/about-us";
import { renderCaseStudies } from "./proposal-sections/case-studies";
import { renderScopeAndPhotos } from "./proposal-sections/scope-and-photos";
import { renderFeeProposal } from "./proposal-sections/fee-proposal";
import { renderTerms } from "./proposal-sections/terms";
import { renderRisks } from "./proposal-sections/risks";
import { renderClosing } from "./proposal-sections/closing";

// ── Props interface ────────────────────────────────────────────────────────

export interface BuildProposalPDFProps {
    estimates: any[];
    project: any;
    profile: any;
    pricingMode: "full" | "summary";
    validityDays: number;
}

export function scopeTextToBullets(scopeText: string): string[] {
    const lines = scopeText
        .split(/\n+/)
        .map((line) => line.replace(/^\s*[-*\u2022]\s*/, "").trim())
        .filter(Boolean);
    const source = lines.length > 1
        ? lines
        : scopeText.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    return source.slice(0, 12);
}

export function proposalSnapshotToPdfProps(
    snapshot: ProposalPublicationSnapshot,
    snapshotHash?: string,
): BuildProposalPDFProps {
    const estimate = {
        id: snapshot.commercial.estimate_id,
        version_name: snapshot.commercial.estimate_version_name,
        is_active: true,
        total_cost: snapshot.commercial.contract_sum_ex_vat,
        prelims_pct: 0,
        overhead_pct: 0,
        risk_pct: 0,
        profit_pct: 0,
        discount_pct: 0,
        estimate_lines: snapshot.commercial.fee_items.map((item) => ({
            id: item.id,
            trade_section: item.trade_section,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_rate: item.quantity > 0 ? item.amount_ex_vat / item.quantity : item.amount_ex_vat,
            line_total: item.amount_ex_vat,
        })),
    };
    const project = {
        ...snapshot.project,
        proposal_introduction: snapshot.content.introduction,
        scope_text: snapshot.content.scope,
        exclusions_text: snapshot.content.exclusions,
        clarifications_text: snapshot.content.clarifications,
        closing_statement: snapshot.content.closing_statement,
        potential_value: snapshot.commercial.contract_sum_ex_vat,
        payment_schedule: snapshot.commercial.payment_schedule,
        payment_schedule_type: snapshot.commercial.payment_schedule.some((row) => row.amount != null)
            ? "milestone"
            : "percentage",
        gantt_phases: snapshot.programme,
        tc_overrides: snapshot.terms.clauses.map((clause, index) => ({
            clause_number: index + 1,
            ...clause,
        })),
        proposal_sent_at: snapshot.publication.sent_at,
        proposal_version_number: snapshot.publication.version_number,
        proposal_snapshot_hash: snapshotHash ?? null,
        response_mode: snapshot.publication.response_mode,
        vat_rate: snapshot.commercial.vat_rate,
        is_vat_reverse_charge: snapshot.commercial.vat_rate === 0,
    };
    return {
        estimates: [estimate],
        project,
        profile: snapshot.contractor,
        pricingMode: "full",
        validityDays: snapshot.publication.validity_days,
    };
}

export async function buildPublishedProposalPDF(
    snapshot: ProposalPublicationSnapshot,
    snapshotHash?: string,
): Promise<void> {
    return buildProposalPDF(proposalSnapshotToPdfProps(snapshot, snapshotHash));
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function buildProposalPDF({ estimates, project, profile, pricingMode, validityDays }: BuildProposalPDFProps): Promise<void> {
    resetSectionCounter();

    const T = getPdfTheme(profile?.pdf_theme);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const companyName = project?.proposal_company_name || profile?.company_name || "The Contractor";
    const clientName = project?.client_name || "Valued Client";
    const projectName = project?.name || "Project Proposal";
    const address = normaliseAddress(project?.site_address || project?.client_address || "");
    const clientAddress = normaliseAddress(project?.client_address || project?.site_address || "");
    const projectType = project?.project_type || "Construction Works";
    const today = project?.proposal_sent_at ? new Date(project.proposal_sent_at) : new Date();
    const validUntil = new Date(today.getTime() + validityDays * 86400000);
    const refCode = `${(project?.id || "00000000").substring(0, 8).toUpperCase()}${
        project?.proposal_version_number ? `-V${project.proposal_version_number}` : ""
    }`;
    const docTitle = `Proposal \u2014 ${projectName}`;
    const totalPagesRef = { n: 1 };

    // Use active estimate if one is marked, otherwise use all estimates
    const activeEstimate = estimates.find((est: any) => est.is_active);
    const pdfEstimates = activeEstimate ? [activeEstimate] : estimates;

    // Thin wrapper delegating to canonical computeContractSum
    const computeContractSum = (est: any) => {
        return canonicalComputeContractSum(est ?? {}, est?.estimate_lines || []);
    };

    const grandTotal = pdfEstimates.reduce((sum: number, est: any) => {
        return sum + computeContractSum(est).contractSum;
    }, 0);

    const displayTotal = grandTotal > 0 ? grandTotal : (project?.potential_value || project?.contract_value || 0);
    const contractValue = project?.potential_value || grandTotal || 0;

    // PDF generation must be deterministic: drafting-time AI may populate the
    // saved scope, but rendering never calls a model or changes wording.
    const scopeBullets = project?.scope_text ? scopeTextToBullets(project.scope_text) : [];

    // Build shared context
    const ctx: ProposalContext = {
        doc, T, companyName, clientName, projectName, address, clientAddress,
        projectType, docTitle, refCode, today, validUntil, validityDays,
        pricingMode, displayTotal, contractValue, totalPagesRef, profile,
        project, pdfEstimates, computeContractSum, scopeBullets,
    };

    // ── Render sections in order ───────────────────────────────────────────

    // 1. Cover page (page 1)
    renderCoverPage(ctx);

    // 2. About Us (page 2 — conditional on capability text)
    renderAboutUs(ctx);

    // 3. Case studies (one page per study)
    renderCaseStudies(ctx);

    // 4. Scope & site photos (two-column)
    renderScopeAndPhotos(ctx);

    // 5. Fee proposal + timeline
    let y = renderFeeProposal(ctx);

    // 6. Commercial terms (exclusions, clarifications, T&Cs)
    y = renderTerms(ctx);

    // 7. Risks & opportunities
    y = renderRisks(ctx, y);

    // 8. Why choose us + acceptance/signatures
    renderClosing(ctx);

    // ── Save ────────────────────────────────────────────────────────────────
    const filename = `${projectName.replace(/[^a-z0-9]/gi, "_")}_Proposal_${refCode}.pdf`;
    doc.save(filename);
}
