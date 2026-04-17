/**
 * Proposal PDF — Scope & Site Photos section (page 4).
 *
 * Two-column layout: left = introduction + project overview table;
 * right = scope of works bullets + site photographs grid.
 */

import {
    type ProposalContext,
    PAGE_W, ML, MR, CW,
    CONTENT_BOTTOM,
    addPageHeader, renderSectionHeading, renderBodyText,
    formatGbp, formatDate,
} from "./helpers";

export function renderScopeAndPhotos(ctx: ProposalContext): void {
    const {
        doc, T, companyName, clientName, projectName, address, projectType,
        docTitle, displayTotal, totalPagesRef, project, scopeBullets,
    } = ctx;

    doc.addPage();
    totalPagesRef.n++;
    let y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);

    y = renderSectionHeading(doc, y, "Project Brief & Scope", T);

    const leftColW = CW * 0.55;
    const rightColW = CW * 0.42;
    const rightColX = ML + leftColW + CW * 0.03;
    let leftY = y;
    let rightY = y;

    // Left: Project Brief heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...T.textDark);
    doc.text("Project Brief", ML, leftY);
    leftY += 2;
    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.5);
    doc.line(ML, leftY, ML + 30, leftY);
    leftY += 8;

    // Introduction
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...T.textDark);
    doc.text("Introduction", ML, leftY);
    leftY += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...T.textDark);
    doc.text(`Dear ${clientName},`, ML, leftY);
    leftY += 7;

    if (project?.proposal_introduction) {
        leftY = renderBodyText(doc, leftY, project.proposal_introduction, T, leftColW);
    } else {
        const para1 = `Thank you for the opportunity to submit this Proposal for ${projectName} at ${address || "the project site"}. We have carefully reviewed your requirements and are pleased to present our comprehensive fee proposal for the Works described herein.`;
        const para2 = `This document sets out our Scope of Works, commercial terms, and the basis upon which we propose to undertake this project. We are committed to delivering these Works to the highest standard, on time and within budget.`;
        leftY = renderBodyText(doc, leftY, para1, T, leftColW);
        leftY += 3;
        leftY = renderBodyText(doc, leftY, para2, T, leftColW);
    }
    leftY += 8;

    // Project Overview
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...T.textDark);
    doc.text("Project Overview", ML, leftY);
    leftY += 7;

    const startDate = project?.start_date ? formatDate(new Date(project.start_date)) : "TBC";

    // P1-1 — Domestic Reverse Charge changes the "Total inc. VAT" row.
    const isReverseCharge = project?.is_vat_reverse_charge === true;
    const overviewData = [
        ["Project", projectName],
        ["Client", clientName],
        ["Site Address", address || "\u2014"],
        ["Project Type", projectType],
        ["Proposed Start", startDate],
        ...(displayTotal > 0
            ? (isReverseCharge
                ? [["Contract Sum (net)", formatGbp(displayTotal)], ["VAT", "Reverse Charge (customer accounts)"]]
                : [["Contract Sum (exc. VAT)", formatGbp(displayTotal)], ["Total inc. VAT", formatGbp(displayTotal * 1.2)]])
            : []),
    ];

    overviewData.forEach(([label, value], idx) => {
        if (idx > 0) {
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.2);
            doc.line(ML, leftY - 1, ML + leftColW, leftY - 1);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...T.textMid);
        doc.text(label, ML, leftY + 3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...T.textDark);
        const valLines = doc.splitTextToSize(value, leftColW - 40);
        doc.text(valLines[0], ML + 38, leftY + 3);
        leftY += 7;
    });

    // Right column — Scope of Works
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...T.textDark);
    doc.text("Scope of Works", rightColX, rightY);
    rightY += 2;
    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.5);
    doc.line(rightColX, rightY, rightColX + 30, rightY);
    rightY += 8;

    if (scopeBullets.length > 0) {
        scopeBullets.forEach((bullet: string) => {
            doc.setFillColor(...T.primary);
            doc.rect(rightColX, rightY - 2.5, 2.5, 2.5, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            const bulletLines = doc.splitTextToSize(bullet, rightColW - 8);
            doc.text(bulletLines, rightColX + 5, rightY);
            rightY += bulletLines.length * 5.5;
        });
    } else if (project?.scope_text) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...T.textDark);
        const scopeLines = doc.splitTextToSize(project.scope_text, rightColW);
        doc.text(scopeLines, rightColX, rightY);
        rightY += scopeLines.length * 4.8;
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...T.textMid);
        doc.text("Scope to be completed in the Proposal Editor.", rightColX, rightY);
        rightY += 8;
    }

    // Site photos in right column
    const sitePhotos: any[] = project?.site_photos || project?.photos || [];
    const hasPhotos = sitePhotos.some((p: any) => p.url || (typeof p === "string" && p));

    if (hasPhotos) {
        rightY += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.textMid);
        doc.text("SITE PHOTOGRAPHS", rightColX, rightY);
        rightY += 4;

        const photosToRender = sitePhotos.filter((p: any) => p.url || (typeof p === "string" && p)).slice(0, 4);
        const photoColW = (rightColW - 4) / 2;
        const photoH = photoColW * 0.625;

        for (let i = 0; i < photosToRender.length; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const px = rightColX + col * (photoColW + 4);
            const py = rightY + row * (photoH + 4);

            if (py + photoH > CONTENT_BOTTOM) break;

            const photo = photosToRender[i];
            const photoUrl = photo.url || photo;
            try {
                doc.addImage(photoUrl, "JPEG", px, py, photoColW, photoH);
            } catch {
                doc.setFillColor(...T.surfaceMid);
                doc.rect(px, py, photoColW, photoH, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...T.textMid);
                doc.text("Photo", px + photoColW / 2, py + photoH / 2, { align: "center" });
            }
        }
    }
}
