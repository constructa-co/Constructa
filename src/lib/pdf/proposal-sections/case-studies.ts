/**
 * Proposal PDF — Case Studies section (one page per case study).
 *
 * Full-bleed top band with title/stats, then photos in a grid,
 * then two-column narrative (what we delivered / value added).
 */

import {
    type ProposalContext,
    PAGE_W, PAGE_H, ML, MR, CW,
    sanitiseText,
} from "./helpers";

export function renderCaseStudies(ctx: ProposalContext): void {
    const { doc, T, companyName, docTitle, totalPagesRef, profile, project } = ctx;

    const selectedIds: (number | string)[] = project?.selected_case_study_ids || [];
    const allCaseStudies = profile?.case_studies || [];
    const caseStudies = selectedIds.length > 0
        ? allCaseStudies.filter((_cs: any, i: number) => selectedIds.includes(i))
        : allCaseStudies;

    if (caseStudies.length === 0) return;

    for (let ci = 0; ci < caseStudies.length; ci++) {
        const cs = caseStudies[ci];
        if (!cs.projectName) continue;

        doc.addPage();
        totalPagesRef.n++;

        // Top band
        const bandH = PAGE_H * 0.36;
        doc.setFillColor(...T.primary);
        doc.rect(0, 0, PAGE_W, bandH, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.muted);
        doc.text(`OUR WORK  \u2014  ${String(ci + 1).padStart(2, "0")} / ${String(caseStudies.filter((c: any) => c.projectName).length).padStart(2, "0")}`, ML, 10);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.muted);
        doc.text(companyName.toUpperCase(), MR, 10, { align: "right" });

        const csTitleY = bandH * 0.42;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.setTextColor(...T.white);
        const csTitleLines = doc.splitTextToSize(cs.projectName, CW);
        doc.text(csTitleLines, ML, csTitleY);

        const subParts = [cs.location, cs.client].filter(Boolean);
        if (subParts.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...T.muted);
            doc.text(subParts.join("  |  "), ML, csTitleY + csTitleLines.length * 10 + 4);
        }

        // Stat pills
        const statItems = [
            cs.projectType && { label: "TYPE", value: cs.projectType },
            cs.contractValue && { label: "VALUE", value: `\u00A3${Number(cs.contractValue).toLocaleString("en-GB")}` },
            cs.programmeDuration && { label: "PROGRAMME", value: cs.programmeDuration },
            cs.client && { label: "CLIENT", value: cs.client },
        ].filter(Boolean) as { label: string; value: string }[];

        const pillY = bandH - 19;
        const pillH = 15;
        const pillGap = 4;
        let pillX = ML;
        statItems.forEach(stat => {
            const valW = doc.getTextWidth(stat.value);
            const lblW = doc.getTextWidth(stat.label);
            const pW = Math.max(valW, lblW) + 10;
            doc.setFillColor(...T.primaryMid);
            doc.roundedRect(pillX, pillY, pW, pillH, 2, 2, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...T.muted);
            doc.text(stat.label, pillX + 5, pillY + 5);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...T.accent);
            doc.text(stat.value, pillX + 5, pillY + 12);
            pillX += pW + pillGap;
        });

        // White content area
        let cy = bandH + 14;

        // Photos
        const photos = (cs.photos || []).filter((p: string) => p);
        if (photos.length > 0) {
            const numPhotos = Math.min(photos.length, 3);
            const photoGap = 4;
            const totalGap = photoGap * (numPhotos - 1);
            const photoW = (CW - totalGap) / numPhotos;
            const photoH = photoW * 0.62;
            let px = ML;

            for (let pi = 0; pi < numPhotos; pi++) {
                const photoUrl = photos[pi];
                try {
                    const imgExt = photoUrl.split(".").pop()?.toLowerCase() || "jpg";
                    const imgFmt = imgExt === "png" ? "PNG" : "JPEG";
                    doc.addImage(photoUrl, imgFmt, px, cy, photoW, photoH);
                } catch {
                    doc.setFillColor(...T.surfaceMid);
                    doc.rect(px, cy, photoW, photoH, "F");
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7);
                    doc.setTextColor(...T.muted);
                    doc.text("Photo", px + photoW / 2, cy + photoH / 2, { align: "center" });
                }
                px += photoW + photoGap;
            }
            cy += photoH + 10;
        }

        // Two-column narrative
        const csColGap = 8;
        const csColW = (CW - csColGap) / 2;
        const csCol2X = ML + csColW + csColGap;
        let col1Y = cy;
        let col2Y = cy;

        if (cs.whatWeDelivered) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...T.primary);
            doc.text("WHAT WE DELIVERED", ML, col1Y);
            col1Y += 1.5;
            doc.setDrawColor(...T.primary);
            doc.setLineWidth(0.5);
            doc.line(ML, col1Y, ML + 30, col1Y);
            col1Y += 5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(...T.textDark);
            const wdLines = doc.splitTextToSize(cs.whatWeDelivered, csColW);
            doc.text(wdLines, ML, col1Y);
            col1Y += wdLines.length * 5 + 6;
        }

        if (cs.valueAdded) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...T.primary);
            doc.text("VALUE ADDED", csCol2X, col2Y);
            col2Y += 1.5;
            doc.setDrawColor(...T.primary);
            doc.setLineWidth(0.5);
            doc.line(csCol2X, col2Y, csCol2X + 30, col2Y);
            col2Y += 5;

            const vaLines = doc.splitTextToSize(cs.valueAdded, csColW - 8);
            const vaBoxH = vaLines.length * 5 + 10;
            doc.setFillColor(...T.surface);
            doc.rect(csCol2X, col2Y, csColW, vaBoxH, "F");
            doc.setFillColor(...T.primaryMid);
            doc.rect(csCol2X, col2Y, 2.5, vaBoxH, "F");

            doc.setFont("helvetica", "italic");
            doc.setFontSize(9.5);
            doc.setTextColor(...T.textMid);
            doc.text(vaLines, csCol2X + 6, col2Y + 6);
            col2Y += vaBoxH + 6;
        }

        // Footer bar
        doc.setFillColor(...T.primary);
        doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...T.accent);
        doc.text(companyName, ML, PAGE_H - 3.5);
        doc.text(docTitle, PAGE_W / 2, PAGE_H - 3.5, { align: "center" });
        doc.text(String(totalPagesRef.n), MR, PAGE_H - 3.5, { align: "right" });
    }
}
