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
import { extractScopeBulletsAction } from "@/app/dashboard/projects/proposal/actions";

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
    const today = new Date();
    const validUntil = new Date(Date.now() + validityDays * 86400000);
    const refCode = (project?.id || "00000000").substring(0, 8).toUpperCase();
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

    // Extract scope bullets via AI if scope text is substantial
    let scopeBullets: string[] = [];
    if (project?.scope_text && project.scope_text.length > 100) {
        try {
            scopeBullets = await extractScopeBulletsAction(project.scope_text);
        } catch {
            scopeBullets = [];
        }
    }

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
