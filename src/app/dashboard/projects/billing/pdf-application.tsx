"use client";

/**
 * Constructa — Application for Payment PDF
 * Uses shared pdf-utils for consistent branding.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    buildDocHeader,
    buildDocFooter,
    buildSectionHeading,
    BRAND,
} from "@/lib/pdf/pdf-utils";

function Button({ children, size, variant, onClick }: { children: React.ReactNode; size?: string; variant?: string; onClick: () => void }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3";
    const bg = variant === "outline" ? "border border-input hover:bg-slate-100 bg-white" : "bg-primary text-primary-foreground hover:bg-primary/90";
    return <button type="button" onClick={onClick} className={`${base} ${bg}`}>{children}</button>;
}

interface Props {
    valuation: any;
    project: any;
    lines: any[];
    estimates: any[];
    previousGross: number;
    profile?: any;
}

export default function PdfApplicationButton({ valuation, project, lines, estimates, previousGross, profile }: Props) {

    const generatePDF = () => {
        const doc = new jsPDF();

        const gross = valuation.gross_total;
        const retentionVal = valuation.retention_amount;
        const prevNet = (gross - retentionVal) - valuation.net_amount;

        // ── HEADER ────────────────────────────────────────────────────────────
        let y = buildDocHeader(doc, {
            documentTitle: `Application for Payment #${valuation.application_number}`,
            profile,
            rightBlockLines: [
                `Date: ${new Date(valuation.valuation_date).toLocaleDateString("en-GB")}`,
                `Project: ${project.name}`,
                `Client: ${project.client_name || "N/A"}`,
            ],
        });

        // ── FINANCIAL SUMMARY BOX ─────────────────────────────────────────────
        y += 4;
        y = buildSectionHeading(doc, y, "Valuation Summary");

        const summaryData = [
            ["Gross Valuation:", `£${gross.toFixed(2)}`],
            ["Less Retention:", `-£${retentionVal.toFixed(2)}`],
            ["Sub-Total:", `£${(gross - retentionVal).toFixed(2)}`],
            ["Less Previous Payments:", `-£${prevNet.toFixed(2)}`],
            ["NET AMOUNT DUE:", `£${valuation.net_amount.toFixed(2)}`],
        ];

        autoTable(doc, {
            startY: y,
            body: summaryData,
            theme: "plain",
            styles: { fontSize: 10, textColor: BRAND.slate },
            columnStyles: {
                0: { fontStyle: "bold", cellWidth: 80 },
                1: { halign: "right", cellWidth: 40 },
            },
            didParseCell: (data: any) => {
                // Highlight the NET row
                if (data.row.index === summaryData.length - 1) {
                    data.cell.styles.textColor = BRAND.blue;
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fontSize = 13;
                }
            },
        });
        y = (doc as any).lastAutoTable.finalY + 12;

        // ── SCHEDULE OF WORKS ─────────────────────────────────────────────────
        y = buildSectionHeading(doc, y, "Schedule of Works — Progress Valuation");

        const tableData = lines.map(line => {
            const est = estimates.find(e => e.id === line.estimate_id);
            const markup = 1 + ((est?.profit_pct || 0) + (est?.overhead_pct || 0) + (est?.risk_pct || 0)) / 100;
            const contractVal = (est?.total_cost || 0) * markup;
            return [
                est?.version_name || "Item",
                `£${contractVal.toFixed(2)}`,
                `${line.progress_percent}%`,
                `£${line.line_value.toFixed(2)}`,
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [["Activity / Works", "Contract Sum", "Progress", "Current Value"]],
            body: tableData,
            theme: "grid",
            styles: { fontSize: 9, textColor: BRAND.slate },
            headStyles: { fillColor: BRAND.navy, textColor: BRAND.white, fontStyle: "bold" },
            columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "right" } },
        });
        y = (doc as any).lastAutoTable.finalY + 12;

        // ── PAYMENT TERMS ─────────────────────────────────────────────────────
        y = buildSectionHeading(doc, y, "Payment Terms & Obligations");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.mid);
        const terms = [
            `1. Payment Due: ${project.payment_terms || "Within 14 Days of this Application."}`,
            `2. Retention Released: 50% on Practical Completion, 50% after Defects Period.`,
            `3. This Application constitutes a valid Payment Notice under the Housing Grants, Construction`,
            `   and Regeneration Act 1996 (as amended).`,
        ];
        terms.forEach(line => {
            doc.text(line, BRAND.marginL, y);
            y += 5.5;
        });

        // ── FOOTERS ───────────────────────────────────────────────────────────
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            buildDocFooter(doc, i, totalPages, "Constructa — Application for Payment");
        }

        doc.save(`Valuation_${valuation.application_number}_${(project.name || "Project").replace(/\s+/g, "_")}.pdf`);
    };

    return <Button size="sm" variant="outline" onClick={generatePDF}>📄 Download PDF</Button>;
}
