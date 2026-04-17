/**
 * Proposal PDF — Why Choose Us / Closing Statement + Acceptance page.
 *
 * Combines the "Why Choose" section and the signature/acceptance page.
 */

import {
    type ProposalContext,
    PAGE_W, ML, MR, CW,
    addPageHeader, renderSectionHeading, ensureSpace,
    formatGbp, formatDate, sanitiseText,
} from "./helpers";

export function renderClosing(ctx: ProposalContext): void {
    const {
        doc, T, companyName, clientName, projectName, docTitle, refCode,
        displayTotal, totalPagesRef, project, profile, today, validUntil,
    } = ctx;

    // ── Why Choose Us page ─────────────────────────────────────────────────
    const closingText = project?.closing_statement ||
        `Thank you for considering ${companyName} for this project. We are confident our expertise and commitment to quality make us the right choice. We look forward to delivering an outstanding result for you.`;
    {
        doc.addPage();
        totalPagesRef.n++;
        let y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
        y = renderSectionHeading(doc, y, `Why Choose ${companyName}`, T);

        if (profile?.closing_statement) {
            const profileClosingText = sanitiseText(profile.closing_statement);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(...T.textDark);
            const profileClosingLines = doc.splitTextToSize(profileClosingText, CW - 10);
            doc.text(profileClosingLines, ML + 5, y);
            y += profileClosingLines.length * 6 + 12;
        }

        // Key reasons box
        const reasons: string[] = [];
        if (profile?.years_trading) reasons.push(`${profile.years_trading}+ years of experience in the construction industry`);
        if (profile?.accreditations) {
            const accreds = String(profile.accreditations).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            accreds.forEach((a: string) => reasons.push(`Accredited: ${a}`));
        }
        if (profile?.insurance_details) reasons.push("Fully insured — Public Liability, Employer's Liability & Contractors All Risk");
        if (profile?.specialisms) {
            const specs = String(profile.specialisms).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            if (specs.length === 1) {
                reasons.push(`Specialists in ${specs[0]}`);
            } else if (specs.length > 1) {
                reasons.push(`Specialists in: ${specs.join(", ")}`);
            }
        }
        if (project?.project_type) reasons.push(`Experienced in ${project.project_type} projects`);
        if (reasons.length < 3) {
            reasons.push("Dedicated project management from inception to completion");
            reasons.push("Clear communication and transparent pricing — no hidden costs");
            reasons.push("All works warranted and backed by our Defect Liability Period");
        }

        if (reasons.length > 0) {
            doc.setFillColor(...T.surface);
            const reasonsBoxH = reasons.length * 9 + 14;
            doc.roundedRect(ML, y, CW, reasonsBoxH, 3, 3, "F");
            doc.setDrawColor(...T.borderLight);
            doc.roundedRect(ML, y, CW, reasonsBoxH, 3, 3, "S");
            y += 8;
            reasons.forEach(reason => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...T.textDark);
                doc.text(`•  ${reason}`, ML + 8, y);
                y += 9;
            });
            y += 6;
        }

        // Discount callout
        const discountPct = project?.discount_pct || 0;
        const discountReason = project?.discount_reason || "";
        if (discountPct > 0) {
            y = ensureSpace(doc, y, 30, companyName, docTitle, totalPagesRef, T);
            doc.setFillColor(...T.primaryLight);
            doc.roundedRect(ML, y, CW, 22, 3, 3, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...T.accent);
            doc.text(`${discountPct}% Discount Applied`, ML + 8, y + 9);
            if (discountReason) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...T.muted);
                doc.text(sanitiseText(discountReason), ML + 8, y + 17);
            }
            y += 28;
        }

        // Closing statement
        y += 10;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...T.textDark);
        const closingLines = doc.splitTextToSize(sanitiseText(closingText), CW);
        doc.text(closingLines, ML, y);
        y += closingLines.length * 5.5 + 10;

        // MD sign-off
        if (profile?.md_name) {
            y += 4;
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.setTextColor(...T.textMid);
            doc.text("We look forward to working with you.", ML + 5, y);
            y += 12;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...T.textDark);
            doc.text(profile.md_name, ML + 5, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.textMid);
            doc.text("Managing Director", ML + 5, y + 6);
        }
    }

    // ── Signature page ─────────────────────────────────────────────────────
    {
        doc.addPage();
        totalPagesRef.n++;
        let y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
        y = renderSectionHeading(doc, y, "Acceptance & Signatures", T);

        // Summary box
        doc.setFillColor(...T.surface);
        doc.roundedRect(ML, y, CW, 28, 3, 3, "F");
        doc.setDrawColor(...T.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, y, CW, 28, 3, 3, "S");

        const sumCol2 = ML + CW / 3;
        const sumCol3 = ML + (CW * 2) / 3;

        // P1-1 — Domestic Reverse Charge swaps "TOTAL INC. VAT" for the
        // net amount with a reverse-charge label.
        const isReverseCharge = project?.is_vat_reverse_charge === true;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.textMid);
        doc.text(isReverseCharge ? "TOTAL (VAT REVERSE-CHARGED)" : "TOTAL INC. VAT", ML + 6, y + 8);
        doc.text("PROPOSED START", sumCol2 + 3, y + 8);
        doc.text("VALID UNTIL", sumCol3 + 3, y + 8);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...T.textDark);
        const totalValue = displayTotal > 0
            ? (isReverseCharge ? formatGbp(displayTotal) : formatGbp(displayTotal * 1.2))
            : "TBC";
        doc.text(totalValue, ML + 6, y + 21);

        doc.setFontSize(11);
        doc.text(
            project?.start_date ? formatDate(new Date(project.start_date)) : "TBC",
            sumCol2 + 3, y + 21,
        );
        doc.text(formatDate(validUntil), sumCol3 + 3, y + 21);
        y += 36;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...T.textDark);
        const sigText = "By signing below, both parties agree to the Scope of Works, Fee Proposal, and Terms & Conditions set out in this document.";
        const sigLines = doc.splitTextToSize(sigText, CW);
        doc.text(sigLines, ML, y);
        y += sigLines.length * 5.5 + 10;

        // Two signature columns
        const sigBoxW = (CW - 10) / 2;
        const sigBoxX2 = ML + sigBoxW + 10;
        const sigStartY = y;

        function drawSigBlock(x: number, startY: number, heading: string, name: string) {
            let sy = startY;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text(heading, x, sy);
            sy += 6;
            doc.text(name, x, sy);
            sy += 16;

            doc.setDrawColor(...T.textDark);
            doc.setLineWidth(0.5);
            doc.line(x, sy, x + sigBoxW, sy);
            sy += 5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...T.textMid);
            doc.text("Signature", x, sy);
            sy += 8;
            doc.setDrawColor(...T.muted);
            doc.setLineWidth(0.3);
            doc.line(x, sy, x + sigBoxW, sy);
            sy += 5;
            doc.text("Print Name", x, sy);
            sy += 8;
            doc.line(x, sy, x + sigBoxW, sy);
            sy += 5;
            doc.text("Date", x, sy);
            return sy;
        }

        const leftSigEnd = drawSigBlock(ML, sigStartY, "FOR AND ON BEHALF OF THE CONTRACTOR", companyName);
        drawSigBlock(sigBoxX2, sigStartY, "FOR AND ON BEHALF OF THE CLIENT", clientName);
        y = leftSigEnd;

        y += 16;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.textMid);
        const smallPrint = `This Proposal was generated by ${companyName} using Constructa. Acceptance of this proposal constitutes a binding agreement to the stated terms. Ref: ${refCode}.`;
        const spLines = doc.splitTextToSize(smallPrint, CW);
        doc.text(spLines, ML, y);
    }
}
