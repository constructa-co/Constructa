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
    const responseMode = project?.response_mode === "binding_acceptance"
        ? "binding_acceptance"
        : "acknowledgement";

    // ── Why Choose Us page ─────────────────────────────────────────────────
    // The fallback is a plain thank-you: no claims about expertise or quality
    // the contractor has not written themselves.
    const closingText = project?.closing_statement ||
        `Thank you for considering ${companyName} for this project.`;
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

        // Key facts box — saved profile facts only, stated as saved.
        const reasons: string[] = [];
        if (profile?.years_trading) reasons.push(`${profile.years_trading} years trading`);
        if (profile?.accreditations) {
            const accreds = sanitiseText(String(profile.accreditations)).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            accreds.forEach((a: string) => reasons.push(`Accreditation: ${a}`));
        }
        if (profile?.insurance_details) {
            const insurance = sanitiseText(String(profile.insurance_details)).replace(/\s*\n+\s*/g, "; ");
            if (insurance) reasons.push(`Insurance: ${insurance}`);
        }
        if (profile?.specialisms) {
            const specs = sanitiseText(String(profile.specialisms)).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            if (specs.length > 0) reasons.push(`Specialisms: ${specs.join(", ")}`);
        }

        if (reasons.length > 0) {
            doc.setFillColor(...T.surface);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            const reasonLines = reasons.map(reason => doc.splitTextToSize(`•  ${reason}`, CW - 16) as string[]);
            const reasonsBoxH = reasonLines.reduce((h, lines) => h + 4 + lines.length * 5, 0) + 10;
            doc.roundedRect(ML, y, CW, reasonsBoxH, 3, 3, "F");
            doc.setDrawColor(...T.borderLight);
            doc.roundedRect(ML, y, CW, reasonsBoxH, 3, 3, "S");
            y += 8;
            reasonLines.forEach(lines => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...T.textDark);
                doc.text(lines, ML + 8, y);
                y += 4 + lines.length * 5;
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
        y = renderSectionHeading(
            doc,
            y,
            responseMode === "binding_acceptance" ? "Acceptance & Signatures" : "Acknowledgement & Signatures",
            T,
        );

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
        const vatRate = Number(project?.vat_rate ?? 20);
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
            ? (isReverseCharge ? formatGbp(displayTotal) : formatGbp(displayTotal * (1 + vatRate / 100)))
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
        const sigText = responseMode === "binding_acceptance"
            ? "By signing below, both parties agree to the Scope of Works, Fee Proposal, and Terms & Conditions set out in this document."
            : "Signing below acknowledges receipt and review of this proposal. It does not create a binding agreement or accept the works.";
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
        drawSigBlock(
            sigBoxX2,
            sigStartY,
            responseMode === "binding_acceptance" ? "FOR AND ON BEHALF OF THE CLIENT" : "CLIENT ACKNOWLEDGEMENT",
            clientName,
        );
        y = leftSigEnd;

        y += 16;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.textMid);
        const snapshotRef = project?.proposal_snapshot_hash
            ? ` Snapshot: ${String(project.proposal_snapshot_hash).slice(0, 12)}.`
            : "";
        const smallPrint = (responseMode === "binding_acceptance"
            ? `This Proposal was generated by ${companyName} using Constructa. Acceptance of this proposal constitutes a binding agreement to the stated terms. Ref: ${refCode}.`
            : `This Proposal was generated by ${companyName} using Constructa. Acknowledgement confirms receipt only and does not create a binding agreement. Ref: ${refCode}.`) + snapshotRef;
        const spLines = doc.splitTextToSize(smallPrint, CW);
        doc.text(spLines, ML, y);
    }
}
