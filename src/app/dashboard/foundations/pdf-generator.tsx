"use client";

/**
 * Constructa — Proposal PDF Generator
 * Uses the shared pdf-utils module for consistent branding across all documents.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    BRAND,
    buildDocHeader,
    buildSectionHeading,
    buildBodyText,
    buildKeyValue,
    buildDocFooter,
    buildSignatureBlock,
    checkPageBreak,
} from "@/lib/pdf/pdf-utils";

interface Props {
    estimates: any[];
    project: any;
    laborData?: any[];
    materialData?: any[];
    profile?: any;
    dependencies?: any[];
}

export default function PdfDownloadButton({ estimates, project, profile, dependencies }: Props) {

    const generatePDF = () => {
        const doc = new jsPDF();

        // ── PAGE 1: COVER ────────────────────────────────────────────────────
        const grandTotal = estimates.reduce((sum, est) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            return sum + (est.total_cost * markup);
        }, 0);

        let y = buildDocHeader(doc, {
            documentTitle: "Project Proposal",
            profile,
            rightBlockLines: [
                `Date: ${new Date().toLocaleDateString("en-GB")}`,
                `Ref: ${project?.id?.slice(0, 8).toUpperCase() || "N/A"}`,
            ],
        });

        y += 6;
        y = buildKeyValue(doc, y, "Project", project?.name || "Untitled Project");
        y = buildKeyValue(doc, y, "Client", project?.client_name || "Valued Client");
        y = buildKeyValue(doc, y, "Address", project?.address || "As per project details");
        y = buildKeyValue(doc, y, "Type", project?.project_type || "Construction Works");

        // Grand total highlight box
        y += 8;
        doc.setFillColor(...BRAND.navy);
        doc.roundedRect(BRAND.marginL, y, BRAND.contentW, 22, 3, 3, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.white);
        doc.text("TOTAL ESTIMATE VALUE (EXC. VAT)", BRAND.marginL + 6, y + 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`£${grandTotal.toFixed(2)}`, BRAND.marginR - 6, y + 14, { align: "right" });
        y += 32;

        // ── PAGE 2: ABOUT US (if bio exists) ─────────────────────────────────
        if (profile?.bio_text) {
            doc.addPage();
            y = buildDocHeader(doc, { documentTitle: `About ${profile.company_name || "Us"}`, profile });

            y = buildBodyText(doc, y, profile.bio_text);

            if (profile?.usp_text) {
                y += 4;
                y = buildSectionHeading(doc, y, "Why Choose Us");
                y = buildBodyText(doc, y, profile.usp_text);
            }
        }

        // ── PAGE 3: SCOPE & SCHEDULE ──────────────────────────────────────────
        doc.addPage();
        y = buildDocHeader(doc, { documentTitle: "Scope of Works & Programme", profile });

        // Scope narrative
        if (project?.scope_text) {
            y = buildSectionHeading(doc, y, "Scope of Works");
            y = buildBodyText(doc, y, project.scope_text);
            y += 4;
        }

        // Proposed programme
        y = checkPageBreak(doc, y, 40);
        y = buildSectionHeading(doc, y, "Proposed Programme");

        const scheduleData = estimates.map((est, i) => [
            `${i + 1}`,
            est.version_name || "Phase",
            est.duration_days ? `${est.duration_days} days` : "TBC",
            "To be confirmed on commencement",
        ]);

        autoTable(doc, {
            startY: y,
            head: [["#", "Phase / Activity", "Duration", "Notes"]],
            body: scheduleData,
            theme: "grid",
            styles: { fontSize: 9, textColor: BRAND.slate },
            headStyles: { fillColor: BRAND.navy, textColor: BRAND.white, fontStyle: "bold" },
            columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28 } },
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // ── PAGE 4: FINANCIAL BREAKDOWN ────────────────────────────────────────
        y = checkPageBreak(doc, y, 40);
        if (y > 220) {
            doc.addPage();
            y = buildDocHeader(doc, { documentTitle: "Financial Breakdown", profile });
        } else {
            y = buildSectionHeading(doc, y, "Financial Breakdown");
        }

        const financialData = estimates.map(est => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            const total = est.total_cost * markup;
            return [est.version_name || "Item", `£${est.total_cost.toFixed(2)}`, `${((markup - 1) * 100).toFixed(1)}%`, `£${total.toFixed(2)}`];
        });

        // Add grand total row
        financialData.push(["", "", "TOTAL", `£${grandTotal.toFixed(2)}`]);

        autoTable(doc, {
            startY: y,
            head: [["Phase / Activity", "Net Cost", "Markup", "Quoted Price"]],
            body: financialData,
            theme: "grid",
            styles: { fontSize: 9, textColor: BRAND.slate },
            headStyles: { fillColor: BRAND.navy, textColor: BRAND.white, fontStyle: "bold" },
            columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "right", fontStyle: "bold" } },
            // Bold the total row
            didParseCell: (data: any) => {
                if (data.row.index === financialData.length - 1) {
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fillColor = [241, 245, 249] as any; // slate-100 — intentionally lighter than BRAND.light (slate-200)
                }
            },
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // Line item details (collapsible per phase)
        estimates.forEach(est => {
            if (!est.estimate_lines || est.estimate_lines.length === 0) return;
            y = checkPageBreak(doc, y, 30);
            const lineData = est.estimate_lines.map((l: any) => [
                l.description,
                String(l.quantity),
                l.unit,
                `£${Number(l.unit_rate).toFixed(2)}`,
                `£${Number(l.line_total).toFixed(2)}`,
            ]);
            autoTable(doc, {
                startY: y,
                head: [[est.version_name + " — Line Items", "Qty", "Unit", "Rate", "Total"]],
                body: lineData,
                theme: "striped",
                styles: { fontSize: 8, textColor: BRAND.slate },
                headStyles: { fillColor: [51, 65, 85], textColor: BRAND.white, fontStyle: "bold", fontSize: 8 },
                columnStyles: { 1: { cellWidth: 14, halign: "right" }, 2: { cellWidth: 14 }, 3: { cellWidth: 24, halign: "right" }, 4: { cellWidth: 24, halign: "right" } },
            });
            y = (doc as any).lastAutoTable.finalY + 6;
        });

        // ── PAGE 5: EXCLUSIONS & CLARIFICATIONS ───────────────────────────────
        doc.addPage();
        y = buildDocHeader(doc, { documentTitle: "Exclusions, Clarifications & Terms", profile });

        if (project?.exclusions_text) {
            y = buildSectionHeading(doc, y, "Exclusions");
            y = buildBodyText(doc, y, project.exclusions_text);
            y += 6;
        }

        if (project?.clarifications_text) {
            y = buildSectionHeading(doc, y, "Clarifications & Assumptions");
            y = buildBodyText(doc, y, project.clarifications_text);
            y += 6;
        }

        // Standard payment terms
        y = checkPageBreak(doc, y, 40);
        y = buildSectionHeading(doc, y, "Payment Terms");
        const terms = project?.payment_terms
            ? project.payment_terms
            : "Payment is due within 14 days of invoice date. A deposit of 20% is required prior to commencement of works. Interim applications for payment will be submitted at agreed intervals. All prices are exclusive of VAT.";
        y = buildBodyText(doc, y, terms);
        y += 6;

        // Signature block
        y = buildSignatureBlock(doc, y);

        // ── FOOTERS on all pages ───────────────────────────────────────────────
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            buildDocFooter(doc, i, totalPages);
        }

        doc.save(`Proposal-${(project?.name || "Project").replace(/\s+/g, "_")}.pdf`);
    };

    return (
        <button
            onClick={generatePDF}
            className="inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-slate-900 text-white hover:bg-black shadow-sm transition-colors"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Proposal PDF
        </button>
    );
}
