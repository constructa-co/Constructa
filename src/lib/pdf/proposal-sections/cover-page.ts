/**
 * Proposal PDF — Cover Page (page 1).
 *
 * Full-bleed primary-coloured page with logo, project title, client
 * details, and a bottom stat strip (date, validity, reference, value).
 */

import {
    type ProposalContext,
    PAGE_W, PAGE_H, ML, MR, CW,
    formatGbp, formatDate,
} from "./helpers";

export function renderCoverPage(ctx: ProposalContext): void {
    const { doc, T, companyName, clientName, projectName, clientAddress, displayTotal, refCode, today, validUntil, profile, project } = ctx;

    doc.setFillColor(...T.primary);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    let y = 15;

    // Company logo or name (centered, white pill box)
    let logoLoaded = false;
    if (profile?.logo_url) {
        try {
            doc.setFillColor(...T.white);
            doc.roundedRect(PAGE_W / 2 - 37, y, 74, 27, 3, 3, "F");
            const logoExt = profile.logo_url.split(".").pop()?.toLowerCase() || "png";
            const logoFormat = logoExt === "jpg" || logoExt === "jpeg" ? "JPEG" : "PNG";
            doc.addImage(profile.logo_url, logoFormat, PAGE_W / 2 - 34, y + 1, 68, 25);
            logoLoaded = true;
            y += 35;
        } catch {
            logoLoaded = false;
        }
    }
    if (!logoLoaded) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.setTextColor(...T.white);
        doc.text(companyName.toUpperCase(), PAGE_W / 2, y + 12, { align: "center" });
        y += 22;
    }

    // Thin accent rule
    doc.setDrawColor(...T.accent);
    doc.setLineWidth(0.5);
    doc.line(ML + 20, y, MR - 20, y);
    y += 8;

    // "PROPOSAL & FEE PROPOSAL" label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...T.muted);
    doc.text("PROPOSAL & FEE PROPOSAL", PAGE_W / 2, y, { align: "center" });
    y += 6;

    // Center: project name
    y = 110;
    doc.setFont("helvetica", "bold");
    const titleSegments = projectName
        .split(/\s*[\u2014\u2013]\s*/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    let titleFontSize = 42;
    let titleLines: string[] = [];
    for (; titleFontSize >= 24; titleFontSize -= 2) {
        doc.setFontSize(titleFontSize);
        titleLines = titleSegments.flatMap((seg: string) => doc.splitTextToSize(seg, CW - 20) as string[]);
        const widest = Math.max(...titleLines.map((l: string) => doc.getTextWidth(l)));
        if (widest <= CW - 20) break;
    }
    const titleLineH = Math.round(titleFontSize * 0.34);
    doc.setTextColor(...T.white);
    titleLines.forEach((line: string, i: number) => {
        doc.text(line, PAGE_W / 2, y + i * titleLineH, { align: "center" });
    });
    y += titleLines.length * titleLineH + 10;

    // "Prepared exclusively for"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...T.muted);
    doc.text("Prepared exclusively for", PAGE_W / 2, y, { align: "center" });
    y += 8;

    // Client name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...T.white);
    doc.text(clientName, PAGE_W / 2, y, { align: "center" });
    y += 8;

    // Client address
    if (clientAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...T.muted);
        const addrLines = doc.splitTextToSize(clientAddress, 120);
        addrLines.forEach((line: string, i: number) => {
            doc.text(line, PAGE_W / 2, y + i * 5.5, { align: "center" });
        });
        y += addrLines.length * 5.5 + 4;
    }

    // Bottom info strip
    const infoY = 225;
    doc.setDrawColor(...T.accent);
    doc.setLineWidth(0.3);
    doc.line(ML, infoY, MR, infoY);

    // P1-1 — if the project is flagged for Domestic Reverse Charge, the
    // "inc. VAT" label is inaccurate — no VAT is charged. Show the
    // net sum with a "VAT REVERSE CHARGE" label instead.
    const isReverseCharge = project?.is_vat_reverse_charge === true;
    const statCols = [
        { label: "DATE ISSUED", value: formatDate(today) },
        { label: "VALID UNTIL", value: formatDate(validUntil) },
        { label: "REFERENCE", value: refCode },
        ...(displayTotal > 0
            ? [{
                label: isReverseCharge ? "CONTRACT VALUE (VAT REVERSE-CHARGED)" : "CONTRACT VALUE (inc. VAT)",
                value: isReverseCharge ? formatGbp(displayTotal) : formatGbp(displayTotal * 1.2),
            }]
            : []),
    ];
    const colW = CW / statCols.length;
    statCols.forEach((stat, i) => {
        const sx = ML + i * colW;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...T.muted);
        doc.text(stat.label, sx, infoY + 7);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...T.accent);
        doc.text(stat.value, sx, infoY + 13);
    });

    // Very bottom
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...T.accent);
    doc.text(companyName, ML, 284);
    if (profile?.website) {
        doc.text(profile.website, MR, 284, { align: "right" });
    } else {
        doc.text("Confidential", MR, 284, { align: "right" });
    }
}
