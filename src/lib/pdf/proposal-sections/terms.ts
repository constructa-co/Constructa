/**
 * Proposal PDF — Commercial Terms section (page 6).
 *
 * Two-column layout: left = exclusions + clarifications;
 * right = standard T&C clauses.
 */

import {
    type ProposalContext,
    PAGE_W, ML, MR, CW,
    CONTENT_BOTTOM,
    addPageHeader, renderSectionHeading,
    STANDARD_TC_CLAUSES,
} from "./helpers";

export function renderTerms(ctx: ProposalContext): number {
    const { doc, T, companyName, docTitle, totalPagesRef, project } = ctx;

    doc.addPage();
    totalPagesRef.n++;
    let y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    y = renderSectionHeading(doc, y, "Commercial Terms", T);

    const halfW = (CW - 8) / 2;
    const boxX2 = ML + halfW + 8;
    let termLeftY = y;
    let termRightY = y;

    // Left column: Exclusions + Clarifications
    const exclusionsText = project?.exclusions_text || project?.contract_exclusions || "";
    const clarificationsText = project?.clarifications_text || project?.contract_clarifications || "";
    if (exclusionsText) {
        doc.setFillColor(...T.primary);
        doc.rect(ML, termLeftY, halfW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.white);
        doc.text("EXCLUSIONS", ML + 4, termLeftY + 5.5);
        termLeftY += 12;

        const exclItems = exclusionsText.split("\n").filter((s: string) => s.trim());
        exclItems.forEach((item: string) => {
            const bulletLines = doc.splitTextToSize(`-  ${item.trim()}`, halfW - 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text(bulletLines, ML + 4, termLeftY);
            termLeftY += bulletLines.length * 4.8 + 1.5;
        });
    }

    if (clarificationsText) {
        termLeftY += 10;
        doc.setFillColor(...T.primary);
        doc.rect(ML, termLeftY, halfW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.white);
        doc.text("CLARIFICATIONS", ML + 4, termLeftY + 5.5);
        termLeftY += 12;

        const clarItems = clarificationsText.split("\n").filter((s: string) => s.trim());
        clarItems.forEach((item: string) => {
            const bulletLines = doc.splitTextToSize(`-  ${item.trim()}`, halfW - 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text(bulletLines, ML + 4, termLeftY);
            termLeftY += bulletLines.length * 4.8 + 1.5;
        });
    }

    // Right column: T&Cs
    doc.setFillColor(...T.primary);
    doc.rect(boxX2, termRightY, halfW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...T.white);
    doc.text("TERMS & CONDITIONS", boxX2 + 4, termRightY + 5.5);
    termRightY += 12;

    const tcClauses = project?.tc_overrides || STANDARD_TC_CLAUSES.map(([t, b]) => ({ title: t, body: b }));
    tcClauses.forEach((c: any, idx: number) => {
        const title = c.title || (Array.isArray(c) ? c[0] : "");
        const body = c.body || (Array.isArray(c) ? c[1] : "");

        if (idx > 0) {
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.15);
            doc.line(boxX2, termRightY - 1, boxX2 + halfW, termRightY - 1);
            termRightY += 1;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.textDark);
        doc.text(title, boxX2 + 2, termRightY);
        termRightY += 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...T.textMid);
        const bodyLines = doc.splitTextToSize(body, halfW - 4);
        doc.text(bodyLines, boxX2 + 2, termRightY);
        termRightY += bodyLines.length * 3.6 + 2;

        if (termRightY > CONTENT_BOTTOM) {
            doc.addPage();
            totalPagesRef.n++;
            const newY = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
            termRightY = newY;
            termLeftY = newY;
        }
    });

    return Math.max(termLeftY, termRightY) + 6;
}
