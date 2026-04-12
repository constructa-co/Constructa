/**
 * Proposal PDF — Risks & Opportunities section.
 *
 * Two-column layout: left = risks with mitigations;
 * right = opportunities with actions.
 */

import {
    type ProposalContext,
    ML, MR, CW,
    renderSectionHeading, ensureSpace, sanitiseText,
} from "./helpers";

export function renderRisks(ctx: ProposalContext, startY: number): number {
    const { doc, T, companyName, docTitle, totalPagesRef, project } = ctx;
    let y = startY;

    const riskRegister: any[] = project?.risk_register || [];
    const risks = riskRegister.filter((r: any) => r.type === "risk" && r.description);
    const opportunities = riskRegister.filter((r: any) => r.type === "opportunity" && r.description);

    if (risks.length === 0 && opportunities.length === 0) return y;

    const riskNeeded = 20 + Math.max(risks.length, opportunities.length) * 14 + 10;
    y = ensureSpace(doc, y, riskNeeded, companyName, docTitle, totalPagesRef, T);
    y += 6;

    y = renderSectionHeading(doc, y, "Risks & Opportunities", T);

    const riskHalfW = (CW - 8) / 2;
    const riskRightX = ML + riskHalfW + 8;
    let riskLeftY = y;
    let riskRightY = y;

    // Left column: Risks
    if (risks.length > 0) {
        doc.setFillColor(...T.primary);
        doc.rect(ML, riskLeftY, riskHalfW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.white);
        doc.text("RISKS", ML + 4, riskLeftY + 5.5);
        riskLeftY += 12;

        risks.forEach((r: any) => {
            riskLeftY = ensureSpace(doc, riskLeftY, 14, companyName, docTitle, totalPagesRef, T);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...T.textDark);
            const rDesc = doc.splitTextToSize(`-  ${sanitiseText(r.description)}`, riskHalfW - 6);
            doc.text(rDesc, ML + 4, riskLeftY);
            riskLeftY += rDesc.length * 4 + 1;
            if (r.mitigation) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                doc.setTextColor(...T.textMid);
                const mLines = doc.splitTextToSize(`Mitigation: ${sanitiseText(r.mitigation)}`, riskHalfW - 10);
                doc.text(mLines, ML + 8, riskLeftY);
                riskLeftY += mLines.length * 3.5 + 2;
            }
        });
    }

    // Right column: Opportunities
    if (opportunities.length > 0) {
        doc.setFillColor(...T.primary);
        doc.rect(riskRightX, riskRightY, riskHalfW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.white);
        doc.text("OPPORTUNITIES", riskRightX + 4, riskRightY + 5.5);
        riskRightY += 12;

        opportunities.forEach((o: any) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...T.textDark);
            const oDesc = doc.splitTextToSize(`-  ${sanitiseText(o.description)}`, riskHalfW - 6);
            doc.text(oDesc, riskRightX + 4, riskRightY);
            riskRightY += oDesc.length * 4 + 1;
            if (o.mitigation) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                doc.setTextColor(...T.textMid);
                const mLines = doc.splitTextToSize(`Action: ${sanitiseText(o.mitigation)}`, riskHalfW - 10);
                doc.text(mLines, riskRightX + 8, riskRightY);
                riskRightY += mLines.length * 3.5 + 2;
            }
        });
    }

    return Math.max(riskLeftY, riskRightY) + 6;
}
