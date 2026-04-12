/**
 * Proposal PDF — About Us section (page 2).
 *
 * Two-column layout: left = capability statement + specialisms + years;
 * right = contact info box + accreditations. Optional MD message block
 * below. If space remains and no MD message, a 2×2 "Our Commitment"
 * value-prop grid fills the whitespace.
 */

import {
    type ProposalContext,
    PAGE_W, PAGE_H, ML, MR, CW,
    CONTENT_BOTTOM,
    addPageHeader, renderSectionHeading, renderBodyText, ensureSpace,
    splitAddress, sanitiseText,
} from "./helpers";

export function renderAboutUs(ctx: ProposalContext): number {
    const { doc, T, companyName, docTitle, totalPagesRef, profile, project } = ctx;
    const capabilityText = project?.proposal_capability || profile?.capability_statement || "";

    if (!capabilityText) return 0; // nothing to render

    doc.addPage();
    totalPagesRef.n++;
    let y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...T.textDark);
    doc.text(`About ${companyName}`, ML, y + 8);
    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.3);
    doc.line(ML, y + 12, ML + 40, y + 12);
    y += 22;

    const leftW = CW * 0.55;
    const rightW = CW * 0.43;
    const rightX = ML + leftW + CW * 0.02;
    let leftY = y;
    let rightY = y;

    // Left column — capability statement
    const capText = sanitiseText(capabilityText);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...T.textDark);
    const capLines = doc.splitTextToSize(capText, leftW);
    doc.text(capLines, ML, leftY);
    leftY += capLines.length * 5.5 + 8;

    // Specialisms as pill badges
    if (profile.specialisms) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...T.textDark);
        doc.text("Specialisms", ML, leftY);
        leftY += 7;

        const specs = sanitiseText(profile.specialisms).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
        let badgeX = ML;
        specs.forEach((spec: string) => {
            const badgeW = doc.getTextWidth(spec) + 8;
            if (badgeX + badgeW > ML + leftW) {
                badgeX = ML;
                leftY += 9;
            }
            doc.setFillColor(...T.primaryLight);
            doc.roundedRect(badgeX, leftY - 4.5, badgeW, 7, 1.5, 1.5, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...T.accent);
            doc.text(spec, badgeX + 4, leftY);
            badgeX += badgeW + 3;
        });
        leftY += 14;
    }

    // Years trading badge
    if (profile.years_trading) {
        const badge = `Est. ${profile.years_trading} years trading`;
        const badgeW = doc.getTextWidth(badge) + 8;
        doc.setFillColor(...T.surfaceMid);
        doc.roundedRect(ML, leftY, badgeW, 8, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.textDark);
        doc.text(badge, ML + 4, leftY + 5.5);
        leftY += 14;
    }

    // Right column — Contact info box
    const contactRows: string[][] = [];
    if (profile.phone) contactRows.push(["Phone", profile.phone]);
    if (profile.website) contactRows.push(["Website", profile.website]);
    if (profile.address) contactRows.push(["Address", profile.address]);
    if (profile.company_number) contactRows.push(["Company Reg.", profile.company_number]);
    if (profile.vat_number) contactRows.push(["VAT Number", profile.vat_number]);

    if (contactRows.length > 0) {
        const rowHeights = contactRows.map(([label, val]) => {
            if (label === "Address") {
                const addrLines = splitAddress(val);
                return 9 + Math.max(0, (addrLines.length - 1) * 4);
            }
            const valLines = doc.splitTextToSize(val, rightW - 30);
            return 9 + Math.max(0, (valLines.length - 1) * 4);
        });
        const totalBoxH = rowHeights.reduce((s, h) => s + h, 0) + 8;
        doc.setFillColor(...T.white);
        doc.roundedRect(rightX, rightY, rightW, totalBoxH, 3, 3, "F");
        doc.setDrawColor(...T.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(rightX, rightY, rightW, totalBoxH, 3, 3, "S");
        rightY += 7;
        contactRows.forEach(([label, val]) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...T.textMid);
            doc.text(label, rightX + 4, rightY + 4);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.textDark);
            if (label === "Address") {
                const addrLines = splitAddress(val);
                addrLines.forEach((line: string, i: number) => {
                    doc.text(line, rightX + 28, rightY + 4 + i * 4);
                });
                rightY += 9 + Math.max(0, (addrLines.length - 1) * 4);
            } else {
                const valLines = doc.splitTextToSize(val, rightW - 30);
                valLines.forEach((vl: string, vi: number) => {
                    doc.text(vl, rightX + 28, rightY + 4 + vi * 4);
                });
                rightY += 9 + Math.max(0, (valLines.length - 1) * 4);
            }
        });
        rightY += 6;
    }

    // Accreditations box
    if (profile.accreditations) {
        rightY += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...T.textDark);
        doc.text("Accreditations", rightX, rightY);
        rightY += 6;

        const accreds = sanitiseText(profile.accreditations).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
        accreds.forEach((acc: string) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...T.textDark);
            doc.text(`-  ${acc}`, rightX, rightY);
            rightY += 6;
        });
    }

    // MD Message (inline in about-us page)
    if (profile.md_message) {
        const mdY = Math.max(leftY, rightY) + 4;
        y = ensureSpace(doc, mdY, 30, companyName, docTitle, totalPagesRef, T);
        doc.setFillColor(...T.surface);
        const mdText = sanitiseText(profile.md_message);
        const mdLines = doc.splitTextToSize(mdText, CW - 20);
        const mdBoxH = mdLines.length * 5 + 18;
        doc.roundedRect(ML, y, CW, mdBoxH, 3, 3, "F");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(...T.textDark);
        doc.text(mdLines, ML + 10, y + 8);
        if (profile.md_name) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.textMid);
            doc.text(`— ${profile.md_name}, Managing Director`, ML + 10, y + mdBoxH - 5);
        }
        y = y + mdBoxH + 8;
    } else {
        y = Math.max(leftY, rightY) + 8;
    }

    // Fill whitespace with stat boxes if space available
    if (y < 175 && y > 60) {
        y += 15;
        const stats = [
            { label: "YEARS EXPERIENCE", value: profile?.years_trading ? `${profile.years_trading}+` : "10+" },
            { label: "PROJECTS DELIVERED", value: "50+" },
            { label: "QUALITY ASSURED", value: "Yes" },
        ];
        const boxW = (MR - ML - 10) / 3;
        stats.forEach((stat, i) => {
            const bx = ML + i * (boxW + 5);
            doc.setFillColor(...T.primary);
            doc.roundedRect(bx, y, boxW, 20, 2, 2, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(...T.accent);
            doc.text(stat.value, bx + boxW / 2, y + 12, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...T.muted);
            doc.text(stat.label, bx + boxW / 2, y + 17, { align: "center" });
        });
        y += 28;
    }

    // Our Commitment filler if no MD message and space remains
    if (!profile.md_message && y < CONTENT_BOTTOM - 70) {
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...T.primary);
        doc.text("OUR COMMITMENT TO YOU", ML, y);
        doc.setDrawColor(...T.primary);
        doc.setLineWidth(0.5);
        doc.line(ML, y + 1.5, ML + 50, y + 1.5);
        y += 10;

        const commitments = [
            { title: "Transparent Pricing", body: "Every line item justified, no hidden costs, and margins explained on request." },
            { title: "Clear Communication", body: "A single point of contact, weekly written updates, and prompt response to queries." },
            { title: "Programme Certainty", body: "Detailed resource-loaded programme with early warning of any changes to your finish date." },
            { title: "Quality Without Compromise", body: "Fully insured, accredited trades, and snag-free handover with comprehensive O&M package." },
        ];
        const ccGap = 5;
        const ccW = (CW - ccGap) / 2;
        const ccH = 28;
        commitments.forEach((c, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = ML + col * (ccW + ccGap);
            const cy = y + row * (ccH + ccGap);
            doc.setFillColor(...T.surface);
            doc.roundedRect(cx, cy, ccW, ccH, 2, 2, "F");
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.3);
            doc.roundedRect(cx, cy, ccW, ccH, 2, 2, "S");
            doc.setFillColor(...T.primary);
            doc.rect(cx, cy, 1.8, ccH, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...T.textDark);
            doc.text(c.title, cx + 6, cy + 8);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.textMid);
            const bodyLines = doc.splitTextToSize(c.body, ccW - 10);
            doc.text(bodyLines, cx + 6, cy + 14);
        });
        y += ccH * 2 + ccGap + 4;
    }

    // MD / Director Message section heading (if it wasn't rendered inline above)
    if (profile?.md_message) {
        if (y > PAGE_H - 80) {
            doc.addPage();
            totalPagesRef.n++;
            y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
        }
        y = renderSectionHeading(doc, y, "A Message from Our Director", T);

        doc.setFillColor(...T.surface);
        const msgLines = doc.splitTextToSize(sanitiseText(profile.md_message), CW - 16);
        const msgH = msgLines.length * 5 + 16;
        doc.roundedRect(ML, y, CW, msgH, 3, 3, "F");
        doc.setDrawColor(...T.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, y, CW, msgH, 3, 3, "S");

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(...T.textDark);
        doc.text(msgLines, ML + 8, y + 10);

        if (profile.md_name) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text(`— ${profile.md_name}`, ML + 8, y + msgH - 4);
        }
        y += msgH + 10;
    }

    return y;
}
